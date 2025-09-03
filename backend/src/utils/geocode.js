const PC_BASE = "https://api.postcodes.io/postcodes/";

export async function geocodeUK({ postcode }) {
  if (!postcode) return null;
  const pc = String(postcode).trim();
  try {
    const r = await fetch(PC_BASE + encodeURIComponent(pc));
    if (!r.ok) return null;
    const j = await r.json();
    if (j.status === 200 && j.result) {
      return { lat: j.result.latitude, lng: j.result.longitude, source: "postcodes.io" };
    }
  } catch {}
  return null;
}
