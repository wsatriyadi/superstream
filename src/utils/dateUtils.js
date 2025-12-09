/**
 * Date utility functions for stream scheduling and daily log management
 */

/**
 * Normalize a date to midnight UTC (removes time component)
 * @param {Date} date - The date to normalize
 * @returns {Date} - Date set to midnight UTC
 */
function normalizeToMidnightUTC(date) {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Get today's date at midnight UTC
 * @returns {Date} - Today's date at midnight UTC
 */
function getTodayUTC() {
  return normalizeToMidnightUTC(new Date());
}

/**
 * Check if two dates are the same day (ignoring time)
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} - True if dates are the same day
 */
function isSameDay(date1, date2) {
  const normalized1 = normalizeToMidnightUTC(date1);
  const normalized2 = normalizeToMidnightUTC(date2);
  return normalized1.getTime() === normalized2.getTime();
}

/**
 * Check if a date is today
 * @param {Date} date - The date to check
 * @returns {boolean} - True if date is today
 */
function isToday(date) {
  return isSameDay(date, new Date());
}

/**
 * Check if date1 is before date2 (day comparison only)
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} - True if date1 is before date2
 */
function isBeforeDay(date1, date2) {
  const normalized1 = normalizeToMidnightUTC(date1);
  const normalized2 = normalizeToMidnightUTC(date2);
  return normalized1.getTime() < normalized2.getTime();
}

/**
 * Check if date1 is after date2 (day comparison only)
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} - True if date1 is after date2
 */
function isAfterDay(date1, date2) {
  const normalized1 = normalizeToMidnightUTC(date1);
  const normalized2 = normalizeToMidnightUTC(date2);
  return normalized1.getTime() > normalized2.getTime();
}

/**
 * Get the difference in days between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} - Number of days difference
 */
function getDaysDifference(date1, date2) {
  const normalized1 = normalizeToMidnightUTC(date1);
  const normalized2 = normalizeToMidnightUTC(date2);
  const diffTime = Math.abs(normalized2.getTime() - normalized1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = {
  normalizeToMidnightUTC,
  getTodayUTC,
  isSameDay,
  isToday,
  isBeforeDay,
  isAfterDay,
  getDaysDifference,
};
