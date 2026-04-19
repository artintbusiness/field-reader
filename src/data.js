export const CLOUD_GUIDE = [
  { name: "Cumulus", emoji: "⛅", description: "Puffy, white, flat-bottomed. Fair weather when small.", forecast: "Fair weather", signal: "good", detail: "When cumulus clouds grow tall and dark at the base, they're becoming cumulonimbus — storm incoming within hours.", tip: "Watch vertical growth. If they're building upward rapidly in the afternoon, seek shelter early.", why: "Cumulus form in rising warm air (thermals). Their size tells you how unstable the atmosphere is — small means calm, towering means energy is building." },
  { name: "Cumulonimbus", emoji: "⛈️", description: "Towering anvil-shaped storm clouds. Thunder and lightning.", forecast: "Severe storm", signal: "danger", detail: "The anvil shape indicates ice crystals — the storm has reached the tropopause. Highly dangerous.", tip: "If you can see the anvil top spreading sideways, the storm is mature. Get indoors immediately.", why: "The anvil spreads because it hits the stratosphere and can't rise further. Lightning, hail, and tornadoes all originate from these clouds." },
  { name: "Stratus", emoji: "🌫️", description: "Low, flat gray blanket. Drizzle likely. Overcast all day.", forecast: "Drizzle / fog", signal: "caution", detail: "Forms when moist air cools below its dew point near the surface. Often burns off by midday in summer.", tip: "Morning stratus in coastal areas usually clears. Stratus that thickens through the day means rain is coming.", why: "Unlike rain clouds, stratus produces drizzle — tiny droplets that stay suspended. It forms when a warm moist layer sits over cooler surface air." },
  { name: "Cirrus", emoji: "🌤️", description: "Thin wispy streaks high up. Ice crystals. Precedes fronts.", forecast: "Change in 24–48 hrs", signal: "watch", detail: "Made of ice crystals at 20,000+ feet. When they thicken and lower into cirrostratus, rain is 12–24 hrs away.", tip: "A halo around the sun or moon through cirrostratus is one of the most reliable rain predictors in folk meteorology.", why: "Cirrus are the leading edge of an approaching warm front — they appear first because they're highest. Think of them as nature's 48-hour advance warning." },
  { name: "Altocumulus", emoji: "🌥️", description: "Mid-level rows of gray/white puffs. 'Mackerel sky.'", forecast: "Rain within 24 hrs", signal: "watch", detail: "The classic 'mackerel sky' — 'mackerel sky, not 24 hours dry' is surprisingly accurate for incoming fronts.", tip: "Morning altocumulus castellanus (small towers on top) strongly predicts afternoon thunderstorms.", why: "These form in the middle atmosphere where moisture is spreading ahead of a front. The fish-scale pattern shows turbulence between stable and unstable layers." },
  { name: "Nimbostratus", emoji: "🌧️", description: "Dark, thick, featureless gray. Steady rain for hours.", forecast: "Steady precipitation", signal: "caution", detail: "Unlike cumulonimbus, nimbostratus brings steady prolonged rain rather than violent short bursts.", tip: "If the rain has been steady for over an hour with no clearing, you're under nimbostratus. Plan for it to last.", why: "Nimbostratus is the rain-producing layer of a warm front. It's thick enough to block all sunlight and can produce continuous precipitation for 12+ hours." }
];

export const NATURE_SIGNS = [
  { sign: "Leaves showing undersides", meaning: "Low pressure dropping — rain likely within hours", type: "plants", emoji: "🍃", why: "Trees evolved to turn their leaves before rain — the increased wind and humidity from approaching low pressure triggers this response." },
  { sign: "Swallows flying very low", meaning: "Insects flying low ahead of rain; storm incoming", type: "animals", emoji: "🐦", why: "Insects descend as pressure drops (their bodies sense it). Swallows follow their food source down — one of the most reliable storm predictors." },
  { sign: "Cattle lying down in fields", meaning: "Animals sense pressure drop; rain probable", type: "animals", emoji: "🐄", why: "Cattle are believed to lie down to keep a dry patch of ground — or their inner ear senses pressure changes. Either way, it works." },
  { sign: "Pine cones opening wide", meaning: "Low humidity, dry and fair conditions", type: "plants", emoji: "🌲", why: "Pine cones are natural hygrometers — they open in dry air to release seeds and close in humidity to protect them. Fully open means dry." },
  { sign: "Strong smell from swamps/ponds", meaning: "Low pressure lifting organic gases — rain coming", type: "atmosphere", emoji: "💧", why: "Low atmospheric pressure allows gases trapped in mud and water to escape more easily. That earthy, sulfurous smell is a genuine pressure alarm." },
  { sign: "Red sky at morning", meaning: "Moisture and low pressure incoming from the west", type: "sky", emoji: "🌅", why: "'Red sky at morning, sailor's warning' — dust and moisture in the eastern sky means weather systems are moving in from the west." },
  { sign: "Red sky at evening", meaning: "Dry, dusty air in the west — fair weather coming", type: "sky", emoji: "🌇", why: "'Red sky at night, sailor's delight' — red light scattering in the western sky means dry air is behind you and fair weather is ahead." },
  { sign: "Smoke descending from fire", meaning: "Low pressure pushing smoke down — stormy weather ahead", type: "atmosphere", emoji: "🔥", why: "Smoke normally rises in high pressure. When it descends or hangs low, pressure is dropping and the atmosphere is less stable." },
  { sign: "Spiders spinning large webs", meaning: "Sensing stable, fair weather ahead", type: "animals", emoji: "🕷️", why: "Spiders are sensitive to vibration and air pressure. They spin larger webs in stable, high-pressure conditions when flying insects are more active." },
  { sign: "Heavy dew on grass at dawn", meaning: "Clear skies overnight, fair day likely ahead", type: "atmosphere", emoji: "🌿", why: "Heavy dew means radiative cooling happened overnight — heat escaped to a clear sky. A dewy morning usually means the sky was clear and will stay fair." },
  { sign: "Wind backing (counterclockwise)", meaning: "Deteriorating weather, storm approaching", type: "wind", emoji: "🌀", why: "In the Northern Hemisphere, wind that shifts counterclockwise (N→W→S) indicates a low-pressure system is approaching." },
  { sign: "Wind veering (clockwise)", meaning: "Improving conditions, clearing likely", type: "wind", emoji: "🌬️", why: "Clockwise wind shifts (S→W→N) indicate high pressure building — a classic post-frontal clearing pattern." },
];

export const WIND_COMPASS = [
  { dir: "N", meaning: "Cold, dry air. Fair but chilly.", emoji: "❄️" },
  { dir: "NE", meaning: "Often brings coastal rain or snow.", emoji: "🌨️" },
  { dir: "E", meaning: "Moist air; rain or fog likely.", emoji: "🌧️" },
  { dir: "SE", meaning: "Warm and humid; storms possible.", emoji: "⛈️" },
  { dir: "S", meaning: "Warm, moist. Thunderstorm risk.", emoji: "🌩️" },
  { dir: "SW", meaning: "Often clearing after a front.", emoji: "🌤️" },
  { dir: "W", meaning: "Fair, dry, and clearing.", emoji: "☀️" },
  { dir: "NW", meaning: "Cold front passing. Clearing and crisp.", emoji: "🌬️" },
];

export const QUICK_SIGNS = [
  { label: "Birds low", emoji: "🐦" },
  { label: "Leaves flipping", emoji: "🍃" },
  { label: "Earthy smell", emoji: "💧" },
  { label: "Clouds building", emoji: "⛅" },
  { label: "Smoke descending", emoji: "🔥" },
  { label: "Heavy dew", emoji: "🌿" },
  { label: "Red sunrise", emoji: "🌅" },
  { label: "Red sunset", emoji: "🌇" },
  { label: "Cattle lying", emoji: "🐄" },
  { label: "Spiders spinning", emoji: "🕷️" },
  { label: "Pine cones open", emoji: "🌲" },
  { label: "Wind shifting", emoji: "🌀" },
];

export const OBSERVATION_PROMPTS = [
  "What are the birds doing?",
  "Any unusual smells in the air?",
  "What's the cloud base height — low or high?",
  "Which direction is the wind coming from?",
  "Are leaves or branches moving?",
  "Any signs from animals or insects?",
  "What does the sky look like to the west?",
];

export const SIG = { good: "#4ade80", neutral: "#94a3b8", watch: "#fbbf24", caution: "#fb923c", danger: "#f87171" };
export const TYPE_COLORS = { plants: "#86efac", animals: "#fcd34d", atmosphere: "#93c5fd", sky: "#f9a8d4", wind: "#c4b5fd" };

// Conversions
export function hpaToInHg(hpa) { return (hpa * 0.02953).toFixed(2); }

export function windDirLabel(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function interpretPressure(hpa) {
  const inHg = parseFloat(hpaToInHg(hpa));
  if (inHg > 30.20) return { label: "High Pressure", desc: "Settled, fair weather. Animals relaxed, birds active at height.", signal: "good" };
  if (inHg > 29.92) return { label: "Normal", desc: "Stable conditions. No strong weather signal.", signal: "neutral" };
  if (inHg > 29.50) return { label: "Low Approaching", desc: "Watch for changes. Leaves may flip. Swallows fly low.", signal: "watch" };
  return { label: "Low Pressure", desc: "Rain or storms likely. Cattle lie down. Strong earthy smell from ponds.", signal: "danger" };
}

export function interpretHumidity(pct) {
  if (pct < 30) return "Very dry — pine cones opening wide. Fire risk elevated.";
  if (pct < 55) return "Comfortable and dry. Good visibility.";
  if (pct < 75) return "Moderately humid. Dew likely overnight.";
  return "Very humid. Heavy dew, fog possible at dawn.";
}

// Visibility from dew point depression — more reliable than API field
export function calcVisibility(tempF, humidity) {
  // Convert to Celsius
  const tempC = (tempF - 32) * 5/9;
  // Magnus formula dew point
  const a = 17.27, b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
  const dewC = (b * alpha) / (a - alpha);
  const depression = tempC - dewC; // larger = clearer

  if (depression > 15) return { label: "Excellent", note: "Very dry air — distant features sharply defined. High pressure likely." };
  if (depression > 8) return { label: "Good", note: "Clear conditions. Normal daytime visibility." };
  if (depression > 4) return { label: "Moderate", note: "Some haze. Moisture in the air — frontal system may be near." };
  if (depression > 2) return { label: "Poor", note: "Significant haze or light fog. Dew point close to temperature." };
  return { label: "Fog likely", note: "Dew point nearly equals temperature — fog forming or imminent." };
}

// Seasonal context
export function seasonalContext(hpa, month) {
  const inHg = parseFloat(hpaToInHg(hpa));
  const season = month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "fall" : "winter";
  const normal = { spring: 29.92, summer: 29.90, fall: 29.95, winter: 29.88 }[season];
  const diff = inHg - normal;
  if (Math.abs(diff) < 0.1) return `Typical for ${season}.`;
  if (diff > 0.3) return `Unusually high for ${season} — very settled conditions.`;
  if (diff > 0.1) return `Slightly above normal for ${season}.`;
  if (diff < -0.3) return `Unusually low for ${season} — heightened storm risk.`;
  return `Slightly below normal for ${season}.`;
}
