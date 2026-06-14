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

  // Real Date objects (e.g. read from a sheet cell) are formatted in the
  // sheet timezone.
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? '' : Utilities.formatDate(value, tz_(), 'yyyy-MM-dd');
  }

  // A string that already starts with yyyy-MM-dd (the HTML <input type=date>
  // value, or a date/datetime string) is a plain calendar date — return it
  // as-is. DO NOT run it through `new Date(...)`, which parses 'yyyy-MM-dd' as
  // UTC midnight and then shifts the day when reformatted in a non-UTC zone.
  var s = String(value).trim();
  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return iso[1] + '-' + pad2_(iso[2]) + '-' + pad2_(iso[3]);
  }

  // Fallback for other textual formats (e.g. "6/14/2026").
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
  }
  return s;
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
