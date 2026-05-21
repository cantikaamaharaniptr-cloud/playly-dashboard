/* Playly Supabase Auth Bridge — Phase 7b (2026-05-21).
 * Legacy signin/signup → ALSO sync ke Supabase Auth supaya:
 *   - User bisa akses Next.js /dashboard (auth-gated via Supabase cookie)
 *   - Account ke-mirror di cloud (cross-device, beyond localStorage)
 *
 * Dipanggil dari script.js setelah legacy auth flow success. Silent
 * fail kalau Supabase CDN / config missing — legacy tetep jalan.
 *
 * EMAIL CONFIRMATION NOTE: Supabase project default mengirim email
 * konfirmasi saat signUp. User TIDAK akan langsung login ke /dashboard
 * sampai mereka klik link di email. Untuk skip langkah ini:
 *   Supabase Dashboard → Authentication → Providers → Email →
 *   "Confirm email" → OFF
 * Setelah disable, signup langsung dapat session + /dashboard accessible.
 */
(function () {
  "use strict";

  function getClient() {
    const cfg = window.PLAYLY_SUPABASE;
    if (!cfg || !cfg.url || !cfg.key) return null;
    if (!window.supabase || !window.supabase.createClient) return null;
    // Reuse single client per page-load. Persist session ke localStorage
    // supaya saat user navigate ke /dashboard, cookie sudah ter-set.
    if (!window.__playlySupabaseAuthClient) {
      window.__playlySupabaseAuthClient = window.supabase.createClient(
        cfg.url,
        cfg.key,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        }
      );
    }
    return window.__playlySupabaseAuthClient;
  }

  // Sync existing-account signin. Akun di Supabase mungkin sudah ada
  // (kalau user pernah login sebelumnya post-patch) atau belum. Strategy:
  //   1. Try signInWithPassword
  //   2. Kalau "Invalid login credentials", akun belum ada → signUp + signin lagi
  //   3. Kalau "Email not confirmed", log warning (user perlu disable email
  //      confirm di Supabase Dashboard)
  async function syncSignin(email, password, profile) {
    const sb = getClient();
    if (!sb) {
      console.log("[supabase-bridge] Supabase client unavailable; skip sync");
      return { synced: false, reason: "no_client" };
    }
    try {
      const { error: signinErr } = await sb.auth.signInWithPassword({
        email,
        password,
      });
      if (!signinErr) {
        console.log("[supabase-bridge] ✓ signin synced to Supabase");
        return { synced: true };
      }
      // Account belum ada di Supabase → buat
      console.log("[supabase-bridge] signin failed, trying signup:", signinErr.message);
      const { error: signupErr } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: cleanProfileData(profile),
        },
      });
      if (signupErr) {
        console.warn("[supabase-bridge] signup also failed:", signupErr.message);
        return { synced: false, reason: signupErr.message };
      }
      // Try signin lagi (works kalau email confirmation disabled)
      const { error: retry } = await sb.auth.signInWithPassword({
        email,
        password,
      });
      if (retry) {
        if (/confirm/i.test(retry.message)) {
          console.warn(
            "[supabase-bridge] account created tapi butuh email confirm. " +
              "Disable di Supabase Dashboard → Auth → Providers → Email → Confirm email = OFF."
          );
          return { synced: false, reason: "needs_email_confirm" };
        }
        console.warn("[supabase-bridge] retry signin failed:", retry.message);
        return { synced: false, reason: retry.message };
      }
      console.log("[supabase-bridge] ✓ account created + signed in to Supabase");
      return { synced: true };
    } catch (err) {
      console.warn("[supabase-bridge] sync exception:", err);
      return { synced: false, reason: String(err) };
    }
  }

  // Sync signup. User baru daftar legacy → also create Supabase account.
  async function syncSignup(email, password, profile) {
    const sb = getClient();
    if (!sb) return { synced: false, reason: "no_client" };
    try {
      const { error: signupErr } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: cleanProfileData(profile),
        },
      });
      if (signupErr) {
        // "User already registered" — bukan error fatal, mungkin user signup
        // legacy ulang. Try signin instead.
        if (/already/i.test(signupErr.message)) {
          const { error: signinErr } = await sb.auth.signInWithPassword({
            email,
            password,
          });
          if (!signinErr) return { synced: true };
          return { synced: false, reason: signinErr.message };
        }
        console.warn("[supabase-bridge] signup failed:", signupErr.message);
        return { synced: false, reason: signupErr.message };
      }
      // Try signin to get session set (kalau email confirm disabled)
      const { error: signinErr } = await sb.auth.signInWithPassword({
        email,
        password,
      });
      if (signinErr && /confirm/i.test(signinErr.message)) {
        console.warn(
          "[supabase-bridge] account created tapi butuh email confirm. " +
            "Disable di Supabase Dashboard."
        );
        return { synced: false, reason: "needs_email_confirm" };
      }
      console.log("[supabase-bridge] ✓ signup synced to Supabase");
      return { synced: true };
    } catch (err) {
      console.warn("[supabase-bridge] signup sync exception:", err);
      return { synced: false, reason: String(err) };
    }
  }

  // Sign out dari Supabase (called saat legacy logout).
  async function syncSignout() {
    const sb = getClient();
    if (!sb) return;
    try {
      await sb.auth.signOut();
    } catch (err) {
      console.warn("[supabase-bridge] signout exception:", err);
    }
  }

  // Strip fields yang sensitif/large dari profile object sebelum ke
  // user_metadata. Hanya kirim yang berguna untuk dashboard rendering.
  function cleanProfileData(profile) {
    if (!profile || typeof profile !== "object") return {};
    const out = {};
    ["name", "username", "role", "tier"].forEach((k) => {
      if (typeof profile[k] === "string" || typeof profile[k] === "boolean") {
        out[k] = profile[k];
      }
    });
    return out;
  }

  window.supabaseAuthBridge = {
    syncSignin,
    syncSignup,
    syncSignout,
  };
})();
