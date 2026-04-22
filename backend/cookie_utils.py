import os


def cookie_kwargs(max_age: int) -> dict:
    """
    Returns kwargs for response.set_cookie() adapted to env.

    Production (cross-origin Vercel <-> Render):
      COOKIE_SECURE=true, COOKIE_SAMESITE=none  -> Secure + SameSite=None
    Local dev (same-origin):
      defaults -> Secure=False, SameSite=lax
    """
    secure = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
    samesite = os.environ.get("COOKIE_SAMESITE", "lax").lower()
    if samesite not in ("lax", "none", "strict"):
        samesite = "lax"
    # Browsers require Secure=True when SameSite=None
    if samesite == "none":
        secure = True
    return {
        "httponly": True,
        "secure": secure,
        "samesite": samesite,
        "max_age": max_age,
        "path": "/",
    }


def delete_cookie_kwargs() -> dict:
    # Must match the set kwargs for the browser to clear them.
    secure = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
    samesite = os.environ.get("COOKIE_SAMESITE", "lax").lower()
    if samesite not in ("lax", "none", "strict"):
        samesite = "lax"
    if samesite == "none":
        secure = True
    return {"path": "/", "secure": secure, "samesite": samesite}
