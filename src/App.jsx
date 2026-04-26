import { useState, useEffect, useRef } from "react";
// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
// Deep teal palette - iOS-native feel
const C = {
  bg:"#F2F2F7",        // iOS system grouped background
  surface:"#FFFFFF",   // card surface
  card:"#FFFFFF",      // card
  cardBorder:"transparent", // no visible borders - use shadow/bg separation
  accent:"#2D6A4F",    // deep teal
  accentDim:"#EAF4EE", // teal tint for backgrounds
  accentMid:"#40916C", // slightly lighter teal for hover states
  text:"#1C1C1E",      // iOS label
  textMid:"#6C6C70",   // iOS secondary label
  textDim:"#AEAEB2",   // iOS tertiary label
  sep:"#E5E5EA",       // iOS separator
  danger:"#FF3B30",    // iOS red
  warn:"#FF9500",      // iOS orange
  info:"#007AFF",      // iOS blue
  good:"#34C759",      // iOS green
};
const F = { 
  display:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif",
  body:"-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif",
  num:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif",
};
const shadow = "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)";
const shadowMd = "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)";
const css = {
  card:{ background:C.surface, borderRadius:16, padding:"16px 18px", marginBottom:10, boxShadow:shadow },
  label:{ fontSize:11, letterSpacing:0.5, color:C.textMid, textTransform:"uppercase", fontWeight:"600", marginBottom:8, display:"block", fontFamily:F.body },
  input:{ width:"100%", background:C.bg, border:"none", borderRadius:12, padding:"13px 15px", color:C.text, fontSize:16, marginBottom:10, fontFamily:F.body, outline:"none", boxSizing:"border-box" },
  btn:{ background:"#2D6A4F", border:"none", color:"#ffffff", padding:"11px 22px", borderRadius:980, fontSize:15, fontWeight:"600", cursor:"pointer", fontFamily:F.body },
  btnSoft:{ background:C.accentDim, border:"none", color:C.accent, padding:"9px 18px", borderRadius:980, fontSize:14, fontWeight:"600", cursor:"pointer", fontFamily:F.body },
  tag:(color)=>({ fontSize:12, padding:"4px 10px", borderRadius:980, background:`${color}18`, color, fontWeight:"600", fontFamily:F.body }),
  row:{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:13, paddingBottom:13, borderBottom:`1px solid ${C.sep}` },
  section:{ background:C.surface, borderRadius:16, overflow:"hidden", marginBottom:10, boxShadow:shadow },
};

// ─── DATE / TIME / SEASON CONTEXT ────────────────────────────────────────────
// ─── STORAGE ─────────────────────────────────────────────────────────────────
function loadLS(k, def) { try { return JSON.parse(localStorage.getItem(k) ?? JSON.stringify(def)); } catch { return def; } }
function saveLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

// ─── DATE / TIME / SEASON HELPERS ────────────────────────────────────────────
function getSeason(month) {
  if (month <= 1 || month === 11) return "Winter";
  if (month <= 4) return "Spring";
  if (month <= 7) return "Summer";
  return "Autumn";
}
function getDateContext() {
  const now = new Date();
  const month = now.getMonth();
  return {
    date: now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}),
    time: now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),
    season: getSeason(month),
    month,
  };
}

// ─── AI FETCH HELPER ─────────────────────────────────────────────────────────
function getAnthropicKey() {
  return localStorage.getItem("pl_anthropic_key") || "";
}
function hasAnthropicKey() {
  return !!getAnthropicKey();
}

// ─── IMAGE RESIZE ─────────────────────────────────────────────────────────────
async function resizeImage(file, maxDim=1024) {
  return new Promise(resolve => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82).split(",")[1]);
    };
    img.src = url;
  });
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function hpa2hg(hpa) { return (hpa * 0.02953).toFixed(2); }
function windLabel(deg) {
  const d = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return d[Math.round(deg / 22.5) % 16];

}
// ─── PWS / WEATHER FETCH ──────────────────────────────────────────────────────
// Ambient Weather Network API
// Users enter their API key and MAC address in Settings
async function fetchAWN(apiKey, macAddress) {
  const url = `https://rt.ambientweather.net/v1/devices/${macAddress}?apiKey=${apiKey}&applicationKey=${apiKey}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("AWN fetch failed: " + res.status);
  const data = await res.json();
  if (!data || !data[0]) throw new Error("No data from AWN");
  const d = data[0].lastData;
  return {
    temperature_2m: d.tempf,
    relative_humidity_2m: d.humidity,
    surface_pressure: d.baromrelin ? d.baromrelin / 0.02953 : 1013,
    wind_speed_10m: d.windspeedmph,
    wind_direction_10m: d.winddir,
    precipitation: d.hourlyrainin || 0,
    rain24h: d.dailyrainin || 0,
    rain_event: d.eventrainin || 0,
    uv: d.uv,
    solar_radiation: d.solarradiation,
    feels_like: d.feelsLike,
    dew_point: d.dewPoint,
    source: "pws",
    raw: d,
  };
}

async function fetchOpenMeteo(lat, lon) {
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`);
  const data = await res.json();
  const c = data.current;
  return {
    temperature_2m: c.temperature_2m,
    relative_humidity_2m: c.relative_humidity_2m,
    surface_pressure: c.surface_pressure,
    wind_speed_10m: c.wind_speed_10m,
    wind_direction_10m: c.wind_direction_10m,
    precipitation: c.precipitation || 0,
    rain24h: 0,
    rain_event: 0,
    uv: null,
    solar_radiation: null,
    feels_like: null,
    dew_point: null,
    source: "openmeteo",
  };
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
  if (d < -3) return { trend:"falling_fast", delta:d, label:"Falling fast (" + d.toFixed(1) + " hPa)" };
  if (d < -1) return { trend:"falling", delta:d, label:"Falling (" + d.toFixed(1) + " hPa)" };
  if (d >  3) return { trend:"rising_fast", delta:d, label:"Rising fast (+" + d.toFixed(1) + " hPa)" };
  if (d >  1) return { trend:"rising", delta:d, label:"Rising (+" + d.toFixed(1) + " hPa)" };
  return { trend:"stable", delta:d, label:"Stable" };
}
function frostRisk(tempF, hum, wind) {
  const rad = wind < 5 && hum < 70;
  if (tempF <= 28) return { level:"danger", label:"Hard Frost", color:C.danger, desc:"Protect all plants immediately." };
  if (tempF <= 32) return { level:"danger", label:"Frost", color:"#fb923c", desc:"Cover vulnerable plants, bring in containers." };
  if (tempF <= 36 && rad) return { level:"caution", label:"Frost Possible", color:C.warn, desc:"Clear and calm - radiative cooling may reach 32F at ground level." };
  if (tempF <= 40) return { level:"watch", label:"Frost Watch", color:C.warn, desc:"Keep frost cloth accessible." };
  return { level:"safe", label:"No Frost Risk", color:C.good, desc:"Well above frost threshold." };
}
function wateringAdv(wx, hist, offset=0) {
  const rain = hist.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const hum = Math.max(0, Math.min(100, wx.relative_humidity_2m - offset));
  const tmp = wx.temperature_2m;
  const et = (tmp-50)*0.3 + (100-hum)*0.2 + wx.wind_speed_10m*0.5;
  if ((wx.rain24h||0) > 0.5 || rain > 0.5) return { action:"skip", label:"Skip watering", color:C.good, emoji:"💧", desc:((wx.rain24h||rain).toFixed(2)) + '" of rain recently. Soil should still have moisture.' };
  if (hum > 80 && tmp < 85) return { action:"skip", label:"Probably skip", color:"#86efac", emoji:"🌿", desc:"High humidity (" + Math.round(hum) + "%) - finger-test first." };
  if (et > 25 || tmp > 85) return { action:"water", label:"Water today", color:C.warn, emoji:"🚿", desc:(tmp>85?"Hot conditions":"High evapotranspiration") + " - water deeply, early morning." };
  if (tmp < 55 && hum > 60) return { action:"skip", label:"Hold off", color:C.good, emoji:"🌡️", desc:"Cool and humid. Check manually." };
  return { action:"check", label:"Check soil", color:C.textMid, emoji:"👆", desc:"If top 2 inches dry, water. If moist, wait." };
}
function fungalRisk(wx, hist, offset=0) {
  const rain = hist.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const hum = Math.max(0, Math.min(100, wx.relative_humidity_2m - offset));
  const tmp = wx.temperature_2m;
  const wet = hist.slice(-96).filter(s=>s.precipitation>0.01).length;
  if (hum>80 && tmp>60 && tmp<85 && (rain>0.25||wet>6))
    return { level:"high", label:"High Fungal Risk", color:C.danger, desc:"Warm + wet + humid. Inspect plants today. Consider copper or sulfur treatment." };
  if (hum>70 && tmp>55 && rain>0.1)
    return { level:"moderate", label:"Moderate Risk", color:C.warn, desc:"Conditions favor fungal development. Improve air circulation, avoid overhead watering." };
  return { level:"low", label:"Low Risk", color:C.good, desc:"Conditions not favorable for fungal disease." };
}

// ─── YARD CONDITIONS ENGINE ───────────────────────────────────────────────────
function getYardConditions(wx, hist) {
  const tmp = wx.temperature_2m;
  const hum = wx.relative_humidity_2m;
  const wind = wx.wind_speed_10m;
  const rain24 = wx.rain24h || hist.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const rain48 = hist.slice(-96).reduce((s,r)=>s+(r.precipitation||0),0);
  const dryStretch = hist.slice(-144).every(s=>(s.precipitation||0)<0.05);
  const trend = pressureTrend(hist);
  const rainComing = trend.trend === "falling_fast" || trend.trend === "falling";
  const frost = frostRisk(tmp, hum, wind);
  const month = new Date().getMonth();
  const soil = soilEst(tmp, month);

  const warmDry    = tmp >= 60 && rain24 < 0.1 && hum < 75;
  const afterRain  = rain24 >= 0.25 && tmp > 40;
  const drySpell   = dryStretch && rain24 < 0.05 && !rainComing;
  const overcast   = hum > 65 && (wx.solar_radiation != null ? wx.solar_radiation < 200 : hum > 72) && tmp > 45 && tmp < 82;
  const windAdv    = wind >= 15;
  const frostWatch = frost.level !== "safe";

  const groups = [];

  if (warmDry) {
    groups.push({
      id:"warm_dry",
      label:"Warm and Dry",
      color:C.good,
      emoji:"☀️",
      subtitle: Math.round(tmp) + "F, no recent rain, good conditions",
      tasks:[
        { name:"Power washing", detail:"Siding, driveway, walkways, columns - ideal conditions.", ready:true },
        { name:"Sanding and priming columns/trim", detail:"Low humidity and warmth means primer will bond and dry properly.", ready:true },
        { name:"Painting exterior wood surfaces", detail:tmp>=50&&tmp<=90&&hum<=70?"Good temp and humidity window for most latex paints.":"Check paint specs - conditions are marginal.", ready:tmp>=50&&tmp<=90&&hum<=70 },
        { name:"Shed base construction/framing", detail:"Good outdoor work conditions. Concrete needs 50F+ to cure.", ready:tmp>=50 },
        { name:"Mowing and edging", detail:hum<70&&rain24<0.05?"Dry grass cuts cleanly and clumps less.":"Grass may still be damp from recent humidity.", ready:hum<70&&rain24<0.05 },
      ],
    });
  }

  if (afterRain) {
    groups.push({
      id:"after_rain",
      label:"After Rain / Moist Soil",
      color:C.info,
      emoji:"🌧️",
      subtitle: (rain24).toFixed(2) + '" rain recently, ground is soft',
      tasks:[
        { name:"Planting and transplanting", detail:"Fig tree, seed starts - moist soil reduces transplant shock and roots establish faster.", ready:true },
        { name:"Fertilizing lawn", detail: rainComing ? "More rain coming - ideal activation window for granular fertilizer." : "Ground moist - fertilizer will dissolve and absorb well. Best if light rain follows.", ready:true },
        { name:"Pulling weeds", detail:"Soft ground means roots pull cleanly. Best time to weed the whole garden.", ready:true },
        { name:"Aerating or overseeding", detail:soil>=50&&soil<=65?"Soil temp " + soil + "F - good germination conditions after aeration.":"Soil at " + soil + "F - check temp window for your seed type.", ready:soil>=45&&soil<=70 },
      ],
    });
  }

  if (drySpell) {
    groups.push({
      id:"dry_spell",
      label:"Dry Stretch",
      color:C.warn,
      emoji:"🌤️",
      subtitle:"2-3 days no rain - ideal for applications",
      tasks:[
        { name:"Pre-emergent or granular fertilizer", detail:soil>=50&&soil<=60?"Soil at " + soil + "F - pre-emergent window is open. Apply now.":"Soil at " + soil + "F - " + (soil<50?"wait for 50F+":"window may be closing above 60F"), ready:soil>=48&&soil<=62 },
        { name:"Sealing driveway or concrete", detail:"Dry surface and dry forecast - ideal for penetrating sealers.", ready:tmp>=50&&tmp<=90 },
        { name:"Staining deck or fence", detail:"Wood needs to be dry for stain to penetrate. Check that surfaces have had 48hrs since last rain.", ready:hum<=65&&tmp>=50 },
        { name:"Applying herbicide", detail:"Dry leaves absorb herbicide much better. Wind at " + Math.round(wind) + " mph - " + (wind<10?"good, minimal drift risk.":"use caution with spray drift."), ready:wind<15 },
      ],
    });
  }

  if (overcast) {
    groups.push({
      id:"overcast",
      label:"Overcast / Mild",
      color:"#a78bfa",
      emoji:"⛅",
      subtitle:"Reduced sun stress - ideal for transplanting",
      tasks:[
        { name:"Transplanting seedlings or starts", detail:"Overcast reduces sun stress and wilting. Best time to move tomatoes, peppers, eggplant outdoors.", ready:tmp>45&&tmp<85 },
        { name:"Meyer lemon outdoor acclimation", detail:"Move lemon to indirect outdoor light first. Avoid direct afternoon sun for first 1-2 weeks.", ready:tmp>50 },
        { name:"Garden bed prep and amendments", detail:"Cool overcast conditions are comfortable for soil work. Add compost, till, and amend now.", ready:true },
      ],
    });
  }

  if (frostWatch) {
    groups.push({
      id:"frost_watch",
      label:"Frost Risk Monitoring",
      color:frost.color,
      emoji:"❄️",
      subtitle:frost.label + " - " + Math.round(tmp) + "F",
      tasks:[
        { name:"Fig tree outdoor planting timing", detail:"Target mid-to-late April in NJ. Watch overnight lows - fig needs consistent temps above 40F overnight before going out.", ready:false },
        { name:"Seed start hardening off", detail:"Bring starts in tonight. Hardening off requires 7-10 days of gradual outdoor exposure before leaving out overnight.", ready:false },
        { name:"Meyer lemon outdoor move", detail:"Target mid-to-late May in NJ when overnight lows stay above 55F consistently.", ready:false },
      ],
    });
  }

  if (windAdv) {
    groups.push({
      id:"wind_advisory",
      label:"Wind Advisory",
      color:C.warn,
      emoji:"🌬️",
      subtitle:Math.round(wind) + " mph - hold off on spraying",
      tasks:[
        { name:"Hold off on spraying", detail:"Fertilizer, herbicide, and pesticide drift at " + Math.round(wind) + " mph. Wait for winds below 10 mph.", ready:false },
        { name:"Avoid light mulch or compost spreading", detail:"Wind will scatter light material. Wait for calmer conditions.", ready:false },
      ],
    });
  }

  // Always show frost monitoring in April/May even without active frost
  if (!frostWatch && (month === 3 || month === 4)) {
    groups.push({
      id:"frost_seasonal",
      label:"Frost Risk Monitoring",
      color:C.textMid,
      emoji:"🌡️",
      subtitle:"April/May - watch overnight lows",
      tasks:[
        { name:"Fig tree outdoor planting timing", detail:"Currently " + Math.round(tmp) + "F. Target mid-to-late April - watch for overnight lows consistently above 40F.", ready:tmp>55 },
        { name:"Seed start hardening off", detail:"Good hardening-off day if temps stay above 50F. Bring in before sunset if overnight low drops below 45F.", ready:tmp>50&&frost.level==="safe" },
        { name:"Meyer lemon outdoor move", detail:"Not yet - target mid-to-late May when overnight lows stay above 55F.", ready:false },
      ],
    });
  }

  if (groups.length === 0) {
    groups.push({
      id:"general",
      label:"General Conditions",
      color:C.textMid,
      emoji:"🌿",
      subtitle: Math.round(tmp) + "F, " + Math.round(hum) + "% humidity",
      tasks:[
        { name:"Check conditions", detail:"No specific weather-triggered windows right now. Good time for general garden maintenance and planning.", ready:true },
      ],
    });
  }

  return groups;
}

// ─── CONDITION PILLS ─────────────────────────────────────────────────────────
function CondPills({ conditions }) {
  return (
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
      {conditions.map(c=>(
        <div key={c.label} style={{background:c.ok?"#F2F2F7":"#FFF2F2",border:`1px solid ${c.ok?C.accentDim:"#f0c0c0"}`,borderRadius:8,padding:"5px 10px",display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:16,color:c.ok?C.accent:C.danger}}>●</span>
          <span style={{fontSize:16,color:C.textMid,fontFamily:F.body}}>{c.label}</span>
          <span style={{fontSize:17,color:c.ok?C.text:C.warn,fontFamily:F.body}}>{c.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── SPARK CHART ─────────────────────────────────────────────────────────────
function Spark({ data, color, h=36 }) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx-mn||1;
  const w = 100/(data.length-1);
  const pts = data.map((v,i)=>`${i*w},${h-((v-mn)/rng)*(h-6)-3}`).join(" ");
  const lv = data[data.length-1], lx=100, ly=h-((lv-mn)/rng)*(h-6)-3;
  const id = "g" + color.replace("#","");
  return (
    <svg viewBox={`0 0 100 ${h}`} style={{width:"100%",height:h,display:"block"}} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} 100,${h}`} fill={`url(#${id})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={lx} cy={ly} r="2.5" fill={color}/>
    </svg>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function Settings({ onClose }) {
  const [apiKey,      setApiKey]      = useState(()=>localStorage.getItem("pl_awn_key")||"");
  const [macAddr,    setMacAddr]    = useState(()=>localStorage.getItem("pl_awn_mac")||"");
  const [appKey,     setAppKey]     = useState(()=>localStorage.getItem("pl_awn_appkey")||"");
  const [anthropicKey, setAnthropicKey] = useState(()=>localStorage.getItem("pl_anthropic_key")||"");
  const [saved,      setSaved]      = useState(false);

  function save() {
    localStorage.setItem("pl_awn_key", apiKey.trim());
    localStorage.setItem("pl_awn_mac", macAddr.trim().toUpperCase());
    localStorage.setItem("pl_awn_appkey", appKey.trim());
    localStorage.setItem("pl_anthropic_key", anthropicKey.trim());
    setSaved(true);
    setTimeout(()=>{ setSaved(false); onClose(); }, 800);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"#00000066",zIndex:100,display:"flex",alignItems:"flex-end"}}>
      <div style={{width:"100%",maxWidth:480,margin:"0 auto",background:C.surface,borderRadius:"20px 20px 0 0",padding:"24px 20px 40px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{...css.label,marginBottom:0,fontSize:11}}>PWS Settings</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.textMid,fontSize:26,cursor:"pointer"}}>x</button>
        </div>

        <div style={{...css.card,borderColor:`${C.accent}33`,marginBottom:16}}>
          <div style={{fontSize:17,color:C.textMid,lineHeight:1.7,marginBottom:12,fontFamily:F.body}}>
            Connect your Ambient Weather station for true hyperlocal readings from your backyard.
            Get your API key and Application key from <span style={{color:C.accent}}>ambientweather.net/account</span>.
            Your MAC address is on the station label or in the AWN app.
          </div>

          <div style={{fontSize:16,color:C.textMid,marginBottom:4,fontFamily:F.body}}>API Key</div>
          <input value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="Your AWN API key..." style={css.input}/>

          <div style={{fontSize:16,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Application Key</div>
          <input value={appKey} onChange={e=>setAppKey(e.target.value)} placeholder="Your AWN Application key..." style={css.input}/>

          <div style={{fontSize:16,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Station MAC Address</div>
          <input value={macAddr} onChange={e=>setMacAddr(e.target.value)} placeholder="e.g. 00:11:22:33:44:55" style={{...css.input,marginBottom:0}}/>
        </div>

        <div style={{...css.card,borderColor:`${C.accent}33`,marginBottom:16}}>
          <div style={{fontSize:13,color:C.textMid,lineHeight:1.7,marginBottom:12,fontFamily:F.body}}>
            Anthropic API key powers the AI features: Garden Advisor, Naturalist Reading, Yard recommendations, and Photo Analysis.
            Get your key from <span style={{color:C.accent}}>console.anthropic.com</span>.
          </div>
          <div style={{fontSize:13,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Anthropic API Key</div>
          <input value={anthropicKey} onChange={e=>setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..." style={{...css.input,marginBottom:0}}/>
        </div>

        <button onClick={save} style={{...css.btn,width:"100%",textAlign:"center",padding:"13px",fontSize:12}}>
          {saved ? "Saved! Reloading..." : "Save and Connect"}
        </button>

        <div style={{fontSize:16,color:C.textDim,textAlign:"center",marginTop:12,fontFamily:F.body,lineHeight:1.6}}>
          No station? App uses Open-Meteo (free, grid-based) as fallback.
        </div>
      </div>
    </div>
  );
}

// ─── DICTATION BUTTON ────────────────────────────────────────────────────────
function DictationButton({ onResult }) {
  const [active, setActive] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const recRef = useRef(null);

  function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported - try Chrome or Safari."); return; }
    const r = new SR(); r.continuous = true; r.interimResults = false; r.lang = "en-US";
    recRef.current = r;
    let final = "";
    r.onresult = e => { for (let i=e.resultIndex;i<e.results.length;i++) if (e.results[i].isFinal) final += e.results[i][0].transcript + " "; };
    r.onend = () => { setActive(false); if (final.trim()) cleanText(final.trim()); };
    r.start(); setActive(true);
  }
  function stop() { recRef.current?.stop(); setActive(false); }

  async function cleanText(raw) {
    const apiKey = localStorage.getItem("pl_anthropic_key") || "";
    if (!apiKey) { onResult(raw); return; }
    setCleaning(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","x-api-key":apiKey},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:300,
          messages:[{role:"user",content:"Clean up this plant observation dictation into a clear concise note. Return only the cleaned text, no quotes or preamble. Raw: " + raw}]})
      });
      const d = await res.json();
      const txt = d.content?.find(b=>b.type==="text")?.text;
      onResult(txt || raw);
    } catch { onResult(raw); }
    setCleaning(false);
  }

  return (
    <button onClick={active?stop:start} style={{
      ...css.btn,
      width:"100%", textAlign:"center", padding:"10px", marginBottom:10,
      background: active ? "#FFF0F0" : C.accentDim,
      color: active ? C.danger : C.accent,
      border: active ? "1px solid "+C.danger : "none",
      fontSize:14,
    }}>
      {cleaning ? "✨ Cleaning up..." : active ? "🔴 Tap to stop" : "🎙 Dictate note"}
    </button>
  );
}

// ─── PLANT JOURNAL MODAL ─────────────────────────────────────────────────────
function PlantJournal({ plant, onClose }) {
  const key = "pl_pjournal_" + plant.id;
  const [entries, setEntries] = useState(()=>loadLS(key,[]));
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoRef = useRef();

  async function handlePhoto(file) {
    if (!file) return;
    const b64 = await resizeImage(file, 800);
    setPhoto("data:image/jpeg;base64," + b64);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function addEntry() {
    if (!note && !photo) return;
    const e = {
      id: Date.now(),
      date: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),
      time: new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),
      note, photo,
    };
    const updated = [e, ...entries];
    setEntries(updated); saveLS(key, updated);
    setNote(""); setPhoto(null); setPhotoPreview(null); setShowForm(false);
  }

  function deleteEntry(id) {
    const updated = entries.filter(e=>e.id!==id);
    setEntries(updated); saveLS(key, updated);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"#00000066",zIndex:100,display:"flex",alignItems:"flex-end"}}>
      <div style={{width:"100%",maxWidth:480,margin:"0 auto",background:C.surface,borderRadius:"20px 20px 0 0",maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"20px 20px 12px",borderBottom:`1px solid ${C.cardBorder}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:16,color:C.text,fontFamily:F.display}}>{plant.emoji} {plant.name}</div>
              <div style={{fontSize:16,color:C.textMid,fontFamily:F.body,marginTop:2}}>{plant.location}{plant.planted ? " - planted " + plant.planted : ""}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={()=>setShowForm(o=>!o)} style={{...css.btn,padding:"7px 14px",fontSize:10}}>+ Note</button>
              <button onClick={onClose} style={{background:"none",border:"none",color:C.textMid,fontSize:26,cursor:"pointer"}}>x</button>
            </div>
          </div>
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"16px 20px 24px"}}>
          {showForm && (
            <div style={{...css.card,borderColor:`${C.accent}44`,marginBottom:16}}>
              {/* Dictation button */}
          <DictationButton onResult={text => setNote(prev => prev ? prev + " " + text : text)} />
          <textarea value={note} onChange={e=>setNote(e.target.value)}
                placeholder={"Observations, health notes, watering, fertilizing, issues..."}
                rows={3} style={{...css.input,resize:"vertical"}}/>
              {photoPreview
                ? <div style={{position:"relative",marginBottom:10}}>
                    <img src={photoPreview} style={{width:"100%",borderRadius:10,maxHeight:180,objectFit:"cover"}}/>
                    <button onClick={()=>{setPhoto(null);setPhotoPreview(null);}} style={{position:"absolute",top:6,right:6,background:"#ffffffcc",border:"none",color:C.text,borderRadius:"50%",width:24,height:24,cursor:"pointer",fontSize:14}}>x</button>
                  </div>
                : <div onClick={()=>photoRef.current?.click()} style={{border:`2px dashed ${C.cardBorder}`,borderRadius:10,padding:"12px",textAlign:"center",cursor:"pointer",background:C.surface,marginBottom:10}}>
                    <div style={{fontSize:18,marginBottom:2}}>📷</div>
                    <div style={{fontSize:16,color:C.textMid,fontFamily:F.body}}>Add photo (auto-resized)</div>
                  </div>
              }
              <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>handlePhoto(e.target.files?.[0])}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={addEntry} style={{...css.btn,flex:1,textAlign:"center",padding:"10px",opacity:(note||photo)?1:0.4}}>Save Note</button>
                <button onClick={()=>{setShowForm(false);setNote("");setPhoto(null);setPhotoPreview(null);}} style={{flex:1,background:"transparent",border:"none",color:C.textMid,padding:"10px",borderRadius:980,fontSize:17,cursor:"pointer",fontFamily:F.body}}>Cancel</button>
              </div>
            </div>
          )}

          {entries.length === 0 && !showForm && (
            <div style={{textAlign:"center",padding:"32px 16px",color:C.textDim,fontSize:15,fontFamily:F.body,lineHeight:1.8}}>
              <div style={{fontSize:36,marginBottom:8}}>{plant.emoji}</div>
              No journal entries yet.<br/>Tap + Note to log your first observation.
            </div>
          )}

          {entries.map(e=>(
            <div key={e.id} style={css.card}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <div style={{fontSize:16,color:C.accent,fontFamily:F.body}}>{e.date} - {e.time}</div>
                <button onClick={()=>deleteEntry(e.id)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:16,lineHeight:1}}>x</button>
              </div>
              {e.photo && <img src={e.photo} style={{width:"100%",borderRadius:10,marginBottom:8,maxHeight:180,objectFit:"cover"}}/>}
              {e.note && <div style={{fontSize:15,color:C.text,lineHeight:1.6,fontFamily:F.body}}>{e.note}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GARDEN TAB ───────────────────────────────────────────────────────────────
const PLANT_PRESETS=[{name:"Fig Tree",emoji:"🌳"},{name:"Meyer Lemon",emoji:"🍋"},{name:"Tomato",emoji:"🍅"},{name:"Pepper",emoji:"🫑"},{name:"Eggplant",emoji:"🍆"},{name:"Brussels Sprouts",emoji:"🥦"},{name:"Lettuce",emoji:"🥬"},{name:"Herbs",emoji:"🌿"}];
const SEED_TEMPS={"Tomatoes":{min:60,opt:75},"Peppers":{min:65,opt:80},"Eggplant":{min:65,opt:80},"Brussels Sprouts":{min:45,opt:65},"Lettuce":{min:35,opt:60},"Beans":{min:60,opt:75},"Cucumber":{min:60,opt:75},"Carrots":{min:45,opt:65}};

function Garden({ weather, history }) {
  const [plants,    setPlants]    = useState(()=>loadLS("pl_plants",[]));
  const [showAdd,   setShowAdd]   = useState(false);
  const [np,        setNp]        = useState({name:"",emoji:"🌱",location:"garden bed",planted:""});
  const [offset,    setOffset]    = useState(()=>parseFloat(localStorage.getItem("pl_hum_off")||"0"));
  const [showCal,   setShowCal]   = useState(false);
  const [advice,    setAdvice]    = useState("");
  const [advLoad,   setAdvLoad]   = useState(false);
  const [journalPlant, setJournalPlant] = useState(null);

  const month = new Date().getMonth();
  const soil  = weather ? soilEst(weather.temperature_2m, month) : null;
  const frost = weather ? frostRisk(weather.temperature_2m, weather.relative_humidity_2m, weather.wind_speed_10m) : null;
  const water = weather ? wateringAdv(weather, history, offset) : null;
  const fung  = weather ? fungalRisk(weather, history, offset) : null;
  const rain24 = weather?.rain24h || history.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const adjHum = weather ? Math.max(0,Math.min(100,weather.relative_humidity_2m-offset)) : 0;

  function addPlant() {
    if (!np.name) return;
    const u=[...plants,{...np,id:Date.now()}]; setPlants(u); saveLS("pl_plants",u);
    setNp({name:"",emoji:"🌱",location:"garden bed",planted:""}); setShowAdd(false);
  }
  function removePlant(id) { const u=plants.filter(p=>p.id!==id); setPlants(u); saveLS("pl_plants",u); }
  function saveOffset(v) { const n=parseFloat(v)||0; setOffset(n); try{localStorage.setItem("pl_hum_off",String(n));}catch{} }

  // Build plant journal context for AI
  function buildJournalContext() {
    if (!plants.length) return "";
    return plants.map(p => {
      const jkey = "pl_pjournal_" + p.id;
      const entries = loadLS(jkey, []);
      const recent = entries.slice(0,5);
      if (!recent.length) return p.name + " (" + p.location + "): no journal entries yet";
      const notes = recent.map(e => e.date + ": " + (e.note||"(photo only)")).join("; ");
      return p.name + " (" + p.location + "): " + notes;
    }).join("\n");
  }

  async function getAdvice() {
    if (!weather) return;
    const apiKey = localStorage.getItem("pl_anthropic_key") || "";
    if (!apiKey) { setAdvice("No Anthropic API key set. Tap the gear icon and add your key from console.anthropic.com"); return; }
    setAdvLoad(true); setAdvice("");
    const journalCtx = buildJournalContext();
    const plantList = plants.length ? plants.map(p=>p.name + " (" + p.location + (p.planted?", planted "+p.planted:"") + ")").join(", ") : "general garden";
    const src = weather.source === "pws" ? "personal weather station (backyard)" : "grid model";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","x-api-key":apiKey},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:600,
          messages:[{role:"user",content:
            getDateContext() + "\nWEATHER SOURCE: " + src + "\n\n" +
            "You are an expert gardener. Give specific, actionable advice for today based on the actual date, season, conditions, and journal history.\n\n" +
            "CONDITIONS: " + Math.round(weather.temperature_2m) + "F, " + Math.round(adjHum) + "% humidity (adjusted), soil ~" + soil + "F, wind " + Math.round(weather.wind_speed_10m) + "mph " + windLabel(weather.wind_direction_10m) + ", " + rain24.toFixed(2) + '" rain 24hr\n' +
            "FROST: " + frost?.label + " | FUNGAL RISK: " + fung?.label + " | WATERING: " + water?.label + "\n\n" +
            "PLANTS AND JOURNAL HISTORY:\n" + (journalCtx || plantList) + "\n\n" +
            "Give 3-4 sentences of specific advice referencing plant names and recent journal notes where relevant. " +
            "If conditions are not right for watering or a key task today, use the pressure trend and forecast to suggest the best upcoming window. Include one concrete action to take today."
          }]
        })
      });
      const d = await res.json();
      const txt = d.content?.find(b=>b.type==="text")?.text;
      if (txt) setAdvice(txt);
      else setAdvice("API error: " + JSON.stringify(d).slice(0,200));
    } catch(err) {
      setAdvice("Error: " + err.message + ". Check that your browser allows API requests.");
    }
    setAdvLoad(false);
  }

  if (!weather) return <div style={{textAlign:"center",padding:48,color:C.textMid,fontFamily:F.body}}>Loading...</div>;

  return (
    <div>
      {journalPlant && <PlantJournal plant={journalPlant} onClose={()=>setJournalPlant(null)}/>}

      {frost && frost.level!=="safe" && (
        <div style={{background:frost.level==="danger"?"#200808":"#1a1505",border:`1px solid ${frost.color}`,borderRadius:16,padding:"14px 16px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:17,color:frost.color,letterSpacing:2,fontFamily:F.body}}>FROST - {frost.label.toUpperCase()}</span>
            <span style={{fontSize:26,fontFamily:F.display,color:frost.color}}>{Math.round(weather.temperature_2m)}F</span>
          </div>
          <div style={{fontSize:15,color:C.textMid,lineHeight:1.6,fontFamily:F.body}}>{frost.desc}</div>
          {plants.length>0&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${frost.color}33`}}>
              <div style={{fontSize:17,color:frost.color,letterSpacing:2,marginBottom:6,fontFamily:F.body}}>AT RISK</div>
              {plants.map(p=><div key={p.id} style={{fontSize:15,color:C.text,marginBottom:2,fontFamily:F.body}}>{p.emoji} {p.name} - {p.location}</div>)}
            </div>
          )}
        </div>
      )}

      <div style={{...css.card,borderColor:`${water.color}44`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={css.label}>Watering Advisor</span>
          <span style={css.tag(water.color)}>{water.action}</span>
        </div>
        <div style={{fontSize:26,fontFamily:F.display,color:water.color,marginBottom:6}}>{water.emoji} {water.label}</div>
        <div style={{fontSize:15,color:C.textMid,lineHeight:1.6,marginBottom:12,fontFamily:F.body}}>{water.desc}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{l:"Humidity",v:Math.round(adjHum)+"%",n:offset>0?"adj":null},{l:"Rain 24hr",v:rain24.toFixed(2)+'"'},{l:"Soil Est.",v:soil+"F"}].map(s=>(
            <div key={s.l} style={{background:C.surface,borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
              <div style={{fontSize:17,color:C.textDim,marginBottom:2,fontFamily:F.body}}>{s.l}</div>
              <div style={{fontSize:17,color:C.text,fontFamily:F.display}}>{s.v}</div>
              {s.n&&<div style={{fontSize:17,color:C.accentDim,fontFamily:F.body}}>{s.n}</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={{...css.card,borderColor:`${fung.color}33`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={css.label}>Fungal Disease Risk</span>
          <span style={css.tag(fung.color)}>{fung.level}</span>
        </div>
        <div style={{fontSize:15,color:C.textMid,lineHeight:1.6,fontFamily:F.body}}>{fung.desc}</div>
      </div>

      <div style={css.card}>
        <span style={css.label}>Soil Temperature (estimated)</span>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:8}}>
          <div style={{fontSize:36,fontFamily:F.display,color:C.text}}>{soil}F</div>
          <div style={{fontSize:17,color:C.textMid,lineHeight:1.5,fontFamily:F.body}}>
            {soil<50?"Too cold for most seeds":soil<60?"Good for brassicas, lettuce":soil<70?"Tomatoes/peppers marginal":soil<80?"Ideal for warm-season crops":"Hot - cool-season stress risk"}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {Object.entries(SEED_TEMPS).map(([name,s])=>{
            const ok=soil>=s.min, opt=soil>=s.opt-5&&soil<=s.opt+10;
            const col=opt?C.good:ok?C.warn:C.textDim;
            return (
              <div key={name} style={{background:C.surface,border:`1px solid ${col}33`,borderRadius:9,padding:"8px 10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:17,color:ok?C.text:C.textDim,fontFamily:F.body}}>{name}</span>
                <span style={{fontSize:17,color:col,padding:"2px 6px",borderRadius:8,background:`${col}18`,fontFamily:F.body}}>{opt?"Ready":ok?"~":s.min+"F+"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* My Plants */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{...css.label,marginBottom:0}}>My Plants</span>
        <button onClick={()=>setShowAdd(o=>!o)} style={css.btn}>+ Add</button>
      </div>

      {showAdd&&(
        <div style={{...css.card,borderColor:`${C.accent}44`,marginBottom:16}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {PLANT_PRESETS.map(p=>(
              <button key={p.name} onClick={()=>setNp(prev=>({...prev,name:p.name,emoji:p.emoji}))} style={{padding:"6px 10px",borderRadius:980,fontSize:17,border:`1px solid ${np.name===p.name?C.accent:C.cardBorder}`,cursor:"pointer",fontFamily:F.body,background:np.name===p.name?C.accent+"18":"transparent",color:np.name===p.name?C.accent:C.textMid}}>{p.emoji} {p.name}</button>
            ))}
          </div>
          <input value={np.name} onChange={e=>setNp(p=>({...p,name:e.target.value}))} placeholder="Or type a plant name..." style={css.input}/>
          <div style={{fontSize:16,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Location</div>
          <input value={np.location} onChange={e=>setNp(p=>({...p,location:e.target.value}))} placeholder="e.g. south bed, patio, indoors..." style={css.input}/>
          <div style={{fontSize:16,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Date planted (optional)</div>
          <input type="date" value={np.planted} onChange={e=>setNp(p=>({...p,planted:e.target.value}))} style={css.input}/>
          <div style={{display:"flex",gap:10}}>
            <button onClick={addPlant} style={{...css.btn,flex:1,textAlign:"center",padding:"11px",opacity:np.name?1:0.4}}>Add Plant</button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:"transparent",border:"none",color:C.textMid,padding:"11px",borderRadius:980,fontSize:17,cursor:"pointer",fontFamily:F.body}}>Cancel</button>
          </div>
        </div>
      )}

      {plants.length===0&&!showAdd&&(
        <div style={{...css.card,textAlign:"center",color:C.textDim,fontSize:15,lineHeight:1.8,fontFamily:F.body}}>
          <div style={{fontSize:36,marginBottom:8}}>🌱</div>
          Add plants for personalized frost alerts and AI advice.
        </div>
      )}

      {plants.map(p=>(
        <div key={p.id} style={{background:C.surface,border:"none",borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,color:C.text,fontFamily:F.body}}>{p.emoji} {p.name}</div>
            <div style={{fontSize:16,color:C.textMid,marginTop:2,fontFamily:F.body}}>{p.location}{p.planted?" - "+p.planted:""}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setJournalPlant(p)} style={{...css.btn,padding:"5px 12px",fontSize:10}}>Journal</button>
            <button onClick={()=>removePlant(p.id)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:18}}>x</button>
          </div>
        </div>
      ))}

      {/* AI Garden Advisor */}
      <div style={{...css.card,background:"linear-gradient(135deg,#e8f5ee,#f0faf2)",borderColor:`${C.accent}33`,marginTop:4}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <span style={css.label}>Garden Advisor</span>
            {weather.source==="pws"&&<div style={{fontSize:17,color:C.accent,fontFamily:F.body,marginTop:-6,marginBottom:6}}>Using your PWS data</div>}
          </div>
          <button onClick={getAdvice} style={{...css.btn,padding:"7px 14px",fontSize:10}}>{advLoad?"Thinking...":"Get Advice"}</button>
        </div>
        {advice
          ? <div style={{fontSize:16,color:C.text,lineHeight:1.8,fontFamily:F.body}}>{advice}</div>
          : <div style={{fontSize:15,color:C.textDim,lineHeight:1.6,fontFamily:F.body}}>
              {plants.length>0
                ? "Tap for advice based on today's conditions and your plant journal history."
                : "Add plants and journal notes above, then tap for specific advice."}
            </div>
        }
      </div>

      {/* Calibration */}
      {weather.source!=="pws"&&(
        <div style={css.card}>
          <button onClick={()=>setShowCal(o=>!o)} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:17,letterSpacing:3,textTransform:"uppercase",fontFamily:F.body,display:"flex",alignItems:"center",gap:8,padding:0,width:"100%",justifyContent:"space-between"}}>
            <span>Microclimate Calibration</span><span>{showCal?"^":"v"}</span>
          </button>
          {showCal&&(
            <div style={{marginTop:12}}>
              <div style={{fontSize:17,color:C.textMid,lineHeight:1.6,marginBottom:12,fontFamily:F.body}}>Station near trees? Humidity reads high. Place a second sensor in open air for 2 weeks to find your offset. (Not needed when using your PWS directly.)</div>
              <div style={{fontSize:16,color:C.textMid,marginBottom:6,fontFamily:F.body}}>Correction: <span style={{color:C.accent}}>-{offset}%</span></div>
              <input type="range" min="0" max="15" step="0.5" value={offset} onChange={e=>saveOffset(e.target.value)} style={{width:"100%",accentColor:C.accent,marginBottom:8}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:17,color:C.textDim,fontFamily:F.body}}><span>0%</span><span>15%</span></div>
              {offset>0&&<div style={{marginTop:10,fontSize:17,color:C.accent,background:"#F2F2F7",padding:"8px 12px",borderRadius:8,fontFamily:F.body}}>Raw: {weather.relative_humidity_2m}% - Adjusted: {Math.round(Math.max(0,weather.relative_humidity_2m-offset))}%</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── YARD TAB ─────────────────────────────────────────────────────────────────

const YARD_ACTIVITIES = [
  // Lawn
  { id:"preemergent",   group:"Lawn",     label:"Pre-emergent Herbicide",        emoji:"🌱" },
  { id:"lawn_fert",     group:"Lawn",     label:"Lawn Fertilizer",               emoji:"🌿" },
  { id:"overseed",      group:"Lawn",     label:"Overseeding",                   emoji:"🌾" },
  { id:"mow",           group:"Lawn",     label:"Mowing and Edging",             emoji:"✂️" },
  { id:"aerate",        group:"Lawn",     label:"Aerating",                      emoji:"🔧" },
  { id:"weed",          group:"Lawn",     label:"Pulling Weeds",                 emoji:"🫳" },
  // Garden
  { id:"transplant",    group:"Garden",   label:"Planting / Transplanting",      emoji:"🥕" },
  { id:"harden",        group:"Garden",   label:"Hardening Off Seedlings",       emoji:"🌱" },
  { id:"lemon_out",     group:"Garden",   label:"Meyer Lemon Outdoor Move",      emoji:"🍋" },
  { id:"fig_plant",     group:"Garden",   label:"Fig Tree Outdoor Timing",       emoji:"🌳" },
  { id:"bed_prep",      group:"Garden",   label:"Garden Bed Prep / Amendments",  emoji:"🪱" },
  // Exterior Projects
  { id:"paint",         group:"Projects", label:"Exterior Painting",             emoji:"🎨" },
  { id:"stain",         group:"Projects", label:"Wood Stain / Deck Sealing",     emoji:"🪵" },
  { id:"caulk",         group:"Projects", label:"Exterior Caulking / Sealing",   emoji:"🔩" },
  { id:"concrete",      group:"Projects", label:"Concrete / Masonry Work",       emoji:"🧱" },
  { id:"powerwash",     group:"Projects", label:"Power Washing",                 emoji:"💦" },
  { id:"shed",          group:"Projects", label:"Shed / Framing / Construction", emoji:"🏗️" },
  { id:"driveway_seal", group:"Projects", label:"Driveway Sealing",              emoji:"🛣️" },
  // Spraying
  { id:"herbicide",     group:"Spraying", label:"Herbicide Application",         emoji:"🧴" },
  { id:"pesticide",     group:"Spraying", label:"Pesticide / Fungicide Spray",   emoji:"🪲" },
  { id:"fert_spray",    group:"Spraying", label:"Liquid Fertilizer Spray",       emoji:"💧" },
  // Other
  { id:"compost",       group:"Other",    label:"Compost Turning / Spreading",   emoji:"♻️" },
  { id:"mulch",         group:"Other",    label:"Mulch Spreading",               emoji:"🍂" },
];

// Evaluate conditions for each activity
function evalActivity(id, wx, hist) {
  const tmp    = wx.temperature_2m;
  const hum    = wx.relative_humidity_2m;
  const wind   = wx.wind_speed_10m;
  const rain24 = wx.rain24h || hist.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const rain48 = hist.slice(-96).reduce((s,r)=>s+(r.precipitation||0),0);
  const dryStretch = hist.length > 6 && hist.slice(-72).every(s=>(s.precipitation||0)<0.05);
  const trend  = pressureTrend(hist);
  const rainComing = trend.trend==="falling_fast" || trend.trend==="falling";
  const month  = new Date().getMonth();
  const soil   = soilEst(tmp, month);
  const frost  = frostRisk(tmp, hum, wind);

  const conditions = [];
  let verdict = "yes"; // yes, wait, no

  const pass = (label, value, ok, note) => { conditions.push({label, value, ok, note}); if (!ok && verdict==="yes") verdict="wait"; };
  const fail = (label, value, note) => { conditions.push({label, value, ok:false, note}); verdict="no"; };
  const info = (label, value, note) => conditions.push({label, value, ok:true, note});

  switch(id) {
    case "preemergent":
      pass("Soil Temp", soil+"F", soil>=50&&soil<=62, soil<50?"Wait for 50F - crabgrass not germinating yet":soil>62?"Window closing - above 62F crabgrass already up":"Prime window open");
      pass("Recent Rain", rain24.toFixed(2)+'"', rain24<0.5, rain24>=0.5?"Too wet - wait for surface to dry":"Good - dry enough to apply");
      pass("Rain Forecast", rainComing?"Coming":"Clear", !rainComing, rainComing?"Rain coming - will wash away before activating":"Light rain in 24-48hrs ideal to activate");
      info("Wind", Math.round(wind)+" mph", wind<10?"Good for granular spread":"Use caution spreading granules in wind");
      break;
    case "lawn_fert":
      pass("Air Temp", Math.round(tmp)+"F", tmp>=50&&tmp<=85, tmp<50?"Turf not actively growing below 50F":tmp>85?"Too hot - fertilizer can burn grass":"Good growth window");
      pass("Soil Temp", soil+"F", soil>=55, soil<55?"Soil too cool for uptake":"Active root zone");
      pass("Recent Rain", rain24.toFixed(2)+'"', rain24<0.5, rain24>=0.5?"Too wet - risk of runoff":"Good");
      pass("Rain Forecast", rainComing?"Coming":"Stable", true, rainComing?"Good - rain will activate granules":"Water in after application if no rain in 48hrs");
      info("Wind", Math.round(wind)+" mph", wind<15?"OK for granular":"High wind - granules may drift");
      break;
    case "overseed":
      const overseedSeason = month>=8&&month<=10;
      pass("Season", overseedSeason?"In window":"Off season", overseedSeason, !overseedSeason?"Best Sept-Nov in NJ for cool-season grass":"Good timing");
      pass("Soil Temp", soil+"F", soil>=50&&soil<=65, soil>65?"Too warm - germination poor above 65F":soil<50?"Too cold":"Ideal germination range");
      pass("Recent Rain", rain24.toFixed(2)+'"', rain24<0.5, rain24>=0.5?"Wet - poor seed-soil contact":"Good");
      info("After Aeration", "Recommended", "Seed-to-soil contact is critical. Aerate first for best results.");
      break;
    case "mow":
      pass("Humidity", Math.round(hum)+"%", hum<70, hum>=70?"High humidity - grass blades damp, tears not cuts":"Good - dry cut");
      pass("Recent Rain", rain24.toFixed(2)+'"', rain24<0.15, rain24>=0.15?"Wet grass clumps and spreads disease":"Good");
      pass("Wind", Math.round(wind)+" mph", wind<20, wind>=20?"Too windy":"Good");
      pass("Temp", Math.round(tmp)+"F", tmp>45, tmp<=45?"Grass not actively growing":"Good");
      break;
    case "aerate":
      pass("Soil Moisture", rain24>0?"Moist":"Dry", rain24>0.1&&rain24<1.0, rain24<=0.1?"Soil too dry - tines won't penetrate well":rain24>=1.0?"Too wet - soil compaction worse":"Good moisture");
      pass("Soil Temp", soil+"F", soil>=50&&soil<=70, "Good for recovery");
      info("Season", month>=8&&month<=10?"Fall - ideal":"Spring OK", month>=8&&month<=10?"Fall aeration best for cool-season grass":"Spring works but fall preferred");
      break;
    case "weed":
      pass("Soil Moisture", rain24>0?"Moist":"Dry", rain24>0.1, rain24<=0.1?"Dry ground - roots break instead of pulling":"Moist soil - roots pull cleanly");
      pass("Temp", Math.round(tmp)+"F", tmp>40&&tmp<95, "Good working conditions");
      info("Tip", "After rain is best", "Weeds pull roots and all when soil is saturated");
      break;
    case "transplant":
      pass("Frost Risk", frost.label, frost.level==="safe", frost.level!=="safe"?"Frost risk - do not transplant":"Clear");
      pass("Temp", Math.round(tmp)+"F", tmp>=50&&tmp<=85, tmp<50?"Too cold - transplant shock":tmp>85?"Too hot - wilting risk":"Good");
      pass("Sun", hum>65?"Overcast":"Sunny", hum>65, hum<=65?"Direct sun increases transplant shock - overcast ideal":"Overcast conditions reduce stress");
      info("Tip", "Water first", "Water seedlings 30min before transplanting and immediately after");
      break;
    case "harden":
      pass("Frost Risk", frost.label, frost.level==="safe", frost.level!=="safe"?"Bring plants in tonight":"Safe overnight");
      pass("Temp", Math.round(tmp)+"F", tmp>=45, tmp<45?"Too cold for outdoor exposure today":"Good for gradual exposure");
      pass("Wind", Math.round(wind)+" mph", wind<20, wind>=20?"High wind damages tender seedlings":"Good");
      info("Schedule", "7-10 days", "Start with 1-2hrs shade, add 1hr daily, then introduce direct sun");
      break;
    case "lemon_out":
      pass("Overnight Low", frost.label, frost.level==="safe", frost.level!=="safe"?"Lemon needs consistent 55F+ overnight":"Check forecast");
      pass("Temp", Math.round(tmp)+"F", tmp>=60, tmp<60?"Meyer lemon needs 60F+ consistently":"Good");
      pass("Month", ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month], month>=4&&month<=9, month<4?"Wait until mid-May in NJ":month>9?"Too late in season":"Good window");
      info("Tip", "Indirect first", "Start in bright indirect outdoor light for 1-2 weeks before full sun");
      break;
    case "fig_plant":
      pass("Frost Risk", frost.label, frost.level==="safe", frost.level!=="safe"?"Fig needs all frost risk gone":"Clear");
      pass("Overnight Trend", tmp>=45?"Warming":"Cold", tmp>=45, tmp<45?"Watch overnight lows - need consistent 40F+":"Good");
      pass("Month", ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month], month>=3&&month<=4, month<3?"Wait - target mid-to-late April NJ":month>4?"Can go out anytime now":"Prime window");
      info("Soil Temp", soil+"F", soil>=50?"Ground ready":"Ground warming - wait for 50F+");
      break;
    case "bed_prep":
      pass("Temp", Math.round(tmp)+"F", tmp>=40&&tmp<95, tmp<40?"Cold but workable with layers":tmp>=95?"Too hot for physical work":"Good working conditions");
      pass("Rain", rain24.toFixed(2)+'"', rain24<1.5, rain24>=1.5?"Too waterlogged - wait for soil to drain":"Good");
      info("Tip", "Amend now", "Good time to add compost, turn soil, and prep before planting season");
      break;
    case "paint":
      pass("Temp", Math.round(tmp)+"F", tmp>=50&&tmp<=90, tmp<50?"Below 50F minimum for latex paint - will not cure":tmp>90?"Too hot - paint dries too fast, lap marks":"Good range");
      pass("Humidity", Math.round(hum)+"%", hum<=70, hum>70?"Above 70% - paint will not dry evenly":"Good");
      pass("Rain", rain24.toFixed(2)+'"', rain24<0.1, rain24>=0.1?"Surface too wet":"Good");
      pass("Rain Forecast", rainComing?"Coming":"Clear", !rainComing, rainComing?"Rain coming - needs 24hr dry time after application":"Clear window");
      info("Surface Temp", "Check direct sun", "Avoid painting surfaces in direct afternoon sun - blisters");
      break;
    case "stain":
      pass("Temp", Math.round(tmp)+"F", tmp>=50&&tmp<=90, tmp<50?"Below 50F - stain will not penetrate or cure":"Good");
      pass("Humidity", Math.round(hum)+"%", hum<=65, hum>65?"Above 65% - blotchy finish and slow cure":"Good");
      pass("Rain", rain24.toFixed(2)+'"', rain24<0.1&&!rainComing, rain24>=0.1||rainComing?"Needs 48hr dry surface and 24hr dry forecast":"Good");
      info("Surface Check", "Touch test", "Wood surface must be dry to touch - wait 48hrs after any rain on bare wood");
      break;
    case "caulk":
      pass("Temp", Math.round(tmp)+"F", tmp>=40&&tmp<=90, tmp<40?"Below 40F - silicone will not cure or adhere":"Good");
      pass("Rain", rain24.toFixed(2)+'"', rain24<0.1, rain24>=0.1?"Surface must be completely dry":"Good");
      info("Cure Time", "Product specific", "Silicone: 30min before rain. Polyurethane: 4-8hrs. Check your product label.");
      break;
    case "concrete":
      pass("Temp", Math.round(tmp)+"F", tmp>=50&&tmp<=90, tmp<50?"Below 50F - concrete will not cure properly, cracking risk":tmp>90?"Too hot - surface dries too fast":"Good");
      pass("Wind", Math.round(wind)+" mph", wind<15, wind>=15?"High wind causes surface cracking - use windbreak or reschedule":"Good");
      pass("Rain", rain24.toFixed(2)+'"', rain24<0.1&&!rainComing, rainComing?"Rain coming - do not pour":"Good");
      info("Cure", "Keep moist 7 days", "Cover with burlap and mist daily for full strength cure");
      break;
    case "powerwash":
      pass("Temp", Math.round(tmp)+"F", tmp>=45, tmp<45?"Risk of surface freezing while wet":"Good");
      pass("Rain Forecast", rainComing?"Coming":"Clear", !rainComing, rainComing?"Pointless if rain coming in 24hrs":"Good window");
      info("Wind", Math.round(wind)+" mph", wind<20?"Good":"High wind - spray control difficult");
      break;
    case "shed":
      pass("Temp", Math.round(tmp)+"F", tmp>=45, tmp<45?"Cold but workable - concrete/footings need 50F+":"Good");
      pass("Rain", rain24.toFixed(2)+'"', rain24<0.5, rain24>=0.5?"Ground too wet for digging/footings":"Good");
      pass("Wind", Math.round(wind)+" mph", wind<20, wind>=20?"High wind - framing/panels difficult to handle":"Good");
      info("Frost", frost.label, frost.level==="safe"?"Ground not frozen":"Check frost depth before digging footings");
      break;
    case "driveway_seal":
      pass("Temp", Math.round(tmp)+"F", tmp>=50&&tmp<=90, tmp<50?"Too cold - sealer will not cure":"Good");
      pass("Dry Stretch", dryStretch?"Yes":"No", dryStretch, !dryStretch?"Need 2-3 dry days before AND after application":"Good");
      pass("Rain Forecast", rainComing?"Coming":"Clear", !rainComing, rainComing?"Rain coming - do not apply":"Good window");
      info("Cure", "24-48hrs", "Keep off driveway for 24hrs, no vehicles for 48hrs");
      break;
    case "herbicide":
      pass("Wind", Math.round(wind)+" mph", wind<10, wind>=10?"Spray drift risk - wait for calm conditions below 10mph":"Good");
      pass("Rain", rain24.toFixed(2)+'"', rain24<0.1, rain24>=0.1?"Wet leaves - herbicide washes off before absorbing":"Good");
      pass("Rain Forecast", rainComing?"Coming":"Clear", !rainComing, rainComing?"Rain coming - herbicide needs 4-6hrs on dry leaves":"Good");
      pass("Temp", Math.round(tmp)+"F", tmp>=50&&tmp<90, tmp<50?"Below 50F - weeds not actively growing, poor absorption":"Good");
      break;
    case "pesticide":
      pass("Wind", Math.round(wind)+" mph", wind<10, wind>=10?"Drift risk - wait for calm":"Good");
      pass("Temp", Math.round(tmp)+"F", tmp>=50&&tmp<90, tmp>=90?"Above 90F - product breaks down faster, plant stress":"Good");
      pass("Rain", rain24.toFixed(2)+'"', rain24<0.1&&!rainComing, rainComing?"Rain coming - will wash product off":"Good");
      info("Time of Day", "Early morning best", "Spray early morning - bees less active, product more stable");
      break;
    case "fert_spray":
      pass("Wind", Math.round(wind)+" mph", wind<10, wind>=10?"Drift risk - wait for calm":"Good");
      pass("Temp", Math.round(tmp)+"F", tmp>=50&&tmp<90, tmp>=90?"Too hot - leaf burn risk from liquid fertilizer":"Good");
      pass("Rain", rain24.toFixed(2)+'"', rain24<0.1&&!rainComing, rainComing?"Rain will wash off foliar application":"Good");
      info("Tip", "Avoid direct sun", "Apply in early morning or evening to prevent leaf burn");
      break;
    case "compost":
      const cSoil = soilEst(tmp, month);
      pass("Temp", cSoil+"F (pile est.)", cSoil>=55, cSoil<55?"Below 55F - microbial activity slow, turning less effective":"Active decomposition - good time to turn");
      pass("Moisture", rain24>0.1?"Moist":"Dry", rain24>0.05&&rain24<1.5, rain24>=1.5?"Too waterlogged - add browns before turning":rain24<=0.05?"Dry - moisten pile while turning":"Good moisture");
      info("Tip", "Add browns", "After wet periods add dry cardboard/leaves to balance greens");
      break;
    case "mulch":
      pass("Wind", Math.round(wind)+" mph", wind<15, wind>=15?"High wind will scatter light mulch - wait for calm":"Good");
      pass("Rain Forecast", rainComing?"Coming":"Clear", true, rainComing?"Light rain after mulching actually helps settle it in":"Good");
      info("Tip", "2-3 inch depth", "Keep mulch away from plant stems and tree trunks to prevent rot");
      break;
    default:
      info("Conditions", "Loading...", "");
  }

  return { conditions, verdict };
}

function Yard({ weather, history }) {
  const [selected,  setSelected]  = useState("");
  const [evalResult, setEvalResult] = useState(null);
  const [aiExplain, setAiExplain] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [openGroup, setOpenGroup] = useState("Lawn");

  const groups = [...new Set(YARD_ACTIVITIES.map(a=>a.group))];

  function selectActivity(id) {
    setSelected(id);
    setAiExplain("");
    if (!weather) return;
    const result = evalActivity(id, weather, history);
    setEvalResult(result);
  }

  async function getAiExplanation(activity, result) {
    if (!weather) return;
    const apiKey = localStorage.getItem("pl_anthropic_key") || "";
    if (!apiKey) { setAiExplain("No Anthropic API key set. Tap the gear icon and add your key from console.anthropic.com"); return; }
    setAiLoading(true); setAiExplain("");
    const conditions = result.conditions.map(c=>c.label+": "+c.value+" ("+(c.ok?"pass":"fail")+") - "+c.note).join("\n");
    const src = weather.source==="pws"?"your personal backyard weather station":"a weather grid model";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","x-api-key":apiKey},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:400,
          messages:[{role:"user",content:
            "Confirm the verdict plainly and explain the single most important blocking condition. " +
              "If verdict is wait or no, reference the pressure trend (" + trend.label + ") to estimate a specific upcoming window - for example: tomorrow morning once humidity drops, or Thursday after the rain clears. Be direct. One sentence per point. No em dashes."
          }]
        })
      });
      const d = await res.json();
      const txt = d.content?.find(b=>b.type==="text")?.text;
      if (txt) setAiExplain(txt);
      else setAiExplain("API error: " + JSON.stringify(d).slice(0,200));
    } catch(err) { setAiExplain("Error: " + err.message); }
    setAiLoading(false);
  }

  const selectedActivity = YARD_ACTIVITIES.find(a=>a.id===selected);
  const verdictColors = { yes:C.good, wait:C.warn, no:C.danger };
  const verdictLabels = { yes:"Good to go", wait:"Wait for better conditions", no:"Not today" };

  if (!weather) return <div style={{textAlign:"center",padding:48,color:C.textMid,fontFamily:F.body}}>Loading...</div>;

  return (
    <div>
      <div style={{fontSize:15,color:C.textMid,marginBottom:16,lineHeight:1.6,fontFamily:F.body}}>
        Select an activity to see if conditions are right based on {weather.source==="pws"?"your PWS":"current weather"}.
      </div>

      {/* Activity selector */}
      <div style={{...css.card,marginBottom:16}}>
        {groups.map(group=>(
          <div key={group} style={{marginBottom:8}}>
            <button onClick={()=>setOpenGroup(openGroup===group?null:group)} style={{
              width:"100%",background:"none",border:"none",display:"flex",justifyContent:"space-between",
              alignItems:"center",padding:"8px 0",cursor:"pointer",
            }}>
              <span style={{fontSize:13,color:C.textMid,fontFamily:F.body,fontWeight:"600",letterSpacing:0.5}}>{group.toUpperCase()}</span>
              <span style={{color:C.textDim,fontSize:12}}>{openGroup===group?"^":"v"}</span>
            </button>
            {openGroup===group&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,paddingBottom:8}}>
                {YARD_ACTIVITIES.filter(a=>a.group===group).map(a=>(
                  <button key={a.id} onClick={()=>selectActivity(a.id)} style={{
                    padding:"10px 10px",borderRadius:12,fontSize:13,
                    border:`1px solid ${selected===a.id?C.accent:C.cardBorder}`,
                    cursor:"pointer",fontFamily:F.body,textAlign:"left",
                    background:selected===a.id?C.accentDim:"#ffffff",
                    color:selected===a.id?C.accent:C.text,
                    display:"flex",alignItems:"center",gap:6,
                  }}>
                    <span style={{fontSize:16}}>{a.emoji}</span>
                    <span style={{fontSize:12,lineHeight:1.3}}>{a.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Result */}
      {selected && evalResult && selectedActivity && (
        <div>
          {/* Verdict banner */}
          <div style={{
            background:verdictColors[evalResult.verdict]+"18",
            border:`2px solid ${verdictColors[evalResult.verdict]}`,
            borderRadius:16,padding:"16px 18px",marginBottom:12,
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontSize:17,color:C.text,fontFamily:F.body,fontWeight:"600"}}>
                {selectedActivity.emoji} {selectedActivity.label}
              </div>
              <div style={{
                fontSize:13,fontWeight:"bold",color:verdictColors[evalResult.verdict],
                padding:"4px 12px",borderRadius:980,background:verdictColors[evalResult.verdict]+"22",
                fontFamily:F.body,
              }}>
                {verdictLabels[evalResult.verdict].toUpperCase()}
              </div>
            </div>
          </div>

          {/* Condition breakdown */}
          <div style={css.card}>
            <div style={{...css.label,marginBottom:12}}>Condition Check</div>
            {evalResult.conditions.map((c,i)=>(
              <div key={i} style={{
                display:"flex",alignItems:"flex-start",gap:12,
                padding:"10px 0",
                borderBottom:i<evalResult.conditions.length-1?`1px solid ${C.cardBorder}`:"none",
              }}>
                <div style={{
                  width:22,height:22,borderRadius:"50%",flexShrink:0,marginTop:1,
                  background:c.ok?C.good+"22":C.danger+"22",
                  border:`1.5px solid ${c.ok?C.good:C.danger}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:11,color:c.ok?C.good:C.danger,
                }}>{c.ok?"✓":"!"}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                    <span style={{fontSize:14,color:C.text,fontFamily:F.body,fontWeight:"500"}}>{c.label}</span>
                    <span style={{fontSize:14,color:c.ok?C.good:C.warn,fontFamily:F.body,fontWeight:"600"}}>{c.value}</span>
                  </div>
                  {c.note&&<div style={{fontSize:13,color:C.textMid,lineHeight:1.5,fontFamily:F.body}}>{c.note}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* AI explanation */}
          <div style={{...css.card,background:C.accentDim,borderColor:C.accent+"44"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{...css.label,marginBottom:0}}>AI Recommendation</span>
              {!aiExplain&&<button onClick={()=>getAiExplanation(selectedActivity,evalResult)} style={{...css.btn,padding:"6px 14px",fontSize:12}}>{aiLoading?"Thinking...":"Get Advice"}</button>}
            </div>
            {aiExplain
              ? <div style={{fontSize:15,color:C.text,lineHeight:1.7,fontFamily:F.body}}>{aiExplain}</div>
              : <div style={{fontSize:13,color:C.textMid,fontFamily:F.body}}>Tap Get Advice for a plain-language recommendation{weather.source==="pws"?" using your PWS data":""}.</div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PHOTO AI TAB ─────────────────────────────────────────────────────────────
function PhotoAI({ weather, history }) {
  const [mode,      setMode] = useState("disease");
  const [image,   setImage]   = useState(null);
  const [preview, setPreview] = useState(null);
  const [result,  setResult]  = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const soil   = weather ? soilEst(weather.temperature_2m, new Date().getMonth()) : "--";
  const rain24 = weather?.rain24h || history.slice(-48).reduce((s,r)=>s+(r.precipitation||0),0);
  const hum    = weather ? Math.round(weather.relative_humidity_2m) : "--";
  const tmp    = weather ? Math.round(weather.temperature_2m) : "--";
  const src    = weather?.source === "pws" ? "personal weather station (backyard)" : "grid model";

  async function handleFile(file) {
    if (!file) return;
    setResult(""); setPreview(URL.createObjectURL(file));
    const b64 = await resizeImage(file, 1024);
    setImage(b64);
  }

  async function analyze() {
    if (!image || !weather) return;
    const apiKey = localStorage.getItem("pl_anthropic_key") || "";
    if (!apiKey) { setResult("No Anthropic API key set. Tap the gear icon and add your key from console.anthropic.com"); return; }
    setLoading(true); setResult("");
    const prompts = {
      disease:
        getDateContext() + "\n" +
        "WEATHER SOURCE: " + src + "\n" +
        "CONDITIONS: " + tmp + "F air, " + hum + "% humidity, soil ~" + soil + "F, " + rain24.toFixed(2) + '" rain 24hr\n\n' +
        "You are a plant pathologist and expert gardener. Analyze this photo carefully for disease, pest damage, or nutritional deficiencies. Factor in the current season and weather conditions.\n\n" +
        "Provide: 1) Most likely diagnosis 2) Confidence level 3) How the current season and weather relate to the cause 4) Specific treatment recommendation 5) What to watch for over the next week.",
      product:
        getDateContext() + "\n" +
        "WEATHER SOURCE: " + src + "\n" +
        "CONDITIONS: " + tmp + "F air, " + hum + "% humidity, soil ~" + soil + "F, " + rain24.toFixed(2) + '" rain 24hr\n\n' +
        "You are an expert agronomist and home improvement specialist. Read this product label and evaluate whether today is the right day to apply it given the exact date, season, and current conditions.\n\n" +
        "Provide: 1) Product name and type 2) Key application requirements from the label 3) Whether current conditions meet those requirements 4) Rain timing requirements 5) Clear yes or no recommendation for today with a one-sentence reason.",
    };
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","x-api-key":apiKey},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:800,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:"image/jpeg",data:image}},
            {type:"text",text:prompts[mode]},
          ]}],
        }),
      });
      const data = await res.json();
      const txt = data.content?.find(b=>b.type==="text")?.text;
      if (txt) setResult(txt);
      else setResult("No response received. Check connection.");
    } catch(err) {
      setResult("Analysis failed: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div>
      <div style={{...css.card,background:"linear-gradient(135deg,#e8f5ee,#f0faf2)",borderColor:`${C.accent}33`}}>
        <span style={css.label}>Photo Analysis</span>
        {weather?.source==="pws"&&<div style={{fontSize:17,color:C.accent,fontFamily:F.body,marginBottom:8}}>Using your PWS data for context</div>}

        <div style={{display:"flex",gap:8,marginBottom:14}}>
          {[["disease","Plant Diagnosis"],["product","Product Label"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>{setMode(id);setResult("");}} style={{flex:1,padding:"10px 6px",borderRadius:12,fontSize:17,border:`1px solid ${mode===id?C.accent:C.cardBorder}`,cursor:"pointer",fontFamily:F.body,background:mode===id?C.accent+"18":"transparent",color:mode===id?C.accent:C.textMid}}>{lbl}</button>
          ))}
        </div>

        <div onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${preview?C.accentDim:C.cardBorder}`,borderRadius:12,padding:preview?"0":"28px 16px",textAlign:"center",cursor:"pointer",marginBottom:12,overflow:"hidden",background:preview?"transparent":"#0d140d"}}>
          {preview
            ? <img src={preview} alt="upload" style={{width:"100%",borderRadius:10,display:"block",maxHeight:240,objectFit:"cover"}}/>
            : <div><div style={{fontSize:36,marginBottom:6}}>📷</div><div style={{fontSize:15,color:C.textMid,fontFamily:F.body}}>Tap to upload or take photo</div><div style={{fontSize:16,color:C.textDim,marginTop:3,fontFamily:F.body}}>Auto-resized before analysis</div></div>
          }
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>handleFile(e.target.files?.[0])}/>

        {preview&&(
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button onClick={analyze} disabled={loading||!image} style={{...css.btn,flex:1,textAlign:"center",padding:"12px",opacity:loading||!image?0.5:1}}>{loading?"Analyzing...":"Analyze Photo"}</button>
            <button onClick={()=>{setPreview(null);setImage(null);setResult("");}} style={{background:"transparent",border:"none",color:C.textMid,padding:"12px 16px",borderRadius:980,fontSize:17,cursor:"pointer",fontFamily:F.body}}>Clear</button>
          </div>
        )}

        {result&&(
          <div style={{background:"#F2F2F7",border:`1px solid ${C.accentDim}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:17,color:C.accent,letterSpacing:2,marginBottom:8,fontFamily:F.body}}>{mode==="disease"?"DIAGNOSIS":"PRODUCT ANALYSIS"}</div>
            <div style={{fontSize:16,color:C.text,lineHeight:1.8,fontFamily:F.body,whiteSpace:"pre-line"}}>{result}</div>
          </div>
        )}
      </div>
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
  const frost = weather ? frostRisk(weather.temperature_2m, weather.relative_humidity_2m, weather.wind_speed_10m) : null;

  async function readField() {
    if (!weather) return;
    const apiKey = localStorage.getItem("pl_anthropic_key") || "";
    if (!apiKey) { setAiText("No Anthropic API key set. Tap the gear icon and add your key from console.anthropic.com"); return; }
    setAiLoading(true); setAiText("");
    const src = weather.source === "pws" ? "a personal backyard weather station" : "a grid weather model";
    const phist = history.slice(-24).map(s=>
      new Date(s.ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}) + ": " + hpa2hg(s.pressure) + '"'
    ).join(", ");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","x-api-key":apiKey},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:400,
          messages:[{role:"user",content:
            (() => { const dc = getDateContext(); return (
              "FIELD LOG - " + dc.date + " " + dc.time + "\n" +
              "Location: Northern New Jersey | Source: " + src + "\n" +
              "Temp: " + Math.round(weather.temperature_2m) + "F | RH: " + weather.relative_humidity_2m + "% | Dewpoint: " + (weather.dew_point!=null?Math.round(weather.dew_point)+"F":"N/A") + "\n" +
              "Pressure: " + inHg + '" (' + trend.label + ")\n" +
              "Wind: " + Math.round(weather.wind_speed_10m) + " mph " + windLabel(weather.wind_direction_10m) + "\n" +
              (weather.uv!=null?"UV Index: "+weather.uv+"\n":"") +
              "Pressure history: " + (phist||"no history") + "\n\n" +
              "Season: " + dc.season + "\n\n" +
              "Write a 3-sentence field observation. Sentence 1: current conditions summary with key numbers. Sentence 2: one or two specific biological indicators for this date in NJ (bird, insect, or plant). Sentence 3: 12-hour outlook based on pressure trend. Clinical and brief. No em dashes. No metaphors."
            ); })()
          }]
        })
      });
      const d = await res.json();
      const txt = d.content?.find(b=>b.type==="text")?.text;
      if (txt) setAiText(txt);
      else setAiText("API error: " + JSON.stringify(d).slice(0,200));
    } catch(err) {
      setAiText("Error: " + err.message);
    }
    setAiLoading(false);
  }

  if (loading) return <div style={{textAlign:"center",padding:48,color:C.textMid,fontFamily:F.body}}>Reading conditions...</div>;

  return (
    <div>
      {apiError&&<div style={{fontSize:16,color:C.warn,background:"#FFF9F0",padding:"8px 12px",borderRadius:10,marginBottom:12,fontFamily:F.body}}>Warning: {apiError}</div>}

      {weather?.source==="pws"&&(
        <div style={{...css.card,marginBottom:12,overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:16,color:C.accent,fontFamily:F.body}}>YOUR BACKYARD PWS</div>
            <div style={{fontSize:17,color:C.textMid,fontFamily:F.body}}>Live data</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:10}}>
            {[
              {l:"Temp",v:Math.round(weather.temperature_2m)+"F"},
              {l:"Humidity",v:weather.relative_humidity_2m+"%"},
              {l:"Wind",v:Math.round(weather.wind_speed_10m)+" mph"},
              {l:"Rain 24hr",v:(weather.rain24h||0).toFixed(2)+'"'},
              ...(weather.uv!=null?[{l:"UV Index",v:weather.uv}]:[]),
              ...(weather.dew_point!=null?[{l:"Dew Point",v:Math.round(weather.dew_point)+"F"}]:[]),
              ...(weather.feels_like!=null?[{l:"Feels Like",v:Math.round(weather.feels_like)+"F"}]:[]),
              {l:"Pressure",v:inHg+'"'},
            ].map(s=>(
              <div key={s.l} style={{background:C.surface,borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
                <div style={{fontSize:11,color:C.textDim,marginBottom:2,fontFamily:F.body}}>{s.l}</div>
                <div style={{fontSize:16,color:C.text,fontFamily:F.display}}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {trend.trend==="falling_fast"&&(
        <div style={{background:"#FFF2F2",border:`1px solid ${C.danger}`,borderRadius:14,padding:"12px 16px",marginBottom:12}}>
          <div style={{fontSize:17,color:C.danger,letterSpacing:2,marginBottom:4,fontFamily:F.body}}>RAPID PRESSURE DROP</div>
          <div style={{fontSize:15,color:C.textMid,lineHeight:1.5,fontFamily:F.body}}>Pressure dropped {Math.abs(trend.delta).toFixed(1)} hPa in 6 hours. Significant weather change likely soon.</div>
        </div>
      )}

      {frost&&frost.level!=="safe"&&(
        <div style={{background:frost.level==="danger"?"#200808":"#1a1505",border:`1px solid ${frost.color}`,borderRadius:14,padding:"12px 16px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:17,color:frost.color,letterSpacing:2,fontFamily:F.body}}>FROST - {frost.label.toUpperCase()}</div>
            <div style={{fontSize:26,fontFamily:F.display,color:frost.color}}>{weather&&Math.round(weather.temperature_2m)}F</div>
          </div>
          <div style={{fontSize:15,color:C.textMid,marginTop:4,fontFamily:F.body}}>{frost.desc}</div>
        </div>
      )}

      {weather&&!weather.source==="pws"&&(
        <div style={css.card}>
          <span style={css.label}>Barometric Pressure</span>
          <div style={{fontSize:36,fontFamily:F.display,color:C.text,marginBottom:4}}>{inHg}<span style={{fontSize:16,color:C.textMid}}> inHg</span></div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:16,padding:"2px 10px",borderRadius:12,background:`${trendColor}22`,color:trendColor,fontFamily:F.body}}>{trend.label}</span>
          </div>
          {history.length>2&&<Spark data={history.slice(-24).map(s=>s.pressure)} color={C.accent}/>}
        </div>
      )}

      {weather&&(
        <>
          <div style={css.card}>
            <span style={css.label}>Wind</span>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:44,height:44,borderRadius:"50%",border:"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,background:C.surface,flexShrink:0,transform:`rotate(${weather.wind_direction_10m+180}deg)`}}>^</div>
              <div>
                <div style={{fontSize:26,fontFamily:F.display,color:C.text}}>{windLabel(weather.wind_direction_10m)} - {Math.round(weather.wind_speed_10m)} mph</div>
                <div style={{fontSize:17,color:C.textMid,fontFamily:F.body,marginTop:3}}>{weather.wind_speed_10m>=15?"Wind advisory - hold off on spraying":weather.wind_speed_10m>=10?"Moderate - use caution with sprays":"Calm - good for spray applications"}</div>
              </div>
            </div>
          </div>

          {history.length>2&&(
            <div style={css.card}>
              <span style={css.label}>Trends</span>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                {[
                  {data:history.slice(-24).map(s=>s.temp),color:"#fcd34d",label:"Temp",unit:"F"},
                  {data:history.slice(-24).map(s=>s.humidity),color:C.info,label:"Humidity",unit:"%"},
                  {data:history.slice(-24).map(s=>s.pressure),color:C.accent,label:"Pressure",unit:"hPa"},
                  {data:history.slice(-24).map(s=>s.windSpeed),color:"#c4b5fd",label:"Wind",unit:" mph"},
                ].map(s=>(
                  <div key={s.label}>
                    <div style={{fontSize:17,color:C.textDim,letterSpacing:2,textTransform:"uppercase",marginBottom:4,fontFamily:F.body}}>{s.label}</div>
                    <Spark data={s.data} color={s.color}/>
                    <div style={{fontSize:17,color:s.color,fontFamily:F.display,marginTop:2,textAlign:"right"}}>{s.data[s.data.length-1]?.toFixed(0)}{s.unit}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{...css.card,background:"linear-gradient(135deg,#e8f5ee,#f0faf2)",borderColor:`${C.accent}33`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={css.label}>Naturalist's Reading</span>
              <button onClick={readField} style={{...css.btn,padding:"7px 14px",fontSize:10}}>{aiLoading?"Reading...":"Read the Field"}</button>
            </div>
            {aiText
              ? <div style={{fontSize:16,color:C.text,lineHeight:1.8,fontStyle:"italic",fontFamily:F.body}}>{aiText}</div>
              : <div style={{fontSize:15,color:C.textDim,lineHeight:1.6,fontFamily:F.body}}>Tap for a vivid naturalist description of current conditions{weather.source==="pws"?" using your actual backyard data":""} and a 12-hour outlook.</div>
            }
          </div>
        </>
      )}
    </div>
  );
}

// ─── JOURNAL DASHBOARD HELPERS ───────────────────────────────────────────────
function getWeatherIcon(temp, rain, humidity) {
  if (rain > 0.1) return "🌧️";
  if (temp <= 32) return "❄️";
  if (temp <= 40) return "🌨️";
  if (humidity > 85) return "🌫️";
  if (temp >= 85) return "🌡️";
  if (temp >= 70) return "☀️";
  if (humidity > 70) return "🌤️";
  return "⛅";
}

function getDayCritical(snapshots) {
  if (!snapshots.length) return null;
  const minTemp = Math.min(...snapshots.map(s=>s.temp));
  const maxTemp = Math.max(...snapshots.map(s=>s.temp));
  const totalRain = snapshots.reduce((s,r)=>s+(r.precipitation||0),0);
  const pressures = snapshots.map(s=>s.pressure);
  const pressureDrop = pressures.length > 1 ? pressures[0] - pressures[pressures.length-1] : 0;
  const avgHumidity = snapshots.reduce((s,r)=>s+(r.humidity||0),0) / snapshots.length;

  if (minTemp <= 32) return { label:"Frost", value:Math.round(minTemp)+"F", color:"#7DD3FC", icon:"❄️" };
  if (totalRain > 0.5) return { label:"Rain", value:totalRain.toFixed(2)+'"', color:"#60A5FA", icon:"🌧️" };
  if (pressureDrop > 4) return { label:"Storm", value:"-"+pressureDrop.toFixed(1)+" hPa", color:"#F87171", icon:"⚠️" };
  if (avgHumidity > 82) return { label:"Humid", value:Math.round(avgHumidity)+"%", color:"#FCD34D", icon:"💧" };
  if (maxTemp >= 88) return { label:"Heat", value:Math.round(maxTemp)+"F", color:"#FB923C", icon:"🌡️" };
  return { label:"High/Low", value:Math.round(maxTemp)+"/"+Math.round(minTemp)+"F", color:"#6EE7B7", icon:"🌡️" };
}

function groupHistoryByDay(history) {
  const days = {};
  history.forEach(snap => {
    const d = new Date(snap.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"});
    if (!days[d]) days[d] = [];
    days[d].push(snap);
  });
  return days;
}

// ─── 10-DAY TRENDS ────────────────────────────────────────────────────────────
function TenDayTrends({ history }) {
  const days = groupHistoryByDay(history);
  const dayKeys = Object.keys(days).slice(-10);

  if (dayKeys.length < 2) return (
    <div style={{...css.card, textAlign:"center", color:C.textMid, fontSize:14, padding:"32px 16px"}}>
      <div style={{fontSize:32, marginBottom:8}}>📈</div>
      Keep the app open daily to build trend history.
    </div>
  );

  const tempData  = dayKeys.map(d => ({ day:d, hi:Math.max(...days[d].map(s=>s.temp)), lo:Math.min(...days[d].map(s=>s.temp)) }));
  const rainData  = dayKeys.map(d => ({ day:d, val:days[d].reduce((s,r)=>s+(r.precipitation||0),0) }));
  const pressData = dayKeys.map(d => ({ day:d, val:days[d][days[d].length-1]?.pressure || 0 }));

  const allHi = tempData.map(d=>d.hi), allLo = tempData.map(d=>d.lo);
  const tempMax = Math.max(...allHi)+2, tempMin = Math.min(...allLo)-2;
  const pressMax = Math.max(...pressData.map(d=>d.val))+2;
  const pressMin = Math.min(...pressData.map(d=>d.val))-2;
  const rainMax = Math.max(...rainData.map(d=>d.val), 0.1);

  const barW = 100 / dayKeys.length;

  return (
    <div>
      {/* Temperature */}
      <div style={css.card}>
        <span style={css.label}>Temperature - 10 Days</span>
        <svg viewBox="0 0 300 80" style={{width:"100%",height:80}} preserveAspectRatio="none">
          {tempData.map((d,i) => {
            const hiY = 80 - ((d.hi-tempMin)/(tempMax-tempMin))*72 - 4;
            const loY = 80 - ((d.lo-tempMin)/(tempMax-tempMin))*72 - 4;
            const x = i * (300/dayKeys.length) + (300/dayKeys.length)/2;
            return (
              <g key={d.day}>
                <line x1={x} y1={hiY} x2={x} y2={loY} stroke="#2D6A4F" strokeWidth="3" strokeLinecap="round" opacity="0.5"/>
                <circle cx={x} cy={hiY} r="3" fill="#FB923C"/>
                <circle cx={x} cy={loY} r="3" fill="#7DD3FC"/>
              </g>
            );
          })}
        </svg>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          {tempData.map((d,i)=>(
            <div key={d.day} style={{textAlign:"center",flex:1}}>
              <div style={{fontSize:10,color:C.textDim,fontFamily:F.body}}>{d.day.split(" ")[1]}</div>
              <div style={{fontSize:10,color:"#FB923C",fontFamily:F.body}}>{Math.round(d.hi)}</div>
              <div style={{fontSize:10,color:"#7DD3FC",fontFamily:F.body}}>{Math.round(d.lo)}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:12,marginTop:6}}>
          <span style={{fontSize:11,color:"#FB923C",fontFamily:F.body}}>● High</span>
          <span style={{fontSize:11,color:"#7DD3FC",fontFamily:F.body}}>● Low</span>
        </div>
      </div>

      {/* Rainfall */}
      <div style={css.card}>
        <span style={css.label}>Rainfall - 10 Days</span>
        <svg viewBox={"0 0 300 60"} style={{width:"100%",height:60}} preserveAspectRatio="none">
          {rainData.map((d,i) => {
            const barH = Math.max(2, (d.val/rainMax)*52);
            const x = i * (300/dayKeys.length);
            const w = (300/dayKeys.length) - 2;
            return <rect key={d.day} x={x+1} y={60-barH} width={w} height={barH} fill="#60A5FA" rx="2" opacity="0.8"/>;
          })}
        </svg>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          {rainData.map(d=>(
            <div key={d.day} style={{textAlign:"center",flex:1}}>
              <div style={{fontSize:10,color:C.textDim,fontFamily:F.body}}>{d.day.split(" ")[1]}</div>
              <div style={{fontSize:10,color:"#60A5FA",fontFamily:F.body}}>{d.val>0?d.val.toFixed(1):"-"}"</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pressure */}
      <div style={css.card}>
        <span style={css.label}>Pressure - 10 Days</span>
        <svg viewBox="0 0 300 60" style={{width:"100%",height:60}} preserveAspectRatio="none">
          {pressData.map((d,i) => {
            if (i===0) return null;
            const prev = pressData[i-1];
            const x1 = (i-1)*(300/dayKeys.length) + (300/dayKeys.length)/2;
            const x2 = i*(300/dayKeys.length) + (300/dayKeys.length)/2;
            const y1 = 60 - ((prev.val-pressMin)/(pressMax-pressMin))*52 - 4;
            const y2 = 60 - ((d.val-pressMin)/(pressMax-pressMin))*52 - 4;
            return <line key={d.day} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round"/>;
          })}
          {pressData.map((d,i) => {
            const x = i*(300/dayKeys.length) + (300/dayKeys.length)/2;
            const y = 60 - ((d.val-pressMin)/(pressMax-pressMin))*52 - 4;
            return <circle key={d.day} cx={x} cy={y} r="2.5" fill="#2D6A4F"/>;
          })}
        </svg>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          {pressData.map(d=>(
            <div key={d.day} style={{textAlign:"center",flex:1}}>
              <div style={{fontSize:10,color:C.textDim,fontFamily:F.body}}>{d.day.split(" ")[1]}</div>
              <div style={{fontSize:10,color:"#2D6A4F",fontFamily:F.body}}>{d.val.toFixed(0)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
function exportGardenLog(plants, history) {
  const days = groupHistoryByDay(history);
  const dayKeys = Object.keys(days).sort();
  const now = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});

  // Gather all plant journal entries
  const plantData = plants.map(p => {
    const entries = loadLS("pl_pjournal_"+p.id, []);
    return { ...p, entries };
  });

  // Compute season stats from history
  const allTemps = history.map(s=>s.temp).filter(Boolean);
  const allRain = history.map(s=>s.precipitation||0);
  const totalRain = allRain.reduce((a,b)=>a+b,0);
  const maxTemp = allTemps.length ? Math.max(...allTemps) : 0;
  const minTemp = allTemps.length ? Math.min(...allTemps) : 0;
  const frostDays = Object.values(days).filter(snaps=>Math.min(...snaps.map(s=>s.temp))<=32).length;
  const highHumidityDays = Object.values(days).filter(snaps=>snaps.some(s=>s.humidity>80)).length;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Plot Garden Log - ${now}</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 32px; color: #1C1C1E; }
  h1 { color: #2D6A4F; font-size: 28px; margin-bottom: 4px; }
  h2 { color: #2D6A4F; font-size: 18px; border-bottom: 2px solid #EAF4EE; padding-bottom: 6px; margin-top: 32px; }
  h3 { font-size: 15px; color: #1C1C1E; margin-bottom: 4px; }
  .subtitle { color: #6C6C70; font-size: 14px; margin-bottom: 32px; }
  .stats-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin: 16px 0; }
  .stat { background: #F2F2F7; border-radius: 12px; padding: 14px; text-align: center; }
  .stat-value { font-size: 24px; font-weight: 700; color: #2D6A4F; }
  .stat-label { font-size: 11px; color: #6C6C70; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .plant-card { background: #F2F2F7; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .plant-header { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
  .plant-meta { font-size: 12px; color: #6C6C70; margin-bottom: 12px; }
  .entry { border-left: 3px solid #2D6A4F; padding: 8px 12px; margin-bottom: 8px; background: white; border-radius: 0 8px 8px 0; }
  .entry-date { font-size: 11px; color: #6C6C70; margin-bottom: 4px; }
  .entry-note { font-size: 13px; line-height: 1.5; }
  .no-entries { font-size: 13px; color: #AEAEB2; font-style: italic; }
  .alert { background: #FFF2F2; border-left: 3px solid #FF3B30; padding: 8px 12px; border-radius: 0 8px 8px 0; margin-bottom: 6px; font-size: 13px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<h1>🌱 Plot Garden Log</h1>
<div class="subtitle">Generated ${now} - ${dayKeys.length} days of data - ${history.length} weather readings</div>

<h2>Season Summary</h2>
<div class="stats-grid">
  <div class="stat"><div class="stat-value">${totalRain.toFixed(1)}"</div><div class="stat-label">Total Rainfall</div></div>
  <div class="stat"><div class="stat-value">${Math.round(maxTemp)}F</div><div class="stat-label">Season High</div></div>
  <div class="stat"><div class="stat-value">${Math.round(minTemp)}F</div><div class="stat-label">Season Low</div></div>
  <div class="stat"><div class="stat-value">${frostDays}</div><div class="stat-label">Frost Days</div></div>
  <div class="stat"><div class="stat-value">${highHumidityDays}</div><div class="stat-label">High Humidity Days</div></div>
  <div class="stat"><div class="stat-value">${plantData.length}</div><div class="stat-label">Plants Tracked</div></div>
</div>

${frostDays > 0 ? '<div class="alert">❄️ ' + frostDays + ' frost event' + (frostDays>1?'s':'') + ' recorded this season.</div>' : ''}
${highHumidityDays > 3 ? '<div class="alert">💧 ' + highHumidityDays + ' high-humidity days - elevated fungal risk period.</div>' : ''}

<h2>Plants & Journal Notes</h2>
${plantData.map(p => `
<div class="plant-card">
  <div class="plant-header">${p.emoji} ${p.name}</div>
  <div class="plant-meta">${p.location}${p.planted ? " - planted " + p.planted : ""}</div>
  ${p.entries.length === 0
    ? '<div class="no-entries">No journal entries recorded.</div>'
    : p.entries.map(e => `
  <div class="entry">
    <div class="entry-date">${e.date} ${e.time}${e.weather ? " - " + e.weather : ""}</div>
    <div class="entry-note">${e.note || "(photo only)"}</div>
  </div>`).join('')
  }
</div>`).join('')}

<h2>Daily Weather Log</h2>
${dayKeys.map(d => {
  const snaps = days[d];
  const hi = Math.max(...snaps.map(s=>s.temp));
  const lo = Math.min(...snaps.map(s=>s.temp));
  const rain = snaps.reduce((s,r)=>s+(r.precipitation||0),0);
  const crit = getDayCritical(snaps);
  return '<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #E5E5EA;font-size:13px;">' +
    '<span style="width:70px;color:#6C6C70;">' + d + '</span>' +
    '<span>' + getWeatherIcon(hi, rain, snaps[0]?.humidity||0) + '</span>' +
    '<span>Hi ' + Math.round(hi) + 'F / Lo ' + Math.round(lo) + 'F</span>' +
    (rain > 0 ? '<span style="color:#60A5FA;">🌧 ' + rain.toFixed(2) + '"</span>' : '') +
    (crit && (crit.label==="Frost"||crit.label==="Storm") ? '<span style="color:#FF3B30;">' + crit.icon + ' ' + crit.label + '</span>' : '') +
    '</div>';
}).join('')}

<div style="margin-top:48px;font-size:11px;color:#AEAEB2;text-align:center;">
  Generated by Plot - Your backyard weather and garden advisor
</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}


// ─── JOURNAL TAB ─────────────────────────────────────────────────────────────
// ─── JOURNAL DASHBOARD ───────────────────────────────────────────────────────
function JournalDashboard({ history, journal }) {
  const days = groupHistoryByDay(history);
  const dayKeys = Object.keys(days).slice(-3).reverse();

  if (dayKeys.length === 0) return null;

  return (
    <div style={{marginBottom:4}}>
      <span style={{...css.label,marginBottom:8}}>Last 3 Days</span>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:4}}>
        {dayKeys.map((day,i) => {
          const snaps = days[day];
          const hi = Math.max(...snaps.map(s=>s.temp));
          const lo = Math.min(...snaps.map(s=>s.temp));
          const rain = snaps.reduce((s,r)=>s+(r.precipitation||0),0);
          const crit = getDayCritical(snaps);
          const avgHum = snaps.reduce((s,r)=>s+(r.humidity||0),0)/snaps.length;
          const icon = getWeatherIcon(hi, rain, avgHum);
          const hasLog = journal.some(e => e.date === day);
          const label = i===0?"Yesterday":i===1?"2 days ago":"3 days ago";

          return (
            <div key={day} style={{
              background:C.surface, borderRadius:14, padding:"12px 10px",
              boxShadow:shadow, textAlign:"center", position:"relative",
            }}>
              {hasLog && (
                <div style={{position:"absolute",top:8,right:8,width:6,height:6,borderRadius:"50%",background:C.accent}}/>
              )}
              <div style={{fontSize:9,color:C.textDim,fontFamily:F.body,marginBottom:4,letterSpacing:0.5}}>{label.toUpperCase()}</div>
              <div style={{fontSize:28,marginBottom:4}}>{icon}</div>
              <div style={{fontSize:13,fontWeight:"600",color:C.text,fontFamily:F.body}}>{Math.round(hi)}/{Math.round(lo)}F</div>
              {crit && (
                <div style={{
                  fontSize:10,color:crit.color,fontFamily:F.body,marginTop:4,
                  background:crit.color+"18",padding:"2px 6px",borderRadius:980,
                  display:"inline-block",fontWeight:"600",
                }}>
                  {crit.icon} {crit.label}: {crit.value}
                </div>
              )}
              {rain > 0 && crit?.label !== "Rain" && (
                <div style={{fontSize:10,color:"#60A5FA",fontFamily:F.body,marginTop:3}}>{rain.toFixed(2)}"</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Journal({ weather, history }) {
  const [journal,   setJournal]   = useState(()=>loadLS("pl_journal",[]));
  const [showForm,  setShowForm]  = useState(false);
  const [entry,     setEntry]     = useState({clouds:"",signs:"",notes:"",photo:null,photoPreview:null});
  const [qSigns,    setQSigns]    = useState([]);
  const [dictating, setDictating] = useState(false);
  const [rawDic,    setRawDic]    = useState("");
  const [cleaning,  setCleaning]  = useState(false);
  const recRef   = useRef(null);
  const photoRef = useRef();

  const QS = [{l:"Birds low",e:"🐦"},{l:"Leaves flipping",e:"🍃"},{l:"Earthy smell",e:"💧"},{l:"Clouds building",e:"⛅"},{l:"Heavy dew",e:"🌿"},{l:"Red sunrise",e:"🌅"},{l:"Red sunset",e:"🌇"},{l:"Cattle lying",e:"🐄"}];

  function startDictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported - try Chrome or Safari."); return; }
    const r = new SR(); r.continuous=true; r.interimResults=true; r.lang="en-US";
    recRef.current = r;
    let final = "";
    r.onresult = e => {
      let interim = "";
      for (let i=e.resultIndex;i<e.results.length;i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      setRawDic(final + interim);
    };
    r.onend = () => { setDictating(false); if (final.trim()) cleanDic(final.trim()); };
    r.start(); setDictating(true); setRawDic("");
  }

  function stopDictation() { recRef.current?.stop(); setDictating(false); }

  async function cleanDic(raw) {
    const apiKey = localStorage.getItem("pl_anthropic_key") || "";
    if (!apiKey) { setEntry(p=>({...p,notes:raw})); setCleaning(false); return; }
    setCleaning(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","x-api-key":apiKey},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:400,
          messages:[{role:"user",content:
            'Clean up this field observation dictation. Return ONLY valid JSON with no markdown or backticks:\n{"clouds":"cloud observations only","signs":"nature signs only","notes":"everything else cleaned up"}\n\nRaw: "' + raw + '"'
          }]
        })
      });
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
    setEntry(p=>({...p,photo:"data:image/jpeg;base64,"+b64,photoPreview:URL.createObjectURL(file)}));
  }

  function addEntry() {
    const signs = [entry.signs,...qSigns].filter(Boolean).join(", ");
    if (!entry.clouds&&!entry.notes&&!signs&&!entry.photo) return;
    const e = {
      id:Date.now(),
      date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),
      time:new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),
      weather:weather?(Math.round(weather.temperature_2m)+"F - "+weather.relative_humidity_2m+"% RH"+(weather.source==="pws"?" (PWS)":"")):
      "",
      clouds:entry.clouds, signs, notes:entry.notes, photo:entry.photo,
    };
    const u = [e,...journal]; setJournal(u); saveLS("pl_journal",u);
    setEntry({clouds:"",signs:"",notes:"",photo:null,photoPreview:null}); setQSigns([]); setRawDic(""); setShowForm(false);
  }

  return (
    <div>
      {/* 3-Day Dashboard */}
      <JournalDashboard history={history} journal={journal} />

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,marginTop:8}}>
        <span style={{...css.label,marginBottom:0}}>Field Journal</span>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>exportGardenLog(loadLS("pl_plants",[]), history)} style={{...css.btnSoft,padding:"8px 12px",fontSize:13}}>Export PDF</button>
          <button onClick={()=>setShowForm(o=>!o)} style={css.btn}>+ Log Entry</button>
        </div>
      </div>

      {showForm&&(
        <div style={{...css.card,borderColor:`${C.accent}44`,marginBottom:16}}>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:17,color:C.accent,letterSpacing:2,marginBottom:8,fontFamily:F.body}}>VOICE ENTRY</div>
            <button onClick={dictating?stopDictation:startDictation} style={{...css.btn,width:"100%",textAlign:"center",padding:"12px",background:dictating?"#2a0808":C.accentDim,borderColor:dictating?C.danger:C.accent+"55",color:dictating?C.danger:C.accent}}>
              {dictating?"Stop Recording":"Tap to Dictate"}
            </button>
            {dictating&&rawDic&&<div style={{fontSize:17,color:C.textMid,fontStyle:"italic",marginTop:8,lineHeight:1.5,fontFamily:F.body}}>"{rawDic}"</div>}
            {cleaning&&<div style={{fontSize:17,color:C.accent,marginTop:8,fontFamily:F.body}}>Cleaning up dictation...</div>}
          </div>

          <div style={{borderTop:`1px solid ${C.cardBorder}`,paddingTop:14,marginBottom:14}}>
            <div style={{fontSize:17,color:C.accent,letterSpacing:2,marginBottom:8,fontFamily:F.body}}>PHOTO</div>
            {entry.photoPreview
              ? <div style={{position:"relative",marginBottom:8}}>
                  <img src={entry.photoPreview} style={{width:"100%",borderRadius:10,maxHeight:200,objectFit:"cover"}}/>
                  <button onClick={()=>setEntry(p=>({...p,photo:null,photoPreview:null}))} style={{position:"absolute",top:6,right:6,background:"#ffffffcc",border:"none",color:C.text,borderRadius:"50%",width:24,height:24,cursor:"pointer",fontSize:14}}>x</button>
                </div>
              : <div onClick={()=>photoRef.current?.click()} style={{border:`2px dashed ${C.cardBorder}`,borderRadius:10,padding:"16px",textAlign:"center",cursor:"pointer",background:C.surface}}>
                  <div style={{fontSize:26,marginBottom:4}}>📷</div>
                  <div style={{fontSize:17,color:C.textMid,fontFamily:F.body}}>Add photo to entry</div>
                </div>
            }
            <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>handlePhoto(e.target.files?.[0])}/>
          </div>

          <div style={{borderTop:`1px solid ${C.cardBorder}`,paddingTop:14,marginBottom:14}}>
            <div style={{fontSize:17,color:C.accent,letterSpacing:2,marginBottom:8,fontFamily:F.body}}>QUICK SIGNS</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {QS.map(s=>(
                <button key={s.l} onClick={()=>setQSigns(p=>p.includes(s.l)?p.filter(x=>x!==s.l):[...p,s.l])} style={{padding:"5px 10px",borderRadius:18,fontSize:16,border:`1px solid ${qSigns.includes(s.l)?C.accent:C.cardBorder}`,cursor:"pointer",fontFamily:F.body,background:qSigns.includes(s.l)?C.accent+"18":"transparent",color:qSigns.includes(s.l)?C.accent:C.textMid}}>{s.e} {s.l}</button>
              ))}
            </div>
          </div>

          <div style={{borderTop:`1px solid ${C.cardBorder}`,paddingTop:14}}>
            <div style={{fontSize:16,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Clouds</div>
            <input value={entry.clouds} onChange={e=>setEntry(p=>({...p,clouds:e.target.value}))} placeholder="e.g. Cumulus building to the west..." style={css.input}/>
            <div style={{fontSize:16,color:C.textMid,marginBottom:4,fontFamily:F.body}}>Notes</div>
            <textarea value={entry.notes} onChange={e=>setEntry(p=>({...p,notes:e.target.value}))} placeholder="Observations, what happened, what you noticed..." rows={3} style={{...css.input,resize:"vertical"}}/>
          </div>

          <div style={{display:"flex",gap:10}}>
            <button onClick={addEntry} style={{...css.btn,flex:1,textAlign:"center",padding:"11px"}}>Save Entry</button>
            <button onClick={()=>{setShowForm(false);setQSigns([]);setRawDic("");}} style={{flex:1,background:"transparent",border:"none",color:C.textMid,padding:"11px",borderRadius:980,fontSize:17,cursor:"pointer",fontFamily:F.body}}>Cancel</button>
          </div>
        </div>
      )}

      {journal.length===0&&!showForm&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:C.textDim,fontSize:16,lineHeight:1.8,fontFamily:F.body}}>
          <div style={{fontSize:36,marginBottom:12}}>📓</div>
          Your field journal is empty.<br/>Dictate, photograph, or type your first observation.
        </div>
      )}

      {journal.map(e=>(
        <div key={e.id} style={css.card}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <div>
              <div style={{fontSize:17,color:C.accent,fontFamily:F.body}}>{e.date} - {e.time}</div>
              {e.weather&&<div style={{fontSize:17,color:C.textDim,marginTop:1,fontFamily:F.body}}>{e.weather}</div>}
            </div>
            <button onClick={()=>{const u=journal.filter(x=>x.id!==e.id);setJournal(u);saveLS("pl_journal",u);}} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:18,lineHeight:1}}>x</button>
          </div>
          {e.photo&&<img src={e.photo} style={{width:"100%",borderRadius:10,marginBottom:8,maxHeight:200,objectFit:"cover"}}/>}
          {e.clouds&&<div style={{fontSize:15,color:C.textMid,marginBottom:2,fontFamily:F.body}}>Clouds: {e.clouds}</div>}
          {e.signs&&<div style={{fontSize:15,color:C.textMid,marginBottom:2,fontFamily:F.body}}>Signs: {e.signs}</div>}
          {e.notes&&<div style={{fontSize:16,color:C.text,lineHeight:1.6,marginTop:6,fontFamily:F.body}}>{e.notes}</div>}
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
  {id:"trends",  label:"Trends", emoji:"📈"},
  {id:"journal", label:"Journal",emoji:"📓"},
  {id:"help",    label:"Help",   emoji:"❓"},
];

// ─── HELP TAB ─────────────────────────────────────────────────────────────────
const HELP_SECTIONS = [
  {
    id:"start",
    emoji:"🚀",
    title:"Getting Started",
    color:"#2D6A4F",
    steps:[
      {
        title:"1. Add to your home screen",
        body:"Open Plot in Safari on your iPhone. Tap the Share button (box with arrow) then tap Add to Home Screen. This gives Plot its own persistent storage and makes it feel like a native app. Always open Plot from your home screen icon."
      },
      {
        title:"2. Enter your Anthropic API key",
        body:"Tap the gear icon in the top right. Add your Anthropic API key from console.anthropic.com - this powers all the AI features: Garden Advisor, Naturalist Reading, Yard recommendations, and Photo Analysis. Your key is stored only on your device."
      },
      {
        title:"3. Connect your weather station",
        body:"If you have an Ambient Weather PWS, tap the gear icon and enter your API key, Application key, and MAC address from ambientweather.net/account. This gives Plot true hyperlocal readings from your backyard. Without a station, Plot uses a free grid model as fallback."
      },
      {
        title:"4. Add your plants",
        body:"Go to the Garden tab and tap + Add. Select from presets (Fig Tree, Lemon, Tomato, etc.) or type a custom name. Add the location in your yard and planting date if known. Your plants feed the frost alerts and AI advisor."
      },
      {
        title:"5. Start your journal",
        body:"The Journal tab is your field log. Tap + Log Entry to record observations by voice, photo, or text. Add notes to individual plants via the Journal button on each plant card. The AI advisor reads these notes when giving you advice."
      },
    ]
  },
  {
    id:"now",
    emoji:"🌿",
    title:"Now Tab",
    color:"#2D6A4F",
    steps:[
      {
        title:"What it shows",
        body:"Live conditions from your PWS or grid model - temperature, pressure, humidity, wind direction and speed. When your PWS is connected you see the full sensor array including UV index, dew point, feels-like, and 24hr rainfall."
      },
      {
        title:"Pressure trend",
        body:"The most predictive single weather signal. Rapidly falling pressure (more than 3 hPa in 6 hours) means a significant weather change is coming - Plot alerts you at the top of the screen. Rising pressure means conditions are improving."
      },
      {
        title:"Naturalist Reading",
        body:"Tap Read the Field for a brief technical field observation based on current conditions - what species are active, what the conditions mean, and a 12-hour outlook. It uses your actual PWS data when connected."
      },
      {
        title:"Trends",
        body:"As you open the app over days, it builds a history of readings. The sparkline charts show pressure, temperature, humidity and wind over the last 24 readings. The Trends tab shows 10 days of data once you have enough history."
      },
    ]
  },
  {
    id:"garden",
    emoji:"🥕",
    title:"Garden Tab",
    color:"#40916C",
    steps:[
      {
        title:"Frost Alert",
        body:"Appears prominently when temperature is at or near frost risk. Includes radiative cooling logic - on clear calm nights, ground temperature can drop below 32F even when air temp reads 35-36F. Your registered plants are listed so you know exactly what to protect."
      },
      {
        title:"Watering Advisor",
        body:"Combines 24hr rainfall from your PWS, adjusted humidity, temperature, and wind into a daily recommendation. If your station is near trees, use the Microclimate Calibration slider to correct for humidity inflation - trees transpire moisture that reads artificially high."
      },
      {
        title:"Fungal Disease Risk",
        body:"Tracks warm, wet, humid conditions over time. Elevated risk when humidity stays above 80%, temps are 60-85F, and recent rain exceeds 0.25 inches. This is the exact condition set that caused the blight and mildew issues from extended wet periods after planting."
      },
      {
        title:"Soil Temperature",
        body:"Estimated from air temperature and season. Shows a readiness grid for 8 common crops - green means optimal range, yellow means marginal, gray means too cold. Soil temp is the real trigger for germination and transplanting, not calendar date."
      },
      {
        title:"My Plants",
        body:"Tap + Add to register plants with their location and planting date. Each plant has its own Journal button - tap it to add notes, photos, and voice observations specific to that plant. The AI Garden Advisor reads all your plant journal history when generating advice."
      },
      {
        title:"Garden Advisor",
        body:"Tap Get Advice for personalized recommendations based on today's conditions and your plant journal history. If conditions are not right for a task today, it references the pressure trend to suggest the best upcoming window. Requires Anthropic API key in Settings."
      },
      {
        title:"Microclimate Calibration",
        body:"If your station is within 15-20 feet of trees or structures, humidity reads artificially high. Place a second cheap sensor ($15-25) in an open area for 2 weeks, measure the consistent difference, and set that as your offset. This corrects watering and fungal risk calculations."
      },
    ]
  },
  {
    id:"yard",
    emoji:"🌾",
    title:"Yard Tab",
    color:"#52B788",
    steps:[
      {
        title:"How it works",
        body:"Select any outdoor activity from the dropdown and Plot evaluates whether conditions are right using your live PWS data. Each activity has specific weather requirements - temperature ranges, humidity thresholds, wind limits, rainfall windows - evaluated individually with a pass/fail for each."
      },
      {
        title:"Verdict: Good to go",
        body:"All critical conditions are within spec. Tap Get Advice for a plain-language confirmation and any tips specific to today's exact conditions."
      },
      {
        title:"Verdict: Wait",
        body:"One or more conditions are outside the ideal range but not a hard failure. The AI explanation tells you exactly which condition is the blocker and uses the current pressure trend to estimate when conditions will improve."
      },
      {
        title:"Verdict: Not today",
        body:"A critical condition is outside the safe range - for example, painting below 50F or applying herbicide in 15+ mph wind. The explanation tells you specifically what needs to change and when that window might open."
      },
      {
        title:"Lawn tasks",
        body:"Pre-emergent timing is triggered by soil temperature crossing 50F - the real crabgrass germination trigger, not a calendar date. Fertilizer timing accounts for soil temp, recent rain, and rain forecast (you want rain 24-48hrs after, not immediately before)."
      },
      {
        title:"Spraying tasks",
        body:"Herbicide, pesticide, and liquid fertilizer all require wind below 10 mph to prevent drift. The wind advisory group surfaces automatically when wind exceeds 15 mph and gates all spray tasks."
      },
    ]
  },
  {
    id:"trends",
    emoji:"📈",
    title:"Trends Tab",
    color:"#60A5FA",
    steps:[
      {
        title:"10-day history",
        body:"Shows temperature highs and lows, daily rainfall totals, and pressure over the last 10 days. History builds automatically as you open the app - the more consistently you open it, the richer the data. Once the PWS cron job is running, history fills in continuously."
      },
      {
        title:"Temperature chart",
        body:"Orange dots are daily highs, blue dots are daily lows. The vertical bar between them shows the day range. Useful for spotting unusual cold snaps or heat events that might have stressed your plants."
      },
      {
        title:"Rainfall bars",
        body:"Daily totals from your PWS rain gauge or grid model. Useful for understanding cumulative moisture - if you see 3+ rainy days in a row, fungal risk is elevated even if today looks dry."
      },
      {
        title:"Pressure line",
        body:"Shows the pressure at the end of each day. A downward trend over several days is more meaningful than a single reading - it suggests a sustained pattern rather than a passing front."
      },
    ]
  },
  {
    id:"scan",
    emoji:"📸",
    title:"Scan Tab",
    color:"#F59E0B",
    steps:[
      {
        title:"Plant Disease Diagnosis",
        body:"Take or upload a photo of a sick plant and Plot analyzes it for disease, pest damage, or nutritional deficiencies. The diagnosis is cross-referenced with your current weather conditions - for example, a fungal diagnosis in high humidity after rain is much more confident than the same symptoms in dry conditions."
      },
      {
        title:"Product Label Reading",
        body:"Photograph any fertilizer, herbicide, pesticide, or paint label and Plot reads the application requirements directly from the label, then checks them against your current conditions. It gives a direct yes or no on whether today is a good day to apply that specific product."
      },
      {
        title:"Photo tips",
        body:"For plant diagnosis, get close enough that the affected area fills most of the frame. Good light helps significantly. For product labels, make sure the temperature range, application conditions, and rain-free period sections are clearly visible. Photos are automatically resized before analysis."
      },
    ]
  },
  {
    id:"journal",
    emoji:"📓",
    title:"Journal Tab",
    color:"#A78BFA",
    steps:[
      {
        title:"3-day dashboard",
        body:"The top of the journal shows the last 3 days at a glance - weather icon, high/low temperatures, and the most critical reading (frost, rain event, humidity spike, or heat). A green dot indicates you logged an observation that day."
      },
      {
        title:"Logging an entry",
        body:"Tap + Log Entry. You can dictate by voice (AI cleans up the transcription), take or upload a photo, tap quick signs (Birds low, Leaves flipping, Heavy dew - traditional weather indicators), or type notes manually. The current weather conditions are automatically attached to every entry."
      },
      {
        title:"Plant journals",
        body:"Each plant in the Garden tab has its own Journal button. Plant journals support photos (auto-resized), voice dictation, and text notes. The AI Garden Advisor reads the last 5 entries per plant when generating advice - so detailed notes lead to better recommendations."
      },
      {
        title:"Export garden log",
        body:"Tap Export PDF to generate a full season summary - all your plants, every journal entry, weather stats (total rainfall, high/low temps, frost days, high-humidity days), and any significant weather events. Opens a printable page you can save as PDF from your browser."
      },
      {
        title:"Quick signs",
        body:"The colored chips in the log entry form are traditional natural weather indicators. Birds flying low often precedes rain. Leaves flipping upside down signals humidity and approaching storms. Heavy morning dew indicates high humidity and clear overnight skies. Red sunrise can mean moisture in the atmosphere moving in."
      },
    ]
  },
  {
    id:"settings",
    emoji:"⚙️",
    title:"Settings",
    color:"#6C6C70",
    steps:[
      {
        title:"Anthropic API key",
        body:"Required for all AI features. Get yours at console.anthropic.com - create an account, go to API Keys, and create a new key. It starts with sk-ant-. There is a small per-use cost (fractions of a cent per request) billed to your Anthropic account. For typical daily use the cost is under $1/month."
      },
      {
        title:"Ambient Weather PWS",
        body:"Enter your API key, Application key (generated separately at ambientweather.net/account), and your station MAC address. The MAC address is on the station label or in the AWN mobile app under your station details. Once connected, the header shows a signal icon and the app refreshes every 5 minutes."
      },
      {
        title:"Without a weather station",
        body:"Plot works without a PWS using Open-Meteo, a free grid weather model. Data is still location-specific but uses a regional grid (~1-3 mile resolution) rather than your exact backyard. All features work - you just lose the hyperlocal accuracy that makes frost alerts and humidity readings most reliable."
      },
    ]
  },
];

function HelpSection({ section }) {
  const [open, setOpen] = useState(null);

  return (
    <div style={{...css.section, marginBottom:10}}>
      {/* Section header */}
      <div style={{padding:"14px 18px", borderBottom:`1px solid ${C.sep}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:24}}>{section.emoji}</span>
          <span style={{fontSize:16,fontWeight:"700",color:C.text,fontFamily:F.body}}>{section.title}</span>
        </div>
      </div>

      {/* Steps */}
      {section.steps.map((step,i) => (
        <div key={i}>
          <div
            onClick={()=>setOpen(open===i?null:i)}
            style={{
              display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"13px 18px",cursor:"pointer",
              borderBottom:open===i||i<section.steps.length-1?`1px solid ${C.sep}`:"none",
              background:open===i?`${section.color}08`:"transparent",
            }}
          >
            <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
              <div style={{
                width:6,height:6,borderRadius:"50%",
                background:open===i?section.color:C.textDim,
                flexShrink:0,
              }}/>
              <span style={{fontSize:14,fontWeight:"500",color:C.text,fontFamily:F.body,lineHeight:1.3}}>{step.title}</span>
            </div>
            <span style={{color:C.textDim,fontSize:13,flexShrink:0,marginLeft:8}}>{open===i?"▲":"▼"}</span>
          </div>
          {open===i&&(
            <div style={{
              padding:"12px 18px 14px 34px",
              borderBottom:i<section.steps.length-1?`1px solid ${C.sep}`:"none",
              background:`${section.color}06`,
            }}>
              <p style={{fontSize:14,color:C.textMid,lineHeight:1.7,fontFamily:F.body,margin:0}}>{step.body}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Help() {
  const [activeSection, setActiveSection] = useState("start");

  return (
    <div>
      {/* Section quick-nav */}
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:12,WebkitOverflowScrolling:"touch"}}>
        {HELP_SECTIONS.map(s=>(
          <button
            key={s.id}
            onClick={()=>setActiveSection(s.id)}
            style={{
              flexShrink:0,padding:"7px 14px",borderRadius:980,fontSize:13,
              border:`1px solid ${activeSection===s.id?s.color:C.sep}`,
              cursor:"pointer",fontFamily:F.body,fontWeight:activeSection===s.id?"600":"400",
              background:activeSection===s.id?`${s.color}18`:"transparent",
              color:activeSection===s.id?s.color:C.textMid,
              whiteSpace:"nowrap",
            }}
          >
            {s.emoji} {s.title}
          </button>
        ))}
      </div>

      {/* Active section */}
      {HELP_SECTIONS.filter(s=>s.id===activeSection).map(s=>(
        <HelpSection key={s.id} section={s}/>
      ))}

      {/* About section */}
      <div style={{...css.card,marginTop:8,textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:8}}>🌱</div>
        <div style={{fontSize:16,fontWeight:"700",color:C.text,fontFamily:F.body,marginBottom:6}}>Plot</div>
        <div style={{fontSize:13,color:C.textMid,fontFamily:F.body,lineHeight:1.7,marginBottom:12}}>
          Weather app for people who do things outside.
          Hyperlocal conditions from your own backyard station,
          combined with AI advice tailored to your specific plants, lawn, and projects.
        </div>
        <div style={{fontSize:11,color:C.textDim,fontFamily:F.body}}>
          Built by a NJ homeowner, for NJ homeowners.
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const [tab,      setTab]      = useState("now");
  const [weather,  setWeather]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [locName,  setLocName]  = useState("");
  const [apiErr,   setApiErr]   = useState(null);
  const [history,  setHistory]  = useState(()=>loadLS("pl_history",[]));
  const [showSettings, setShowSettings] = useState(false);
  const [lastFetch, setLastFetch] = useState(0);

  useEffect(()=>{ fetchWeather(); }, []);

  // Auto-refresh PWS every 5 minutes
  useEffect(()=>{
    const interval = setInterval(()=>{
      const awnKey = localStorage.getItem("pl_awn_key");
      if (awnKey) fetchWeather();
    }, 5 * 60 * 1000);
    return ()=>clearInterval(interval);
  }, []);

  async function fetchWeather() {
    setLoading(true); setApiErr(null);
    const awnKey    = localStorage.getItem("pl_awn_key");
    const awnAppKey = localStorage.getItem("pl_awn_appkey");
    const awnMac    = localStorage.getItem("pl_awn_mac");

    try {
      if (awnKey && awnAppKey && awnMac) {
        // Use PWS data
        try {
          const url = "https://rt.ambientweather.net/v1/devices/" + encodeURIComponent(awnMac) + "?apiKey=" + awnKey + "&applicationKey=" + awnAppKey + "&limit=1";
          const res = await fetch(url);
          if (!res.ok) throw new Error("AWN " + res.status);
          const data = await res.json();
          if (!data || !data[0]) throw new Error("No AWN data - check MAC address");
          const device = data[0];
          const d = device.lastData || device.last_data || device;
          if (!d || d.tempf === undefined) {
            throw new Error("Unexpected structure: " + JSON.stringify(device).slice(0,300));
          }
          const wx = {
            temperature_2m: d.tempf,
            relative_humidity_2m: d.humidity,
            surface_pressure: d.baromrelin ? d.baromrelin / 0.02953 : (d.baromabsin ? d.baromabsin / 0.02953 : 1013),
            wind_speed_10m: d.windspeedmph || 0,
            wind_direction_10m: d.winddir || 0,
            precipitation: d.hourlyrainin || 0,
            rain24h: d.dailyrainin || 0,
            rain_event: d.eventrainin || 0,
            uv: d.uv ?? null,
            solar_radiation: d.solarradiation ?? null,
            feels_like: d.feelsLike ?? d.feelslike ?? null,
            dew_point: d.dewPoint ?? d.dewpoint ?? null,
            source: "pws",
          };
          setWeather(wx);
          setLocName("Your Backyard");
          const snap = {ts:Date.now(),temp:wx.temperature_2m,humidity:wx.relative_humidity_2m,pressure:wx.surface_pressure,windSpeed:wx.wind_speed_10m,windDir:windLabel(wx.wind_direction_10m),precipitation:wx.rain24h||0};
          const hist = loadLS("pl_history",[]);
          const last = hist[hist.length-1];
          if (!last||Date.now()-last.ts>15*60*1000) {
            const u = [...hist,snap].slice(-1000); setHistory(u); saveLS("pl_history",u);
          }
          setLastFetch(Date.now());
          setLoading(false);
          return;
        } catch(pwsErr) {
          setApiErr("PWS connection failed: " + pwsErr.message + ". Using grid data.");
        }
      }

      // Fallback to Open-Meteo
      navigator.geolocation
        ? navigator.geolocation.getCurrentPosition(
            async p => {
              try {
                const [wxRes, geoRes] = await Promise.all([
                  fetch("https://api.open-meteo.com/v1/forecast?latitude="+p.coords.latitude+"&longitude="+p.coords.longitude+"&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto"),
                  fetch("https://nominatim.openstreetmap.org/reverse?lat="+p.coords.latitude+"&lon="+p.coords.longitude+"&format=json"),
                ]);
                const w = await wxRes.json(), g = await geoRes.json(), c = w.current;
                const wx = {...c, rain24h:0, uv:null, solar_radiation:null, feels_like:null, dew_point:null, source:"openmeteo"};
                setWeather(wx);
                setLocName(g.address?.city||g.address?.town||g.address?.county||"Your Location");
                const snap = {ts:Date.now(),temp:c.temperature_2m,humidity:c.relative_humidity_2m,pressure:c.surface_pressure,windSpeed:c.wind_speed_10m,windDir:windLabel(c.wind_direction_10m),precipitation:c.precipitation||0};
                const hist = loadLS("pl_history",[]);
                const last = hist[hist.length-1];
                if (!last||Date.now()-last.ts>30*60*1000) {
                  const u=[...hist,snap].slice(-500); setHistory(u); saveLS("pl_history",u);
                }
              } catch { useDemoData(); }
              setLoading(false);
            },
            ()=>{ useDemoData(); setLoading(false); }
          )
        : useDemoData();
    } catch { useDemoData(); }
    setLoading(false);
  }

  function useDemoData() {
    setWeather({temperature_2m:62,relative_humidity_2m:68,surface_pressure:1013,wind_speed_10m:8,wind_direction_10m:225,precipitation:0,rain24h:0,uv:null,solar_radiation:null,feels_like:null,dew_point:null,source:"openmeteo"});
    setLocName("Morris County, NJ");
    setApiErr("Using demo data - connect your PWS in Settings.");
  }

  const frost = weather ? frostRisk(weather.temperature_2m, weather.relative_humidity_2m, weather.wind_speed_10m) : null;
  const showFrostBadge = frost && frost.level !== "safe";
  const awnConfigured = !!(localStorage.getItem("pl_awn_key") && localStorage.getItem("pl_awn_mac"));

  return (
    <div style={{fontFamily:F.body,background:"#F2F2F7",minHeight:"100dvh",color:C.text,maxWidth:480,margin:"0 auto",display:"flex",flexDirection:"column"}}>
      {showSettings && <Settings onClose={()=>{ setShowSettings(false); fetchWeather(); }}/>}

      {/* Header - solid teal */}
      <div style={{background:"#2D6A4F",padding:"max(env(safe-area-inset-top,18px),18px) 20px 16px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:22,fontWeight:"700",color:"#ffffff",fontFamily:F.body,letterSpacing:-0.5}}>Plot</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.75)",marginTop:1,fontFamily:F.body}}>
              {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{textAlign:"right"}}>
              {weather&&<div style={{fontSize:42,color:"#ffffff",fontWeight:"200",lineHeight:1,letterSpacing:-2,fontFamily:F.num}}>{Math.round(weather.temperature_2m)}<span style={{fontSize:24,fontWeight:"300"}}>°</span></div>}
              <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",fontFamily:F.body,marginTop:2}}>
                {weather?.source==="pws" ? "📡 Backyard" : "📍 "}{weather?.source!=="pws"&&(locName||"Locating...")}
              </div>
              {showFrostBadge&&<div style={{fontSize:12,color:"#FFE5E5",fontWeight:"600",marginTop:2}}>❄ {frost.label}</div>}
            </div>
            <button onClick={()=>setShowSettings(true)} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#ffffff",borderRadius:12,padding:"8px 12px",cursor:"pointer",fontSize:16}}>⚙</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"16px 16px 80px"}}>
        {tab==="now"     && <Now     weather={weather} locationName={locName} loading={loading} apiError={apiErr} history={history}/>}
        {tab==="garden"  && <Garden  weather={weather} history={history}/>}
        {tab==="yard"    && <Yard    weather={weather} history={history}/>}
        {tab==="trends"  && <TenDayTrends history={history}/>}
        {tab==="photo"   && <PhotoAI weather={weather} history={history}/>}
        {tab==="journal" && <Journal weather={weather} history={history}/>}
        {tab==="help"    && <Help/>}
        {tab==="photo"   && <PhotoAI weather={weather} history={history}/>}
      </div>

      {/* Tab bar - bottom, iOS native style */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,display:"flex",borderTop:`1px solid ${C.sep}`,background:"rgba(255,255,255,0.95)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",flexShrink:0,paddingBottom:"env(safe-area-inset-bottom,0px)",zIndex:50}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1,padding:"8px 2px 10px",border:"none",
            background:"transparent",
            color:tab===t.id?C.accent:"#8E8E93",
            fontSize:10,cursor:"pointer",letterSpacing:0,
            fontFamily:F.body,
            display:"flex",flexDirection:"column",alignItems:"center",gap:2,
            fontWeight:tab===t.id?"600":"400",
          }}>
            <span style={{fontSize:22}}>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}