import { getDailyGroups, getPressureTrend } from "./storage.js";
import { S } from "./styles.js";
import { SIG } from "./data.js";

function MiniChart({ data, color, height = 48, label, unit }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100 / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * w;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div>
      <div style={{ fontSize: 10, color: "#6b9e6b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <svg viewBox={`0 0 100 ${height}`} style={{ width: "100%", height, display: "block" }} preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* Last point dot */}
        {data.length > 0 && (() => {
          const last = data[data.length - 1];
          const x = 100;
          const y = height - ((last - min) / range) * (height - 8) - 4;
          return <circle cx={x} cy={y} r="2.5" fill={color} />;
        })()}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "#4a6a4a" }}>{min.toFixed(0)}{unit}</span>
        <span style={{ fontSize: 11, color, fontFamily: "'Playfair Display', serif" }}>{data[data.length-1]?.toFixed(1)}{unit}</span>
        <span style={{ fontSize: 10, color: "#4a6a4a" }}>{max.toFixed(0)}{unit}</span>
      </div>
    </div>
  );
}

function PressureBar({ value, min, max }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const color = value > 1013 ? SIG.good : value > 1000 ? SIG.watch : SIG.danger;
  return (
    <div style={{ height: 6, background: "#0f2010", borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s" }} />
    </div>
  );
}

export default function Trends({ history, journal }) {
  const daily = getDailyGroups(history);
  const trend = getPressureTrend(history);

  // Hourly data for charts (last 48 readings)
  const recent = history.slice(-48);
  const pressureData = recent.map(s => s.pressure);
  const humidityData = recent.map(s => s.humidity);
  const tempData = recent.map(s => s.temp);
  const windData = recent.map(s => s.windSpeed);

  // Pressure range across all history
  const allPressures = history.map(s => s.pressure);
  const pMin = allPressures.length ? Math.min(...allPressures) - 2 : 990;
  const pMax = allPressures.length ? Math.max(...allPressures) + 2 : 1030;

  // Journal sign correlations
  const recentJournal = journal.slice(0, 10);

  if (history.length < 3) {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px", color: "#4a6a4a", lineHeight: 1.8 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📈</div>
        <div style={{ fontSize: 13 }}>
          Weather history is building.<br />
          Open the app a few more times<br />
          to start seeing trends here.
        </div>
        <div style={{ fontSize: 11, color: "#2a4a2a", marginTop: 16 }}>{history.length} snapshot{history.length !== 1 ? 's' : ''} recorded so far</div>
      </div>
    );
  }

  return (
    <div>
      {/* Trend Summary */}
      <div style={{ ...S.card, borderColor: "#2a5a2a" }}>
        <span style={S.label}>Pressure Trend</span>
        <div style={{ fontSize: 15, color: "#e8f5e0", marginBottom: 6, fontFamily: "'Playfair Display', serif" }}>{trend.label}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
          {trend.trend === 'falling_fast' && "Rapid pressure drop — significant weather change imminent. Watch for swallows flying low, cattle lying down."}
          {trend.trend === 'falling' && "Pressure declining — weather deteriorating. Expect increasing cloud cover and possible rain."}
          {trend.trend === 'rising_fast' && "Strong pressure rise — conditions clearing quickly. Fair weather ahead."}
          {trend.trend === 'rising' && "Pressure building — conditions improving. Weather clearing over next several hours."}
          {trend.trend === 'stable' && "Steady pressure — conditions likely to persist. No major change signaled."}
        </div>
        <div style={{ fontSize: 10, color: "#4a6a4a", marginTop: 6 }}>Based on {Math.min(history.length, 12)} readings</div>
      </div>

      {/* Charts */}
      {pressureData.length > 1 && (
        <div style={S.card}>
          <span style={S.label}>Recent History (last {pressureData.length} readings)</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <MiniChart data={pressureData} color="#4ade80" label="Pressure" unit=" hPa" />
            <MiniChart data={humidityData} color="#93c5fd" label="Humidity" unit="%" />
            <MiniChart data={tempData} color="#fcd34d" label="Temperature" unit="°" />
            <MiniChart data={windData} color="#c4b5fd" label="Wind" unit=" mph" />
          </div>
        </div>
      )}

      {/* Daily breakdown */}
      {daily.length > 0 && (
        <div style={S.card}>
          <span style={S.label}>Daily Averages</span>
          {daily.map(day => (
            <div key={day.date} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #1a2a1a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#e8f5e0", fontFamily: "'Playfair Display', serif" }}>{day.date}</span>
                <span style={{ fontSize: 12, color: "#6b9e6b" }}>{day.avgTemp.toFixed(0)}°F · {day.avgHumidity.toFixed(0)}% humidity</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b9e6b", marginBottom: 4 }}>
                <span>Pressure: {day.avgPressure.toFixed(1)} hPa</span>
                <span>Range: {day.minPressure.toFixed(0)}–{day.maxPressure.toFixed(0)}</span>
              </div>
              <PressureBar value={day.avgPressure} min={pMin} max={pMax} />
            </div>
          ))}
        </div>
      )}

      {/* Journal pattern correlation */}
      {recentJournal.length > 0 && (
        <div style={S.card}>
          <span style={S.label}>Recent Field Notes</span>
          <div style={{ fontSize: 11, color: "#4a6a4a", marginBottom: 10, lineHeight: 1.5 }}>
            Your logged observations — used by the AI to improve predictions
          </div>
          {recentJournal.slice(0, 4).map(entry => (
            <div key={entry.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #1a2a1a" }}>
              <div style={{ fontSize: 11, color: "#4ade80", marginBottom: 3 }}>{entry.date} · {entry.time}</div>
              {entry.signs && <div style={{ fontSize: 12, color: "#94a3b8" }}>🌿 {entry.signs}</div>}
              {entry.clouds && <div style={{ fontSize: 12, color: "#94a3b8" }}>☁ {entry.clouds}</div>}
              {entry.accuracy && (
                <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, marginTop: 4, display: "inline-block",
                  background: entry.accuracy.includes("✓") ? "#14532d" : entry.accuracy.includes("~") ? "#1a1a0a" : "#1a0a0a",
                  color: entry.accuracy.includes("✓") ? "#4ade80" : entry.accuracy.includes("~") ? "#fbbf24" : "#f87171"
                }}>{entry.accuracy}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
