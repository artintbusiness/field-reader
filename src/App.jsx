import { useState, useEffect } from "react";
import { loadHistory, saveSnapshot, loadJournal } from "./storage.js";
import { windDirLabel } from "./data.js";
import Dashboard from "./Dashboard.jsx";
import Trends from "./Trends.jsx";
import Predictions from "./Predictions.jsx";
import FieldGuide from "./FieldGuide.jsx";
import Journal from "./Journal.jsx";

const TABS = [
  { id: "dashboard", label: "Now", emoji: "🌿" },
  { id: "trends", label: "Trends", emoji: "📈" },
  { id: "predict", label: "Predict", emoji: "🔮" },
  { id: "guide", label: "Guide", emoji: "📖" },
  { id: "journal", label: "Journal", emoji: "📓" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState("");
  const [apiError, setApiError] = useState(null);
  const [history, setHistory] = useState(loadHistory);
  const [journal, setJournal] = useState(loadJournal);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Capture PWA install prompt
  useEffect(() => {
    const handler = e => { e.preventDefault(); setInstallPrompt(e); setShowInstallBanner(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Fetch weather on mount
  useEffect(() => {
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(
          p => fetchWeather(p.coords.latitude, p.coords.longitude),
          () => fetchWeather(40.7128, -74.006)
        )
      : fetchWeather(40.7128, -74.006);
  }, []);

  // Refresh journal when tab changes (in case journal was updated)
  useEffect(() => {
    if (tab === 'predict' || tab === 'trends') {
      setJournal(loadJournal());
    }
  }, [tab]);

  async function fetchWeather(lat, lon) {
    setLoading(true);
    try {
      const [wxRes, geoRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,visibility,weather_code,precipitation&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`),
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
      ]);
      const wx = await wxRes.json();
      const geo = await geoRes.json();
      const current = wx.current;
      setWeather(current);
      setLocationName(geo.address?.city || geo.address?.town || geo.address?.county || "Your Location");

      // Auto-save snapshot to history
      const snapshot = {
        ts: Date.now(),
        temp: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        pressure: current.surface_pressure,
        windSpeed: current.wind_speed_10m,
        windDir: windDirLabel(current.wind_direction_10m),
        visibility: current.visibility,
        precipitation: current.precipitation,
      };
      const updated = saveSnapshot(snapshot);
      setHistory(updated);

    } catch {
      setApiError("Using demo data — check your connection.");
      const demo = { temperature_2m: 58, relative_humidity_2m: 62, surface_pressure: 1008, wind_speed_10m: 12, wind_direction_10m: 225, visibility: 9500, weather_code: 2, precipitation: 0 };
      setWeather(demo);
      setLocationName("Morris County, NJ");
      const snapshot = { ts: Date.now(), temp: demo.temperature_2m, humidity: demo.relative_humidity_2m, pressure: demo.surface_pressure, windSpeed: demo.wind_speed_10m, windDir: "SW", visibility: demo.visibility, precipitation: 0 };
      const updated = saveSnapshot(snapshot);
      setHistory(updated);
    }
    setLoading(false);
  }

  const activeTab = TABS.find(t => t.id === tab);

  return (
    <div style={{
      fontFamily: "'Source Serif 4', 'Georgia', serif",
      background: "#0f1a0e",
      minHeight: "100dvh",
      color: "#d4e6c3",
      maxWidth: 480,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* Install Banner */}
      {showInstallBanner && (
        <div style={{ background: "#1a4a1a", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2a6a2a", flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "#b8d4b0" }}>Add Field Reader to your home screen</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={async () => { installPrompt?.prompt(); setShowInstallBanner(false); }}
              style={{ background: "#132013", border: "1px solid #2a6a2a", color: "#4ade80", padding: "5px 12px", borderRadius: 16, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
              Install
            </button>
            <button onClick={() => setShowInstallBanner(false)} style={{ background: "none", border: "none", color: "#6b9e6b", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: "linear-gradient(160deg, #0f2a10 0%, #1a3a1a 50%, #0d1f0d 100%)",
        borderBottom: "1px solid #2a4a2a",
        padding: "max(env(safe-area-inset-top), 20px) 20px 16px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: 4, color: "#4ade80", textTransform: "uppercase" }}>Field Reader</span>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 400, color: "#e8f5e0", marginTop: 3, lineHeight: 1.2 }}>
              Natural Weather Navigation
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#6b9e6b", marginBottom: 2 }}>📍 {locationName || "Locating…"}</div>
            {weather && <div style={{ fontSize: 28, color: "#e8f5e0", fontFamily: "'Playfair Display', serif", fontWeight: 400 }}>{Math.round(weather.temperature_2m)}°F</div>}
            {history.length > 1 && <div style={{ fontSize: 9, color: "#2a5a2a", marginTop: 1 }}>{history.length} readings logged</div>}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e3a1e", background: "#0d180d", flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px 2px 8px", border: "none",
            background: tab === t.id ? "#1a2e1a" : "transparent",
            color: tab === t.id ? "#4ade80" : "#4a6a4a",
            fontSize: 9, cursor: "pointer", letterSpacing: 0.5,
            borderBottom: tab === t.id ? "2px solid #4ade80" : "2px solid transparent",
            fontFamily: "inherit", transition: "all 0.15s",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          }}>
            <span style={{ fontSize: 18 }}>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 16px 40px" }}>
        {tab === "dashboard" && <Dashboard weather={weather} locationName={locationName} loading={loading} apiError={apiError} history={history} />}
        {tab === "trends" && <Trends history={history} journal={journal} />}
        {tab === "predict" && <Predictions weather={weather} history={history} journal={journal} />}
        {tab === "guide" && <FieldGuide />}
        {tab === "journal" && <Journal weather={weather} />}
      </div>
    </div>
  );
}
