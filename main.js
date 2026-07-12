/* ============================================================
   Andrea Signoretti — Portfolio interactions
   nav active · scroll reveals · route boat · compass · the fix
   No libraries. Transform/opacity only. rAF-throttled.
   ============================================================ */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IO = 'IntersectionObserver' in window;

  /* ---------- Preloader: wave reveal ---------- */
  var pre = document.getElementById('preloader');
  if (pre) {
    var revealed = false;
    var hide = function () { pre.style.display = 'none'; };
    var reveal = function () {
      if (revealed) return; revealed = true;
      if (REDUCE) { hide(); return; }
      pre.classList.add('done');
      pre.addEventListener('transitionend', function (e) {
        if (e.target === pre && e.propertyName === 'transform') hide();
      });
      setTimeout(hide, 1700);            // fallback if transitionend is missed
    };
    var MIN = 1600, t0 = performance.now();
    var kick = function () { setTimeout(reveal, Math.max(0, MIN - (performance.now() - t0))); };
    if (document.readyState === 'complete') kick();
    else window.addEventListener('load', kick);
    setTimeout(reveal, 5000);            // hard safety: never trap the page
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

  /* ---------- Nav active state ---------- */
  var navLinks = [].slice.call(document.querySelectorAll('nav > ul a'));
  var byId = {};
  navLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  var sections = document.querySelectorAll('main section');
  if (IO) {
    var navObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          navLinks.forEach(function (a) { a.classList.remove('active'); });
          var l = byId[e.target.id]; if (l) l.classList.add('active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { navObs.observe(s); });
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

  /* ---------- Route progress boat ---------- */
  var boat = document.getElementById('routeBoat');
  var mainEl = document.querySelector('main');
  var wps = document.querySelectorAll('.wp');
  if (boat && mainEl && wps.length && !REDUCE) {
    var first = wps[0], last = wps[wps.length - 1], ticking = false;
    var place = function () {
      ticking = false;
      var mTop = mainEl.getBoundingClientRect().top;
      var aRect = first.getBoundingClientRect(), bRect = last.getBoundingClientRect();
      var aY = aRect.top - mTop + 12, bY = bRect.top - mTop + 12;      // marker centres in main-space
      var aAbs = aRect.top + 12, bAbs = bRect.top + 12;                // marker centres in viewport-space
      var vp = window.innerHeight * 0.5;
      var t = (bAbs - aAbs) === 0 ? 0 : (vp - aAbs) / (bAbs - aAbs);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      boat.style.transform = 'translate(-50%,' + (aY + t * (bY - aY)) + 'px)';
    };
    var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(place); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    place();
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

  /* ---------- The Fix ---------- */
  var gh = document.getElementById('gh'), ga = document.getElementById('ga'), gf = document.getElementById('gf');
  var cap = document.getElementById('cap');
  var btns = { mh: document.getElementById('mh'), ma: document.getElementById('ma'), mb: document.getElementById('mb') };
  if (gh && ga && gf && cap) {
    var MODES = {
      mh: { show: [gh], text: '<b>One bearing, one line.</b> Human intuition points in the right direction — but alone, the position stays uncertain anywhere along the line.' },
      ma: { show: [ga], text: '<b>One bearing, one line.</b> The machine’s reading is precise — but a single line still isn’t a position.' },
      mb: { show: [gh, ga, gf], text: '<b>Two bearings cross: a fix.</b> Neither navigator finds the boat alone. Together, judgment and computation locate it exactly — that is augmented reasoning.' }
    };
    var setMode = function (id) {
      [gh, ga, gf].forEach(function (g) { g.classList.add('hidden'); });
      MODES[id].show.forEach(function (g) { g.classList.remove('hidden'); });
      cap.innerHTML = MODES[id].text;
      Object.keys(btns).forEach(function (k) { btns[k].classList.toggle('on', k === id); });
    };
    Object.keys(btns).forEach(function (id) {
      btns[id].addEventListener('click', function () { setMode(id); });
    });
  }
})();
