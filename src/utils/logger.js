// Lightweight diagnostic logger for mobile debugging.
//
// Enabled only when the page is opened with ?debug=1 (persisted in localStorage), so normal
// use has zero overhead. When enabled, events are batched and shipped to the server collector
// at /__log via sendBeacon (survives page navigation/unload). Failures are swallowed — logging
// must never affect app behavior. Events also mirror to console.
//
// Server side: log-collector.mjs appends each event as a JSONL line to app.log, read over SSH.

const ENDPOINT = '/__log';
const FLUSH_MS = 1500;
const FLUSH_AT = 15; // flush when this many events are buffered

let enabled = false;
let sessionId = null;
const buffer = [];

function nowIso() {
    return new Date().toISOString();
}

function flush() {
    if (!enabled || buffer.length === 0) return;
    const batch = buffer.splice(0, buffer.length);
    const body = JSON.stringify(batch);
    try {
        if (navigator.sendBeacon) {
            navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
        } else {
            fetch(ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => {});
        }
    } catch {
        // ignore — logging is best-effort
    }
}

/**
 * Record one diagnostic event. No-op unless logging is enabled.
 * @param {string} category  e.g. 'recorder', 'api', 'flow', 'error'
 * @param {string} message   short event label
 * @param {object} [data]    small serializable payload
 */
export function log(category, message, data) {
    if (!enabled) return;
    const entry = { t: nowIso(), sid: sessionId, category, message, ...(data ? { data } : {}) };
    buffer.push(entry);
    try {
        console.log(`[${category}] ${message}`, data ?? '');
    } catch {
        // ignore
    }
    if (buffer.length >= FLUSH_AT) flush();
}

export function isLoggingEnabled() {
    return enabled;
}

/** Initialize logging. Call once at startup. */
export function initLogger() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('debug') === '1') localStorage.setItem('pf_debug', '1');
        if (params.get('debug') === '0') localStorage.removeItem('pf_debug');
        enabled = localStorage.getItem('pf_debug') === '1';
    } catch {
        enabled = false;
    }
    if (!enabled) return;

    sessionId = Math.random().toString(36).slice(2, 8);

    log('session', 'start', {
        ua: navigator.userAgent,
        secureContext: window.isSecureContext,
        lang: navigator.language,
        screen: `${window.screen?.width}x${window.screen?.height}`,
        dpr: window.devicePixelRatio,
        online: navigator.onLine,
    });

    window.addEventListener('error', (e) => {
        log('error', 'window.onerror', { msg: e.message, src: e.filename, line: e.lineno, col: e.colno });
    });
    window.addEventListener('unhandledrejection', (e) => {
        log('error', 'unhandledrejection', { reason: String(e.reason).slice(0, 300) });
    });
    // Best-effort flush when the tab is hidden/closed (mobile app-switching).
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
    });

    setInterval(flush, FLUSH_MS);
}
