const STORAGE_KEY = 'pacman3d_scores';
const MAX_ENTRIES = 10;

export function saveScore({ score, mapId, mapName, result }) {
    const scores = loadScores();

    // Don't register if both differentials (score + result) are identical to an existing entry.
    const isDuplicate = scores.some(e => e.score === score && e.result === result && e.mapId === mapId);
    if (isDuplicate) {
        return null;
    }

    scores.push({ score, mapId, mapName, result });

    // Sort: score descending; ties broken by result (win beats lose).
    scores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const order = { win: 0, lose: 1 };
        return (order[a.result] ?? 1) - (order[b.result] ?? 1);
    });

    const trimmed = scores.slice(0, MAX_ENTRIES);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
        // localStorage unavailable
    }

    const rank = trimmed.findIndex(e => e.score === score && e.result === result);
    return rank >= 0 ? rank + 1 : null;
}

export function loadScores() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}
