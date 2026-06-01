console.log("[playly] script.js loaded:", typeof window.openAuthModal === "function" ? "✓ OK" : "✗ FAIL");

    /* Defensive: pastikan komponen yang depend pada user/stats di-render
       setelah bootDashboard selesai. Function-function ini di-call dari
       bootDashboard tapi kadang race condition bikin tidak fire (innerHTML
       stay empty, hidden attr tetap). Trigger ulang via deferred timeouts
       + listen cloud event. Komponen: tier pill (Premium/Gratis), level
       kreator (XP/progres), ranking kreator. */
    (function ensureHomeRendered() {
      const fns = [
        "renderDashboardTierPill",
        "renderHomeCreatorLevel",
        "renderHomeRanking",
        "renderHomeRankingSelf",
        "renderHomeAchievements",
      ];
      const tryRender = () => {
        for (const name of fns) {
          try {
            if (typeof window[name] === "function") window[name]();
            else if (typeof eval(name + ".name") === "string") {} // fallback no-op
          } catch {}
        }
      };
      const safeRender = () => {
        for (const name of fns) {
          try {
            // Use Function constructor to safely test/call without throwing if undefined
            const fn = new Function("return typeof " + name + " === 'function' ? " + name + " : null;")();
            if (fn) fn();
          } catch {}
        }
      };
      // Initial: 100ms, 500ms, 1500ms — catch all timing windows
      setTimeout(safeRender, 100);
      setTimeout(safeRender, 500);
      setTimeout(safeRender, 1500);
      // Re-render on cloud sync (user data may update from server)
      window.addEventListener("playly:cloud-applied", safeRender);
    })();