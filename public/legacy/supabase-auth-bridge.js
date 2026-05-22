/* Playly Supabase Auth Bridge — Phase 7b (2026-05-22, v2 cookie-based).
 *
 * Legacy signin/signup → POST kredensial ke /api/auth/bridge (Next.js
 * route handler). Route itu sign-in ke Supabase via @supabase/ssr →
 * session ter-tulis ke COOKIE. Karena same-origin, cookie ke-set di
 * browser → Next.js /dashboard (auth-gated via cookie) accessible.
 *
 * v1 (deprecated) pakai CDN supabase-js langsung → session ke localStorage,
 * yang TIDAK kebaca @supabase/ssr (cookie-based). v2 ini fix gap itu.
 *
 * Silent fail kalau endpoint unreachable — legacy auth tetap jalan.
 */
(function () {
  "use strict";

  var ENDPOINT = "/api/auth/bridge";

  // Sync legacy signin → Supabase cookie session.
  async function syncSignin(email, password, profile) {
    return postBridge(email, password, profile, "signin");
  }

  // Sync legacy signup → Supabase cookie session.
  async function syncSignup(email, password, profile) {
    return postBridge(email, password, profile, "signup");
  }

  async function postBridge(email, password, profile, kind) {
    if (!email || !password) {
      return { synced: false, reason: "missing_credentials" };
    }
    try {
      const resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email,
          password: password,
          name: profile && profile.name ? profile.name : "",
        }),
      });
      let data;
      try {
        data = await resp.json();
      } catch {
        data = null;
      }
      if (resp.ok && data && data.ok) {
        console.log(
          "[supabase-bridge] ✓ " +
            kind +
            " synced to Supabase (cookie set, action=" +
            (data.action || "?") +
            ")"
        );
        return { synced: true };
      }
      const reason = (data && data.error) || "http_" + resp.status;
      console.warn("[supabase-bridge] " + kind + " sync failed:", reason);
      return { synced: false, reason: reason };
    } catch (err) {
      console.warn("[supabase-bridge] " + kind + " sync exception:", err);
      return { synced: false, reason: String(err) };
    }
  }

  // Sign out dari Supabase (clear cookie). Dipanggil saat legacy logout.
  async function syncSignout() {
    try {
      await fetch(ENDPOINT, {
        method: "DELETE",
        credentials: "same-origin",
      });
    } catch (err) {
      console.warn("[supabase-bridge] signout exception:", err);
    }
  }

  window.supabaseAuthBridge = {
    syncSignin: syncSignin,
    syncSignup: syncSignup,
    syncSignout: syncSignout,
  };
})();
