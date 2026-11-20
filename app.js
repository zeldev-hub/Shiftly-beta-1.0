"use strict";

const MEMBERS_KEY = "shiftly_members_v2";
const SCHEDULE_KEY = "shiftly_schedule_v2";
const SETTINGS_KEY = "shiftly_settings_v2";

let members = [];
let savedSchedule = {
  shifts: [], stats: [], startDate: "", endDate: "", settings: {}
};
let appSettings = {
  workHours: 24,
  restHours: 144,
  orderMode: "balanced",
  fridayStart: "08:00",
  saturdayStart: "08:00"
};
let toastTimer = null;

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error("Storage read error:", key, error);
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Storage save error:", error);
    showToast("تعذر الحفظ. تحقق من مساحة التخزين.");
    return false;
  }
}

function loadApplicationData() {
  const loadedMembers = loadJSON(MEMBERS_KEY, []);
  const loadedSchedule = loadJSON(SCHEDULE_KEY, null);
  const loadedSettings = loadJSON(SETTINGS_KEY, null);
  members = Array.isArray(loadedMembers) ? loadedMembers : [];
  if (loadedSchedule && Array.isArray(loadedSchedule.shifts)) {
    savedSchedule = {
      shifts: [], stats: [], startDate: "", endDate: "", settings: {},
      ...loadedSchedule
    };
  }
  if (loadedSettings && typeof loadedSettings === "object") {
    appSettings = { ...appSettings, ...loadedSettings };
  }
  if (savedSchedule.settings && typeof savedSchedule.settings === "object") {
    appSettings = { ...appSettings, ...savedSchedule.settings };
  }
}

function persistMembers() {
  const ok = saveJSON(MEMBERS_KEY, members);
  if (ok) updateLastSaved();
  return ok;
}
function persistSchedule() {
  const ok = saveJSON(SCHEDULE_KEY, savedSchedule);
  if (ok) updateLastSaved();
  return ok;
}
function persistSettings() {
  const ok = saveJSON(SETTINGS_KEY, appSettings);
  if (ok) updateLastSaved();
  return ok;
}
function makeId() {
  return "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => page.classList.toggle("active", page.id === pageId));
  document.querySelectorAll(".nav-btn").forEach(button => button.classList.toggle("active", button.dataset.page === pageId));
  if (window.scrollTo) window.scrollTo({ top: 0, behavior: "smooth" });
}
function updateHome() {
  const shifts = Array.isArray(savedSchedule.shifts) ? savedSchedule.shifts : [];
  const covered = shifts.filter(shift => shift.covered);
  const values = {
    homeMembers: members.length,
    homeShifts: shifts.length,
    homeHours: covered.reduce((sum, shift) => sum + Number(shift.hours || 0), 0),
    homeUncovered: shifts.filter(shift => !shift.covered).length
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
}
function updateLastSaved() {
  const element = document.getElementById("lastSaved");
  if (element) element.textContent = "آخر حفظ: " + new Date().toLocaleString("ar-DZ");
}
function localInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function parseLocal(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}
function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ar-DZ", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  });
}
function setDefaultDates() {
  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setDate(nextMonth.getDate() + 29);
  if (startInput && !startInput.value) startInput.value = localInput(today);
  if (endInput && !endInput.value) endInput.value = localInput(nextMonth);

  const fields = {
    workHours: 24,
    restHours: appSettings.restHours,
    orderMode: appSettings.orderMode,
    fridayStart: appSettings.fridayStart,
    saturdayStart: appSettings.saturdayStart
  };
  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element && value !== undefined && value !== null) element.value = value;
  });
}
function readScheduleSettings() {
  const getValue = id => document.getElementById(id)?.value;
  const restRaw = getValue("restHours");
  const orderRaw = getValue("orderMode");
  const fridayRaw = getValue("fridayStart");
  const saturdayRaw = getValue("saturdayStart");
  if (restRaw === undefined || orderRaw === undefined || fridayRaw === undefined || saturdayRaw === undefined) {
    showToast("بعض إعدادات الجدول غير موجودة. تأكد من تحديث Index.html.");
    return null;
  }
  const restHours = Number(restRaw);
  if (!Number.isFinite(restHours) || restHours < 0 || restHours > 720) {
    showToast("أدخل مدة راحة صحيحة بين 0 و720 ساعة.");
    return null;
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(fridayRaw) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(saturdayRaw)) {
    showToast("حدد وقت بداية صحيحاً لمناوبتي الجمعة والسبت.");
    return null;
  }
  const settings = {
    workHours: 24,
    restHours,
    orderMode: orderRaw === "ordered" ? "ordered" : "balanced",
    fridayStart: fridayRaw,
    saturdayStart: saturdayRaw
  };
  appSettings = { ...appSettings, ...settings };
  persistSettings();
  return settings;
}
