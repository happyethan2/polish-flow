// Tiny zero-dependency log collector for mobile diagnostics.
// Receives batched JSON log events (POST /__log) from the app and appends each as a JSONL
// line to app.log, which is read over SSH. Temporary debug infrastructure.
//
// Run:  node log-collector.mjs   (listens on 127.0.0.1:9099)
// Exposed to the tailnet via: tailscale serve --https=8443 --set-path=/__log http://127.0.0.1:9099
import { createServer } from 'node:http';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const PORT = process.env.PORT || 9099;
const LOG_FILE = process.env.LOG_FILE || '/home/ethan/apps/polish-flow/logs/app.log';

await mkdir(dirname(LOG_FILE), { recursive: true });

createServer((req, res) => {
    // CORS/headers are unnecessary (same-origin), but respond to any preflight just in case.
    if (req.method === 'OPTIONS') {
        res.writeHead(204).end();
        return;
    }
    if (req.method !== 'POST') {
        res.writeHead(200, { 'content-type': 'text/plain' }).end('log-collector ok\n');
        return;
    }

    let body = '';
    req.on('data', (c) => {
        body += c;
        if (body.length > 512 * 1024) req.destroy(); // guard against runaway payloads
    });
    req.on('end', async () => {
        const recvIso = new Date().toISOString();
        let lines;
        try {
            const parsed = JSON.parse(body);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            lines = arr.map((e) => JSON.stringify({ recv: recvIso, ...e })).join('\n') + '\n';
        } catch {
            lines = JSON.stringify({ recv: recvIso, raw: body.slice(0, 2000) }) + '\n';
        }
        try {
            await appendFile(LOG_FILE, lines);
        } catch (e) {
            console.error('append failed:', e.message);
        }
        res.writeHead(204).end();
    });
}).listen(PORT, '127.0.0.1', () => {
    console.log(`log-collector listening on 127.0.0.1:${PORT} -> ${LOG_FILE}`);
});
