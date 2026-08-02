/**
 * Area 4 — Sheets JSON API (Google Apps Script Web App).
 *
 * DATA LAYOUT
 *   • The script is bound to (or opens) ONE master "groups registry" spreadsheet
 *     with a GROUPS tab. Each group row points to that group's OWN separate
 *     members spreadsheet (managed by a different person).
 *   • getMembers/addMember/updateMember open the group's own spreadsheet by id.
 *
 * GROUPS tab columns:
 *   GROUP_ID | NAME | DESCRIPTION | LEADER | CONTACT | MEETING_DAY | MEMBERS_SHEET | MEMBERS_TAB
 *     - MEMBERS_SHEET: the group's members spreadsheet — a full URL or the id.
 *     - MEMBERS_TAB:   (optional) tab name in that sheet. Blank → a tab named
 *                      "MEMBERS" if present, otherwise the first tab.
 *
 * Each group's members sheet just needs a header row with at least NAME. Common
 * header names are auto-detected (see FIELD_ALIASES). A MEMBER_ID column is
 * added/back-filled automatically so members have stable ids for attendance.
 *
 * IMPORTANT: the Google account that DEPLOYS this web app must have EDIT access
 * to every group's members spreadsheet (share each one with that account).
 *
 * Deploy: Apps Script → Deploy → New deployment → Web app →
 *         Execute as: Me, Who has access: Anyone. Put the /exec URL into the
 *         Cloudflare Pages env var SHEETS_API_URL.
 */

var GROUPS_TAB = 'GROUPS';
var GROUP_HEADERS = ['GROUP_ID', 'NAME', 'DESCRIPTION', 'LEADER', 'CONTACT', 'MEETING_DAY', 'MEMBERS_SHEET', 'MEMBERS_TAB'];

// Flexible header detection for the independently-managed group member sheets.
var FIELD_ALIASES = {
  id: ['MEMBER_ID', 'MEMBERID', 'ID'],
  name: ['NAME', 'FULL NAME', 'FULLNAME', 'MEMBER NAME', 'MEMBER'],
  contact: ['CONTACT', 'PHONE', 'PHONE NUMBER', 'TEL', 'TELEPHONE', 'MOBILE', 'CONTACT NUMBER'],
  residence: ['RESIDENCE', 'ADDRESS', 'LOCATION', 'AREA', 'HOUSE ADDRESS'],
  gender: ['GENDER', 'SEX'],
  status: ['STATUS', 'MEMBERSHIP STATUS'],
  location: ['LOCATION', 'GPS', 'COORDINATES', 'COORDS', 'GEO', 'LATLNG', 'LAT_LNG', 'LAT/LNG'],
  mapLink: ['MAP_LINK', 'MAP LINK', 'MAPLINK', 'GOOGLE MAPS', 'GOOGLE MAP', 'MAPS LINK', 'MAP URL', 'MAPS', 'MAP'],
  dateJoined: ['DATE_JOINED', 'DATE JOINED', 'JOINED', 'JOIN DATE'],
  notes: ['NOTES', 'NOTE', 'REMARKS', 'COMMENT', 'COMMENTS']
};

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
      case 'setup': out = setupGroupsSheet(); break;
      default: out = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    out = { error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// GROUPS (master registry)
// ---------------------------------------------------------------------------
function getGroups() {
  var rows = readTab_(groupsTab_());
  return rows.filter(function (r) { return String(r.NAME || '').trim(); }).map(function (r) {
    var ref = String(r.MEMBERS_SHEET || '').trim();
    return {
      id: r.GROUP_ID, name: r.NAME, description: r.DESCRIPTION,
      leader: r.LEADER, contact: r.CONTACT, meetingDay: r.MEETING_DAY,
      membersTab: String(r.MEMBERS_TAB || '').trim(),
      sheetUrl: ref ? sheetUrl_(ref) : ''
    };
  });
}

function groupsTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No active spreadsheet. Bind this script to the master GROUPS sheet.');
  var sh = ss.getSheetByName(GROUPS_TAB);
  if (!sh) throw new Error('Missing "' + GROUPS_TAB + '" tab. Run the setup action.');
  return sh;
}

function groupById_(groupId) {
  var rows = readTab_(groupsTab_());
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].GROUP_ID) === String(groupId)) return rows[i];
  }
  throw new Error('Group not found: ' + groupId);
}

/** Opens the members TAB (a Sheet) of a group's own spreadsheet. */
function membersTabFor_(groupId) {
  var g = groupById_(groupId);
  var ref = String(g.MEMBERS_SHEET || '').trim();
  if (!ref) throw new Error('Group "' + (g.NAME || groupId) + '" has no MEMBERS_SHEET set in the GROUPS tab.');
  var ss;
  try {
    ss = SpreadsheetApp.openById(extractSheetId_(ref));
  } catch (err) {
    throw new Error('Cannot open the members sheet for "' + (g.NAME || groupId) +
      '". Make sure the deploying account has access. (' + err + ')');
  }
  var tabName = String(g.MEMBERS_TAB || '').trim();
  var tab = tabName ? ss.getSheetByName(tabName) : (ss.getSheetByName('MEMBERS') || ss.getSheets()[0]);
  if (!tab) throw new Error('Members tab "' + (tabName || 'MEMBERS') + '" not found in the group sheet.');
  return tab;
}

// ---------------------------------------------------------------------------
// MEMBERS (per-group sheets)
// ---------------------------------------------------------------------------
function getMembers(groupId) {
  var tab = membersTabFor_(groupId);
  var cols = ensureMemberIds_(tab); // guarantees a MEMBER_ID column + ids
  if (tab.getLastRow() < 2) return [];
  var values = tab.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (String(row[cols.name] || '').trim() === '') continue;
    out.push({
      id: row[cols.id],
      groupId: groupId,
      name: row[cols.name],
      contact: cols.contact >= 0 ? row[cols.contact] : '',
      residence: cols.residence >= 0 ? row[cols.residence] : '',
      location: cols.location >= 0 ? row[cols.location] : '',
      mapLink: cols.mapLink >= 0 ? row[cols.mapLink] : '',
      gender: cols.gender >= 0 ? row[cols.gender] : '',
      status: (cols.status >= 0 ? row[cols.status] : '') || 'Active',
      dateJoined: cols.dateJoined >= 0 ? row[cols.dateJoined] : '',
      notes: cols.notes >= 0 ? row[cols.notes] : ''
    });
  }
  return out;
}

function addMember(m) {
  if (!m || !String(m.name || '').trim()) throw new Error('Member name is required.');
  if (!String(m.groupId || '').trim()) throw new Error('groupId is required.');
  var tab = membersTabFor_(m.groupId);
  var cols = ensureMemberIds_(tab);
  if (String(m.location || '').trim() && cols.location < 0) cols.location = addColumn_(tab, 'LOCATION');
  if (String(m.mapLink || '').trim() && cols.mapLink < 0) cols.mapLink = addColumn_(tab, 'MAP_LINK');
  var width = Math.max(tab.getLastColumn(), highestIndex_(cols) + 1);
  var rowArr = new Array(width).fill('');
  rowArr[cols.id] = 'MEM-' + Utilities.getUuid().substring(0, 8);
  rowArr[cols.name] = String(m.name).trim();
  setIf_(rowArr, cols.contact, m.contact);
  setIf_(rowArr, cols.residence, m.residence);
  setIf_(rowArr, cols.location, m.location);
  setIf_(rowArr, cols.mapLink, m.mapLink);
  setIf_(rowArr, cols.gender, m.gender);
  setIf_(rowArr, cols.status, m.status || 'Active');
  if (cols.dateJoined >= 0) rowArr[cols.dateJoined] = m.dateJoined ||
    Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
  setIf_(rowArr, cols.notes, m.notes);
  tab.appendRow(rowArr);
  return { ok: true, id: rowArr[cols.id] };
}

function updateMember(m) {
  if (!m || !m.id) throw new Error('Member id is required.');
  if (!String(m.name || '').trim()) throw new Error('Member name is required.');
  var tab = membersTabFor_(m.groupId);
  var cols = ensureMemberIds_(tab);
  if (String(m.location || '').trim() && cols.location < 0) cols.location = addColumn_(tab, 'LOCATION');
  if (String(m.mapLink || '').trim() && cols.mapLink < 0) cols.mapLink = addColumn_(tab, 'MAP_LINK');
  var values = tab.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][cols.id]) === String(m.id)) {
      var rowNum = r + 1;
      tab.getRange(rowNum, cols.name + 1).setValue(String(m.name).trim());
      updCell_(tab, rowNum, cols.contact, m.contact);
      updCell_(tab, rowNum, cols.residence, m.residence);
      updCell_(tab, rowNum, cols.location, m.location);
      updCell_(tab, rowNum, cols.mapLink, m.mapLink);
      updCell_(tab, rowNum, cols.gender, m.gender);
      updCell_(tab, rowNum, cols.status, m.status || 'Active');
      updCell_(tab, rowNum, cols.notes, m.notes);
      return { ok: true, id: m.id };
    }
  }
  throw new Error('Member not found: ' + m.id);
}

/**
 * Ensures the members tab has a MEMBER_ID column and every named row has an id
 * (back-filling generated ids). Returns the resolved column index map.
 */
function ensureMemberIds_(tab) {
  var cols = resolveCols_(tab);
  if (cols.name < 0) {
    throw new Error('This group members sheet needs a "NAME" column.');
  }
  // Add a MEMBER_ID column if none exists.
  if (cols.id < 0) cols.id = addColumn_(tab, 'MEMBER_ID');
  // Back-fill ids for named rows that are missing one.
  var last = tab.getLastRow();
  if (last >= 2) {
    var idRange = tab.getRange(2, cols.id + 1, last - 1, 1);
    var ids = idRange.getValues();
    var names = tab.getRange(2, cols.name + 1, last - 1, 1).getValues();
    var changed = false;
    for (var i = 0; i < ids.length; i++) {
      if (String(names[i][0] || '').trim() !== '' && String(ids[i][0] || '').trim() === '') {
        ids[i][0] = 'MEM-' + Utilities.getUuid().substring(0, 8);
        changed = true;
      }
    }
    if (changed) idRange.setValues(ids);
  }
  return cols;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resolveCols_(tab) {
  var lastCol = tab.getLastColumn() || 1;
  var headers = tab.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || '').trim().toUpperCase();
  });
  var cols = {};
  Object.keys(FIELD_ALIASES).forEach(function (field) {
    cols[field] = -1;
    var aliases = FIELD_ALIASES[field];
    for (var c = 0; c < headers.length; c++) {
      if (aliases.indexOf(headers[c]) !== -1) { cols[field] = c; break; }
    }
  });
  return cols;
}

/** Appends a header column and returns its 0-based index. */
function addColumn_(tab, headerName) {
  var newCol = tab.getLastColumn() + 1;
  tab.getRange(1, newCol).setValue(headerName);
  return newCol - 1;
}

function highestIndex_(cols) {
  return Object.keys(cols).reduce(function (mx, k) { return Math.max(mx, cols[k]); }, 0);
}
function setIf_(arr, idx, val) { if (idx >= 0) arr[idx] = val || ''; }
function updCell_(tab, rowNum, idx, val) { if (idx >= 0) tab.getRange(rowNum, idx + 1).setValue(val || ''); }

function readTab_(tab) {
  if (tab.getLastRow() < 2) return [];
  var values = tab.getDataRange().getValues();
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[String(headers[c]).trim()] = values[r][c];
    out.push(obj);
  }
  return out;
}

/** Accepts a full Sheets URL or a bare id and returns the spreadsheet id. */
function extractSheetId_(ref) {
  var s = String(ref).trim();
  var m = s.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  throw new Error('MEMBERS_SHEET is not a valid Google Sheet URL or id: ' + ref);
}

function sheetUrl_(ref) {
  try { return 'https://docs.google.com/spreadsheets/d/' + extractSheetId_(ref) + '/edit'; }
  catch (e) { return ''; }
}

function tz_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'Africa/Accra';
}

/** Creates the GROUPS registry tab (headers + sample rows). Members sheets are
 *  separate workbooks you create per group and reference via MEMBERS_SHEET. */
function setupGroupsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(GROUPS_TAB) || ss.insertSheet(GROUPS_TAB);
  var first = sh.getRange(1, 1, 1, GROUP_HEADERS.length).getValues()[0];
  var has = GROUP_HEADERS.every(function (hName, i) { return first[i] === hName; });
  if (!has) sh.getRange(1, 1, 1, GROUP_HEADERS.length).setValues([GROUP_HEADERS]);
  sh.getRange(1, 1, 1, GROUP_HEADERS.length).setFontWeight('bold').setBackground('#4f46e5').setFontColor('#fff');
  sh.setFrozenRows(1);
  if (sh.getLastRow() < 2) {
    sh.appendRow(['G1', 'Choir', 'Praise & worship team', 'Ama Boateng', '', 'Saturday',
      'PASTE_CHOIR_SHEET_URL_HERE', '']);
    sh.appendRow(['G2', 'Ushers', 'Welcome & seating', 'Kofi Mensah', '', 'Sunday',
      'PASTE_USHERS_SHEET_URL_HERE', '']);
  }
  return { ok: true };
}
