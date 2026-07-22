/**
 * Area 4 — Sheets JSON API (Google Apps Script Web App).
 *
 * Serves the GROUPS list and per-group MEMBERS from a Google Sheet, and accepts
 * create/update of members. Attendance is NOT stored here (that lives in
 * Firebase) — this backend only owns the membership data the admin uploads.
 *
 * Deploy:  Extensions → Apps Script → paste this + appsscript.json →
 *          Deploy → New deployment → Web app →
 *          Execute as: Me,  Who has access: Anyone.
 * Put the resulting /exec URL into Cloudflare Pages env var SHEETS_API_URL.
 *
 * Called server-side only (Cloudflare Pages Function / Vite proxy), so no CORS
 * handling is required here.
 */

var SHEETS = { GROUPS: 'GROUPS', MEMBERS: 'MEMBERS' };
var GROUP_HEADERS = ['GROUP_ID', 'NAME', 'DESCRIPTION', 'LEADER', 'CONTACT', 'MEETING_DAY'];
var MEMBER_HEADERS = ['MEMBER_ID', 'GROUP_ID', 'NAME', 'CONTACT', 'RESIDENCE', 'GENDER', 'STATUS', 'DATE_JOINED', 'NOTES'];

function doGet(e) {
  return route((e && e.parameter && e.parameter.action) || '', (e && e.parameter) || {}, null);
}

function doPost(e) {
  var body = {};
  try { body = e && e.postData ? JSON.parse(e.postData.contents) : {}; } catch (err) { body = {}; }
  var action = body.action || (e && e.parameter && e.parameter.action) || '';
  return route(action, (e && e.parameter) || {}, body);
}

function route(action, params, body) {
  var out;
  try {
    switch (action) {
      case 'groups': out = getGroups(); break;
      case 'members': out = getMembers(params.groupId || (body && body.groupId)); break;
      case 'addMember': out = addMember((body && body.member) || {}); break;
      case 'updateMember': out = updateMember((body && body.member) || {}); break;
      case 'setup': out = setupSheets(); break;
      default: out = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    out = { error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Reads ----------
function getGroups() {
  var rows = readSheet_(SHEETS.GROUPS);
  return rows.filter(function (r) { return String(r.NAME || '').trim(); }).map(function (r) {
    return {
      id: r.GROUP_ID, name: r.NAME, description: r.DESCRIPTION,
      leader: r.LEADER, contact: r.CONTACT, meetingDay: r.MEETING_DAY
    };
  });
}

function getMembers(groupId) {
  var rows = readSheet_(SHEETS.MEMBERS);
  return rows
    .filter(function (r) { return String(r.NAME || '').trim() && String(r.GROUP_ID) === String(groupId); })
    .map(memberObj_);
}

// ---------- Writes ----------
function addMember(m) {
  if (!m || !String(m.name || '').trim()) throw new Error('Member name is required.');
  if (!String(m.groupId || '').trim()) throw new Error('groupId is required.');
  var sh = sheet_(SHEETS.MEMBERS);
  var id = 'MEM-' + Utilities.getUuid().substring(0, 8);
  var today = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
  sh.appendRow([id, m.groupId, m.name.trim(), m.contact || '', m.residence || '',
    m.gender || '', m.status || 'Active', m.dateJoined || today, m.notes || '']);
  return { ok: true, id: id };
}

function updateMember(m) {
  if (!m || !m.id) throw new Error('Member id is required.');
  if (!String(m.name || '').trim()) throw new Error('Member name is required.');
  var sh = sheet_(SHEETS.MEMBERS);
  var values = sh.getDataRange().getValues();
  var idx = headerIndex_(values[0]);
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idx.MEMBER_ID]) === String(m.id)) {
      sh.getRange(r + 1, idx.NAME + 1).setValue(m.name.trim());
      sh.getRange(r + 1, idx.CONTACT + 1).setValue(m.contact || '');
      sh.getRange(r + 1, idx.RESIDENCE + 1).setValue(m.residence || '');
      sh.getRange(r + 1, idx.GENDER + 1).setValue(m.gender || '');
      sh.getRange(r + 1, idx.STATUS + 1).setValue(m.status || 'Active');
      if (idx.NOTES != null) sh.getRange(r + 1, idx.NOTES + 1).setValue(m.notes || '');
      return { ok: true, id: m.id };
    }
  }
  throw new Error('Member not found: ' + m.id);
}

// ---------- Helpers ----------
function memberObj_(r) {
  return {
    id: r.MEMBER_ID, groupId: r.GROUP_ID, name: r.NAME, contact: r.CONTACT,
    residence: r.RESIDENCE, gender: r.GENDER, status: r.STATUS || 'Active',
    dateJoined: r.DATE_JOINED, notes: r.NOTES || ''
  };
}

function readSheet_(name) {
  var sh = sheet_(name);
  if (sh.getLastRow() < 2) return [];
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[String(headers[c]).trim()] = values[r][c];
    out.push(obj);
  }
  return out;
}

function headerIndex_(headers) {
  var idx = {};
  headers.forEach(function (h, i) { idx[String(h).trim()] = i; });
  return idx;
}

function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Missing sheet tab "' + name + '". Run the setup action.');
  return sh;
}

function tz_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'Africa/Accra';
}

/** Creates the GROUPS/MEMBERS tabs with headers + a couple of sample rows. */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensure_(ss, SHEETS.GROUPS, GROUP_HEADERS);
  ensure_(ss, SHEETS.MEMBERS, MEMBER_HEADERS);
  var groups = sheet_(SHEETS.GROUPS);
  if (groups.getLastRow() < 2) {
    groups.appendRow(['G1', 'Choir', 'Praise & worship team', 'Ama Boateng', '', 'Saturday']);
    groups.appendRow(['G2', 'Ushers', 'Welcome & seating', 'Kofi Mensah', '', 'Sunday']);
  }
  return { ok: true };
}

function ensure_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  var first = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  var has = headers.every(function (hName, i) { return first[i] === hName; });
  if (!has) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4f46e5').setFontColor('#fff');
  sh.setFrozenRows(1);
  return sh;
}
