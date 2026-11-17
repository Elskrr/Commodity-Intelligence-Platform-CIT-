# CIT V5 — Public Demo Deployment

## Selected architecture

**Vercel Hobby + `CIT_PUBLIC_DEMO=1` + sanitized JSON snapshot**

Evidence for this choice is in [`PUBLIC_DEMO_AUDIT.md`](./PUBLIC_DEMO_AUDIT.md). GitHub Pages / static export was rejected because the App Router pages are Server Components that currently depend on a server read layer.

The full local terminal (SQLite, scheduler, writes, CIE regeneration) remains intact when `CIT_PUBLIC_DEMO` is unset.

---

## Prerequisites

1. Node.js **22+**
2. A generated snapshot at `public-data/snapshot.json`
3. A Vercel account on the **Hobby** (free) plan
4. A Git repository (this workspace was not a git repo at audit time — initialize and push to GitHub first)

---

## 1. Refresh the public snapshot (local)

From a machine that has the real SQLite database:

```bash
# CIT_PUBLIC_DEMO must be unset so export reads SQLite
unset CIT_PUBLIC_DEMO
npm run export:public-demo
```

This writes `public-data/snapshot.json` (allowlisted fields only). Commit that file with the public-demo deploy branch.

Do **not** commit `.env`, `data/*.db`, or API keys.

---

## 2. Local verification of demo mode

```bash
npm run typecheck
npm run build:public-demo
npm run start:public-demo
# open http://localhost:3001 → /sulphur/overview
```

Checks:

- Banner shows snapshot timestamp
- Commodity navigation / charts / reports work
- `/system/*` and `/sulphur/manual-input` redirect to overview
- Refresh / generate / acknowledge actions return denial (server-side)

---

## 3. GitHub + Vercel

### Initialize git (if needed)

```bash
cd "/Users/elskrr/Desktop/COMMODITY INTELLIGENCE"
git init
git add .
git status   # confirm .env and data/*.db are NOT staged
git commit -m "Prepare CIT public demo snapshot deployment"
```

Create a **private** GitHub repository, then:

```bash
git remote add origin git@github.com:<YOU>/<REPO>.git
git branch -M main
git push -u origin main
```

### Vercel project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the private GitHub repository
3. Framework: Next.js (auto)
4. Set Environment Variables (Production + Preview):

| Name | Value |
|------|-------|
| `CIT_PUBLIC_DEMO` | `1` |
| `AI_PROVIDER` | `local` |

Do **not** set `AI_API_KEY` on the public project.

5. Deploy
6. Open the resulting `https://*.vercel.app` URL and verify the dashboard

### CLI alternative

```bash
npx vercel login
npx vercel link
npx vercel env add CIT_PUBLIC_DEMO production   # enter: 1
npx vercel --prod
```

Stop at login/link if authorization is required — do not claim a live URL until the HTTPS site is tested.

---

## 4. README Live Demo link

Only after the HTTPS URL is verified:

```markdown
## Live Interactive Dashboard

[Launch Commodity Intelligence Platform](https://YOUR-VERIFIED-URL.vercel.app)
```

If the source repo stays private, only collaborators see that README. For a public entry point without publishing source, create a separate public README-only repository that links to the Vercel URL.

---

## 5. Redeploying after data updates

```bash
unset CIT_PUBLIC_DEMO
npm run export:public-demo
git add public-data/snapshot.json
git commit -m "Refresh public demo snapshot"
git push
```

Vercel rebuilds automatically. Live ingestion is **not** enabled on Hobby for V5.

---

## 6. Environment reference

| Variable | Local full app | Public demo |
|----------|----------------|-------------|
| `CIT_PUBLIC_DEMO` | unset | `1` |
| `CIT_DATABASE_PATH` | optional | unused |
| `CIT_PUBLIC_SNAPSHOT_PATH` | optional | defaults to `public-data/snapshot.json` |
| `AI_PROVIDER` | local/cloud | force `local` |
| `AI_API_KEY` | optional | **omit** |

---

## 7. Security checklist before every push

- [ ] `.env*` not tracked (except `.env.example`)
- [ ] `data/*.db` not tracked
- [ ] No API keys in source or snapshot
- [ ] Snapshot validated (`npm run export:public-demo` prints no secret scan errors)
- [ ] Admin routes blocked by middleware when demo flag is on
- [ ] Server Actions return denial in demo mode
