import test from 'node:test';
import assert from 'node:assert/strict';
import { DateUtils } from '../../src/utils/dateUtils.js';

test('DateUtils - parseAndNormalizeDate contract', async (t) => {
  await t.test('05/11/2026 => 2026-11-05 (5 November 2026)', () => {
    assert.equal(DateUtils.parseAndNormalizeDate('05/11/2026'), '2026-11-05');
  });

  await t.test('11/05/2026 => 2026-05-11 (11 May 2026)', () => {
    assert.equal(DateUtils.parseAndNormalizeDate('11/05/2026'), '2026-05-11');
  });

  await t.test('23/10/2026 => 2026-10-23 (23 October 2026)', () => {
    assert.equal(DateUtils.parseAndNormalizeDate('23/10/2026'), '2026-10-23');
  });

  await t.test('01/02/2026 => 2026-02-01 (1 February 2026)', () => {
    assert.equal(DateUtils.parseAndNormalizeDate('01/02/2026'), '2026-02-01');
  });

  await t.test('29/02/2024 accepted (Leap Year)', () => {
    assert.equal(DateUtils.parseAndNormalizeDate('29/02/2024'), '2024-02-29');
  });

  await t.test('29/02/2026 rejected (Non-Leap Year)', () => {
    assert.throws(() => {
      DateUtils.parseAndNormalizeDate('29/02/2026');
    }, /not a valid leap year date|only has 28 days/i);
  });

  await t.test('31/04/2026 rejected (April has 30 days)', () => {
    assert.throws(() => {
      DateUtils.parseAndNormalizeDate('31/04/2026');
    }, /only has 30 days/i);
  });

  await t.test('31/02/2026 rejected (February has max 28 days)', () => {
    assert.throws(() => {
      DateUtils.parseAndNormalizeDate('31/02/2026');
    }, /only has 28 days/i);
  });

  await t.test('Empty optional date handled correctly (returns null)', () => {
    assert.equal(DateUtils.parseAndNormalizeDate(''), null);
    assert.equal(DateUtils.parseAndNormalizeDate(null), null);
    assert.equal(DateUtils.parseAndNormalizeDate(undefined), null);
    assert.equal(DateUtils.parseAndNormalizeDate('   '), null);
  });

  await t.test('Required empty date throws validation error', () => {
    assert.throws(() => {
      DateUtils.parseAndNormalizeDate('', { fieldName: 'Joining Date', required: true });
    }, /Joining Date is required/i);
  });

  await t.test('Invalid manually entered date rejected with clear error', () => {
    assert.throws(() => {
      DateUtils.parseAndNormalizeDate('not-a-date');
    }, /Invalid date format/i);
    assert.throws(() => {
      DateUtils.parseAndNormalizeDate('12/34/2026');
    }, /Invalid month/i);
  });

  await t.test('Accepts existing normalized ISO YYYY-MM-DD gracefully', () => {
    assert.equal(DateUtils.parseAndNormalizeDate('2026-11-05'), '2026-11-05');
    assert.equal(DateUtils.parseAndNormalizeDate('2024-02-29'), '2024-02-29');
    assert.throws(() => {
      DateUtils.parseAndNormalizeDate('2026-02-29');
    }, /not a valid leap year date|only has 28 days/i);
  });

  await t.test('formatDisplayDate formats accurately to DD/MM/YYYY', () => {
    assert.equal(DateUtils.formatDisplayDate('2026-11-05'), '05/11/2026');
    assert.equal(DateUtils.formatDisplayDate('2026-05-11'), '11/05/2026');
    assert.equal(DateUtils.formatDisplayDate('2026-10-23 14:30:00'), '23/10/2026');
    assert.equal(DateUtils.formatDisplayDate('2026-10-23T21:25:06.863Z'), '23/10/2026');
    assert.equal(DateUtils.formatDisplayDate(null), '-');
    assert.equal(DateUtils.formatDisplayDate(''), '-');
    assert.equal(DateUtils.formatDisplayDate('', 'N/A'), 'N/A');
  });

  await t.test('compareDates orders calendar dates correctly without timezone bias', () => {
    assert.equal(DateUtils.compareDates('05/11/2026', '06/11/2026'), -1);
    assert.equal(DateUtils.compareDates('05/11/2026', '2026-11-05'), 0);
    assert.equal(DateUtils.compareDates('05/11/2026', '04/11/2026'), 1);
  });

  await t.test('getDateRange generates inclusive day sequence', () => {
    const range = DateUtils.getDateRange('28/02/2024', '02/03/2024');
    assert.deepEqual(range, ['2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02']);
  });
});
