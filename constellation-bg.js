/* ============================================================
 *  constellation-bg.js — Admin dark backdrop constellation
 *  ------------------------------------------------------------
 *  Opsi 3 dari menu backdrop animation (req user 2026-05-20).
 *  ~40 dots slate drifting slow + thin lines connect nearby dots
 *  (jaring konstelasi). Bg color TIDAK berubah — canvas
 *  transparent, hanya stroke/fill yg di-paint.
 *
 *  Scope: admin role + dark theme only. Inisialisasi setelah
 *  body siap. Pause saat tab hidden (hemat resource).
 *  Reversible: hapus 1 <script> tag dari index.html = balik.
 * ============================================================ */
(function () {
  "use strict";
  if (window.__constellationBgInit) return;
  window.__constellationBgInit = true;

  var CFG = {
    nodeCount: 42,
    maxConnectDist: 150,      // px — jarak max utk gambar garis penghubung
    nodeColor: "rgba(165, 175, 195, .55)",  // slate semi-terang utk dots
    lineColor: "165, 175, 195",              // slate (rgba dibangun per-line dgn alpha dinamis)
    lineMaxAlpha: 0.18,       // garis paling pekat saat dots paling dekat
    nodeMinRadius: 0.8,
    nodeMaxRadius: 1.8,
    speedRange: 0.12,         // ±px/frame — slow drift
    lineWidth: 0.6,
  };

  var canvas = null, ctx = null, raf = 0;
  var w = 0, h = 0, dpr = 1;
  var nodes = [];

  function isAdminDark() {
    var b = document.body;
    return b && b.getAttribute("data-role") === "admin"
             && b.getAttribute("data-theme") === "dark";
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn() {
    nodes.length = 0;
    var N = CFG.nodeCount;
    for (var i = 0; i < N; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * CFG.speedRange * 2,
        vy: (Math.random() - 0.5) * CFG.speedRange * 2,
        r: CFG.nodeMinRadius + Math.random() * (CFG.nodeMaxRadius - CFG.nodeMinRadius),
      });
    }
  }

  function step() {
    var N = nodes.length;
    // Move nodes (wrap around edges → tidak ada bounce kasar).
    for (var i = 0; i < N; i++) {
      var n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -20) n.x = w + 20;
      else if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20;
      else if (n.y > h + 20) n.y = -20;
    }

    ctx.clearRect(0, 0, w, h);

    // Lines first (paint di bawah dots) — O(N^2) tapi N=42 jadi <1000 pair, ringan.
    ctx.lineWidth = CFG.lineWidth;
    var maxD = CFG.maxConnectDist;
    var maxA = CFG.lineMaxAlpha;
    var lc = CFG.lineColor;
    for (var a = 0; a < N; a++) {
      for (var b = a + 1; b < N; b++) {
        var dx = nodes[a].x - nodes[b].x;
        var dy = nodes[a].y - nodes[b].y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < maxD) {
          var alpha = (1 - d / maxD) * maxA;
          ctx.strokeStyle = "rgba(" + lc + "," + alpha.toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(nodes[a].x, nodes[a].y);
          ctx.lineTo(nodes[b].x, nodes[b].y);
          ctx.stroke();
        }
      }
    }

    // Dots
    ctx.fillStyle = CFG.nodeColor;
    for (var k = 0; k < N; k++) {
      var nn = nodes[k];
      ctx.beginPath();
      ctx.arc(nn.x, nn.y, nn.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop() {
    step();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (!raf) loop();
  }

  function stop() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function mount() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "admin-constellation-bg";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;" +
      "pointer-events:none;z-index:-1;";
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext("2d", { alpha: true });
    resize();
    spawn();
  }

  function unmount() {
    stop();
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    ctx = null;
  }

  function syncRoleTheme() {
    if (isAdminDark()) {
      if (!canvas) { mount(); start(); }
    } else {
      if (canvas) unmount();
    }
  }

  function init() {
    syncRoleTheme();

    window.addEventListener("resize", function () {
      if (canvas) { resize(); spawn(); }
    });

    document.addEventListener("visibilitychange", function () {
      if (!canvas) return;
      if (document.hidden) stop(); else start();
    });

    // Observe role/theme changes (user mungkin switch theme atau role).
    var mo = new MutationObserver(syncRoleTheme);
    mo.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-role", "data-theme"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
