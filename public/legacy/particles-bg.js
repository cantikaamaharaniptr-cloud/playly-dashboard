/* ============================================================
 *  particles-bg.js — Backdrop partikel WebGL untuk DASHBOARD USER
 *  ------------------------------------------------------------
 *  Port setia komponen <Particles> (reactbits / OGL) ke vanilla
 *  WebGL TANPA dependency (app ini vanilla monolith, no React/build,
 *  & offline — tak bisa load OGL dari CDN). Shader vertex/fragment
 *  identik dgn reactbits. Param sesuai request user 2026-05-16 (revisi 2):
 *    particleCount=620, particleSpread=40, speed=0.1,
 *    particleColors=#ffffff x3, moveParticlesOnHover=false,
 *    particleHoverFactor=0.2, alphaParticles=false,
 *    particleBaseSize=40, sizeRandomness=1.5, cameraDistance=10,
 *    disableRotation=false.
 *  - Self-contained, reversible (hapus 1 <script> = balik).
 *  - Mount di slot backdrop ".dreams-fx" (di dlm .views), backdrop
 *    lama disembunyikan. Hanya tampil di dashboard USER (bukan
 *    admin / landing / auth). Pause saat tab hidden / di luar
 *    dashboard (hemat).
 * ============================================================ */
(function () {
  "use strict";
  if (window.__particlesBgInit) return;
  window.__particlesBgInit = true;

  var CFG = {
    count: 620,
    spread: 40,
    speed: 0.1,
    colors: ["#ffffff", "#ffffff", "#ffffff"],
    alpha: false,
    baseSize: 40,
    sizeRandomness: 1.5,
    cameraDistance: 10,
    rotate: true
  };

  /* ---------- mat4 minimal (column-major, sama spt WebGL) ---------- */
  function mIdent() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
  function mMul(a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function mTranslate(x, y, z) { var m = mIdent(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function mRotX(a) { var c = Math.cos(a), s = Math.sin(a); var m = mIdent(); m[5]=c; m[6]=s; m[9]=-s; m[10]=c; return m; }
  function mRotY(a) { var c = Math.cos(a), s = Math.sin(a); var m = mIdent(); m[0]=c; m[2]=-s; m[8]=s; m[10]=c; return m; }
  function mRotZ(a) { var c = Math.cos(a), s = Math.sin(a); var m = mIdent(); m[0]=c; m[1]=s; m[4]=-s; m[5]=c; return m; }
  function mPerspective(fovDeg, aspect, near, far) {
    var f = 1 / Math.tan((fovDeg * Math.PI / 180) / 2);
    var nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, (2 * far * near) * nf, 0
    ];
  }

  function hexToRgb(hex) {
    hex = (hex || "#ffffff").replace("#", "");
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var n = parseInt(hex, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  /* ---------- Shaders (identik reactbits / OGL Particles) ---------- */
  var VERT =
    "attribute vec3 position;attribute vec4 random;attribute vec3 color;" +
    "uniform mat4 modelMatrix;uniform mat4 viewMatrix;uniform mat4 projectionMatrix;" +
    "uniform float uTime;uniform float uSpread;uniform float uBaseSize;uniform float uSizeRandomness;" +
    "varying vec4 vRandom;varying vec3 vColor;" +
    "void main(){vRandom=random;vColor=color;" +
    "vec3 pos=position*uSpread;pos.z*=10.0;" +
    "vec4 mPos=modelMatrix*vec4(pos,1.0);float t=uTime;" +
    "mPos.x+=sin(t*random.z+6.28*random.w)*mix(0.1,1.5,random.x);" +
    "mPos.y+=sin(t*random.y+6.28*random.x)*mix(0.1,1.5,random.w);" +
    "mPos.z+=sin(t*random.w+6.28*random.y)*mix(0.1,1.5,random.z);" +
    "vec4 mvPos=viewMatrix*mPos;" +
    "gl_PointSize=(uBaseSize*(1.0+uSizeRandomness*(random.x-0.5)))/length(mvPos.xyz);" +
    "gl_Position=projectionMatrix*mvPos;}";
  var FRAG =
    "precision highp float;" +
    "uniform float uTime;uniform float uAlphaParticles;" +
    "varying vec4 vRandom;varying vec3 vColor;" +
    "void main(){vec2 uv=gl_PointCoord.xy;float d=length(uv-vec2(0.5));" +
    "if(uAlphaParticles<0.5){if(d>0.5){discard;}" +
    "gl_FragColor=vec4(vColor+0.2*sin(uv.yxx+uTime+vRandom.y*6.28),1.0);}" +
    "else{float circle=smoothstep(0.5,0.4,d)*0.8;" +
    "gl_FragColor=vec4(vColor+0.2*sin(uv.yxx+uTime+vRandom.y*6.28),circle);}}";

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      if (window.console) console.warn("[particles-bg] shader", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  /* ---------- State ---------- */
  var canvas, gl, prog, locs = {}, buffers = {}, raf = 0;
  var lastT = 0, elapsed = 0, rotZ = 0, running = false, mounted = false;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function buildGL() {
    canvas = document.createElement("canvas");
    canvas.className = "particles-bg-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;" +
      "display:block;pointer-events:none;z-index:0;";
    gl = canvas.getContext("webgl", { alpha: true, antialias: true, depth: false, premultipliedAlpha: false }) ||
         canvas.getContext("experimental-webgl", { alpha: true, depth: false });
    if (!gl) return false;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (window.console) console.warn("[particles-bg] link", gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);

    locs.position = gl.getAttribLocation(prog, "position");
    locs.random = gl.getAttribLocation(prog, "random");
    locs.color = gl.getAttribLocation(prog, "color");
    locs.uTime = gl.getUniformLocation(prog, "uTime");
    locs.uSpread = gl.getUniformLocation(prog, "uSpread");
    locs.uBaseSize = gl.getUniformLocation(prog, "uBaseSize");
    locs.uSizeRandomness = gl.getUniformLocation(prog, "uSizeRandomness");
    locs.uAlphaParticles = gl.getUniformLocation(prog, "uAlphaParticles");
    locs.modelMatrix = gl.getUniformLocation(prog, "modelMatrix");
    locs.viewMatrix = gl.getUniformLocation(prog, "viewMatrix");
    locs.projectionMatrix = gl.getUniformLocation(prog, "projectionMatrix");

    // Geometry (sphere distribution, identik reactbits)
    var n = CFG.count;
    var positions = new Float32Array(n * 3);
    var randoms = new Float32Array(n * 4);
    var colors = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var x, y, z, len;
      do {
        x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1;
        len = x * x + y * y + z * z;
      } while (len > 1 || len === 0);
      var rr = Math.cbrt(Math.random());
      positions[i*3] = x*rr; positions[i*3+1] = y*rr; positions[i*3+2] = z*rr;
      randoms[i*4] = Math.random(); randoms[i*4+1] = Math.random();
      randoms[i*4+2] = Math.random(); randoms[i*4+3] = Math.random();
      var col = hexToRgb(CFG.colors[Math.floor(Math.random() * CFG.colors.length)]);
      colors[i*3] = col[0]; colors[i*3+1] = col[1]; colors[i*3+2] = col[2];
    }
    function buf(data) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; }
    buffers.position = buf(positions);
    buffers.random = buf(randoms);
    buffers.color = buf(colors);

    gl.uniform1f(locs.uSpread, CFG.spread);
    gl.uniform1f(locs.uBaseSize, CFG.baseSize);
    gl.uniform1f(locs.uSizeRandomness, CFG.sizeRandomness);
    gl.uniform1f(locs.uAlphaParticles, CFG.alpha ? 1 : 0);

    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }

  function resize() {
    if (!canvas || !gl) return;
    var w = canvas.clientWidth || canvas.parentElement && canvas.parentElement.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || canvas.parentElement && canvas.parentElement.clientHeight || window.innerHeight;
    var bw = Math.max(1, Math.round(w * DPR)), bh = Math.max(1, Math.round(h * DPR));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw; canvas.height = bh;
      gl.viewport(0, 0, bw, bh);
    }
    gl.useProgram(prog);
    gl.uniformMatrix4fv(locs.projectionMatrix, false,
      mPerspective(15, w / Math.max(1, h), 0.1, 100));
    gl.uniformMatrix4fv(locs.viewMatrix, false,
      mTranslate(0, 0, -CFG.cameraDistance));
  }

  function frame(t) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (!lastT) lastT = t;
    var d = t - lastT; lastT = t;
    elapsed += d * CFG.speed;
    var model = mIdent();
    if (CFG.rotate) {
      rotZ += 0.01 * CFG.speed;
      var rx = mRotX(Math.sin(elapsed * 0.0002) * 0.1);
      var ry = mRotY(Math.cos(elapsed * 0.0005) * 0.15);
      var rz = mRotZ(rotZ);
      model = mMul(mMul(rz, ry), rx);
    }
    gl.useProgram(prog);
    gl.uniform1f(locs.uTime, elapsed * 0.001);
    gl.uniformMatrix4fv(locs.modelMatrix, false, model);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.enableVertexAttribArray(locs.position);
    gl.vertexAttribPointer(locs.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.random);
    gl.enableVertexAttribArray(locs.random);
    gl.vertexAttribPointer(locs.random, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.enableVertexAttribArray(locs.color);
    gl.vertexAttribPointer(locs.color, 3, gl.FLOAT, false, 0, 0);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, CFG.count);
  }

  function start() {
    if (running) return;
    running = true; lastT = 0;
    resize();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf), raf = 0;
  }

  /* ---------- Scope: hanya dashboard USER ---------- */
  function activeViewName() {
    var v = document.querySelector(".view.active") ||
            document.querySelector("[data-view].active");
    return v ? (v.getAttribute("data-view") || "") : "";
  }
  function landingShown() {
    var l = document.querySelector(".landing,.lp-hero,[class*='landing-hero'],.auth-screen,[data-auth-screen]");
    return !!(l && l.offsetParent);
  }
  function shouldShow() {
    var host = document.querySelector(".views");
    if (!host) return false;
    if (landingShown()) return false;
    var v = activeViewName();
    if (!v) return false;
    if (/^admin/i.test(v)) return false;          // bukan dashboard admin
    if (/^(login|signin|signup|auth|landing)/i.test(v)) return false;
    return true;
  }

  var oldDreams = null;
  function mount() {
    var host = document.querySelector(".views");
    if (!host || mounted) return;
    if (!buildGL()) { stop(); return; }   // no WebGL → biarkan bg apa adanya
    // Sembunyikan backdrop lama (.dreams-fx) — diganti partikel.
    oldDreams = document.getElementById("dreamsFx") || host.querySelector(".dreams-fx");
    if (oldDreams) oldDreams.style.display = "none";
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.insertBefore(canvas, host.firstChild);
    mounted = true;
    try {
      var ro = new ResizeObserver(function () { if (running) resize(); });
      ro.observe(host);
    } catch (e) {
      window.addEventListener("resize", function () { if (running) resize(); });
    }
  }

  function sync() {
    if (!mounted) {
      if (shouldShow()) { mount(); if (mounted) { canvas.style.display = "block"; start(); } }
      return;
    }
    if (shouldShow() && !document.hidden) {
      canvas.style.display = "block";
      start();
    } else {
      stop();
      canvas.style.display = "none";
    }
  }

  function boot() {
    sync();
    window.addEventListener("playly:view-changed", sync);
    window.addEventListener("playly:cloud-applied", sync);
    document.addEventListener("visibilitychange", sync);
    // Re-cek berkala (login/logout/route bisa tanpa event di atas).
    setInterval(sync, 1200);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 60); }, { once: true });
  else setTimeout(boot, 60);

  // API kecil utk debug / matikan manual.
  window.particlesBg = {
    start: start, stop: stop,
    restore: function () {
      stop();
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (oldDreams) oldDreams.style.display = "";
      mounted = false;
    }
  };
})();
