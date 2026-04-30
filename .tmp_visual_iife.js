

/* ============================================================
   ADMIN VISUAL UPGRADES — RENDERERS
     • renderKpiSparkline(svgEl, series) → mini smooth line+area chart
     • renderAvatarStack(stackEl, items) → stack avatar bulat overlap
     • Trend series 7 hari (cumulative) untuk users / videos / views
     • rerenderAll() di-hook ke MutationObserver(adminLiveActivity) +
       storage events + cloud-applied event
   ============================================================ */
(function adminVisualUpgrades() {
  if (typeof window === "undefined") return;

  function renderKpiSparkline(svgEl, series) {
    if (!svgEl || !Array.isArray(series) || series.length < 2) return;
    const W = 120, H = 36, pad = 3;
    const max = Math.max(1, ...series);
    const min = Math.min(0, ...series);
    const range = Math.max(1, max - min);
    const stepX = (W - pad * 2) / (series.length - 1);
    const points = series.map((v, i) => {
      const x = pad + stepX * i;
      const y = H - pad - ((v - min) / range) * (H - pad * 2);
      return [x, y];
    });
    let line = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const cx = (x0 + x1) / 2;
      line += ` C ${cx.toFixed(2)} ${y0.toFixed(2)}, ${cx.toFixed(2)} ${y1.toFixed(2)}, ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    }
    const fill = line + ` L ${points[points.length - 1][0].toFixed(2)} ${H - pad} L ${points[0][0].toFixed(2)} ${H - pad} Z`;
    const [lastX, lastY] = points[points.length - 1];
    svgEl.innerHTML = `
      <path class="spark-fill" d="${fill}"/>
      <path class="spark-line" d="${line}"/>
      <circle class="spark-dot" cx="${lastX.toFixed(2)}" cy="${lastY.toFixed(2)}" r="3"/>
    `;
    const lineEl = svgEl.querySelector(".spark-line");
    if (lineEl) {
      lineEl.style.animation = "none";
      void lineEl.getBoundingClientRect();
      lineEl.style.animation = "";
    }
  }

  function userSeries7d(accounts) {
    const today = new Date(); today.setHours(0,0,0,0);
    const start = today.getTime() - 6 * 86400000;
    let cumulative = 0;
    const daily = new Array(7).fill(0);
    (accounts || []).forEach(a => {
      const t = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
      if (t < start) cumulative++;
      else { const idx = Math.min(6, Math.floor((t - start) / 86400000)); if (idx >= 0) daily[idx]++; }
    });
    const buckets = new Array(7).fill(0);
    let acc = cumulative;
    for (let i = 0; i < 7; i++) { acc += daily[i]; buckets[i] = acc; }
    return buckets;
  }
  function videoSeries7d(videos) {
    const today = new Date(); today.setHours(0,0,0,0);
    const start = today.getTime() - 6 * 86400000;
    let cumulative = 0;
    const daily = new Array(7).fill(0);
    (videos || []).forEach(v => {
      const t = typeof v.id === "number" ? v.id : 0;
      if (t < start) cumulative++;
      else { const idx = Math.min(6, Math.floor((t - start) / 86400000)); if (idx >= 0) daily[idx]++; }
    });
    const buckets = new Array(7).fill(0);
    let acc = cumulative;
    for (let i = 0; i < 7; i++) { acc += daily[i]; buckets[i] = acc; }
    return buckets;
  }
  function viewsSeries7d(videos) {
    const today = new Date(); today.setHours(0,0,0,0);
    const start = today.getTime() - 6 * 86400000;
    let cumulative = 0;
    const daily = new Array(7).fill(0);
    (videos || []).forEach(v => {
      const t = typeof v.id === "number" ? v.id : 0;
      const views = v.viewsNum || 0;
      if (t < start) cumulative += views;
      else { const idx = Math.min(6, Math.floor((t - start) / 86400000)); if (idx >= 0) daily[idx] += views; }
    });
    const buckets = new Array(7).fill(0);
    let acc = cumulative;
    for (let i = 0; i < 7; i++) { acc += daily[i]; buckets[i] = acc; }
    return buckets;
  }

  function escAttr(s) { return String(s ?? "").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  function escHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

  function renderAvatarStack(stackEl, items, totalCount, opts) {
    if (!stackEl) return;
    opts = opts || {};
    const max = opts.max || 5;
    const visible = (items || []).slice(0, max);
    const more = Math.max(0, (totalCount || (items || []).length) - visible.length);
    const html = visible.map(item => {
      const init = (item.name || item.username || item.title || "?").trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
      const av = item.avatar || item.thumbnail;
      return `<span class="av" title="${escAttr(item.name || item.username || item.title || "")}">${av ? `<img src="${escAttr(av)}" alt=""/>` : `<span>${escHtml(init)}</span>`}</span>`;
    }).join("");
    const moreHtml = more > 0 ? `<span class="av av-more" title="${more} lainnya">+${more}</span>` : "";
    stackEl.innerHTML = html + moreHtml;
  }

  function rerenderAll() {
    if (document.body && document.body.dataset && document.body.dataset.role !== "admin") return;
    let m = null;
    try { m = typeof getAdminMetrics === "function" ? getAdminMetrics() : null; } catch (e) {}
    if (!m) return;
    const accounts = (m.accounts || []).filter(a => a.role !== "admin");
    const videos = (m.videos || []).filter(v => v.creator);

    const usersSpark = document.getElementById("kpiUsersSpark");
    const videosSpark = document.getElementById("kpiVideosSpark");
    const viewsSpark = document.getElementById("kpiViewsSpark");
    if (usersSpark)  renderKpiSparkline(usersSpark,  userSeries7d(accounts));
    if (videosSpark) renderKpiSparkline(videosSpark, videoSeries7d(videos));
    if (viewsSpark)  renderKpiSparkline(viewsSpark,  viewsSeries7d(videos));

    const recentVidsStack = document.getElementById("adminRecentVideosStack");
    const recentUsersStack = document.getElementById("adminRecentUsersStack");
    const topCreatorsStack = document.getElementById("adminTopCreatorsStack");
    if (recentVidsStack) {
      const recent = videos.slice().sort((a,b) => (b.id||0)-(a.id||0)).slice(0, 5);
      renderAvatarStack(recentVidsStack, recent, videos.length);
    }
    if (recentUsersStack) {
      const recent = accounts.slice().sort((a,b) => (new Date(b.joinedAt||0))-(new Date(a.joinedAt||0))).slice(0, 5);
      renderAvatarStack(recentUsersStack, recent, accounts.length);
    }
    if (topCreatorsStack) {
      const map = {};
      videos.forEach(v => {
        if (!v.creator) return;
        map[v.creator] = map[v.creator] || { username: v.creator, name: v.creator, videos: 0, views: 0 };
        map[v.creator].videos++;
        map[v.creator].views += v.viewsNum || 0;
      });
      const list = Object.values(map).sort((a,b) => b.views - a.views);
      const accMap = {};
      accounts.forEach(a => { accMap[a.username] = a; });
      list.forEach(c => { if (accMap[c.username] && accMap[c.username].avatar) c.avatar = accMap[c.username].avatar; });
      renderAvatarStack(topCreatorsStack, list.slice(0, 5), list.length);
    }
  }

  function boot() {
    rerenderAll();
    setTimeout(rerenderAll, 250);
    setTimeout(rerenderAll, 1000);
  }
  if (document.readyState === "complete" || document.readyState === "interactive") {
    boot();
  } else {
    document.addEventListener("DOMContentLoaded", boot);
  }

  const liveEl = document.getElementById("adminLiveActivity");
  if (liveEl) {
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; rerenderAll(); });
    }).observe(liveEl, { childList: true });
  }

  window.addEventListener("storage", e => {
    if (!e.key) return;
    if (e.key.startsWith("playly-account-") || e.key.startsWith("playly-state-")) {
      setTimeout(rerenderAll, 200);
    }
  });
  window.addEventListener("playly:cloud-applied", () => setTimeout(rerenderAll, 200));

  window.__adminVisualRerender = rerenderAll;
})();
