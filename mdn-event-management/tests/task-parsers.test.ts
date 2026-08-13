import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseDeadline,
  parseMemberIds,
  parseTaskId,
} from '../lib/tasks.ts';

describe('parseTaskId', () => {
  it('accepts positive integers', () => {
    assert.equal(parseTaskId('1'), 1);
    assert.equal(parseTaskId('42'), 42);
  });

  it('rejects zero, negatives, and non-integers', () => {
    assert.equal(parseTaskId('0'), null);
    assert.equal(parseTaskId('-3'), null);
    assert.equal(parseTaskId('1.5'), null);
    assert.equal(parseTaskId('abc'), null);
    assert.equal(parseTaskId(''), null);
  });
});

describe('parseDeadline', () => {
  it('accepts valid ISO date strings', () => {
    const deadline = parseDeadline('2026-09-15T17:00:00.000Z');
    assert.ok(deadline instanceof Date);
    assert.equal(deadline?.toISOString(), '2026-09-15T17:00:00.000Z');
  });

  it('rejects empty, blank, invalid, and non-string values', () => {
    assert.equal(parseDeadline(''), null);
    assert.equal(parseDeadline('   '), null);
    assert.equal(parseDeadline('not-a-date'), null);
    assert.equal(parseDeadline(123), null);
    assert.equal(parseDeadline(null), null);
    assert.equal(parseDeadline(undefined), null);
  });
});

describe('parseMemberIds', () => {
  it('returns [] when undefined', () => {
    assert.deepEqual(parseMemberIds(undefined), []);
  });

  it('accepts positive integer arrays and dedupes', () => {
    assert.deepEqual(parseMemberIds([1, 2, 2, 3]), [1, 2, 3]);
    assert.deepEqual(parseMemberIds(['4', '5']), [4, 5]);
  });

  it('rejects non-arrays and invalid ids', () => {
    assert.equal(parseMemberIds('1'), null);
    assert.equal(parseMemberIds([0]), null);
    assert.equal(parseMemberIds([-1]), null);
    assert.equal(parseMemberIds([1.2]), null);
    assert.equal(parseMemberIds([1, 'x']), null);
  });
});
