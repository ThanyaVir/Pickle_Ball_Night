# IS Pickleball Night — Event Hub

Single-page web app for the 30 April 2026 IS Pickleball Night at Asoke Sports Club.

## What it does

- **Roster** — shows the Bull (15) and Bear (15) team split with skill markers and games-played counts
- **Round** — admin-generated round with 4 courts (PB3–PB6), 2 Bull vs 2 Bear per court
- **Submit** — anyone can submit a court's score (Bull pts vs Bear pts)
- **Standings** — live team scores: total points + matches won
- **Admin** — PIN-gated panel to start rounds, re-shuffle, undo, or reset

The round-generation algorithm prioritises players who've sat out the most, so over the night everyone gets fairly even play time.

## Setup (one-time, ~2 min)

After deploying to Vercel:

1. Open the Vercel project dashboard → **Storage** tab
2. Click **Create Database** → choose **KV** (or **Upstash for Redis** in the marketplace — same thing)
3. Choose the free tier, click **Create**, then **Connect Project**
4. Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars and triggers a redeploy
5. (Optional) Add `ADMIN_PIN` env var. Default is **`0430`**

After step 4 the app shows "🟢 Online" in the admin panel and state syncs across all devices.

If KV isn't set up, the app still works in **single-device mode** — state lives in the admin's browser localStorage. Useful as a fallback (admin shares their phone screen).

## Running the night

1. Admin opens the app, taps **Admin** tab, enters PIN, taps **Start Round 1**
2. Send the URL to the group (Line/WhatsApp/QR code)
3. Each round (15 min): players check **Round** tab to see their court assignment
4. After each match, one player per court taps **Submit**, picks their court, enters Bull/Bear scores, submits
5. When the group is ready for the next round (or after a drink break), admin taps **Start Round 2**, repeat
6. **Standings** tab shows the running tally — winner is whichever team has more matches won at the end (with total points as a tiebreaker / secondary view)

## Files

- `index.html` — entire frontend (UI, state management, polling, round-gen client copy)
- `api/state.js` — GET full event state from KV
- `api/action.js` — POST actions (admin & player) — server-authoritative round generation and scoring
- `package.json` — declares `@vercel/kv` dep
- `vercel.json` — clean URLs

## Tech notes

- State is one JSON blob in KV under key `pb_event_state_v1` — overwrites on every action. Fine for ~30 players × ~12 rounds × 4 courts of writes.
- Client polls `/api/state` every 5 seconds when online.
- No real auth — admin actions are PIN-gated server-side. Score submissions are open by design (trust-based; players self-identify via the optional name dropdown).
- To wipe and start over, admin → Reset event.
