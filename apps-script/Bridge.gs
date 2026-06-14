/**
 * Bridge.gs
 * Single generic entry point the front-end calls via google.script.run.
 * Routing through one whitelisted dispatcher keeps the client code tidy and
 * makes the exposed surface explicit.
 */

var API_WHITELIST = {
  getBootstrap: getBootstrap,
  getDashboardStats: getDashboardStats,

  // members
  getMembers: getMembers,
  addMember: addMember,
  updateMember: updateMember,

  // attendance
  getServiceDates: getServiceDates,
  getRosterForDate: getRosterForDate,
  saveAttendanceForDate: saveAttendanceForDate,
  addAttendance: addAttendance,
  deleteAttendance: deleteAttendance,
  deleteServiceAttendance: deleteServiceAttendance,

  // reports
  getDateSummary: getDateSummary,
  getAvailableYears: getAvailableYears,
  getYearlyChart: getYearlyChart,
  getMemberHistory: getMemberHistory,

  // setup
  loadSampleData: loadSampleData,
  setupSheets: setupSheets
};

/**
 * Dispatch a named API call with an argument array.
 * @param {string} fnName  one of API_WHITELIST keys
 * @param {Array}  args    positional arguments
 */
function __dispatch(fnName, args) {
  var fn = API_WHITELIST[fnName];
  if (typeof fn !== 'function') {
    throw new Error('Unknown API method: ' + fnName);
  }
  return fn.apply(null, args || []);
}
