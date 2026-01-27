import React from 'react';

export const XPBar = ({ xp, level }) => {
    // Level formula inverse: XP needed for Level L = 100 * (L-1)^2
    // XP needed for Next Level (L+1) = 100 * (L)^2
    
    const currentLevelBaseXP = 100 * Math.pow(level - 1, 2);
    const nextLevelXP = 100 * Math.pow(level, 2);
    
    const progress = Math.min(100, Math.max(0, ((xp - currentLevelBaseXP) / (nextLevelXP - currentLevelBaseXP)) * 100));

    return (
        <div className="xp-container">
            <div className="level-badge">
                <span className="level-label">LVL</span>
                <span className="level-val">{level}</span>
            </div>
            <div className="xp-track">
                <div 
                    className="xp-fill" 
                    style={{ width: `${progress}%` }}
                />
            </div>
            <div className="xp-text">
                {xp} XP
            </div>
        </div>
    );
};
