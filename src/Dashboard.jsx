import { useState } from "react";
import { SIG, WIND_COMPASS, windDirLabel, interpretPressure, interpretHumidity, calcVisibility, hpaToInHg, seasonalContext } from "./data.js";
import { getPressureTrend } from "./storage.js";
import { S } from "./styles.js";

function WhyTooltip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span>
      <button onClick={() => setOpen(!open)} style={{
        background: "none", border: "none", color: "#2a6a2a", cursor: "pointer",
        fontSize: 11, padding: "0 4px", fontFamily: "inherit"
      }}>why?</button>
      {open && (
        <div style={{ fontSize: 11, color: "#6b9e6b", background: "#0a160a", padding: "8px 10px", borderRadius: 8, marginTop: 6, lineHeight: 1.6, fontStyle: "italic" }}>
          {text}
        </div>
      )}
    </span>
  );
}

export default function Dashboard({ weather, locationName, loading, apiError, history }) {
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const pressureInfo = weather ? interpretPressure(weather.surface_pressure) : null;
  const visInfo = weather ? calcVisibility(weather.temperature_2m, weather.relative_humidity_2m) : null;
  const windDir = weather ? windDirLabel(weather.wind_direction_10m) : null;
  const windInfo = WIND_COMPASS.find(w => windDir?.startsWith(w.dir)) || WIND_COMPASS[6];
  const trend = getPressureTrend(history);
  const inHg = weather ? hpaToInHg(weather.surface_pressure) : null;
  const month = new Date().getMonth() + 1;
  const seasonal = weather ? seasonalContext(weather.surface_pressure, month) : null;

  const trendColor = {
    falling_fast: SIG.danger, falling: SIG.caution,
    rising_fast: SIG.good, rising: SIG.good, stable: SIG.neutral
  }[trend.trend];

  // Rapid drop alert
  const rapidDrop = trend.trend === 'falling_fast';

  // "What to watch for" based on conditions
  function getWatchFor() {
    const items = [];
    if (trend.trend === 'falling_fast' || trend.trend === 'falling') {
      items.push({ emoji: "🐦", text: "Watch swallows — are they flying unusually low?" });
      items.push({ emoji: "🍃", text: "Check tree leaves — are undersides showing?" });
      items.push({ emoji: "💧", text: "Any earthy or sulfurous smell from nearby water?" });
    } else if (trend.trend === 'rising' || trend.trend === 'rising_fast') {
      items.push({ emoji: "🕷️", text: "Spiders may start spinning larger webs as conditions stabilize" });
      items.push({ emoji: "🌲", text: "Check pine cones — they'll start opening as humidity drops" });
      items.push({ emoji: "🐄", text: "Animals should be more active and moving around" });
    } else {
      items.push({ emoji: "☀️", text: "Stable conditions — watch for cumulus building after noon" });
      items.push({ emoji: "🌿", text: "Check for dew on grass at dawn tomorrow as a fair weather confirmation" });
    }
    if (weather?.relative_humidity_2m > 80) {
      items.push({ emoji: "🌫️", text: "High humidity — fog possible at dawn if skies clear tonight" });
    }
    return items.slice(0, 3);
  }

  async function getAiReading() {
    if (!weather) return;
    setAiLoading(true); setAiText("");
    try {
      const recentHistory = history.slice(-24);
      const pressureHistory = recentHistory.map(s =>
        `${new Date(s.ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}: ${hpaToInHg(s.pressure)}" (${s.pressure} hPa)`
      ).join(', ');

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a seasoned naturalist and field meteorologist. Given these current conditions:

CURRENT:
- Temperature: ${weather.temperature_2m}°F
- Humidity: ${weather.relative_humidity_2m}%
- Pressure: ${inHg}" / ${weather.surface_pressure} hPa (${trend.label})
- Wind: ${weather.wind_speed_10m} mph from ${windDirLabel(weather.wind_direction_10m)}
- Visibility: ${visInfo?.label}
- Season: ${seasonal}

PRESSURE TREND: ${pressureHistory || 'First reading — no history yet'}

Write 3-4 vivid sentences as an experienced outdoorsman — what would they observe right now in nature around them? Animals, plants, air, sky, smell. Then one confident sentence on the 12-hour outlook based on pressure trend. Be specific and evocative.`
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

      {/* Rapid drop alert */}
      {rapidDrop && (
        <div style={{ background: "#2a0a0a", border: "1px solid #f87171", borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#f87171", fontWeight: "bold", marginBottom: 4 }}>⚠ Rapid Pressure Drop</div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
            Pressure has dropped {Math.abs(trend.delta).toFixed(1)} hPa in the last 6 hours. Significant weather change is likely imminent — watch for darkening skies, swallows flying low, and leaves flipping.
          </div>
        </div>
      )}

      {weather && (<>
        {/* Pressure */}
        <div style={{ ...S.card, borderColor: `${SIG[pressureInfo.signal]}33` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={S.label}>Barometric Pressure</span>
            <span style={S.tag(pressureInfo.signal, SIG)}>{pressureInfo.label}</span>
          </div>
          <div style={{ fontSize: 28, ...S.display, marginBottom: 4 }}>
            {inHg}<span style={{ fontSize: 13, color: "#6b9e6b" }}> inHg</span>
          </div>
          <div style={{ fontSize: 12, color: "#4a6a4a", marginBottom: 6 }}>{weather.surface_pressure} hPa</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 12, background: `${trendColor}22`, color: trendColor }}>{trend.label}</span>
            <span style={{ fontSize: 11, color: "#4a6a4a" }}>{seasonal}</span>
          </div>
          <div style={{ ...S.body, marginBottom: 4 }}>{pressureInfo.desc}</div>
          <WhyTooltip text="Barometric pressure is the weight of the atmosphere above you. High pressure traps clear air near the surface. Low pressure allows air to rise, cool, and form clouds and rain. A rapid drop of 0.10 inHg in 3 hours is one of the most reliable storm warnings in meteorology." />
        </div>

        {/* Wind — arrow points toward source (where wind comes FROM) */}
        <div style={S.card}>
          <span style={S.label}>Wind</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: "50%", border: "1px solid #2a4a2a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, background: "#0f2010", flexShrink: 0,
              // Arrow points INTO the compass from the direction wind comes FROM
              // wind_direction_10m is the direction wind comes FROM, arrow points that way
              transform: `rotate(${weather.wind_direction_10m + 180}deg)`
            }}>↑</div>
            <div>
              <div style={{ fontSize: 18, ...S.display }}>{windDir} · {Math.round(weather.wind_speed_10m)} mph</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{windInfo.emoji} {windInfo.meaning}</div>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <WhyTooltip text="Wind direction is named for where the wind comes FROM, not where it's going. A NW wind blows from the northwest toward the southeast. In the Northern Hemisphere, wind circulates clockwise around high pressure and counterclockwise around low pressure — so a shifting wind tells you which way a storm system is moving relative to you." />
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

        {/* What to watch for */}
        <div style={{ ...S.card, borderColor: "#1e4a1e" }}>
          <span style={S.label}>👁 What to Watch For</span>
          <div style={{ fontSize: 11, color: "#4a6a4a", marginBottom: 10 }}>Nature signs that would confirm current conditions</div>
          {getWatchFor().map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji}</span>
              <div style={{ fontSize: 13, color: "#b8d4b0", lineHeight: 1.5 }}>{item.text}</div>
            </div>
          ))}
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
                Tap "Read the Field" for a vivid naturalist's description of current conditions — informed by pressure history and seasonal context.
              </div>
          }
        </div>

        {history.length < 5 && (
          <div style={{ fontSize: 11, color: "#4a6a4a", textAlign: "center", padding: "8px 0 4px", lineHeight: 1.6 }}>
            📈 History building — {history.length} reading{history.length !== 1 ? 's' : ''} so far
          </div>
        )}
      </>)}
    </div>
  );
}
