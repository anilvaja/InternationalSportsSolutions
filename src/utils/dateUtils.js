/**
 * Centralized Date Handling and Format Normalization Utility
 * 
 * Contract:
 * - User-facing display format: DD/MM/YYYY
 * - User-facing input format: DD/MM/YYYY (strictly parsed, rejecting impossible dates)
 * - Internal database & API storage format: YYYY-MM-DD
 * - Timezone-safe calendar calculations (avoids UTC offset day shifts)
 */

export class DateUtils {
  /**
   * Determine if a given year is a leap year (Gregorian calendar rules)
   * @param {number} year 
   * @returns {boolean}
   */
  static isLeapYear(year) {
    const y = Number(year);
    if (isNaN(y)) return false;
    return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  }

  /**
   * Get total number of days in a given month of a given year
   * @param {number} year 
   * @param {number} month (1-indexed: 1 = Jan, 12 = Dec)
   * @returns {number}
   */
  static getDaysInMonth(year, month) {
    const y = Number(year);
    const m = Number(month);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return 0;
    }
    const daysInMonths = [31, this.isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return daysInMonths[m - 1];
  }

  /**
   * Validate that year, month, and day represent an actual valid calendar date
   * @param {number} year 
   * @param {number} month (1-12)
   * @param {number} day (1-31)
   * @returns {boolean}
   */
  static isValidCalendarDate(year, month, day) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
    if (y < 1000 || y > 9999) return false;
    if (m < 1 || m > 12) return false;
    const maxDays = this.getDaysInMonth(y, m);
    return d >= 1 && d <= maxDays;
  }

  /**
   * Format year, month, day into YYYY-MM-DD
   * @param {number|string} year 
   * @param {number|string} month 
   * @param {number|string} day 
   * @returns {string}
   */
  static formatIsoDate(year, month, day) {
    const y = String(year).padStart(4, '0');
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Parses user-facing DD/MM/YYYY string.
   * Rejects impossible dates (e.g. 31/02/2026, 29/02/2026, 31/04/2026) and malformed dates.
   * @param {string} str 
   * @param {string} fieldName 
   * @returns {{ year: number, month: number, day: number, iso: string, display: string }}
   */
  static parseDisplayDate(str, fieldName = 'Date') {
    if (!str || typeof str !== 'string') {
      throw new Error(`${fieldName} must be a valid date string`);
    }
    const trimmed = str.trim();
    const match = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (!match) {
      throw new Error(`Invalid date format for ${fieldName}: "${trimmed}". Expected DD/MM/YYYY format.`);
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    if (month < 1 || month > 12) {
      throw new Error(`Invalid month ${month} in ${fieldName}. Month must be between 01 and 12.`);
    }

    const maxDays = this.getDaysInMonth(year, month);
    if (day < 1 || day > maxDays) {
      if (month === 2 && day === 29 && !this.isLeapYear(year)) {
        throw new Error(`Invalid date for ${fieldName}: 29/02/${year} is not a valid leap year date.`);
      }
      throw new Error(`Invalid day ${day} in ${fieldName}. Month ${month}/${year} only has ${maxDays} days.`);
    }

    const dayPadded = String(day).padStart(2, '0');
    const monthPadded = String(month).padStart(2, '0');
    const yearPadded = String(year).padStart(4, '0');

    return {
      year,
      month,
      day,
      iso: `${yearPadded}-${monthPadded}-${dayPadded}`,
      display: `${dayPadded}/${monthPadded}/${yearPadded}`
    };
  }

  /**
   * Parses internal ISO YYYY-MM-DD string.
   * Validates calendar correctness.
   * @param {string} str 
   * @param {string} fieldName 
   * @returns {{ year: number, month: number, day: number, iso: string, display: string }}
   */
  static parseIsoDate(str, fieldName = 'Date') {
    if (!str || typeof str !== 'string') {
      throw new Error(`${fieldName} must be a valid date string`);
    }
    const trimmed = str.trim().split('T')[0].split(' ')[0];
    const match = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (!match) {
      throw new Error(`Invalid ISO date format for ${fieldName}: "${trimmed}". Expected YYYY-MM-DD format.`);
    }

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    if (month < 1 || month > 12) {
      throw new Error(`Invalid month ${month} in ${fieldName}. Month must be between 01 and 12.`);
    }

    const maxDays = this.getDaysInMonth(year, month);
    if (day < 1 || day > maxDays) {
      if (month === 2 && day === 29 && !this.isLeapYear(year)) {
        throw new Error(`Invalid date for ${fieldName}: ${year}-02-29 is not a valid leap year date.`);
      }
      throw new Error(`Invalid day ${day} in ${fieldName}. Month ${month}/${year} only has ${maxDays} days.`);
    }

    const dayPadded = String(day).padStart(2, '0');
    const monthPadded = String(month).padStart(2, '0');
    const yearPadded = String(year).padStart(4, '0');

    return {
      year,
      month,
      day,
      iso: `${yearPadded}-${monthPadded}-${dayPadded}`,
      display: `${dayPadded}/${monthPadded}/${yearPadded}`
    };
  }

  /**
   * Accepts either DD/MM/YYYY or YYYY-MM-DD, verifies calendar validity,
   * and returns normalized YYYY-MM-DD.
   * If value is empty/null and not required, returns null.
   * 
   * @param {any} val 
   * @param {{ fieldName?: string, required?: boolean }} options 
   * @returns {string|null} ISO YYYY-MM-DD or null
   */
  static parseAndNormalizeDate(val, { fieldName = 'Date', required = false, optional } = {}) {
    const isRequired = optional !== undefined ? !optional : required;
    if (val === null || val === undefined) {
      if (isRequired) {
        throw new Error(`${fieldName} is required`);
      }
      return null;
    }

    const str = String(val).trim();
    if (!str) {
      if (isRequired) {
        throw new Error(`${fieldName} is required`);
      }
      return null;
    }

    if (!isRequired && (/^00[\/\-\.]00[\/\-\.]0000$/.test(str) || /^0000[\/\-\.]00[\/\-\.]00$/.test(str))) {
      return null;
    }

    // 1. Try DD/MM/YYYY
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(str)) {
      return this.parseDisplayDate(str, fieldName).iso;
    }

    // 2. Try YYYY-MM-DD (including ISO timestamps with trailing time)
    if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/.test(str)) {
      return this.parseIsoDate(str, fieldName).iso;
    }

    // 3. Fallback check for Date object
    if (val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    throw new Error(`Invalid date format for ${fieldName}: "${str}". Please provide date as DD/MM/YYYY.`);
  }

  /**
   * Format any date value into standard user-facing DD/MM/YYYY format.
   * Timezone-safe: Does not parse string through local Date offset.
   * 
   * @param {any} val 
   * @param {string} fallback (default: '-')
   * @returns {string} DD/MM/YYYY or fallback
   */
  static formatDisplayDate(val, fallback = '-') {
    if (val === null || val === undefined) return fallback;
    const str = String(val).trim();
    if (!str) return fallback;

    // Already DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      return str;
    }

    // Match DD/MM/YYYY without leading zeros
    const ddmmyyyy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[1].padStart(2, '0')}/${ddmmyyyy[2].padStart(2, '0')}/${ddmmyyyy[3]}`;
    }

    // Match YYYY-MM-DD (including timestamps like "2026-10-22 10:00:00" or "2026-10-22T10:00:00Z")
    const yyyymmdd = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (yyyymmdd) {
      const year = yyyymmdd[1];
      const month = yyyymmdd[2].padStart(2, '0');
      const day = yyyymmdd[3].padStart(2, '0');
      return `${day}/${month}/${year}`;
    }

    // If Date object
    if (val instanceof Date && !isNaN(val.getTime())) {
      const day = String(val.getDate()).padStart(2, '0');
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const year = val.getFullYear();
      return `${day}/${month}/${year}`;
    }

    return str || fallback;
  }

  /**
   * Compares two dates. Accepts either DD/MM/YYYY or YYYY-MM-DD.
   * @param {string} dateA 
   * @param {string} dateB 
   * @returns {number} -1 if A < B, 0 if A === B, 1 if A > B
   */
  static compareDates(dateA, dateB) {
    const isoA = this.parseAndNormalizeDate(dateA, { fieldName: 'First date', required: true });
    const isoB = this.parseAndNormalizeDate(dateB, { fieldName: 'Second date', required: true });
    if (isoA < isoB) return -1;
    if (isoA > isoB) return 1;
    return 0;
  }

  /**
   * Adds or subtracts calendar days from an ISO date string safely
   * @param {string} dateStr (YYYY-MM-DD or DD/MM/YYYY)
   * @param {number} days 
   * @returns {string} YYYY-MM-DD
   */
  static addDays(dateStr, days) {
    const iso = this.parseAndNormalizeDate(dateStr, { fieldName: 'Date', required: true });
    const [y, m, d] = iso.split('-').map(Number);
    // Use UTC date to avoid DST / timezone jump
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    dateObj.setUTCDate(dateObj.getUTCDate() + Number(days));
    const newY = dateObj.getUTCFullYear();
    const newM = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const newD = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${newY}-${newM}-${newD}`;
  }

  /**
   * Validates a date range chronologically
   * @param {string} startDate 
   * @param {string} endDate 
   * @returns {{ startIso: string, endIso: string }}
   */
  static validateDateRange(startDate, endDate) {
    const startIso = this.parseAndNormalizeDate(startDate, { fieldName: 'Start date', required: true });
    const endIso = this.parseAndNormalizeDate(endDate, { fieldName: 'End date', required: true });
    if (this.compareDates(startIso, endIso) > 0) {
      throw new Error(`End date (${this.formatDisplayDate(endIso)}) cannot be before start date (${this.formatDisplayDate(startIso)})`);
    }
    return { startIso, endIso };
  }

  /**
   * Calculates inclusive count of calendar days between startDate and endDate
   * @param {string} startDate 
   * @param {string} endDate 
   * @returns {number}
   */
  static calculateInclusiveDays(startDate, endDate) {
    const { startIso, endIso } = this.validateDateRange(startDate, endDate);
    return this.getDateRange(startIso, endIso).length;
  }

  /**
   * Generates array of consecutive ISO date strings between start and end inclusive
   * @param {string} startDate 
   * @param {string} endDate 
   * @returns {string[]}
   */
  static getDateRange(startDate, endDate) {
    const startIso = this.parseAndNormalizeDate(startDate, { fieldName: 'Start date', required: true });
    const endIso = this.parseAndNormalizeDate(endDate, { fieldName: 'End date', required: true });
    if (startIso > endIso) {
      throw new Error(`Start date (${this.formatDisplayDate(startIso)}) cannot be after End date (${this.formatDisplayDate(endIso)})`);
    }

    const result = [];
    let cur = startIso;
    while (cur <= endIso) {
      result.push(cur);
      cur = this.addDays(cur, 1);
    }
    return result;
  }

  /**
   * Helper to normalize a list of known date keys on an object (e.g. req.body) in-place
   * @param {Record<string, any>} obj 
   * @param {string[]} dateKeys 
   */
  static normalizeObjectDates(obj, dateKeys) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of dateKeys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        if (typeof obj[key] === 'string' && obj[key].trim() === '') {
          obj[key] = null;
        } else {
          obj[key] = this.parseAndNormalizeDate(obj[key], { fieldName: key });
        }
      }
    }
  }
}
