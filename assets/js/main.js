(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* -----------------------------------------------------------
     Footer year
     ----------------------------------------------------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* -----------------------------------------------------------
     Nav: translucent until scrolled, then elevated + blurred
     ----------------------------------------------------------- */
  var nav = document.querySelector("[data-nav]");
  if (nav) {
    var setScrolled = function () {
      nav.setAttribute("data-scrolled", window.scrollY > 8 ? "true" : "false");
    };
    setScrolled();
    var navTicking = false;
    window.addEventListener("scroll", function () {
      if (!navTicking) {
        window.requestAnimationFrame(function () {
          setScrolled();
          navTicking = false;
        });
        navTicking = true;
      }
    }, { passive: true });
  }

  /* -----------------------------------------------------------
     Mobile nav toggle
     ----------------------------------------------------------- */
  var toggle = document.querySelector("[data-nav-toggle]");
  var mobileNav = document.querySelector("[data-nav-mobile]");

  if (toggle && mobileNav) {
    toggle.addEventListener("click", function () {
      var isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Menü öffnen" : "Menü schließen");
      mobileNav.setAttribute("data-open", String(!isOpen));
    });

    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Menü öffnen");
        mobileNav.setAttribute("data-open", "false");
      });
    });
  }

  /* -----------------------------------------------------------
     Contact form: front-end only placeholder handling
     ----------------------------------------------------------- */
  var form = document.querySelector("[data-contact-form]");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var button = form.querySelector("button[type='submit']");
      if (!button) return;
      var original = button.textContent;
      button.textContent = "Danke, wir melden uns.";
      button.disabled = true;
      setTimeout(function () {
        button.textContent = original;
        button.disabled = false;
        form.reset();
      }, 3200);
    });
  }

  /* -----------------------------------------------------------
     Reveal on scroll: IntersectionObserver only (no scroll
     listeners). Degrades to instantly visible under
     prefers-reduced-motion or if IO is unavailable.
     ----------------------------------------------------------- */
  var revealEls = document.querySelectorAll("[data-reveal]");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });

    /* Safety net: never let content stay invisible. */
    setTimeout(function () {
      revealEls.forEach(function (el) {
        el.classList.add("is-visible");
      });
    }, 4000);
  }

  /* ===============================================================
     3D WORLD NETWORK: dependency-free rotating wireframe globe.
     Runs entirely on a 2D canvas with a hand-rolled perspective
     projection - no Three.js, no CDN, nothing that can fail to load.
     Points sit on a sphere (Fibonacci distribution), rotate as one
     rigid body, and are joined to their nearest neighbours. A few
     "flight paths" sweep great-circle arcs between distant nodes,
     echoing a global network animation without any external asset.
     =============================================================== */
  var canvas = document.getElementById("globeCanvas");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var width = 0, height = 0, radius = 0;

    var POINT_COUNT = 130;
    var NEIGHBOR_COUNT = 3;
    var ARC_COUNT = 5;
    var GOLD = [201, 169, 97];

    var points = [];
    var edges = [];
    var arcs = [];

    function fibonacciSphere(n) {
      var pts = [];
      var phi = Math.PI * (3 - Math.sqrt(5));
      for (var i = 0; i < n; i++) {
        var y = 1 - (i / (n - 1)) * 2;
        var r = Math.sqrt(Math.max(0, 1 - y * y));
        var theta = phi * i;
        pts.push({ x: Math.cos(theta) * r, y: y, z: Math.sin(theta) * r });
      }
      return pts;
    }

    function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

    function buildEdges() {
      edges = [];
      for (var i = 0; i < points.length; i++) {
        var dists = [];
        for (var j = 0; j < points.length; j++) {
          if (i === j) continue;
          dists.push({ j: j, d: dot(points[i], points[j]) });
        }
        dists.sort(function (a, b) { return b.d - a.d; });
        for (var k = 0; k < NEIGHBOR_COUNT; k++) {
          var pair = [i, dists[k].j].sort(function (a, b) { return a - b; });
          var key = pair[0] + "-" + pair[1];
          if (!edges.some(function (e) { return e.key === key; })) {
            edges.push({ key: key, a: pair[0], b: pair[1] });
          }
        }
      }
    }

    function buildArcs() {
      arcs = [];
      for (var i = 0; i < ARC_COUNT; i++) {
        var a = Math.floor(Math.random() * points.length);
        var b = Math.floor(Math.random() * points.length);
        if (a === b) { i--; continue; }
        arcs.push({
          a: a,
          b: b,
          t: Math.random(),
          speed: 0.09 + Math.random() * 0.06,
          delay: Math.random() * 3
        });
      }
    }

    function slerp(p0, p1, t) {
      var d = Math.max(-1, Math.min(1, dot(p0, p1)));
      var omega = Math.acos(d);
      if (omega < 1e-6) return p0;
      var sinOmega = Math.sin(omega);
      var w0 = Math.sin((1 - t) * omega) / sinOmega;
      var w1 = Math.sin(t * omega) / sinOmega;
      return {
        x: p0.x * w0 + p1.x * w1,
        y: p0.y * w0 + p1.y * w1,
        z: p0.z * w0 + p1.z * w1
      };
    }

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * DPR;
      canvas.height = height * DPR;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      radius = Math.min(width, height) * 0.42;
    }

    function project(p, rotY, tiltX) {
      /* rotate around Y (spin), then around X (fixed tilt) */
      var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      var x1 = p.x * cosY + p.z * sinY;
      var z1 = -p.x * sinY + p.z * cosY;
      var y1 = p.y;

      var cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);
      var y2 = y1 * cosX - z1 * sinX;
      var z2 = y1 * sinX + z1 * cosX;

      var perspective = 2.6;
      var scale = perspective / (perspective + z2);
      return {
        x: width / 2 + x1 * radius * scale,
        y: height / 2 + y2 * radius * scale,
        z: z2,
        scale: scale
      };
    }

    function rgba(depth, alpha) {
      var a = Math.max(0, Math.min(1, alpha));
      return "rgba(" + GOLD[0] + "," + GOLD[1] + "," + GOLD[2] + "," + a + ")";
    }

    var rotation = 0;
    var lastTime = null;
    var running = true;
    var tilt = -0.36;

    function frame(now) {
      if (!running) return;
      if (lastTime === null) lastTime = now;
      var dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!reduceMotion) {
        rotation += dt * 0.16;
        arcs.forEach(function (arc) {
          if (arc.delay > 0) { arc.delay -= dt; return; }
          arc.t += dt * arc.speed;
          if (arc.t > 1.15) {
            arc.t = 0;
            arc.a = Math.floor(Math.random() * points.length);
            arc.b = Math.floor(Math.random() * points.length);
            arc.delay = 0.6 + Math.random() * 2.2;
          }
        });
      }

      ctx.clearRect(0, 0, width, height);

      var projected = points.map(function (p) { return project(p, rotation, tilt); });

      /* edges: nearer = brighter */
      edges.forEach(function (e) {
        var pa = projected[e.a], pb = projected[e.b];
        var avgZ = (pa.z + pb.z) / 2;
        var alpha = 0.05 + Math.max(0, (avgZ + 1) / 2) * 0.22;
        ctx.strokeStyle = rgba(avgZ, alpha);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      });

      /* nodes */
      projected.forEach(function (p) {
        var alpha = 0.15 + Math.max(0, (p.z + 1) / 2) * 0.65;
        var size = 1.1 + Math.max(0, (p.z + 1) / 2) * 1.6;
        ctx.beginPath();
        ctx.fillStyle = rgba(p.z, alpha);
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      /* flight-path arcs: pulsing dot travelling a great circle */
      arcs.forEach(function (arc) {
        if (arc.delay > 0) return;
        var t = Math.max(0, Math.min(1, arc.t));
        var localPoint = slerp(points[arc.a], points[arc.b], t);
        var p = project(localPoint, rotation, tilt);
        if (p.z < -0.15) return;
        var fade = Math.sin(Math.min(1, t) * Math.PI);
        ctx.save();
        ctx.shadowColor = "rgba(" + GOLD[0] + "," + GOLD[1] + "," + GOLD[2] + ",0.9)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.fillStyle = rgba(p.z, 0.85 * fade + 0.15);
        ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      if (!reduceMotion) {
        window.requestAnimationFrame(frame);
      }
    }

    function init() {
      points = fibonacciSphere(POINT_COUNT);
      buildEdges();
      buildArcs();
      resize();
      if (reduceMotion) {
        /* Render a single static frame: no rAF loop, but the globe
           geometry is still visible rather than an empty canvas. */
        frame(performance.now());
      } else {
        window.requestAnimationFrame(frame);
      }
    }

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        if (reduceMotion) frame(performance.now());
      }, 120);
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        running = false;
      } else if (!running) {
        running = true;
        lastTime = null;
        if (!reduceMotion) window.requestAnimationFrame(frame);
      }
    });

    init();
  }
})();
