const KEY = "activities_v2";

const elName = document.getElementById("name");
const elType = document.getElementById("type");
const elNote = document.getElementById("note");
const elMinTemp = document.getElementById("minTemp");
const elMaxTemp = document.getElementById("maxTemp");
const elRainAllowed = document.getElementById("rainAllowed");

const elMsg = document.getElementById("msg");
const elRows = document.getElementById("rows");

const btnAdd = document.getElementById("btnAdd");
const btnUpdate = document.getElementById("btnUpdate");
const btnCancel = document.getElementById("btnCancel");

let editingId = null;

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function uid() {
  return "A" + Date.now();
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resetForm() {
  elName.value = "";
  elType.value = "Outdoor";
  elNote.value = "";
  elMinTemp.value = "";
  elMaxTemp.value = "";
  elRainAllowed.value = "No";

  editingId = null;
  btnUpdate.disabled = true;
  btnCancel.disabled = true;
  btnAdd.disabled = false;
}

function setMsg(text) {
  elMsg.textContent = text;
}

function rulesText(item) {
  const min = item.minTemp ?? "-";
  const max = item.maxTemp ?? "-";
  const rain = item.rainAllowed ? "Rain OK" : "No Rain";
  return `Temp: ${min}–${max} °C, ${rain}`;
}

function render() {
  const list = load();
  elRows.innerHTML = list.map(item => `
    <tr>
      <td><b>${item.name}</b></td>
      <td>${item.type}</td>
      <td>${rulesText(item)}</td>
      <td>${item.note || ""}</td>
      <td>
        <button data-edit="${item.id}">Edit</button>
        <button data-del="${item.id}">Delete</button>
      </td>
    </tr>
  `).join("");
}

function validate(name, minTemp, maxTemp) {
  if (!name) return "Name is required.";
  if (minTemp !== null && maxTemp !== null && minTemp > maxTemp) {
    return "Min Temp cannot be greater than Max Temp.";
  }
  return null;
}

btnAdd.addEventListener("click", () => {
  const name = elName.value.trim();
  const type = elType.value;
  const note = elNote.value.trim();

  const minTemp = toNum(elMinTemp.value);
  const maxTemp = toNum(elMaxTemp.value);
  const rainAllowed = elRainAllowed.value === "Yes";

  const err = validate(name, minTemp, maxTemp);
  if (err) { setMsg(err); return; }

  const list = load();
  list.push({ id: uid(), name, type, note, minTemp, maxTemp, rainAllowed });
  save(list);
  render();
  resetForm();
  setMsg("Added ✅");
});

btnUpdate.addEventListener("click", () => {
  if (!editingId) return;

  const name = elName.value.trim();
  const type = elType.value;
  const note = elNote.value.trim();

  const minTemp = toNum(elMinTemp.value);
  const maxTemp = toNum(elMaxTemp.value);
  const rainAllowed = elRainAllowed.value === "Yes";

  const err = validate(name, minTemp, maxTemp);
  if (err) { setMsg(err); return; }

  const list = load();
  const idx = list.findIndex(x => x.id === editingId);
  if (idx === -1) { setMsg("Item not found."); return; }

  list[idx] = { ...list[idx], name, type, note, minTemp, maxTemp, rainAllowed };
  save(list);
  render();
  resetForm();
  setMsg("Updated ✅");
});

btnCancel.addEventListener("click", () => {
  resetForm();
  setMsg("Cancelled.");
});

elRows.addEventListener("click", (e) => {
  const editId = e.target.getAttribute("data-edit");
  const delId = e.target.getAttribute("data-del");

  const list = load();

  if (editId) {
    const item = list.find(x => x.id === editId);
    if (!item) return;

    elName.value = item.name;
    elType.value = item.type;
    elNote.value = item.note || "";
    elMinTemp.value = item.minTemp ?? "";
    elMaxTemp.value = item.maxTemp ?? "";
    elRainAllowed.value = item.rainAllowed ? "Yes" : "No";

    editingId = item.id;
    btnUpdate.disabled = false;
    btnCancel.disabled = false;
    btnAdd.disabled = true;
    setMsg("Editing...");
  }

  if (delId) {
    const newList = list.filter(x => x.id !== delId);
    save(newList);
    render();
    resetForm();
    setMsg("Deleted ✅");
  }
});

render();
resetForm();