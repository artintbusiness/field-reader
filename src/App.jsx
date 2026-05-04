import { useState, useEffect, useRef, useCallback } from "react";

const APP_VERSION = "3.0.1";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:         "#F2F2F7",
  surface:    "#FFFFFF",
  accent:     "#2D6A4F",
  accentDim:  "#EAF4EE",
  accentMid:  "#40916C",
  text:       "#1C1C1E",
  textMid:    "#6C6C70",
  textDim:    "#AEAEB2",
  sep:        "#E5E5EA",
  danger:     "#FF3B30",
  warn:       "#FF9500",
  info:       "#007AFF",
  good:       "#34C759",
};
const F = {
  display: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif",
  body:    "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif",
  num:     "-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif",
};
const shadow   = "0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04)";
const shadowMd = "0 4px 12px rgba(0,0,0,0.10),0 2px 4px rgba(0,0,0,0.06)";

const css = {
  card:   { background: C.surface, borderRadius: 16, padding: "16px 18px", marginBottom: 10, boxShadow: shadow },
  label:  { fontSize: 11, letterSpacing: 0.5, color: C.textMid, textTransform: "uppercase", fontWeight: "600", marginBottom: 8, display: "block", fontFamily: F.body },
  input:  { width: "100%", background: C.bg, border: "none", borderRadius: 12, padding: "13px 15px", color: C.text, fontSize: 15, marginBottom: 10, fontFamily: F.body, outline: "none", boxSizing: "border-box" },
  btn:    { background: C.accent, border: "none", color: "#fff", padding: "11px 22px", borderRadius: 980, fontSize: 15, fontWeight: "600", cursor: "pointer", fontFamily: F.body },
  btnSoft:{ background: C.accentDim, border: "none", color: C.accent, padding: "9px 18px", borderRadius: 980, fontSize: 14, fontWeight: "600", cursor: "pointer", fontFamily: F.body },
  tag:    (color) => ({ fontSize: 12, padding: "4px 10px", borderRadius: 980, background: `${color}18`, color, fontWeight: "600", fontFamily: F.body }),
  row:    { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 13, paddingBottom: 13, borderBottom: `1px solid ${C.sep}` },
  section:{ background: C.surface, borderRadius: 16, overflow: "hidden", marginBottom: 10, boxShadow: shadow },
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────
function loadLS(k, def) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } }
function saveLS(k, v)   { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function hpa2hg(hpa)    { return (hpa * 0.02953).toFixed(2); }
function capFirst(s)    { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function windLabel(deg) {
  const d = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return d[Math.round(deg / 22.5) % 16];
}
function getSeason(m)   { if (m<=1||m===11) return "Winter"; if (m<=4) return "Spring"; if (m<=7) return "Summer"; return "Autumn"; }
function getDateContext() {
  const now = new Date(), m = now.getMonth();
  return { date: now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}), time: now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}), season: getSeason(m), month: m };
}

// ─── WEATHER LOGIC ────────────────────────────────────────────────────────────
function soilEst(airF, month) {
  const off = [0,2,5,10,15,18,20,19,15,8,3,0];
  return Math.round(45 + (airF - 50) * 0.55 + (off[month]||0) * 0.4);
}
function pressureTrend(history) {
  if (history.length < 3) return { trend:"stable", delta:0, label:"Stable" };
  const r = history.slice(-12);
  const d = (r[r.length-1]?.pressure||0) - (r[0]?.pressure||0);
  const dHg = d * 0.02953;
  if (d < -3) return { trend:"falling_fast", delta:d, label:`Falling fast (${dHg.toFixed(2)}")` };
  if (d < -1) return { trend:"falling",      delta:d, label:`Falling (${dHg.toFixed(2)}")` };
  if (d >  3) return { trend:"rising_fast",  delta:d, label:`Rising fast (+${dHg.toFixed(2)}")` };
  if (d >  1) return { trend:"rising",       delta:d, label:`Rising (+${dHg.toFixed(2)}")` };
  return { trend:"stable", delta:d, label:"Stable" };
}
function windShift(history) {
  if (history.length < 4) return null;
  const recent = history.slice(-8); // last ~2hrs of readings
  const oldest = recent[0]?.windDir;
  const newest = recent[recent.length-1]?.windDir;
  if (!oldest || !newest) return null;
  // Convert cardinal labels back to degrees for comparison
  const cardToDeg = {"N":0,"NNE":22.5,"NE":45,"ENE":67.5,"E":90,"ESE":112.5,"SE":135,"SSE":157.5,"S":180,"SSW":202.5,"SW":225,"WSW":247.5,"W":270,"WNW":292.5,"NW":315,"NNW":337.5};
  const d1 = cardToDeg[oldest], d2 = cardToDeg[newest];
  if (d1 == null || d2 == null) return null;
  // Calculate shortest angular difference
  let diff = d2 - d1;
  if (diff > 180)  diff -= 360;
  if (diff < -180) diff += 360;
  if (Math.abs(diff) < 45) return null;
  // Veering = clockwise (positive), Backing = counter-clockwise (negative)
  const type = diff > 0 ? "veering" : "backing";
  return {
    type,
    from: oldest,
    to:   newest,
    deg:  Math.abs(Math.round(diff)),
    label: type === "veering"
      ? `Wind veering ${oldest}→${newest} (${Math.abs(Math.round(diff))}°) — often signals improving conditions`
      : `Wind backing ${oldest}→${newest} (${Math.abs(Math.round(diff))}°) — can precede deteriorating weather`,
    color: type === "veering" ? C.good : C.warn,
  };
}
function frostRisk(tempF, hum, wind) {
  const rad = wind < 5 && hum < 70;
  if (tempF <= 28)             return { level:"danger",  label:"Hard Frost",     color: C.danger, desc:"Protect all plants immediately." };
  if (tempF <= 32)             return { level:"danger",  label:"Frost",          color: "#fb923c", desc:"Cover vulnerable plants, bring in containers." };
  if (tempF <= 36 && rad)      return { level:"caution", label:"Frost Possible", color: C.warn,   desc:"Clear and calm — radiative cooling may reach 32F at ground level." };
  if (tempF <= 40)             return { level:"watch",   label:"Frost Watch",    color: C.warn,   desc:"Keep frost cloth accessible." };
  return { level:"safe", label:"No Frost Risk", color: C.good, desc:"Well above frost threshold." };
}
function wateringAdv(wx, hist, offset=0) {
  // PWS rain24h is the daily gauge total — authoritative when present.
  // For grid/fallback, sum hourly precip snapshots from history.
  const rain     = wx.source==="pws"
    ? (wx.rain24h||0)
    : hist.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const rainSrc  = wx.source==="pws" ? "PWS gauge" : "station history";
  const hum      = Math.max(0, Math.min(100, wx.relative_humidity_2m - offset));
  const tmp      = wx.temperature_2m;
  if (rain > 0.5) return { action:"skip",  label:"Skip watering",  color:C.good,    emoji:"💧", desc:`${rain.toFixed(2)}" of rain recently (${rainSrc}). Soil should still have moisture.` };
  if (hum > 80 && tmp < 85) return { action:"skip",  label:"Probably skip",  color:"#86efac", emoji:"🌿", desc:"High humidity (" + Math.round(hum) + "%) — finger-test first." };
  if (tmp > 85)              return { action:"water", label:"Water today",    color:C.warn,    emoji:"🚿", desc:"Hot conditions — water deeply, early morning." };
  if (tmp < 55 && hum > 60) return { action:"skip",  label:"Hold off",       color:C.good,    emoji:"🌡️", desc:"Cool and humid. Check manually." };
  return { action:"check", label:"Check soil", color:C.textMid, emoji:"👆", desc:"If top 2 inches dry, water. If moist, wait." };
}
function fungalRisk(wx, hist, offset=0) {
  const rain = hist.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const hum  = Math.max(0, Math.min(100, wx.relative_humidity_2m - offset));
  const tmp  = wx.temperature_2m;
  const wet  = hist.slice(-96).filter(s=>s.precipitation>0.01).length;
  if (hum>80 && tmp>60 && tmp<85 && (rain>0.25||wet>6)) return { level:"high",     label:"High Fungal Risk",   color:C.danger, desc:"Warm + wet + humid. Inspect plants, consider copper or sulfur treatment." };
  if (hum>70 && tmp>55 && rain>0.1)                     return { level:"moderate", label:"Moderate Risk",      color:C.warn,   desc:"Conditions favour fungal development. Improve air circulation." };
  return { level:"low", label:"Low Risk", color:C.good, desc:"Conditions not favourable for fungal disease." };
}

// ─── IMAGE RESIZE ─────────────────────────────────────────────────────────────
async function resizeImage(file, maxDim=1024) {
  return new Promise(resolve => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82).split(",")[1]);
    };
    img.src = url;
  });
}

// ─── CLAUDE API ───────────────────────────────────────────────────────────────
async function claudeJSON(prompt, maxTokens=400) {
  const key = localStorage.getItem("pl_anthropic_key")||"";
  if (!key) throw new Error("No Anthropic API key — add it in Settings.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "x-api-key": key,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role:"user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  const text = data.content?.find(b=>b.type==="text")?.text || "";
  // Strip any markdown fences robustly
  return text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"").trim();
}

async function claudeText(prompt, maxTokens=600) {
  const key = localStorage.getItem("pl_anthropic_key")||"";
  if (!key) throw new Error("No Anthropic API key — add it in Settings.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "x-api-key": key,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role:"user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.content?.find(b=>b.type==="text")?.text || "";
}

async function claudeVision(b64, prompt, maxTokens=800) {
  const key = localStorage.getItem("pl_anthropic_key")||"";
  if (!key) throw new Error("No Anthropic API key — add it in Settings.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "x-api-key": key,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{
        role: "user",
        content: [
          { type:"image", source:{ type:"base64", media_type:"image/jpeg", data:b64 } },
          { type:"text",  text: prompt },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.content?.find(b=>b.type==="text")?.text || "";
}

// ─── SPARK CHART ──────────────────────────────────────────────────────────────
function Spark({ data, color, h=36 }) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx-mn||1;
  const w  = 100/(data.length-1);
  const pts = data.map((v,i)=>`${i*w},${h-((v-mn)/rng)*(h-6)-3}`).join(" ");
  const lv = data[data.length-1], lx=100, ly=h-((lv-mn)/rng)*(h-6)-3;
  const id = "g"+color.replace("#","");
  return (
    <svg viewBox={`0 0 100 ${h}`} style={{width:"100%",height:h,display:"block"}} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.15"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} 100,${h}`} fill={`url(#${id})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={lx} cy={ly} r="2.5" fill={color}/>
    </svg>
  );
}

// ─── INFO BUTTON ──────────────────────────────────────────────────────────────
function InfoButton({ text }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{position:"relative",display:"inline-block"}}>
      <button onClick={e=>{e.stopPropagation();setShow(s=>!s);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.textDim,padding:"2px 4px",lineHeight:1,borderRadius:"50%"}} aria-label="Info">ⓘ</button>
      {show && (
        <>
          <div onClick={()=>setShow(false)} style={{position:"fixed",inset:0,zIndex:998}}/>
          <div style={{position:"fixed",right:16,bottom:100,zIndex:999,background:C.surface,border:`1px solid ${C.sep}`,borderRadius:14,padding:"14px 16px",width:260,boxShadow:"0 8px 32px rgba(0,0,0,0.18)"}}>
            <p style={{fontSize:14,color:C.textMid,lineHeight:1.6,fontFamily:F.body,margin:0}}>{text}</p>
            <button onClick={()=>setShow(false)} style={{marginTop:10,background:"none",border:"none",color:C.accent,fontFamily:F.body,fontSize:13,cursor:"pointer",padding:0,fontWeight:"600"}}>Got it</button>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── DICTATION ENGINE ─────────────────────────────────────────────────────────
// Self-contained hook. Handles: recording → raw transcript → AI parse → fields
// Returns state + controls so any form can use it.
// ══════════════════════════════════════════════════════════════════════════════
function useDictation({ onParsed, plantNames = [] }) {
  const [phase, setPhase]     = useState("idle");   // idle | recording | parsing | done | error
  const [rawText, setRawText] = useState("");
  const [error, setError]     = useState("");
  const recRef = useRef(null);
  const finalRef = useRef("");

  const isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  function start() {
    if (!isSupported) { setError("Voice not supported — try Chrome or Safari."); setPhase("error"); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r  = new SR();
    r.continuous      = true;
    r.interimResults  = true;
    r.lang            = "en-US";
    recRef.current    = r;
    finalRef.current  = "";
    setRawText("");
    setError("");
    setPhase("recording");

    r.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalRef.current += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      setRawText(finalRef.current + interim);
    };

    r.onerror = ev => {
      setError("Mic error: " + ev.error);
      setPhase("error");
    };

    r.onend = () => {
      const text = finalRef.current.trim();
      if (!text) { setPhase("idle"); return; }
      setRawText(text);
      parse(text);
    };

    r.start();
  }

  function stop() {
    recRef.current?.stop();
  }

  async function parse(raw) {
    setPhase("parsing");
    const key = localStorage.getItem("pl_anthropic_key")||"";
    if (!key) {
      // No key — just dump raw text into notes, still useful
      onParsed({ notes: capFirst(raw), clouds: "", signs: "", detectedPlants: [] });
      setPhase("done");
      return;
    }

    const plantCtx = plantNames.length
      ? `Known plants in the garden: ${plantNames.join(", ")}.`
      : "No plants registered yet.";

    const prompt = `You are parsing a garden observation dictated by voice. Extract structured fields from the raw text.

${plantCtx}

Return ONLY a raw JSON object — no markdown, no backticks, no explanation. Schema:
{
  "notes":           "main cleaned-up observation text",
  "clouds":          "cloud or sky observations only, or empty string",
  "signs":           "nature signs (birds, insects, smells, sounds) only, or empty string",
  "detectedPlants":  ["array of plant names mentioned that match the known plant list, or new ones detected"],
  "newPlant":        "name of a new plant mentioned that is NOT in the known list, or null"
}

Rules:
- notes should be clean, complete, first-person. Fix grammar/filler words.
- Split cloud and nature-sign observations into their own fields only if clearly distinct.
- detectedPlants: match against known plants case-insensitively. Include partials (e.g. "fig" matches "Fig Tree").
- newPlant: only if a clear plant name is mentioned that does NOT appear in the known list.
- Do not invent content not present in the raw text.

Raw dictation: "${raw}"`;

    try {
      const jsonStr = await claudeJSON(prompt, 500);
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // If JSON parse fails, fall back gracefully
        onParsed({ notes: capFirst(raw), clouds: "", signs: "", detectedPlants: [], newPlant: null });
        setPhase("done");
        return;
      }
      onParsed({
        notes:          capFirst(parsed.notes          || raw),
        clouds:         parsed.clouds                  || "",
        signs:          parsed.signs                   || "",
        detectedPlants: Array.isArray(parsed.detectedPlants) ? parsed.detectedPlants : [],
        newPlant:       parsed.newPlant                || null,
      });
      setPhase("done");
    } catch (err) {
      // API error — degrade gracefully, still deliver raw text
      onParsed({ notes: capFirst(raw), clouds: "", signs: "", detectedPlants: [], newPlant: null });
      setError("AI parse failed — raw text saved. " + err.message);
      setPhase("error");
    }
  }

  function reset() { setPhase("idle"); setRawText(""); setError(""); }

  return { phase, rawText, error, isSupported, start, stop, reset };
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── JOURNAL ENTRY FORM ───────────────────────────────────────────────────────
// Reusable form used both inside PlantJournal and GeneralJournal.
// plantContext: { plant } or null for general entries.
// onSave(entry) fires with the fully constructed entry object.
// ══════════════════════════════════════════════════════════════════════════════
const QUICK_SIGNS = [
  {l:"Birds low",e:"🐦"},{l:"Leaves flipping",e:"🍃"},{l:"Earthy smell",e:"💧"},
  {l:"Clouds building",e:"⛅"},{l:"Heavy dew",e:"🌿"},{l:"Red sunrise",e:"🌅"},
  {l:"Red sunset",e:"🌇"},{l:"Insects active",e:"🐝"},
];

function JournalEntryForm({ weather, plantContext, allPlants, onSave, onCancel, onNewPlantDetected }) {
  const [fields, setFields]     = useState({ notes:"", clouds:"", signs:"" });
  const [qSigns, setQSigns]     = useState([]);
  const [photo, setPhoto]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving]     = useState(false);
  const photoRef = useRef();

  const plantNames = allPlants.map(p=>p.name);

  const dictation = useDictation({
    plantNames,
    onParsed: (parsed) => {
      setFields(f => ({
        notes:  parsed.notes  || f.notes,
        clouds: parsed.clouds || f.clouds,
        signs:  parsed.signs  || f.signs,
      }));
      // Surface new plant detection to parent
      if (parsed.newPlant && onNewPlantDetected) {
        onNewPlantDetected(parsed.newPlant, parsed);
      }
      // If a known plant is mentioned but we're in general journal, bubble up
      if (!plantContext && parsed.detectedPlants?.length && onNewPlantDetected) {
        onNewPlantDetected(null, parsed);
      }
    },
  });

  async function handlePhoto(file) {
    if (!file) return;
    const b64 = await resizeImage(file, 800);
    setPhoto("data:image/jpeg;base64,"+b64);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function buildEntry() {
    const allSigns = [fields.signs, ...qSigns].filter(Boolean).join(", ");
    return {
      id:      Date.now(),
      date:    new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),
      time:    new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),
      weather: weather
        ? `${Math.round(weather.temperature_2m)}F  ${weather.relative_humidity_2m}% RH  ${hpa2hg(weather.surface_pressure)}" ${windLabel(weather.wind_direction_10m)} ${Math.round(weather.wind_speed_10m)}mph${weather.source==="pws"?"  PWS":""}`
        : "",
      notes:   capFirst(fields.notes),
      note:    capFirst(fields.notes),  // alias for compatibility
      clouds:  fields.clouds,
      signs:   allSigns,
      photo:   photo,
    };
  }

  function canSave() {
    return fields.notes.trim() || fields.clouds.trim() || fields.signs.trim() || qSigns.length || photo;
  }

  function save() {
    if (!canSave()) return;
    setSaving(true);
    const entry = buildEntry();
    onSave(entry);
    setSaving(false);
  }

  const dictPhaseLabel = {
    idle:     "🎙 Dictate note",
    recording:"🔴 Stop recording",
    parsing:  "✨ Understanding...",
    done:     "🎙 Dictate again",
    error:    "🎙 Try again",
  };

  return (
    <div style={{...css.card, borderColor:`${C.accent}44`, marginBottom:16}}>

      {/* ── Dictation ── */}
      <div style={{marginBottom:14}}>
        <span style={css.label}>Voice Entry</span>
        {!dictation.isSupported && (
          <div style={{fontSize:13,color:C.warn,fontFamily:F.body,marginBottom:8}}>Voice not supported in this browser. Use Chrome or Safari.</div>
        )}
        <button
          onClick={dictation.phase==="recording" ? dictation.stop : dictation.start}
          disabled={dictation.phase==="parsing"}
          style={{
            ...css.btn, width:"100%", textAlign:"center", padding:"12px",
            background: dictation.phase==="recording" ? "#FFF0F0" : dictation.phase==="parsing" ? C.accentDim : C.accentDim,
            color:       dictation.phase==="recording" ? C.danger  : dictation.phase==="parsing" ? C.accentMid : C.accent,
            border:      dictation.phase==="recording" ? `1px solid ${C.danger}` : "none",
            opacity:     dictation.phase==="parsing" ? 0.7 : 1,
            fontSize: 14,
          }}
        >
          {dictPhaseLabel[dictation.phase] || "🎙 Dictate note"}
        </button>

        {/* Live transcript */}
        {(dictation.phase==="recording" || dictation.phase==="parsing") && dictation.rawText && (
          <div style={{fontSize:13,color:C.textMid,fontStyle:"italic",marginTop:8,lineHeight:1.5,fontFamily:F.body,padding:"8px 12px",background:C.bg,borderRadius:10}}>
            "{dictation.rawText}"
          </div>
        )}

        {/* Error (non-blocking) */}
        {dictation.phase==="error" && dictation.error && (
          <div style={{fontSize:12,color:C.warn,marginTop:6,fontFamily:F.body,padding:"6px 10px",background:"#FFF9F0",borderRadius:8}}>
            ⚠ {dictation.error}
          </div>
        )}

        {/* Parsed confirmation */}
        {dictation.phase==="done" && (
          <div style={{fontSize:12,color:C.accent,marginTop:6,fontFamily:F.body,padding:"6px 10px",background:C.accentDim,borderRadius:8}}>
            ✓ Note filled in below — review and save
          </div>
        )}
      </div>

      {/* ── Photo ── */}
      <div style={{borderTop:`1px solid ${C.sep}`,paddingTop:14,marginBottom:14}}>
        <span style={css.label}>Photo</span>
        {photoPreview
          ? <div style={{position:"relative",marginBottom:8}}>
              <img src={photoPreview} style={{width:"100%",borderRadius:10,maxHeight:200,objectFit:"cover",display:"block"}}/>
              <button onClick={()=>{setPhoto(null);setPhotoPreview(null);}} style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.7)",border:"none",color:"#fff",borderRadius:"50%",width:24,height:24,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>
          : <div onClick={()=>photoRef.current?.click()} style={{border:`2px dashed ${C.sep}`,borderRadius:10,padding:"16px",textAlign:"center",cursor:"pointer",background:C.bg,marginBottom:8}}>
              <div style={{fontSize:20,marginBottom:4}}>📷</div>
              <div style={{fontSize:12,color:C.textMid,fontFamily:F.body}}>Tap to add photo</div>
            </div>
        }
        <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>handlePhoto(e.target.files?.[0])}/>
      </div>

      {/* ── Quick Signs ── */}
      <div style={{borderTop:`1px solid ${C.sep}`,paddingTop:14,marginBottom:14}}>
        <span style={css.label}>Quick Signs</span>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {QUICK_SIGNS.map(s=>(
            <button key={s.l} onClick={()=>setQSigns(p=>p.includes(s.l)?p.filter(x=>x!==s.l):[...p,s.l])} style={{padding:"5px 10px",borderRadius:18,fontSize:12,border:`1px solid ${qSigns.includes(s.l)?C.accent:C.sep}`,cursor:"pointer",fontFamily:F.body,background:qSigns.includes(s.l)?C.accentDim:"transparent",color:qSigns.includes(s.l)?C.accent:C.textMid}}>
              {s.e} {s.l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Text Fields ── */}
      <div style={{borderTop:`1px solid ${C.sep}`,paddingTop:14}}>
        <div style={{fontSize:12,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Clouds / Sky</div>
        <input value={fields.clouds} onChange={e=>setFields(f=>({...f,clouds:e.target.value}))} placeholder="e.g. Cumulus building to the west..." style={css.input}/>
        <div style={{fontSize:12,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Nature Signs</div>
        <input value={fields.signs} onChange={e=>setFields(f=>({...f,signs:e.target.value}))} placeholder="e.g. Robins active, earthy smell after rain..." style={css.input}/>
        <div style={{fontSize:12,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Observations</div>
        <textarea value={fields.notes} onChange={e=>setFields(f=>({...f,notes:e.target.value}))} placeholder={plantContext ? `Notes about ${plantContext.plant.name}...` : "What did you observe, do, or notice?"} rows={4} style={{...css.input, resize:"vertical"}}/>
      </div>

      <div style={{display:"flex",gap:10,marginTop:4}}>
        <button onClick={save} disabled={!canSave()||saving} style={{...css.btn,flex:1,textAlign:"center",padding:"13px",opacity:canSave()&&!saving?1:0.4}}>
          {saving ? "Saving..." : "Save Entry"}
        </button>
        <button onClick={onCancel} style={{flex:1,background:"transparent",border:`1px solid ${C.sep}`,color:C.textMid,padding:"13px",borderRadius:24,fontSize:14,cursor:"pointer",fontFamily:F.body}}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── ENTRY CARD ───────────────────────────────────────────────────────────────
function EntryCard({ entry: e, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState({ notes: e.notes||"", clouds: e.clouds||"", signs: e.signs||"" });

  if (editing) {
    return (
      <div style={{...css.card, borderColor:`${C.accent}44`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:12,color:C.accent,fontFamily:F.body,fontWeight:"600"}}>{e.date} — {e.time}</div>
          <button onClick={()=>setEditing(false)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:16}}>Cancel</button>
        </div>
        {e.photo && <img src={e.photo} style={{width:"100%",borderRadius:10,marginBottom:10,maxHeight:160,objectFit:"cover"}}/>}
        <div style={{fontSize:12,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Clouds</div>
        <input value={draft.clouds} onChange={ev=>setDraft(d=>({...d,clouds:ev.target.value}))} style={css.input}/>
        <div style={{fontSize:12,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Signs</div>
        <input value={draft.signs} onChange={ev=>setDraft(d=>({...d,signs:ev.target.value}))} style={css.input}/>
        <div style={{fontSize:12,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Notes</div>
        <textarea value={draft.notes} onChange={ev=>setDraft(d=>({...d,notes:ev.target.value}))} rows={4} style={{...css.input,resize:"vertical"}}/>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{ onUpdate({...e,...draft,note:draft.notes}); setEditing(false); }} style={{...css.btn,flex:1,textAlign:"center",padding:"11px"}}>Save</button>
          <button onClick={onDelete} style={{flex:1,background:"transparent",border:`1px solid ${C.danger}22`,color:C.danger,padding:"11px",borderRadius:24,fontSize:14,cursor:"pointer",fontFamily:F.body}}>Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div style={css.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:C.accent,fontFamily:F.body,fontWeight:"600"}}>{[e.date,e.time].filter(Boolean).join(" · ")}</div>
          {e.weather && <div style={{fontSize:11,color:C.textDim,marginTop:2,fontFamily:F.body,lineHeight:1.4}}>{e.weather}</div>}
        </div>
        <div style={{display:"flex",gap:4,marginLeft:8}}>
          <button onClick={()=>setEditing(true)} style={{background:"none",border:`1px solid ${C.sep}`,color:C.textMid,cursor:"pointer",fontSize:12,borderRadius:8,padding:"3px 8px",fontFamily:F.body}}>Edit</button>
          <button onClick={onDelete} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
        </div>
      </div>
      {e.photo   && <img src={e.photo} style={{width:"100%",borderRadius:10,marginBottom:8,maxHeight:200,objectFit:"cover"}}/>}
      {e.clouds  && <div style={{fontSize:13,color:C.textMid,marginBottom:2,fontFamily:F.body}}>☁ {e.clouds}</div>}
      {e.signs   && <div style={{fontSize:13,color:C.textMid,marginBottom:2,fontFamily:F.body}}>🌿 {e.signs}</div>}
      {e.notes   && <div style={{fontSize:14,color:C.text,lineHeight:1.6,marginTop:4,fontFamily:F.body}}>{e.notes}</div>}
    </div>
  );
}

// ─── PLANT JOURNAL SHEET ──────────────────────────────────────────────────────
function PlantJournalSheet({ plant, allPlants, weather, onClose, onNewPlantDetected }) {
  const key = "pl_pjournal_" + plant.id;
  const [entries, setEntries] = useState(()=>loadLS(key,[]));
  const [showForm, setShowForm] = useState(false);

  function saveEntry(entry) {
    const u = [entry, ...entries];
    setEntries(u);
    saveLS(key, u);
    // Also mirror to global journal
    const global = loadLS("pl_journal",[]);
    saveLS("pl_journal", [{ ...entry, plantId: plant.id, plantName: plant.name }, ...global]);
    setShowForm(false);
  }

  function deleteEntry(id) {
    const u = entries.filter(e=>e.id!==id);
    setEntries(u);
    saveLS(key, u);
  }

  function updateEntry(updated) {
    const u = entries.map(e=>e.id===updated.id?updated:e);
    setEntries(u);
    saveLS(key, u);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"#00000066",zIndex:500,display:"flex",alignItems:"flex-end"}}>
      <div style={{width:"100%",maxWidth:480,margin:"0 auto",background:C.surface,borderRadius:"20px 20px 0 0",height:"88vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"20px 20px 12px",borderBottom:`1px solid ${C.sep}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:17,color:C.text,fontFamily:F.display,fontWeight:"600"}}>{plant.emoji} {plant.name}</div>
              <div style={{fontSize:13,color:C.textMid,fontFamily:F.body,marginTop:2}}>{plant.location}{plant.planted?" — planted "+plant.planted:""}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={()=>setShowForm(o=>!o)} style={{...css.btn,padding:"7px 14px",fontSize:13}}>+ Note</button>
              <button onClick={onClose} style={{background:"none",border:"none",color:C.textMid,fontSize:22,cursor:"pointer"}}>×</button>
            </div>
          </div>
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"16px 20px",paddingBottom:"env(safe-area-inset-bottom,24px)"}}>
          {showForm && (
            <JournalEntryForm
              weather={weather}
              plantContext={{ plant }}
              allPlants={allPlants}
              onSave={saveEntry}
              onCancel={()=>setShowForm(false)}
              onNewPlantDetected={onNewPlantDetected}
            />
          )}

          {entries.length===0 && !showForm && (
            <div style={{textAlign:"center",padding:"32px 16px",color:C.textDim,fontSize:14,fontFamily:F.body,lineHeight:1.8}}>
              <div style={{fontSize:32,marginBottom:8}}>{plant.emoji}</div>
              No entries yet. Tap + Note to start.
            </div>
          )}

          {entries.map(e=>(
            <EntryCard key={e.id} entry={e} onDelete={()=>deleteEntry(e.id)} onUpdate={updateEntry}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── NEW PLANT CONFIRM MODAL ──────────────────────────────────────────────────
function NewPlantConfirm({ name, parsedEntry, onConfirm, onSkip }) {
  const today = new Date().toISOString().split("T")[0];
  const [plantName, setPlantName] = useState(capFirst(name||""));
  const [location,  setLocation]  = useState("garden");

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px"}}>
      <div style={{background:C.surface,borderRadius:20,padding:24,maxWidth:320,width:"100%",boxShadow:shadowMd}}>
        <div style={{fontSize:28,textAlign:"center",marginBottom:8}}>🌱</div>
        <div style={{fontSize:16,fontWeight:"700",color:C.text,fontFamily:F.body,marginBottom:6,textAlign:"center"}}>New Plant Detected</div>
        <div style={{fontSize:14,color:C.textMid,fontFamily:F.body,lineHeight:1.6,marginBottom:16,textAlign:"center"}}>
          Your note mentions a plant not in your list. Add it?
        </div>
        <input value={plantName} onChange={e=>setPlantName(e.target.value)} style={{...css.input}} placeholder="Plant name..."/>
        <input value={location}  onChange={e=>setLocation(e.target.value)}  style={{...css.input,marginBottom:16}} placeholder="Location (e.g. south bed, patio)..."/>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>onConfirm({ name:plantName, location, planted:today })} style={{...css.btn,flex:1,textAlign:"center",padding:"11px"}}>Add Plant</button>
          <button onClick={onSkip} style={{flex:1,background:"transparent",border:`1px solid ${C.sep}`,color:C.textMid,padding:"11px",borderRadius:24,fontSize:14,cursor:"pointer",fontFamily:F.body}}>Skip</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── TAB: GARDEN ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const PLANT_PRESETS = [
  {name:"Fig Tree",emoji:"🌳"},{name:"Meyer Lemon",emoji:"🍋"},{name:"Tomato",emoji:"🍅"},
  {name:"Pepper",emoji:"🫑"},{name:"Eggplant",emoji:"🍆"},{name:"Brussels Sprouts",emoji:"🥦"},
  {name:"Lettuce",emoji:"🥬"},{name:"Herbs",emoji:"🌿"},{name:"Onion",emoji:"🧅"},
  {name:"Cucumber",emoji:"🥒"},{name:"Zucchini",emoji:"🥬"},{name:"Strawberry",emoji:"🍓"},
  {name:"Blueberry",emoji:"🫐"},{name:"Mushrooms",emoji:"🍄"},{name:"Broccoli",emoji:"🥦"},
  {name:"Peas",emoji:"🫛"},
];
const SEED_TEMPS = {
  "Tomatoes":{min:60,opt:75},"Peppers":{min:65,opt:80},"Eggplant":{min:65,opt:80},
  "Brussels Sprouts":{min:45,opt:65},"Lettuce":{min:35,opt:60},"Beans":{min:60,opt:75},
  "Cucumber":{min:60,opt:75},"Carrots":{min:45,opt:65},
};

function Garden({ weather, history, tempOffset=0 }) {
  const [plants,       setPlants]       = useState(()=>loadLS("pl_plants",[]));
  const [showAdd,      setShowAdd]      = useState(false);
  const [np,           setNp]           = useState({name:"",emoji:"🌱",location:"garden bed",planted:""});
  const [offset,       setOffset]       = useState(()=>parseFloat(localStorage.getItem("pl_hum_off")||"0"));
  const [journalPlant, setJournalPlant] = useState(null);
  const [advice,       setAdvice]       = useState("");
  const [advLoad,      setAdvLoad]      = useState(false);
  const [showGenJournal, setShowGenJournal] = useState(false);
  const [genJournal,   setGenJournal]   = useState(()=>loadLS("pl_journal",[]));
  const [showAllGenJournal, setShowAllGenJournal] = useState(false);
  const [newPlantPending, setNewPlantPending] = useState(null); // {name, entry}
  const [photoMode,    setPhotoMode]    = useState("disease");
  const [photoB64,     setPhotoB64]     = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoResult,  setPhotoResult]  = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [showPhoto,    setShowPhoto]    = useState(false);
  const photoRef = useRef();

  const month   = new Date().getMonth();
  const adjTemp = weather != null ? weather.temperature_2m + tempOffset : null;
  const soil    = adjTemp != null ? soilEst(adjTemp, month) : null;
  const frost   = adjTemp != null ? frostRisk(adjTemp, weather.relative_humidity_2m, weather.wind_speed_10m) : null;
  const water   = adjTemp != null ? wateringAdv({...weather, temperature_2m: adjTemp}, history, offset) : null;
  const fung    = adjTemp != null ? fungalRisk({...weather, temperature_2m: adjTemp}, history, offset) : null;
  // For PWS: use the gauge directly. For grid: sum hourly precip from history.
  const rain24  = weather?.source==="pws"
    ? (weather.rain24h||0)
    : history.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const adjHum  = weather ? Math.max(0,Math.min(100,weather.relative_humidity_2m-offset)) : 0;

  function addPlant() {
    if (!np.name) return;
    const p = { ...np, name: capFirst(np.name), id: Date.now() };
    const u = [...plants, p]; setPlants(u); saveLS("pl_plants",u);
    setNp({name:"",emoji:"🌱",location:"garden bed",planted:""}); setShowAdd(false);
  }
  function removePlant(id) { const u=plants.filter(p=>p.id!==id); setPlants(u); saveLS("pl_plants",u); }

  // Called from both PlantJournalSheet and GeneralJournal form
  function handleNewPlantDetected(name, parsedEntry) {
    if (!name) return; // known plants detected but no new one
    setNewPlantPending({ name, parsedEntry });
  }

  function confirmNewPlant(details) {
    const newPlant = { id:Date.now(), emoji:"🌱", ...details, name: capFirst(details.name) };
    const u = [...plants, newPlant]; setPlants(u); saveLS("pl_plants",u);
    // File the pending entry into this plant's journal
    if (newPlantPending?.parsedEntry) {
      const jkey = "pl_pjournal_"+newPlant.id;
      saveLS(jkey, [newPlantPending.parsedEntry]);
    }
    setNewPlantPending(null);
  }

  // Route an entry to all detected known plants
  function routeEntryToPlants(entry, detectedPlantNames) {
    if (!detectedPlantNames?.length) return;
    detectedPlantNames.forEach(name => {
      const plant = plants.find(p=>p.name.toLowerCase()===name.toLowerCase() || name.toLowerCase().includes(p.name.toLowerCase().split(" ")[0]));
      if (plant) {
        const jkey = "pl_pjournal_"+plant.id;
        const existing = loadLS(jkey,[]);
        saveLS(jkey, [entry, ...existing]);
      }
    });
  }

  // General journal entry save — also routes to detected plants
  function saveGeneralEntry(entry) {
    const global = loadLS("pl_journal",[]);
    const updated = [entry, ...global];
    saveLS("pl_journal", updated);
    setGenJournal(updated);
    setShowGenJournal(false);
    // Route to any detected plants via dictation
    if (entry._detectedPlants?.length) {
      routeEntryToPlants(entry, entry._detectedPlants);
    }
  }

  function buildJournalContext() {
    return plants.map(p => {
      const entries = loadLS("pl_pjournal_"+p.id,[]).slice(0,5);
      if (!entries.length) return `${p.name} (${p.location}): no entries yet`;
      return `${p.name} (${p.location}): ` + entries.map(e=>`${e.date}: ${e.notes||e.note||"(photo)"}`).join("; ");
    }).join("\n");
  }

  async function getAdvice() {
    if (!weather) return;
    setAdvLoad(true); setAdvice("");
    const dc  = getDateContext();
    const src = weather.source==="pws"?"personal weather station (backyard)":"grid model";
    const prompt = `${dc.date} ${dc.time} — ${dc.season}
WEATHER: ${src}
CONDITIONS: ${Math.round(weather.temperature_2m)}F, ${Math.round(adjHum)}% humidity (adjusted), soil ~${soil}F, wind ${Math.round(weather.wind_speed_10m)}mph ${windLabel(weather.wind_direction_10m)}, ${rain24.toFixed(2)}" rain 24hr
FROST: ${frost?.label} | FUNGAL RISK: ${fung?.label} | WATERING: ${water?.label}

PLANTS AND RECENT JOURNAL NOTES:
${buildJournalContext() || "No plants registered yet."}

You are an expert gardener. Give 3-4 sentences of specific, actionable advice based on the conditions and journal notes above. Reference specific plant names and recent observations where relevant. If today is not right for a key task, use the conditions to suggest the best upcoming window. End with one concrete action to take today. No em dashes.`;
    try {
      const txt = await claudeText(prompt, 600);
      setAdvice(txt);
    } catch(err) { setAdvice("Error: " + err.message); }
    setAdvLoad(false);
  }

  async function analyzePhoto() {
    if (!photoB64 || !weather) return;
    setPhotoLoading(true); setPhotoResult("");
    const dc  = getDateContext();
    const src = weather.source==="pws"?"personal weather station (backyard)":"grid model";
    const prompts = {
      disease: `${dc.date} — ${dc.season}
WEATHER SOURCE: ${src}
CONDITIONS: ${Math.round(weather.temperature_2m)}F, ${Math.round(weather.relative_humidity_2m)}% RH, soil ~${soil}F, ${rain24.toFixed(2)}" rain 24hr

You are a plant pathologist. Analyze this photo for disease, pest damage, or nutritional deficiencies. Factor in the season and conditions.
1) Most likely diagnosis  2) Confidence  3) How current conditions relate  4) Specific treatment  5) What to watch for next week.`,
      product: `${dc.date} — ${dc.season}
CONDITIONS: ${Math.round(weather.temperature_2m)}F, ${Math.round(weather.relative_humidity_2m)}% RH, wind ${Math.round(weather.wind_speed_10m)}mph, ${rain24.toFixed(2)}" rain 24hr

Read this product label and evaluate whether today is right for application.
1) Product name and type  2) Key application requirements from the label  3) Whether conditions meet requirements  4) Rain timing requirements  5) Clear yes/no for today with one-sentence reason.`,
    };
    try {
      const txt = await claudeVision(photoB64, prompts[photoMode], 800);
      setPhotoResult(txt);
      // Save to general journal so it's not lost
      const entry = {
        id: Date.now(),
        date: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),
        time: new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),
        weather: weather ? `${Math.round(weather.temperature_2m)}F  ${weather.relative_humidity_2m}% RH${weather.source==="pws"?"  PWS":""}` : "",
        notes: `📷 ${photoMode==="disease"?"Plant Diagnosis":"Product Label"}: ${txt}`,
        note:  `📷 ${photoMode==="disease"?"Plant Diagnosis":"Product Label"}: ${txt}`,
        photo: photoB64 ? `data:image/jpeg;base64,${photoB64}` : null,
        clouds:"", signs:"",
        _type: "photo_analysis",
      };
      const global = loadLS("pl_journal",[]);
      const updated = [entry, ...global];
      saveLS("pl_journal", updated);
      setGenJournal(updated);
    } catch(err) { setPhotoResult("Error: " + err.message); }
    setPhotoLoading(false);
  }

  if (!weather) return <div style={{textAlign:"center",padding:48,color:C.textMid,fontFamily:F.body}}>Loading weather data…</div>;

  return (
    <div>
      {/* ── New plant confirm modal ── */}
      {newPlantPending && (
        <NewPlantConfirm
          name={newPlantPending.name}
          parsedEntry={newPlantPending.parsedEntry}
          onConfirm={confirmNewPlant}
          onSkip={()=>setNewPlantPending(null)}
        />
      )}

      {/* ── Plant journal sheet ── */}
      {journalPlant && (
        <PlantJournalSheet
          plant={journalPlant}
          allPlants={plants}
          weather={weather}
          onClose={()=>setJournalPlant(null)}
          onNewPlantDetected={handleNewPlantDetected}
        />
      )}

      {/* ── Frost alert ── */}
      {frost && frost.level!=="safe" && (
        <div style={{background:frost.level==="danger"?"#200808":"#1a1505",border:`1px solid ${frost.color}`,borderRadius:16,padding:"14px 16px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:13,color:frost.color,letterSpacing:2,fontFamily:F.body,fontWeight:"600"}}>FROST — {frost.label.toUpperCase()}</span>
            <span style={{fontSize:28,color:frost.color,fontFamily:F.num,fontWeight:"200"}}>{Math.round(weather.temperature_2m)}°</span>
          </div>
          <div style={{fontSize:14,color:C.textMid,lineHeight:1.6,fontFamily:F.body}}>{frost.desc}</div>
          {plants.length>0 && (
            <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${frost.color}33`}}>
              {plants.map(p=><div key={p.id} style={{fontSize:13,color:C.text,marginBottom:2,fontFamily:F.body}}>{p.emoji} {p.name} — {p.location}</div>)}
            </div>
          )}
        </div>
      )}

      {/* ── Watering advisor ── */}
      {water && <div style={{...css.card, borderColor:`${water.color}44`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={css.label}>Watering</span>
            <InfoButton text="Combines 24hr rainfall, adjusted humidity, temperature, and wind. Use the finger test to confirm before watering."/>
          </div>
          <span style={css.tag(water.color)}>{water.action}</span>
        </div>
        <div style={{fontSize:24,fontFamily:F.display,color:water.color,marginBottom:4}}>{water.emoji} {water.label}</div>
        <div style={{fontSize:14,color:C.textMid,lineHeight:1.6,marginBottom:10,fontFamily:F.body}}>{water.desc}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{l:"Humidity",v:Math.round(adjHum)+"%"+(offset>0?" adj":"")},{l:"Rain 24hr",v:rain24.toFixed(2)+'"'},{l:"Soil Est.",v:soil+"F"}].map(s=>(
            <div key={s.l} style={{background:C.bg,borderRadius:10,padding:"8px",textAlign:"center"}}>
              <div style={{fontSize:11,color:C.textDim,marginBottom:2,fontFamily:F.body}}>{s.l}</div>
              <div style={{fontSize:15,color:C.text,fontFamily:F.num,fontWeight:"600"}}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>}

      {/* ── General Log ── */}
      <div style={{...css.card, borderColor:`${C.accent}33`, marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom: showGenJournal ? 12 : 8}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={css.label}>General Log</span>
              <InfoButton text="For observations not tied to one specific plant. Voice dictation auto-detects plant mentions and links them. Entries also appear here for review."/>
            </div>
            <div style={{fontSize:13,color:C.textMid,fontFamily:F.body,marginTop:-4}}>
              {genJournal.length>0 ? `${genJournal.length} entr${genJournal.length===1?"y":"ies"}` : "Log anything — voice, photo, or text"}
            </div>
          </div>
          <button onClick={()=>setShowGenJournal(o=>!o)} style={{...css.btn,padding:"9px 18px",fontSize:14}}>+ Log</button>
        </div>
        {showGenJournal && (
          <JournalEntryForm
            weather={weather}
            plantContext={null}
            allPlants={plants}
            onSave={(entry) => { saveGeneralEntry(entry); }}
            onCancel={()=>setShowGenJournal(false)}
            onNewPlantDetected={handleNewPlantDetected}
          />
        )}
        {genJournal.length>0 && (
          <div style={{marginTop: showGenJournal ? 8 : 0}}>
            {(showAllGenJournal ? genJournal : genJournal.slice(0,3)).map(e=>(
              <EntryCard
                key={e.id}
                entry={e}
                onDelete={()=>{
                  const u=genJournal.filter(x=>x.id!==e.id);
                  setGenJournal(u); saveLS("pl_journal",u);
                }}
                onUpdate={updated=>{
                  const u=genJournal.map(x=>x.id===updated.id?updated:x);
                  setGenJournal(u); saveLS("pl_journal",u);
                }}
              />
            ))}
            {genJournal.length > 3 && (
              <button
                onClick={()=>setShowAllGenJournal(o=>!o)}
                style={{...css.btnSoft, width:"100%", textAlign:"center", padding:"9px", fontSize:13, marginTop:4}}
              >
                {showAllGenJournal
                  ? "Show less"
                  : `Show ${genJournal.length - 3} more entr${genJournal.length-3===1?"y":"ies"}`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── My Plants ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{...css.label,marginBottom:0}}>My Plants</span>
          <InfoButton text="Each plant has its own journal. Notes made here (or via voice) feed the AI advisor. Tap Journal to log observations."/>
        </div>
        <button onClick={()=>setShowAdd(o=>!o)} style={css.btn}>+ Add</button>
      </div>

      {showAdd && (
        <div style={{...css.card, borderColor:`${C.accent}44`, marginBottom:16}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {PLANT_PRESETS.map(p=>(
              <button key={p.name} onClick={()=>setNp(prev=>({...prev,name:p.name,emoji:p.emoji}))} style={{padding:"6px 10px",borderRadius:980,fontSize:13,border:`1px solid ${np.name===p.name?C.accent:C.sep}`,cursor:"pointer",fontFamily:F.body,background:np.name===p.name?C.accentDim:"transparent",color:np.name===p.name?C.accent:C.textMid}}>
                {p.emoji} {p.name}
              </button>
            ))}
          </div>
          <input value={np.name} onChange={e=>setNp(p=>({...p,name:e.target.value}))} placeholder="Or type a plant name..." style={css.input}/>
          <div style={{fontSize:12,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Location</div>
          <input value={np.location} onChange={e=>setNp(p=>({...p,location:e.target.value}))} placeholder="e.g. south bed, patio, indoors..." style={css.input}/>
          <div style={{fontSize:12,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Date planted (optional)</div>
          <input type="date" value={np.planted} onChange={e=>setNp(p=>({...p,planted:e.target.value}))} style={css.input}/>
          <div style={{display:"flex",gap:10}}>
            <button onClick={addPlant} style={{...css.btn,flex:1,textAlign:"center",padding:"11px",opacity:np.name?1:0.4}}>Add Plant</button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:"transparent",border:"none",color:C.textMid,padding:"11px",borderRadius:980,fontSize:14,cursor:"pointer",fontFamily:F.body}}>Cancel</button>
          </div>
        </div>
      )}

      {plants.length===0 && !showAdd && (
        <div style={{...css.card,textAlign:"center",color:C.textDim,fontSize:14,lineHeight:1.8,fontFamily:F.body}}>
          <div style={{fontSize:36,marginBottom:8}}>🌱</div>
          Add plants for frost alerts and personalised AI advice.
        </div>
      )}

      {plants.map(p=>(
        <div key={p.id} style={{background:C.surface,borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:shadow}}>
          <div>
            <div style={{fontSize:15,color:C.text,fontFamily:F.body,fontWeight:"500"}}>{p.emoji} {p.name}</div>
            <div style={{fontSize:12,color:C.textMid,marginTop:2,fontFamily:F.body}}>{p.location}{p.planted?" — "+p.planted:""}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setJournalPlant(p)} style={{...css.btn,padding:"5px 12px",fontSize:12}}>Journal</button>
            <button onClick={()=>removePlant(p.id)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:18}}>×</button>
          </div>
        </div>
      ))}

      {/* ── AI Garden Advisor ── */}
      <div style={{...css.card, background:"linear-gradient(135deg,#e8f5ee,#f0faf2)", borderColor:`${C.accent}33`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={css.label}>Garden Advisor</span>
            <InfoButton text="AI advice using your conditions and plant journal notes. References pressure trend to suggest upcoming windows when today is not ideal."/>
          </div>
          <button onClick={getAdvice} style={{...css.btn,padding:"7px 14px",fontSize:13}}>
            {advLoad ? "Thinking…" : "Get Advice"}
          </button>
        </div>
        {weather.source==="pws" && <div style={{fontSize:12,color:C.accentMid,fontFamily:F.body,marginBottom:8}}>Using your PWS data</div>}
        {advice
          ? <div style={{fontSize:15,color:C.text,lineHeight:1.8,fontFamily:F.body}}>{advice}</div>
          : <div style={{fontSize:14,color:C.textDim,lineHeight:1.6,fontFamily:F.body}}>
              {plants.length>0 ? "Tap for advice based on today's conditions and your plant journal." : "Add plants and journal notes above, then tap for specific advice."}
            </div>
        }
      </div>

      {/* ── Photo Diagnosis ── */}
      <div style={css.card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={css.label}>Photo Analysis</span>
            <InfoButton text="Plant disease diagnosis or product label reading, cross-referenced with your current conditions."/>
          </div>
          <button onClick={()=>setShowPhoto(o=>!o)} style={css.btnSoft}>{showPhoto?"Hide":"Open"}</button>
        </div>

        {showPhoto && (
          <>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              {[["disease","Plant Diagnosis"],["product","Product Label"]].map(([id,lbl])=>(
                <button key={id} onClick={()=>{setPhotoMode(id);setPhotoResult("");}} style={{flex:1,padding:"9px 6px",borderRadius:12,fontSize:13,border:`1px solid ${photoMode===id?C.accent:C.sep}`,cursor:"pointer",fontFamily:F.body,background:photoMode===id?C.accentDim:"transparent",color:photoMode===id?C.accent:C.textMid}}>{lbl}</button>
              ))}
            </div>

            <div onClick={()=>photoRef.current?.click()} style={{border:`2px dashed ${photoPreview?C.accentDim:C.sep}`,borderRadius:12,padding:photoPreview?"0":"24px",textAlign:"center",cursor:"pointer",marginBottom:10,overflow:"hidden"}}>
              {photoPreview
                ? <img src={photoPreview} style={{width:"100%",borderRadius:10,display:"block",maxHeight:200,objectFit:"cover"}}/>
                : <><div style={{fontSize:32,marginBottom:4}}>📷</div><div style={{fontSize:13,color:C.textMid,fontFamily:F.body}}>Tap to upload or take photo</div></>
              }
            </div>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{
              const f=e.target.files?.[0]; if(!f) return;
              setPhotoResult(""); setPhotoPreview(URL.createObjectURL(f));
              const b64 = await resizeImage(f,1024); setPhotoB64(b64);
            }}/>

            {photoPreview && (
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <button onClick={analyzePhoto} disabled={photoLoading||!photoB64} style={{...css.btn,flex:1,textAlign:"center",padding:"11px",opacity:photoLoading||!photoB64?0.5:1}}>
                  {photoLoading?"Analyzing…":"Analyze Photo"}
                </button>
                <button onClick={()=>{setPhotoPreview(null);setPhotoB64(null);setPhotoResult("");}} style={{background:"transparent",border:"none",color:C.textMid,padding:"11px 16px",borderRadius:980,fontSize:14,cursor:"pointer",fontFamily:F.body}}>Clear</button>
              </div>
            )}

            {photoResult && (
              <div style={{background:C.bg,border:`1px solid ${C.accentDim}`,borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:11,color:C.accent,letterSpacing:2,marginBottom:8,fontFamily:F.body,fontWeight:"600"}}>{photoMode==="disease"?"DIAGNOSIS":"PRODUCT ANALYSIS"}</div>
                <div style={{fontSize:14,color:C.text,lineHeight:1.8,fontFamily:F.body,whiteSpace:"pre-line"}}>{photoResult}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Humidity calibration (collapsed) ── */}
      <details style={{...css.card,cursor:"pointer"}}>
        <summary style={{fontSize:13,color:C.accent,letterSpacing:1,textTransform:"uppercase",fontFamily:F.body,fontWeight:"600",listStyle:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          Microclimate Calibration <span style={{color:C.textDim}}>▼</span>
        </summary>
        <div style={{marginTop:12}}>
          <div style={{fontSize:13,color:C.textMid,lineHeight:1.6,marginBottom:12,fontFamily:F.body}}>Station near trees reads high. Set a humidity correction offset. (Not needed when using PWS directly.)</div>
          <div style={{fontSize:13,color:C.textMid,marginBottom:6,fontFamily:F.body}}>Correction: <span style={{color:C.accent}}>-{offset}%</span></div>
          <input type="range" min="0" max="15" step="0.5" value={offset} onChange={e=>{ const n=parseFloat(e.target.value)||0; setOffset(n); localStorage.setItem("pl_hum_off",String(n)); }} style={{width:"100%",accentColor:C.accent,marginBottom:8}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.textDim,fontFamily:F.body}}><span>0%</span><span>15%</span></div>
          {offset>0 && <div style={{marginTop:8,fontSize:12,color:C.accent,background:C.bg,padding:"8px 12px",borderRadius:8,fontFamily:F.body}}>Raw: {weather.relative_humidity_2m}% → Adjusted: {Math.round(adjHum)}%</div>}
        </div>
      </details>

      {/* ── Fungal risk ── */}
      {fung && <div style={{...css.card, borderColor:`${fung.color}33`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={css.label}>Fungal Risk</span>
            <InfoButton text="Elevated when humidity >80%, temps 60-85F, and recent rain >0.25 inches. The conditions that cause blight and mildew."/>
          </div>
          <span style={css.tag(fung.color)}>{fung.level}</span>
        </div>
        <div style={{fontSize:14,color:C.textMid,lineHeight:1.6,fontFamily:F.body}}>{fung.desc}</div>
      </div>}

      {/* ── Soil temperature ── */}
      {soil != null && <div style={css.card}>
        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:8}}>
          <span style={css.label}>Soil Temperature</span>
          <InfoButton text="Estimated from air temp and season. The real trigger for germination — more reliable than calendar date."/>
        </div>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:10}}>
          <div style={{fontSize:36,fontFamily:F.num,color:C.text,fontWeight:"200"}}>{soil}F</div>
          <div style={{fontSize:13,color:C.textMid,lineHeight:1.5,fontFamily:F.body}}>
            {soil<50?"Too cold for most seeds":soil<60?"Good for brassicas, lettuce":soil<70?"Tomatoes/peppers marginal":soil<80?"Ideal for warm-season crops":"Hot — cool-season stress risk"}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {Object.entries(SEED_TEMPS).map(([name,s])=>{
            const ok=soil>=s.min, opt=soil>=s.opt-5&&soil<=s.opt+10;
            const col=opt?C.good:ok?C.warn:C.textDim;
            return (
              <div key={name} style={{background:C.bg,border:`1px solid ${col}33`,borderRadius:9,padding:"8px 10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:13,color:ok?C.text:C.textDim,fontFamily:F.body}}>{name}</span>
                <span style={{fontSize:12,color:col,padding:"2px 6px",borderRadius:8,background:`${col}18`,fontFamily:F.body}}>{opt?"Ready":ok?"~":s.min+"F+"}</span>
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}
// ══════════════════════════════════════════════════════════════════════════════
const YARD_ACTIVITIES = [
  {id:"preemergent",   group:"Lawn",     label:"Pre-emergent",              emoji:"🌱"},
  {id:"lawn_fert",     group:"Lawn",     label:"Lawn Fertilizer",           emoji:"🌿"},
  {id:"overseed",      group:"Lawn",     label:"Overseeding",               emoji:"🌾"},
  {id:"mow",           group:"Lawn",     label:"Mowing & Edging",           emoji:"✂️"},
  {id:"aerate",        group:"Lawn",     label:"Aerating",                  emoji:"🔧"},
  {id:"weed",          group:"Lawn",     label:"Pulling Weeds",             emoji:"🫳"},
  {id:"paint",         group:"Projects", label:"Exterior Painting",         emoji:"🎨"},
  {id:"stain",         group:"Projects", label:"Wood Stain / Deck",         emoji:"🪵"},
  {id:"caulk",         group:"Projects", label:"Caulking / Sealing",        emoji:"🔩"},
  {id:"concrete",      group:"Projects", label:"Concrete / Masonry",        emoji:"🧱"},
  {id:"powerwash",     group:"Projects", label:"Power Washing",             emoji:"💦"},
  {id:"shed",          group:"Projects", label:"Framing / Construction",    emoji:"🏗️"},
  {id:"driveway_seal", group:"Projects", label:"Driveway Sealing",          emoji:"🛣️"},
  {id:"herbicide",     group:"Spraying", label:"Herbicide",                 emoji:"🧴"},
  {id:"pesticide",     group:"Spraying", label:"Pesticide / Fungicide",     emoji:"🪲"},
  {id:"fert_spray",    group:"Spraying", label:"Liquid Fertilizer",         emoji:"💧"},
  {id:"mulch",         group:"Other",    label:"Mulch Spreading",           emoji:"🍂"},
  {id:"compost",       group:"Other",    label:"Compost Turning",           emoji:"♻️"},
];

function evalActivity(id, wx, hist) {
  const tmp    = wx.temperature_2m, hum = wx.relative_humidity_2m, wind = wx.wind_speed_10m;
  const rain24 = wx.rain24h || hist.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const dryStretch = hist.length > 6 && hist.slice(-72).every(s=>(s.precipitation||0)<0.05);
  const trend  = pressureTrend(hist);
  const rainComing = trend.trend==="falling_fast"||trend.trend==="falling";
  const month  = new Date().getMonth();
  const soil   = soilEst(tmp, month);
  const frost  = frostRisk(tmp, hum, wind);
  const conditions = [];
  let verdict = "yes";
  const pass = (l,v,ok,n) => { conditions.push({label:l,value:v,ok,note:n}); if(!ok&&verdict==="yes") verdict="wait"; };
  const fail = (l,v,n)    => { conditions.push({label:l,value:v,ok:false,note:n}); verdict="no"; };
  const info = (l,v,n)    => conditions.push({label:l,value:v,ok:true,note:n});

  switch(id) {
    case "preemergent":
      pass("Soil Temp",soil+"F",soil>=50&&soil<=62,soil<50?"Wait for 50F":soil>62?"Window closing":"Prime window");
      pass("Recent Rain",rain24.toFixed(2)+'"',rain24<0.5,rain24>=0.5?"Too wet":"Good");
      pass("Rain Forecast",rainComing?"Coming":"Clear",!rainComing,rainComing?"Will wash away":"Light rain in 48hrs ideal to activate"); break;
    case "lawn_fert":
      pass("Air Temp",Math.round(tmp)+"F",tmp>=50&&tmp<=85,tmp<50?"Turf not growing":tmp>85?"Burn risk":"Good");
      pass("Soil Temp",soil+"F",soil>=55,soil<55?"Too cool for uptake":"Active");
      pass("Recent Rain",rain24.toFixed(2)+'"',rain24<0.5,rain24>=0.5?"Runoff risk":"Good");
      info("Rain Forecast",rainComing?"Coming":"Stable",rainComing?"Good — rain activates granules":"Water in if no rain in 48hrs"); break;
    case "overseed":
      pass("Season",(month>=8&&month<=10)?"In window":"Off season",month>=8&&month<=10,"Best Sept-Nov in NJ");
      pass("Soil Temp",soil+"F",soil>=50&&soil<=65,soil>65?"Too warm":soil<50?"Too cold":"Ideal"); break;
    case "mow":
      pass("Humidity",Math.round(hum)+"%",hum<70,hum>=70?"Damp — tears not cuts":"Good");
      pass("Recent Rain",rain24.toFixed(2)+'"',rain24<0.15,rain24>=0.15?"Wet clumps":"Good"); break;
    case "aerate":
      pass("Soil Moisture",rain24>0.1?"Moist":"Dry",rain24>0.1&&rain24<1.0,rain24<=0.1?"Too dry — tines won't penetrate":rain24>=1.0?"Too wet":"Good");
      info("Season",(month>=8&&month<=10)?"Fall — ideal":"Spring OK","Fall preferred for cool-season grass"); break;
    case "weed":
      pass("Soil Moisture",rain24>0.1?"Moist":"Dry",rain24>0.1,"Moist soil — roots pull cleanly"); break;
    case "paint":
      pass("Temp",Math.round(tmp)+"F",tmp>=50&&tmp<=90,tmp<50?"Below 50F min for latex":tmp>90?"Too hot":"Good");
      pass("Humidity",Math.round(hum)+"%",hum<=70,hum>70?"Above 70% — won't dry evenly":"Good");
      pass("Rain Forecast",rainComing?"Coming":"Clear",!rainComing,rainComing?"Needs 24hr dry after application":"Good"); break;
    case "stain":
      pass("Temp",Math.round(tmp)+"F",tmp>=50&&tmp<=90,"Good");
      pass("Humidity",Math.round(hum)+"%",hum<=65,hum>65?"Blotchy finish above 65%":"Good");
      pass("Dry Surface",dryStretch?"Yes":"No",dryStretch&&!rainComing,"Need 48hr dry surface + clear forecast"); break;
    case "caulk":
      pass("Temp",Math.round(tmp)+"F",tmp>=40&&tmp<=90,tmp<40?"Won't cure below 40F":"Good");
      pass("Rain",rain24.toFixed(2)+'"',rain24<0.1,"Surface must be completely dry"); break;
    case "concrete":
      pass("Temp",Math.round(tmp)+"F",tmp>=50&&tmp<=90,tmp<50?"Won't cure — cracking risk":tmp>90?"Surface dries too fast":"Good");
      fail("Rain Forecast",rainComing?"Coming":"Clear","Do not pour with rain in forecast"); break;
    case "powerwash":
      pass("Temp",Math.round(tmp)+"F",tmp>=45,"Good");
      pass("Rain Forecast",rainComing?"Coming":"Clear",!rainComing,rainComing?"Pointless if rain coming":"Good"); break;
    case "shed":
      pass("Temp",Math.round(tmp)+"F",tmp>=45,"Good");
      pass("Rain",rain24.toFixed(2)+'"',rain24<0.5,"Ground too wet for footings"); break;
    case "driveway_seal":
      pass("Temp",Math.round(tmp)+"F",tmp>=50&&tmp<=90,"Good");
      pass("Dry Stretch",dryStretch?"Yes":"No",dryStretch,"Need 2-3 dry days before and after");
      pass("Rain Forecast",rainComing?"Coming":"Clear",!rainComing,"Good window"); break;
    case "herbicide":
      pass("Wind",Math.round(wind)+" mph",wind<10,wind>=10?"Drift risk — wait for <10mph":"Good");
      pass("Rain",rain24.toFixed(2)+'"',rain24<0.1,"Wet leaves — washes off before absorbing");
      pass("Rain Forecast",rainComing?"Coming":"Clear",!rainComing,"Needs 4-6hrs on dry leaves"); break;
    case "pesticide":
      pass("Wind",Math.round(wind)+" mph",wind<10,wind>=10?"Drift risk":"Good");
      pass("Temp",Math.round(tmp)+"F",tmp>=50&&tmp<90,tmp>=90?"Breaks down faster, plant stress":"Good");
      pass("Rain",rain24.toFixed(2)+'"',rain24<0.1&&!rainComing,"Rain will wash product off"); break;
    case "fert_spray":
      pass("Wind",Math.round(wind)+" mph",wind<10,wind>=10?"Drift risk":"Good");
      pass("Temp",Math.round(tmp)+"F",tmp>=50&&tmp<90,tmp>=90?"Leaf burn risk":"Good");
      info("Tip","Early morning","Avoid direct sun — apply morning or evening"); break;
    case "mulch":
      pass("Wind",Math.round(wind)+" mph",wind<15,wind>=15?"Will scatter light mulch":"Good");
      info("Depth","2-3 inches","Keep away from stems and trunks"); break;
    case "compost":
      pass("Soil Temp",soil+"F",soil>=55,soil<55?"Microbial activity slow":"Active decomposition");
      pass("Moisture",rain24>0.1?"Moist":"Dry",rain24>0.05&&rain24<1.5,rain24>=1.5?"Too wet — add browns":rain24<=0.05?"Dry — moisten pile":"Good"); break;
    default: info("Conditions","—","");
  }
  return { conditions, verdict };
}

function Yard({ weather, history }) {
  const [selected,    setSelected]    = useState("");
  const [evalResult,  setEvalResult]  = useState(null);
  const [aiExplain,   setAiExplain]   = useState("");
  const [aiLoading,   setAiLoading]   = useState(false);
  const [openGroup,   setOpenGroup]   = useState("Lawn");
  const [productB64,  setProductB64]  = useState(null);
  const [productPrev, setProductPrev] = useState(null);
  const [productRes,  setProductRes]  = useState("");
  const [productLoad, setProductLoad] = useState(false);
  const [showProduct, setShowProduct] = useState(true);
  const productRef = useRef();
  const groups = [...new Set(YARD_ACTIVITIES.map(a=>a.group))];
  const trend  = weather ? pressureTrend(history) : { label:"Stable" };

  function selectActivity(id) {
    setSelected(id); setAiExplain("");
    if (!weather) return;
    setEvalResult(evalActivity(id, weather, history));
  }

  async function getAiExplanation(activity, result) {
    if (!weather) return;
    setAiLoading(true); setAiExplain("");
    const conds = result.conditions.map(c=>`${c.label}: ${c.value} (${c.ok?"pass":"fail"}) — ${c.note}`).join("\n");
    const src   = weather.source==="pws"?"your personal backyard weather station":"a weather grid model";
    const prompt = `You are advising on whether to do "${activity.label}" today.
Weather from: ${src}
Verdict: ${result.verdict.toUpperCase()}

Condition check:
${conds}

Pressure trend: ${trend.label}

Confirm the verdict plainly and explain the single most important blocking condition. If verdict is wait or no, use the pressure trend to estimate a specific upcoming window (e.g. "tomorrow morning once humidity drops" or "Thursday after the rain clears"). Be direct. One sentence per point. No em dashes.`;
    try {
      const txt = await claudeText(prompt, 400);
      setAiExplain(txt);
    } catch(err) { setAiExplain("Error: "+err.message); }
    setAiLoading(false);
  }

  async function analyzeProductLabel() {
    if (!productB64 || !weather) return;
    setProductLoad(true); setProductRes("");
    const dc   = getDateContext();
    const rain24 = weather?.rain24h || history.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
    const prompt = `${dc.date} — ${dc.season}
CONDITIONS: ${Math.round(weather.temperature_2m)}F, ${Math.round(weather.relative_humidity_2m)}% RH, wind ${Math.round(weather.wind_speed_10m)}mph, ${rain24.toFixed(2)}" rain 24hr

Read this product label and evaluate whether today is right for application.
1) Product name and type  2) Key requirements from the label  3) Whether conditions meet them  4) Rain timing requirements  5) Clear yes/no with one-sentence reason.`;
    try {
      const txt = await claudeVision(productB64, prompt, 800);
      setProductRes(txt);
    } catch(err) { setProductRes("Error: "+err.message); }
    setProductLoad(false);
  }

  const selectedActivity  = YARD_ACTIVITIES.find(a=>a.id===selected);
  const verdictColors     = { yes:C.good, wait:C.warn, no:C.danger };
  const verdictLabels     = { yes:"Good to go", wait:"Wait for better conditions", no:"Not today" };

  if (!weather) return <div style={{textAlign:"center",padding:48,color:C.textMid,fontFamily:F.body}}>Loading weather data…</div>;

  return (
    <div>
      <div style={{fontSize:14,color:C.textMid,marginBottom:14,lineHeight:1.6,fontFamily:F.body}}>
        Select an activity to check conditions{weather.source==="pws"?" using your PWS":""}.
      </div>

      {/* ── Activity selector ── */}
      <div style={{...css.card,marginBottom:16}}>
        {groups.map(group=>(
          <div key={group} style={{marginBottom:4}}>
            <button onClick={()=>setOpenGroup(openGroup===group?null:group)} style={{width:"100%",background:"none",border:"none",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",cursor:"pointer"}}>
              <span style={{fontSize:11,color:C.textMid,fontFamily:F.body,fontWeight:"600",letterSpacing:0.5}}>{group.toUpperCase()}</span>
              <span style={{color:C.textDim,fontSize:11}}>{openGroup===group?"▲":"▼"}</span>
            </button>
            {openGroup===group && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,paddingBottom:8}}>
                {YARD_ACTIVITIES.filter(a=>a.group===group).map(a=>(
                  <button key={a.id} onClick={()=>selectActivity(a.id)} style={{padding:"10px",borderRadius:12,fontSize:12,border:`1px solid ${selected===a.id?C.accent:C.sep}`,cursor:"pointer",fontFamily:F.body,textAlign:"left",background:selected===a.id?C.accentDim:"#fff",color:selected===a.id?C.accent:C.text,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:16}}>{a.emoji}</span>
                    <span style={{lineHeight:1.3}}>{a.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Result ── */}
      {selected && evalResult && selectedActivity && (
        <div>
          <div style={{background:verdictColors[evalResult.verdict]+"18",border:`2px solid ${verdictColors[evalResult.verdict]}`,borderRadius:16,padding:"16px 18px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:16,color:C.text,fontFamily:F.body,fontWeight:"600"}}>{selectedActivity.emoji} {selectedActivity.label}</div>
              <div style={{fontSize:12,fontWeight:"700",color:verdictColors[evalResult.verdict],padding:"4px 12px",borderRadius:980,background:verdictColors[evalResult.verdict]+"22",fontFamily:F.body}}>
                {verdictLabels[evalResult.verdict].toUpperCase()}
              </div>
            </div>
          </div>

          <div style={css.card}>
            <span style={css.label}>Condition Check</span>
            {evalResult.conditions.map((c,i)=>(
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 0",borderBottom:i<evalResult.conditions.length-1?`1px solid ${C.sep}`:"none"}}>
                <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,marginTop:1,background:c.ok?C.good+"22":C.danger+"22",border:`1.5px solid ${c.ok?C.good:C.danger}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:c.ok?C.good:C.danger}}>
                  {c.ok?"✓":"!"}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                    <span style={{fontSize:14,color:C.text,fontFamily:F.body,fontWeight:"500"}}>{c.label}</span>
                    <span style={{fontSize:13,color:c.ok?C.good:C.warn,fontFamily:F.body,fontWeight:"600"}}>{c.value}</span>
                  </div>
                  {c.note && <div style={{fontSize:12,color:C.textMid,lineHeight:1.5,fontFamily:F.body}}>{c.note}</div>}
                </div>
              </div>
            ))}
          </div>

          <div style={{...css.card,background:C.accentDim,borderColor:C.accent+"44"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={css.label}>AI Recommendation</span>
              {!aiExplain && <button onClick={()=>getAiExplanation(selectedActivity,evalResult)} style={{...css.btn,padding:"6px 14px",fontSize:12}}>{aiLoading?"Thinking…":"Get Advice"}</button>}
            </div>
            {aiExplain
              ? <div style={{fontSize:14,color:C.text,lineHeight:1.7,fontFamily:F.body}}>{aiExplain}</div>
              : <div style={{fontSize:13,color:C.textMid,fontFamily:F.body}}>Tap Get Advice for plain-language recommendation{weather.source==="pws"?" using your PWS data":""}.</div>
            }
          </div>
        </div>
      )}

      {/* ── Product label scan — always open ── */}
      <div style={{...css.card,marginTop:4}}>
        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:12}}>
          <span style={css.label}>Product Label Scan</span>
          <InfoButton text="Photograph any fertilizer, herbicide, or pesticide label. AI reads the application requirements and checks them against today's conditions."/>
        </div>
        <div onClick={()=>productRef.current?.click()} style={{border:`2px dashed ${productPrev?C.accentDim:C.sep}`,borderRadius:12,padding:productPrev?"0":"20px",textAlign:"center",cursor:"pointer",marginBottom:10,overflow:"hidden"}}>
          {productPrev
            ? <img src={productPrev} style={{width:"100%",borderRadius:10,display:"block",maxHeight:200,objectFit:"cover"}}/>
            : <><div style={{fontSize:28,marginBottom:4}}>🏷</div><div style={{fontSize:13,color:C.textMid,fontFamily:F.body}}>Tap to photograph label</div></>
          }
        </div>
        <input ref={productRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{
          const f=e.target.files?.[0]; if(!f) return;
          setProductRes(""); setProductPrev(URL.createObjectURL(f));
          const b64=await resizeImage(f,1024); setProductB64(b64);
        }}/>
        {productPrev && (
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <button onClick={analyzeProductLabel} disabled={productLoad||!productB64} style={{...css.btn,flex:1,textAlign:"center",padding:"11px",opacity:productLoad||!productB64?0.5:1}}>
              {productLoad?"Analyzing…":"Check This Product"}
            </button>
            <button onClick={()=>{setProductPrev(null);setProductB64(null);setProductRes("");}} style={{background:"transparent",border:"none",color:C.textMid,padding:"11px 16px",borderRadius:980,fontSize:14,cursor:"pointer",fontFamily:F.body}}>Clear</button>
          </div>
        )}
        {productRes && (
          <div style={{background:C.bg,border:`1px solid ${C.accentDim}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:11,color:C.accent,letterSpacing:2,marginBottom:8,fontFamily:F.body,fontWeight:"600"}}>PRODUCT ANALYSIS</div>
            <div style={{fontSize:14,color:C.text,lineHeight:1.8,fontFamily:F.body,whiteSpace:"pre-line"}}>{productRes}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── TAB: NOW ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function groupHistoryByDay(history) {
  const days = {};
  history.forEach(s=>{
    const d = new Date(s.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"});
    if (!days[d]) days[d]=[];
    days[d].push(s);
  });
  return days;
}

function TenDayTrends({ history }) {
  const days    = groupHistoryByDay(history);
  const dayKeys = Object.keys(days).slice(-10);
  if (dayKeys.length < 2) return (
    <div style={{...css.card,textAlign:"center",color:C.textMid,fontSize:14,padding:"28px 16px",fontFamily:F.body}}>
      <div style={{fontSize:28,marginBottom:8}}>📈</div>Keep the app open daily to build trend history.
    </div>
  );
  const tempData  = dayKeys.map(d=>({ day:d, hi:Math.max(...days[d].map(s=>s.temp)), lo:Math.min(...days[d].map(s=>s.temp)) }));
  const rainData  = dayKeys.map(d=>({ day:d, val:days[d].reduce((s,r)=>s+(r.precipitation||0),0) }));
  const pressData = dayKeys.map(d=>({ day:d, val:(days[d][days[d].length-1]?.pressure||0)*0.02953 }));
  const allHi=tempData.map(d=>d.hi), allLo=tempData.map(d=>d.lo);
  const tMax=Math.max(...allHi)+2, tMin=Math.min(...allLo)-2;
  const pMax=Math.max(...pressData.map(d=>d.val))+0.05, pMin=Math.min(...pressData.map(d=>d.val))-0.05;
  const rMax=Math.max(...rainData.map(d=>d.val),0.1);

  return (
    <div>
      <div style={css.card}>
        <span style={css.label}>Temperature — 10 Days</span>
        <svg viewBox="0 0 300 80" style={{width:"100%",height:80}} preserveAspectRatio="none">
          {tempData.map((d,i)=>{
            const hiY=80-((d.hi-tMin)/(tMax-tMin))*72-4;
            const loY=80-((d.lo-tMin)/(tMax-tMin))*72-4;
            const x=i*(300/dayKeys.length)+(300/dayKeys.length)/2;
            return <g key={d.day}><line x1={x} y1={hiY} x2={x} y2={loY} stroke="#2D6A4F" strokeWidth="3" strokeLinecap="round" opacity="0.4"/><circle cx={x} cy={hiY} r="3" fill="#FB923C"/><circle cx={x} cy={loY} r="3" fill="#7DD3FC"/></g>;
          })}
        </svg>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          {tempData.map(d=>(
            <div key={d.day} style={{textAlign:"center",flex:1}}>
              <div style={{fontSize:9,color:C.textDim,fontFamily:F.body}}>{d.day.split(" ")[1]}</div>
              <div style={{fontSize:9,color:"#FB923C",fontFamily:F.body}}>{Math.round(d.hi)}</div>
              <div style={{fontSize:9,color:"#7DD3FC",fontFamily:F.body}}>{Math.round(d.lo)}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:12,marginTop:6}}><span style={{fontSize:11,color:"#FB923C",fontFamily:F.body}}>● High</span><span style={{fontSize:11,color:"#7DD3FC",fontFamily:F.body}}>● Low</span></div>
      </div>

      <div style={css.card}>
        <span style={css.label}>Rainfall — 10 Days</span>
        <svg viewBox="0 0 300 60" style={{width:"100%",height:60}} preserveAspectRatio="none">
          {rainData.map((d,i)=>{
            const bH=Math.max(2,(d.val/rMax)*52), x=i*(300/dayKeys.length);
            return <rect key={d.day} x={x+1} y={60-bH} width={(300/dayKeys.length)-2} height={bH} fill="#60A5FA" rx="2" opacity="0.8"/>;
          })}
        </svg>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          {rainData.map(d=>(<div key={d.day} style={{textAlign:"center",flex:1}}><div style={{fontSize:9,color:C.textDim,fontFamily:F.body}}>{d.day.split(" ")[1]}</div><div style={{fontSize:9,color:"#60A5FA",fontFamily:F.body}}>{d.val>0?d.val.toFixed(1):"-"}"</div></div>))}
        </div>
      </div>

      <div style={css.card}>
        <span style={css.label}>Pressure — 10 Days</span>
        <svg viewBox="0 0 300 60" style={{width:"100%",height:60}} preserveAspectRatio="none">
          {pressData.map((d,i)=>{
            if (!i) return null;
            const prev=pressData[i-1];
            const x1=(i-1)*(300/dayKeys.length)+(300/dayKeys.length)/2, x2=i*(300/dayKeys.length)+(300/dayKeys.length)/2;
            const y1=60-((prev.val-pMin)/(pMax-pMin))*52-4, y2=60-((d.val-pMin)/(pMax-pMin))*52-4;
            return <line key={d.day} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round"/>;
          })}
          {pressData.map((d,i)=>{ const x=i*(300/dayKeys.length)+(300/dayKeys.length)/2, y=60-((d.val-pMin)/(pMax-pMin))*52-4; return <circle key={d.day} cx={x} cy={y} r="2.5" fill="#2D6A4F"/>; })}
        </svg>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          {pressData.map(d=>(<div key={d.day} style={{textAlign:"center",flex:1}}><div style={{fontSize:9,color:C.textDim,fontFamily:F.body}}>{d.day.split(" ")[1]}</div><div style={{fontSize:9,color:"#2D6A4F",fontFamily:F.body}}>{d.val.toFixed(2)}"</div></div>))}
        </div>
      </div>
    </div>
  );
}

function Now({ weather, locationName, loading, apiError, history, forecast, tempOffset=0 }) {
  const [aiText,    setAiText]    = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showTrends,setShowTrends]= useState(false);

  const inHg  = weather ? hpa2hg(weather.surface_pressure) : null;
  const trend = pressureTrend(history);
  const shift = windShift(history);
  const trendColor = {falling_fast:C.danger,falling:C.warn,rising_fast:C.good,rising:C.good,stable:C.textMid}[trend.trend];
  const adjTemp = weather ? weather.temperature_2m + tempOffset : null;
  const frost = adjTemp ? frostRisk(adjTemp, weather.relative_humidity_2m, weather.wind_speed_10m) : null;

  async function readField() {
    if (!weather) return;
    setAiLoading(true); setAiText("");
    const dc   = getDateContext();
    const src  = weather.source==="pws"?"a personal backyard weather station":"a grid weather model";
    const phist = history.slice(-24).map(s=>new Date(s.ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})+": "+hpa2hg(s.pressure)+'"').join(", ");
    const prompt = `FIELD LOG — ${dc.date} ${dc.time}
Location: Northern New Jersey | Source: ${src}
Temp: ${Math.round(weather.temperature_2m)}F | RH: ${weather.relative_humidity_2m}% | Dewpoint: ${weather.dew_point!=null?Math.round(weather.dew_point)+"F":"N/A"}
Pressure: ${inHg}" (${trend.label})
Wind: ${Math.round(weather.wind_speed_10m)} mph ${windLabel(weather.wind_direction_10m)}
${weather.uv!=null?"UV Index: "+weather.uv+"\n":""}Pressure history: ${phist||"no history"}
Season: ${dc.season}

Write a 3-sentence field observation. Sentence 1: current conditions summary with key numbers. Sentence 2: one or two specific biological indicators for this date in NJ (bird, insect, or plant phenology). Sentence 3: 12-hour outlook based on pressure trend. Clinical and brief. No em dashes.`;
    try {
      const txt = await claudeText(prompt, 400);
      setAiText(txt);
    } catch(err) { setAiText("Error: "+err.message); }
    setAiLoading(false);
  }

  if (loading) return <div style={{textAlign:"center",padding:48,color:C.textMid,fontFamily:F.body}}>Reading conditions…</div>;

  return (
    <div>
      {apiError && <div style={{fontSize:13,color:C.warn,background:"#FFF9F0",padding:"8px 12px",borderRadius:10,marginBottom:10,fontFamily:F.body}}>⚠ {apiError}</div>}

      {/* ── Rapid pressure drop alert ── */}
      {trend.trend==="falling_fast" && (
        <div style={{background:"#FFF2F2",border:`1px solid ${C.danger}`,borderRadius:14,padding:"12px 16px",marginBottom:10}}>
          <div style={{fontSize:13,color:C.danger,letterSpacing:2,marginBottom:4,fontFamily:F.body,fontWeight:"600"}}>RAPID PRESSURE DROP</div>
          <div style={{fontSize:14,color:C.textMid,lineHeight:1.5,fontFamily:F.body}}>Pressure dropped {(Math.abs(trend.delta)*0.02953).toFixed(2)}" in 6 hours. Significant weather change likely soon.</div>
        </div>
      )}

      {/* ── Frost alert ── */}
      {frost && frost.level!=="safe" && (
        <div style={{background:frost.level==="danger"?"#200808":"#1a1505",border:`1px solid ${frost.color}`,borderRadius:14,padding:"12px 16px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:13,color:frost.color,letterSpacing:2,fontFamily:F.body,fontWeight:"600"}}>FROST — {frost.label.toUpperCase()}</div>
            <div style={{fontSize:28,fontFamily:F.num,color:frost.color,fontWeight:"200"}}>{weather&&Math.round(weather.temperature_2m)}°</div>
          </div>
          <div style={{fontSize:14,color:C.textMid,marginTop:4,fontFamily:F.body}}>{frost.desc}</div>
        </div>
      )}

      {/* ── PWS grid ── */}
      {weather?.source==="pws" && (
        <div style={{...css.card,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,color:C.accent,fontFamily:F.body,fontWeight:"600"}}>YOUR BACKYARD — LIVE</div>
            <div style={{fontSize:11,color:C.textDim,fontFamily:F.body}}>PWS</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {[
              {l:"Temp",v:Math.round(weather.temperature_2m)+"F"},
              {l:"Humidity",v:weather.relative_humidity_2m+"%"},
              {l:"Wind",v:Math.round(weather.wind_speed_10m)+" mph"},
              {l:"Rain 24hr",v:(weather.rain24h||0).toFixed(2)+'"'},
              ...(weather.uv!=null?[{l:"UV",v:weather.uv}]:[]),
              ...(weather.dew_point!=null?[{l:"Dew Pt",v:Math.round(weather.dew_point)+"F"}]:[]),
              ...(weather.feels_like!=null?[{l:"Feels",v:Math.round(weather.feels_like)+"F"}]:[]),
              {l:"Pressure",v:inHg+'"'},
            ].map(s=>(
              <div key={s.l} style={{background:C.bg,borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
                <div style={{fontSize:10,color:C.textDim,marginBottom:2,fontFamily:F.body}}>{s.l}</div>
                <div style={{fontSize:14,color:C.text,fontFamily:F.num,fontWeight:"600"}}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pressure ── */}
      {weather && (
        <div style={css.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={css.label}>Barometric Pressure</span>
              <InfoButton text="Rapidly falling pressure (3+ hPa / 0.09 inHg in 6hrs) means significant weather change imminent. Rising means improving. The curve shape matters as much as the current value."/>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:6}}>
            <div style={{fontSize:34,fontFamily:F.num,color:C.text,fontWeight:"200"}}>{inHg}<span style={{fontSize:14,color:C.textMid}}> inHg</span></div>
            <span style={{fontSize:13,padding:"3px 10px",borderRadius:12,background:`${trendColor}22`,color:trendColor,fontFamily:F.body}}>{trend.label}</span>
          </div>
          {history.length>2 && (()=>{
            const pts = history.slice(-24).map(s=>s.pressure*0.02953);
            const mn  = Math.min(...pts), mx = Math.max(...pts);
            // Time labels: oldest and newest reading
            const oldest = history[Math.max(0,history.length-24)];
            const newest = history[history.length-1];
            const fmt = ts => new Date(ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
            return (
              <div>
                <Spark data={pts} color={C.accent} h={56}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                  <span style={{fontSize:11,color:C.textDim,fontFamily:F.body}}>{fmt(oldest.ts)}</span>
                  <span style={{fontSize:11,color:C.textDim,fontFamily:F.body}}>
                    {mn.toFixed(2)}" — {mx.toFixed(2)}"
                  </span>
                  <span style={{fontSize:11,color:C.textDim,fontFamily:F.body}}>{fmt(newest.ts)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Wind ── */}
      {weather && (
        <div style={css.card}>
          <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:8}}>
            <span style={css.label}>Wind</span>
            <InfoButton text="NW winds bring cold dry air. SW often precedes warm fronts. Backing (counter-clockwise shift) can signal approaching low pressure. Veering (clockwise) often follows a front passing."/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
            <div style={{width:40,height:40,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,background:C.bg,flexShrink:0,transform:`rotate(${weather.wind_direction_10m+180}deg)`}}>↑</div>
            <div>
              <div style={{fontSize:20,fontFamily:F.num,color:C.text,fontWeight:"300"}}>{windLabel(weather.wind_direction_10m)} — {Math.round(weather.wind_speed_10m)} mph</div>
              <div style={{fontSize:12,color:C.textMid,fontFamily:F.body,marginTop:2}}>{weather.wind_speed_10m>=15?"strong":weather.wind_speed_10m>=10?"breezy":"light"}</div>
            </div>
          </div>

          {/* Wind direction compass trail */}
          {history.length>2 && (()=>{
            const cardToDeg = {"N":0,"NNE":22.5,"NE":45,"ENE":67.5,"E":90,"ESE":112.5,"SE":135,"SSE":157.5,"S":180,"SSW":202.5,"SW":225,"WSW":247.5,"W":270,"WNW":292.5,"NW":315,"NNW":337.5};
            const recent = history.slice(-16).filter(s=>s.windDir && cardToDeg[s.windDir]!=null);
            if (recent.length < 2) return null;
            const cx=60, cy=60, r=44;
            const dots = recent.map((s,i)=>{
              const deg = cardToDeg[s.windDir];
              const rad = (deg-90) * Math.PI/180;
              return { x: cx+r*Math.cos(rad), y: cy+r*Math.sin(rad), age: i/recent.length, dir: s.windDir, spd: s.windSpeed||0 };
            });
            const labels = ["N","E","S","W"];
            const labelPos = labels.map(l=>{ const d=cardToDeg[l]; const rd=(d-90)*Math.PI/180; return {l, x:cx+(r+10)*Math.cos(rd), y:cy+(r+10)*Math.sin(rd)}; });
            return (
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <svg width="120" height="120" style={{flexShrink:0}}>
                  {/* Compass ring */}
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.sep} strokeWidth="1"/>
                  <circle cx={cx} cy={cy} r={r*0.5} fill="none" stroke={C.sep} strokeWidth="0.5" strokeDasharray="2,4"/>
                  {/* Cardinal labels */}
                  {labelPos.map(p=>(
                    <text key={p.l} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill={C.textDim} fontFamily={F.body}>{p.l}</text>
                  ))}
                  {/* Trail line */}
                  <polyline
                    points={dots.map(d=>`${d.x},${d.y}`).join(" ")}
                    fill="none" stroke={C.accent} strokeWidth="1.5" strokeOpacity="0.4"
                    strokeLinejoin="round" strokeLinecap="round"
                  />
                  {/* Dots — oldest faded, newest bright */}
                  {dots.map((d,i)=>(
                    <circle key={i} cx={d.x} cy={d.y} r={i===dots.length-1?4:2.5}
                      fill={i===dots.length-1?C.accent:C.accentMid}
                      opacity={0.2 + 0.8*(i/dots.length)}
                    />
                  ))}
                  {/* Center dot */}
                  <circle cx={cx} cy={cy} r="2" fill={C.sep}/>
                </svg>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:C.textDim,fontFamily:F.body,marginBottom:6,letterSpacing:0.5,textTransform:"uppercase"}}>Direction History</div>
                  {recent.slice(-6).reverse().map((s,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:i===0?C.text:C.textMid,fontFamily:F.body,marginBottom:2,fontWeight:i===0?"600":"400"}}>
                      <span>{i===0?"Now":i===1?"Recent":"Earlier"}</span>
                      <span>{s.windDir} {s.windSpeed!=null?Math.round(s.windSpeed)+" mph":""}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {shift && (
            <div style={{marginTop:12,padding:"10px 12px",borderRadius:10,background:`${shift.color}14`,border:`1px solid ${shift.color}44`,display:"flex",alignItems:"flex-start",gap:8}}>
              <span style={{fontSize:16,flexShrink:0}}>{shift.type==="veering"?"🔃":"🔄"}</span>
              <div style={{fontSize:13,color:C.text,lineHeight:1.5,fontFamily:F.body}}>{shift.label}</div>
            </div>
          )}
        </div>
      )}

      {/* ── 10-day forecast ── */}
      {forecast && forecast.length>0 && (
        <div style={css.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={css.label}>10-Day Frost Outlook</span>
              <InfoButton text="Daily overnight low for 10 days. Frost risk flagged when lows approach 32F."/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,marginBottom:6}}>
            {forecast.slice(0,10).map((day,i)=>{
              const fr=frostRisk(day.minF + tempOffset, 70, 5); const isToday=i===0;
              return (
                <div key={day.date} style={{textAlign:"center",padding:"8px 4px",borderRadius:10,background:fr.level!=="safe"?`${fr.color}18`:C.bg,border:`1px solid ${fr.level!=="safe"?fr.color:C.sep}`}}>
                  <div style={{fontSize:9,color:C.textDim,fontFamily:F.body,marginBottom:2}}>{isToday?"Today":new Date(day.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"})}</div>
                  <div style={{fontSize:12,fontWeight:"600",color:fr.level!=="safe"?fr.color:C.text,fontFamily:F.body}}>{Math.round(day.minF)}F</div>
                  <div style={{fontSize:10,color:C.textDim,fontFamily:F.body}}>{Math.round(day.maxF)}F</div>
                  {fr.level!=="safe" && <div style={{fontSize:9,color:fr.color,marginTop:2}}>❄</div>}
                  {day.rain>0.1 && <div style={{fontSize:9,color:"#60A5FA",marginTop:1}}>{day.rain.toFixed(1)}"</div>}
                </div>
              );
            })}
          </div>
          <div style={{fontSize:11,color:C.textMid,fontFamily:F.body}}>Top = overnight low · Bottom = daytime high</div>
          {forecast.slice(0,10).some(d=>frostRisk(d.minF + tempOffset,70,5).level!=="safe") && (
            <div style={{marginTop:8,padding:"8px 12px",background:"#FFF2F2",borderRadius:10,border:"1px solid #FFD0D0"}}>
              <div style={{fontSize:12,color:C.danger,fontFamily:F.body,fontWeight:"600"}}>Frost risk in the next 10 days</div>
            </div>
          )}
        </div>
      )}

      {/* ── 10-day history trends (toggle) ── */}
      <div style={css.card}>
        <button onClick={()=>setShowTrends(o=>!o)} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,letterSpacing:1,textTransform:"uppercase",fontFamily:F.body,display:"flex",alignItems:"center",gap:8,padding:0,width:"100%",justifyContent:"space-between",fontWeight:"600"}}>
          <span>10-Day History</span><span>{showTrends?"▲":"▼"}</span>
        </button>
        {showTrends && <div style={{marginTop:12}}><TenDayTrends history={history}/></div>}
      </div>

      {/* ── Naturalist Reading ── */}
      {weather && (
        <div style={{...css.card,background:"linear-gradient(135deg,#e8f5ee,#f0faf2)",borderColor:`${C.accent}33`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={css.label}>Naturalist's Reading</span>
              <InfoButton text="Brief technical field observation from current conditions, biological indicators for the season, and a 12-hour pressure-based outlook."/>
            </div>
            <button onClick={readField} style={{...css.btn,padding:"7px 14px",fontSize:13}}>
              {aiLoading ? "Reading…" : "Read the Field"}
            </button>
          </div>
          {aiText
            ? <div style={{fontSize:15,color:C.text,lineHeight:1.8,fontStyle:"italic",fontFamily:F.body}}>{aiText}</div>
            : <div style={{fontSize:13,color:C.textDim,lineHeight:1.6,fontFamily:F.body}}>Tap for a naturalist observation of current conditions and a 12-hour outlook{weather.source==="pws"?" using your backyard data":""}.</div>
          }
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── SETTINGS SHEET ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const HELP_SECTIONS = [
  { id:"start", emoji:"🚀", title:"Getting Started", color:C.accent, steps:[
    {title:"Add to home screen",body:"Open Plot in Safari. Tap the Share button then Add to Home Screen. Always open from your home screen icon for persistent storage."},
    {title:"Add your Anthropic API key",body:"Tap ⚙ and add your key from console.anthropic.com. This powers all AI features. Stored only on your device."},
    {title:"Connect your weather station",body:"Enter your AWN API key, Application key, and MAC address from ambientweather.net/account for true hyperlocal readings."},
    {title:"Add your plants",body:"Go to Garden → + Add. Each plant gets its own journal. Notes feed the AI advisor."},
    {title:"Start journaling",body:"Tap Journal on any plant card or use the General Log. Voice dictation auto-parses and links entries to plant journals."},
  ]},
  { id:"garden", emoji:"🥕", title:"Garden Tab", color:"#40916C", steps:[
    {title:"Watering Advisor",body:"Combines 24hr rainfall, adjusted humidity, temperature, and wind. Use the finger test to confirm."},
    {title:"Fungal Risk",body:"Tracks warm, wet, humid conditions. Elevated when humidity >80%, 60-85F, and >0.25\" recent rain."},
    {title:"Plant Journals",body:"Each plant has its own log. Voice dictation auto-parses clouds, signs, and notes. New plants mentioned by name are detected and offered for addition."},
    {title:"Garden Advisor",body:"AI advice using your conditions + journal history. References pressure trend to suggest upcoming windows."},
    {title:"Photo Diagnosis",body:"Photograph a sick plant for disease/pest analysis cross-referenced with your current conditions."},
  ]},
  { id:"yard", emoji:"🌾", title:"Yard Tab", color:"#52B788", steps:[
    {title:"Activity evaluator",body:"Select any task. Each has specific weather requirements evaluated pass/fail against your live data."},
    {title:"Verdicts",body:"Good to go = all clear. Wait = one condition marginal. Not today = critical failure. AI explains the blocker and estimates a window."},
    {title:"Product Label Scan",body:"Photograph any product label. AI reads requirements and checks them against today's conditions."},
  ]},
  { id:"now", emoji:"🌿", title:"Now Tab", color:C.accent, steps:[
    {title:"Pressure trend",body:"Most predictive single signal. Rapid fall (3+ hPa in 6hrs) means imminent weather change. Rising = improving."},
    {title:"10-Day Forecast",body:"Overnight lows flagged for frost risk. Critical for planning transplants and outdoor work windows."},
    {title:"Naturalist Reading",body:"AI field observation using your conditions — what species are active, what conditions mean, 12-hour outlook."},
    {title:"10-Day History",body:"Builds as you open the app. Shows temp range, rainfall, and pressure patterns over the past 10 days."},
  ]},
];

function HelpSection({ section }) {
  const [open, setOpen] = useState(null);
  return (
    <div style={{...css.section,marginBottom:10}}>
      <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.sep}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>{section.emoji}</span>
          <span style={{fontSize:15,fontWeight:"700",color:C.text,fontFamily:F.body}}>{section.title}</span>
        </div>
      </div>
      {section.steps.map((step,i)=>(
        <div key={i}>
          <div onClick={()=>setOpen(open===i?null:i)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 18px",cursor:"pointer",borderBottom:`1px solid ${C.sep}`,background:open===i?`${section.color}08`:"transparent"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:open===i?section.color:C.textDim,flexShrink:0}}/>
              <span style={{fontSize:14,fontWeight:"500",color:C.text,fontFamily:F.body,lineHeight:1.3}}>{step.title}</span>
            </div>
            <span style={{color:C.textDim,fontSize:11,marginLeft:8}}>{open===i?"▲":"▼"}</span>
          </div>
          {open===i && (
            <div style={{padding:"12px 18px 14px 34px",borderBottom:`1px solid ${C.sep}`,background:`${section.color}06`}}>
              <p style={{fontSize:14,color:C.textMid,lineHeight:1.7,fontFamily:F.body,margin:0}}>{step.body}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Settings({ onClose, tempOffset=0, offsetPairs=[], onManualOffset }) {
  const [apiKey,       setApiKey]       = useState(()=>localStorage.getItem("pl_awn_key")||"");
  const [macAddr,      setMacAddr]      = useState(()=>localStorage.getItem("pl_awn_mac")||"");
  const [appKey,       setAppKey]       = useState(()=>localStorage.getItem("pl_awn_appkey")||"");
  const [anthropicKey, setAnthropicKey] = useState(()=>localStorage.getItem("pl_anthropic_key")||"");
  const [saved,        setSaved]        = useState(false);
  const [restoreMsg,   setRestoreMsg]   = useState(null);
  const [helpSection,  setHelpSection]  = useState(null);
  const restoreRef = useRef();

  function exportBackup() {
    const plants = loadLS("pl_plants",[]);
    const journal = loadLS("pl_journal",[]);
    const history = loadLS("pl_history",[]);
    const plantJournals = {};
    plants.forEach(p=>{ const e=loadLS("pl_pjournal_"+p.id,[]); if(e.length) plantJournals["pl_pjournal_"+p.id]=e; });
    const blob = new Blob([JSON.stringify({version:APP_VERSION,exportedAt:new Date().toISOString(),pl_plants:plants,pl_journal:journal,pl_history:history,plantJournals},null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="plot-backup-"+new Date().toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"}).replace(/\//g,"-")+".json"; a.click(); URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.pl_plants)  saveLS("pl_plants",data.pl_plants);
        if (data.pl_journal) saveLS("pl_journal",data.pl_journal);
        if (data.pl_history) saveLS("pl_history",data.pl_history);
        if (data.plantJournals) Object.entries(data.plantJournals).forEach(([k,v])=>saveLS(k,v));
        setRestoreMsg({ok:true,text:`Restored ${data.pl_plants?.length||0} plants and ${data.pl_journal?.length||0} journal entries.`});
      } catch { setRestoreMsg({ok:false,text:"Could not read file. Make sure it is a Plot backup JSON."}); }
    };
    reader.readAsText(file);
  }

  function save() {
    localStorage.setItem("pl_awn_key",     apiKey.trim());
    localStorage.setItem("pl_awn_mac",     macAddr.trim().toUpperCase());
    localStorage.setItem("pl_awn_appkey",  appKey.trim());
    localStorage.setItem("pl_anthropic_key", anthropicKey.trim());
    setSaved(true);
    setTimeout(()=>{ setSaved(false); onClose(); }, 800);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"#00000066",zIndex:500,display:"flex",alignItems:"flex-end"}}>
      <div style={{width:"100%",maxWidth:480,margin:"0 auto",background:C.surface,borderRadius:"20px 20px 0 0",height:"88vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"20px 20px 12px",borderBottom:`1px solid ${C.sep}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:17,fontWeight:"700",color:C.text,fontFamily:F.body}}>Settings</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.textMid,fontSize:24,cursor:"pointer"}}>×</button>
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"16px 20px 40px"}}>

          {/* ── PWS ── */}
          <div style={{...css.card,borderColor:`${C.accent}33`,marginBottom:14}}>
            <span style={css.label}>Ambient Weather Station</span>
            <div style={{fontSize:13,color:C.textMid,lineHeight:1.6,marginBottom:10,fontFamily:F.body}}>
              Connect your PWS for true hyperlocal readings. Get keys from <span style={{color:C.accent}}>ambientweather.net/account</span>.
            </div>
            <div style={{fontSize:12,color:C.textMid,marginBottom:4,fontFamily:F.body}}>API Key</div>
            <input value={apiKey}  onChange={e=>setApiKey(e.target.value)}  placeholder="Your AWN API key…"         style={css.input}/>
            <div style={{fontSize:12,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Application Key</div>
            <input value={appKey}  onChange={e=>setAppKey(e.target.value)}  placeholder="Your AWN Application key…" style={css.input}/>
            <div style={{fontSize:12,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Station MAC Address</div>
            <input value={macAddr} onChange={e=>setMacAddr(e.target.value)} placeholder="e.g. 00:11:22:33:44:55"    style={{...css.input,marginBottom:0}}/>
          </div>

          {/* ── Anthropic ── */}
          <div style={{...css.card,borderColor:`${C.accent}33`,marginBottom:14}}>
            <span style={css.label}>Anthropic API Key</span>
            <div style={{fontSize:13,color:C.textMid,lineHeight:1.6,marginBottom:10,fontFamily:F.body}}>
              Powers all AI features. Get your key from <span style={{color:C.accent}}>console.anthropic.com</span>.
            </div>
            <input value={anthropicKey} onChange={e=>setAnthropicKey(e.target.value)} placeholder="sk-ant-…" style={{...css.input,marginBottom:0}}/>
          </div>

          <button onClick={save} style={{...css.btn,width:"100%",textAlign:"center",padding:"13px",fontSize:15,marginBottom:8}}>
            {saved?"Saved!":"Save Settings"}
          </button>
          <div style={{fontSize:12,color:C.textDim,textAlign:"center",marginBottom:20,fontFamily:F.body}}>
            No station? App uses Open-Meteo (free, grid-based) as fallback.
          </div>

          {/* ── Microclimate Temperature Calibration ── */}
          {offsetPairs.length > 0 && (
            <div style={{...css.card,borderColor:`${C.accent}33`,marginBottom:14}}>
              <span style={css.label}>Microclimate Calibration</span>
              <div style={{fontSize:13,color:C.textMid,lineHeight:1.6,marginBottom:12,fontFamily:F.body}}>
                Your PWS is compared against the Open-Meteo grid each fetch to learn how your yard differs from the regional average. This offset is applied to frost risk, soil temperature, and watering advice.
              </div>

              {/* Learned offset summary */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                {[
                  {l:"Learned Offset", v: (tempOffset>=0?"+":"")+tempOffset.toFixed(1)+"F", note: tempOffset<0?"Yard runs colder":tempOffset>0?"Yard runs warmer":"No difference"},
                  {l:"Readings Used",  v: offsetPairs.length, note: offsetPairs.length<10?"Building baseline…":"Reliable estimate"},
                  {l:"Latest Delta",   v: offsetPairs.length ? ((offsetPairs[offsetPairs.length-1].pws - offsetPairs[offsetPairs.length-1].grid)>=0?"+":"")+(offsetPairs[offsetPairs.length-1].pws - offsetPairs[offsetPairs.length-1].grid).toFixed(1)+"F" : "—", note:"PWS vs grid now"},
                ].map(s=>(
                  <div key={s.l} style={{background:C.bg,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:C.textDim,marginBottom:4,fontFamily:F.body,lineHeight:1.3}}>{s.l}</div>
                    <div style={{fontSize:18,color:tempOffset<-1?C.info:tempOffset>1?C.warn:C.good,fontFamily:F.num,fontWeight:"600"}}>{s.v}</div>
                    <div style={{fontSize:10,color:C.textDim,marginTop:3,fontFamily:F.body}}>{s.note}</div>
                  </div>
                ))}
              </div>

              {/* Recent pairs mini chart */}
              {offsetPairs.length > 1 && (
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:C.textMid,fontFamily:F.body,marginBottom:6,letterSpacing:0.5,textTransform:"uppercase"}}>PWS vs Grid — Recent Readings</div>
                  <div style={{display:"flex",gap:3,alignItems:"flex-end",height:40}}>
                    {offsetPairs.slice(-20).map((p,i)=>{
                      const diff = p.pws - p.grid;
                      const h = Math.min(38, Math.max(4, Math.abs(diff)*4));
                      return (
                        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                          <div style={{width:"100%",height:h,borderRadius:2,background:diff<0?C.info:C.warn,opacity:0.6+(i/20)*0.4}}/>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.textDim,fontFamily:F.body,marginTop:4}}>
                    <span>Older</span>
                    <span>Now</span>
                  </div>
                </div>
              )}

              {/* Manual override slider */}
              <div style={{borderTop:`1px solid ${C.sep}`,paddingTop:12}}>
                <div style={{fontSize:12,color:C.textMid,fontFamily:F.body,marginBottom:6}}>
                  Manual override: <span style={{color:C.accent,fontWeight:"600"}}>{(tempOffset>=0?"+":"")+tempOffset.toFixed(1)}F</span>
                  <span style={{color:C.textDim,marginLeft:6}}>(auto-learned unless you drag)</span>
                </div>
                <input type="range" min="-10" max="5" step="0.5" value={tempOffset}
                  onChange={e=>onManualOffset(parseFloat(e.target.value))}
                  style={{width:"100%",accentColor:C.accent,marginBottom:6}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.textDim,fontFamily:F.body}}>
                  <span>−10F (much colder)</span><span>0</span><span>+5F (warmer)</span>
                </div>
                <button onClick={()=>{
                  // Reset to learned average
                  if (offsetPairs.length>0) {
                    const avg = offsetPairs.reduce((s,p)=>s+(p.pws-p.grid),0)/offsetPairs.length;
                    onManualOffset(Math.round(avg*10)/10);
                  } else { onManualOffset(0); }
                }} style={{...css.btnSoft,marginTop:10,width:"100%",textAlign:"center",padding:"9px",fontSize:13}}>
                  Reset to Learned Value
                </button>
              </div>
            </div>
          )}

          {/* ── Backup ── */}
          <div style={{borderTop:`1px solid ${C.sep}`,paddingTop:20,marginBottom:20}}>
            <div style={{fontSize:14,fontWeight:"600",color:C.text,fontFamily:F.body,marginBottom:6}}>Data Backup</div>
            <div style={{fontSize:13,color:C.textMid,fontFamily:F.body,lineHeight:1.6,marginBottom:12}}>Export before updates. Import to restore.</div>
            <div style={{display:"flex",gap:10,marginBottom:8}}>
              <button onClick={exportBackup} style={{...css.btn,flex:1,textAlign:"center",padding:"11px",fontSize:13}}>Export</button>
              <button onClick={()=>restoreRef.current?.click()} style={{...css.btnSoft,flex:1,textAlign:"center",padding:"11px",fontSize:13}}>Restore</button>
            </div>
            {restoreMsg && <div style={{fontSize:13,color:restoreMsg.ok?C.accent:C.danger,fontFamily:F.body,textAlign:"center",padding:"10px",background:restoreMsg.ok?C.accentDim:"#FFF2F2",borderRadius:10}}>{restoreMsg.text}</div>}
            <input ref={restoreRef} type="file" accept=".json" style={{display:"none"}} onChange={e=>{ const f=e.target.files?.[0]; if(f) importBackup(f); }}/>
          </div>

          {/* ── Help ── */}
          <div style={{borderTop:`1px solid ${C.sep}`,paddingTop:20}}>
            <div style={{fontSize:14,fontWeight:"600",color:C.text,fontFamily:F.body,marginBottom:12}}>Help & Guide</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {HELP_SECTIONS.map(s=>(
                <button key={s.id} onClick={()=>setHelpSection(helpSection===s.id?null:s.id)} style={{padding:"6px 12px",borderRadius:980,fontSize:12,border:`1px solid ${helpSection===s.id?s.color:C.sep}`,cursor:"pointer",fontFamily:F.body,background:helpSection===s.id?`${s.color}18`:"transparent",color:helpSection===s.id?s.color:C.textMid}}>
                  {s.emoji} {s.title}
                </button>
              ))}
            </div>
            {helpSection && HELP_SECTIONS.filter(s=>s.id===helpSection).map(s=><HelpSection key={s.id} section={s}/>)}
          </div>

          <div style={{textAlign:"center",paddingTop:20,borderTop:`1px solid ${C.sep}`}}>
            <div style={{fontSize:13,color:C.textDim,fontFamily:F.body,lineHeight:1.7}}>
              Plot v{APP_VERSION}<br/>Weather app for people who do things outside.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id:"now",    label:"Now",    emoji:"🌿" },
  { id:"garden", label:"Garden", emoji:"🥕" },
  { id:"yard",   label:"Yard",   emoji:"🌾" },
];

export default function App() {
  const [tab,        setTab]        = useState("now");
  const [weather,    setWeather]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [locName,    setLocName]    = useState("");
  const [apiErr,     setApiErr]     = useState(null);
  const [history,    setHistory]    = useState(()=>{
    const h = loadLS("pl_history",[]);
    // Scrub any snapshots where precipitation looks like a cumulative daily total
    // (values > 2" in a single 15-30min snap are clearly wrong hourly figures)
    const clean = h.map(s => ({...s, precipitation: (s.precipitation||0) > 2 ? 0 : (s.precipitation||0)}));
    return clean;
  });
  const [forecast,   setForecast]   = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [tempOffset, setTempOffset] = useState(()=>{
    const raw = localStorage.getItem("pl_temp_off");
    const v = parseFloat(raw||"0");
    if (isNaN(v)) { localStorage.removeItem("pl_temp_off"); return 0; }
    return v;
  });
  const [offsetPairs,setOffsetPairs]= useState(()=>loadLS("pl_offset_pairs",[])); // [{pws,grid,ts}]

  useEffect(()=>{ fetchWeather(); },[]);
  useEffect(()=>{
    const iv = setInterval(()=>{ if (localStorage.getItem("pl_awn_key")) fetchWeather(); }, 5*60*1000);
    return ()=>clearInterval(iv);
  },[]);

  async function fetchWeather() {
    setLoading(true); setApiErr(null);
    const awnKey    = localStorage.getItem("pl_awn_key");
    const awnAppKey = localStorage.getItem("pl_awn_appkey");
    const awnMac    = localStorage.getItem("pl_awn_mac");

    try {
      if (awnKey && awnAppKey && awnMac) {
        try {
          const url = `https://rt.ambientweather.net/v1/devices/${encodeURIComponent(awnMac)}?apiKey=${awnKey}&applicationKey=${awnAppKey}&limit=1`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("AWN "+res.status);
          const data = await res.json();
          if (!data?.[0]) throw new Error("No AWN data — check MAC address");
          const d = data[0].lastData || data[0];
          if (d.tempf===undefined) throw new Error("Unexpected structure");
          const wx = {
            temperature_2m:     d.tempf,
            relative_humidity_2m:d.humidity,
            surface_pressure:   d.baromrelin ? d.baromrelin/0.02953 : 1013,
            wind_speed_10m:     d.windspeedmph||0,
            wind_direction_10m: d.winddir||0,
            precipitation:      d.hourlyrainin||0,
            rain24h:            d.dailyrainin||0,
            uv:                 d.uv??null,
            solar_radiation:    d.solarradiation??null,
            feels_like:         d.feelsLike??d.feelslike??null,
            dew_point:          d.dewPoint??d.dewpoint??null,
            source:"pws",
          };
          setWeather(wx); setLocName("Your Backyard");
          try {
            const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:5000}));
            // Fetch both forecast AND current grid temp in one call
            const fc = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current=temperature_2m&daily=temperature_2m_min,temperature_2m_max,precipitation_sum&temperature_unit=fahrenheit&timezone=auto&forecast_days=10`);
            const fd = await fc.json();
            if (fd.daily) setForecast(fd.daily.time.map((date,i)=>({date,minF:fd.daily.temperature_2m_min[i],maxF:fd.daily.temperature_2m_max[i],rain:fd.daily.precipitation_sum[i]||0})));
            // Record PWS vs grid pair for offset learning
            if (fd.current?.temperature_2m != null) {
              const pair = { pws: wx.temperature_2m, grid: fd.current.temperature_2m, ts: Date.now() };
              const existing = loadLS("pl_offset_pairs",[]);
              // Only record once per 30 min to avoid clustering
              const last = existing[existing.length-1];
              if (!last || Date.now()-last.ts > 30*60*1000) {
                const updated = [...existing, pair].slice(-96); // keep 48hrs of pairs
                saveLS("pl_offset_pairs", updated);
                setOffsetPairs(updated);
                // Compute rolling average offset (PWS - grid), negative means yard is colder
                const avg = updated.reduce((s,p)=>s+(p.pws-p.grid),0) / updated.length;
                const rounded = isNaN(avg) ? 0 : Math.round(avg*10)/10;
                saveLS("pl_temp_off", String(rounded));
                setTempOffset(rounded);
              }
            }
          } catch {}
          recordSnap(wx);
          setLoading(false);
          return;
        } catch(e) { setApiErr("PWS failed: "+e.message+". Using grid data."); }
      }

      // Fallback — Open-Meteo
      navigator.geolocation
        ? navigator.geolocation.getCurrentPosition(
            async p => {
              try {
                const [wr,gr] = await Promise.all([
                  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation&daily=temperature_2m_min,temperature_2m_max,precipitation_sum&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=10`),
                  fetch(`https://nominatim.openstreetmap.org/reverse?lat=${p.coords.latitude}&lon=${p.coords.longitude}&format=json`),
                ]);
                const w=await wr.json(), g=await gr.json(), c=w.current;
                const wx={...c,rain24h:0,uv:null,solar_radiation:null,feels_like:null,dew_point:null,source:"openmeteo"};
                if (w.daily) setForecast(w.daily.time.map((date,i)=>({date,minF:w.daily.temperature_2m_min[i],maxF:w.daily.temperature_2m_max[i],rain:w.daily.precipitation_sum[i]||0})));
                setWeather(wx);
                setLocName(g.address?.city||g.address?.town||g.address?.county||"Your Location");
                recordSnap(wx);
              } catch { useDemoData(); }
              setLoading(false);
            },
            ()=>{ useDemoData(); setLoading(false); }
          )
        : useDemoData();
    } catch { useDemoData(); }
    setLoading(false);
  }

  function recordSnap(wx) {
    // IMPORTANT: store hourly rain (precipitation), NOT rain24h (cumulative daily total).
    // Summing rain24h across snapshots inflates the total massively.
    const snap = {ts:Date.now(),temp:wx.temperature_2m,humidity:wx.relative_humidity_2m,pressure:wx.surface_pressure,windSpeed:wx.wind_speed_10m,windDir:windLabel(wx.wind_direction_10m),precipitation:wx.precipitation||0};
    const hist = loadLS("pl_history",[]);
    const last = hist[hist.length-1];
    const minInterval = wx.source==="pws" ? 15*60*1000 : 30*60*1000;
    if (!last || Date.now()-last.ts > minInterval) {
      const u = [...hist,snap].slice(-1000);
      setHistory(u); saveLS("pl_history",u);
    }
  }

  function useDemoData() {
    const today = new Date();
    setWeather({temperature_2m:62,relative_humidity_2m:68,surface_pressure:1013,wind_speed_10m:8,wind_direction_10m:225,precipitation:0,rain24h:0,uv:null,solar_radiation:null,feels_like:null,dew_point:null,source:"openmeteo"});
    setForecast(Array.from({length:10},(_,i)=>{
      const d=new Date(today); d.setDate(d.getDate()+i);
      return {date:d.toISOString().split("T")[0],minF:38+Math.sin(i*0.8)*8+Math.random()*4,maxF:58+Math.sin(i*0.6)*10+Math.random()*5,rain:i===2||i===5?0.4+Math.random()*0.6:0};
    }));
    setLocName("Morris County, NJ");
    setApiErr("Using demo data — connect your PWS in Settings.");
  }

  const frost = weather ? frostRisk(weather.temperature_2m + tempOffset, weather.relative_humidity_2m, weather.wind_speed_10m) : null;
  const showFrostBadge = frost && frost.level !== "safe";

  return (
    <div style={{fontFamily:F.body,background:C.bg,height:"100dvh",color:C.text,maxWidth:480,margin:"0 auto",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {showSettings && <Settings onClose={()=>{ setShowSettings(false); fetchWeather(); }} tempOffset={tempOffset} offsetPairs={offsetPairs} onManualOffset={(v)=>{ const safe = isNaN(v) ? 0 : v; setTempOffset(safe); localStorage.setItem("pl_temp_off",String(safe)); }}/>}

      {/* ── Header ── */}
      <div style={{background:"#2D6A4F",padding:"max(env(safe-area-inset-top,18px),18px) 20px 14px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:22,fontWeight:"700",color:"#fff",fontFamily:F.body,letterSpacing:-0.5}}>Plot</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",marginTop:1,fontFamily:F.body}}>
              {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
            </div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:1,fontFamily:F.body}}>v{APP_VERSION}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{textAlign:"right"}}>
              {weather && <div style={{fontSize:40,color:"#fff",fontWeight:"200",lineHeight:1,letterSpacing:-2,fontFamily:F.num}}>{Math.round(weather.temperature_2m)}<span style={{fontSize:22,fontWeight:"300"}}>°</span></div>}
              <div style={{fontSize:11,color:"rgba(255,255,255,0.65)",fontFamily:F.body,marginTop:2}}>
                {weather?.source==="pws" ? "📡 Backyard" : `📍 ${locName||"Locating…"}`}
              </div>
              {showFrostBadge && <div style={{fontSize:11,color:"#FFE5E5",fontWeight:"600",marginTop:2}}>❄ {frost.label}</div>}
              {!isNaN(tempOffset) && tempOffset!==0 && weather?.source==="pws" && <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:1,fontFamily:F.body}}>{tempOffset>0?"+":""}{tempOffset.toFixed(1)}F yard adj</div>}
            </div>
            <button onClick={()=>setShowSettings(true)} style={{background:"rgba(255,255,255,0.18)",border:"none",color:"#fff",borderRadius:12,padding:"8px 12px",cursor:"pointer",fontSize:16}}>⚙</button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"14px 14px 20px"}}>
        {tab==="now"    && <Now    weather={weather} locationName={locName} loading={loading} apiError={apiErr} history={history} forecast={forecast} tempOffset={tempOffset}/>}
        {tab==="garden" && <Garden weather={weather} history={history} tempOffset={tempOffset}/>}
        {tab==="yard"   && <Yard   weather={weather} history={history}/>}
      </div>

      {/* ── Tab bar ── */}
      <div style={{display:"flex",borderTop:`1px solid ${C.sep}`,background:"rgba(255,255,255,0.97)",flexShrink:0,paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"8px 2px 10px",border:"none",background:"transparent",color:tab===t.id?C.accent:"#8E8E93",fontSize:10,cursor:"pointer",fontFamily:F.body,display:"flex",flexDirection:"column",alignItems:"center",gap:2,fontWeight:tab===t.id?"700":"400",borderTop:tab===t.id?`2px solid ${C.accent}`:"2px solid transparent"}}>
            <span style={{fontSize:22}}>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
