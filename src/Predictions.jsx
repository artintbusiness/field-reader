import { useState } from "react";
import { loadPredictions, savePrediction, updatePredictionOutcome, computeAccuracyScore, getPressureTrend, getDailyGroups } from "./storage.js";
import { windDirLabel, SIG } from "./data.js";
import { S } from "./styles.js";

export default function Predictions({ weather, history, journal }) {
  const [predictions, setPredictions] = useState(loadPredictions);
  const [generating, setGenerating] = useState(false);
  const [activeWindow, setActiveWindow] = useState("12h");

  const accuracyScore = computeAccuracyScore(predictions);
  const trend = getPressureTrend(history);
  const daily = getDailyGroups(history);

  async function generatePrediction() {
    if (!weather) return;
    setGenerating(true);

    try {
      // Build rich context from history + journal
      const recentHistory = history.slice(-48);
      const pressureNarrative = recentHistory.length > 1
        ? `Pressure over last ${recentHistory.length} readings: started at ${recentHistory[0]?.pressure} hPa, now ${recentHistory[recentHistory.length-1]?.pressure} hPa. Trend: ${trend.label}.`
        : `Single reading: ${weather.surface_pressure} hPa. No trend data yet.`;

      const dailySummary = daily.slice(-3).map(d =>
        `${d.date}: avg ${d.avgPressure.toFixed(0)} hPa, ${d.avgTemp.toFixed(0)}°F, ${d.avgHumidity.toFixed(0)}% humidity`
      ).join('; ');

      const recentObservations = journal.slice(0, 5).map(e =>
        `${e.date} ${e.time}: clouds="${e.clouds || 'none noted'}", signs="${e.signs || 'none noted'}", accuracy="${e.accuracy || 'not rated'}"`
      ).join('\n');

      const windowHours = activeWindow === "6h" ? 6 : activeWindow === "12h" ? 12 : 24;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a field meteorologist and naturalist making a weather prediction. Use ALL available data including the observer's personal field notes.

CURRENT CONDITIONS:
- Temperature: ${weather.temperature_2m}°F
- Humidity: ${weather.relative_humidity_2m}%  
- Pressure: ${weather.surface_pressure} hPa
- Wind: ${weather.wind_speed_10m} mph from ${windDirLabel(weather.wind_direction_10m)}
- Visibility: ${(weather.visibility/1000).toFixed(1)} km
- Precipitation: ${weather.precipitation} mm

PRESSURE HISTORY:
${pressureNarrative}

DAILY AVERAGES (recent days):
${dailySummary || 'No daily data yet'}

OBSERVER'S FIELD NOTES (most recent first):
${recentObservations || 'No observations logged yet'}

Make a specific ${windowHours}-hour weather prediction. Structure your response as:

PREDICTION: [One clear sentence stating what will happen]
CONFIDENCE: [High / Medium / Low]
KEY SIGNALS: [2-3 bullet points on what data drives this prediction, including any field observations]
NATURE WATCH: [One sentence on what natural signs to watch for that would confirm or contradict this prediction]
CAVEAT: [One sentence on the main uncertainty]`
          }]
        })
      });

      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";

      // Parse the structured response
      const predLine = text.match(/PREDICTION:\s*(.+)/)?.[1]?.trim() || text.split('\n')[0];
      const confLine = text.match(/CONFIDENCE:\s*(.+)/)?.[1]?.trim() || "Medium";
      const signalsMatch = text.match(/KEY SIGNALS:\s*([\s\S]*?)(?=NATURE WATCH:|CAVEAT:|$)/)?.[1]?.trim() || "";
      const natureWatch = text.match(/NATURE WATCH:\s*(.+)/)?.[1]?.trim() || "";
      const caveat = text.match(/CAVEAT:\s*(.+)/)?.[1]?.trim() || "";

      const pred = {
        id: Date.now(),
        ts: Date.now(),
        window: activeWindow,
        prediction: predLine,
        confidence: confLine,
        signals: signalsMatch,
        natureWatch,
        caveat,
        weather: { temp: weather.temperature_2m, pressure: weather.surface_pressure, humidity: weather.relative_humidity_2m },
        outcome: null,
      };

      const updated = savePrediction(pred);
      setPredictions(updated);
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  }

  function markOutcome(id, outcome) {
    const updated = updatePredictionOutcome(id, outcome);
    setPredictions(updated);
  }

  const confColor = { High: SIG.good, Medium: SIG.watch, Low: SIG.caution };
  const pending = predictions.filter(p => !p.outcome);
  const resolved = predictions.filter(p => p.outcome);

  return (
    <div>
      {/* Accuracy score */}
      {accuracyScore !== null && (
        <div style={{ ...S.card, borderColor: "#2a5a2a", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={S.label}>Your Accuracy Score</span>
              <div style={{ fontSize: 28, ...S.display, color: accuracyScore >= 70 ? SIG.good : accuracyScore >= 50 ? SIG.watch : SIG.caution }}>
                {accuracyScore}%
              </div>
              <div style={{ fontSize: 11, color: "#6b9e6b" }}>{resolved.length} prediction{resolved.length !== 1 ? 's' : ''} rated</div>
            </div>
            <div style={{ fontSize: 32, opacity: 0.6 }}>
              {accuracyScore >= 70 ? "🎯" : accuracyScore >= 50 ? "📊" : "📉"}
            </div>
          </div>
        </div>
      )}

      {/* Generate prediction */}
      <div style={{ ...S.card, background: "linear-gradient(135deg, #132013, #0f2010)", borderColor: "#2a5a2a" }}>
        <span style={S.label}>🔮 Generate Prediction</span>
        <div style={{ fontSize: 12, color: "#4a6a4a", lineHeight: 1.6, marginBottom: 14 }}>
          {history.length < 5
            ? "Uses current conditions. Come back after a few visits for trend-informed predictions."
            : `Uses ${history.length} weather snapshots + ${journal.length} field observation${journal.length !== 1 ? 's' : ''}.`}
        </div>

        {/* Time window selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["6h","12h","24h"].map(w => (
            <button key={w} onClick={() => setActiveWindow(w)} style={{
              flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
              border: "1px solid #2a4a2a", cursor: "pointer", fontFamily: "inherit",
              background: activeWindow === w ? "#1a4a1a" : "transparent",
              color: activeWindow === w ? "#4ade80" : "#6b9e6b"
            }}>{w} outlook</button>
          ))}
        </div>

        <button onClick={generatePrediction} disabled={generating || !weather} style={{
          ...S.btn, width: "100%", textAlign: "center", padding: "12px",
          opacity: generating || !weather ? 0.5 : 1
        }}>
          {generating ? "Analyzing conditions…" : "Generate Prediction"}
        </button>
      </div>

      {/* Pending predictions — awaiting outcome */}
      {pending.length > 0 && (
        <>
          <span style={{ ...S.sectionTitle, marginTop: 8 }}>Awaiting Outcome</span>
          {pending.map(pred => (
            <PredictionCard key={pred.id} pred={pred} confColor={confColor} onMark={markOutcome} />
          ))}
        </>
      )}

      {/* Resolved predictions */}
      {resolved.length > 0 && (
        <>
          <span style={{ ...S.sectionTitle, marginTop: 8 }}>Resolved</span>
          {resolved.slice(0, 10).map(pred => (
            <PredictionCard key={pred.id} pred={pred} confColor={confColor} resolved />
          ))}
        </>
      )}

      {predictions.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 20px", color: "#4a6a4a", fontSize: 13, lineHeight: 1.8 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔮</div>
          No predictions yet.<br/>Generate your first one above,<br/>then come back to rate its accuracy.
        </div>
      )}
    </div>
  );
}

function PredictionCard({ pred, confColor, onMark, resolved }) {
  const [expanded, setExpanded] = useState(false);
  const age = Math.round((Date.now() - pred.ts) / (1000 * 60 * 60));
  const conf = pred.confidence?.split(' ')[0] || "Medium";

  return (
    <div style={{ ...S.card, borderColor: resolved ? "#1e3a1e" : "#2a5a2a", opacity: resolved ? 0.75 : 1 }}
      onClick={() => setExpanded(!expanded)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: "#6b9e6b" }}>
          {pred.window} outlook · {age < 1 ? "just now" : `${age}h ago`}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10,
            background: `${confColor[conf] || SIG.neutral}22`,
            color: confColor[conf] || SIG.neutral }}>{conf}</span>
          {resolved && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10,
              background: pred.outcome === 'correct' ? "#14532d" : pred.outcome === 'partial' ? "#1a1a0a" : "#1a0a0a",
              color: pred.outcome === 'correct' ? "#4ade80" : pred.outcome === 'partial' ? "#fbbf24" : "#f87171" }}>
              {pred.outcome === 'correct' ? "✓ Accurate" : pred.outcome === 'partial' ? "~ Partial" : "✗ Off"}
            </span>
          )}
        </div>
      </div>

      <div style={{ fontSize: 14, color: "#e8f5e0", lineHeight: 1.5, marginBottom: expanded ? 12 : 0 }}>
        {pred.prediction}
      </div>

      {expanded && (
        <div style={{ paddingTop: 12, borderTop: "1px solid #1e3a1e" }}>
          {pred.signals && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Key Signals</div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-line" }}>{pred.signals}</div>
            </div>
          )}
          {pred.natureWatch && (
            <div style={{ fontSize: 12, color: "#b8d4b0", background: "#0f2010", padding: "8px 12px", borderRadius: 8, lineHeight: 1.5, marginBottom: 10 }}>
              🌿 {pred.natureWatch}
            </div>
          )}
          {pred.caveat && (
            <div style={{ fontSize: 11, color: "#6b9e6b", fontStyle: "italic", marginBottom: 12 }}>⚠ {pred.caveat}</div>
          )}

          {/* Rate outcome */}
          {!resolved && (
            <div>
              <div style={{ fontSize: 10, color: "#4a6a4a", letterSpacing: 1, marginBottom: 8 }}>HOW DID IT DO?</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["correct","✓ Accurate","#4ade80"],["partial","~ Partial","#fbbf24"],["wrong","✗ Off","#f87171"]].map(([val, label, color]) => (
                  <button key={val} onClick={e => { e.stopPropagation(); onMark(pred.id, val); }} style={{
                    flex: 1, padding: "8px 4px", borderRadius: 8, fontSize: 11,
                    border: `1px solid ${color}44`, cursor: "pointer", fontFamily: "inherit",
                    background: `${color}11`, color
                  }}>{label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 10, color: "#2a4a2a", marginTop: 6, textAlign: "right" }}>
        {expanded ? "tap to collapse" : "tap for details"}
      </div>
    </div>
  );
}
