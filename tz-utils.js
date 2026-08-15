// Pure timezone conversion helpers — no DOM access, so they're usable both from
// index.html (via <script src="tz-utils.js">, exposed as window.TzUtils) and from
// plain Node.js for automated tests (via require('./tz-utils.js')).
(function (root) {
    // Read a UTC instant's wall-clock fields as seen in a given IANA time zone.
    function zoneParts(tz, date) {
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
        });
        const map = {};
        dtf.formatToParts(date).forEach(p => map[p.type] = p.value);
        return {
            year: +map.year, month: +map.month, day: +map.day,
            hour: map.hour === '24' ? 0 : +map.hour, minute: +map.minute, second: +map.second,
            weekday: map.weekday,
        };
    }

    // Short zone label as of a given instant, e.g. "EST", "EDT", "GMT+5:30".
    function zoneShortLabel(tz, date) {
        try {
            const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short', hour: '2-digit' });
            const part = dtf.formatToParts(date).find(p => p.type === 'timeZoneName');
            return part ? part.value : tz;
        } catch (e) {
            return tz;
        }
    }

    // Convert a zone-local wall-clock time back to a UTC instant. Two-pass
    // convergence against zoneParts handles DST correctly (the zone's offset at
    // the target instant may differ from its offset at the initial UTC guess).
    function zonedTimeToUtc(tz, y, mo, d, h, mi) {
        let guess = Date.UTC(y, mo - 1, d, h, mi, 0);
        for (let i = 0; i < 2; i++) {
            const p = zoneParts(tz, new Date(guess));
            const guessedAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
            const wanted = Date.UTC(y, mo - 1, d, h, mi, 0);
            guess += (wanted - guessedAsUtc);
        }
        return new Date(guess);
    }

    const TzUtils = { zoneParts, zoneShortLabel, zonedTimeToUtc };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TzUtils;
    } else {
        root.TzUtils = TzUtils;
    }
})(typeof window !== 'undefined' ? window : globalThis);
