// The status the SRS will actually commit, honoring a manual override (swap).
export const effectiveStatus = (feedback) => {
    if (!feedback) return null;
    if (!feedback.swapped) return feedback.status;
    return feedback.status === 'correct' ? 'incorrect' : 'correct';
};
