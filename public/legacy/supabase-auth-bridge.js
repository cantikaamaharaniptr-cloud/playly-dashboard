/* Playly Supabase Auth Bridge — Phase B1 (2026-05-22).
 *
 * Legacy signin/signup → POST kredensial ke /api/auth/bridge → server-side
 * Supabase Auth sign-in/sign-up. Tujuan: backend migration (auth sekarang
 * di server, bukan cuma localStorage hash).
 *
 * Same-origin (playly-dashboard.vercel.app) → cookie auto-set di browser
 * via @supabase/ssr. Future endpoint Next.js bisa baca cookie.
 *
 * Silent fail kalau endpoint unreachable — legacy auth tetap jalan
 * (localStorage tetap source of truth selama transition B1-B4).
 *
 * NOTE: jangan hapus tanpa rencana — ini foundation Phase B2-B5 yang
 * shift profile/state ke Supabase tables.
 */
(function () {
  "use strict";

  var ENDPOINT = "/api/auth/bridge";

  // Sync legacy signin → Supabase auth.users (server-side).
  async function syncSignin(email, password, profile) {
    return postBridge(email, password, profile, "signin");
  }

  // Sync legacy signup → Supabase auth.users.
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
            " synced to Supabase Auth (action=" +
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
