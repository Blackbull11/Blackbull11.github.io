/* ============================================================
   WPT 01 · Purpose figure — a live spiking network on a chart
   of the brain.

   The brain is charted as an island: coastline, shallow-water
   bands and isobaths around it, sulci for relief, a north arrow
   and a scale bar. About seventy neurons are scattered over the
   cerebrum and wired to their nearest neighbours, plus a few
   long-range fibres.

   They run a nonlinear Hawkes process: every spike that reaches
   a neuron (after travelling the fibre) adds a jump to its
   excitation e_i, which decays over TAU_E, and the neuron fires
   at intensity  lambda_i = MU + GAIN * (e_i - theta_i)+ . The
   threshold means one spike rarely fires a neighbour but a few
   arriving together do, so activity travels as a front. On top
   of that, short-term synaptic depression: every spike uses a
   share U of the neuron's synaptic resources R_i (which scale
   the jumps it sends), and they recover over TAU_REC. Fresh
   synapses carry a wave across the island; spent ones cannot,
   so it dies out; recovery sets up the next one. That is the
   slow collective rhythm read off underneath: a spike raster
   (neurons sorted front to back, so a travelling wave shows as
   a slanted band) and the population rate nu(t).

   No libraries. Paused off-screen and in background tabs.
   Reduced motion: one still frame, still clickable.
   ============================================================ */
(function () {
  'use strict';
  var fig = document.getElementById('neuroFig');
  var cv = document.getElementById('neuroCanvas');
  if (!fig || !cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var rateEl = document.getElementById('neuroRate');
  var kick = document.getElementById('neuroKick');
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var INK = '#0C2233', OCEAN = '#1F6E8C', FADED = '#52707D';
  var MONO = '"Space Mono", ui-monospace, monospace';
  var SERIF = '"Instrument Serif", Georgia, serif';

  /* ---------- Layout, in logical units (the canvas is scaled to fit) ---------- */
  var W = 600, H = 520, CHART_H = 392;
  var RASTER = { x: 16, y: 416, w: 568, h: 60 };
  var RATE = { x: 16, y: 482, w: 568, h: 28 };
  var WIN = 8;          // seconds of history in the raster
  var RING = 0.9;       // s, life of the sonar ring a spike throws

  /* ---------- Network dynamics ---------- */
  var MU = 0.03;        // Hz, spontaneous rate per neuron
  var TAU_E = 0.12;     // s, decay of the excitation an incoming spike leaves
  var GAIN = 300;       // Hz per unit of excitation above threshold
  var TH_LO = 0.6, TH_HI = 1.4;    // thresholds, in full-strength spikes
  var U = 0.65;         // share of a neuron's synaptic resources each spike uses
  var TAU_REC = 4;      // s, recovery of those resources
  var REF = 0.1;        // s, refractory period
  var SPEED = 300;      // chart units per second along a fibre
  var STEP = 1 / 120;   // s, integration step

  /* ---------- Seeded randomness for the layout (same chart on every load) ---------- */
  var seeded = function (a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  var rng = seeded(20271);

  /* ---------- Geometry ----------
     Lateral view, frontal lobe to the left. Drawn in a 600-wide design space,
     then mapped onto the chart. Each outline is a closed Catmull-Rom spline
     through these points; sulci are open ones. */
  var S = 0.96, TX = 7.5, TY = 8;
  var map = function (pts) { return pts.map(function (p) { return [p[0] * S + TX, p[1] * S + TY]; }); };

  var CEREBRUM = map([
    [44, 214], [52, 160], [84, 112], [132, 76], [196, 52], [268, 40], [340, 38], [410, 50],
    [472, 76], [522, 114], [554, 162], [566, 214], [556, 252], [530, 276], [494, 288],
    [446, 296], [392, 304], [334, 312], [276, 318], [228, 316], [198, 302], [184, 282],
    [190, 263], [203, 253], [180, 251], [134, 255], [92, 249], [62, 236]
  ]);
  var CEREBELLUM = map([
    [440, 300], [480, 280], [530, 266], [558, 282], [567, 316], [553, 346], [518, 364],
    [474, 368], [440, 357], [422, 335], [424, 312]
  ]);
  var STEM = map([
    [380, 290], [428, 290], [436, 324], [432, 356], [426, 392], [424, 446], [392, 446],
    [392, 402], [378, 378], [366, 348], [368, 316]
  ]);
  var SULCI = [
    // lateral (Sylvian) fissure and central sulcus get the heavier line
    { w: 1.15, a: 0.55, pts: [[203, 253], [236, 246], [282, 236], [330, 222], [372, 204], [396, 186], [404, 166]] },
    { w: 1.05, a: 0.48, pts: [[322, 41], [312, 74], [306, 104], [292, 136], [288, 166], [276, 196], [266, 224]] },
    { w: 0.8, a: 0.34, pts: [[270, 45], [262, 80], [250, 116], [244, 150], [232, 186], [226, 214]] },
    { w: 0.8, a: 0.34, pts: [[372, 46], [360, 84], [350, 116], [344, 150], [336, 178], [328, 198]] },
    { w: 0.8, a: 0.3, pts: [[96, 118], [136, 104], [176, 98], [214, 101], [238, 106]] },
    { w: 0.8, a: 0.3, pts: [[76, 178], [112, 170], [150, 175], [190, 168], [220, 176]] },
    { w: 0.8, a: 0.3, pts: [[354, 126], [396, 118], [436, 127], [474, 147], [504, 175]] },
    { w: 0.8, a: 0.3, pts: [[214, 293], [262, 283], [312, 272], [360, 258], [404, 236], [434, 208]] },
    { w: 0.7, a: 0.24, pts: [[512, 124], [526, 160], [534, 196]] },
    { w: 0.7, a: 0.24, pts: [[518, 232], [540, 238], [556, 232]] },
    { w: 0.7, a: 0.22, pts: [[120, 140], [150, 134], [178, 140]] },
    { w: 0.7, a: 0.22, pts: [[86, 214], [114, 208], [144, 214]] },
    { w: 0.7, a: 0.22, pts: [[420, 82], [450, 92], [470, 110]] },
    { w: 0.7, a: 0.22, pts: [[300, 296], [340, 290], [380, 284]] }
  ].map(function (s) { return { w: s.w, a: s.a, pts: map(s.pts) }; });
  var LABELS = [
    { t: 'Frontal', x: 150, y: 142 }, { t: 'Parietal', x: 420, y: 92 },
    { t: 'Occipital', x: 515, y: 210 }, { t: 'Temporal', x: 300, y: 292 },
    { t: 'Cerebellum', x: 496, y: 330 }
  ].map(function (l) { return { t: l.t, x: l.x * S + TX, y: l.y * S + TY }; });

  // Closed or open Catmull-Rom through pts: a Path2D of cubics, plus a dense
  // polyline of the same curve for distance tests.
  var spline = function (pts, closed) {
    var n = pts.length, path = new Path2D(), poly = [], i, k;
    var P = function (j) { return closed ? pts[(j + n) % n] : pts[Math.max(0, Math.min(n - 1, j))]; };
    var segs = closed ? n : n - 1;
    path.moveTo(pts[0][0], pts[0][1]);
    for (i = 0; i < segs; i++) {
      var p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      path.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
      for (k = 0; k < 8; k++) {
        var t = k / 8, u = 1 - t;
        poly.push([u * u * u * p1[0] + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * p2[0],
                   u * u * u * p1[1] + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * p2[1]]);
      }
    }
    if (closed) path.closePath(); else poly.push(pts[n - 1]);
    return { path: path, poly: poly };
  };
  var cereb = spline(CEREBRUM, true), cbl = spline(CEREBELLUM, true), stem = spline(STEM, true);
  var island = new Path2D();
  island.addPath(stem.path); island.addPath(cbl.path); island.addPath(cereb.path);
  var sulci = SULCI.map(function (s) { return { w: s.w, a: s.a, path: spline(s.pts, false).path }; });

  var distToPoly = function (x, y, poly) {
    var best = Infinity, i;
    for (i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      var u = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0;
      var ex = a[0] + u * dx - x, ey = a[1] + u * dy - y, d = ex * ex + ey * ey;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };

  /* ---------- Neurons: Poisson-disk scatter over the cerebrum ---------- */
  var probe = document.createElement('canvas').getContext('2d');   // identity transform
  probe.font = 'italic 400 13px ' + SERIF;
  var keepOut = LABELS.map(function (l) {
    var hw = probe.measureText(l.t).width / 2 + 9;
    return [l.x - hw, l.y - 14, l.x + hw, l.y + 8];
  });
  var neurons = [], MIN_D2 = 29 * 29, tries, i, j;
  for (tries = 0; tries < 9000 && neurons.length < 74; tries++) {
    var x = 40 + rng() * 520, y = 40 + rng() * 280;
    if (!probe.isPointInPath(cereb.path, x, y) || distToPoly(x, y, cereb.poly) < 11) continue;
    if (keepOut.some(function (b) { return x > b[0] && x < b[2] && y > b[1] && y < b[3]; })) continue;
    if (neurons.some(function (n) { var dx = n.x - x, dy = n.y - y; return dx * dx + dy * dy < MIN_D2; })) continue;
    neurons.push({ x: x, y: y, e: 0, R: 0.5 + rng() * 0.5, th: TH_LO + rng() * (TH_HI - TH_LO), last: -9, out: [] });
  }
  var N = neurons.length;

  /* ---------- Wiring: five nearest neighbours each, plus long-range fibres ---------- */
  var edges = [], seen = {};
  var link = function (a, b, arc) {
    var key = Math.min(a, b) + ':' + Math.max(a, b);
    if (seen[key]) return false;
    seen[key] = true;
    var A = neurons[a], B = neurons[b], dx = B.x - A.x, dy = B.y - A.y, len = Math.sqrt(dx * dx + dy * dy);
    var e = { a: a, b: b, cx: null, cy: null };
    if (arc) {   // bow the fibre away from the chord, like a route on a chart
      e.cx = (A.x + B.x) / 2 + dy * 0.22; e.cy = (A.y + B.y) / 2 - dx * 0.22;
      len *= 1.08;
    }
    edges.push(e);
    A.out.push({ e: e, to: b, fwd: true, len: len, w: 0.8 + rng() * 0.4 });
    B.out.push({ e: e, to: a, fwd: false, len: len, w: 0.8 + rng() * 0.4 });
    return true;
  };
  neurons.forEach(function (n, a) {
    neurons.map(function (m, b) { return { b: b, d: (m.x - n.x) * (m.x - n.x) + (m.y - n.y) * (m.y - n.y) }; })
      .sort(function (p, q) { return p.d - q.d; })
      .slice(1, 6).forEach(function (o) { link(a, o.b, false); });
  });
  for (tries = 0, j = 0; tries < 400 && j < 9; tries++) {
    var a = Math.floor(rng() * N), b = Math.floor(rng() * N);
    var d = Math.hypot(neurons[a].x - neurons[b].x, neurons[a].y - neurons[b].y);
    if (d > 170 && d < 330 && link(a, b, true)) j++;
  }
  // Raster rows, front (left) to back
  var rank = new Array(N);
  neurons.map(function (n, k) { return k; })
    .sort(function (p, q) { return neurons[p].x - neurons[q].x; })
    .forEach(function (k, r) { rank[k] = r; });

  // Point at fraction u of the way along a fibre, from its source end
  var along = function (o, u, out) {
    var e = o.e, A = neurons[o.fwd ? e.a : e.b], B = neurons[o.fwd ? e.b : e.a];
    if (e.cx === null) { out[0] = A.x + (B.x - A.x) * u; out[1] = A.y + (B.y - A.y) * u; }
    else {
      var v = 1 - u;
      out[0] = v * v * A.x + 2 * v * u * e.cx + u * u * B.x;
      out[1] = v * v * A.y + 2 * v * u * e.cy + u * u * B.y;
    }
    return out;
  };

  /* ---------- Simulation ---------- */
  var t = 0, spikes = [], pulses = [];
  var fire = function (k) {
    var n = neurons[k], u = n.R;
    n.last = t;
    spikes.push({ i: k, t: t });
    n.R -= U * n.R;
    for (var q = 0; q < n.out.length; q++) {
      var o = n.out[q];
      pulses.push({ o: o, t0: t, dur: o.len / SPEED, amp: o.w * u });
    }
  };
  var advance = function (dt) {
    var steps = Math.max(1, Math.ceil(dt / STEP)), h = dt / steps, s, k, q;
    var decE = Math.exp(-h / TAU_E), rec = 1 - Math.exp(-h / TAU_REC);
    for (s = 0; s < steps; s++) {
      t += h;
      for (k = 0, q = 0; k < pulses.length; k++) {         // deliver spikes that have arrived
        var p = pulses[k];
        if (t >= p.t0 + p.dur) neurons[p.o.to].e += p.amp; else pulses[q++] = p;
      }
      pulses.length = q;
      for (k = 0; k < N; k++) {
        var n = neurons[k];
        n.e *= decE;
        n.R += (1 - n.R) * rec;
        var lam = MU + GAIN * Math.max(0, n.e - n.th);
        if (t - n.last >= REF && Math.random() < 1 - Math.exp(-lam * h)) fire(k);
      }
    }
    for (k = 0; k < spikes.length && spikes[k].t < t - WIN - 0.5; k++);
    if (k) spikes.splice(0, k);
  };
  var stimulate = function (k) {
    fire(k);
    neurons[k].out.forEach(function (o) { if (t - neurons[o.to].last >= REF) fire(o.to); });
  };

  /* ---------- Static layer: the chart, redrawn only on resize ---------- */
  var stat = document.createElement('canvas'), sctx = stat.getContext('2d'), scale = 1;
  var small = false;   // phone width: the chart's mono labels are set larger and shorter
  var spaced = function (c, px) { if ('letterSpacing' in c) c.letterSpacing = px + 'px'; };

  var renderStatic = function () {
    var c = sctx, k;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, stat.width, stat.height);
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);

    c.save();
    c.beginPath(); c.rect(0, 0, W, CHART_H); c.clip();
    c.fillStyle = '#F7FAFB'; c.fillRect(0, 0, W, CHART_H);

    // graticule
    c.strokeStyle = 'rgba(12,34,51,.055)'; c.lineWidth = 0.6;
    c.beginPath();
    for (k = 20; k < W; k += 40) { c.moveTo(k, 0); c.lineTo(k, CHART_H); }
    for (k = 16; k < CHART_H; k += 40) { c.moveTo(0, k); c.lineTo(W, k); }
    c.stroke();

    // Shallow-water bands and their isobaths, deepest first. Stroking the island
    // with a round-joined line of width 2d paints exactly the water within d of
    // the coast; a slightly wider stroke underneath leaves the isobath as a hairline.
    c.lineJoin = 'round';
    [[46, '#EDF5F8'], [27, '#E2EEF3'], [12, '#D4E6EE']].forEach(function (band) {
      c.lineWidth = 2 * band[0] + 1.3; c.strokeStyle = '#B4D1DC'; c.stroke(island);
      c.lineWidth = 2 * band[0] - 0.3; c.strokeStyle = band[1]; c.stroke(island);
      c.fillStyle = band[1]; c.fill(island);
    });

    // land: brainstem, cerebellum, then the cerebrum over both
    c.lineWidth = 1.15; c.strokeStyle = 'rgba(12,34,51,.8)';
    [stem, cbl, cereb].forEach(function (s) {
      c.fillStyle = '#FFFFFF'; c.fill(s.path); c.stroke(s.path);
    });

    // cerebellar folia
    c.save(); c.clip(cbl.path);
    c.strokeStyle = 'rgba(12,34,51,.24)'; c.lineWidth = 0.7;
    for (k = 0; k < 9; k++) {
      var fy = 278 + k * 9.6;
      c.beginPath();
      c.moveTo(400, fy + 14);
      c.quadraticCurveTo(480, fy - 8 + k * 0.8, 560, fy + 6 - k * 1.6);
      c.stroke();
    }
    c.restore();

    // sulci
    c.lineCap = 'round';
    sulci.forEach(function (s) {
      c.strokeStyle = 'rgba(12,34,51,' + s.a + ')'; c.lineWidth = s.w; c.stroke(s.path);
    });

    // fibres
    c.lineWidth = 0.7;
    edges.forEach(function (e) {
      var A = neurons[e.a], B = neurons[e.b];
      c.beginPath(); c.moveTo(A.x, A.y);
      if (e.cx === null) {
        c.strokeStyle = 'rgba(12,34,51,.11)'; c.setLineDash([]);
        c.lineTo(B.x, B.y);
      } else {
        c.strokeStyle = 'rgba(31,110,140,.22)'; c.setLineDash([2, 3]);
        c.quadraticCurveTo(e.cx, e.cy, B.x, B.y);
      }
      c.stroke();
    });
    c.setLineDash([]);

    // north arrow
    c.save(); c.translate(32, 44);
    c.fillStyle = OCEAN; c.beginPath(); c.moveTo(0, -16); c.lineTo(4.5, 2); c.lineTo(0, -1); c.closePath(); c.fill();
    c.fillStyle = 'rgba(12,34,51,.45)'; c.beginPath(); c.moveTo(0, -16); c.lineTo(-4.5, 2); c.lineTo(0, -1); c.closePath(); c.fill();
    c.font = '700 ' + (small ? 12 : 8) + 'px ' + MONO; c.fillStyle = OCEAN; c.fillText('N', 0, -20);
    c.restore();

    // scale bar: the cerebrum is about 16.5 cm front to back
    var perCm = (522 * S) / 16.5, sx = 22, sy = CHART_H - 22;
    c.fillStyle = INK; c.strokeStyle = INK; c.lineWidth = 0.8;
    for (k = 0; k < 4; k++) {
      if (k % 2 === 0) c.fillRect(sx + k * perCm, sy, perCm, 3);
      c.strokeRect(sx + k * perCm, sy, perCm, 3);
    }
    c.font = '400 ' + (small ? 11 : 7.5) + 'px ' + MONO; c.fillStyle = FADED; c.textAlign = 'center';
    ['0', '2', '4 cm'].forEach(function (s, q) { c.fillText(s, sx + q * 2 * perCm + (q === 2 ? 8 : 0), sy - 4); });
    c.restore();

    // chart frame line, and the raster's labels
    c.fillStyle = 'rgba(12,34,51,.22)'; c.fillRect(0, CHART_H, W, 0.8);
    c.font = '400 ' + (small ? 11 : 7.5) + 'px ' + MONO; spaced(c, small ? 0.6 : 1.1);
    c.fillStyle = FADED; c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.fillText(small ? 'RASTER · FRONT → BACK' : 'SPIKE RASTER · NEURONS FRONT → BACK', RASTER.x, RASTER.y - 6);
    c.textAlign = 'right';
    c.fillText(small ? 'ν(t) · 8 S' : 'POPULATION RATE ν(t) · LAST 8 S', RASTER.x + RASTER.w, RASTER.y - 6);
    spaced(c, 0);
    c.fillStyle = 'rgba(12,34,51,.04)'; c.fillRect(RASTER.x, RASTER.y, RASTER.w, RASTER.h);
    c.fillStyle = 'rgba(12,34,51,.25)'; c.fillRect(RATE.x, RATE.y + RATE.h, RATE.w, 0.6);
  };

  /* ---------- Per-frame layer ---------- */
  var pt = [0, 0], NB = 80, BIN = WIN / NB, bins = new Float32Array(NB), yMax = 3;
  var draw = function () {
    var k, n, s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(stat, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, CHART_H); ctx.clip();
    ctx.lineCap = 'round';

    // spikes in flight: a short wake behind a bright head
    ctx.lineWidth = 1.3;
    for (k = 0; k < pulses.length; k++) {
      var p = pulses[k], u = (t - p.t0) / p.dur;
      if (u < 0 || u > 1) continue;
      var a = Math.min(1, p.amp);
      ctx.strokeStyle = 'rgba(31,110,140,' + (0.18 + 0.4 * a).toFixed(3) + ')';
      ctx.beginPath();
      along(p.o, Math.max(0, u - 0.3), pt); ctx.moveTo(pt[0], pt[1]);
      along(p.o, Math.max(0, u - 0.15), pt); ctx.lineTo(pt[0], pt[1]);
      along(p.o, u, pt); ctx.lineTo(pt[0], pt[1]);
      ctx.stroke();
      ctx.fillStyle = 'rgba(31,110,140,' + (0.45 + 0.5 * a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(pt[0], pt[1], 1.5, 0, 6.2832); ctx.fill();
    }

    // sonar rings off each recent spike
    ctx.lineWidth = 0.9;
    for (k = spikes.length - 1; k >= 0 && t - spikes[k].t < RING; k--) {
      s = spikes[k]; n = neurons[s.i];
      var g = (t - s.t) / RING;
      ctx.strokeStyle = 'rgba(31,110,140,' + (0.5 * (1 - g) * (1 - g)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(n.x, n.y, 3 + 19 * g, 0, 6.2832); ctx.stroke();
    }

    // place names, haloed, over the traffic (neurons are kept clear of them)
    ctx.font = 'italic 400 13px ' + SERIF; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#FFFFFF'; ctx.fillStyle = 'rgba(12,34,51,.5)';
    for (k = 0; k < LABELS.length; k++) {
      ctx.strokeText(LABELS[k].t, LABELS[k].x, LABELS[k].y); ctx.fillText(LABELS[k].t, LABELS[k].x, LABELS[k].y);
    }

    // neurons: tinted by their current excitation, solid for a moment when they fire
    ctx.lineWidth = 0.75; ctx.strokeStyle = 'rgba(12,34,51,.6)';
    for (k = 0; k < N; k++) {
      n = neurons[k];
      var since = t - n.last, hot = since < 0.2, r = hot ? 3.4 - since * 4.5 : 2.3;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832);
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
      if (hot) { ctx.fillStyle = OCEAN; ctx.fill(); }
      else if (n.e > 0.05) { ctx.fillStyle = 'rgba(127,182,198,' + Math.min(0.9, 0.8 * n.e / n.th).toFixed(3) + ')'; ctx.fill(); }
      ctx.stroke();
    }
    ctx.restore();

    // raster
    var rowH = RASTER.h / N;
    ctx.fillStyle = 'rgba(12,34,51,.72)';
    bins.fill(0);
    for (k = 0; k < spikes.length; k++) {
      s = spikes[k];
      var age = t - s.t;
      if (age > WIN) continue;
      ctx.fillRect(RASTER.x + RASTER.w * (1 - age / WIN) - 0.6, RASTER.y + rank[s.i] * rowH, 1.2, Math.max(0.9, rowH));
      bins[Math.min(NB - 1, Math.floor(age / BIN))]++;
    }

    // population rate, Hz per neuron, smoothed over neighbouring bins
    var top = 0, vals = [];
    for (k = 0; k < NB; k++) {
      var v = (bins[Math.max(0, k - 1)] + 2 * bins[k] + bins[Math.min(NB - 1, k + 1)]) / 4 / (N * BIN);
      vals.push(v); if (v > top) top = v;
    }
    yMax += (Math.max(1.5, top * 1.15) - yMax) * 0.04;
    var base = RATE.y + RATE.h;
    ctx.beginPath(); ctx.moveTo(RATE.x, base);
    for (k = NB - 1; k >= 0; k--) {
      ctx.lineTo(RATE.x + RATE.w * (1 - (k + 0.5) / NB), base - RATE.h * Math.min(1, vals[k] / yMax));
    }
    ctx.lineTo(RATE.x + RATE.w, base); ctx.closePath();
    ctx.fillStyle = '#DCEBF0'; ctx.fill();
    ctx.beginPath();
    for (k = NB - 1; k >= 0; k--) {
      var px = RATE.x + RATE.w * (1 - (k + 0.5) / NB), py = base - RATE.h * Math.min(1, vals[k] / yMax);
      if (k === NB - 1) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = OCEAN; ctx.lineWidth = 1.1; ctx.lineJoin = 'round'; ctx.stroke();
  };

  /* ---------- Readout: mean rate per neuron over the last second ---------- */
  var lastReadout = -1;
  var readout = function () {
    if (!rateEl || t - lastReadout < 0.25) return;
    lastReadout = t;
    var c = 0;
    for (var k = spikes.length - 1; k >= 0 && t - spikes[k].t <= 1; k--) c++;
    rateEl.textContent = 'ν = ' + (c / N).toFixed(1) + ' Hz';
  };

  /* ---------- Sizing ---------- */
  var size = function () {
    var cssW = cv.clientWidth || 560, dpr = Math.min(2, window.devicePixelRatio || 1);
    var pw = Math.round(cssW * dpr), ph = Math.round(cssW * dpr * H / W);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    stat.width = pw; stat.height = ph;
    scale = pw / W;
    small = cssW < 480;
    renderStatic();
    draw();
  };

  /* ---------- Loop: runs only while the figure is on screen ---------- */
  var running = false, inView = false, lastT = 0;
  var frame = function (now) {
    if (!running) return;
    advance(Math.min(0.05, Math.max(0, (now - lastT) / 1000)));
    lastT = now;
    draw(); readout();
    requestAnimationFrame(frame);
  };
  var update = function () {
    var go = !REDUCE && inView && !document.hidden;
    if (go && !running) { running = true; lastT = performance.now(); requestAnimationFrame(frame); }
    else if (!go) running = false;
  };
  // Reduced motion: a stimulus plays out off-screen and the still frame updates once
  var settle = function () { if (!running) { advance(1.4); draw(); lastReadout = -1; readout(); } };

  cv.addEventListener('click', function (ev) {
    var r = cv.getBoundingClientRect();
    var x = (ev.clientX - r.left) / r.width * W, y = (ev.clientY - r.top) / r.height * H;
    var best = -1, bd = 42 * 42;
    neurons.forEach(function (n, k) {
      var d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
      if (d < bd) { bd = d; best = k; }
    });
    if (best >= 0) { stimulate(best); settle(); }
  });
  if (kick) kick.addEventListener('click', function () { stimulate(Math.floor(Math.random() * N)); settle(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; update(); }).observe(fig);
  } else inView = true;
  document.addEventListener('visibilitychange', update);
  window.addEventListener('resize', size, { passive: true });

  // Warm up so the raster is already full the first time it is seen
  advance(9);
  size();
  readout();
  update();
  // Repaint the place names once the page's fonts are in
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('italic 13px "Instrument Serif"'), document.fonts.load('8px "Space Mono"')])
      .then(function () { renderStatic(); draw(); }, function () {});
  }
})();
