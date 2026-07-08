import React, { useMemo, useState } from 'react';
import { aiService } from '../services/aiService';
import { PROVIDER_NAMES } from '../services/aiProvider';
import manifest from '../../dev_tools/audio_testing/manifest.json';

// Dev-only harness: runs the real validatePronunciation pipeline against the recorded
// dataset and shows a pass/fail grid. Open with ?dev=audio. Not part of the normal app.
//
// The WAV files are pulled straight from dev_tools via Vite's glob (no duplication into public).
const wavUrls = import.meta.glob('../../dev_tools/audio_testing/recordings/*/*.wav', {
    query: '?url',
    import: 'default',
    eager: true,
});

// case name -> whether the pipeline SHOULD mark it correct
const EXPECTED = { correct: true, wrong: false, english: false };

function buildCases() {
    const words = manifest.words || {};
    const cases = [];
    for (const [path, url] of Object.entries(wavUrls)) {
        const m = path.match(/recordings\/([^/]+)\/([^/]+)\.wav$/);
        if (!m) continue;
        const [, folder, caseName] = m;
        if (!(caseName in EXPECTED)) continue;
        const target = words[folder];
        if (!target) continue;
        cases.push({ key: `${folder}/${caseName}`, folder, caseName, target, url, expected: EXPECTED[caseName] });
    }
    return cases.sort((a, b) => a.key.localeCompare(b.key));
}

export const AudioHarness = () => {
    const cases = useMemo(buildCases, []);
    const [provider, setProvider] = useState(PROVIDER_NAMES[0]);
    const [results, setResults] = useState({}); // key -> { status, correct, heard, confidence, pass, error }
    const [running, setRunning] = useState(false);

    const runOne = async (c) => {
        setResults((r) => ({ ...r, [c.key]: { status: 'running' } }));
        try {
            const blob = await (await fetch(c.url)).blob();
            const res = await aiService.validatePronunciation(blob, c.target, { provider });
            const pass = res.correct === c.expected;
            setResults((r) => ({
                ...r,
                [c.key]: { status: 'done', correct: res.correct, heard: res.heard, confidence: res.confidence, pass },
            }));
        } catch (e) {
            setResults((r) => ({ ...r, [c.key]: { status: 'error', error: String(e.message || e).slice(0, 140) } }));
        }
    };

    const runAll = async () => {
        setRunning(true);
        setResults({});
        for (const c of cases) {
            // Sequential to stay within rate limits (mirrors benchmark_audio.py).
            await runOne(c);
        }
        setRunning(false);
    };

    const done = cases.filter((c) => results[c.key]?.status === 'done');
    const passed = done.filter((c) => results[c.key]?.pass).length;

    return (
        <div style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0' }}>
            <h1 style={{ marginBottom: '0.25rem' }}>🎧 Audio Pipeline Harness</h1>
            <p style={{ opacity: 0.7, marginTop: 0 }}>
                Runs the real <code>validatePronunciation</code> pipeline against the recorded dataset.
                <code>correct</code> should pass; <code>wrong</code> and <code>english</code> should fail.
            </p>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '1rem 0' }}>
                <label>
                    Provider:{' '}
                    <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={running}>
                        {PROVIDER_NAMES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                </label>
                <button onClick={runAll} disabled={running || cases.length === 0}>
                    {running ? 'Running…' : `Run all (${cases.length})`}
                </button>
                {done.length > 0 && (
                    <strong style={{ color: passed === done.length ? '#4ade80' : '#fbbf24' }}>
                        {passed}/{done.length} passed
                    </strong>
                )}
            </div>

            {cases.length === 0 && <p style={{ color: '#f87171' }}>No .wav test files found under dev_tools/audio_testing/recordings.</p>}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #334155' }}>
                        <th style={{ padding: '6px' }}>Case</th>
                        <th>Target</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Heard</th>
                        <th>Conf</th>
                        <th>Result</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {cases.map((c) => {
                        const r = results[c.key] || {};
                        const resultCell =
                            r.status === 'running' ? '…'
                            : r.status === 'error' ? '⚠️ ' + r.error
                            : r.status === 'done' ? (r.pass ? '✅ pass' : '❌ FAIL')
                            : '';
                        return (
                            <tr key={c.key} style={{ borderBottom: '1px solid #1e293b' }}>
                                <td style={{ padding: '6px' }}>{c.key}</td>
                                <td>{c.target}</td>
                                <td>{c.expected ? 'correct' : 'incorrect'}</td>
                                <td>{r.status === 'done' ? (r.correct ? 'correct' : 'incorrect') : ''}</td>
                                <td>{r.heard || ''}</td>
                                <td>{r.confidence != null ? r.confidence : ''}</td>
                                <td style={{ color: r.pass === false ? '#f87171' : r.pass ? '#4ade80' : '#94a3b8' }}>{resultCell}</td>
                                <td><button onClick={() => runOne(c)} disabled={running}>run</button></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
