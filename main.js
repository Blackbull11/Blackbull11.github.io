/* ============================================================
   Andrea Signoretti — Portfolio interactions
   scroll reveals · nav voyage boat + active link · compass
   No libraries. Transform/opacity only. rAF-throttled.
   ============================================================ */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IO = 'IntersectionObserver' in window;

  /* ---------- Preloader: title card, one wave passage, then fade out ---------- */
  var pre = document.getElementById('preloader');
  if (pre) {
    var plVid = pre.querySelector('.pl-video');
    var revealed = false;
    var hide = function () {
      pre.style.display = 'none';
      if (plVid) { plVid.pause(); plVid.removeAttribute('src'); plVid.load(); }
    };
    var reveal = function () {
      if (revealed) return; revealed = true;
      root.classList.add('booted');      // hero prompt types "whoami" as the page appears
      if (REDUCE) { hide(); return; }
      pre.classList.add('done');
      pre.addEventListener('transitionend', function (e) {
        if (e.target === pre && e.propertyName === 'opacity') hide();
      });
      setTimeout(hide, 1000);            // fallback if transitionend is missed
    };

    /* Fade the footage in only once it can actually paint, so a slow decode
       shows plain paper rather than a black frame. The video is muted +
       playsinline, but a blocked play() must not strand the panel: the
       mist fill stands in and the timers below still run. */
    if (plVid) {
      var showVid = function () { plVid.classList.add('ready'); };
      if (plVid.readyState >= 2) showVid();
      else plVid.addEventListener('loadeddata', showVid, { once: true });
    }

    /* The title card holds for TITLE ms (name in, rule drawn), then the
       footage starts underneath it and the incoming wave wipes the card away.
       FRONT is the leading edge of the wave's body, measured off the clip:
       [clip seconds, fraction of the video's width]. The crest's foam runs
       about BAND of the width ahead of the body, so the card is fully clear
       behind the body and fully opaque ahead of the foam. The wave has swept
       off the frame by PASS seconds of clip time (the rest of the clip is
       blank sky before it loops), so the panel fades out there. */
    var TITLE = 1500, PASS = 1.2, BAND = 0.2;
    var FRONT = [[0.17, 0], [0.2, 0.08], [0.267, 0.2], [0.367, 0.32], [0.4, 0.4],
                 [0.5, 0.55], [0.633, 0.72], [0.7, 0.85], [0.833, 0.98], [0.867, 1]];
    var plTitle = pre.querySelector('.pl-title');
    var frontAt = function (t) {
      if (t <= FRONT[0][0]) return FRONT[0][1];
      for (var i = 1; i < FRONT.length; i++) {
        if (t < FRONT[i][0]) {
          var a = FRONT[i - 1], b = FRONT[i];
          return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]);
        }
      }
      return FRONT[FRONT.length - 1][1];
    };
    var wipe = function (t) {
      if (!plTitle || t < FRONT[0][0]) return;
      // map the clip's x onto the panel the way object-fit:cover does
      var pw = pre.clientWidth, ph = pre.clientHeight;
      var ratio = plVid.videoWidth && plVid.videoHeight ? plVid.videoWidth / plVid.videoHeight : 16 / 9;
      var dw = Math.max(pw, ph * ratio), x = (pw - dw) / 2 + frontAt(t) * dw;
      // on a portrait screen the cropped clip is far wider than the panel, so
      // cap the band or it spans the whole screen and reads as a plain fade
      var band = Math.min(BAND * dw, 0.35 * pw);
      plTitle.style.setProperty('--wipe-a', x.toFixed(1) + 'px');
      plTitle.style.setProperty('--wipe-b', (x + band).toFixed(1) + 'px');
    };

    setTimeout(function () {
      if (!plVid) { reveal(); return; }
      var plPlay = plVid.play();
      if (plPlay && plPlay.catch) plPlay.catch(reveal);
      var watch = function () {
        if (revealed) return;
        wipe(plVid.currentTime);
        if (plVid.currentTime >= PASS || plVid.ended) reveal();
        else requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    }, TITLE);
    setTimeout(reveal, TITLE + PASS * 1000 + 1500);   // hard safety: never trap the page
  } else {
    root.classList.add('booted');
  }

  /* ---------- Work-in-progress terminal: braille spinners ----------
     Each row starts a few frames apart so they don't tick in lockstep; they
     only redraw while the hero is on screen. Reduced motion keeps the static dot. */
  var spins = [].slice.call(document.querySelectorAll('.wip .spin'));
  if (spins.length && !REDUCE) {
    var SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏', spinF = 0;
    setInterval(function () {
      if (window.scrollY > window.innerHeight * 1.5) return;
      spinF = (spinF + 1) % SPIN.length;
      spins.forEach(function (s, i) { s.textContent = SPIN[(spinF + i * 3) % SPIN.length]; });
    }, 90);
  }

  /* ---------- Hero sea: layered swell the boat actually rides ----------
     Each layer is a sum of Gerstner (trochoidal) components rather than plain
     sines: every component displaces the surface horizontally as well as
     vertically, which pinches the crests and broadens the troughs the way real
     deep-water swell does. Component speeds follow the deep-water dispersion
     relation (w proportional to sqrt(k)), so long swells overtake short chop and
     the layers never resynchronise into a visible loop.

     The boat is then attached to one specific water particle of the mid layer:
     the same (x, y) the path generator produces for rest position x0 is what
     drives its surge, heave and pitch. Because the boat is painted *between* the
     far and mid layers, the mid layer's own fill is what covers the hull below
     the waterline — so the hull can never separate from the surface, and the
     near layer, painted in front of both, rides just close enough below the
     mid layer that its tallest crests occasionally wash over it (and the hull). */
  var heroSea = document.querySelector('.sea');
  var heroBoat = document.getElementById('heroBoat');
  var waveFar = document.getElementById('waveFar');
  var waveMid = document.getElementById('waveMid');
  var waveNear = document.getElementById('waveNear');
  if (heroSea && heroBoat && waveFar && waveMid && waveNear) {
    var VB_W = 1440, VB_H = 200, TAU = Math.PI * 2;
    // STEP must stay under a tenth of the shortest wavelength below, or the crests
    // alias and the Catmull-Rom smoothing turns the chop into visible jitter.
    var STEP = 11, PAD = 120;      // sample beyond both edges: x is displaced too
    var DISPERSION = 10;           // scales w = DISPERSION * sqrt(2*PI / wavelength)
    var HULL_HALF = 43;            // half the hull's width in the 120px boat SVG
    var BOAT_WATERLINE_PX = 17;    // element bottom (y=96) up to the hull waterline (y=79)
    var SURGE = 0.55;              // fraction of the orbital x-motion the boat follows

    // Amplitudes and wavelengths are in CSS pixels, not viewBox units: the viewBox
    // is stretched to the sea box, so units-based waves would shrink horizontally on
    // a narrow screen into chop the hull's straight waterline cannot sit on. In px,
    // a phone just shows fewer wavelengths of the same swell. Only `base` (the mean
    // level) stays in viewBox units, so the layers keep their share of the sea box.
    //
    // `steep` is the layer's total crest sharpness, shared across its components in
    // proportion to amplitude. Keeping it below 1 is what stops the trochoid from
    // folding back on itself into a self-intersecting path. `speed` re-imposes
    // perspective on top of dispersion, so the far layer still crawls.
    var LAYERS = [
      { fill: waveFar, foam: document.getElementById('foamFar'),
        base: 95, steep: 0.45, speed: 0.55,
        comps: [{ a: 5.8, len: 910, ph: 0.0, dir: 1 },
                { a: 2.8, len: 362, ph: 2.2, dir: 1 },
                { a: 1.2, len: 154, ph: 4.5, dir: -1 }] },
      // The mid layer is the boat's floor, so its short components stay small: the
      // hull is 86px wide and rides a straight waterline, and curvature that tight
      // is what would leave it perched on a crest or dug into a trough.
      { fill: waveMid, foam: document.getElementById('foamMid'),
        base: 112, steep: 0.36, speed: 0.8,
        comps: [{ a: 11.0, len: 625, ph: 1.4, dir: 1 },
                { a: 3.8, len: 303, ph: 3.7, dir: 1 },
                { a: 1.0, len: 151, ph: 0.9, dir: -1 }] },
      { fill: waveNear, foam: document.getElementById('foamNear'),
        base: 130, steep: 0.58, speed: 1,
        comps: [{ a: 15.8, len: 481, ph: 2.7, dir: 1 },
                { a: 6.1, len: 207, ph: 5.1, dir: 1 },
                { a: 2.6, len: 116, ph: 1.8, dir: -1 }] }
    ];
    LAYERS.forEach(function (layer) {
      var total = layer.comps.reduce(function (s, c) { return s + c.a; }, 0);
      layer.comps.forEach(function (c) {
        c.w = DISPERSION * layer.speed * Math.sqrt(TAU / c.len);
        c.xAmp = (layer.steep * c.a / total) * c.len / TAU;
      });
    });
    var MID_LAYER = LAYERS[1];

    var seaH = 0, seaW = 0, pxPerUnitX = 1, pxPerUnitY = 1, ampScale = 1, boatCx = 0;
    var measureHeroSea = function () {
      // offsetLeft/offsetWidth are pre-transform layout values, so this stays accurate
      // even mid-animation when the boat currently has a rotate() applied (a live
      // getBoundingClientRect() would report the rotated box's AABB instead).
      seaH = heroSea.clientHeight;
      seaW = heroSea.clientWidth;
      pxPerUnitX = seaW / VB_W;
      pxPerUnitY = seaH / VB_H;
      // Held near 1 so the far and mid layers keep clear water between them in a short sea
      // box, where the viewBox-unit gap between their mean levels is at its smallest.
      ampScale = Math.max(0.8, Math.min(1.15, seaH / 292));
      boatCx = heroBoat.offsetLeft + heroBoat.offsetWidth / 2;
    };

    // Position, in CSS px from the sea box's top-left, of the water particle whose
    // rest x is x0Px. Written into out as [x, y].
    var surfacePoint = function (layer, x0Px, t, out) {
      var x = x0Px, y = layer.base * pxPerUnitY, i, c, th;
      for (i = 0; i < layer.comps.length; i++) {
        c = layer.comps[i];
        th = (x0Px / c.len) * TAU - c.dir * c.w * t + c.ph;
        x -= c.dir * c.xAmp * ampScale * Math.sin(th);
        y -= c.a * ampScale * Math.cos(th);
      }
      out[0] = x; out[1] = y;
      return out;
    };

    var pt = [0, 0], samples = [];
    // Catmull-Rom through the sampled particles, converted to cubics and back into
    // viewBox units. The samples bunch up at the crests once displaced, so
    // interpolating them keeps the sharp crest from being smoothed flat again.
    var buildLayerPaths = function (layer, t) {
      var n = 0, x0, i;
      for (x0 = -PAD; x0 <= seaW + PAD; x0 += STEP) {
        surfacePoint(layer, x0, t, pt);
        samples[n++] = pt[0] / pxPerUnitX; samples[n++] = pt[1] / pxPerUnitY;
      }
      var last = n / 2 - 1;
      var d = 'M' + samples[0].toFixed(1) + ' ' + samples[1].toFixed(1);
      for (i = 0; i < last; i++) {
        var a = Math.max(0, i - 1) * 2, b = i * 2, c = (i + 1) * 2, e = Math.min(last, i + 2) * 2;
        d += ' C' + (samples[b] + (samples[c] - samples[a]) / 6).toFixed(1) +
             ' ' + (samples[b + 1] + (samples[c + 1] - samples[a + 1]) / 6).toFixed(1) +
             ' ' + (samples[c] - (samples[e] - samples[b]) / 6).toFixed(1) +
             ' ' + (samples[c + 1] - (samples[e + 1] - samples[b + 1]) / 6).toFixed(1) +
             ' ' + samples[c].toFixed(1) + ' ' + samples[c + 1].toFixed(1);
      }
      layer.foam.setAttribute('d', d);
      layer.fill.setAttribute('d', d + ' V' + VB_H + ' H' + samples[0].toFixed(1) + ' Z');
    };

    // The Gerstner sum above is still a handful of exact sinusoids, so however
    // busy it looks, the boat's ride is quasi-periodic — a patient eye will
    // eventually catch it repeating. A little value noise (bruit) laid on top of
    // the physical surge/heave/pitch breaks that: it's a smooth, non-periodic
    // wander (cosine-interpolated random steps, the classic cheap Perlin
    // stand-in) with no fixed frequency for the eye to lock onto. Two octaves —
    // a slow multi-second drift plus a faster jitter — read as gust-and-chop
    // texture the clean orbital model doesn't capture, without moving the hull
    // far enough off the wave-sampled position to look detached from the water.
    var noiseHash = function (n) {
      var s = Math.sin(n * 127.1) * 43758.5453123;
      return s - Math.floor(s);
    };
    var noise1D = function (x) {
      var i = Math.floor(x), f = x - i;
      var u = f * f * (3 - 2 * f);
      var a = noiseHash(i) * 2 - 1, b = noiseHash(i + 1) * 2 - 1;
      return a + (b - a) * u;
    };
    var bruit = function (t, seed) {
      return 0.7 * noise1D(t * 0.18 + seed) + 0.3 * noise1D(t * 0.53 + seed * 2.7);
    };

    var aft = [0, 0], fwd = [0, 0];
    // Pure render: draws one frame at time tMs. No scheduling side effect, so it's
    // safe to call this directly (e.g. on resize) without spawning an extra rAF chain.
    var renderHeroSea = function (tMs) {
      if (seaW <= 0 || seaH <= 0) return;
      var t = tMs / 1000, i;
      for (i = 0; i < LAYERS.length; i++) buildLayerPaths(LAYERS[i], t);

      // Sampling the surface a hull-half either side makes the pitch the average
      // slope under the boat rather than a single point's.
      surfacePoint(MID_LAYER, boatCx, t, pt);
      surfacePoint(MID_LAYER, boatCx - HULL_HALF, t, aft);
      surfacePoint(MID_LAYER, boatCx + HULL_HALF, t, fwd);

      // Distinct seeds keep the three axes off each other's beat, so the wobble
      // reads as chop rather than a single wobbling signal stretched three ways.
      var nSurge = bruit(t, 11.3) * 4;
      var nHeave = bruit(t, 47.9) * 2.5;
      var nAngle = bruit(t, 83.2) * 1.6;

      var angle = Math.max(-9, Math.min(9,
        Math.atan2(fwd[1] - aft[1], fwd[0] - aft[0]) * 180 / Math.PI + nAngle));
      var surge = (pt[0] - boatCx) * SURGE + nSurge;
      var heave = BOAT_WATERLINE_PX - (seaH - pt[1]) + nHeave;

      heroBoat.style.transform = 'translate(' + surge.toFixed(1) + 'px,' + heave.toFixed(1) +
        'px) rotate(' + angle.toFixed(2) + 'deg)';
    };

    var heroSeaTick = function (tMs) {
      renderHeroSea(tMs);
      requestAnimationFrame(heroSeaTick);
    };

    measureHeroSea();
    renderHeroSea(0);
    if (!REDUCE) requestAnimationFrame(heroSeaTick);

    window.addEventListener('resize', function () {
      measureHeroSea();
      // Redraw immediately instead of waiting for the next rAF tick: the sea's
      // min-height:220px clamp means a resize can change seaH without the ongoing
      // loop necessarily running that same instant (e.g. a throttled background tab).
      renderHeroSea(REDUCE ? 0 : performance.now());
    }, { passive: true });
  }

  /* ---------- Scroll reveals (staggered) ---------- */
  var reveals = [].slice.call(document.querySelectorAll('.reveal'));
  var counts = new Map();
  reveals.forEach(function (el) {
    var p = el.parentNode, n = counts.get(p) || 0;
    el.style.transitionDelay = (Math.min(n, 6) * 80) + 'ms';
    counts.set(p, n + 1);
  });
  if (IO && !REDUCE) {
    var revObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); revObs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(function (el) { revObs.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Voyage: the boat under the nav links + active link ----------
     One stop per nav link, in link order. The boat's x is piecewise linear in
     scroll: it is halfway between two links exactly when the next section reaches
     the reading line, so the link it is nearest is always the active one. The
     footer is too short to ever reach that line, so the last stop is pulled up to
     land just before the page bottoms out.

     What it sails over is a sea rather than a curve: three sharp-crested swells of
     unrelated lengths, so the course never visibly repeats, laid flat at each port
     (a link) and building to full height mid-passage. Its height is a tiny physics
     model: the water can only push the hull up and gravity brings it back down.
     On a slow scroll it hugs the surface; on a brisk one the crests fall away
     faster than gravity can follow, so it launches, flies nose-up, tips over and
     lands with a splash. The sea itself is never drawn. */
  var navList = document.querySelector('.nav-links ul');
  var navLinks = [].slice.call(document.querySelectorAll('.nav-links a'));
  var targets = navLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var voyage = document.querySelector('.voyage');
  var vBoat = document.getElementById('voyageBoat');
  var vSplash = document.getElementById('voyageSplash');
  if (voyage && vBoat && vSplash && navLinks.length > 1 && targets.every(Boolean)) {
    var N = navLinks.length, stopX = [], trackW = 0, activeIdx = -2, V_TAU = Math.PI * 2;
    // Heights are px above the calm-water line, pointing up.
    var SWELLS = [{ a: 2.6, len: 88, ph: 0.0 },     // lengths share no common period
                  { a: 0.8, len: 53, ph: 1.7 },
                  { a: 0.35, len: 37, ph: 4.1 }];
    var PEAK = 1.6;        // > 1 pinches the crests and flattens the troughs
    var CALM = 0.2;        // share of the swell left in port
    var GRAVITY = 400;     // px/s²: a crest only throws the boat once the scroll outruns this
    var CEILING = 9;       // highest the boat may fly, so the mast clears the link underline
    var MAX_PITCH = 18;    // deg
    var HULL_HALF = 9;     // px: half the hull's length at its 25px drawn width
    var SPLASH_AT = 35;    // px/s of closing speed (a ~1.5px drop) that throws spray on landing

    var measureVoyage = function () {
      var vr = voyage.getBoundingClientRect();
      trackW = vr.width;
      var listShown = navList && navList.offsetWidth > 0;
      navLinks.forEach(function (a, k) {
        if (listShown) { var r = a.getBoundingClientRect(); stopX[k] = r.left + r.width / 2 - vr.left; }
        else stopX[k] = trackW * (k + 0.5) / N;   // links folded into the menu: spread evenly
      });
    };

    // Scroll position -> x along the track; also moves the active link.
    var courseX = function () {
      var vh = window.innerHeight, y = window.scrollY, k;
      var maxY = document.documentElement.scrollHeight - vh;
      var probe = vh * 0.45;                  // the reading line, from the viewport top
      // Scroll offset at which each target reaches the reading line.
      var at = targets.map(function (el) { return el.getBoundingClientRect().top + y - probe; });
      at[N - 1] = Math.min(at[N - 1], maxY - Math.min(vh * 0.3, Math.max(0, maxY - at[N - 2]) / 2));
      for (k = N - 2; k >= 0; k--) at[k] = Math.min(at[k], at[k + 1] - 1);

      var act = -1;
      for (k = 0; k < N; k++) if (y >= at[k]) act = k;
      if (act !== activeIdx) {
        activeIdx = act;
        navLinks.forEach(function (a, i) {
          a.classList.toggle('active', i === act);
          if (i === act) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        });
      }

      // Keyframes (scroll -> x): the track's start at the top of the page, the midpoint
      // before each link as its section takes over, the last link at the bottom.
      var ks = [0], kx = [0];
      for (k = 0; k < N; k++) { ks.push(at[k]); kx.push(((k ? stopX[k - 1] : 0) + stopX[k]) / 2); }
      ks.push(Math.max(maxY, ks[N])); kx.push(stopX[N - 1]);
      for (k = 0; k < ks.length - 1; k++) {
        if (y < ks[k + 1]) {
          var span = ks[k + 1] - ks[k];
          return span > 0 ? kx[k] + (kx[k + 1] - kx[k]) * Math.max(0, (y - ks[k]) / span) : kx[k + 1];
        }
      }
      return kx[kx.length - 1];
    };

    var seaAt = function (x) {
      var h = 0, i, s, c;
      for (i = 0; i < SWELLS.length; i++) {
        s = SWELLS[i];
        c = (1 + Math.cos(x / s.len * V_TAU + s.ph)) / 2;
        h += s.a * (2 * Math.pow(c, PEAK) - 1);
      }
      // how far through the passage between the two neighbouring ports (track start, then links)
      var p0 = 0, p1 = stopX[0];
      for (i = 0; i < N - 1 && x > stopX[i]; i++) { p0 = stopX[i]; p1 = stopX[i + 1]; }
      var u = p1 > p0 ? Math.min(1, Math.max(0, (x - p0) / (p1 - p0))) : 0;
      // squared, so the sea flattens smoothly into each port: a kink there would drop
      // the water out from under the hull and launch it even on the slowest scroll
      var e = Math.sin(Math.PI * u);
      return h * (CALM + (1 - CALM) * e * e);
    };

    var splash = function (x, hs) {
      vSplash.style.transform = 'translate(' + x.toFixed(1) + 'px,' + (-hs).toFixed(1) + 'px)';
      vSplash.classList.remove('go');
      void vSplash.offsetWidth;               // restart the spray animation
      vSplash.classList.add('go');
    };

    var h = 0, v = 0, air = false, pitch = 0, lastX = null, lastHs = 0, lastT = 0, running = false;
    var tick = function (now) {
      var dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;
      if (!trackW) { running = false; return; }
      var x = courseX();
      var hs = seaAt(x);
      var dx = lastX === null ? 0 : x - lastX;
      var target;

      // A reduced-motion reader, the first frame, or a jump in position (resize, a
      // restored scroll) just sets the boat down on the water.
      if (REDUCE || lastX === null || Math.abs(dx) > 40) {
        h = hs; v = 0; air = false;
      } else {
        var vs = (hs - lastHs) / dt;           // how fast the water under the hull is rising
        v -= GRAVITY * dt;
        h += v * dt;
        if (h > CEILING) { h = CEILING; v = Math.min(v, 0); }
        // on (or pushed up by) the water; the hair of slack stops float noise on a slow
        // scroll from flickering it between sailing and flying
        if (h <= hs + 0.15) {
          if (air && vs - v > SPLASH_AT) splash(x, hs);
          h = hs; v = Math.max(v, vs); air = false;
        } else air = true;
      }

      if (air) {
        // nose along the flight path; atan (not atan2) keeps it sensible sailing astern too
        target = dx ? Math.atan(-v * dt / dx) * 180 / Math.PI : (v > 0 ? -MAX_PITCH : MAX_PITCH);
      } else {
        // the water's slope averaged under the whole hull, so short chop rocks it less
        // than the long swell does
        target = Math.atan(-(seaAt(x + HULL_HALF) - seaAt(x - HULL_HALF)) / (2 * HULL_HALF)) * 180 / Math.PI;
      }
      target = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, target));
      pitch = REDUCE ? target : pitch + (target - pitch) * Math.min(1, dt * (air ? 6 : 18));

      vBoat.style.transform = 'translate(' + x.toFixed(1) + 'px,' + (-h).toFixed(2) + 'px) rotate(' +
        pitch.toFixed(2) + 'deg)';

      var settled = !air && dx === 0 && Math.abs(target - pitch) < 0.1;
      lastX = x; lastHs = hs;
      if (settled) running = false;
      else requestAnimationFrame(tick);
    };
    var sail = function () {
      if (running) return;
      running = true;
      lastT = performance.now();
      requestAnimationFrame(tick);
    };
    var refitVoyage = function () { measureVoyage(); lastX = null; sail(); };
    window.addEventListener('scroll', sail, { passive: true });
    window.addEventListener('resize', refitVoyage, { passive: true });
    window.addEventListener('load', refitVoyage);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refitVoyage);   // link widths
    measureVoyage();
    sail();
  }

  /* ---------- Nav name: only once the hero's h1 has scrolled under the nav ---------- */
  var mark = document.querySelector('nav .mark');
  var heroName = document.querySelector('header h1');
  if (mark && heroName && IO) {
    var navEl = document.querySelector('nav');
    var markObs = null;
    var watchName = function () {
      if (markObs) markObs.disconnect();
      markObs = new IntersectionObserver(function (entries) {
        var e = entries[0];
        mark.classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0);
      }, { rootMargin: '-' + navEl.offsetHeight + 'px 0px 0px 0px' });
      markObs.observe(heroName);
    };
    watchName();
    window.addEventListener('resize', watchName, { passive: true });
  } else if (mark) {
    mark.classList.add('show');
  }

  /* Close mobile menu on link click */
  var menu = document.querySelector('.nav-menu');
  if (menu) {
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { menu.removeAttribute('open'); });
    });
  }

  /* ---------- Scroll cue fade ---------- */
  var cue = document.getElementById('scrollCue');
  if (cue) {
    var hideCue = function () {
      if (window.scrollY > 40) { cue.classList.add('gone'); window.removeEventListener('scroll', hideCue); }
    };
    window.addEventListener('scroll', hideCue, { passive: true });
  }

  /* ---------- The Compass ---------- */
  var CFG = [
    { label: "Multi-Agent Systems", dom: "N", t: 1, a: -25.6, r: 213 },
    { label: "Neuro-Symbolic AI", dom: "N", t: 1, a: -46.6, r: 202 },
    { label: "Agentic Systems", dom: "N", t: 1, a: 29.5, r: 213 },
    { label: "Knowledge Graphs", dom: "N", t: 2, a: 40.8, r: 192 },
    { label: "RAG", dom: "N", t: 2, a: 61.2, r: 142 },
    { label: "Explainable AI", dom: "N", t: 2, a: -58.9, r: 175 },
    { label: "JaCaMo", dom: "N", t: 3, a: -1.4, r: 123 },
    { label: "Smolagents", dom: "N", t: 3, a: 45.3, r: 157 },
    { label: "PyTorch", dom: "E", t: 1, a: 71.0, r: 210 },
    { label: "Deep Learning", dom: "E", t: 1, a: 107.7, r: 222 },
    { label: "Computer Vision", dom: "E", t: 2, a: 99.0, r: 183 },
    { label: "HF Transformers", dom: "E", t: 2, a: 115.8, r: 245 },
    { label: "NLP", dom: "E", t: 2, a: 79.9, r: 134 },
    { label: "Statistics", dom: "E", t: 3, a: 64.1, r: 242 },
    { label: "Optimal Control", dom: "E", t: 3, a: 82.3, r: 217 },
    { label: "Python", dom: "S", t: 1, a: 132.9, r: 140 },
    { label: "TypeScript", dom: "S", t: 2, a: 174.9, r: 203 },
    { label: "Docker", dom: "S", t: 2, a: 213.7, r: 195 },
    { label: "CI/CD", dom: "S", t: 3, a: 227.4, r: 177 },
    { label: "Git", dom: "S", t: 3, a: 140.0, r: 185 },
    { label: "Linux", dom: "S", t: 3, a: 189.4, r: 154 },
    { label: "PHP", dom: "S", t: 3, a: 235.5, r: 150 },
    { label: "REST APIs", dom: "S", t: 3, a: 159.8, r: 164 },
    { label: "RDF/OWL", dom: "W", t: 2, a: 283.0, r: 159 },
    { label: "SQL / SPARQL", dom: "W", t: 2, a: 254.5, r: 211 },
    { label: "Pandas", dom: "W", t: 2, a: 244.0, r: 244 },
    { label: "OCR", dom: "W", t: 3, a: 268.3, r: 130 },
    { label: "Data Pipelines", dom: "W", t: 3, a: 279.8, r: 245 }
  ];
  var DOMAINS = {
    N: { label: "N · Reasoning & Agents", x: 360, y: 30 },
    E: { label: "E · Machine Learning", x: 600, y: 280 },
    S: { label: "S · Engineering & DevOps", x: 360, y: 528 },
    W: { label: "W · Data & Knowledge", x: 120, y: 280 }
  };
  var CX = 360, CY = 280;
  var stage = document.getElementById('compassStage');
  var needle = document.getElementById('needle');
  var labelEls = {};

  if (stage && needle) {
    // domain labels
    Object.keys(DOMAINS).forEach(function (d) {
      var el = document.createElement('span');
      el.className = 'clabel'; el.textContent = DOMAINS[d].label;
      el.style.left = DOMAINS[d].x + 'px'; el.style.top = DOMAINS[d].y + 'px';
      stage.appendChild(el); labelEls[d] = el;
    });

    var words = [];
    var reset = function () {
      needle.style.transform = 'rotate(0deg)';
      words.forEach(function (b) { b.classList.remove('on', 'dim'); });
      Object.keys(labelEls).forEach(function (d) { labelEls[d].classList.remove('bright'); });
    };
    var point = function (w, btn) {
      needle.style.transform = 'rotate(' + w.a + 'deg)';
      words.forEach(function (b) {
        b.classList.toggle('dim', b.dataset.dom !== w.dom && b !== btn);
      });
      btn.classList.add('on'); btn.classList.remove('dim');
      Object.keys(labelEls).forEach(function (d) { labelEls[d].classList.toggle('bright', d === w.dom); });
    };

    CFG.forEach(function (w) {
      var rad = w.a * Math.PI / 180;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cword t' + w.t; b.textContent = w.label;
      b.dataset.dom = w.dom;
      b.style.left = (CX + w.r * Math.sin(rad)) + 'px';
      b.style.top = (CY - w.r * Math.cos(rad)) + 'px';
      var enter = function () { point(w, b); };
      b.addEventListener('mouseenter', enter);
      b.addEventListener('focus', enter);
      b.addEventListener('mouseleave', reset);
      b.addEventListener('blur', reset);
      stage.appendChild(b); words.push(b);
    });

    // scale stage to fit its container (keeps the no-overlap layout intact)
    var wrap = document.querySelector('.compass-radial');
    var fit = function () {
      var avail = wrap.clientWidth;
      var s = Math.min(1, avail / 720);
      stage.style.transform = 'scale(' + s + ')';
      wrap.style.height = (560 * s) + 'px';
    };
    window.addEventListener('resize', fit, { passive: true });
    fit();
  }

  // Mobile tag-group fallback
  var tagWrap = document.getElementById('compassTags');
  if (tagWrap) {
    var groups = { N: [], E: [], S: [], W: [] };
    CFG.forEach(function (w) { groups[w.dom].push(w.label); });
    var frag = document.createDocumentFragment();
    ['N', 'E', 'S', 'W'].forEach(function (d) {
      var g = document.createElement('div'); g.className = 'tag-group';
      var h = document.createElement('h4'); h.textContent = DOMAINS[d].label; g.appendChild(h);
      var pills = document.createElement('div'); pills.className = 'pills';
      groups[d].forEach(function (t) {
        var s = document.createElement('span'); s.className = 'pill'; s.textContent = t; pills.appendChild(s);
      });
      g.appendChild(pills); frag.appendChild(g);
    });
    tagWrap.appendChild(frag);
  }
})();
