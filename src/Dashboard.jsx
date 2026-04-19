import { useState } from "react";
import { SIG, WIND_COMPASS, windDirLabel, interpretPressure, interpretHumidity, interpretVisibility } from "./data.js";
import { getPressureTrend } from "./storage.js";
import { S } from "./styles.js";

export default function Dashboard({ weather, locationName, loading, apiError, history }) {
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const pressureInfo = weather ? interpretPressure(weather.surface_pressure) : null;
  const visInfo = weather ? interpretVisibility(weather.visibility / 1000) : null;
  const windDir = weather ? windDirLabel(weather.wind_direction_10m) : null;
  const windInfo = WIND_COMPASS.find(w => windDir?.startsWith(w.dir)) || WIND_COMPASS[6];
  const trend = getPressureTrend(history);

  const trendColor = {
    falling_fast: SIG.danger, falling: SIG.caution,
    rising_fast: SIG.good, rising: SIG.good, stable: SIG.neutral
  }[trend.trend];

  async function getAiReading() {
    if (!weather) return;
    setAiLoading(true); setAiText("");
    try {
      const recentHistory = history.slice(-24);
      const pressureHistory = recentHistory.map(s =>
        `${new Date(s.ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}: ${s.pressure} hPa`
      ).join(', ');

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a seasoned naturalist and field meteorologist. Given these current conditions and recent history:

CURRENT:
- Temperature: ${weather.temperature_2m}°F
- Humidity: ${weather.relative_humidity_2m}%
- Pressure: ${weather.surface_pressure} hPa (${trend.label})
- Wind: ${weather.wind_speed_10m} mph from ${windDirLabel(weather.wind_direction_10m)}
- Visibility: ${(weather.visibility/1000).toFixed(1)} km

PRESSURE TREND (last 12 hrs): ${pressureHistory || 'No history yet — first reading'}

Write 3-4 vivid sentences as an experienced outdoorsman describing what they would observe right now — animals, plants, air, sky, smell. Then give a confident 12-hour outlook based on the pressure trend. Be specific and evocative.`
          }]
        })
      });
      const data = await res.json();
      setAiText(data.content?.find(b => b.type === "text")?.text || "");
    } catch { setAiText("Unable to load naturalist reading at this time."); }
    setAiLoading(false);
  }

  if (loading) return <div style={{ textAlign: "center", padding: 48, color: "#6b9e6b" }}>Reading the field…</div>;

  return (
    <div>
      {apiError && <div style={{ fontSize: 11, color: "#fbbf24", background: "#1a1a0a", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>⚠ {apiError}</div>}

      {weather && (<>
        {/* Pressure + trend */}
        <div style={{ ...S.card, borderColor: `${SIG[pressureInfo.signal]}33` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={S.label}>Barometric Pressure</span>
            <span style={S.tag(pressureInfo.signal, SIG)}>{pressureInfo.label}</span>
          </div>
          <div style={{ fontSize: 26, ...S.display, marginBottom: 6 }}>
            {weather.surface_pressure} <span style={{ fontSize: 13, color: "#6b9e6b" }}>hPa</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 12, background: `${trendColor}22`, color: trendColor }}>
              {trend.label}
            </span>
          </div>
          <div style={S.body}>{pressureInfo.desc}</div>
        </div>

        {/* Wind */}
        <div style={S.card}>
          <span style={S.label}>Wind</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: "50%", border: "1px solid #2a4a2a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, background: "#0f2010", flexShrink: 0,
              transform: `rotate(${weather.wind_direction_10m}deg)`
            }}>↑</div>
            <div>
              <div style={{ fontSize: 18, ...S.display }}>{windDir} · {Math.round(weather.wind_speed_10m)} mph</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{windInfo.emoji} {windInfo.meaning}</div>
            </div>
          </div>
        </div>

        {/* Humidity + Visibility */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div style={S.card}>
            <span style={S.label}>Humidity</span>
            <div style={{ fontSize: 22, ...S.display, marginBottom: 4 }}>{weather.relative_humidity_2m}%</div>
            <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>{interpretHumidity(weather.relative_humidity_2m)}</div>
          </div>
          <div style={S.card}>
            <span style={S.label}>Visibility</span>
            <div style={{ fontSize: 16, ...S.display, marginBottom: 4 }}>{visInfo.label}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>{visInfo.note}</div>
          </div>
        </div>

        {/* AI Naturalist Reading */}
        <div style={{ ...S.card, background: "linear-gradient(135deg, #132013, #0f2010)", borderColor: "#2a5a2a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={S.label}>🌿 Naturalist's Reading</span>
            <button onClick={getAiReading} style={{ ...S.btn, padding: "7px 14px", fontSize: 11 }}>
              {aiLoading ? "Reading…" : "Read the Field"}
            </button>
          </div>
          {aiText
            ? <div style={{ fontSize: 13, color: "#b8d4b0", lineHeight: 1.8, fontStyle: "italic" }}>"{aiText}"</div>
            : <div style={{ fontSize: 12, color: "#4a6a4a", lineHeight: 1.6 }}>
                Tap "Read the Field" for a naturalist's interpretation — informed by current conditions and your pressure history.
              </div>
          }
        </div>

        {/* History nudge */}
        {history.length < 5 && (
          <div style={{ fontSize: 11, color: "#4a6a4a", textAlign: "center", padding: "8px 0 4px", lineHeight: 1.6 }}>
            📈 Weather history is building — check back after a few visits for trend analysis
          </div>
        )}
      </>)}
    </div>
  );
}
