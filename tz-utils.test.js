const test = require('node:test');
const assert = require('node:assert/strict');
const { zoneParts, zoneShortLabel, zonedTimeToUtc } = require('./tz-utils.js');

test('zoneParts reads wall-clock fields in a zone for a known UTC instant (EST, winter)', () => {
    const instant = new Date(Date.UTC(2026, 0, 15, 12, 0, 0)); // 2026-01-15 12:00 UTC
    const p = zoneParts('America/New_York', instant);
    assert.equal(p.year, 2026);
    assert.equal(p.month, 1);
    assert.equal(p.day, 15);
    assert.equal(p.hour, 7); // EST = UTC-5
    assert.equal(p.minute, 0);
});

test('zonedTimeToUtc converts EST wall-clock time back to the correct UTC instant', () => {
    const utc = zonedTimeToUtc('America/New_York', 2026, 1, 15, 9, 0); // 09:00 EST
    assert.equal(utc.getTime(), Date.UTC(2026, 0, 15, 14, 0, 0));
});

test('zonedTimeToUtc uses the summer (EDT) offset on a DST date', () => {
    const utc = zonedTimeToUtc('America/New_York', 2026, 7, 15, 9, 0); // 09:00 EDT
    assert.equal(utc.getTime(), Date.UTC(2026, 6, 15, 13, 0, 0));
});

test('zonedTimeToUtc is a no-op offset for UTC itself', () => {
    const utc = zonedTimeToUtc('UTC', 2026, 3, 1, 6, 30);
    assert.equal(utc.getTime(), Date.UTC(2026, 2, 1, 6, 30, 0));
});

test('zoneParts/zonedTimeToUtc round-trip for several zones and times', () => {
    const cases = [
        ['Asia/Kolkata', 2026, 8, 15, 23, 45],
        ['America/Los_Angeles', 2026, 12, 31, 0, 5],
        ['Europe/London', 2026, 6, 1, 12, 0],
    ];
    for (const [tz, y, mo, d, h, mi] of cases) {
        const utc = zonedTimeToUtc(tz, y, mo, d, h, mi);
        const p = zoneParts(tz, utc);
        assert.deepEqual(
            [p.year, p.month, p.day, p.hour, p.minute],
            [y, mo, d, h, mi],
            `round-trip failed for ${tz} ${y}-${mo}-${d} ${h}:${mi}`
        );
    }
});

test('zoneShortLabel returns the expected abbreviation for winter and summer', () => {
    const winter = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
    const summer = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
    assert.equal(zoneShortLabel('America/New_York', winter), 'EST');
    assert.equal(zoneShortLabel('America/New_York', summer), 'EDT');
    assert.equal(zoneShortLabel('UTC', winter), 'UTC');
});
