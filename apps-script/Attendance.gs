/**
 * Attendance.gs
 * Server-side API for attendance records (add / update / delete) and the
 * user-friendly "mark a whole service at once" workflow.
 */

/** Low-level: read all attendance rows into objects. */
function readAttendance_() {
  var sh = ss_().getSheetByName(CONFIG.SHEETS.ATTENDANCE);
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getDataRange().getValues();
  var idx = headerIndex_(values[0]);
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (String(row[idx.NAME]).trim() === '' && String(row[idx.MEMBER_ID]).trim() === '') continue;
    out.push({
      rowNumber: r + 1,
      attId: row[idx.ATT_ID],
      memberId: row[idx.MEMBER_ID],
      name: row[idx.NAME],
      date: toDateKey_(row[idx.SERVICE_DATE]),
      serviceType: row[idx.SERVICE_TYPE] || 'Sunday Service'
    });
  }
  return out;
}

/** API: distinct service dates (most recent first) with present counts. */
function getServiceDates() {
  var att = readAttendance_();
  var byDate = {};
  att.forEach(function (a) {
    if (!a.date) return;
    if (!byDate[a.date]) byDate[a.date] = { date: a.date, count: 0, types: {} };
    byDate[a.date].count++;
    byDate[a.date].types[a.serviceType] = (byDate[a.date].types[a.serviceType] || 0) + 1;
  });
  return Object.keys(byDate)
    .map(function (k) { return byDate[k]; })
    .sort(function (a, b) { return b.date < a.date ? -1 : (b.date > a.date ? 1 : 0); });
}

/**
 * API: get the roster for a date — every member with a present/absent flag.
 * This powers the friendly "checklist" recording UI.
 */
function getRosterForDate(dateKey, serviceType) {
  dateKey = toDateKey_(dateKey);
  serviceType = serviceType || null;
  var members = getMembers();
  var att = readAttendance_().filter(function (a) {
    return a.date === dateKey && (!serviceType || a.serviceType === serviceType);
  });
  var presentByMember = {};
  att.forEach(function (a) { presentByMember[a.memberId] = a.attId; });

  var roster = members.map(function (m) {
    return {
      id: m.id,
      name: m.name,
      contact: m.contact,
      residence: m.residence,
      status: m.status,
      present: !!presentByMember[m.id]
    };
  });
  return { date: dateKey, serviceType: serviceType, roster: roster };
}

/**
 * API: save attendance for a service in one shot.
 * `presentIds` is the list of member ids that were present. Anyone marked
 * present who isn't recorded yet gets added; anyone recorded who is no longer
 * in the list gets removed. Idempotent.
 */
function saveAttendanceForDate(dateKey, serviceType, presentIds) {
  dateKey = toDateKey_(dateKey);
  if (!dateKey) throw new Error('A valid service date is required.');
  serviceType = serviceType || 'Sunday Service';
  presentIds = presentIds || [];

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = ss_().getSheetByName(CONFIG.SHEETS.ATTENDANCE);
    var existing = readAttendance_().filter(function (a) {
      return a.date === dateKey && a.serviceType === serviceType;
    });
    var existingByMember = {};
    existing.forEach(function (a) { existingByMember[a.memberId] = a; });

    var presentSet = {};
    presentIds.forEach(function (id) { presentSet[id] = true; });

    var members = getMembers();
    var memberById = {};
    members.forEach(function (m) { memberById[m.id] = m; });

    // Rows to delete (were present, now absent) — collect row numbers desc.
    var deleteRows = [];
    existing.forEach(function (a) {
      if (!presentSet[a.memberId]) deleteRows.push(a.rowNumber);
    });
    deleteRows.sort(function (a, b) { return b - a; });
    deleteRows.forEach(function (rn) { sh.deleteRow(rn); });

    // Rows to add (now present, weren't before).
    var toAdd = [];
    presentIds.forEach(function (id) {
      if (!existingByMember[id] && memberById[id]) {
        toAdd.push([
          newId_('ATT'), id, memberById[id].name, dateKey, serviceType, new Date()
        ]);
      }
    });
    if (toAdd.length) {
      sh.getRange(sh.getLastRow() + 1, 1, toAdd.length, CONFIG.ATTENDANCE_HEADERS.length)
        .setValues(toAdd);
    }

    upsertService_(dateKey, serviceType);
    return { ok: true, present: presentIds.length, added: toAdd.length, removed: deleteRows.length };
  } finally {
    lock.releaseLock();
  }
}

/** API: add a single attendance record (present mark). */
function addAttendance(memberId, dateKey, serviceType) {
  dateKey = toDateKey_(dateKey);
  serviceType = serviceType || 'Sunday Service';
  var members = getMembers();
  var m = members.filter(function (x) { return x.id === memberId; })[0];
  if (!m) throw new Error('Member not found.');

  // Avoid duplicates for the same member/date/service.
  var dup = readAttendance_().some(function (a) {
    return a.memberId === memberId && a.date === dateKey && a.serviceType === serviceType;
  });
  if (dup) return { ok: true, duplicate: true };

  var sh = ss_().getSheetByName(CONFIG.SHEETS.ATTENDANCE);
  sh.appendRow([newId_('ATT'), memberId, m.name, dateKey, serviceType, new Date()]);
  upsertService_(dateKey, serviceType);
  return { ok: true };
}

/** API: delete a single attendance record by its ATT_ID. */
function deleteAttendance(attId) {
  var sh = ss_().getSheetByName(CONFIG.SHEETS.ATTENDANCE);
  var values = sh.getDataRange().getValues();
  var idx = headerIndex_(values[0]);
  for (var r = values.length - 1; r >= 1; r--) {
    if (values[r][idx.ATT_ID] === attId) {
      sh.deleteRow(r + 1);
      return { ok: true };
    }
  }
  throw new Error('Attendance record not found.');
}

/** API: delete every attendance record for a whole service (date+type). */
function deleteServiceAttendance(dateKey, serviceType) {
  dateKey = toDateKey_(dateKey);
  var sh = ss_().getSheetByName(CONFIG.SHEETS.ATTENDANCE);
  var values = sh.getDataRange().getValues();
  var idx = headerIndex_(values[0]);
  var removed = 0;
  for (var r = values.length - 1; r >= 1; r--) {
    var rowDate = toDateKey_(values[r][idx.SERVICE_DATE]);
    var rowType = values[r][idx.SERVICE_TYPE];
    if (rowDate === dateKey && (!serviceType || rowType === serviceType)) {
      sh.deleteRow(r + 1);
      removed++;
    }
  }
  return { ok: true, removed: removed };
}

/** Maintains the SERVICES catalogue tab (one row per date+type). */
function upsertService_(dateKey, serviceType) {
  var sh = ss_().getSheetByName(CONFIG.SHEETS.SERVICES);
  if (!sh) return;
  var values = sh.getLastRow() >= 1 ? sh.getDataRange().getValues() : [CONFIG.SERVICE_HEADERS];
  var idx = headerIndex_(values[0]);
  for (var r = 1; r < values.length; r++) {
    if (toDateKey_(values[r][idx.SERVICE_DATE]) === dateKey &&
        values[r][idx.SERVICE_TYPE] === serviceType) {
      return; // already catalogued
    }
  }
  sh.appendRow([dateKey, serviceType, '', '']);
}
