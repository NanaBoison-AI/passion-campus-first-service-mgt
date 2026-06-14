/**
 * Setup.gs
 * Menu, dialogs and one-time initialisation of the spreadsheet structure.
 */

/** Adds the custom menu when the spreadsheet opens. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📋 Members CMS')
    .addItem('Open Dashboard', 'openDashboard')
    .addSeparator()
    .addItem('Setup / Repair Sheets', 'setupSheets')
    .addToUi();
}

/** Opens the full app inside a large modal dialog over the sheet. */
function openDashboard() {
  setupSheets(); // make sure structure exists
  var html = HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setWidth(1200)
    .setHeight(800)
    .setTitle('Members CMS');
  applyFavicon_(html);
  SpreadsheetApp.getUi().showModalDialog(html, 'Members CMS');
}

/** Web-app entry point (Deploy > New deployment > Web app). */
function doGet() {
  setupSheets();
  var out = HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Members CMS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return applyFavicon_(out);
}

/**
 * Applies the branded favicon. setFaviconUrl() needs a public image URL and
 * throws on an unsupported/unreachable one, so guard it — a favicon must never
 * be able to break the app.
 */
function applyFavicon_(out) {
  try {
    if (typeof FAVICON_URL === 'string' && /^https?:\/\//.test(FAVICON_URL)) {
      out.setFaviconUrl(FAVICON_URL);
    }
  } catch (e) {
    // Ignore: fall back to the default favicon / the <head> <link> tag.
  }
  return out;
}

/** Lets HTML files include other HTML/CSS/JS partials. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Creates the required sheets (if missing) and ensures headers/formatting.
 * Safe to run repeatedly — it never deletes data.
 */
function setupSheets() {
  var ss = ss_();

  // Remember the spreadsheet id so the standalone web app can find it.
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  // Keep the spreadsheet timezone aligned with the app timezone (manifest)
  // so auto timestamps (RECORDED_AT) and date formatting agree. Without this
  // a sheet left on the US default shows "yesterday" for early-UTC saves.
  try {
    if (ss.getSpreadsheetTimeZone() !== CONFIG.TIMEZONE) {
      ss.setSpreadsheetTimeZone(CONFIG.TIMEZONE);
    }
  } catch (e) { /* non-fatal */ }

  ensureSheet_(ss, CONFIG.SHEETS.MEMBERS, CONFIG.MEMBER_HEADERS);
  ensureSheet_(ss, CONFIG.SHEETS.ATTENDANCE, CONFIG.ATTENDANCE_HEADERS);
  ensureSheet_(ss, CONFIG.SHEETS.SERVICES, CONFIG.SERVICE_HEADERS);
  ensureSheet_(ss, CONFIG.SHEETS.SETTINGS, ['KEY', 'VALUE']);

  // Upgrade legacy MEMBERS/ATTENDANCE that only had the sample columns.
  migrateLegacyMembers_(ss);
  migrateLegacyAttendance_(ss);

  return { ok: true };
}

/** Ensures a sheet exists with the given header row (row 1, frozen + bold). */
function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  // Only (re)write the header when row 1 doesn't already start with our header
  // and isn't a legacy header we still want to migrate.
  var existing = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), headers.length)).getValues()[0];
  var hasOurHeader = headers.every(function (h, i) { return existing[i] === h; });
  if (!hasOurHeader && !looksLikeLegacy_(existing)) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sh.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff');
  sh.setFrozenRows(1);
  return sh;
}

function looksLikeLegacy_(rowValues) {
  var joined = rowValues.map(function (v) { return String(v).toUpperCase().trim(); }).join('|');
  return joined.indexOf('NAME') !== -1; // legacy sheets start with NAME
}

/**
 * Legacy MEMBERS sheet from the sample had: NAME | CONTACT | RESIDENCE.
 * This rebuilds it to the new schema, preserving the rows.
 */
function migrateLegacyMembers_(ss) {
  var sh = ss.getSheetByName(CONFIG.SHEETS.MEMBERS);
  var header = sh.getRange(1, 1, 1, sh.getLastColumn() || 1).getValues()[0];
  if (header[0] === 'MEMBER_ID') return; // already new schema

  var values = sh.getDataRange().getValues();
  var rows = values.slice(1).filter(function (r) {
    return String(r[0]).trim() !== ''; // NAME present
  });

  sh.clear();
  sh.getRange(1, 1, 1, CONFIG.MEMBER_HEADERS.length).setValues([CONFIG.MEMBER_HEADERS]);

  var today = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
  var out = rows.map(function (r) {
    return [newId_('MEM'), r[0], r[1] || '', r[2] || '', '', today, 'Active', ''];
  });
  if (out.length) {
    sh.getRange(2, 1, out.length, CONFIG.MEMBER_HEADERS.length).setValues(out);
  }
  formatHeader_(sh, CONFIG.MEMBER_HEADERS.length);
}

/**
 * Legacy ATTENDANCE sheet had: NAME | SERVICE DATE.
 * Rebuilds to the new schema, mapping NAME -> MEMBER_ID where possible.
 */
function migrateLegacyAttendance_(ss) {
  var sh = ss.getSheetByName(CONFIG.SHEETS.ATTENDANCE);
  var header = sh.getRange(1, 1, 1, sh.getLastColumn() || 1).getValues()[0];
  if (header[0] === 'ATT_ID') return; // already new schema

  var values = sh.getDataRange().getValues();
  var rows = values.slice(1).filter(function (r) {
    return String(r[0]).trim() !== '';
  });

  var nameToId = buildNameToIdMap_();

  sh.clear();
  sh.getRange(1, 1, 1, CONFIG.ATTENDANCE_HEADERS.length).setValues([CONFIG.ATTENDANCE_HEADERS]);

  var out = rows.map(function (r) {
    var name = String(r[0]).trim();
    return [
      newId_('ATT'),
      nameToId[name.toUpperCase()] || '',
      name,
      toDateKey_(r[1]),
      'Sunday Service',
      new Date()
    ];
  });
  if (out.length) {
    sh.getRange(2, 1, out.length, CONFIG.ATTENDANCE_HEADERS.length).setValues(out);
  }
  formatHeader_(sh, CONFIG.ATTENDANCE_HEADERS.length);
}

function buildNameToIdMap_() {
  var members = readMembers_();
  var map = {};
  members.forEach(function (m) { map[String(m.name).toUpperCase().trim()] = m.id; });
  return map;
}

function formatHeader_(sh, cols) {
  sh.getRange(1, 1, 1, cols)
    .setFontWeight('bold').setBackground('#1a73e8').setFontColor('#ffffff');
  sh.setFrozenRows(1);
}

/** Optional: load the sample data from the original file for a fresh demo. */
function loadSampleData() {
  var ss = ss_();
  setupSheets();
  var sample = [
    ['TESSA NAADEI DJANIE', '0592767181', 'ASHONGMAN ESTATE'],
    ['PATRICK OWUSU AGYEMAN', '0247460128', 'TB1A ATOMIC'],
    ['AKUA AFRIYIE MENSAH', '0244944740/0264944740', 'ASHONMAN ESTATE'],
    ['DOTSEY JANET', '0557481630', 'CLOSE TO WONDER CHAPEL']
  ];
  sample.forEach(function (r) {
    addMember({ name: r[0], contact: r[1], residence: r[2], gender: '', status: 'Active', notes: '' });
  });
  return { ok: true, added: sample.length };
}
