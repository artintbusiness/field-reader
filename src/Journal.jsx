import { useState, useRef } from "react";
import { loadJournal, saveJournal } from "./storage.js";
import { QUICK_SIGNS, OBSERVATION_PROMPTS } from "./data.js";
import { S } from "./styles.js";

export default function Journal({ weather }) {
  const [journal, setJournal] = useState(loadJournal);
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ clouds: "", signs: "", notes: "", accuracy: "" });
  const [quickSigns, setQuickSigns] = useState([]);
  const [dictating, setDictating] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [rawDictation, setRawDictation] = useState("");
  const [activePrompt, setActivePrompt] = useState(null);
  const recognitionRef = useRef(null);

  // Streak calculation
  function calcStreak() {
    if (!journal.length) return 0;
    const dates = [...new Set(journal.map(e => e.date))];
    let streak = 1;
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (!dates.includes(today)) return 0;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = (prev - curr) / (1000 * 60 * 60 * 24);
      if (diff <= 1.5) streak++;
      else break;
    }
    return streak;
  }

  function toggleQuickSign(label) {
    setQuickSigns(prev =>
      prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]
    );
  }

  // Start voice dictation using Web Speech API
  function startDictation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice dictation isn't supported in this browser. Try Safari on iPhone or Chrome on desktop.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    let finalTranscript = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
        else interim += event.results[i][0].transcript;
      }
      setRawDictation(finalTranscript + interim);
    };
    recognition.onend = () => {
      setDictating(false);
      if (finalTranscript.trim()) cleanDictation(finalTranscript.trim());
    };
    recognition.start();
    setDictating(true);
    setRawDictation("");
  }

  function stopDictation() {
    recognitionRef.current?.stop();
    setDictating(false);
  }

  async function cleanDictation(raw) {
    setCleaning(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `A field naturalist just dictated these weather observations out loud. Clean up the transcription and extract structured information. Return ONLY a JSON object with no explanation or markdown:

Raw dictation: "${raw}"

Return this exact JSON structure:
{
  "clouds": "cloud observations only, empty string if none mentioned",
  "signs": "nature signs observed only (animals, plants, smells, etc), empty string if none",
  "notes": "general observations, predictions, or anything else, cleaned up and concise"
}`
          }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setNewEntry(prev => ({
        ...prev,
        clouds: parsed.clouds || prev.clouds,
        signs: parsed.signs || prev.signs,
        notes: parsed.notes || prev.notes,
      }));
    } catch {
      // Fallback — just dump raw into notes
      setNewEntry(prev => ({ ...prev, notes: raw }));
    }
    setCleaning(false);
  }

  function addEntry() {
    const allSigns = [newEntry.signs, ...quickSigns].filter(Boolean).join(", ");
    if (!newEntry.clouds && !newEntry.notes && !allSigns) return;
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      weather: weather ? `${Math.round(weather.temperature_2m)}°F · ${weather.relative_humidity_2m}% RH · ${(weather.surface_pressure * 0.02953).toFixed(2)}" inHg` : "",
      clouds: newEntry.clouds,
      signs: allSigns,
      notes: newEntry.notes,
      accuracy: newEntry.accuracy,
    };
    const updated = [entry, ...journal];
    setJournal(updated);
    saveJournal(updated);
    setNewEntry({ clouds: "", signs: "", notes: "", accuracy: "" });
    setQuickSigns([]);
    setRawDictation("");
    setShowForm(false);
  }

  function deleteEntry(id) {
    const updated = journal.filter(e => e.id !== id);
    setJournal(updated);
    saveJournal(updated);
  }

  const streak = calcStreak();
  const accurate = journal.filter(e => e.accuracy?.includes("✓")).length;
  const rated = journal.filter(e => e.accuracy && !e.accuracy.includes("—")).length;
  const accuracyPct = rated > 0 ? Math.round((accurate / rated) * 100) : null;

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div style={{ ...S.card, textAlign: "center", padding: "12px 8px" }}>
          <div style={{ fontSize: 22, marginBottom: 2 }}>🔥</div>
          <div style={{ fontSize: 18, ...S.display, color: streak > 0 ? "#fbbf24" : "#4a6a4a" }}>{streak}</div>
          <div style={{ fontSize: 10, color: "#6b9e6b" }}>day streak</div>
        </div>
        <div style={{ ...S.card, textAlign: "center", padding: "12px 8px" }}>
          <div style={{ fontSize: 22, marginBottom: 2 }}>📓</div>
          <div style={{ fontSize: 18, ...S.display }}>{journal.length}</div>
          <div style={{ fontSize: 10, color: "#6b9e6b" }}>entries</div>
        </div>
        <div style={{ ...S.card, textAlign: "center", padding: "12px 8px" }}>
          <div style={{ fontSize: 22, marginBottom: 2 }}>🎯</div>
          <div style={{ fontSize: 18, ...S.display, color: accuracyPct >= 70 ? "#4ade80" : accuracyPct !== null ? "#fbbf24" : "#4a6a4a" }}>
            {accuracyPct !== null ? `${accuracyPct}%` : "—"}
          </div>
          <div style={{ fontSize: 10, color: "#6b9e6b" }}>accuracy</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ ...S.label, marginBottom: 0 }}>Field Journal</span>
        <button onClick={() => setShowForm(!showForm)} style={S.btn}>+ Log Entry</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, borderColor: "#2a5a2a", marginBottom: 16 }}>

          {/* Dictation button */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#6b9e6b", marginBottom: 8 }}>🎙 Voice Entry</div>
            <button
              onClick={dictating ? stopDictation : startDictation}
              style={{
                ...S.btn,
                width: "100%", textAlign: "center", padding: "12px",
                background: dictating ? "#4a0a0a" : "#1a4a1a",
                borderColor: dictating ? "#f87171" : "#2a6a2a",
                color: dictating ? "#f87171" : "#4ade80",
              }}>
              {dictating ? "🔴 Tap to stop recording" : "🎙 Tap to dictate observations"}
            </button>
            {dictating && rawDictation && (
              <div style={{ fontSize: 11, color: "#6b9e6b", fontStyle: "italic", marginTop: 8, lineHeight: 1.5 }}>
                "{rawDictation}"
              </div>
            )}
            {cleaning && (
              <div style={{ fontSize: 11, color: "#4ade80", marginTop: 8 }}>✨ AI cleaning up your dictation…</div>
            )}
          </div>

          <div style={{ borderTop: "1px solid #1e3a1e", paddingTop: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#6b9e6b", marginBottom: 8 }}>⚡ Quick Signs</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {QUICK_SIGNS.map(s => (
                <button key={s.label} onClick={() => toggleQuickSign(s.label)} style={{
                  padding: "6px 10px", borderRadius: 20, fontSize: 11,
                  border: "1px solid #2a4a2a", cursor: "pointer", fontFamily: "inherit",
                  background: quickSigns.includes(s.label) ? "#1a4a1a" : "transparent",
                  color: quickSigns.includes(s.label) ? "#4ade80" : "#6b9e6b",
                  transition: "all 0.15s"
                }}>{s.emoji} {s.label}</button>
              ))}
            </div>
          </div>

          {/* Observation prompts */}
          <div style={{ borderTop: "1px solid #1e3a1e", paddingTop: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#6b9e6b", marginBottom: 8 }}>💬 Observation Prompts</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {OBSERVATION_PROMPTS.map(p => (
                <button key={p} onClick={() => {
                  setActivePrompt(p);
                  setNewEntry(prev => ({ ...prev, notes: prev.notes ? `${prev.notes}\n${p}: ` : `${p}: ` }));
                }} style={{
                  padding: "5px 10px", borderRadius: 16, fontSize: 10,
                  border: "1px solid #2a4a2a", cursor: "pointer", fontFamily: "inherit",
                  background: activePrompt === p ? "#1a4a1a" : "transparent",
                  color: activePrompt === p ? "#4ade80" : "#4a6a4a",
                }}>{p}</button>
              ))}
            </div>
          </div>

          {/* Manual fields */}
          <div style={{ borderTop: "1px solid #1e3a1e", paddingTop: 14 }}>
            <div style={{ fontSize: 11, color: "#6b9e6b", marginBottom: 4 }}>Clouds observed</div>
            <input value={newEntry.clouds} onChange={e => setNewEntry({...newEntry, clouds: e.target.value})}
              placeholder="e.g. Cumulus building to the west…" style={S.input} />

            <div style={{ fontSize: 11, color: "#6b9e6b", marginBottom: 4 }}>Nature signs</div>
            <input value={newEntry.signs} onChange={e => setNewEntry({...newEntry, signs: e.target.value})}
              placeholder="e.g. Swallows flying low, leaves flipping…" style={S.input} />

            <div style={{ fontSize: 11, color: "#6b9e6b", marginBottom: 4 }}>Notes</div>
            <textarea value={newEntry.notes} onChange={e => setNewEntry({...newEntry, notes: e.target.value})}
              placeholder="Observations, predictions, what happened…" rows={3}
              style={{ ...S.input, resize: "vertical" }} />
          </div>

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
            <button onClick={() => { setShowForm(false); setQuickSigns([]); setRawDictation(""); }} style={{
              flex: 1, background: "transparent", border: "1px solid #2a4a2a",
              color: "#6b9e6b", padding: "11px", borderRadius: 22, fontSize: 12, cursor: "pointer", fontFamily: "inherit"
            }}>Cancel</button>
          </div>
        </div>
      )}

      {journal.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#4a6a4a", fontSize: 13, lineHeight: 1.8 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📓</div>
          Your field journal is empty.<br />Dictate or type your first observation.<br />Entries feed directly into predictions.
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
