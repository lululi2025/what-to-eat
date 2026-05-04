const ALLOWED_TYPES = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "meal_takeaway",
  "meal_delivery",
  "bar",
  "food",
]);

const PRICE_MAP = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.shortFormattedAddress",
  "places.formattedAddress",
  "places.location",
  "places.currentOpeningHours.openNow",
  "places.photos",
].join(",");

export default async function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) {
    return res.status(500).json({ status: "ERROR", error_message: "GOOGLE_MAPS_KEY not configured" });
  }

  const { location, radius = "2000", type = "restaurant", language = "zh-TW" } = req.query;

  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(location || "");
  if (!m) {
    return res.status(400).json({ status: "INVALID_REQUEST", error_message: "invalid location" });
  }
  if (!ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ status: "INVALID_REQUEST", error_message: "invalid type" });
  }
  const r = Math.min(Math.max(parseInt(radius, 10) || 2000, 1), 50000);

  const body = {
    includedTypes: [type],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) },
        radius: r,
      },
    },
    languageCode: language,
  };

  try {
    const upstream = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        status: "ERROR",
        error_message: data?.error?.message || `HTTP ${upstream.status}`,
      });
    }

    const results = (data.places || []).map((p) => ({
      place_id: p.id,
      name: p.displayName?.text || "",
      types: p.types || [],
      rating: p.rating || 0,
      user_ratings_total: p.userRatingCount || 0,
      price_level: PRICE_MAP[p.priceLevel] ?? 0,
      vicinity: p.shortFormattedAddress || p.formattedAddress || "",
      opening_hours:
        p.currentOpeningHours && typeof p.currentOpeningHours.openNow === "boolean"
          ? { open_now: p.currentOpeningHours.openNow }
          : undefined,
      geometry: {
        location: {
          lat: p.location?.latitude || 0,
          lng: p.location?.longitude || 0,
        },
      },
      photos: (p.photos || []).slice(0, 1).map((ph) => ({ photo_reference: ph.name })),
    }));

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      status: results.length ? "OK" : "ZERO_RESULTS",
      results,
    });
  } catch (e) {
    return res.status(502).json({ status: "ERROR", error_message: String(e?.message || e) });
  }
}
