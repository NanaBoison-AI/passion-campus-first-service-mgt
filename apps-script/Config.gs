/**
 * Config.gs
 * Central configuration and small shared helpers for the Members CMS.
 *
 * The whole app is built on top of a single Google Sheet that contains the
 * two main tabs from the sample file (MEMBERS and ATTENDANCE) plus a couple of
 * helper tabs that the app maintains automatically.
 */

var CONFIG = {
  // ---- Sheet (tab) names -------------------------------------------------
  SHEETS: {
    MEMBERS: 'MEMBERS',
    ATTENDANCE: 'ATTENDANCE',
    SERVICES: 'SERVICES',   // catalogue of service dates + meta (auto-managed)
    SETTINGS: 'SETTINGS'    // misc app settings (key/value)
  },

  // ---- Column headers (order matters for new sheets) ---------------------
  MEMBER_HEADERS: ['MEMBER_ID', 'NAME', 'CONTACT', 'RESIDENCE', 'GENDER', 'DATE_JOINED', 'STATUS', 'NOTES'],

  // Attendance keeps NAME + SERVICE DATE (as in the sample) and adds an id /
  // service type / timestamp so records are robust and easy to manage.
  ATTENDANCE_HEADERS: ['ATT_ID', 'MEMBER_ID', 'NAME', 'SERVICE_DATE', 'SERVICE_TYPE', 'RECORDED_AT'],

  SERVICE_HEADERS: ['SERVICE_DATE', 'SERVICE_TYPE', 'TITLE', 'NOTES'],

  // ---- Domain values -----------------------------------------------------
  STATUSES: ['Active', 'Inactive', 'Visitor'],
  GENDERS: ['Male', 'Female', 'Other'],
  SERVICE_TYPES: ['Sunday Service', 'Midweek Service', 'Prayer Meeting', 'Special Service', 'Other'],

  TIMEZONE: 'Africa/Accra'
};

/** Returns the active spreadsheet timezone (falls back to CONFIG.TIMEZONE). */
function tz_() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || CONFIG.TIMEZONE;
  } catch (e) {
    return CONFIG.TIMEZONE;
  }
}

/** Normalises any date-ish value to a 'yyyy-MM-dd' string (sheet timezone). */
function toDateKey_(value) {
  if (value === null || value === undefined || value === '') return '';
  var d = (value instanceof Date) ? value : new Date(value);
  if (isNaN(d.getTime())) {
    // Maybe it is already a yyyy-MM-dd-ish string.
    var s = String(value).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);
    }
    return s;
  }
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
}

function pad2_(n) {
  n = String(n);
  return n.length < 2 ? '0' + n : n;
}

/** Returns a Date at local midnight for a 'yyyy-MM-dd' key. */
function dateKeyToDate_(key) {
  var parts = String(key).split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

/** Short unique-ish id. */
function newId_(prefix) {
  return (prefix || 'ID') + '-' + Utilities.getUuid().substring(0, 8);
}

/** Get the active spreadsheet (works for bound script + web app). */
function ss_() {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  if (s) return s;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('No active spreadsheet. Bind this script to a Sheet or set the SPREADSHEET_ID script property.');
}
