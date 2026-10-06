import { isConfigured, subscribeTotal, pushSoul, fetchAllSouls } from "./sync.js";

/* ------------------------------------------------------------------ *
 * Local storage (the copy kept on this phone)
 * ------------------------------------------------------------------ */
const K_NAME = "sw.name";
const K_ENTRIES = "sw.entries";
const K_TOTAL = "sw.total";
const K_ADMIN = "sw.admin";

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
};

let myName = store.get(K_NAME, "");
let entries = store.get(K_ENTRIES, []);       // newest first
let remoteTotal = store.get(K_TOTAL, null);   // last known total across all users
let syncing = false;
let online = navigator.onLine;
let remoteError = false;

const $ = (id) => document.getElementById(id);
const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }));

/* ------------------------------------------------------------------ *
 * Small UI helpers
 * ------------------------------------------------------------------ */
let toastTimer;
function toast(msg, bad = false) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("bad", bad);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const k of kids) if (k) n.append(k);
  return n;
}

const svg = (paths) => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  for (const d of paths) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    s.append(p);
  }
  return s;
};
const PHONE_ICON = ["M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"];
const PIN_ICON = ["M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z", "M12 12.2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4z"];

/* ------------------------------------------------------------------ *
 * Routing: #home, #add, #view
 * ------------------------------------------------------------------ */
const SCREENS = ["home", "add", "view"];

function route() {
  const name = SCREENS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
  for (const s of SCREENS) $(s).hidden = s !== name;
  window.scrollTo(0, 0);
  if (name === "add") {
    $("by-name").textContent = myName;
  } else if (name === "view") {
    renderList();
  } else {
    renderHome();
  }
}
window.addEventListener("hashchange", route);

/* ------------------------------------------------------------------ *
 * Home
 * ------------------------------------------------------------------ */
let shownTotal = 0;
let countAnim = 0;

function setTotal(n) {
  const num = $("total");
  const from = shownTotal;
  shownTotal = n;
  cancelAnimationFrame(countAnim);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || from === n || Math.abs(n - from) > 5000) {
    num.textContent = n.toLocaleString();
    return;
  }
  const start = performance.now();
  const dur = 700;
  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    num.textContent = Math.round(from + (n - from) * eased).toLocaleString();
    if (p < 1) countAnim = requestAnimationFrame(tick);
  };
  countAnim = requestAnimationFrame(tick);
}

const pendingCount = () => entries.filter((e) => !e.synced).length;

function renderHome() {
  $("who").replaceChildren("Hi, ", el("b", { text: myName }), " ·  change");
  // Everyone's total. If Firebase isn't set up yet, fall back to what is on this phone.
  setTotal(isConfigured ? (remoteTotal ?? entries.length) : entries.length);

  const mine = entries.length;
  $("mine-badge").hidden = mine === 0;
  $("mine-badge").textContent = mine;

  const pending = pendingCount();
  let note = "";
  if (!isConfigured) note = "Firebase not set up – saving on this phone only";
  else if (pending && !online) note = `Offline · ${pending} waiting to upload`;
  else if (pending) note = `${pending} waiting to upload`;
  else if (!online) note = "Offline · showing last known total";
  else if (remoteError) note = "Can't reach the server right now";
  $("status").textContent = note;
}

$("who").addEventListener("click", () => openWelcome(true));

/* ------------------------------------------------------------------ *
 * First run / change name
 * ------------------------------------------------------------------ */
function openWelcome(editing) {
  $("w-title").textContent = editing ? "Your name" : "Welcome";
  $("w-sub").hidden = editing;
  $("w-cancel").hidden = !editing;
  $("w-name").value = myName;
  $("e-w").textContent = "";
  $("welcome").hidden = false;
  setTimeout(() => $("w-name").focus(), 50);
}
$("w-cancel").addEventListener("click", () => { $("welcome").hidden = true; });
$("w-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("w-name").value.trim().replace(/\s+/g, " ");
  if (v.length < 2) { $("e-w").textContent = "Please enter your name."; return; }
  myName = v;
  store.set(K_NAME, myName);
  $("welcome").hidden = true;
  route();
});

/* ------------------------------------------------------------------ *
 * Add a soul
 * ------------------------------------------------------------------ */
const URL_RE = /https?:\/\/[^\s<>"']+/i;

function digits(s) { return s.replace(/\D/g, ""); }

function setErr(inputId, errId, msg) {
  $(errId).textContent = msg;
  $(inputId).setAttribute("aria-invalid", msg ? "true" : "false");
  return !msg;
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("f-name").value.trim().replace(/\s+/g, " ");
  const phone = $("f-phone").value.trim();
  const location_ = $("f-location").value.trim();
  const rawMap = $("f-map").value.trim();

  // People often paste "Place name https://maps.app.goo.gl/..." — keep just the link.
  const found = rawMap.match(URL_RE);
  const mapLink = found ? found[0] : "";

  const okName = setErr("f-name", "e-name", name ? "" : "Please enter the name.");
  const okPhone = setErr(
    "f-phone", "e-phone",
    digits(phone).length >= 7 && /^[+\d\s().-]+$/.test(phone) ? "" : "Enter a valid phone number."
  );
  const okMap = setErr("f-map", "e-map", rawMap && !mapLink ? "That doesn't look like a link." : "");
  if (!(okName && okPhone && okMap)) {
    document.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  entries.unshift({
    id: uuid(),
    name,
    phone,
    location: location_,
    mapLink,
    recordedBy: myName,
    capturedAt: new Date().toISOString(),
    synced: false,
  });
  if (!store.set(K_ENTRIES, entries)) {
    entries.shift();
    toast("Couldn't save on this phone (storage full?)", true);
    return;
  }

  $("form").reset();
  location.hash = "#home";
  toast(`${name} saved`);
  syncPending();
});

/* ------------------------------------------------------------------ *
 * Review souls won (local copy only)
 * ------------------------------------------------------------------ */
function mapHref(e) {
  if (e.mapLink && /^https?:\/\//i.test(e.mapLink)) return e.mapLink;
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(e.location);
}

function renderList() {
  const q = $("q").value.trim().toLowerCase();
  const qDigits = digits(q);
  const shown = !q ? entries : entries.filter((e) =>
    e.name.toLowerCase().includes(q) ||
    e.location.toLowerCase().includes(q) ||
    (qDigits && digits(e.phone).includes(qDigits)) ||
    e.phone.toLowerCase().includes(q)
  );

  const total = entries.length;
  $("count").replaceChildren(
    q
      ? document.createTextNode(`Showing `)
      : document.createTextNode("You have won "),
    el("b", { text: String(q ? shown.length : total) }),
    document.createTextNode(q ? ` of ${total}` : total === 1 ? " soul" : " souls")
  );

  const list = $("list");
  list.replaceChildren();
  for (const e of shown) {
    const tel = e.phone.replace(/[^\d+]/g, "");
    const date = new Date(e.capturedAt);
    const meta = el("p", { class: "meta" },
      el("span", { text: isNaN(date) ? "" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) }),
      e.synced ? null : el("span", { class: "pending", text: "Not uploaded yet" })
    );

    const info = el("div", {},
      el("h3", { text: e.name }),
      el("p", { class: "phone", text: e.phone }),
      e.location ? el("p", { class: "loc", text: e.location }) : null,
      meta
    );

    const call = el("a", { class: "icon-btn call", href: "tel:" + tel, "aria-label": `Call ${e.name}` });
    call.append(svg(PHONE_ICON));
    const icons = el("div", { class: "icons" }, call);

    if (e.location || e.mapLink) {
      const map = el("a", {
        class: "icon-btn", href: mapHref(e), target: "_blank", rel: "noopener noreferrer",
        "aria-label": `Open ${e.name}'s location in Maps`,
      });
      map.append(svg(PIN_ICON));
      icons.prepend(map);
    }
    list.append(el("li", { class: "item" }, info, icons));
  }

  const empty = $("empty");
  empty.hidden = shown.length > 0;
  empty.textContent = total === 0 ? "No souls recorded on this phone yet." : "No matches.";
}
$("q").addEventListener("input", renderList);

/* ------------------------------------------------------------------ *
 * Sync with Firebase
 * ------------------------------------------------------------------ */
async function syncPending() {
  if (!isConfigured || syncing || !navigator.onLine) { renderIfHome(); return; }
  syncing = true;
  try {
    // oldest first so the order of arrival is preserved
    for (const e of [...entries].reverse()) {
      if (e.synced) continue;
      try {
        await pushSoul(e);
      } catch (err) {
        console.warn("Upload failed, will retry:", err);
        remoteError = true;
        break;
      }
      remoteError = false;
      e.synced = true;
      store.set(K_ENTRIES, entries);
      renderIfHome();
      if (!$("view").hidden) renderList();
    }
  } finally {
    syncing = false;
    renderIfHome();
  }
}
const renderIfHome = () => { if (!$("home").hidden) renderHome(); };

let unsubscribe = null;
async function watchTotal() {
  if (!isConfigured || unsubscribe || !navigator.onLine) return;
  try {
    unsubscribe = await subscribeTotal(
      (n) => {
        remoteTotal = n;
        remoteError = false;
        store.set(K_TOTAL, n);
        renderIfHome();
      },
      () => { remoteError = true; renderIfHome(); }
    );
  } catch (err) {
    console.warn("Could not start live total:", err);
    remoteError = true;
    renderIfHome();
  }
}

window.addEventListener("online", () => { online = true; watchTotal(); syncPending(); renderIfHome(); });
window.addEventListener("offline", () => { online = false; renderIfHome(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { watchTotal(); syncPending(); }
});

/* ------------------------------------------------------------------ *
 * Hidden export: tap the total 10 times
 * ------------------------------------------------------------------ */
const TAPS_NEEDED = 10;
const TAP_GAP_MS = 2500;
let taps = 0;
let lastTap = 0;

$("total").addEventListener("click", () => {
  const now = Date.now();
  taps = now - lastTap > TAP_GAP_MS ? 1 : taps + 1;
  lastTap = now;
  if (taps >= TAPS_NEEDED) {
    taps = 0;
    store.set(K_ADMIN, true);
    $("export").hidden = false;
  }
});
$("export").hidden = !store.get(K_ADMIN, false);

$("export").addEventListener("click", () => {
  $("e-a").textContent = "";
  $("admin").hidden = false;
  $("a-email").focus();
});
$("a-cancel").addEventListener("click", () => { $("admin").hidden = true; $("a-pass").value = ""; });

$("a-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("a-email").value.trim();
  const pass = $("a-pass").value;
  if (!email || !pass) { $("e-a").textContent = "Enter the admin email and password."; return; }
  if (!isConfigured) { $("e-a").textContent = "Firebase isn't set up yet."; return; }
  if (!navigator.onLine) { $("e-a").textContent = "You're offline."; return; }

  const go = $("a-go");
  go.disabled = true;
  go.textContent = "Exporting…";
  $("e-a").textContent = "";
  try {
    const rows = await fetchAllSouls(email, pass);
    downloadCsv(rows);
    $("admin").hidden = true;
    $("a-pass").value = "";
    toast(`Exported ${rows.length} souls`);
  } catch (err) {
    const code = err && err.code ? String(err.code) : "";
    $("e-a").textContent =
      code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")
        ? "Wrong email or password."
        : code.includes("permission-denied")
          ? "This account isn't allowed to export."
          : "Export failed. Check your connection and try again.";
    console.warn(err);
  } finally {
    go.disabled = false;
    go.textContent = "Export";
  }
});

function csvCell(v) {
  let s = v == null ? "" : String(v);
  // Stop spreadsheet apps from running a cell as a formula (but leave +233… phone numbers alone).
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCsv(rows) {
  const cols = [
    ["Name", "name"], ["Phone", "phone"], ["Location", "location"], ["Location link", "mapLink"],
    ["Recorded by", "recordedBy"], ["Date recorded (phone)", "capturedAt"], ["Date saved (server)", "savedAt"], ["ID", "id"],
  ];
  const lines = [cols.map((c) => csvCell(c[0])).join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c[1]])).join(","));
  // BOM so Excel reads UTF-8 names correctly
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `souls-won-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ------------------------------------------------------------------ *
 * Install (PWA)
 * ------------------------------------------------------------------ */
let installEvent = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
  $("install").hidden = false;
});
$("install").addEventListener("click", async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => {});
  installEvent = null;
  $("install").hidden = true;
});
window.addEventListener("appinstalled", () => { $("install").hidden = true; });

const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
$("ios-hint").hidden = !(iOS && !standalone);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */
if (!myName) openWelcome(false);
route();
watchTotal();
syncPending();
