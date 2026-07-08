import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, Trophy, Activity, BookOpen, AlertCircle, Clock, Layers, Sparkles, Target } from 'lucide-react';

export const Lexicon = ({ gameState, allWords, profile, onClose, onReset }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    // Snapshot "now" once at mount so render stays pure (this is a point-in-time modal).
    const [now] = useState(() => Date.now());

    const words = Object.values(gameState.words);
    const totalLearned = words.length;

    // SRS Bucket Distribution
    const buckets = [0, 0, 0, 0, 0, 0];
    words.forEach(w => {
        const b = w.bucket || 0;
        if (b >= 0 && b < 6) buckets[b]++;
    });

    const reviewsDue = words.filter(w => w.nextReview <= now && w.bucket < 5).length;

    return (
        <div className="lexicon-overlay">
            <div className="lexicon-modal">
                <div className="lexicon-header">
                    <h2>📊 Stats & Progress</h2>
                    <button className="close-btn" onClick={onClose}><X size={24} /></button>
                </div>

                <div className="lexicon-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        <Activity size={18} /> Dashboard
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
                        onClick={() => setActiveTab('raw')}
                    >
                        <BookOpen size={18} /> Word Data
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'coach' ? 'active' : ''}`}
                        onClick={() => setActiveTab('coach')}
                    >
                        <Sparkles size={18} /> Coach's Notes
                    </button>
                </div>

                <div className="lexicon-content">
                    {activeTab === 'dashboard' && (
                        <div className="dashboard-view">
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-icon"><Clock size={24} color="#f87171" /></div>
                                    <div className="stat-value">{reviewsDue}</div>
                                    <div className="stat-label">Reviews Due</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon"><Layers size={24} color="#38bdf8" /></div>
                                    <div className="stat-value">{totalLearned}</div>
                                    <div className="stat-label">Active Words</div>
                                </div>
                            </div>

                            <div className="bucket-chart" style={{ marginTop: '2rem' }}>
                                <h3>🧠 Memory Strength (SRS Buckets)</h3>
                                <div style={{ display: 'flex', gap: '10px', height: '150px', alignItems: 'flex-end', paddingTop: '1rem' }}>
                                    {buckets.map((count, i) => (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>{count}</span>
                                            <div style={{
                                                width: '100%',
                                                height: `${Math.max(count * 5, 4)}px`,
                                                maxHeight: '120px',
                                                background: i === 5 ? '#4ade80' : `rgba(56, 189, 248, ${0.3 + i * 0.1})`,
                                                borderRadius: '4px 4px 0 0',
                                                transition: 'height 0.3s'
                                            }} />
                                            <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>{i === 5 ? '🏆' : i}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.8rem', textAlign: 'center', marginTop: '0.5rem', color: 'rgba(255,255,255,0.5)' }}>
                                    New (0) ➝ Mastered (5)
                                </div>
                            </div>

                            <div className="danger-zone" style={{ marginTop: '3rem' }}>
                                <p>Reset all spacing repetition intervals and progress.</p>
                                <button className="reset-danger-btn" onClick={onReset}>
                                    <AlertCircle size={16} /> Reset All Data
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'raw' && (
                        <div className="raw-data-view">
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Word</th>
                                            <th>Bucket</th>
                                            <th>Due In</th>
                                            <th>Attempts</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allWords.map(word => {
                                            const stats = gameState.words[word.id];
                                            if (!stats) return null;

                                            // Calculate relative due time
                                            const diff = stats.nextReview - now;
                                            let dueText = 'Now';
                                            if (diff > 0) {
                                                const mins = Math.floor(diff / 60000);
                                                const hours = Math.floor(mins / 60);
                                                const days = Math.floor(hours / 24);

                                                if (days > 0) dueText = `${days}d`;
                                                else if (hours > 0) dueText = `${hours}h`;
                                                else dueText = `${mins}m`;
                                            } else {
                                                dueText = <span style={{ color: '#f87171', fontWeight: 'bold' }}>Now</span>;
                                            }

                                            if (stats.bucket >= 5) dueText = <span style={{ color: '#4ade80' }}>Done</span>;

                                            // Attempts are derived from the two counters the SRS actually tracks.
                                            const correct = stats.total_correct || 0;
                                            const attempts = correct + (stats.total_incorrect || 0);
                                            const pct = attempts ? Math.round((correct / attempts) * 100) : 0;

                                            return (
                                                <tr key={word.id}>
                                                    <td className="polish-cell">{word.polish} <span style={{ opacity: 0.5, fontWeight: 'normal' }}>({word.english})</span></td>
                                                    <td className="center-cell"><span className="status-badge learning">{stats.bucket}</span></td>
                                                    <td className="center-cell">{dueText}</td>
                                                    <td className="center-cell">{correct}/{attempts} ({pct}%)</td>
                                                </tr>
                                            );
                                        })}
                                        {words.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No words started yet.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'coach' && (
                        <div className="coach-notes-view">
                            {profile?.focusNext && (
                                <div className="stat-card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Target size={22} color="#fbbf24" />
                                    <div>
                                        <div className="stat-label">Focus next</div>
                                        <div style={{ fontWeight: 700 }}>{profile.focusNext}</div>
                                    </div>
                                </div>
                            )}

                            {profile?.wiki?.current ? (
                                <div className="wiki-content">
                                    <ReactMarkdown>{profile.wiki.current}</ReactMarkdown>
                                </div>
                            ) : (
                                <p className="no-data" style={{ textAlign: 'center', padding: '2rem', opacity: 0.7 }}>
                                    Your coach is still getting to know you. Keep practicing — after a few
                                    mistakes, personalized notes on your pronunciation will appear here.
                                </p>
                            )}

                            {profile?.wiki?.versions?.length > 1 && (
                                <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.75rem', textAlign: 'right' }}>
                                    Profile revised {profile.wiki.versions.length} times.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
