/* Playly Supabase Auth Bridge — Phase B1+B2 (2026-05-22).
 *
 * Legacy signin/signup → POST kredensial + profile metadata ke
 * /api/auth/bridge → server-side:
 *   B1: Supabase Auth sign-in/sign-up (auth.users)
 *   B2: Upsert profile row di public.profiles
 *
 * Same-origin (playly-dashboard.vercel.app) → cookie auto-set di browser
 * via @supabase/ssr.
 *
 * Silent fail kalau endpoint unreachable — legacy auth tetap jalan
 * (localStorage tetap source of truth selama transition B1-B4).
 *
 * NOTE: jangan hapus tanpa rencana — foundation Phase B3-B5 yang shift
 * user state + switch primary source ke Supabase.
 */
(function () {
  "use strict";

  var ENDPOINT = "/api/auth/bridge";

  function syncSignin(email, password, profile) {
    return postBridge(email, password, profile, "signin");
  }

  function syncSignup(email, password, profile) {
    return postBridge(email, password, profile, "signup");
  }

  async function postBridge(email, password, profile, kind) {
    if (!email || !password) {
      return { synced: false, reason: "missing_credentials" };
    }
    var p = profile || {};
    try {
      var resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email,
          password: password,
          // Profile metadata untuk upsert ke public.profiles (B2)
          name:       p.name       || "",
          username:   p.username   || "",
          tier:       p.tier       || "free",
          bio:        p.bio        || "",
          avatar:     p.avatar     || "",
          joined_at:  p.joinedAt   || p.joined_at || "",
        }),
      });
      var data;
      try {
        data = await resp.json();
      } catch (_) {
        data = null;
      }
      if (resp.ok && data && data.ok) {
        var profileNote = data.profileSynced ? " + profile" : "";
        console.log(
          "[supabase-bridge] ✓ " +
            kind +
            " synced to Supabase Auth" +
            profileNote +
            " (action=" +
            (data.action || "?") +
            ")"
        );
        return { synced: true, profileSynced: !!data.profileSynced };
      }
      var reason = (data && data.error) || "http_" + resp.status;
      console.warn("[supabase-bridge] " + kind + " sync failed:", reason);
      return { synced: false, reason: reason };
    } catch (err) {
      console.warn("[supabase-bridge] " + kind + " sync exception:", err);
      return { synced: false, reason: String(err) };
    }
  }

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
