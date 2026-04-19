export const CLOUD_GUIDE = [
  { name: "Cumulus", emoji: "⛅", description: "Puffy, white, flat-bottomed. Fair weather when small.", forecast: "Fair weather", signal: "good", detail: "When cumulus clouds grow tall and dark at the base, they're becoming cumulonimbus — storm incoming within hours.", tip: "Watch vertical growth. If they're building upward rapidly in the afternoon, seek shelter early." },
  { name: "Cumulonimbus", emoji: "⛈️", description: "Towering anvil-shaped storm clouds. Thunder and lightning.", forecast: "Severe storm", signal: "danger", detail: "The anvil shape indicates ice crystals — the storm has reached the tropopause. Highly dangerous.", tip: "If you can see the anvil top spreading sideways, the storm is mature. Get indoors immediately." },
  { name: "Stratus", emoji: "🌫️", description: "Low, flat gray blanket. Drizzle likely. Overcast all day.", forecast: "Drizzle / fog", signal: "caution", detail: "Forms when moist air cools below its dew point near the surface. Often burns off by midday in summer.", tip: "Morning stratus in coastal areas usually clears. Stratus that thickens through the day means rain is coming." },
  { name: "Cirrus", emoji: "🌤️", description: "Thin wispy streaks high up. Ice crystals. Precedes fronts.", forecast: "Change in 24–48 hrs", signal: "watch", detail: "Made of ice crystals at 20,000+ feet. When they thicken and lower into cirrostratus, rain is 12–24 hrs away.", tip: "A halo around the sun or moon through cirrostratus is one of the most reliable rain predictors in folk meteorology." },
  { name: "Altocumulus", emoji: "🌥️", description: "Mid-level rows of gray/white puffs. 'Mackerel sky.'", forecast: "Rain within 24 hrs", signal: "watch", detail: "The classic 'mackerel sky' — 'mackerel sky, not 24 hours dry' is surprisingly accurate for incoming fronts.", tip: "Morning altocumulus castellanus (small towers on top) strongly predicts afternoon thunderstorms." },
  { name: "Nimbostratus", emoji: "🌧️", description: "Dark, thick, featureless gray. Steady rain for hours.", forecast: "Steady precipitation", signal: "caution", detail: "Unlike cumulonimbus, nimbostratus brings steady prolonged rain rather than violent short bursts.", tip: "If the rain has been steady for over an hour with no clearing, you're under nimbostratus. Plan for it to last." }
];

export const NATURE_SIGNS = [
  { sign: "Leaves showing undersides", meaning: "Low pressure dropping — rain likely within hours", type: "plants", emoji: "🍃" },
  { sign: "Swallows flying very low", meaning: "Insects flying low ahead of rain; storm incoming", type: "animals", emoji: "🐦" },
  { sign: "Cattle lying down in fields", meaning: "Animals sense pressure drop; rain probable", type: "animals", emoji: "🐄" },
  { sign: "Pine cones opening wide", meaning: "Low humidity, dry and fair conditions", type: "plants", emoji: "🌲" },
  { sign: "Strong smell from swamps/ponds", meaning: "Low pressure lifting organic gases — rain coming", type: "atmosphere", emoji: "💧" },
  { sign: "Red sky at morning", meaning: "Moisture and low pressure incoming from the west", type: "sky", emoji: "🌅" },
  { sign: "Red sky at evening", meaning: "Dry, dusty air in the west — fair weather coming", type: "sky", emoji: "🌇" },
  { sign: "Smoke descending from fire", meaning: "Low pressure pushing smoke down — stormy weather ahead", type: "atmosphere", emoji: "🔥" },
  { sign: "Spiders spinning large webs", meaning: "Sensing stable, fair weather ahead", type: "animals", emoji: "🕷️" },
  { sign: "Heavy dew on grass at dawn", meaning: "Clear skies overnight, fair day likely ahead", type: "atmosphere", emoji: "🌿" },
  { sign: "Wind backing (counterclockwise)", meaning: "Deteriorating weather, storm approaching", type: "wind", emoji: "🌀" },
  { sign: "Wind veering (clockwise)", meaning: "Improving conditions, clearing likely", type: "wind", emoji: "🌬️" },
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

export const SIG = { good: "#4ade80", neutral: "#94a3b8", watch: "#fbbf24", caution: "#fb923c", danger: "#f87171" };
export const TYPE_COLORS = { plants: "#86efac", animals: "#fcd34d", atmosphere: "#93c5fd", sky: "#f9a8d4", wind: "#c4b5fd" };

export function windDirLabel(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function interpretPressure(hpa) {
  if (hpa > 1022) return { label: "High Pressure", desc: "Settled, fair weather. Animals relaxed, birds active.", signal: "good" };
  if (hpa > 1013) return { label: "Normal", desc: "Stable conditions. No strong weather signal.", signal: "neutral" };
  if (hpa > 1000) return { label: "Low Approaching", desc: "Watch for changes. Leaves may flip. Swallows fly low.", signal: "watch" };
  return { label: "Low Pressure", desc: "Rain or storms likely. Cattle lie down. Strong smell from ponds.", signal: "danger" };
}

export function interpretHumidity(pct) {
  if (pct < 30) return "Very dry — pine cones opening wide. Fire risk elevated.";
  if (pct < 55) return "Comfortable and dry. Good visibility.";
  if (pct < 75) return "Moderately humid. Dew likely overnight.";
  return "Very humid. Heavy dew, fog possible at dawn.";
}

export function interpretVisibility(km) {
  if (km > 15) return { label: "Crystal clear", note: "High pressure, dry air." };
  if (km > 8) return { label: "Good", note: "Normal visibility." };
  if (km > 3) return { label: "Hazy", note: "Moisture or particles. Front may be approaching." };
  return { label: "Poor", note: "Fog or heavy moisture." };
}
