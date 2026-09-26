/* Benny's — cocktail quick-reference. Plain JS, no build step.
   Recipes live in recipes.json (see README.md for the format). */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var data = { folders: [], cocktails: [] };
  var dataText = '';
  var count = 1;            // drinks to make; kept while the app is open
  var current = null;       // cocktail on screen, if any
  var wakeLock = null;
  var FAV_KEY = 'bennys.favorites';
  var BACK_KEY = 'bennys.back';

  // ---------- small helpers ----------

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function color(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : '#D8D8D4'; }
  function byName(a, b) { return a.name.localeCompare(b.name); }
  function store(key, val) { try { sessionStorage.setItem(key, val); } catch (e) {} }
  function recall(key, fallback) { try { return sessionStorage.getItem(key) || fallback; } catch (e) { return fallback; } }

  // Favorites: recipes.json sets the default; a tap on the star overrides it on this phone.
  function loadFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || {}; } catch (e) { return {}; } }
  function isFav(c) {
    var f = loadFavs();
    return Object.prototype.hasOwnProperty.call(f, c.id) ? !!f[c.id] : !!c.favorite;
  }
  function toggleFav(c) {
    var f = loadFavs();
    f[c.id] = !isFav(c);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch (e) {}
  }

  function inFolder(id) {
    return data.cocktails.filter(function (c) { return (c.folders || []).indexOf(id) !== -1; }).sort(byName);
  }
  function findCocktail(id) {
    for (var i = 0; i < data.cocktails.length; i++) if (data.cocktails[i].id === id) return data.cocktails[i];
    return null;
  }
  function summary(c) {
    return (c.ingredients || []).slice(0, 3).map(function (i) { return i.name; }).join(' · ');
  }

  // ---------- amounts ----------

  // Whole number + stacked fraction (halves, thirds, quarters, eighths); otherwise decimals.
  function splitAmount(x) {
    var whole = Math.floor(x + 1e-9);
    var rest = x - whole;
    if (rest < 0.01) return { w: String(whole), n: '', d: '' };
    if (1 - rest < 0.01) return { w: String(whole + 1), n: '', d: '' };
    var dens = [2, 3, 4, 8];
    for (var i = 0; i < dens.length; i++) {
      var d = dens[i], n = Math.round(rest * d);
      if (n > 0 && n < d && Math.abs(rest - n / d) < 0.01) {
        return { w: whole ? String(whole) : '', n: String(n), d: String(d) };
      }
    }
    return { w: String(Math.round(x * 100) / 100), n: '', d: '' };
  }

  var PLURAL = { dash: 'dashes', drop: 'drops', barspoon: 'barspoons', leaf: 'leaves', sprig: 'sprigs',
                 slice: 'slices', wedge: 'wedges', cube: 'cubes', piece: 'pieces' };
  function unitLabel(unit, qty) {
    if (!unit) return '';
    return Math.abs(qty - 1) < 1e-9 ? unit : (PLURAL[unit] || unit);
  }

  function amountHTML(ing, mult, size) {
    if (typeof ing.amount !== 'number') {
      return '<span class="amt ' + size + '"><span class="word">' + esc(ing.amount || '') + '</span></span>';
    }
    var q = ing.amount * mult, p = splitAmount(q), u = unitLabel(ing.unit, q);
    return '<span class="amt ' + size + '">' +
      (p.w ? '<span>' + p.w + '</span>' : '') +
      (p.n ? '<span class="frac"><span>' + p.n + '</span><span class="bar"></span><span>' + p.d + '</span></span>' : '') +
      (u ? '<span class="unit">' + esc(u) + '</span>' : '') +
      '</span>';
  }

  // ---------- icons ----------

  var ICON = {
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    chev: '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    grid: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
    folder: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>'
  };
  function star(filled, size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (filled ? 'currentColor' : 'none') +
      '" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';
  }

  // ---------- screens ----------

  function cocktailHref(c) { return '#/c/' + encodeURIComponent(c.id); }

  function tile(c) {
    return '<a class="tile" href="' + cocktailHref(c) + '">' +
      '<span class="dot" style="background:' + color(c.color) + '"></span>' +
      '<span style="display:flex;flex-direction:column;gap:4px;min-width:0">' +
      '<span class="tile-name">' + esc(c.name) + '</span>' +
      '<span class="tile-sub">' + esc(summary(c)) + '</span></span></a>';
  }

  function folderRow(href, icon, name, n) {
    return '<a class="row" href="' + href + '">' + icon + '<span class="row-name">' + esc(name) + '</span>' +
      '<span class="row-count">' + n + '</span>' + ICON.chev + '</a>';
  }

  function listItem(c) {
    return '<li><a class="citem" href="' + cocktailHref(c) + '">' +
      '<span class="dot" style="background:' + color(c.color) + '"></span>' +
      '<span class="citem-text"><span class="citem-name">' + esc(c.name) + '</span>' +
      '<span class="row-sub">' + esc(summary(c)) + '</span></span>' +
      (isFav(c) ? '<span style="color:var(--star)" aria-label="Favorite">' + star(true, 18) + '</span>' : '') +
      ICON.chev + '</a></li>';
  }

  function renderHome() {
    store(BACK_KEY, '#/');
    var favs = data.cocktails.filter(isFav).sort(byName);
    var folders = data.folders
      .map(function (f) { return { f: f, n: inFolder(f.id).length }; })
      .filter(function (x) { return x.n > 0; });
    app.innerHTML =
      '<div class="page">' +
      '<header class="top"><h1 class="page-title">Benny’s</h1>' +
      '<a class="icon-btn" href="#/search" aria-label="Search">' + ICON.search + '</a></header>' +
      (favs.length ? '<section class="section"><h2 class="label">Favorites</h2><div class="tiles">' +
        favs.map(tile).join('') + '</div></section>' : '') +
      '<section class="section" style="gap:4px"><h2 class="label" style="margin-bottom:4px">Library</h2>' +
      '<nav class="rows" aria-label="Folders">' +
      folderRow('#/all', ICON.grid, 'All cocktails', data.cocktails.length) +
      folders.map(function (x) { return folderRow('#/f/' + encodeURIComponent(x.f.id), ICON.folder, x.f.name, x.n); }).join('') +
      '</nav></section></div>';
  }

  function renderList(title, items, here) {
    store(BACK_KEY, here);
    app.innerHTML =
      '<div class="page" style="gap:20px">' +
      '<a class="back-link" href="#/">' + ICON.back + 'Benny’s</a>' +
      '<div class="list-head"><h1 class="list-title">' + esc(title) + '</h1>' +
      '<p class="list-count">' + items.length + (items.length === 1 ? ' cocktail' : ' cocktails') + '</p></div>' +
      (items.length ? '<ul class="clist">' + items.map(listItem).join('') + '</ul>' : '<p class="empty">Nothing here yet.</p>') +
      '</div>';
  }

  function renderFolder(id) {
    var f = data.folders.filter(function (x) { return x.id === id; })[0];
    if (!f) return renderHome();
    renderList(f.name, inFolder(id), '#/f/' + encodeURIComponent(id));
  }

  function renderSearch() {
    store(BACK_KEY, '#/search');
    app.innerHTML =
      '<div class="page" style="gap:20px">' +
      '<a class="back-link" href="#/">' + ICON.back + 'Benny’s</a>' +
      '<input class="search" id="q" type="search" placeholder="Search cocktails or ingredients" aria-label="Search cocktails or ingredients" autocomplete="off">' +
      '<ul class="clist" id="results"></ul></div>';
    var q = document.getElementById('q'), results = document.getElementById('results');
    function update() {
      var term = q.value.trim().toLowerCase();
      var hits = data.cocktails.filter(function (c) {
        if (!term) return true;
        if (c.name.toLowerCase().indexOf(term) !== -1) return true;
        return (c.ingredients || []).some(function (i) { return i.name.toLowerCase().indexOf(term) !== -1; });
      }).sort(byName);
      results.innerHTML = hits.map(listItem).join('');
    }
    q.addEventListener('input', update);
    update();
    q.focus();
  }

  function renderCocktail(id) {
    var c = findCocktail(id);
    if (!c) return renderHome();
    current = c;
    var fav = isFav(c);
    var details = [['Glass', c.glass], ['Garnish', c.garnish], ['Special steps', c.special], ['Notes', c.notes]]
      .filter(function (d) { return d[1]; });
    app.innerHTML =
      '<div class="fold">' +
      '<div class="top"><a class="icon-btn" href="' + esc(recall(BACK_KEY, '#/')) + '" aria-label="Back">' + ICON.back + '</a>' +
      '<button class="icon-btn" id="fav" aria-label="Favorite" aria-pressed="' + fav + '" style="color:' + (fav ? 'var(--star)' : 'var(--text)') + '">' +
      star(fav, 20) + '</button></div>' +
      '<h1 class="c-title">' + esc(c.name) + '</h1>' +
      '<div class="ings" id="ings"></div></div>' +
      (details.length ? '<section class="details" aria-label="Details"><dl>' + details.map(function (d) {
        return '<div class="drow"><dt>' + d[0] + '</dt><dd>' + esc(d[1]) + '</dd></div>';
      }).join('') + '</dl></section>' : '') +
      '<div class="dock" id="dock"></div><div id="sheet"></div>';
    drawAmounts();
    requestWake();
  }

  function drawAmounts() {
    var c = current, ings = document.getElementById('ings'), dock = document.getElementById('dock');
    if (!c || !ings) return;
    var batch = count > 1;
    ings.innerHTML =
      (batch ? '<div class="ings-head"><span class="spacer"></span><span class="col-big">' + count + ' drinks</span>' +
        '<span class="col-small">1 drink</span></div>' : '') +
      (c.ingredients || []).map(function (ing) {
        return '<div class="ing"><div class="ing-name">' + esc(ing.name) + '</div>' +
          amountHTML(ing, count, 'big') + (batch ? amountHTML(ing, 1, 'small') : '') + '</div>';
      }).join('');
    var pills = [1, 2, 3, 4].map(function (k) {
      return '<button class="pill" data-n="' + k + '" aria-pressed="' + (count === k) + '" aria-label="Make ' + k +
        (k === 1 ? ' drink' : ' drinks') + '">' + k + '</button>';
    }).join('');
    dock.innerHTML = '<span class="label">Make</span>' + pills +
      '<button class="pill more" data-more="1" aria-pressed="' + (count > 4) + '" aria-label="More than 4">' +
      (count > 4 ? count : '+') + '</button>';
  }

  function openSheet() {
    var choices = '';
    for (var k = 5; k <= 16; k++) {
      choices += '<button class="choice" data-n="' + k + '" aria-pressed="' + (count === k) + '" aria-label="Make ' + k + ' drinks">' + k + '</button>';
    }
    document.getElementById('sheet').innerHTML =
      '<div class="sheet-wrap"><button class="sheet-backdrop" data-close="1" aria-label="Close"></button>' +
      '<section class="sheet" aria-label="Choose how many drinks"><div class="grabber"></div>' +
      '<h2>How many drinks?</h2><div class="choices">' + choices + '</div></section></div>';
  }
  function closeSheet() { var s = document.getElementById('sheet'); if (s) s.innerHTML = ''; }

  // ---------- screen stays on while a recipe is open ----------

  function requestWake() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      lock.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () {});
  }
  function releaseWake() {
    if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
  }

  // ---------- routing & events ----------

  function route() {
    current = null;
    releaseWake();
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var id = parts[1] ? decodeURIComponent(parts[1]) : '';
    if (parts[0] === 'c' && id) renderCocktail(id);
    else if (parts[0] === 'f' && id) renderFolder(id);
    else if (parts[0] === 'all') renderList('All cocktails', data.cocktails.slice().sort(byName), '#/all');
    else if (parts[0] === 'search') renderSearch();
    else renderHome();
    window.scrollTo(0, 0);
  }

  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-n], [data-more], [data-close], #fav');
    if (!t) return;
    if (t.id === 'fav') {
      toggleFav(current);
      var fav = isFav(current);
      t.setAttribute('aria-pressed', fav);
      t.style.color = fav ? 'var(--star)' : 'var(--text)';
      t.innerHTML = star(fav, 20);
    } else if (t.hasAttribute('data-more')) {
      openSheet();
    } else if (t.hasAttribute('data-close')) {
      closeSheet();
    } else {
      count = Number(t.getAttribute('data-n'));
      closeSheet();
      drawAmounts();
    }
  });

  window.addEventListener('hashchange', route);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (current) requestWake();
    load(true);
  });

  // ---------- data ----------

  function load(quiet) {
    return fetch('recipes.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (text) {
        if (text === dataText) return;
        var parsed = JSON.parse(text);
        data = { folders: parsed.folders || [], cocktails: parsed.cocktails || [] };
        dataText = text;
        // Refresh the screen with new recipes, but never yank a recipe out from under you.
        if (!quiet || !current) route();
      })
      .catch(function (err) {
        if (quiet) return;
        app.innerHTML = '<div class="page"><h1 class="page-title">Benny’s</h1>' +
          '<p class="empty">Couldn’t load recipes (' + esc(err.message) + '). Check your connection and reopen.</p></div>';
      });
  }

  load(false);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
