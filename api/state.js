// GET /api/state — returns full event state
// Storage: Vercel KV. Falls back to a flag if not configured so the client
// can switch into single-device (localStorage) mode gracefully.

const KEY = "pb_event_state_v1";

async function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const mod = await import("@vercel/kv");
  return mod.kv;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }
  try {
    const kv = await getKv();
    if (!kv) {
      return res.status(200).json({ _fallback: true, state: { rounds: [] } });
    }
    const state = (await kv.get(KEY)) || { rounds: [] };
    return res.status(200).json({ state });
  } catch (e) {
    return res.status(200).json({ _fallback: true, error: String(e), state: { rounds: [] } });
  }
}
