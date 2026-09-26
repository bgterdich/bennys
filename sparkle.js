/* Tap the "Benny's" title on the home screen: a pixelated burst of dancing color.
   Self-contained; app.js doesn't know about it. */
(function () {
  'use strict';

  var PX = 6;                  // size of one "pixel"
  var canvas = null, ctx = null, parts = [], running = false, last = 0;

  function setup() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;image-rendering:pixelated';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst(x, y, n, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.65);
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120,
        hue: Math.random() * 360,
        spin: 180 + Math.random() * 360,           // how fast its color cycles (deg/s)
        wob: Math.random() * Math.PI * 2,          // dance phase
        wobF: 6 + Math.random() * 8,               // dance speed
        size: PX * (Math.random() < 0.25 ? 2 : 1),
        life: 0, max: 1.4 + Math.random() * 1.2
      });
    }
  }

  function frame(t) {
    var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life += dt;
      if (p.life > p.max || p.y > innerHeight + 20) { parts.splice(i, 1); continue; }
      p.vx *= 1 - 1.2 * dt;
      p.vy = p.vy * (1 - 1.2 * dt) + 520 * dt;     // drag + gravity
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.hue += p.spin * dt;
      // Dance: a side-to-side jig, snapped to the pixel grid for the 8-bit look.
      var dx = Math.sin(p.life * p.wobF + p.wob) * PX * 1.5;
      var gx = Math.round((p.x + dx) / PX) * PX, gy = Math.round(p.y / PX) * PX;
      var fade = 1 - Math.max(0, (p.life - p.max * 0.6) / (p.max * 0.4));
      // Twinkle near the end.
      if (fade < 0.5 && Math.floor(p.life * 20) % 2) continue;
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'hsl(' + (p.hue % 360) + ',95%,58%)';
      ctx.fillRect(gx, gy, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(frame);
    else running = false;
  }

  // The title's letters bounce through the rainbow while the pixels fly.
  function danceLetters(el) {
    if (el.getAttribute('data-dancing')) return;
    var text = el.textContent;
    el.setAttribute('data-dancing', '1');
    el.setAttribute('aria-label', text);
    el.innerHTML = Array.prototype.map.call(text, function (ch, i) {
      return '<span aria-hidden="true" class="dance" style="animation-delay:' + (i * 0.07) + 's">' + ch + '</span>';
    }).join('');
    setTimeout(function () {
      el.textContent = text;
      el.removeAttribute('data-dancing');
      el.removeAttribute('aria-label');
    }, 1800);
  }

  var style = document.createElement('style');
  style.textContent =
    '.page .top .page-title{cursor:pointer;-webkit-user-select:none;user-select:none}' +
    '.page-title .dance{display:inline-block;animation:bennys-dance .9s ease-in-out 2}' +
    '@keyframes bennys-dance{' +
    '0%{transform:translateY(0);color:inherit}' +
    '20%{transform:translateY(-10px) rotate(-6deg);color:#FF3B6B}' +
    '40%{transform:translateY(0) rotate(4deg);color:#FFB020}' +
    '60%{transform:translateY(-6px) rotate(-3deg);color:#2BD67B}' +
    '80%{transform:translateY(0) rotate(2deg);color:#3B82FF}' +
    '100%{transform:translateY(0);color:inherit}}';
  document.head.appendChild(style);

  document.addEventListener('click', function (e) {
    var title = e.target.closest('.page .top .page-title');
    if (!title) return;
    setup();
    var r = title.getBoundingClientRect();
    var x = e.clientX || r.left + r.width / 2, y = e.clientY || r.top + r.height / 2;
    burst(x, y, 140, 620);
    // A couple of smaller aftershocks along the word.
    setTimeout(function () { burst(r.left + r.width * 0.2, r.top + r.height / 2, 50, 420); }, 140);
    setTimeout(function () { burst(r.left + r.width * 0.8, r.top + r.height / 2, 50, 420); }, 260);
    danceLetters(title);
    if (navigator.vibrate) navigator.vibrate(15);
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  });
})();
