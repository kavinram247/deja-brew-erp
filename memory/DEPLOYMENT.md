# Deployment Constraints — DO NOT BREAK

User's production stack:
- Frontend: Vercel (https://deja-brew-erp.vercel.app)
- Backend:  Render FastAPI (https://deja-brew-erp.onrender.com)
- DB:       MongoDB Atlas (user-managed)

## Hard Rules (verified by user 2026-02-22)

1. ❌ **DO NOT add `emergentintegrations` to `backend/requirements.txt`** — private Emergent package, not on PyPI, crashes every Render build with `ERROR: No matching distribution found`. Any LLM integration on this project must use the public openai/anthropic/google-genai SDKs directly (no emergent LLM key possible in prod).

2. ❌ **DO NOT overwrite or delete** these files — user maintains them in their repo:
   - `frontend/yarn.lock`       (Vercel uses yarn install)
   - `frontend/vercel.json`     (SPA routing rewrites)
   - `frontend/.npmrc`          (`legacy-peer-deps=true`)
   - `frontend/src/utils/api.js` (Authorization Bearer interceptor)

3. ❌ **DO NOT revert to cookie-based auth.** Cross-origin cookies Vercel↔Render get blocked. Auth is Bearer token in `localStorage` + `Authorization: Bearer <token>` header via axios interceptor. Backend `auth_router.py` returns `{token, user}` on login; `get_current_user` reads the Bearer header.

4. ✅ **Backend CORS** reads `FRONTEND_URL` + `ALLOWED_ORIGINS` env vars — never hardcode origins.

## Sandbox ≠ Production warning

The `/app` sandbox in this container is **not in sync** with user's GitHub repo for the auth files above. Before making any change that touches `auth_router.py`, `api.js`, `AuthContext.js`, or `ProtectedRoute.jsx`:

- Either: ask the user to paste current contents of those files, OR
- Leave them untouched and scope changes around them.

If a feature genuinely needs auth changes, explicitly confirm with the user first and remind them the changes must preserve Bearer-token flow.

## Render env vars (user has set these)

```
MONGO_URL         = <Atlas URI>
DB_NAME           = dejabrew
JWT_SECRET        = <random>
FRONTEND_URL      = https://deja-brew-erp.vercel.app
ALLOWED_ORIGINS   = <comma-separated if additional>
ADMIN_EMAIL       = owner@dejabrew.com
ADMIN_PASSWORD    = <set by user>
```

## Vercel env vars

```
REACT_APP_BACKEND_URL = https://deja-brew-erp.onrender.com
```
