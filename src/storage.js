// Storage keys
const KEYS = {
  HISTORY: 'fr_weather_history',
  JOURNAL: 'fr_journal',
  PREDICTIONS: 'fr_predictions',
  ACCURACY: 'fr_accuracy',
};

// Weather history — auto-logged snapshots
export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(KEYS.HISTORY) || '[]'); }
  catch { return []; }
}

export function saveSnapshot(snapshot) {
  try {
    const history = loadHistory();
    // Only save if last snapshot was > 30 min ago
    const last = history[history.length - 1];
    if (last && Date.now() - last.ts < 30 * 60 * 1000) return history;
    // Keep 14 days max (roughly 48 per day = 672, but cap at 500)
    const updated = [...history, snapshot].slice(-500);
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));
    return updated;
  } catch { return loadHistory(); }
}

// Journal
export function loadJournal() {
  try { return JSON.parse(localStorage.getItem(KEYS.JOURNAL) || '[]'); }
  catch { return []; }
}

export function saveJournal(entries) {
  try { localStorage.setItem(KEYS.JOURNAL, JSON.stringify(entries)); } catch {}
}

// Predictions
export function loadPredictions() {
  try { return JSON.parse(localStorage.getItem(KEYS.PREDICTIONS) || '[]'); }
  catch { return []; }
}

export function savePrediction(pred) {
  try {
    const preds = loadPredictions();
    const updated = [pred, ...preds].slice(0, 100);
    localStorage.setItem(KEYS.PREDICTIONS, JSON.stringify(updated));
    return updated;
  } catch { return loadPredictions(); }
}

export function updatePredictionOutcome(id, outcome) {
  try {
    const preds = loadPredictions();
    const updated = preds.map(p => p.id === id ? { ...p, outcome, resolvedAt: Date.now() } : p);
    localStorage.setItem(KEYS.PREDICTIONS, JSON.stringify(updated));
    return updated;
  } catch { return loadPredictions(); }
}

// Accuracy score
export function computeAccuracyScore(predictions) {
  const resolved = predictions.filter(p => p.outcome);
  if (!resolved.length) return null;
  const correct = resolved.filter(p => p.outcome === 'correct').length;
  return Math.round((correct / resolved.length) * 100);
}

// Trend analysis helpers
export function getPressureTrend(history) {
  if (history.length < 3) return { trend: 'stable', delta: 0, label: 'Stable' };
  const recent = history.slice(-12); // last ~6 hrs
  const oldest = recent[0]?.pressure || 0;
  const newest = recent[recent.length - 1]?.pressure || 0;
  const delta = newest - oldest;
  if (delta < -3) return { trend: 'falling_fast', delta, label: `Falling fast (${delta.toFixed(1)} hPa)` };
  if (delta < -1) return { trend: 'falling', delta, label: `Falling (${delta.toFixed(1)} hPa)` };
  if (delta > 3) return { trend: 'rising_fast', delta, label: `Rising fast (+${delta.toFixed(1)} hPa)` };
  if (delta > 1) return { trend: 'rising', delta, label: `Rising (+${delta.toFixed(1)} hPa)` };
  return { trend: 'stable', delta, label: 'Stable' };
}

export function getDailyGroups(history) {
  const groups = {};
  history.forEach(snap => {
    const d = new Date(snap.ts);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(snap);
  });
  return Object.entries(groups).slice(-7).map(([date, snaps]) => ({
    date,
    avgPressure: avg(snaps.map(s => s.pressure)),
    avgHumidity: avg(snaps.map(s => s.humidity)),
    avgTemp: avg(snaps.map(s => s.temp)),
    avgWind: avg(snaps.map(s => s.windSpeed)),
    minPressure: Math.min(...snaps.map(s => s.pressure)),
    maxPressure: Math.max(...snaps.map(s => s.pressure)),
    snaps,
  }));
}

function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
