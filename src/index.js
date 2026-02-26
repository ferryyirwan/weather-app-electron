// src/index.js (Malaysia-only • No Dropdown • Reset dashboard when returning from Planner)
const API_KEY = "32804b24a847407391c53709241010";

// Elements
const elQ = document.getElementById("q");
const elBtn = document.getElementById("btn");
const elMsg = document.getElementById("msg");

const elHero = document.getElementById("hero");
const elHourly = document.getElementById("hourly");
const elForecast = document.getElementById("forecast");
const elAlerts = document.getElementById("alerts");
const elAnalytics = document.getElementById("analytics");

const btnSaveFav = document.getElementById("saveFav");
const elFavBar = document.getElementById("favBar");

// Storage keys
const FAV_KEY = "favCities_v1";
const FROM_PLANNER_KEY = "fromPlanner";

// =====================
// Helpers
// =====================
function setMsg(text) {
  if (elMsg) elMsg.textContent = text || "";
}

function avg(nums) {
  return nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function riskOfRain(maxChance) {
  if (maxChance >= 70) return "High";
  if (maxChance >= 40) return "Medium";
  return "Low";
}

function recommend(risk, tempC) {
  if (risk === "High") return "Indoor recommended (high rain risk).";
  if (tempC >= 24 && tempC <= 33) return "Outdoor recommended (comfortable temp, low rain risk).";
  return "Indoor recommended (temp not ideal).";
}

// Malaysia only normalize
function normalizeMY(input) {
  const q = (input || "").trim();
  if (!q) return "";
  if (q.includes(",")) return q; // user already specified region/country
  return `${q}, Malaysia`;
}

// =====================
// API
// =====================
async function getWeather(locationRaw) {
  const query = normalizeMY(locationRaw);

  const url =
    `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}` +
    `&q=${encodeURIComponent(query)}` +
    `&days=3&aqi=no&alerts=no`;

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `API error ${res.status}`);
  }
  return data;
}

// =====================
// Planner (CRUD) integration
// =====================
function loadActivities() {
  try {
    return JSON.parse(localStorage.getItem("activities_v2")) || [];
  } catch {
    return [];
  }
}

function inRange(temp, minT, maxT) {
  if (minT !== null && minT !== undefined && minT !== "" && temp < Number(minT)) return false;
  if (maxT !== null && maxT !== undefined && maxT !== "" && temp > Number(maxT)) return false;
  return true;
}

function pickActivity({ activities, isRainy, tempC }) {
  let filtered = activities || [];

  if (isRainy) {
    filtered = filtered.filter((a) => a.type === "Indoor" || a.rainAllowed === true);
  }

  filtered = filtered.filter((a) => inRange(tempC, a.minTemp, a.maxTemp));
  if (!filtered.length) return null;

  if (!isRainy) return filtered.find((a) => a.type === "Outdoor") || filtered[0];
  return filtered.find((a) => a.type === "Indoor") || filtered[0];
}

// =====================
// Favorites
// =====================
function loadFavs() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
  } catch {
    return [];
  }
}

function saveFavs(list) {
  localStorage.setItem(FAV_KEY, JSON.stringify(list || []));
}

function renderFavs() {
  if (!elFavBar) return;

  const favs = loadFavs();
  if (!favs.length) {
    elFavBar.innerHTML = `<span class="muted">No favourites yet. Search a city and click Save ⭐</span>`;
    return;
  }

  elFavBar.innerHTML = favs
    .map((city) => {
      const safe = city.replace(/"/g, "&quot;");
      return `
        <div class="chipWrap">
          <button class="chip" data-city="${safe}" type="button">${city}</button>
          <span class="chipX" data-del="${safe}">×</span>
        </div>
      `;
    })
    .join("");
}

// =====================
// Alerts
// =====================
function buildAlerts({ cur, today, maxChance }) {
  const alerts = [];

  // Rain
  if (maxChance >= 90) alerts.push({ level: "high", text: `Heavy rain likely (${maxChance}%). Avoid outdoor activities.` });
  else if (maxChance >= 80) alerts.push({ level: "med", text: `High chance of rain (${maxChance}%). Bring umbrella / consider indoor.` });
  else if (maxChance >= 60) alerts.push({ level: "low", text: `Possible rain (${maxChance}%). Plan accordingly.` });

  // Heat
  const maxT = Number(today?.day?.maxtemp_c);
  if (Number.isFinite(maxT) && maxT >= 35) alerts.push({ level: "high", text: `Extreme heat (Max ${maxT}°C). Stay hydrated, avoid outdoor noon.` });
  else if (Number.isFinite(maxT) && maxT >= 33) alerts.push({ level: "med", text: `Hot day (Max ${maxT}°C). Outdoor best early morning/evening.` });

  // Wind
  const wind = Number(today?.day?.maxwind_kph);
  if (Number.isFinite(wind) && wind >= 40) alerts.push({ level: "med", text: `Strong wind (Max ${wind} kph). Be cautious outdoors.` });

  // Keywords
  const cond = (cur?.condition?.text || "").toLowerCase();
  if (cond.includes("thunder") || cond.includes("storm")) alerts.push({ level: "high", text: `Thunderstorm detected. Avoid open areas.` });
  if (cond.includes("fog") || cond.includes("mist")) alerts.push({ level: "low", text: `Low visibility (mist/fog). Drive carefully.` });

  return alerts;
}

function renderAlerts(alerts) {
  if (!elAlerts) return;

  if (!alerts || !alerts.length) {
    elAlerts.innerHTML = `
      <div class="alertGlass alertNormal">
        <div class="alertHeader">
          <span class="alertIcon">✅</span>
          <span>No active weather alerts</span>
        </div>
      </div>
    `;
    return;
  }

  const order = { high: 0, med: 1, low: 2 };
  const sorted = [...alerts].sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9));

  elAlerts.innerHTML = sorted
    .map((a) => {
      const typeClass = a.level === "high" ? "alertHigh" : a.level === "med" ? "alertMed" : "alertLow";
      const icon = a.level === "high" ? "⚠️" : a.level === "med" ? "🌧" : "ℹ️";
      return `
        <div class="alertGlass ${typeClass}">
          <div class="alertHeader">
            <span class="alertIcon">${icon}</span>
            <span class="alertText">${a.text}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

// =====================
// Render UI
// =====================


function renderHero({ loc, cur, today }) {
  if (!elHero) return;

  const minT = Number(today?.day?.mintemp_c);
  const maxT = Number(today?.day?.maxtemp_c);
  const denom = (maxT - minT) || 1;
  const pct = clamp(((cur.temp_c - minT) / denom) * 100, 0, 100);

  elHero.innerHTML = `
    <div class="heroRow">
      <div>
        <div class="place">${loc.name}, ${loc.country}</div>
        <div class="meta">Local time: ${loc.localtime}</div>

        <div class="row" style="gap:10px; margin-top:8px;">
          <img class="condIcon" src="https:${cur.condition.icon}" alt="icon" />
          <div class="condition">${cur.condition.text}</div>
        </div>

        <div class="miniStats">
          <span>Feels ${Math.round(cur.feelslike_c)}°</span>
          <span>Humidity ${cur.humidity}%</span>
          <span>Wind ${Math.round(cur.wind_kph)} km/h</span>
        </div>
      </div>

      <div style="text-align:right;">
        <div class="bigTemp">${Math.round(cur.temp_c)}°</div>
        <div class="hiLo">H: ${Math.round(maxT)}°  L: ${Math.round(minT)}°</div>

        <div class="tempBarWrap">
          <div class="tempBar">
            <div class="tempFill" style="left:${pct}%"></div>
          </div>
          <div class="tempLabels">
            <span>${Math.round(minT)}°</span>
            <span>${Math.round(maxT)}°</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderHourly({ loc, days }) {
  if (!elHourly) return;

  const today = days?.[0];
  const tomorrow = days?.[1];

  const hoursToday = today?.hour || [];
  const hoursTomorrow = tomorrow?.hour || [];

  const allHours = [...hoursToday, ...hoursTomorrow];

  if (!allHours.length) {
    elHourly.innerHTML = `<div class="muted">No hourly data available.</div>`;
    return;
  }

  let nowHour = 0;
  try {
    nowHour = Number(loc.localtime.split(" ")[1].split(":")[0]);
    if (!Number.isFinite(nowHour)) nowHour = 0;
  } catch {
    nowHour = 0;
  }

  const startIndex = allHours.findIndex((h) => {
    const hDate = h.time.split(" ")[0];
    const hHour = Number(h.time.split(" ")[1].split(":")[0]);
    const todayDate = today?.date;

    return hDate === todayDate && hHour >= nowHour;
  });

  const sliceStart = startIndex === -1 ? 0 : startIndex;
  const next12 = allHours.slice(sliceStart, sliceStart + 12);

  elHourly.innerHTML = next12
    .map((h, i) => {
      const isNow = i === 0 ? "now" : "";
      return `
        <div class="hourCard ${isNow}">
          <div class="hourTime">${i === 0 ? "Now" : h.time.split(" ")[1]}</div>
          <img class="hourIcon" src="https:${h.condition.icon}" alt="icon"/>
          <div class="hourTemp">${Math.round(h.temp_c)}°</div>
          <div class="hourRain">${h.chance_of_rain ?? 0}%</div>
        </div>
      `;
    })
    .join("");
}

function renderDaily(days) {
  if (!elForecast) return;

  elForecast.innerHTML = (days || [])
    .map((d, i) => {
      const todayClass = i === 0 ? "today" : "";
      return `
        <div class="dayRow ${todayClass}">
          <div class="dayLeft">
            <b>${i === 0 ? "Today" : d.date}</b>
            <div class="daySub">${d.day.condition.text}</div>
            <div class="daySub">Rain chance: ${d.day.daily_chance_of_rain ?? "N/A"}%</div>
          </div>
          <div class="dayRight">
            <div><span class="badge">Min ${Math.round(d.day.mintemp_c)}°</span></div>
            <div style="margin-top:8px;"><span class="badge">Max ${Math.round(d.day.maxtemp_c)}°</span></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderDecisionSupport({ avgMax, avgMin, risk, maxChance, suggestion, activityText }) {
  if (!elAnalytics) return;

  const riskClass = risk === "High" ? "riskHigh" : risk === "Medium" ? "riskMed" : "riskLow";

  elAnalytics.innerHTML = `
    <div class="dsGrid">
      <div class="dsItem">
        <div class="dsLabel">Average Max (3 days)</div>
        <div class="dsValue">${avgMax} °C</div>
      </div>
      <div class="dsItem">
        <div class="dsLabel">Average Min (3 days)</div>
        <div class="dsValue">${avgMin} °C</div>
      </div>
      <div class="dsItem">
        <div class="dsLabel">Risk of Rain</div>
        <div class="dsValue riskBadge ${riskClass}">${risk} (${maxChance}%)</div>
      </div>
      <div class="dsItem">
        <div class="dsLabel">Recommendation</div>
        <div class="dsValue">${suggestion}</div>
      </div>
    </div>
    <div style="margin-top:10px;">
      ${activityText}
    </div>
  `;
}

function renderAll(data) {
  const loc = data.location;
  const cur = data.current;
  const days = data.forecast?.forecastday || [];
  if (!days.length) throw new Error("No forecast data returned.");

  const today = days[0];


  renderHero({ loc, cur, today });
  renderHourly({ loc, days });
  renderDaily(days);

  const avgMax = avg(days.map((d) => d.day.maxtemp_c)).toFixed(1);
  const avgMin = avg(days.map((d) => d.day.mintemp_c)).toFixed(1);

  const chances = days.map((d) => Number(d.day.daily_chance_of_rain)).filter((n) => Number.isFinite(n));
  const maxChance = chances.length ? Math.max(...chances) : 0;

  const risk = riskOfRain(maxChance);
  const suggestion = recommend(risk, cur.temp_c);

  renderAlerts(buildAlerts({ cur, today, maxChance }));

  const activities = loadActivities();
  const isRainy = maxChance >= 70;
  const picked = pickActivity({ activities, isRainy, tempC: cur.temp_c });

  const activityText = picked
    ? `<p><b>Suggested Activity:</b> ${picked.name} (${picked.type})</p><p>${picked.note || ""}</p>`
    : `<p><b>Suggested Activity:</b> None found. Add activities in Planner.</p>`;

  renderDecisionSupport({ avgMax, avgMin, risk, maxChance, suggestion, activityText });

  document.querySelectorAll(".glass").forEach((el) => {
    el.classList.remove("fadeIn");
    void el.offsetWidth;
    el.classList.add("fadeIn");
  });
}

// =====================
// Reset dashboard (NO restore)
// =====================
function resetDashboardUI() {
  // clear input always
  if (elQ) elQ.value = "";
  setMsg("");

  // clear panels
  if (elHero) elHero.innerHTML = "";
  if (elHourly) elHourly.innerHTML = "";
  if (elForecast) elForecast.innerHTML = "";
  if (elAlerts) elAlerts.innerHTML = "";
  if (elAnalytics) elAnalytics.innerHTML = "";


}

// =====================
// Actions
// =====================
async function doSearch(city) {
  const raw = (city ?? elQ?.value ?? "").trim();
  if (!raw) return setMsg("Please enter a location.");

  try {
    setMsg("Loading...");
    const data = await getWeather(raw);
    renderAll(data);
    setMsg("Done ✅");

    // IMPORTANT: clear input so it never “sticks”
    if (elQ) elQ.value = "";
  } catch (e) {
    console.error(e);
    setMsg("Failed: " + e.message);
  }
}

// Search button
elBtn?.addEventListener("click", (e) => {
  e.preventDefault?.();
  doSearch();
});

// Enter key
elQ?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    doSearch();
  }
});

// Save favourite
btnSaveFav?.addEventListener("click", () => {
  const raw = (elQ?.value || "").trim();
  if (!raw) return setMsg("Type a city then click Save ⭐");

  const city = normalizeMY(raw);

  let favs = loadFavs();
  favs = favs.filter((x) => x.toLowerCase() !== city.toLowerCase());
  favs.unshift(city);
  favs = favs.slice(0, 8);

  saveFavs(favs);
  renderFavs();
  setMsg(`Saved: ${city}`);

  if (elQ) elQ.value = "";
});

// Click favourite chip
elFavBar?.addEventListener("click", (e) => {
  const cityBtn = e.target.closest("button[data-city]");
  if (cityBtn) {
    const city = cityBtn.getAttribute("data-city");
    if (!city) return;
    doSearch(city);
    return;
  }

  const delBtn = e.target.closest("[data-del]");
  if (delBtn) {
    const city = delBtn.getAttribute("data-del");
    let favs = loadFavs();
    favs = favs.filter((c) => c !== city);
    saveFavs(favs);
    renderFavs();
    setMsg(`Removed: ${city}`);
  }
});

// Init
renderFavs();

// Always reset dashboard whenever this page is shown (fresh load / back from planner)
window.addEventListener("pageshow", () => {
  // regardless of fromPlanner, we reset
  resetDashboardUI();
  sessionStorage.removeItem(FROM_PLANNER_KEY);
});