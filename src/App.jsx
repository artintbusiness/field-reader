import { useState, useEffect, useRef, useCallback } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:        "#0a0f0a",
  surface:   "#111711",
  card:      "#151e15",
  cardBorder:"#1e2e1e",
  cardHover: "#1a251a",
  accent:    "#5cdb7a",
  accentDim: "#2d6b3d",
  text:      "#d8edcc",
  textMid:   "#8aad8a",
  textDim:   "#3d5c3d",
  danger:    "#f87171",
  warn:      "#fbbf24",
  info:      "#7dd3fc",
  good:      "#5cdb7a",
};

const F = {
  display: "'Playfair Display', 'Georgia', serif",
  body:    "'DM Mono', 'Courier New', monospace",
};

const css = {
  card: {
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 16,
    padding: "16px 18px",
    marginBottom: 12,
  },
  label: {
    fontSize: 9,
    letterSpacing: 3,
    color: C.accent,
    textTransform: "uppercase",
    marginBottom: 10,
    display: "block",
    fontFamily: F.body,
  },
  input: {
    width: "100%",
    background: "#0d140d",
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 10,
    padding: "12px 14px",
    color: C.text,
    fontSize: 13,
    marginBottom: 10,
    fontFamily: F.body,
    outline: "none",
    boxSizing: "border-box",
  },
  btn: {
    background: C.accentDim,
    border: `1px solid ${C.accent}55`,
    color: C.accent,
    padding: "10px 18px",
    borderRadius: 24,
    fontSize: 11,
    cursor: "pointer",
    fontFamily: F.body,
    letterSpacing: 1,
    transition: "all 0.15s",
  },
  tag: (color) => ({
    fontSize: 9,
    padding: "3px 10px",
    borderRadius: 20,
    background: `${color}22`,
    color,
    letterSpacing: 1,
    fontFamily: F.body,
  }),
};

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function hpa2hg(hpa) { return (hpa * 0.02953).toFixed(2); }
function windLabel(deg) {
  const d = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return d[Math.round(deg / 22.5) % 16];
}
function loadLS(k, def) {
  try { return JSON.parse(localStorage.getItem(k) ?? JSON.stringify(def)); } catch { return def; }
}
function saveLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

// Resize image before sending to API
async function resizeImage(file, maxDim = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
    };
    img.src = url;
  });
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
  if (d < -3) return { trend:"falling_fast", delta:d, label:`Falling fast (${d.toFixed(1)} hPa)` };
  if (d < -1) return { trend:"falling",      delta:d, label:`Falling (${d.toFixed(1)} hPa)` };
  if (d >  3) return { trend:"rising_fast",  delta:d, label:`Rising fast (+${d.toFixed(1)} hPa)` };
  if (d >  1) return { trend:"rising",       delta:d, label:`Rising (+${d.toFixed(1)} hPa)` };
  return { trend:"stable", delta:d, label:"Stable" };
}
function frostRisk(tempF, hum, wind) {
  const rad = wind < 5 && hum < 70;
  if (tempF <= 28) return { level:"danger",  label:"Hard Frost",    color:C.danger, desc:"Protect all plants immediately." };
  if (tempF <= 32) return { level:"danger",  label:"Frost",         color:"#fb923c", desc:"Cover vulnerable plants, bring in containers." };
  if (tempF <= 36 && rad) return { level:"caution", label:"Frost Possible", color:C.warn, desc:"Clear + calm — radiative cooling may reach 32°F." };
  if (tempF <= 40) return { level:"watch",   label:"Frost Watch",   color:C.warn, desc:"Keep frost cloth accessible." };
  return { level:"safe", label:"No Frost Risk", color:C.good, desc:"Well above threshold." };
}
function wateringAdv(wx, hist, offset=0) {
  const rain = hist.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const hum  = Math.max(0, Math.min(100, wx.relative_humidity_2m - offset));
  const tmp  = wx.temperature_2m;
  const et   = (tmp-50)*0.3 + (100-hum)*0.2 + wx.wind_speed_10m*0.5;
  if (rain > 0.5)           return { action:"skip",  label:"Skip watering",  color:C.good,    emoji:"💧", desc:`${rain.toFixed(2)}" rain in 48hrs.` };
  if (hum > 80 && tmp < 85) return { action:"skip",  label:"Probably skip",  color:"#86efac", emoji:"🌿", desc:`High humidity (${Math.round(hum)}%) — finger-test first.` };
  if (et > 25 || tmp > 85)  return { action:"water", label:"Water today",    color:C.warn,    emoji:"🚿", desc:`${tmp>85?"Hot conditions":"High ET"} — water deeply, early morning.` };
  if (tmp < 55 && hum > 60) return { action:"skip",  label:"Hold off",       color:C.good,    emoji:"🌡️", desc:"Cool and humid. Check manually." };
  return { action:"check", label:"Check soil", color:C.textMid, emoji:"👆", desc:"If top 2\" dry, water. If moist, wait." };
}
function fungalRisk(wx, hist, offset=0) {
  const rain = hist.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const hum  = Math.max(0, Math.min(100, wx.relative_humidity_2m - offset));
  const tmp  = wx.temperature_2m;
  const wet  = hist.slice(-96).filter(s=>s.precipitation>0.01).length;
  if (hum>80 && tmp>60 && tmp<85 && (rain>0.25||wet>6))
    return { level:"high", label:"High Fungal Risk", color:C.danger, desc:"Warm + wet + humid. Inspect plants today. Consider copper or sulfur treatment." };
  if (hum>70 && tmp>55 && rain>0.1)
    return { level:"moderate", label:"Moderate Risk", color:C.warn, desc:"Favor fungal development. Improve air circulation, avoid overhead watering." };
  return { level:"low", label:"Low Risk", color:C.good, desc:"Conditions not favorable for fungal disease." };
}

// ─── LAWN LOGIC ───────────────────────────────────────────────────────────────
function lawnTasks(wx, hist, month) {
  const soil   = soilEst(wx.temperature_2m, month);
  const rain48 = hist.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const hum    = wx.relative_humidity_2m;
  const tmp    = wx.temperature_2m;
  const wind   = wx.wind_speed_10m;
  const rain3d = hist.slice(-144).reduce((s,r)=>s+(r.precipitation||0),0);
  const trend  = pressureTrend(hist);
  const tasks  = [];

  // Pre-emergent
  const preReady = soil >= 50 && soil <= 60;
  const preWindow = soil >= 45 && soil < 65;
  tasks.push({
    id:"preemergent",
    name:"Pre-emergent Herbicide",
    category:"lawn",
    emoji:"🌱",
    ready: preReady,
    window: preWindow,
    color: preReady ? C.good : preWindow ? C.warn : C.textDim,
    status: preReady ? "Apply now" : preWindow ? "Window opening" : soil < 45 ? `Wait — soil ${soil}°F (need 50°F)` : "Window closing — soil too warm",
    desc: preReady
      ? `Soil at ${soil}°F — crabgrass germination window is open. Apply within 7–10 days. Rain within 48hrs will activate.`
      : preWindow
      ? `Soil at ${soil}°F and rising. Pre-emergent window opens at 50°F. Monitor closely.`
      : `Soil at ${soil}°F. Pre-emergent is most effective when soil crosses 50°F consistently.`,
    conditions: [{label:"Soil Temp", value:`${soil}°F`, ok: soil>=50&&soil<=62},
                 {label:"Rain 48hr", value:`${rain48.toFixed(2)}"`, ok: rain48<0.5},
                 {label:"Forecast",  value: trend.trend==="stable"?"Stable":"Changing", ok: trend.trend!=="falling_fast"}],
  });

  // Fertilizer
  const fertReady = soil>=55 && tmp>=50 && tmp<=85 && rain48<0.25 && rain3d<1.5;
  tasks.push({
    id:"fertilizer",
    name:"Lawn Fertilizer",
    category:"lawn",
    emoji:"🌿",
    ready: fertReady,
    color: fertReady ? C.good : C.warn,
    status: fertReady ? "Good conditions" : rain48>0.5 ? "Wait — too wet" : tmp<50 ? "Too cold" : tmp>85 ? "Too hot" : "Check conditions",
    desc: fertReady
      ? "Good window: soil warm, turf actively growing, and no heavy rain to wash it out. Apply in late afternoon."
      : rain48>0.5
      ? `Recent rain (${rain48.toFixed(2)}") — wait until soil surface dries. Applying now risks runoff.`
      : tmp<50
      ? "Turf not actively growing below 50°F. Wait for sustained warmth."
      : "Conditions marginal. Ideal: 50–85°F air, soil above 55°F, no rain for 24hrs before or after.",
    conditions: [{label:"Air Temp",  value:`${Math.round(tmp)}°F`, ok:tmp>=50&&tmp<=85},
                 {label:"Soil Temp", value:`${soil}°F`, ok:soil>=55},
                 {label:"Rain 48hr", value:`${rain48.toFixed(2)}"`, ok:rain48<0.25}],
  });

  // Overseeding
  const overseedMonth = month>=8 && month<=10;
  const overseedReady = overseedMonth && soil>=50 && soil<=65 && rain48<0.5;
  tasks.push({
    id:"overseed",
    name:"Overseeding",
    category:"lawn",
    emoji:"🌾",
    ready: overseedReady,
    color: overseedReady ? C.good : overseedMonth ? C.warn : C.textDim,
    status: overseedReady ? "Prime window" : !overseedMonth ? `Off-season (best: Sept–Nov)` : soil>65 ? "Soil too warm" : "Check conditions",
    desc: overseedReady
      ? "Ideal: soil 50–65°F, good seed-soil contact possible, and no heavy rain to wash seed away. Water lightly twice daily for 2 weeks."
      : !overseedMonth
      ? "Best overseeding window is September through mid-October in NJ — soil warm enough to germinate but cooling nights slow competition."
      : "Wait for soil to cool below 65°F. Germination rates are poor in warm soil.",
    conditions: [{label:"Soil Temp", value:`${soil}°F`, ok:soil>=50&&soil<=65},
                 {label:"Season",    value: overseedMonth?"In window":"Off-season", ok:overseedMonth},
                 {label:"Rain 48hr", value:`${rain48.toFixed(2)}"`, ok:rain48<0.5}],
  });

  // Mowing
  const mowReady = hum < 70 && tmp > 45 && rain48 < 0.1 && wind < 20;
  tasks.push({
    id:"mow",
    name:"Mowing Window",
    category:"lawn",
    emoji:"✂️",
    ready: mowReady,
    color: mowReady ? C.good : C.warn,
    status: mowReady ? "Good to mow" : rain48>0.1 ? "Wet — wait" : hum>75 ? "Too humid" : wind>20 ? "Too windy" : "Marginal",
    desc: mowReady
      ? `Good mowing conditions: humidity ${Math.round(hum)}%, ${Math.round(tmp)}°F, ${Math.round(wind)} mph wind. Dry grass cuts cleaner and clumps less.`
      : rain48>0.1
      ? `${rain48.toFixed(2)}" of recent rain — wet grass tears rather than cuts cleanly and promotes fungal spread. Wait until dry.`
      : hum>75
      ? "High humidity means grass blades are damp. Mowing wet grass clogs the deck and spreads disease."
      : "Conditions marginal for mowing.",
    conditions: [{label:"Humidity",  value:`${Math.round(hum)}%`, ok:hum<70},
                 {label:"Rain 48hr", value:`${rain48.toFixed(2)}"`, ok:rain48<0.1},
                 {label:"Wind",      value:`${Math.round(wind)} mph`, ok:wind<20}],
  });

  return tasks;
}

// ─── PROJECT LOGIC ────────────────────────────────────────────────────────────
function projectTasks(wx, hist) {
  const tmp    = wx.temperature_2m;
  const hum    = wx.relative_humidity_2m;
  const wind   = wx.wind_speed_10m;
  const rain48 = hist.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const trend  = pressureTrend(hist);
  const rainComing = trend.trend === "falling_fast" || trend.trend === "falling";
  const tasks  = [];

  // Painting
  const paintReady = tmp>=50 && tmp<=90 && hum<=70 && rain48<0.1 && !rainComing;
  tasks.push({
    id:"paint",
    name:"Exterior Painting",
    category:"project",
    emoji:"🎨",
    ready: paintReady,
    color: paintReady ? C.good : C.warn,
    status: paintReady ? "Good window" : tmp<50?"Too cold" : tmp>90?"Too hot" : hum>70?"Too humid" : rain48>0.1?"Too wet" : rainComing?"Rain coming":"Check conditions",
    desc: paintReady
      ? `Excellent: ${Math.round(tmp)}°F, ${Math.round(hum)}% humidity, pressure stable. Surface temp should be checked — avoid direct afternoon sun on dark surfaces.`
      : tmp<50
      ? `${Math.round(tmp)}°F is below the 50°F minimum for most latex paints. Below 50°F, paint won't cure properly and will peel.`
      : hum>70
      ? `Humidity at ${Math.round(hum)}% — paint won't dry evenly above 70%. Wait for drier conditions.`
      : rainComing
      ? "Pressure falling — rain likely within 12–24hrs. Paint needs 24hrs dry time minimum."
      : "Conditions marginal. Need: 50–90°F, humidity <70%, no rain 24hrs before/after.",
    conditions: [{label:"Temp",     value:`${Math.round(tmp)}°F`, ok:tmp>=50&&tmp<=90},
                 {label:"Humidity", value:`${Math.round(hum)}%`,  ok:hum<=70},
                 {label:"Rain",     value:rain48>0?`${rain48.toFixed(2)}"`:rainComing?"Coming":"Clear", ok:rain48<0.1&&!rainComing}],
  });

  // Staining / sealing
  const stainReady = tmp>=50 && tmp<=90 && hum<=65 && rain48<0.1 && !rainComing;
  tasks.push({
    id:"stain",
    name:"Wood Stain / Deck Sealing",
    category:"project",
    emoji:"🪵",
    ready: stainReady,
    color: stainReady ? C.good : C.warn,
    status: stainReady ? "Good window" : hum>65?"Too humid" : tmp<50?"Too cold" : rainComing?"Rain coming":"Check conditions",
    desc: stainReady
      ? "Good conditions for staining. Wood should be clean and dry — wait 48hrs after any rain before staining bare wood."
      : hum>65
      ? `Humidity at ${Math.round(hum)}% — stain needs below 65% to penetrate properly. High humidity causes blotchy finish and slow cure.`
      : tmp<50
      ? "Below 50°F, stain won't penetrate or cure. Most oil-based products need 50°F+ for 24hrs after application."
      : rainComing
      ? "Do not start — rain within 24hrs will wash uncured stain away. Wait for a clear 48hr window.",
    conditions: [{label:"Temp",     value:`${Math.round(tmp)}°F`, ok:tmp>=50&&tmp<=90},
                 {label:"Humidity", value:`${Math.round(hum)}%`,  ok:hum<=65},
                 {label:"Rain",     value:rain48>0?`${rain48.toFixed(2)}"`:rainComing?"Coming":"Clear", ok:rain48<0.1&&!rainComing}],
  });

  // Caulking
  const caulkReady = tmp>=40 && tmp<=90 && hum<=80 && rain48<0.1;
  tasks.push({
    id:"caulk",
    name:"Exterior Caulking / Sealing",
    category:"project",
    emoji:"🔧",
    ready: caulkReady,
    color: caulkReady ? C.good : C.warn,
    status: caulkReady ? "Good window" : tmp<40?"Too cold" : rain48>0.1?"Too wet":"Check conditions",
    desc: caulkReady
      ? "Good caulking conditions. Clean and dry the surface first. Most silicone caulks need 30 min before rain; polyurethane needs 4–8hrs."
      : tmp<40
      ? "Below 40°F silicone caulk won't cure properly and loses adhesion. Most products require 40°F+ for 24hrs."
      : "Surface needs to be dry. Wait 24hrs after rain for porous surfaces like wood and concrete.",
    conditions: [{label:"Temp",     value:`${Math.round(tmp)}°F`, ok:tmp>=40&&tmp<=90},
                 {label:"Humidity", value:`${Math.round(hum)}%`,  ok:hum<=80},
                 {label:"Rain",     value:rain48>0?`${rain48.toFixed(2)}"`:rainComing?"Coming":"Clear", ok:rain48<0.1}],
  });

  // Concrete / masonry
  const concreteReady = tmp>=50 && tmp<=90 && hum<=80 && rain48<0.1 && !rainComing && wind<15;
  tasks.push({
    id:"concrete",
    name:"Concrete / Masonry Work",
    category:"project",
    emoji:"🧱",
    ready: concreteReady,
    color: concreteReady ? C.good : C.warn,
    status: concreteReady?"Good window":tmp<50?"Too cold":tmp>90?"Too hot":wind>15?"Too windy":rainComing?"Rain coming":"Check conditions",
    desc: concreteReady
      ? `${Math.round(tmp)}°F, low wind, no rain — good concrete window. Avoid direct sun on hot days; cover with burlap and keep moist for 7 days for full cure.`
      : tmp<50
      ? "Concrete won't cure properly below 50°F. Cold temps cause cracking and weak final strength."
      : rainComing
      ? "Rain will wash out fresh concrete surface. Need a clear 24hr window after pour."
      : wind>15
      ? "High wind dries the surface too fast causing cracking. Use windbreaks or reschedule.",
    conditions: [{label:"Temp",  value:`${Math.round(tmp)}°F`,  ok:tmp>=50&&tmp<=90},
                 {label:"Wind",  value:`${Math.round(wind)} mph`, ok:wind<15},
                 {label:"Rain",  value:rain48>0?`${rain48.toFixed(2)}"`:rainComing?"Coming":"Clear", ok:rain48<0.1&&!rainComing}],
  });

  return tasks;
}

// ─── COMPOSTING LOGIC ─────────────────────────────────────────────────────────
function compostStatus(wx, hist) {
  const tmp    = wx.temperature_2m;
  const hum    = wx.relative_humidity_2m;
  const rain48 = hist.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const soil   = soilEst(tmp, new Date().getMonth());

  const active = soil >= 55 && soil <= 160;
  const tooDry = hum < 40 && rain48 < 0.1;
  const tooWet = rain48 > 1.0;
  const tooCold = soil < 40;

  return {
    active,
    soilTemp: soil,
    moisture: tooWet ? "Too wet" : tooDry ? "Too dry" : "Good",
    turning: active && !tooDry && !tooWet,
    color: active ? C.good : tooCold ? C.info : C.warn,
    label: active ? "Active decomposition" : tooCold ? "Dormant — too cold" : "Slow activity",
    desc: active
      ? `Pile at ~${soil}°F — microbial activity is strong. ${tooWet?"Too much recent rain — add browns (cardboard, dry leaves) to absorb moisture.":tooDry?"Conditions dry — moisten pile when turning.":"Good moisture conditions. Turn weekly to maintain heat."}`
      : tooCold
      ? `Soil below 40°F — decomposition has slowed significantly. Pile is dormant for winter. Can still add material.`
      : `Soil at ${soil}°F — activity is slow. As temps warm, activity will increase.`,
    tips: [
      { label:"Pile Temp Est.",  value:`~${soil}°F`, ok:soil>=55&&soil<=160 },
      { label:"Moisture",        value:tooWet?"Too wet":tooDry?"Too dry":"OK", ok:!tooWet&&!tooDry },
      { label:"Turn today?",     value:active&&!tooWet?"Yes":"No", ok:active&&!tooWet },
    ],
  };
}

// ─── MINI CHART ───────────────────────────────────────────────────────────────
function Spark({ data, color, h=36 }) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data);
  const rng = mx - mn || 1;
  const w = 100/(data.length-1);
  const pts = data.map((v,i)=>`${i*w},${h-((v-mn)/rng)*(h-6)-3}`).join(" ");
  const lv = data[data.length-1];
  const lx = 100, ly = h-((lv-mn)/rng)*(h-6)-3;
  return (
    <svg viewBox={`0 0 100 ${h}`} style={{width:"100%",height:h,display:"block"}} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g${color.replace("#","")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} 100,${h}`} fill={`url(#g${color.replace("#","")})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={lx} cy={ly} r="2.5" fill={color}/>
    </svg>
  );
}

// ─── CONDITION PILLS ─────────────────────────────────────────────────────────
function CondPills({ conditions }) {
  return (
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
      {conditions.map(c=>(
        <div key={c.label} style={{background:c.ok?"#0d2010":"#1a0d0d",border:`1px solid ${c.ok?C.accentDim:"#3d1515"}`,borderRadius:8,padding:"5px 10px",display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:10,color:c.ok?C.accent:C.danger}}>●</span>
          <span style={{fontSize:10,color:C.textMid,fontFamily:F.body}}>{c.label}</span>
          <span style={{fontSize:11,color:c.ok?C.text:C.warn,fontFamily:F.body}}>{c.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────
function TaskCard({ task }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={()=>setOpen(o=>!o)} style={{
      ...css.card,
      cursor:"pointer",
      borderColor: task.ready ? `${task.color}55` : C.cardBorder,
      background: task.ready ? `${task.color}08` : C.card,
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>{task.emoji}</span>
          <div>
            <div style={{fontSize:13,color:C.text,fontFamily:F.body}}>{task.name}</div>
            <div style={{fontSize:10,color:task.color,marginTop:1,fontFamily:F.body}}>{task.status}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {task.ready && <span style={{width:8,height:8,borderRadius:"50%",background:task.color,display:"block",boxShadow:`0 0 8px ${task.color}`}}/>}
          <span style={{color:C.textDim,fontSize:12}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open && (
        <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.cardBorder}`}}>
          <div style={{fontSize:12,color:C.textMid,lineHeight:1.7,fontFamily:F.body}}>{task.desc}</div>
          {task.conditions && <CondPills conditions={task.conditions}/>}
        </div>
      )}
    </div>
  );
}

// ─── PHOTO AI ─────────────────────────────────────────────────────────────────
function PhotoAI({ weather, history }) {
  const [mode, setMode] = useState("disease");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const soil   = weather ? soilEst(weather.temperature_2m, new Date().getMonth()) : "—";
  const rain48 = history.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const hum    = weather ? Math.round(weather.relative_humidity_2m) : "—";
  const tmp    = weather ? Math.round(weather.temperature_2m) : "—";

  async function handleFile(file) {
    if (!file) return;
    setResult("");
    setPreview(URL.createObjectURL(file));
    const b64 = await resizeImage(file, 1024);
    setImage(b64);
  }

  async function analyze() {
    if (!image || !weather) return;
    setLoading(true); setResult("");
    const prompts = {
      disease: `You are a plant pathologist and expert gardener. Analyze this photo for disease, pest damage, or nutritional deficiencies.

Current weather context:
- Temperature: ${tmp}°F, Humidity: ${hum}%, Soil temp: ${soil}°F
- 48hr rainfall: ${rain48.toFixed(2)}", Recent fungal risk: ${fungalRisk(weather,history).label}

Provide: 1) Most likely diagnosis 2) Confidence level 3) What the weather conditions suggest about cause 4) Specific treatment recommendation 5) What to watch for next. Be specific and practical.`,

      product: `You are an expert agronomist and home improvement specialist. Read this product label carefully.

Current conditions:
- Air temp: ${tmp}°F, Humidity: ${hum}%, Soil temp: ${soil}°F
- 48hr rainfall: ${rain48.toFixed(2)}"
- Date: ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric"})}

Extract: 1) Product name and type 2) Application temperature range from label 3) Are current conditions within spec? 4) Any rain/watering requirements 5) Specific recommendation: apply now, wait, or avoid? Give a direct yes/no on whether today is a good day to apply.`,
    };
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{
            role:"user",
            content:[
              {type:"image", source:{type:"base64",media_type:"image/jpeg",data:image}},
              {type:"text",  text:prompts[mode]},
            ],
          }],
        }),
      });
      const data = await res.json();
      setResult(data.content?.find(b=>b.type==="text")?.text || "");
    } catch { setResult("Analysis failed — check your connection."); }
    setLoading(false);
  }

  return (
    <div>
      <div style={{...css.card,background:"linear-gradient(135deg,#0f1f0f,#0a140a)",borderColor:`${C.accent}33`}}>
        <span style={css.label}>📸 Photo Analysis</span>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          {[["disease","🌿 Plant Diagnosis"],["product","📦 Product Label"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>{setMode(id);setResult("");}} style={{
              flex:1,padding:"10px 6px",borderRadius:12,fontSize:11,border:`1px solid ${mode===id?C.accent:C.cardBorder}`,
              cursor:"pointer",fontFamily:F.body,letterSpacing:0.5,
              background:mode===id?`${C.accent}18`:"transparent",
              color:mode===id?C.accent:C.textMid,
            }}>{lbl}</button>
          ))}
        </div>

        {/* Upload area */}
        <div onClick={()=>fileRef.current?.click()} style={{
          border:`2px dashed ${preview?C.accentDim:C.cardBorder}`,borderRadius:12,
          padding:preview?"0":"28px 16px",textAlign:"center",cursor:"pointer",
          marginBottom:12,overflow:"hidden",transition:"all 0.2s",
          background:preview?"transparent":"#0d140d",
        }}>
          {preview
            ? <img src={preview} alt="upload" style={{width:"100%",borderRadius:10,display:"block",maxHeight:240,objectFit:"cover"}}/>
            : <div>
                <div style={{fontSize:28,marginBottom:6}}>📷</div>
                <div style={{fontSize:12,color:C.textMid,fontFamily:F.body}}>Tap to upload photo</div>
                <div style={{fontSize:10,color:C.textDim,marginTop:3,fontFamily:F.body}}>Auto-resized for analysis</div>
              </div>
          }
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}}
          onChange={e=>handleFile(e.target.files?.[0])}/>

        {preview && (
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button onClick={analyze} disabled={loading||!image} style={{
              ...css.btn,flex:1,textAlign:"center",padding:"12px",
              opacity:loading||!image?0.5:1,
            }}>{loading?"Analyzing…":"Analyze Photo"}</button>
            <button onClick={()=>{setPreview(null);setImage(null);setResult("");}} style={{
              background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textMid,
              padding:"12px 16px",borderRadius:24,fontSize:11,cursor:"pointer",fontFamily:F.body,
            }}>Clear</button>
          </div>
        )}

        {result && (
          <div style={{background:"#0a140a",border:`1px solid ${C.accentDim}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:9,color:C.accent,letterSpacing:2,marginBottom:8,fontFamily:F.body}}>
              {mode==="disease"?"DIAGNOSIS":"PRODUCT ANALYSIS"}
            </div>
            <div style={{fontSize:13,color:C.text,lineHeight:1.8,fontFamily:F.body,whiteSpace:"pre-line"}}>{result}</div>
          </div>
        )}

        {!weather && (
          <div style={{fontSize:11,color:C.warn,fontFamily:F.body,marginTop:8}}>
            ⚠ Weather data loading — analysis will include conditions once available.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GARDEN TAB ───────────────────────────────────────────────────────────────
const PLANT_PRESETS=[{name:"Fig Tree",emoji:"🌳"},{name:"Lemon Tree",emoji:"🍋"},{name:"Tomato",emoji:"🍅"},{name:"Pepper",emoji:"🫑"},{name:"Eggplant",emoji:"🍆"},{name:"Brussels Sprouts",emoji:"🥦"},{name:"Lettuce",emoji:"🥬"},{name:"Herbs",emoji:"🌿"}];
const SEED_TEMPS={"Tomatoes":{min:60,opt:75},"Peppers":{min:65,opt:80},"Eggplant":{min:65,opt:80},"Brussels Sprouts":{min:45,opt:65},"Lettuce":{min:35,opt:60},"Beans":{min:60,opt:75},"Cucumber":{min:60,opt:75},"Carrots":{min:45,opt:65}};

function Garden({ weather, history }) {
  const [plants,   setPlants]   = useState(()=>loadLS("pl_plants",[]));
  const [showAdd,  setShowAdd]  = useState(false);
  const [np,       setNp]       = useState({name:"",emoji:"🌱",location:"garden bed",planted:""});
  const [offset,   setOffset]   = useState(()=>parseFloat(localStorage.getItem("pl_hum_off")||"0"));
  const [showCal,  setShowCal]  = useState(false);
  const [advice,   setAdvice]   = useState("");
  const [advLoad,  setAdvLoad]  = useState(false);

  const month  = new Date().getMonth();
  const soil   = weather ? soilEst(weather.temperature_2m, month) : null;
  const frost  = weather ? frostRisk(weather.temperature_2m, weather.relative_humidity_2m, weather.wind_speed_10m) : null;
  const water  = weather ? wateringAdv(weather, history, offset) : null;
  const fungal = weather ? fungalRisk(weather, history, offset) : null;
  const rain48 = history.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const adjHum = weather ? Math.max(0,Math.min(100,weather.relative_humidity_2m-offset)) : 0;

  function addPlant() {
    if (!np.name) return;
    const u=[...plants,{...np,id:Date.now()}]; setPlants(u); saveLS("pl_plants",u); setNp({name:"",emoji:"🌱",location:"garden bed",planted:""}); setShowAdd(false);
  }
  function removePlant(id) { const u=plants.filter(p=>p.id!==id); setPlants(u); saveLS("pl_plants",u); }
  function saveOffset(v) { const n=parseFloat(v)||0; setOffset(n); try{localStorage.setItem("pl_hum_off",n);}catch{} }

  async function getAdvice() {
    if (!weather) return;
    setAdvLoad(true); setAdvice("");
    const list = plants.length ? plants.map(p=>`${p.name} (${p.location}${p.planted?", planted "+p.planted:""})`).join(", ") : "general garden";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:
          `Expert gardener. Specific practical advice for today.
DATE: ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})} — Northern NJ
CONDITIONS: ${weather.temperature_2m}°F, ${adjHum}% humidity (adjusted), soil ~${soil}°F, wind ${weather.wind_speed_10m}mph ${windLabel(weather.wind_direction_10m)}, ${rain48.toFixed(2)}" rain 48hr
FROST: ${frost?.label} | FUNGAL: ${fungal?.label} | WATERING: ${water?.label}
PLANTS: ${list}
Give 3-4 sentences. Name specific plants. One proactive action to take today.`}]}),
      });
      const d = await res.json();
      setAdvice(d.content?.find(b=>b.type==="text")?.text||"");
    } catch { setAdvice("Unable to load — check connection."); }
    setAdvLoad(false);
  }

  if (!weather) return <div style={{textAlign:"center",padding:48,color:C.textMid,fontFamily:F.body}}>Loading…</div>;

  return (
    <div>
      {frost && frost.level!=="safe" && (
        <div style={{background:frost.level==="danger"?"#200808":"#1a1505",border:`1px solid ${frost.color}`,borderRadius:16,padding:"14px 16px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:11,color:frost.color,letterSpacing:2,fontFamily:F.body}}>❄️ {frost.label.toUpperCase()}</span>
            <span style={{fontSize:24,fontFamily:F.display,color:frost.color}}>{Math.round(weather.temperature_2m)}°F</span>
          </div>
          <div style={{fontSize:12,color:C.textMid,lineHeight:1.6,fontFamily:F.body}}>{frost.desc}</div>
          {plants.length>0&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${frost.color}33`}}>
            <div style={{fontSize:9,color:frost.color,letterSpacing:2,marginBottom:6,fontFamily:F.body}}>AT RISK</div>
            {plants.map(p=><div key={p.id} style={{fontSize:12,color:C.text,marginBottom:2,fontFamily:F.body}}>{p.emoji} {p.name} — {p.location}</div>)}
          </div>}
        </div>
      )}

      {/* Watering */}
      <div style={{...css.card,borderColor:`${water.color}44`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={css.label}>Watering Advisor</span>
          <span style={css.tag(water.color)}>{water.action}</span>
        </div>
        <div style={{fontSize:22,fontFamily:F.display,color:water.color,marginBottom:6}}>{water.emoji} {water.label}</div>
        <div style={{fontSize:12,color:C.textMid,lineHeight:1.6,marginBottom:12,fontFamily:F.body}}>{water.desc}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{l:"Humidity",v:`${Math.round(adjHum)}%`,n:offset>0?"adj":null},{l:"48hr Rain",v:`${rain48.toFixed(2)}"`},{l:"Soil Est.",v:`${soil}°F`}].map(s=>(
            <div key={s.l} style={{background:"#0d140d",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
              <div style={{fontSize:9,color:C.textDim,marginBottom:2,fontFamily:F.body}}>{s.l}</div>
              <div style={{fontSize:14,color:C.text,fontFamily:F.display}}>{s.v}</div>
              {s.n&&<div style={{fontSize:9,color:C.accentDim,fontFamily:F.body}}>{s.n}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Fungal */}
      <div style={{...css.card,borderColor:`${fungal.color}33`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={css.label}>Fungal Disease Risk</span>
          <span style={css.tag(fungal.color)}>{fungal.level}</span>
        </div>
        <div style={{fontSize:12,color:C.textMid,lineHeight:1.6,fontFamily:F.body}}>{fungal.desc}</div>
      </div>

      {/* Soil temp */}
      <div style={css.card}>
        <span style={css.label}>Soil Temperature</span>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:8}}>
          <div style={{fontSize:34,fontFamily:F.display,color:C.text}}>{soil}°F</div>
          <div style={{fontSize:11,color:C.textMid,lineHeight:1.5,fontFamily:F.body}}>
            {soil<50?"Too cold for most seeds":soil<60?"Good for brassicas, lettuce":soil<70?"Tomatoes/peppers marginal":soil<80?"Ideal for warm-season crops":"Hot — cool-season stress risk"}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {Object.entries(SEED_TEMPS).map(([name,s])=>{
            const ok=soil>=s.min, opt=soil>=s.opt-5&&soil<=s.opt+10;
            const col=opt?C.good:ok?C.warn:C.textDim;
            return (
              <div key={name} style={{background:"#0d140d",border:`1px solid ${col}33`,borderRadius:9,padding:"8px 10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11,color:ok?C.text:C.textDim,fontFamily:F.body}}>{name}</span>
                <span style={{fontSize:9,color:col,padding:"2px 6px",borderRadius:8,background:`${col}18`,fontFamily:F.body}}>{opt?"✓":ok?"~":`${s.min}°+`}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plants */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{...css.label,marginBottom:0}}>My Plants</span>
        <button onClick={()=>setShowAdd(o=>!o)} style={css.btn}>+ Add Plant</button>
      </div>
      {showAdd&&(
        <div style={{...css.card,borderColor:`${C.accent}44`,marginBottom:16}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {PLANT_PRESETS.map(p=>(
              <button key={p.name} onClick={()=>setNp(prev=>({...prev,name:p.name,emoji:p.emoji}))} style={{padding:"6px 11px",borderRadius:20,fontSize:11,border:`1px solid ${np.name===p.name?C.accent:C.cardBorder}`,cursor:"pointer",fontFamily:F.body,background:np.name===p.name?`${C.accent}18`:"transparent",color:np.name===p.name?C.accent:C.textMid}}>{p.emoji} {p.name}</button>
            ))}
          </div>
          <input value={np.name} onChange={e=>setNp(p=>({...p,name:e.target.value}))} placeholder="Or type a plant name…" style={css.input}/>
          <div style={{fontSize:10,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Location</div>
          <input value={np.location} onChange={e=>setNp(p=>({...p,location:e.target.value}))} placeholder="e.g. south bed, patio, indoors…" style={css.input}/>
          <div style={{fontSize:10,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Date planted</div>
          <input type="date" value={np.planted} onChange={e=>setNp(p=>({...p,planted:e.target.value}))} style={css.input}/>
          <div style={{display:"flex",gap:10}}>
            <button onClick={addPlant} style={{...css.btn,flex:1,textAlign:"center",padding:"11px",opacity:np.name?1:0.4}}>Add</button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textMid,padding:"11px",borderRadius:24,fontSize:11,cursor:"pointer",fontFamily:F.body}}>Cancel</button>
          </div>
        </div>
      )}
      {plants.length===0&&!showAdd&&<div style={{...css.card,textAlign:"center",color:C.textDim,fontSize:12,lineHeight:1.8,fontFamily:F.body}}><div style={{fontSize:28,marginBottom:8}}>🌱</div>Add plants for personalized frost alerts.</div>}
      {plants.map(p=>(
        <div key={p.id} style={{background:"#0d140d",border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:13,color:C.text,fontFamily:F.body}}>{p.emoji} {p.name}</div><div style={{fontSize:10,color:C.textMid,marginTop:2,fontFamily:F.body}}>{p.location}{p.planted?` · ${p.planted}`:""}</div></div>
          <button onClick={()=>removePlant(p.id)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:18}}>×</button>
        </div>
      ))}

      {/* AI advisor */}
      <div style={{...css.card,background:"linear-gradient(135deg,#111a11,#0a140a)",borderColor:`${C.accent}33`,marginTop:4}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={css.label}>🌿 Garden Advisor</span>
          <button onClick={getAdvice} style={{...css.btn,padding:"7px 14px",fontSize:10}}>{advLoad?"Thinking…":"Get Advice"}</button>
        </div>
        {advice?<div style={{fontSize:13,color:C.text,lineHeight:1.8,fontStyle:"italic",fontFamily:F.body}}>"{advice}"</div>:<div style={{fontSize:12,color:C.textDim,lineHeight:1.6,fontFamily:F.body}}>{plants.length>0?`Tap for advice for your ${plants.length} plant${plants.length!==1?"s":""} today.`:"Add plants above, then tap for specific advice."}</div>}
      </div>

      {/* Calibration */}
      <div style={css.card}>
        <button onClick={()=>setShowCal(o=>!o)} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:9,letterSpacing:3,textTransform:"uppercase",fontFamily:F.body,display:"flex",alignItems:"center",gap:8,padding:0,width:"100%",justifyContent:"space-between"}}>
          <span>🔬 Microclimate Calibration</span><span>{showCal?"▲":"▼"}</span>
        </button>
        {showCal&&(
          <div style={{marginTop:12}}>
            <div style={{fontSize:11,color:C.textMid,lineHeight:1.6,marginBottom:12,fontFamily:F.body}}>Station near trees? Humidity reads high. Place a second sensor in open air for 2 weeks, measure the difference, set as offset.</div>
            <div style={{fontSize:10,color:C.textMid,marginBottom:6,fontFamily:F.body}}>Correction: <span style={{color:C.accent}}>-{offset}%</span></div>
            <input type="range" min="0" max="15" step="0.5" value={offset} onChange={e=>saveOffset(e.target.value)} style={{width:"100%",accentColor:C.accent,marginBottom:8}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.textDim,fontFamily:F.body}}><span>0%</span><span>15%</span></div>
            {offset>0&&<div style={{marginTop:10,fontSize:11,color:C.accent,background:"#0a140a",padding:"8px 12px",borderRadius:8,fontFamily:F.body}}>Raw: {weather.relative_humidity_2m}% → Adjusted: {Math.round(Math.max(0,weather.relative_humidity_2m-offset))}%</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── YARD TAB (Lawn + Projects + Compost) ────────────────────────────────────
function Yard({ weather, history }) {
  const [section, setSection] = useState("lawn");
  const month = new Date().getMonth();
  if (!weather) return <div style={{textAlign:"center",padding:48,color:C.textMid,fontFamily:F.body}}>Loading…</div>;
  const lawn    = lawnTasks(weather, history, month);
  const projects= projectTasks(weather, history);
  const compost = compostStatus(weather, history);
  const readyLawn = lawn.filter(t=>t.ready).length;
  const readyProj = projects.filter(t=>t.ready).length;

  return (
    <div>
      {/* Section switcher */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["lawn",`🌾 Lawn${readyLawn>0?` ·${readyLawn}`:""}"],["projects",`🔨 Projects${readyProj>0?` ·${readyProj}`:""}"`],["compost","♻️ Compost"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setSection(id)} style={{
            flex:1,padding:"10px 4px",borderRadius:12,fontSize:10,border:`1px solid ${section===id?C.accent:C.cardBorder}`,
            cursor:"pointer",fontFamily:F.body,letterSpacing:0.5,
            background:section===id?`${C.accent}18`:"transparent",
            color:section===id?C.accent:C.textMid,
          }}>{lbl}</button>
        ))}
      </div>

      {section==="lawn" && (
        <div>
          <div style={{fontSize:11,color:C.textDim,marginBottom:12,lineHeight:1.6,fontFamily:F.body}}>
            Tasks are weather-triggered based on your hyperlocal conditions. Tap any task for details and timing.
          </div>
          {lawn.map(t=><TaskCard key={t.id} task={t}/>)}
        </div>
      )}

      {section==="projects" && (
        <div>
          <div style={{fontSize:11,color:C.textDim,marginBottom:12,lineHeight:1.6,fontFamily:F.body}}>
            Exterior work conditions based on current temperature, humidity, wind, and 48hr rain + forecast trend.
          </div>
          {projects.map(t=><TaskCard key={t.id} task={t}/>)}
        </div>
      )}

      {section==="compost" && (
        <div>
          <div style={{...css.card,borderColor:`${compost.color}44`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={css.label}>Compost Conditions</span>
              <span style={css.tag(compost.color)}>{compost.label}</span>
            </div>
            <div style={{fontSize:32,fontFamily:F.display,color:compost.color,marginBottom:8}}>~{compost.soilTemp}°F</div>
            <div style={{fontSize:12,color:C.textMid,lineHeight:1.7,marginBottom:12,fontFamily:F.body}}>{compost.desc}</div>
            <CondPills conditions={compost.tips}/>
          </div>
          <div style={css.card}>
            <span style={css.label}>Compost Temperature Guide</span>
            {[
              {range:"32–55°F",label:"Dormant",desc:"Microbial activity minimal. Add material but don't expect decomposition.",color:C.info},
              {range:"55–90°F",label:"Active",desc:"Ideal range. Turn weekly to maintain oxygen and heat. Add water if dry.",color:C.good},
              {range:"90–130°F",label:"Hot composting",desc:"Optimal for killing weed seeds and pathogens. Turn more frequently.",color:C.warn},
              {range:"130°F+",label:"Too hot",desc:"Activity slowing. Turn and add water to cool down.",color:C.danger},
            ].map(row=>(
              <div key={row.range} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${C.cardBorder}`}}>
                <span style={{fontSize:10,color:row.color,padding:"3px 8px",borderRadius:8,background:`${row.color}18`,fontFamily:F.body,flexShrink:0,marginTop:2}}>{row.range}</span>
                <div>
                  <div style={{fontSize:11,color:C.text,fontFamily:F.body}}>{row.label}</div>
                  <div style={{fontSize:11,color:C.textMid,lineHeight:1.5,marginTop:2,fontFamily:F.body}}>{row.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NOW TAB ──────────────────────────────────────────────────────────────────
function Now({ weather, locationName, loading, apiError, history }) {
  const [aiText,    setAiText]    = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const inHg  = weather ? hpa2hg(weather.surface_pressure) : null;
  const trend = pressureTrend(history);
  const trendColor = {falling_fast:C.danger,falling:C.warn,rising_fast:C.good,rising:C.good,stable:C.textMid}[trend.trend];

  async function readField() {
    if (!weather) return;
    setAiLoading(true); setAiText("");
    try {
      const phist = history.slice(-24).map(s=>`${new Date(s.ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}: ${hpa2hg(s.pressure)}"`).join(", ");
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:`Seasoned naturalist. Current conditions: ${weather.temperature_2m}°F, ${weather.relative_humidity_2m}% humidity, ${inHg}" pressure (${trend.label}), wind ${weather.wind_speed_10m}mph ${windLabel(weather.wind_direction_10m)}. Pressure history: ${phist||"first reading"}. Write 3-4 vivid sentences — what would an experienced outdoorsman observe right now in nature? Animals, plants, air, sky, smell. Then one confident 12-hour outlook sentence.`}]})});
      const d = await res.json();
      setAiText(d.content?.find(b=>b.type==="text")?.text||"");
    } catch { setAiText("Unable to load."); }
    setAiLoading(false);
  }

  if (loading) return <div style={{textAlign:"center",padding:48,color:C.textMid,fontFamily:F.body}}>Reading conditions…</div>;

  return (
    <div>
      {apiError&&<div style={{fontSize:10,color:C.warn,background:"#1a1500",padding:"8px 12px",borderRadius:10,marginBottom:12,fontFamily:F.body}}>⚠ {apiError}</div>}
      {trend.trend==="falling_fast"&&(
        <div style={{background:"#1a0505",border:`1px solid ${C.danger}`,borderRadius:14,padding:"12px 16px",marginBottom:12}}>
          <div style={{fontSize:11,color:C.danger,letterSpacing:2,marginBottom:4,fontFamily:F.body}}>⚠ RAPID PRESSURE DROP</div>
          <div style={{fontSize:12,color:C.textMid,lineHeight:1.5,fontFamily:F.body}}>Pressure dropped {Math.abs(trend.delta).toFixed(1)} hPa in 6 hours. Significant weather change imminent.</div>
        </div>
      )}
      {weather&&(<>
        {/* Pressure */}
        <div style={css.card}>
          <span style={css.label}>Barometric Pressure</span>
          <div style={{fontSize:32,fontFamily:F.display,color:C.text,marginBottom:4}}>{inHg}<span style={{fontSize:13,color:C.textMid}}> inHg</span></div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:10,padding:"2px 10px",borderRadius:12,background:`${trendColor}22`,color:trendColor,fontFamily:F.body}}>{trend.label}</span>
            <span style={{fontSize:10,color:C.textDim,fontFamily:F.body}}>{weather.surface_pressure} hPa</span>
          </div>
          {history.length>2&&<Spark data={history.slice(-24).map(s=>s.pressure)} color={C.accent}/>}
        </div>

        {/* Wind */}
        <div style={css.card}>
          <span style={css.label}>Wind</span>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:44,height:44,borderRadius:"50%",border:`1px solid ${C.cardBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,background:"#0d140d",flexShrink:0,transform:`rotate(${weather.wind_direction_10m+180}deg)`}}>↑</div>
            <div>
              <div style={{fontSize:20,fontFamily:F.display,color:C.text}}>{windLabel(weather.wind_direction_10m)} · {Math.round(weather.wind_speed_10m)} mph</div>
            </div>
          </div>
        </div>

        {/* Humidity + Temp grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          {[
            {label:"Humidity",value:`${weather.relative_humidity_2m}%`,sub:weather.relative_humidity_2m<55?"Comfortable":weather.relative_humidity_2m<75?"Moderate":"Very humid"},
            {label:"Temperature",value:`${Math.round(weather.temperature_2m)}°F`,sub:weather.temperature_2m<45?"Cold":weather.temperature_2m<65?"Cool":weather.temperature_2m<80?"Warm":"Hot"},
          ].map(s=>(
            <div key={s.label} style={css.card}>
              <span style={css.label}>{s.label}</span>
              <div style={{fontSize:24,fontFamily:F.display,color:C.text,marginBottom:4}}>{s.value}</div>
              <div style={{fontSize:11,color:C.textMid,fontFamily:F.body}}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* AI reading */}
        <div style={{...css.card,background:"linear-gradient(135deg,#111a11,#0a140a)",borderColor:`${C.accent}33`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={css.label}>🌿 Naturalist's Reading</span>
            <button onClick={readField} style={{...css.btn,padding:"7px 14px",fontSize:10}}>{aiLoading?"Reading…":"Read the Field"}</button>
          </div>
          {aiText?<div style={{fontSize:13,color:C.text,lineHeight:1.8,fontStyle:"italic",fontFamily:F.body}}>"{aiText}"</div>:<div style={{fontSize:12,color:C.textDim,lineHeight:1.6,fontFamily:F.body}}>Tap for a vivid naturalist's description of current conditions.</div>}
        </div>
      </>)}
    </div>
  );
}

// ─── JOURNAL TAB ─────────────────────────────────────────────────────────────
function Journal({ weather }) {
  const [journal,  setJournal]  = useState(()=>loadLS("pl_journal",[]));
  const [showForm, setShowForm] = useState(false);
  const [entry,    setEntry]    = useState({clouds:"",signs:"",notes:"",photo:null,photoPreview:null});
  const [qSigns,   setQSigns]   = useState([]);
  const [dictating,setDictating]= useState(false);
  const [rawDic,   setRawDic]   = useState("");
  const [cleaning, setCleaning] = useState(false);
  const recRef    = useRef(null);
  const photoRef  = useRef(null);

  const QS = [{l:"Birds low",e:"🐦"},{l:"Leaves flipping",e:"🍃"},{l:"Earthy smell",e:"💧"},{l:"Clouds building",e:"⛅"},{l:"Heavy dew",e:"🌿"},{l:"Red sunrise",e:"🌅"},{l:"Red sunset",e:"🌇"},{l:"Cattle lying",e:"🐄"}];

  function startDictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported — try Safari or Chrome."); return; }
    const r = new SR(); r.continuous=true; r.interimResults=true; r.lang="en-US";
    recRef.current = r;
    let final="";
    r.onresult = e => {
      let interim="";
      for (let i=e.resultIndex;i<e.results.length;i++) {
        if (e.results[i].isFinal) final+=e.results[i][0].transcript+" ";
        else interim+=e.results[i][0].transcript;
      }
      setRawDic(final+interim);
    };
    r.onend = () => { setDictating(false); if (final.trim()) cleanDic(final.trim()); };
    r.start(); setDictating(true); setRawDic("");
  }
  function stopDictation() { recRef.current?.stop(); setDictating(false); }

  async function cleanDic(raw) {
    setCleaning(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,messages:[{role:"user",content:`Clean up this field observation dictation. Return ONLY valid JSON, no markdown:\nRaw: "${raw}"\n{"clouds":"cloud observations only","signs":"nature signs only","notes":"everything else, cleaned up"}`}]})});
      const d = await res.json();
      const txt = d.content?.find(b=>b.type==="text")?.text||"{}";
      const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
      setEntry(p=>({...p,clouds:parsed.clouds||p.clouds,signs:parsed.signs||p.signs,notes:parsed.notes||p.notes}));
    } catch { setEntry(p=>({...p,notes:raw})); }
    setCleaning(false);
  }

  async function handlePhoto(file) {
    if (!file) return;
    const b64 = await resizeImage(file, 800);
    setEntry(p=>({...p,photo:`data:image/jpeg;base64,${b64}`,photoPreview:URL.createObjectURL(file)}));
  }

  function addEntry() {
    const signs=[entry.signs,...qSigns].filter(Boolean).join(", ");
    if (!entry.clouds&&!entry.notes&&!signs&&!entry.photo) return;
    const e={id:Date.now(),date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),time:new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),weather:weather?`${Math.round(weather.temperature_2m)}°F · ${weather.relative_humidity_2m}% RH`:"",clouds:entry.clouds,signs,notes:entry.notes,photo:entry.photo};
    const u=[e,...journal]; setJournal(u); saveLS("pl_journal",u);
    setEntry({clouds:"",signs:"",notes:"",photo:null,photoPreview:null}); setQSigns([]); setRawDic(""); setShowForm(false);
  }
  function deleteEntry(id) { const u=journal.filter(e=>e.id!==id); setJournal(u); saveLS("pl_journal",u); }

  const streak = (() => {
    if (!journal.length) return 0;
    const dates=[...new Set(journal.map(e=>e.date))];
    const today=new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
    if (!dates.includes(today)) return 0;
    let s=1;
    for (let i=1;i<dates.length;i++) { if ((new Date(dates[i-1])-new Date(dates[i]))/(86400000)<=1.5) s++; else break; }
    return s;
  })();

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {[{e:"🔥",v:streak,l:"day streak",c:streak>0?C.warn:C.textDim},{e:"📓",v:journal.length,l:"entries",c:C.text}].map(s=>(
          <div key={s.l} style={{...css.card,textAlign:"center",padding:"12px 8px"}}>
            <div style={{fontSize:20,marginBottom:2}}>{s.e}</div>
            <div style={{fontSize:20,fontFamily:F.display,color:s.c}}>{s.v}</div>
            <div style={{fontSize:9,color:C.textMid,fontFamily:F.body}}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{...css.label,marginBottom:0}}>Field Journal</span>
        <button onClick={()=>setShowForm(o=>!o)} style={css.btn}>+ Log Entry</button>
      </div>

      {showForm&&(
        <div style={{...css.card,borderColor:`${C.accent}44`,marginBottom:16}}>
          {/* Dictation */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:9,color:C.accent,letterSpacing:2,marginBottom:8,fontFamily:F.body}}>🎙 VOICE ENTRY</div>
            <button onClick={dictating?stopDictation:startDictation} style={{...css.btn,width:"100%",textAlign:"center",padding:"12px",background:dictating?"#2a0808":C.accentDim,borderColor:dictating?C.danger:`${C.accent}55`,color:dictating?C.danger:C.accent}}>
              {dictating?"🔴 Tap to stop recording":"🎙 Tap to dictate observations"}
            </button>
            {dictating&&rawDic&&<div style={{fontSize:11,color:C.textMid,fontStyle:"italic",marginTop:8,lineHeight:1.5,fontFamily:F.body}}>"{rawDic}"</div>}
            {cleaning&&<div style={{fontSize:11,color:C.accent,marginTop:8,fontFamily:F.body}}>✨ Cleaning up dictation…</div>}
          </div>

          {/* Photo */}
          <div style={{marginBottom:14,borderTop:`1px solid ${C.cardBorder}`,paddingTop:14}}>
            <div style={{fontSize:9,color:C.accent,letterSpacing:2,marginBottom:8,fontFamily:F.body}}>📸 PHOTO</div>
            {entry.photoPreview
              ? <div style={{position:"relative",marginBottom:8}}>
                  <img src={entry.photoPreview} style={{width:"100%",borderRadius:10,maxHeight:200,objectFit:"cover"}}/>
                  <button onClick={()=>setEntry(p=>({...p,photo:null,photoPreview:null}))} style={{position:"absolute",top:6,right:6,background:"#0a0a0a99",border:"none",color:C.text,borderRadius:"50%",width:24,height:24,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                </div>
              : <div onClick={()=>photoRef.current?.click()} style={{border:`2px dashed ${C.cardBorder}`,borderRadius:10,padding:"16px",textAlign:"center",cursor:"pointer",background:"#0d140d"}}>
                  <div style={{fontSize:20,marginBottom:4}}>📷</div>
                  <div style={{fontSize:11,color:C.textMid,fontFamily:F.body}}>Add photo to entry</div>
                </div>
            }
            <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>handlePhoto(e.target.files?.[0])}/>
          </div>

          {/* Quick signs */}
          <div style={{borderTop:`1px solid ${C.cardBorder}`,paddingTop:14,marginBottom:14}}>
            <div style={{fontSize:9,color:C.accent,letterSpacing:2,marginBottom:8,fontFamily:F.body}}>⚡ QUICK SIGNS</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {QS.map(s=>(
                <button key={s.l} onClick={()=>setQSigns(p=>p.includes(s.l)?p.filter(x=>x!==s.l):[...p,s.l])} style={{padding:"5px 10px",borderRadius:18,fontSize:10,border:`1px solid ${qSigns.includes(s.l)?C.accent:C.cardBorder}`,cursor:"pointer",fontFamily:F.body,background:qSigns.includes(s.l)?`${C.accent}18`:"transparent",color:qSigns.includes(s.l)?C.accent:C.textMid}}>{s.e} {s.l}</button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div style={{borderTop:`1px solid ${C.cardBorder}`,paddingTop:14}}>
            <div style={{fontSize:10,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Clouds</div>
            <input value={entry.clouds} onChange={e=>setEntry(p=>({...p,clouds:e.target.value}))} placeholder="e.g. Cumulus building to the west…" style={css.input}/>
            <div style={{fontSize:10,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Notes</div>
            <textarea value={entry.notes} onChange={e=>setEntry(p=>({...p,notes:e.target.value}))} placeholder="Observations, what happened, what you noticed…" rows={3} style={{...css.input,resize:"vertical"}}/>
          </div>

          <div style={{display:"flex",gap:10}}>
            <button onClick={addEntry} style={{...css.btn,flex:1,textAlign:"center",padding:"11px"}}>Save Entry</button>
            <button onClick={()=>{setShowForm(false);setQSigns([]);setRawDic("");}} style={{flex:1,background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textMid,padding:"11px",borderRadius:24,fontSize:11,cursor:"pointer",fontFamily:F.body}}>Cancel</button>
          </div>
        </div>
      )}

      {journal.length===0&&!showForm&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:C.textDim,fontSize:13,lineHeight:1.8,fontFamily:F.body}}>
          <div style={{fontSize:36,marginBottom:12}}>📓</div>
          Your field journal is empty.<br/>Dictate, photograph, or type your first observation.
        </div>
      )}

      {journal.map(e=>(
        <div key={e.id} style={css.card}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <div>
              <div style={{fontSize:11,color:C.accent,fontFamily:F.body}}>{e.date} · {e.time}</div>
              {e.weather&&<div style={{fontSize:9,color:C.textDim,marginTop:1,fontFamily:F.body}}>{e.weather}</div>}
            </div>
            <button onClick={()=>deleteEntry(e.id)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
          </div>
          {e.photo&&<img src={e.photo} style={{width:"100%",borderRadius:10,marginBottom:8,maxHeight:200,objectFit:"cover"}}/>}
          {e.clouds&&<div style={{fontSize:12,color:C.textMid,marginBottom:2,fontFamily:F.body}}>☁ {e.clouds}</div>}
          {e.signs&&<div style={{fontSize:12,color:C.textMid,marginBottom:2,fontFamily:F.body}}>🌿 {e.signs}</div>}
          {e.notes&&<div style={{fontSize:13,color:C.text,lineHeight:1.6,marginTop:6,fontStyle:"italic",fontFamily:F.body}}>{e.notes}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const TABS = [
  {id:"now",     label:"Now",    emoji:"🌿"},
  {id:"garden",  label:"Garden", emoji:"🥕"},
  {id:"yard",    label:"Yard",   emoji:"🌾"},
  {id:"photo",   label:"Scan",   emoji:"📸"},
  {id:"journal", label:"Journal",emoji:"📓"},
];

export default function App() {
  const [tab,      setTab]      = useState("now");
  const [weather,  setWeather]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [locName,  setLocName]  = useState("");
  const [apiErr,   setApiErr]   = useState(null);
  const [history,  setHistory]  = useState(()=>loadLS("pl_history",[]));

  useEffect(()=>{
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(
          p=>fetch_wx(p.coords.latitude,p.coords.longitude),
          ()=>fetch_wx(40.9176,-74.5521)
        )
      : fetch_wx(40.9176,-74.5521);
  },[]);

  async function fetch_wx(lat,lon) {
    setLoading(true);
    try {
      const [wx,geo] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,visibility,weather_code,precipitation&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`),
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`),
      ]);
      const w=await wx.json(), g=await geo.json(), c=w.current;
      setWeather(c);
      setLocName(g.address?.city||g.address?.town||g.address?.county||"Your Location");
      const snap={ts:Date.now(),temp:c.temperature_2m,humidity:c.relative_humidity_2m,pressure:c.surface_pressure,windSpeed:c.wind_speed_10m,windDir:windLabel(c.wind_direction_10m),precipitation:c.precipitation||0};
      const hist=loadLS("pl_history",[]);
      const last=hist[hist.length-1];
      if (!last||Date.now()-last.ts>30*60*1000) {
        const u=[...hist,snap].slice(-500); setHistory(u); saveLS("pl_history",u);
      }
    } catch {
      setApiErr("Demo data — check connection.");
      const demo={temperature_2m:62,relative_humidity_2m:68,surface_pressure:1013,wind_speed_10m:8,wind_direction_10m:225,visibility:9500,weather_code:2,precipitation:0};
      setWeather(demo); setLocName("Morris County, NJ");
    }
    setLoading(false);
  }

  const frost = weather ? frostRisk(weather.temperature_2m, weather.relative_humidity_2m, weather.wind_speed_10m) : null;
  const showFrostBadge = frost && frost.level !== "safe";

  return (
    <div style={{fontFamily:F.body,background:C.bg,minHeight:"100dvh",color:C.text,maxWidth:480,margin:"0 auto",display:"flex",flexDirection:"column"}}>

      {/* Header */}
      <div style={{background:`linear-gradient(160deg,#0a160a 0%,#111a11 60%,#0a0f0a 100%)`,borderBottom:`1px solid ${C.cardBorder}`,padding:"max(env(safe-area-inset-top),18px) 20px 14px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:9,letterSpacing:5,color:C.accent,textTransform:"uppercase",fontFamily:F.body}}>Plot</div>
            <div style={{fontFamily:F.display,fontSize:11,fontWeight:400,color:C.textMid,marginTop:2}}>
              Weather · Garden · Yard
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:C.textDim,marginBottom:2,fontFamily:F.body}}>📍 {locName||"Locating…"}</div>
            {weather&&<div style={{fontSize:30,color:C.text,fontFamily:F.display,fontWeight:400,lineHeight:1}}>{Math.round(weather.temperature_2m)}°F</div>}
            {showFrostBadge&&<div style={{fontSize:9,color:frost.color,letterSpacing:1,marginTop:2,fontFamily:F.body}}>❄ {frost.label}</div>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.cardBorder}`,background:"#0a0f0a",flexShrink:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1,padding:"9px 2px 8px",border:"none",
            background:tab===t.id?"#111a11":"transparent",
            color:tab===t.id?C.accent:C.textDim,
            fontSize:8,cursor:"pointer",letterSpacing:0.5,
            borderBottom:tab===t.id?`2px solid ${C.accent}`:"2px solid transparent",
            fontFamily:F.body,transition:"all 0.15s",
            display:"flex",flexDirection:"column",alignItems:"center",gap:2,
          }}>
            <span style={{fontSize:17}}>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"16px 16px 40px"}}>
        {tab==="now"     && <Now     weather={weather} locationName={locName} loading={loading} apiError={apiErr} history={history}/>}
        {tab==="garden"  && <Garden  weather={weather} history={history}/>}
        {tab==="yard"    && <Yard    weather={weather} history={history}/>}
        {tab==="photo"   && <PhotoAI weather={weather} history={history}/>}
        {tab==="journal" && <Journal weather={weather}/>}
      </div>
    </div>
  );
}
