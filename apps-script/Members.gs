/**
 * Members.gs
 * Server-side API for member records (add + update only, no delete).
 */

/** Low-level: read all member rows into objects. */
function readMembers_() {
  var sh = ss_().getSheetByName(CONFIG.SHEETS.MEMBERS);
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idx = headerIndex_(headers);
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (String(row[idx.MEMBER_ID]).trim() === '' && String(row[idx.NAME]).trim() === '') continue;
    out.push({
      rowNumber: r + 1,
      id: row[idx.MEMBER_ID],
      name: row[idx.NAME],
      contact: row[idx.CONTACT],
      residence: row[idx.RESIDENCE],
      gender: row[idx.GENDER],
      dateJoined: toDateKey_(row[idx.DATE_JOINED]),
      status: row[idx.STATUS] || 'Active',
      notes: row[idx.NOTES] || ''
    });
  }
  return out;
}

function headerIndex_(headers) {
  var idx = {};
  headers.forEach(function (h, i) { idx[String(h).trim()] = i; });
  return idx;
}

/** API: get all members (sorted by name). */
function getMembers() {
  return readMembers_().sort(function (a, b) {
    return String(a.name).localeCompare(String(b.name));
  });
}

/** API: add a new member. Returns the created member. */
function addMember(data) {
  if (!data || !String(data.name).trim()) {
    throw new Error('Member name is required.');
  }
  var sh = ss_().getSheetByName(CONFIG.SHEETS.MEMBERS);
  var id = newId_('MEM');
  var today = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
  var row = [
    id,
    String(data.name).trim(),
    data.contact || '',
    data.residence || '',
    data.gender || '',
    data.dateJoined || today,
    data.status || 'Active',
    data.notes || ''
  ];
  sh.appendRow(row);
  return { ok: true, id: id };
}

/** API: update an existing member by id. NAME change also updates attendance. */
function updateMember(data) {
  if (!data || !data.id) throw new Error('Member id is required.');
  if (!String(data.name).trim()) throw new Error('Member name is required.');

  var sh = ss_().getSheetByName(CONFIG.SHEETS.MEMBERS);
  var values = sh.getDataRange().getValues();
  var idx = headerIndex_(values[0]);

  for (var r = 1; r < values.length; r++) {
    if (values[r][idx.MEMBER_ID] === data.id) {
      var oldName = values[r][idx.NAME];
      var newName = String(data.name).trim();
      sh.getRange(r + 1, idx.NAME + 1).setValue(newName);
      sh.getRange(r + 1, idx.CONTACT + 1).setValue(data.contact || '');
      sh.getRange(r + 1, idx.RESIDENCE + 1).setValue(data.residence || '');
      sh.getRange(r + 1, idx.GENDER + 1).setValue(data.gender || '');
      if (data.dateJoined) sh.getRange(r + 1, idx.DATE_JOINED + 1).setValue(data.dateJoined);
      sh.getRange(r + 1, idx.STATUS + 1).setValue(data.status || 'Active');
      sh.getRange(r + 1, idx.NOTES + 1).setValue(data.notes || '');

      if (oldName !== newName) syncAttendanceName_(data.id, newName);
      return { ok: true, id: data.id };
    }
  }
  throw new Error('Member not found: ' + data.id);
}

/** Keeps the denormalised NAME in ATTENDANCE in sync after a rename. */
function syncAttendanceName_(memberId, newName) {
  var sh = ss_().getSheetByName(CONFIG.SHEETS.ATTENDANCE);
  if (!sh || sh.getLastRow() < 2) return;
  var values = sh.getDataRange().getValues();
  var idx = headerIndex_(values[0]);
  for (var r = 1; r < values.length; r++) {
    if (values[r][idx.MEMBER_ID] === memberId) {
      sh.getRange(r + 1, idx.NAME + 1).setValue(newName);
    }
  }
}
