/**
 * Reports.gs
 * Analytics: per-date present/absent breakdown, yearly charts and per-member
 * service history.
 */

/**
 * API: full present/absent breakdown for a single service date.
 * Returns counts, percentages and the actual people in each group.
 */
function getDateSummary(dateKey, serviceType) {
  dateKey = toDateKey_(dateKey);
  serviceType = serviceType || null;

  var members = getMembers();
  // Only count members who are not "Visitor" toward the absent pool? Keep all
  // active members in the denominator; visitors only show when present.
  var att = readAttendance_().filter(function (a) {
    return a.date === dateKey && (!serviceType || a.serviceType === serviceType);
  });

  var presentIds = {};
  att.forEach(function (a) { presentIds[a.memberId] = true; });

  var present = [];
  var absent = [];
  members.forEach(function (m) {
    if (presentIds[m.id]) {
      present.push(personCard_(m));
    } else if (m.status !== 'Visitor') {
      absent.push(personCard_(m));
    }
  });

  // Members present who are no longer in the directory (defensive).
  var memberIdSet = {};
  members.forEach(function (m) { memberIdSet[m.id] = true; });
  att.forEach(function (a) {
    if (!memberIdSet[a.memberId]) {
      present.push({ id: a.memberId || '', name: a.name, contact: '', residence: '', status: 'Visitor' });
    }
  });

  var total = present.length + absent.length;
  var pct = function (n) { return total ? Math.round((n / total) * 1000) / 10 : 0; };

  return {
    date: dateKey,
    serviceType: serviceType,
    totalConsidered: total,
    presentCount: present.length,
    absentCount: absent.length,
    presentPct: pct(present.length),
    absentPct: pct(absent.length),
    present: present.sort(byName_),
    absent: absent.sort(byName_)
  };
}

function personCard_(m) {
  return { id: m.id, name: m.name, contact: m.contact, residence: m.residence, status: m.status };
}

function byName_(a, b) { return String(a.name).localeCompare(String(b.name)); }

/** API: list of years that have any attendance, plus current year. */
function getAvailableYears() {
  var att = readAttendance_();
  var years = {};
  att.forEach(function (a) {
    if (a.date) years[a.date.substring(0, 4)] = true;
  });
  years[String(new Date().getFullYear())] = true;
  return Object.keys(years).sort().reverse();
}

/**
 * API: data for the yearly bar graph of present counts.
 * If `month` (1-12) is provided, returns one bar per service day in the month.
 * Otherwise returns one bar per month (Jan..Dec) for the year.
 */
function getYearlyChart(year, month, serviceType) {
  year = String(year || new Date().getFullYear());
  serviceType = serviceType || null;
  var att = readAttendance_().filter(function (a) {
    return a.date && a.date.substring(0, 4) === year &&
      (!serviceType || a.serviceType === serviceType);
  });

  if (month) {
    var mm = pad2_(month);
    var byDay = {};
    att.forEach(function (a) {
      if (a.date.substring(5, 7) !== mm) return;
      byDay[a.date] = (byDay[a.date] || 0) + 1;
    });
    var rows = Object.keys(byDay).sort().map(function (d) {
      return { label: d, count: byDay[d] };
    });
    return { mode: 'day', year: year, month: Number(month), rows: rows };
  }

  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var counts = [0,0,0,0,0,0,0,0,0,0,0,0];
  att.forEach(function (a) {
    var mi = Number(a.date.substring(5, 7)) - 1;
    counts[mi]++;
  });
  var rows2 = counts.map(function (c, i) { return { label: monthNames[i], count: c }; });
  return { mode: 'month', year: year, rows: rows2 };
}

/**
 * API: services a person has attended, with optional year/month/day filters.
 * `day` should be a full 'yyyy-MM-dd' when used.
 */
function getMemberHistory(memberId, year, month, day) {
  var members = getMembers();
  var m = members.filter(function (x) { return x.id === memberId; })[0];
  var att = readAttendance_().filter(function (a) { return a.memberId === memberId; });

  if (day) {
    var dk = toDateKey_(day);
    att = att.filter(function (a) { return a.date === dk; });
  } else {
    if (year) att = att.filter(function (a) { return a.date.substring(0, 4) === String(year); });
    if (month) att = att.filter(function (a) { return a.date.substring(5, 7) === pad2_(month); });
  }

  att.sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });

  return {
    member: m ? personCard_(m) : { id: memberId, name: '(unknown)', contact: '', residence: '' },
    totalAllTime: readAttendance_().filter(function (a) { return a.memberId === memberId; }).length,
    matched: att.length,
    services: att.map(function (a) {
      return { attId: a.attId, date: a.date, serviceType: a.serviceType };
    })
  };
}

/** API: headline numbers for the dashboard. */
function getDashboardStats() {
  var members = getMembers();
  var att = readAttendance_();
  var services = getServiceDates();

  var active = members.filter(function (m) { return m.status === 'Active'; }).length;
  var lastService = services.length ? services[0] : null;

  // Average attendance over the last up-to-8 services.
  var recent = services.slice(0, 8);
  var avg = recent.length
    ? Math.round(recent.reduce(function (s, x) { return s + x.count; }, 0) / recent.length)
    : 0;

  return {
    totalMembers: members.length,
    activeMembers: active,
    totalServices: services.length,
    totalRecords: att.length,
    avgRecentAttendance: avg,
    lastService: lastService,
    today: Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd')
  };
}

/** API: everything the UI needs on first load, in one round-trip. */
function getBootstrap() {
  return {
    config: {
      statuses: CONFIG.STATUSES,
      genders: CONFIG.GENDERS,
      serviceTypes: CONFIG.SERVICE_TYPES
    },
    stats: getDashboardStats(),
    members: getMembers(),
    years: getAvailableYears(),
    serviceDates: getServiceDates()
  };
}
