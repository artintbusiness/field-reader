import { useState } from "react";
import { loadJournal, saveJournal } from "./storage.js";
import { S } from "./styles.js";

export default function Journal({ weather }) {
  const [journal, setJournal] = useState(loadJournal);
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ clouds: "", signs: "", notes: "", accuracy: "" });

  function addEntry() {
    if (!newEntry.clouds && !newEntry.notes && !newEntry.signs) return;
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      weather: weather ? `${Math.round(weather.temperature_2m)}°F · ${weather.relative_humidity_2m}% RH · ${weather.surface_pressure} hPa` : "",
      ...newEntry
    };
    const updated = [entry, ...journal];
    setJournal(updated);
    saveJournal(updated);
    setNewEntry({ clouds: "", signs: "", notes: "", accuracy: "" });
    setShowForm(false);
  }

  function deleteEntry(id) {
    const updated = journal.filter(e => e.id !== id);
    setJournal(updated);
    saveJournal(updated);
  }

  const accurate = journal.filter(e => e.accuracy?.includes("✓")).length;
  const rated = journal.filter(e => e.accuracy && !e.accuracy.includes("—")).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <span style={S.label}>Field Journal</span>
          {rated > 0 && <div style={{ fontSize: 11, color: "#6b9e6b" }}>{accurate}/{rated} predictions accurate</div>}
        </div>
        <button onClick={() => setShowForm(!showForm)} style={S.btn}>+ Log Entry</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, borderColor: "#2a5a2a", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#6b9e6b", marginBottom: 4 }}>Clouds observed</div>
          <input value={newEntry.clouds} onChange={e => setNewEntry({...newEntry, clouds: e.target.value})}
            placeholder="e.g. Cumulus building to the west…" style={S.input} />

          <div style={{ fontSize: 11, color: "#6b9e6b", marginBottom: 4 }}>Nature signs noticed</div>
          <input value={newEntry.signs} onChange={e => setNewEntry({...newEntry, signs: e.target.value})}
            placeholder="e.g. Swallows flying low, leaves flipping…" style={S.input} />

          <div style={{ fontSize: 11, color: "#6b9e6b", marginBottom: 4 }}>Notes / what happened</div>
          <textarea value={newEntry.notes} onChange={e => setNewEntry({...newEntry, notes: e.target.value})}
            placeholder="What did you predict? What actually happened?" rows={3}
            style={{ ...S.input, resize: "vertical" }} />

          <div style={{ fontSize: 11, color: "#6b9e6b", marginBottom: 8 }}>Prediction accuracy</div>
          <div style={{ display: "flex", gap: 7, marginBottom: 14 }}>
            {["✓ Accurate","~ Close","✗ Off","— N/A"].map(a => (
              <button key={a} onClick={() => setNewEntry({...newEntry, accuracy: a})} style={{
                flex: 1, padding: "8px 2px", borderRadius: 8, fontSize: 10,
                border: "1px solid #2a4a2a", cursor: "pointer", fontFamily: "inherit",
                background: newEntry.accuracy === a ? "#1a4a1a" : "transparent",
                color: newEntry.accuracy === a ? "#4ade80" : "#6b9e6b"
              }}>{a}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={addEntry} style={{ ...S.btn, flex: 1, textAlign: "center", padding: "11px" }}>Save Entry</button>
            <button onClick={() => setShowForm(false)} style={{
              flex: 1, background: "transparent", border: "1px solid #2a4a2a",
              color: "#6b9e6b", padding: "11px", borderRadius: 22, fontSize: 12, cursor: "pointer", fontFamily: "inherit"
            }}>Cancel</button>
          </div>
        </div>
      )}

      {journal.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#4a6a4a", fontSize: 13, lineHeight: 1.8 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📓</div>
          Your field journal is empty.<br />Log observations here — they feed<br />directly into your predictions.
        </div>
      )}

      {journal.map(entry => (
        <div key={entry.id} style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: "#4ade80" }}>{entry.date} · {entry.time}</div>
              {entry.weather && <div style={{ fontSize: 10, color: "#4a6a4a", marginTop: 2 }}>{entry.weather}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {entry.accuracy && (
                <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 20,
                  background: entry.accuracy.includes("✓") ? "#14532d" : entry.accuracy.includes("~") ? "#1a1a0a" : "#1a0a0a",
                  color: entry.accuracy.includes("✓") ? "#4ade80" : entry.accuracy.includes("~") ? "#fbbf24" : "#f87171" }}>
                  {entry.accuracy}
                </span>
              )}
              <button onClick={() => deleteEntry(entry.id)} style={{ background: "none", border: "none", color: "#4a6a4a", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          </div>
          {entry.clouds && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 3 }}>☁ {entry.clouds}</div>}
          {entry.signs && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 3 }}>🌿 {entry.signs}</div>}
          {entry.notes && <div style={{ fontSize: 13, color: "#b8d4b0", lineHeight: 1.6, marginTop: 6, fontStyle: "italic" }}>{entry.notes}</div>}
        </div>
      ))}
    </div>
  );
}
