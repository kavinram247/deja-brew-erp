# Deployment Guide — MongoDB Atlas + Render + Vercel

Your stack:
- **Frontend** → Vercel (`https://deja-brew-erp.vercel.app`)
- **Backend** → Render (`https://deja-brew-erp.onrender.com`)
- **Database** → MongoDB Atlas (your own cluster)

## Why login worked but saves failed

Vercel and Render are different domains → browser treats every API call as **cross-origin**.
The default `SameSite=Lax` + `Secure=False` cookies that work fine locally get **dropped silently** on cross-origin requests. Login "succeeded" (200 OK) but the browser never stored the cookie, so every subsequent call was unauthenticated → "failed to save / authenticate".

The code now reads cookie behavior from env vars, so you just need to set the right values on Render.

---

## ✅ Environment Variables to SET on Render (backend)

Go to Render Dashboard → your service → **Environment** → add/update these:

| Key | Value |
|---|---|
| `MONGO_URL` | `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?retryWrites=true&w=majority` (your Atlas URI) |
| `DB_NAME` | `dejabrew` (or whatever name you want) |
| `JWT_SECRET` | Any long random string (e.g. `openssl rand -hex 32`). **Keep it secret.** |
| `FRONTEND_URL` | `https://deja-brew-erp.vercel.app` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `none` |
| `ADMIN_EMAIL` | `owner@dejabrew.com` (or your preferred owner email) |
| `ADMIN_PASSWORD` | A strong password — this is what you'll log in with |

Optional:
| Key | Value |
|---|---|
| `ALLOWED_ORIGINS` | Extra comma-separated origins if you add custom domains later |

Then **redeploy** the Render service (it auto-redeploys on env change, but hit "Manual Deploy" → "Clear build cache & deploy" to be safe).

---

## ✅ Environment Variables to SET on Vercel (frontend)

Go to Vercel Dashboard → your project → **Settings → Environment Variables**:

| Key | Value | Environments |
|---|---|---|
| `REACT_APP_BACKEND_URL` | `https://deja-brew-erp.onrender.com` | Production, Preview, Development |

**Important:** after changing env vars on Vercel, you must **Redeploy** (Deployments tab → ⋯ → Redeploy) — Vercel bakes env vars into the build.

---

## ✅ Atlas IP Whitelist

In MongoDB Atlas → **Network Access** → add:
- `0.0.0.0/0` (Allow from Anywhere) — simplest
- Or specifically Render's egress IPs (Render docs list them, but they rotate — `0.0.0.0/0` is fine for small apps with strong auth).

---

## 🔍 Smoke Test After Redeploy

From your laptop:

```bash
# 1. Login — should return 200 + set Secure/SameSite=None cookies
curl -i -X POST https://deja-brew-erp.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@dejabrew.com","password":"<ADMIN_PASSWORD>"}'
```

Expected response headers:
```
HTTP/2 200
set-cookie: access_token=...; HttpOnly; Secure; SameSite=None; ...
set-cookie: refresh_token=...; HttpOnly; Secure; SameSite=None; ...
```

If you see `SameSite=Lax` or missing `Secure` → the env vars didn't apply, re-check Render env and redeploy.

Then in your browser at `https://deja-brew-erp.vercel.app`:
1. Login as owner
2. Open DevTools → Application → Cookies → `https://deja-brew-erp.onrender.com`
3. You should see `access_token` and `refresh_token` with `SameSite=None` and `Secure` checked
4. Create a walk-in / a bill → should save (no "failed to save" toast)

---

## 🐛 If still failing

- **Render free tier cold start**: First request after 15min idle takes ~30s. The frontend axios call may time out. Either upgrade to paid, or bump axios timeout.
- **Atlas auth failure**: Check MONGO_URL has `?retryWrites=true&w=majority` and URL-encoded password chars.
- **CORS block**: Browser console will show `blocked by CORS policy`. Fix is `FRONTEND_URL` env on Render — must **exactly match** the Vercel origin including protocol and no trailing slash.
- **Seeded owner lost**: If `ADMIN_EMAIL` / `ADMIN_PASSWORD` changed, backend reseeds on startup; the old password still works until startup. If login fails completely, redeploy backend to trigger reseed.
