# Jev Check

**Live app:** https://jev-check-five.vercel.app (frontend; the backend is being deployed separately, so checks need a running backend)

Check photos automatically. Tell the app what a good photo should show, take a picture, and it says whether everything is there, outlines what it found, and asks a person only when it is unsure. Built on [Jev](https://typesafe.ai), TypeSafe's decision model, using its image input: one Jev call answers every rule in a check in about 400 ms.

Examples: is every order item in the box before it is sealed, is the parcel at the door with the label visible, is the worker wearing a helmet and vest, was the right part installed and the cover closed.

### What you can do

- **Write rules in plain words.** Yes/no questions ("Is the shipping label readable?"), multiple choice with the answers that pass ("sealed / open / damaged"), or "find my item" using a photo of that item.
- **Check a photo or use the live camera.** Live mode keeps checking as you move and saves the photo the moment everything passes.
- **See where things are.** Items the app finds are outlined on the photo.
- **Review the unsure ones.** Borderline answers wait for a person; their decisions show how often the app agreed, rule by rule.
- **No sign-up.** Each browser gets its own private space; link a phone to the same data with a QR code.
- **Light and dark mode, and a guided tour** for first-time visitors.

The demo check ("Try a 30-second demo") works with any laptop camera and needs no setup.

## How a check works

```
photo ─► one Jev call ─► code applies thresholds ─► Pass / Fail / Needs review / Retake
          quality gate                                        │
          + every item, in parallel                           ▼
                                                 a person reviews ─► agreement per item
```

Item types:

| Type | Jev question | Passes when |
| --- | --- | --- |
| Object present / absent | Noul + Box, with reference photos | probability (or 1 − probability) ≥ threshold |
| Yes / no | Noul | probability ≥ threshold |
| Pick one | Choice over your answers | probability of the passing answers ≥ threshold |

- Within 15 points under the threshold, an item becomes **review** instead of **fail**.
- Photo quality under 40% makes the whole run **retake**.
- Object items match in one of two modes. **kind** asks "is there a {label}?" with the reference as a hint. **exact** asks whether it is the same object as the reference photos, which rejects look-alikes. In testing, exact mode scored a same-shape, different-color disc at 0.06 where kind mode scored it 0.92, but exact mode was unsure (about 0.6) on a plain blue rectangle that kind mode scored 0.96. Pick per item.

Live mode judges camera frames without saving them, and saves the frame that passes from the backend's preview cache, so the saved photo is exactly the one Jev judged.

## Layout

- `frontend/`: Next.js 16, React 19, Tailwind 4. Proxies `/api/*` to the backend.
- `backend/`: Node.js, Express 5, TypeScript, Knex on Postgres (`DATABASE_URL`, e.g. Neon), sharp for image fitting. Layers: routes → controllers → services → models. Schema in `backend/docs/db/sql-init.sql`; it is idempotent and runs on every start.

## Run

```bash
cd backend
cp .env.example .env        # add DATABASE_URL and TYPESAFE_API_KEY (or JEV_MOCK=1 to fake Jev)
npm install && npm run dev  # :4000

cd frontend
npm install
npm run dev                 # http://localhost:3000
npm run dev:https           # https://<laptop-ip>:3000, needed for phone cameras
```

## Users without sign-up

Each browser gets an anonymous owner on its first request: the backend creates it and sets a random token in an `httpOnly` cookie (`jev_owner`). Only the token's SHA-256 is stored (`sessions`). Every object, checklist and run carries `owner_id`, every query filters by it, and stored photos live under `owners/<id>/`, served only to that owner.

To use the same data on a phone, choose "Other device": one browser shows a 6-digit code and a QR code (10 minutes, single use), the other enters or scans it and gets its own session on the same owner.

Checks spend Jev credits on the deployer's key, so each owner is rate limited (`LIMIT_CHECKS_PER_SECOND`, `LIMIT_CHECKS_PER_DAY`), and so is the number of new owners per IP per day. Limits are counted in memory per server instance.

## Backend API

All JSON responses use `{code, error, message, data}`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/objects` | `{label, name?}` |
| GET | `/objects`, `/objects/:id` | Objects with their reference photos |
| PUT | `/objects/:id` | `{name?, label?, active?}` |
| POST | `/references` | Multipart `object_id`, `image`, optional `box`. Without a box, Jev proposes one |
| PUT | `/references/:id` | `{box}` re-crops, `{active: 0}` removes |
| POST | `/checklists` | `{name, description?, webhook_url?, items: [...]}` |
| GET | `/checklists`, `/checklists/:id` | With run stats; the single view adds objects and per-item agreement |
| PUT | `/checklists/:id` | Full update; items without `id` are added, missing ones are retired |
| POST | `/runs` | Multipart `checklist_id`, `image`, `source?`, `save?`. `save=0` returns a preview. JSON `{checklist_id, preview_id}` saves a preview |
| GET | `/runs?checklist_id=&verdict=&unreviewed=1` | Run history |
| GET | `/runs/:id` | One run |
| PUT | `/runs/:id` | `{final_verdict, reviews: [{item_id, outcome}]}` or `{active: 0}` |
| POST | `/owners/links` | Create a one-time code to link another device |
| POST | `/owners/links/claim` | `{code}`: join that owner from this browser |
| GET | `/files/*` | Stored images, owner only |

When a checklist has a `webhook_url`, every saved run is POSTed to it as `{event: "run.completed", run}`.

## Jev notes

- Image input is a preview: every request sends `TypeSafe-Danger-Zone-Images: true`, and Box needs `jev-1.14.0` or `jev-preview`.
- Jev rejects images outside 280–1568 px per side instead of resizing them, so the backend fits every image first (`backend/src/services/images.ts`).
- A Box answer always returns a box, even when the object is absent, so boxes are only drawn when the presence answer is at least 0.5.
- Measured on this setup: about 350–450 ms and about 4,000 input tokens per run with 4 items, roughly $0.00017 per check.
