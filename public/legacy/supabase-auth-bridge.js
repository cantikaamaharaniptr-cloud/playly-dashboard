/* Playly Supabase Auth Bridge — Phase B1+B2+B3 (2026-05-25).
 *
 * Legacy signin/signup → POST kredensial + profile metadata ke
 * /api/auth/bridge → server-side:
 *   B1: Supabase Auth sign-in/sign-up (auth.users)
 *   B2: Upsert profile row di public.profiles
 *
 * Legacy `saveState()` → debounced POST blob ke /api/state/sync:
 *   B3: Upsert blob ke public.user_state
 *
 * Same-origin (playly-dashboard.vercel.app) → cookie auto-set di browser
 * via @supabase/ssr.
 *
 * Silent fail kalau endpoint unreachable — legacy auth + state tetap
 * jalan (localStorage tetap source of truth selama transition B1-B4).
 *
 * NOTE: jangan hapus tanpa rencana — foundation Phase B4-B5 yang switch
 * primary read ke Supabase + cleanup legacy localStorage.
 */
(function () {
  "use strict";

  var ENDPOINT = "/api/auth/bridge";
  var STATE_ENDPOINT = "/api/state/sync";

  // Debounce window untuk state sync — saveState dipanggil 65+ tempat,
  // banyak rapid-fire (mis. saat scroll history). 1.5s window cukup buat
  // batch perubahan dalam satu interaksi tapi tetap "near-realtime" cross
  // device. Dipanggil ulang → reset timer.
  var STATE_DEBOUNCE_MS = 1500;
  var stateTimer = null;
  var lastStateSerialized = null;
  var lastStateAt = 0;
  var stateSyncCooldownUntil = 0;

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
    // Clear pending state push — sesi sudah ganti, blob lama jangan
    // bocor ke akun berikutnya.
    if (stateTimer) {
      clearTimeout(stateTimer);
      stateTimer = null;
    }
    lastStateSerialized = null;
    try {
      await fetch(ENDPOINT, {
        method: "DELETE",
        credentials: "same-origin",
      });
    } catch (err) {
      console.warn("[supabase-bridge] signout exception:", err);
    }
  }

  // syncState(state) — debounced upsert state blob ke Supabase.
  // Aman dipanggil di setiap saveState() — internal debounce yang
  // batch panggilan rapid-fire dalam window 1.5s. No-op kalau blob
  // identik dengan yang barusan ke-push (skip redundant network).
  function syncState(state) {
    if (!state || typeof state !== "object") return;
    if (Date.now() < stateSyncCooldownUntil) return;
    var serialized;
    try {
      serialized = JSON.stringify(state);
    } catch (err) {
      // Circular ref / non-serializable — skip.
      return;
    }
    // Skip kalau identik dengan push terakhir (no-op delta).
    if (serialized === lastStateSerialized) return;
    if (stateTimer) clearTimeout(stateTimer);
    stateTimer = setTimeout(function () {
      stateTimer = null;
      flushState(state, serialized);
    }, STATE_DEBOUNCE_MS);
  }

  async function flushState(state, serialized) {
    try {
      var resp = await fetch(STATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ state: state }),
      });
      var data;
      try {
        data = await resp.json();
      } catch (_) {
        data = null;
      }
      if (resp.ok && data && data.ok) {
        lastStateSerialized = serialized;
        lastStateAt = Date.now();
        return { synced: true, size: data.size || serialized.length };
      }
      var reason = (data && data.error) || "http_" + resp.status;
      // 401 (not_authenticated) → cookie belum di-set. Tidak fatal,
      // tapi cooldown 30s biar nggak spam request setiap saveState.
      if (resp.status === 401) {
        stateSyncCooldownUntil = Date.now() + 30000;
      }
      // 503 schema_missing → migration 0005 belum di-apply. Cooldown
      // 5 menit supaya nggak banjirin server log.
      if (resp.status === 503 && data && data.error === "schema_missing") {
        stateSyncCooldownUntil = Date.now() + 5 * 60 * 1000;
        console.warn("[supabase-bridge] user_state schema missing — run migration 0005");
      }
      // 413 (too_large) → state membengkak. Cooldown 5 menit + warn.
      if (resp.status === 413) {
        stateSyncCooldownUntil = Date.now() + 5 * 60 * 1000;
        console.warn("[supabase-bridge] state too large:", data);
      }
      console.warn("[supabase-bridge] state sync failed:", reason);
      return { synced: false, reason: reason };
    } catch (err) {
      console.warn("[supabase-bridge] state sync exception:", err);
      return { synced: false, reason: String(err) };
    }
  }

  // pullState() — ambil state milik user yang sedang login dari Supabase.
  // Belum dipakai di B3 (legacy masih baca localStorage). Foundation B4.
  async function pullState() {
    try {
      var resp = await fetch(STATE_ENDPOINT, {
        method: "GET",
        credentials: "same-origin",
      });
      var data;
      try {
        data = await resp.json();
      } catch (_) {
        data = null;
      }
      if (resp.ok && data && data.ok) {
        return { ok: true, state: data.state, updated_at: data.updated_at };
      }
      return { ok: false, reason: (data && data.error) || "http_" + resp.status };
    } catch (err) {
      return { ok: false, reason: String(err) };
    }
  }

  window.supabaseAuthBridge = {
    syncSignin: syncSignin,
    syncSignup: syncSignup,
    syncSignout: syncSignout,
    syncState: syncState,
    pullState: pullState,
  };
})();
