(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onVisible(el, cb, threshold) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { cb(e.isIntersecting); });
    }, { threshold: threshold || 0.15 }).observe(el);
  }

  function renderMath() {
    if (window.renderMathInElement) {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    }
  }

  // Teaser
  function initTeaser() {
    document.querySelectorAll('video.lazy-video').forEach(function (v) {
      onVisible(v, function (vis) {
        if (vis) {
          if (!v.src) { v.src = v.dataset.src; }
          var p = v.play(); if (p && p.catch) { p.catch(function () {}); }
        } else if (!v.paused) {
          v.pause();
        }
      });
    });
  }

  // Architecture
  function initArch() {
    var svg = document.getElementById('arch');
    if (!svg) { return; }
    var NS = 'http://www.w3.org/2000/svg';
    var pulses = document.getElementById('pulses');
    var mode = 'wm';

    var colorOf = { 'p-exec': 'amber', 'p-state': 'amber', 'p-sim': 'teal', 'p-next': 'gray' };
    var tail = [
      { paths: [], hot: ['n-cap'], dur: 900, clamp: true },
      { paths: ['p-exec'], hot: ['n-ctrl'], dur: 500 },
      { paths: ['p-sim'], hot: ['n-sim'], dur: 350 },
      { paths: ['p-next'], hot: ['n-prop', 'n-depth'], dur: 1300 }
    ];
    var steps = {
      wm: [
        { paths: ['p-depth', 'p-prop-wm'], hot: ['n-depth', 'n-prop'], dur: 800 },
        { paths: ['p-enc'], hot: ['n-enc'], dur: 400 },
        { paths: [], hot: ['n-wm'], dur: 900, rollout: true },
        { paths: ['p-wm-mppi'], hot: ['n-mppi'], dur: 350 },
        { paths: ['p-mppi-out', 'p-state'], hot: ['n-cap', 'n-ctrl'], dur: 900, newBox: true }
      ].concat(tail),
      ppo: [
        { paths: ['p-prop-ppo'], hot: ['n-prop'], dur: 700 },
        { paths: [], hot: ['n-ppo'], dur: 600 },
        { paths: ['p-ppo-out', 'p-state'], hot: ['n-cap', 'n-ctrl'], dur: 900, newBox: true }
      ].concat(tail)
    };

    var box = document.getElementById('mini-box');
    var prop = document.getElementById('mini-prop');
    var ex = document.getElementById('mini-exec');
    var link = document.getElementById('mini-link');
    var lat = [0, 1, 2].map(function (i) { return document.getElementById('lat' + i); });
    var B = { x: 652, y: 254, w: 92, h: 74 };
    var P = { x: 820, y: 268 };
    var E = { x: 744, y: 268 };
    var E0 = { x: 744, y: 268 };

    function setMini() {
      box.setAttribute('x', B.x); box.setAttribute('y', B.y);
      box.setAttribute('width', B.w); box.setAttribute('height', B.h);
      prop.setAttribute('cx', P.x); prop.setAttribute('cy', P.y);
      ex.setAttribute('x', E.x - 6); ex.setAttribute('y', E.y - 6);
      link.setAttribute('x1', P.x); link.setAttribute('y1', P.y);
      link.setAttribute('x2', E.x); link.setAttribute('y2', E.y);
    }
    function newBox() {
      B.x = 646 + Math.random() * 16; B.w = 80 + Math.random() * 18;
      B.y = 250 + Math.random() * 10; B.h = 64 + Math.random() * 14;
      P.x = 780 + Math.random() * 50; P.y = 236 + Math.random() * 96;
      E.x = P.x; E.y = P.y; E0 = { x: P.x, y: P.y };
      setMini();
    }
    function clampTarget() {
      return {
        x: Math.min(B.x + B.w, Math.max(B.x, P.x)),
        y: Math.min(B.y + B.h, Math.max(B.y, P.y))
      };
    }

    var circles = {};
    function pulseFor(id) {
      if (!circles[id]) {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', 5.5);
        c.setAttribute('class', 'pulse ' + (colorOf[id] || 'blue'));
        c.style.display = 'none';
        pulses.appendChild(c);
        circles[id] = c;
      }
      return circles[id];
    }
    function hideAll() { Object.keys(circles).forEach(function (k) { circles[k].style.display = 'none'; }); }
    function setHot(ids) {
      svg.querySelectorAll('.node.hot').forEach(function (n) { n.classList.remove('hot'); });
      ids.forEach(function (id) { var n = document.getElementById(id); if (n) { n.classList.add('hot'); } });
    }

    var idx = 0, t0 = null, running = false, raf = null;
    function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

    function frame(ts) {
      if (!running) { return; }
      var seq = steps[mode];
      var s = seq[idx];
      if (t0 === null) {
        t0 = ts; hideAll(); setHot(s.hot);
        if (s.newBox) { newBox(); }
      }
      var k = Math.min(1, (ts - t0) / s.dur);
      s.paths.forEach(function (id) {
        var p = document.getElementById(id);
        var len = p.getTotalLength();
        var pt = p.getPointAtLength(len * ease(k));
        var c = pulseFor(id);
        c.style.display = '';
        c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y);
      });
      if (s.rollout) {
        lat.forEach(function (l, i) { l.classList.toggle('on', k > i / 3 && k < (i + 1.4) / 3); });
      }
      if (s.clamp) {
        var tgt = clampTarget(), q = ease(Math.min(1, k * 1.4));
        E.x = E0.x + (tgt.x - E0.x) * q; E.y = E0.y + (tgt.y - E0.y) * q;
        setMini();
      }
      if (k >= 1) {
        lat.forEach(function (l) { l.classList.remove('on'); });
        idx = (idx + 1) % seq.length; t0 = null;
      }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!running && !reduceMotion) { running = true; t0 = null; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; if (raf) { cancelAnimationFrame(raf); } }

    document.querySelectorAll('.arch-toggle li').forEach(function (li) {
      li.addEventListener('click', function () {
        document.querySelectorAll('.arch-toggle li').forEach(function (o) { o.classList.remove('is-active'); });
        li.classList.add('is-active');
        mode = li.dataset.mode;
        svg.classList.remove('mode-wm', 'mode-ppo');
        svg.classList.add('mode-' + mode);
        idx = 0; t0 = null; hideAll();
      });
    });

    newBox(); var tg = clampTarget(); E.x = tg.x; E.y = tg.y; setMini();
    onVisible(svg, function (vis) { if (vis) { start(); } else { stop(); } });
  }

  // Theory
  function initTheory() {
    var cMap = document.getElementById('viz-map');
    if (!cMap) { return; }
    var cBox = document.getElementById('viz-box');
    var cForce = document.getElementById('viz-force');

    var COL = { ink: '#1f2430', muted: '#8a909a', grid: '#eceef1', red: '#c0584a', blue: '#3b76a6', amber: '#b8792a', purple: '#8a6fae', gray: '#9aa1ab' };
    var FMAX = 5, EPS = 0.5, KAPPA = Math.SQRT1_2;
    var FBAR = FMAX - EPS, BUD = KAPPA * FBAR;
    var M = [7, 6];
    var HIST = 8, trace = [];

    function dz(w, d) { return Math.sign(w) * Math.max(0, Math.abs(w) - d); }
    function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

    function state(t) {
      var c = [
        5.2 * Math.sin(0.55 * t) + 2.0 * Math.sin(1.37 * t + 0.4),
        4.6 * Math.sin(0.43 * t + 2.1) + 1.8 * Math.sin(1.11 * t + 1.3)
      ];
      var d = [1.2 + 0.6 * Math.sin(0.23 * t), 1.6 + 0.5 * Math.sin(0.31 * t + 1)];
      var a = [
        0.72 + 0.22 * Math.sin(0.9 * t) + 0.08 * Math.sin(3.1 * t),
        0.62 * Math.sin(0.47 * t + 0.5) + 0.22 * Math.sin(2.1 * t)
      ];
      var ax = [];
      for (var i = 0; i < 2; i++) {
        var force = [(-d[i] - BUD - c[i]) / M[i], (d[i] + BUD - c[i]) / M[i]];
        var vel = [-0.93 + 0.08 * Math.sin(0.37 * t + i), 0.82 + 0.12 * Math.sin(0.41 * t + 2 * i)];
        var clip = [(-11 - c[i]) / M[i], (11 - c[i]) / M[i]];
        var lo = Math.max(force[0], vel[0], clip[0], -1);
        var hi = Math.min(force[1], vel[1], clip[1], 1);
        var e = a[i];
        e = clamp(e, clip[0], clip[1]);
        e = clamp(e, vel[0], vel[1]);
        e = clamp(e, force[0], force[1]);
        e = clamp(e, -1, 1);
        ax.push({ c: c[i], d: d[i], m: M[i], a: a[i], e: e, force: force, vel: vel, clip: clip, lo: lo, hi: hi,
          wRaw: dz(c[i] + M[i] * a[i], d[i]), wExe: dz(c[i] + M[i] * e, d[i]) });
      }
      return {
        t: t, ax: ax,
        fRaw: Math.hypot(ax[0].wRaw, ax[1].wRaw),
        fExe: Math.hypot(ax[0].wExe, ax[1].wExe)
      };
    }

    function fit(cv) {
      var dpr = window.devicePixelRatio || 1;
      var w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      }
      var g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      return { g: g, w: w, h: h };
    }
    function font(g, size, it) { g.font = (it ? 'italic ' : '') + size + 'px "Noto Sans", sans-serif'; }
    function mfont(g, size) { g.font = 'italic ' + size + 'px Castoro, serif'; }

    function drawMap(S) {
      var o = fit(cMap), g = o.g, W = o.w, H = o.h, A = S.ax[0];
      var pad = { l: 58, r: 14, t: 18, b: 44 };
      var X = function (a) { return pad.l + (a + 1.3) / 2.6 * (W - pad.l - pad.r); };
      var Y = function (w) { return pad.t + (16 - w) / 32 * (H - pad.t - pad.b); };
      var band = A.d + BUD;

      g.fillStyle = 'rgba(192,88,74,0.10)';
      g.fillRect(X(-1.3), Y(band), X(1.3) - X(-1.3), Y(-band) - Y(band));
      g.fillStyle = 'rgba(154,161,171,0.18)';
      g.fillRect(X(-1.3), Y(A.d), X(1.3) - X(-1.3), Y(-A.d) - Y(A.d));
      g.setLineDash([5, 4]); g.strokeStyle = COL.red; g.lineWidth = 1.2;
      [band, -band].forEach(function (b) { g.beginPath(); g.moveTo(X(-1.3), Y(b)); g.lineTo(X(1.3), Y(b)); g.stroke(); });
      g.setLineDash([]);

      g.strokeStyle = COL.ink; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(X(-1.3), Y(0)); g.lineTo(X(1.3), Y(0)); g.stroke();
      g.beginPath(); g.moveTo(X(0), Y(16)); g.lineTo(X(0), Y(-16)); g.stroke();
      g.strokeStyle = COL.gray; g.setLineDash([2, 3]);
      [-1, 1].forEach(function (a) { g.beginPath(); g.moveTo(X(a), Y(16)); g.lineTo(X(a), Y(-16)); g.stroke(); });
      g.setLineDash([]);

      g.strokeStyle = COL.ink; g.lineWidth = 2;
      g.beginPath(); g.moveTo(X(-1.3), Y(A.c - 1.3 * A.m)); g.lineTo(X(1.3), Y(A.c + 1.3 * A.m)); g.stroke();
      var f0 = Math.max(A.force[0], -1.3), f1 = Math.min(A.force[1], 1.3);
      g.strokeStyle = COL.red; g.lineWidth = 4;
      g.beginPath(); g.moveTo(X(f0), Y(A.c + f0 * A.m)); g.lineTo(X(f1), Y(A.c + f1 * A.m)); g.stroke();

      var yb = H - pad.b + 18;
      g.strokeStyle = 'rgba(192,88,74,0.5)'; g.lineWidth = 1; g.setLineDash([2, 3]);
      [f0, f1].forEach(function (a) { g.beginPath(); g.moveTo(X(a), Y(A.c + a * A.m)); g.lineTo(X(a), yb); g.stroke(); });
      g.setLineDash([]);
      g.strokeStyle = COL.red; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(X(f0), yb); g.lineTo(X(f1), yb); g.stroke(); g.lineCap = 'butt';

      var ya = Y(clamp(A.c + A.a * A.m, -16, 16));
      g.fillStyle = '#fff'; g.strokeStyle = COL.blue; g.lineWidth = 2.2;
      g.beginPath(); g.arc(X(Math.min(A.a, 1.3)), ya, 5.5, 0, 7); g.fill(); g.stroke();
      g.fillStyle = COL.amber;
      g.fillRect(X(A.e) - 5, Y(A.c + A.e * A.m) - 5, 10, 10);

      g.fillStyle = COL.ink; mfont(g, 15);
      g.fillText('W₁', X(0) + 6, pad.t + 10);
      g.fillText('a₁', W - pad.r - 14, Y(0) - 6);
      g.fillStyle = COL.red; mfont(g, 13);
      g.fillText('±(d + b)', 2, Y(band) + 4);
      g.fillStyle = COL.red; mfont(g, 13);
      g.fillText('ℐ₁ᶠᵒʳᶜᵉ', X(f1) + 8, yb + 5);
    }

    var trail = [];
    function drawBox(S) {
      var o = fit(cBox), g = o.g, W = o.w, H = o.h;
      var s = Math.min(W - 70, H - 60);
      var ox = (W - s) / 2 + 12, oy = 14;
      var X = function (a) { return ox + (a + 1) / 2 * s; };
      var Y = function (a) { return oy + (1 - a) / 2 * s; };
      var A0 = S.ax[0], A1 = S.ax[1];

      g.strokeStyle = '#c9ced6'; g.lineWidth = 1.5;
      g.strokeRect(X(-1), Y(1), s, s);

      function bars(A, horiz) {
        var list = [[A.force, COL.red], [A.vel, COL.blue], [A.clip, COL.purple]];
        list.forEach(function (it, k) {
          var lo = clamp(it[0][0], -1, 1), hi = clamp(it[0][1], -1, 1);
          g.strokeStyle = it[1]; g.lineWidth = 3;
          g.beginPath();
          if (horiz) { var yy = Y(-1) + 10 + k * 7; g.moveTo(X(lo), yy); g.lineTo(X(hi), yy); }
          else { var xx = X(-1) - 10 - k * 7; g.moveTo(xx, Y(lo)); g.lineTo(xx, Y(hi)); }
          g.stroke();
        });
      }
      bars(A0, true); bars(A1, false);

      var ok = A0.lo <= A0.hi && A1.lo <= A1.hi;
      if (ok) {
        g.fillStyle = 'rgba(241,215,171,0.7)'; g.strokeStyle = COL.amber; g.lineWidth = 2;
        g.fillRect(X(A0.lo), Y(A1.hi), X(A0.hi) - X(A0.lo), Y(A1.lo) - Y(A1.hi));
        g.strokeRect(X(A0.lo), Y(A1.hi), X(A0.hi) - X(A0.lo), Y(A1.lo) - Y(A1.hi));
        g.fillStyle = '#8c5a17'; mfont(g, 14);
        g.fillText('𝒜(xₜ)', (X(A0.lo) + X(A0.hi)) / 2 - 16, (Y(A1.hi) + Y(A1.lo)) / 2 + 5);
      }

      trail.push([A0.a, A1.a]); if (trail.length > 40) { trail.shift(); }
      trail.forEach(function (p, i) {
        g.fillStyle = 'rgba(59,118,166,' + (0.02 + 0.25 * i / trail.length) + ')';
        g.beginPath(); g.arc(X(p[0]), Y(p[1]), 2.2, 0, 7); g.fill();
      });

      g.strokeStyle = COL.amber; g.lineWidth = 1.5; g.setLineDash([4, 3]);
      g.beginPath(); g.moveTo(X(A0.a), Y(A1.a)); g.lineTo(X(A0.e), Y(A1.e)); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#fff'; g.strokeStyle = COL.blue; g.lineWidth = 2.2;
      g.beginPath(); g.arc(X(A0.a), Y(A1.a), 5.5, 0, 7); g.fill(); g.stroke();
      g.fillStyle = COL.amber; g.fillRect(X(A0.e) - 5, Y(A1.e) - 5, 10, 10);

      g.fillStyle = COL.ink; mfont(g, 14);
      g.fillText('a₁', X(1) - 12, Y(-1) + 38);
      g.fillText('a₂', X(-1) - 40, Y(1) + 4);
      font(g, 11);
      var lx = X(1) + 6;
      g.fillStyle = COL.blue; g.fillText('proposed', Math.min(lx, W - 58), Y(1) + 10);
      g.fillStyle = COL.amber; g.fillText('executed', Math.min(lx, W - 58), Y(1) + 26);
    }

    function drawForce(S) {
      var o = fit(cForce), g = o.g, W = o.w, H = o.h;
      var pad = { l: 34, r: 10, t: 14, b: 26 };
      var X = function (t) { return pad.l + (1 - (S.t - t) / HIST) * (W - pad.l - pad.r); };
      var Y = function (f) { return pad.t + (1 - f / 14) * (H - pad.t - pad.b); };

      g.strokeStyle = COL.grid; g.lineWidth = 1; font(g, 10); g.fillStyle = COL.muted;
      [0, 5, 10].forEach(function (f) {
        g.beginPath(); g.moveTo(pad.l, Y(f)); g.lineTo(W - pad.r, Y(f)); g.stroke();
        g.fillText(f + ' N', 2, Y(f) + 3);
      });

      g.fillStyle = 'rgba(192,88,74,0.08)';
      g.fillRect(pad.l, Y(14), W - pad.l - pad.r, Y(FMAX) - Y(14));
      g.setLineDash([6, 4]); g.strokeStyle = COL.red; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(pad.l, Y(FMAX)); g.lineTo(W - pad.r, Y(FMAX)); g.stroke(); g.setLineDash([]);
      g.fillStyle = COL.red; mfont(g, 13); g.fillText('Fₘₐₓ', W - pad.r - 38, Y(FMAX) - 5);

      function line(key, col, w) {
        g.strokeStyle = col; g.lineWidth = w; g.beginPath();
        trace.forEach(function (p, i) {
          var x = X(p.t), y = Y(Math.min(p[key], 14));
          if (i === 0) { g.moveTo(x, y); } else { g.lineTo(x, y); }
        });
        g.stroke();
      }
      line('fRaw', '#9aa1ab', 1.6);
      line('fExe', COL.amber, 2.4);

      font(g, 11);
      g.fillStyle = '#6b7280'; g.fillText('raw proposal', pad.l + 6, pad.t + 12);
      g.fillStyle = COL.amber; g.fillText('with CAP', pad.l + 6, pad.t + 26);
      g.fillStyle = COL.muted; g.fillText('time', W - pad.r - 26, H - 6);
    }

    var t = 3, last = null, running = false, raf = null;
    for (var k = 0; k < 240; k++) { t += 1 / 30; trace.push(state(t)); }

    function tick(ts) {
      if (!running) { return; }
      var dt = last === null ? 1 / 60 : Math.min(0.05, (ts - last) / 1000);
      last = ts; t += dt;
      var S = state(t);
      trace.push(S);
      while (trace.length && trace[0].t < t - HIST) { trace.shift(); }
      drawMap(S); drawBox(S); drawForce(S);
      raf = requestAnimationFrame(tick);
    }
    function drawOnce() { var S = state(t); drawMap(S); drawBox(S); drawForce(S); }

    if (reduceMotion) { drawOnce(); window.addEventListener('resize', drawOnce); return; }
    onVisible(document.querySelector('.viz-grid'), function (vis) {
      if (vis && !running) { running = true; last = null; raf = requestAnimationFrame(tick); }
      if (!vis) { running = false; if (raf) { cancelAnimationFrame(raf); } }
    }, 0.05);
    drawOnce();
  }

  // Rollout videos
  function initVideos() {
    var pair = document.getElementById('vid-pair');
    if (!pair) { return; }
    var vb = document.getElementById('vid-base'), vo = document.getElementById('vid-ours');
    var sel = { task: 'peg', cap: '5', view: 'combined' };
    var visible = false, loaded = false;

    function path(method, ext) {
      return 'static/videos/' + sel.task + '/' + method + '_' + sel.cap + 'n_' + sel.view + '.' + ext;
    }
    function playBoth() {
      [vb, vo].forEach(function (v) { var p = v.play(); if (p && p.catch) { p.catch(function () {}); } });
    }
    function load() {
      pair.classList.toggle('is-square', sel.view === 'wrist');
      vb.poster = path('ppo_forge', 'jpg'); vo.poster = path('cap_wm', 'jpg');
      if (!visible && !loaded) { return; }
      vb.src = path('ppo_forge', 'mp4'); vo.src = path('cap_wm', 'mp4');
      loaded = true;
      if (visible) { playBoth(); }
    }
    function restart() {
      [vb, vo].forEach(function (v) { v.pause(); v.currentTime = 0; });
      playBoth();
    }
    vb.addEventListener('ended', restart);
    vo.addEventListener('ended', restart);

    document.querySelectorAll('.vid-controls .seg').forEach(function (seg) {
      seg.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          seg.querySelectorAll('button').forEach(function (o) { o.classList.remove('is-active'); });
          b.classList.add('is-active');
          sel[seg.dataset.key] = b.dataset.val;
          load();
        });
      });
    });

    onVisible(pair, function (vis) {
      visible = vis;
      if (vis) { if (!loaded) { load(); } else { playBoth(); } }
      else { vb.pause(); vo.pause(); }
    }, 0.25);
    load();
  }

  // Results
  var RESULTS = {
    methods: ['PPO (FORGE)', 'Safe RL', 'Safety layer', 'TD-MPC2 + depth', 'CAP-PPO', 'CAP-WM'],
    ours: [false, false, false, false, true, true],
    tasks: [
      { name: 'Peg insertion',
        5: [[97.7, 0.3], [42.7, 28.9], [90.2, 6.1], [99.1, 0.6], [78.0, 78.0], [98.1, 98.1]],
        10: [[97.7, 49.5], [71.4, 69.1], [91.9, 58.3], [99.1, 44.7], [90.5, 90.5], [98.0, 98.0]] },
      { name: 'Gear meshing',
        5: [[99.8, 0.0], [31.6, 16.2], [21.7, 2.2], [95.2, 0.0], [94.7, 94.7], [94.8, 94.8]],
        10: [[99.8, 11.6], [75.8, 58.3], [87.3, 52.7], [95.2, 11.6], [98.4, 98.4], [95.0, 95.0]] },
      { name: 'Nut threading',
        5: [[97.5, 0.0], [90.2, 0.0], [45.0, 1.1], [96.2, 0.0], [61.4, 61.4], [89.2, 89.2]],
        10: [[97.5, 18.6], [90.2, 64.8], [77.5, 72.0], [96.2, 17.7], [87.2, 87.2], [91.9, 91.9]] }
    ]
  };

  function initResults() {
    var grid = document.getElementById('res-grid');
    if (!grid) { return; }
    var cap = '5', shown = false;
    RESULTS.tasks.forEach(function (task) {
      var card = document.createElement('div');
      card.className = 'res-card';
      var h = document.createElement('h4'); h.textContent = task.name; card.appendChild(h);
      RESULTS.methods.forEach(function (m, i) {
        var row = document.createElement('div');
        row.className = 'res-row' + (RESULTS.ours[i] ? ' ours' : '');
        row.innerHTML = '<span class="name"></span><span class="track"><span class="sr"></span><span class="ssr"></span></span><span class="val"></span>';
        row.querySelector('.name').textContent = m;
        card.appendChild(row);
      });
      grid.appendChild(card);
    });
    function update() {
      grid.querySelectorAll('.res-card').forEach(function (card, ti) {
        var vals = RESULTS.tasks[ti][cap];
        card.querySelectorAll('.res-row').forEach(function (row, i) {
          var v = vals[i];
          row.querySelector('.sr').style.width = shown ? v[0] + '%' : '0';
          row.querySelector('.ssr').style.width = shown ? v[1] + '%' : '0';
          row.querySelector('.val').textContent = v[1].toFixed(1);
          row.title = 'Success ' + v[0].toFixed(1) + '%, safe success ' + v[1].toFixed(1) + '%';
        });
      });
    }
    document.querySelectorAll('#res-cap button').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#res-cap button').forEach(function (o) { o.classList.remove('is-active'); });
        b.classList.add('is-active'); cap = b.dataset.val; update();
      });
    });
    update();
    onVisible(grid, function (vis) { if (vis && !shown) { shown = true; update(); } }, 0.2);
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderMath();
    initTeaser();
    initArch();
    initTheory();
    initVideos();
    initResults();
  });
})();
