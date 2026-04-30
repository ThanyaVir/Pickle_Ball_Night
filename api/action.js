// POST /api/action — apply an action to the event state
// Body: { action: string, payload: object, adminToken: string|null }
//
// Actions:
//  - "submit-score": player action, no admin check
//  - "verify-admin": just validates pin
//  - "new-round" / "reshuffle-round" / "undo-last-round" / "reset-event": admin only
//
// Storage: Vercel KV (single key, full state replace per write).
// Admin PIN comes from process.env.ADMIN_PIN (default "0430" — event date).

const KEY = "pb_event_state_v1";
const DEFAULT_PIN = "0430";

const BULL = ["Bam","Jeana","Gate","Jean","Card","Hun","Tanya","Yong","Gun","Lek","Roong","Chin","Thee","Kwan","Penn"];
const BEAR = ["Jon","Tae (IC)","Non","Ploy","Vij","Paeng","Harry","Turbo","Nut","Pum","Didee","Tae AO","Satang","Tong","Chot"];
const COURTS = ["PB3","PB4","PB5","PB6"];
const PER_TEAM = 2;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function gamesPlayedMap(rounds) {
  const m = {};
  [...BULL, ...BEAR].forEach(p => m[p] = 0);
  for (const r of rounds) for (const c of r.courts) [...c.bull, ...c.bear].forEach(p => m[p] = (m[p]||0)+1);
  return m;
}
function generateRound(prev) {
  const games = gamesPlayedMap(prev);
  const sortByPlayed = (arr) => shuffle(arr).sort((a,b) => games[a] - games[b]);
  const bullSorted = sortByPlayed(BULL);
  const bearSorted = sortByPlayed(BEAR);
  const need = COURTS.length * PER_TEAM;
  const bullPlay = shuffle(bullSorted.slice(0, need));
  const bearPlay = shuffle(bearSorted.slice(0, need));
  const courts = COURTS.map((name, i) => ({
    court: name,
    bull: bullPlay.slice(i*2, i*2+2),
    bear: bearPlay.slice(i*2, i*2+2),
    bullScore: null, bearScore: null, scoredBy: null, scoredAt: null
  }));
  return { id: Date.now(), number: prev.length + 1, courts, createdAt: new Date().toISOString() };
}
function applyAction(state, action, payload) {
  state = state ? JSON.parse(JSON.stringify(state)) : { rounds: [] };
  if (!state.rounds) state.rounds = [];
  if (action === "new-round") {
    state.rounds.push(generateRound(state.rounds));
  } else if (action === "reshuffle-round") {
    if (state.rounds.length) {
      state.rounds[state.rounds.length-1] = generateRound(state.rounds.slice(0,-1));
    }
  } else if (action === "submit-score") {
    const { roundId, court, bullScore, bearScore, scoredBy } = payload || {};
    const round = state.rounds.find(r => r.id === roundId);
    if (!round) throw new Error("round not found");
    const c = round.courts.find(c => c.court === court);
    if (!c) throw new Error("court not found");
    if (typeof bullScore !== "number" || typeof bearScore !== "number" || bullScore < 0 || bearScore < 0 || bullScore > 99 || bearScore > 99) {
      throw new Error("invalid score");
    }
    c.bullScore = bullScore;
    c.bearScore = bearScore;
    c.scoredBy = scoredBy || null;
    c.scoredAt = new Date().toISOString();
  } else if (action === "undo-last-round") {
    state.rounds.pop();
  } else if (action === "reset-event") {
    state.rounds = [];
  } else {
    throw new Error("unknown action: " + action);
  }
  return state;
}

async function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const mod = await import("@vercel/kv");
  return mod.kv;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { action, payload, adminToken } = req.body || {};
    const adminPin = process.env.ADMIN_PIN || DEFAULT_PIN;
    const ADMIN_ACTIONS = new Set(["new-round","reshuffle-round","undo-last-round","reset-event"]);

    if (action === "verify-admin") {
      return res.status(200).json({ ok: adminToken === adminPin });
    }
    if (ADMIN_ACTIONS.has(action) && adminToken !== adminPin) {
      return res.status(403).json({ error: "admin only" });
    }
    if (!action) return res.status(400).json({ error: "missing action" });

    const kv = await getKv();
    if (!kv) {
      // No storage configured — server is read-only in this mode; client should be in offline mode anyway.
      return res.status(503).json({ error: "backend storage not configured" });
    }
    const current = (await kv.get(KEY)) || { rounds: [] };
    const next = applyAction(current, action, payload);
    await kv.set(KEY, next);
    return res.status(200).json({ ok: true, state: next });
  } catch (e) {
    return res.status(400).json({ error: e.message || String(e) });
  }
}
