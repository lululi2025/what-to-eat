export default async function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) {
    return res.status(500).send("GOOGLE_MAPS_KEY not configured");
  }

  const { ref, w = "120" } = req.query;
  if (!ref) {
    return res.status(400).send("missing ref");
  }
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(ref)) {
    return res.status(400).send("invalid ref");
  }

  const maxWidthPx = Math.min(Math.max(parseInt(w, 10) || 120, 1), 4800);

  const url =
    `https://places.googleapis.com/v1/${ref}/media` +
    `?maxWidthPx=${maxWidthPx}` +
    `&key=${encodeURIComponent(key)}`;

  try {
    const upstream = await fetch(url, { redirect: "manual" });
    const loc = upstream.headers.get("location");
    if (loc) {
      res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
      return res.redirect(302, loc);
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    return res.status(upstream.status).send(buf);
  } catch (e) {
    return res.status(502).send(String(e?.message || e));
  }
}
