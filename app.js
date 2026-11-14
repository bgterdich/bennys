/* Benny's — cocktail quick-reference. Plain JS, no build step.
   Recipes live in recipes.json (see README.md for the format). */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var data = { favorites: [], folders: [], cocktails: [] };
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

  // Favorites: recipes.json lists them in home-screen order; a tap on the star overrides it on this phone.
  function loadFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || {}; } catch (e) { return {}; } }
  function isFav(c) {
    var f = loadFavs();
    return Object.prototype.hasOwnProperty.call(f, c.id) ? !!f[c.id] : data.favorites.indexOf(c.id) !== -1;
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

  // The app icon's pixel cherry and ice cube, beside the title.
  var DECO = '<img class="title-deco" src="icons/title-deco.svg" alt="">';
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

  // recipes.json order first; anything starred on this phone after, alphabetically
  function favList() {
    return data.cocktails.filter(isFav).sort(function (a, b) {
      var ia = data.favorites.indexOf(a.id), ib = data.favorites.indexOf(b.id);
      if (ia === -1 && ib === -1) return byName(a, b);
      return (ia === -1 ? 1e6 : ia) - (ib === -1 ? 1e6 : ib);
    });
  }

  function renderHome() {
    store(BACK_KEY, '#/');
    var favs = favList();
    var folders = data.folders
      .map(function (f) { return { f: f, n: inFolder(f.id).length }; })
      .filter(function (x) { return x.n > 0; });
    app.innerHTML =
      '<div class="page">' +
      '<header class="top"><div class="brand"><h1 class="page-title">Benny’s</h1>' + DECO + '</div>' +
      '<a class="icon-btn" href="#/search" aria-label="Search">' + ICON.search + '</a></header>' +
      (favs.length ? '<section class="section"><h2 class="label">Favorites</h2><div class="tiles">' +
        favs.map(tile).join('') + '</div></section>' : '') +
      '<section class="section" style="gap:4px"><h2 class="label" style="margin-bottom:4px">Library</h2>' +
      '<nav class="rows" aria-label="Folders">' +
      folderRow('#/all', ICON.grid, 'All cocktails', data.cocktails.length) +
      folders.map(function (x) { return folderRow('#/f/' + encodeURIComponent(x.f.id), ICON.folder, x.f.name, x.n); }).join('') +
      '</nav></section>' +
      '<div class="pp-entry"><a class="pp-link" href="#/parties">Plan party</a></div></div>';
  }

  function renderList(title, items, here) {
    store(BACK_KEY, here);
    app.innerHTML =
      '<div class="page" style="gap:20px">' +
      '<a class="back-link" href="#/" data-up>' + ICON.back + 'Benny’s</a>' +
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
      '<a class="back-link" href="#/" data-up>' + ICON.back + 'Benny’s</a>' +
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
      '<div class="top"><a class="icon-btn" href="' + esc(recall(BACK_KEY, '#/')) + '" aria-label="Back" data-up>' + ICON.back + '</a>' +
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
          amountHTML(ing, count, 'big') +
          (batch ? (typeof ing.amount === 'number' ? amountHTML(ing, 1, 'small') : '<span class="amt small"></span>') : '') + '</div>';
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

  // ---------- party planner ----------
  // Parties are saved on this phone (localStorage), like starred favorites.
  // A party: picked cocktails (library ids, or its own added cocktails), optional
  // drink counts, ingredients already on hand, and items bought.

  var PARTY_KEY = 'bennys.parties';
  var planning = false;     // a party screen is showing (don't re-render it under the keyboard)
  var party = null;         // party on screen
  var pickQuery = '';       // drinks-step search
  var draft = null;         // cocktail being added/edited: { id, name, ings: [{ amount, unit, name }] }
  var pickFolder = '';      // folder open in the drinks picker ('all' = every cocktail), at #/p/<id>/f/<folder>
  var UNITS = ['oz', 'ml', 'dash', 'barspoon', 'tsp', 'g', ''];   // '' = count (no unit)
  // Oz of juice per fruit, dry/small to juicy/large (sources in README). Used for "lime juice",
  // "clarified lime juice" etc.; not for an ingredient offering an alternative ("... or champagne acid").
  var FRUIT = {
    lime: { one: 'lime', many: 'limes', lo: 0.75, hi: 1.25 },
    lemon: { one: 'lemon', many: 'lemons', lo: 1, hi: 2 },
    grapefruit: { one: 'grapefruit', many: 'grapefruit', lo: 5, hi: 8 }
  };
  function fruitFor(key) {
    var m = key.match(/\b(lime|lemon|grapefruit) juice$/);
    return m && key.indexOf(' or ') === -1 ? FRUIT[m[1]] : null;
  }
  // Fruit to buy for `oz` of juice: juicy/large fruit need the fewest, dry/small the most.
  function fruitText(f, oz) {
    var few = Math.ceil(oz / f.hi - 1e-9), most = Math.ceil(oz / f.lo - 1e-9);
    return (few === most ? few : few + '–' + most) + ' ' + (most === 1 ? f.one : f.many);
  }
  var FR = { '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞' };

  function loadParties() {
    try { var p = JSON.parse(localStorage.getItem(PARTY_KEY)); return Array.isArray(p) ? p.map(fixParty) : []; }
    catch (e) { return []; }
  }
  function fixParty(p) {
    p.picks = p.picks || []; p.counts = p.counts || {}; p.custom = p.custom || [];
    p.have = p.have || {}; p.bought = p.bought || {}; p.step = p.step || 1;
    return p;
  }
  function saveParty(p) {
    p.updated = Date.now();
    var list = loadParties().filter(function (x) { return x.id !== p.id; });
    list.push(p);
    try { localStorage.setItem(PARTY_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function deleteParty(id) {
    var list = loadParties().filter(function (x) { return x.id !== id; });
    try { localStorage.setItem(PARTY_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function getParty(id) { return loadParties().filter(function (x) { return x.id === id; })[0] || null; }

  function customById(p, id) { return p.custom.filter(function (c) { return c.id === id; })[0] || null; }
  function partyCocktail(p, id) { return customById(p, id) || findCocktail(id); }
  function partyCocktails(p) { return p.picks.map(function (id) { return partyCocktail(p, id); }).filter(Boolean); }

  function ingKey(name) { return String(name || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function hasIt(p, k) { return Object.prototype.hasOwnProperty.call(p.have, k) ? !!p.have[k] : k === 'water'; }

  function fracText(x) {
    var s = splitAmount(x);
    return (s.w || '') + (s.n ? FR[s.n + '/' + s.d] || ('.' + s.n) : '') || '0';
  }
  function qtyText(q, unit) { return fracText(q) + (unit ? ' ' + unitLabel(unit, q) : ''); }

  // Every ingredient across the party's cocktails, same names combined (case-insensitive).
  // `sums` per unit come from cocktails with a count; `known` is true when every use has one.
  function needs(p) {
    var map = {};
    partyCocktails(p).forEach(function (c) {
      var n = p.counts[c.id] || 0;
      (c.ingredients || []).forEach(function (ing) {
        var name = String(ing.name || '').trim();
        if (!name) return;
        var k = ingKey(name);
        var it = map[k] || (map[k] = { key: k, name: name, uses: [], sums: {}, known: true });
        it.uses.push({ c: c, ing: ing, n: n });
        if (typeof ing.amount === 'number' && n) {
          var u = ing.unit || '';
          it.sums[u] = (it.sums[u] || 0) + ing.amount * n;
        } else it.known = false;
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(byName);
  }
  function totalText(it, shop) {
    if (!it.known) return '';
    var parts = Object.keys(it.sums).map(function (u) {
      var q = it.sums[u];
      if (shop) q = u === 'oz' ? Math.ceil(q * 4 - 1e-9) / 4 : Math.ceil(q - 1e-9);
      return qtyText(q, u);
    });
    var f = fruitFor(it.key), oz = it.sums.oz;
    if (shop && f && oz && parts.length === 1) parts[0] += ' · ' + fruitText(f, oz);
    return parts.join(' + ');
  }
  function usesText(it) {
    return it.uses.map(function (u) {
      var a = u.ing.amount;
      var q = typeof a === 'number' ? (u.n ? qtyText(a * u.n, u.ing.unit) : qtyText(a, u.ing.unit) + ' each') : (a || '');
      return u.c.name + (q ? ' ' + q : '');
    }).join(' · ');
  }
  function toBuy(p) { return needs(p).filter(function (it) { return !hasIt(p, it.key); }); }
  function progress(p) {
    var n = partyCocktails(p).length;
    if (!n) return 'No cocktails yet';
    var buy = toBuy(p), got = buy.filter(function (it) { return p.bought[it.key]; }).length;
    return n + (n === 1 ? ' cocktail' : ' cocktails') + ' · ' + (buy.length ? got + ' of ' + buy.length + ' bought' : 'nothing to buy');
  }

  var CHECK = {
    off: '<svg class="pp-check" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="none" stroke="#CFCFCB" stroke-width="1.5"/></svg>',
    on: '<svg class="pp-check" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11.25" fill="var(--accent)"/><path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="var(--on-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  // --- party list ---

  function renderParties() {
    planning = true;
    var list = loadParties().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
    app.innerHTML =
      '<div class="page" style="gap:20px">' +
      '<a class="back-link" href="#/" data-up>' + ICON.back + 'Benny’s</a>' +
      '<div class="list-head"><h1 class="list-title">Parties</h1></div>' +
      // Saved parties first, to pick up where you left off; then start a new one.
      (list.length ? '<section class="pp-group"><h2 class="label">Your parties</h2><ul class="clist">' + list.map(function (p) {
        return '<li><a class="citem" href="#/p/' + encodeURIComponent(p.id) + '"><span class="citem-text">' +
          '<span class="citem-name">' + esc(p.name) + '</span><span class="row-sub">' + esc(progress(p)) + '</span></span>' +
          ICON.chev + '</a></li>';
      }).join('') + '</ul></section>' : '') +
      '<section class="pp-group"><h2 class="label">New party</h2>' +
      '<form class="pp-new" id="pp-new"><input class="search" id="pp-name" type="text" placeholder="Party name" aria-label="New party name" maxlength="60" autocomplete="off">' +
      '<button class="pp-btn primary" type="submit">Start</button></form></section>' +
      '</div>';
  }

  function startParty(name) {
    var p = fixParty({ id: 'p' + Date.now().toString(36), name: name, created: Date.now() });
    saveParty(p);
    goDown('#/p/' + encodeURIComponent(p.id));
  }

  // --- one party ---

  function folderName(id) {
    if (id === 'all') return 'All cocktails';
    var f = data.folders.filter(function (x) { return x.id === id; })[0];
    return f ? f.name : '';
  }
  function folderCocktails(id) { return id === 'all' ? data.cocktails.slice().sort(byName) : inFolder(id); }
  function partyHref(p) { return '#/p/' + encodeURIComponent(p.id); }

  function renderParty(id, folder) {
    party = getParty(id);
    if (!party) return renderParties();
    planning = true;
    pickQuery = '';
    draft = null;
    pickFolder = folder && folderName(folder) ? folder : '';
    if (pickFolder) {
      // One folder of the drinks picker: a level below the party, like a folder below home.
      app.innerHTML =
        '<div class="page" style="gap:20px">' +
        '<a class="back-link" href="' + partyHref(party) + '" data-up>' + ICON.back + esc(party.name) + '</a>' +
        '<div class="list-head"><h1 class="list-title">' + esc(folderName(pickFolder)) + '</h1>' +
        '<p class="list-count" id="pp-fcount"></p></div>' +
        '<div id="pp-list"></div></div>';
      drawPickList();
      return;
    }
    app.innerHTML =
      '<div class="page" style="gap:20px">' +
      '<a class="back-link" href="#/parties" data-up>' + ICON.back + 'Parties</a>' +
      '<h1 class="list-title pp-title">' + esc(party.name) + '</h1>' +
      '<div class="pp-tabs" id="pp-tabs" role="tablist"></div>' +
      '<div class="pp-body" id="pp-body"></div>' +
      '<button class="pp-delete" type="button" data-pp-act="delete">Delete party</button>' +
      '</div><div id="pp-sheet"></div>';
    drawTabs();
    drawBody();
  }

  function el(id) { return document.getElementById(id); }
  function touch() { saveParty(party); }

  function drawTabs() {
    if (!el('pp-tabs')) return;
    var n = partyCocktails(party).length;
    var left = toBuy(party).filter(function (it) { return !party.bought[it.key]; }).length;
    var tabs = [[1, 'Drinks', n || ''], [2, 'Ingredients', ''], [3, 'Shop', n ? left : '']];
    el('pp-tabs').innerHTML = tabs.map(function (t) {
      return '<button class="pp-tab" type="button" role="tab" data-pp-step="' + t[0] + '" aria-selected="' + (party.step === t[0]) + '">' +
        t[1] + (t[2] !== '' ? '<span class="n">' + t[2] + '</span>' : '') + '</button>';
    }).join('');
  }

  function drawBody() {
    var body = el('pp-body');
    if (party.step === 1) {
      body.innerHTML =
        '<div class="pp-chips" id="pp-chips"></div>' +
        '<div id="pp-form"></div>' +
        '<section class="pp-sec"><input class="search" id="pp-q" type="search" placeholder="Find cocktails" aria-label="Find cocktails" autocomplete="off" value="' + esc(pickQuery) + '">' +
        '<div id="pp-list"></div></section>' +
        '<button class="pp-btn primary pp-next" type="button" data-pp-step="2">Next: ingredients</button>';
      drawChips(); drawForm(); drawPickList();
    } else if (party.step === 2) {
      var cs = partyCocktails(party);
      if (!cs.length) { body.innerHTML = emptyStep(); return; }
      body.innerHTML =
        '<section class="pp-sec"><h2 class="label">How many of each?</h2><p class="pp-note">Optional. Fills in the totals.</p><div class="pp-counts">' +
        cs.map(function (c) {
          var v = party.counts[c.id] || '';
          return '<div class="pp-count"><span class="pp-cname">' + esc(c.name) + '</span>' +
            '<button class="pp-stepper" type="button" data-pp-dec="' + esc(c.id) + '" aria-label="Fewer ' + esc(c.name) + '">−</button>' +
            '<input class="pp-num" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" data-pp-count="' + esc(c.id) + '" value="' + v + '" placeholder="–" aria-label="How many ' + esc(c.name) + '">' +
            '<button class="pp-stepper" type="button" data-pp-inc="' + esc(c.id) + '" aria-label="More ' + esc(c.name) + '">+</button></div>';
        }).join('') + '</div></section>' +
        '<section class="pp-sec"><h2 class="label">Ingredients</h2><p class="pp-note" id="pp-inote"></p><ul class="pp-list" id="pp-ings"></ul></section>' +
        '<button class="pp-btn primary pp-next" type="button" data-pp-step="3">Next: shopping list</button>';
      drawIngs();
    } else {
      if (!partyCocktails(party).length) { body.innerHTML = emptyStep(); return; }
      body.innerHTML =
        '<div class="pp-shophead"><span class="pp-note" id="pp-left"></span>' +
        '<button class="pp-btn" type="button" data-pp-act="copy" id="pp-copy">Copy list</button></div>' +
        '<ul class="pp-list" id="pp-shop"></ul>' + CONV_BTN;
      drawShop();
    }
  }
  function emptyStep() {
    return '<p class="empty">Pick some cocktails first.</p>' +
      '<button class="pp-btn primary pp-next" type="button" data-pp-step="1">Pick cocktails</button>' +
      (party.step === 3 ? CONV_BTN : '');
  }

  // Quick reference for shopping, from the Shop tab.
  var CONV_BTN = '<button class="pp-link pp-conv" type="button" data-pp-act="conv">Conversions</button>';
  function ozOf(ml) { return (Math.round(ml / 29.5735 * 10) / 10) + ' oz'; }
  function openConversions() {
    function rows(list) {
      return '<dl class="pp-conv-list">' + list.map(function (r) {
        return '<div class="drow"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
      }).join('') + '</dl>';
    }
    function juice(f) { return fracText(f.lo) + '–' + fracText(f.hi) + ' oz'; }
    el('pp-sheet').innerHTML =
      '<div class="sheet-wrap"><button class="sheet-backdrop" type="button" data-pp-act="closeconv" aria-label="Close"></button>' +
      '<section class="sheet pp-conv-sheet" aria-label="Conversions"><div class="grabber"></div><h2>Conversions</h2>' +
      '<h3 class="label">Juice per fruit (dry/small to juicy/large)</h3>' +
      rows([['Lime', juice(FRUIT.lime)], ['Lemon', juice(FRUIT.lemon)], ['Grapefruit', juice(FRUIT.grapefruit)]]) +
      '<h3 class="label">Bottles</h3>' +
      rows([['50 ml (mini)', ozOf(50)], ['375 ml (half)', ozOf(375)], ['750 ml (a fifth)', ozOf(750)],
            ['1 L', ozOf(1000)], ['1.75 L (handle)', ozOf(1750)]]) +
      '<h3 class="label">Small measures</h3>' +
      rows([['1 oz', '29.6 ml'], ['1 cup', '8 oz'], ['1 tbsp', '½ oz'], ['1 tsp', '⅙ oz']]) +
      '<p class="pp-note">A 750 ml bottle holds about 12 pours of 2 oz, or 16 of 1½ oz.</p>' +
      '</section></div>';
  }

  // Step 1: drinks
  function drawChips() {
    if (!el('pp-chips')) return;
    var cs = partyCocktails(party);
    el('pp-chips').innerHTML = cs.length ? cs.map(function (c) {
      return '<button class="pp-chip" type="button" data-pp-pick="' + esc(c.id) + '" aria-label="Remove ' + esc(c.name) + '">' +
        esc(c.name) + CHECK.x + '</button>';
    }).join('') : '<p class="pp-note">Pick the cocktails you’ll make.</p>';
  }

  function isPicked(c) { return party.picks.indexOf(c.id) !== -1; }

  function pickRow(c, custom) {
    var on = isPicked(c);
    return '<li class="pp-row"><button class="pp-item" type="button" data-pp-pick="' + esc(c.id) + '" aria-pressed="' + on + '">' +
      (on ? CHECK.on : CHECK.off) + '<span class="pp-text"><span class="pp-name">' + esc(c.name) + '</span>' +
      '<span class="pp-sub">' + esc(summary(c) || 'No ingredients yet') + '</span></span></button>' +
      (custom ? '<button class="pp-edit" type="button" data-pp-edit="' + esc(c.id) + '">Edit</button>' : '') + '</li>';
  }

  function pickFolderRow(id, icon) {
    var cs = folderCocktails(id), n = cs.filter(isPicked).length;
    return '<a class="row" href="' + partyHref(party) + '/f/' + encodeURIComponent(id) + '">' + icon +
      '<span class="row-name">' + esc(folderName(id)) + '</span>' +
      (n ? '<span class="pp-badge" aria-label="' + n + ' picked">' + n + '</span>' : '') +
      '<span class="row-count">' + cs.length + '</span>' + ICON.chev + '</a>';
  }

  // Drinks picker: inside a folder, that folder's cocktails; on the party page, a search
  // shows matches from everywhere, otherwise this party's own cocktails, favorites, then folders.
  function drawPickList() {
    var box = el('pp-list');
    if (!box) return;
    if (pickFolder) {
      var cs = folderCocktails(pickFolder), n = cs.filter(isPicked).length;
      el('pp-fcount').textContent = n ? n + ' picked' : 'Tap to pick';
      box.innerHTML = '<ul class="pp-list">' + cs.map(function (c) { return pickRow(c, false); }).join('') + '</ul>';
      return;
    }
    var term = pickQuery.trim().toLowerCase();
    var mine = party.custom.slice().sort(byName);
    if (term) {
      var match = function (c) {
        if (c.name.toLowerCase().indexOf(term) !== -1) return true;
        return (c.ingredients || []).some(function (i) { return String(i.name || '').toLowerCase().indexOf(term) !== -1; });
      };
      var html = mine.filter(match).map(function (c) { return pickRow(c, true); }).join('') +
        data.cocktails.slice().sort(byName).filter(match).map(function (c) { return pickRow(c, false); }).join('');
      box.innerHTML = '<ul class="pp-list">' + (html ||
        '<li class="pp-row"><p class="pp-note pp-pad">No matches. Add it as a new cocktail.</p></li>') + '</ul>';
      return;
    }
    var favs = favList();
    var folders = data.folders.filter(function (f) { return inFolder(f.id).length; });
    box.innerHTML =
      (mine.length ? '<div class="pp-group"><h2 class="label">This party’s cocktails</h2><ul class="pp-list">' +
        mine.map(function (c) { return pickRow(c, true); }).join('') + '</ul></div>' : '') +
      (favs.length ? '<div class="pp-group"><h2 class="label">Favorites</h2><ul class="pp-list">' +
        favs.map(function (c) { return pickRow(c, false); }).join('') + '</ul></div>' : '') +
      '<div class="pp-group"><h2 class="label">Library</h2><nav class="rows" aria-label="Folders">' +
      pickFolderRow('all', ICON.grid) +
      folders.map(function (f) { return pickFolderRow(f.id, ICON.folder); }).join('') +
      '</nav></div>';
  }

  function drawForm() {
    var box = el('pp-form');
    if (!draft) {
      box.innerHTML = '<button class="pp-btn pp-add" type="button" data-pp-act="new">+ New cocktail</button>';
      return;
    }
    var editing = !!customById(party, draft.id);
    box.innerHTML =
      '<div class="pp-card">' +
      '<input class="pp-input" id="pp-dname" type="text" placeholder="Cocktail name" aria-label="Cocktail name" maxlength="60" autocomplete="off" value="' + esc(draft.name) + '">' +
      '<h2 class="label">Ingredients</h2>' +
      draft.ings.map(function (g, i) {
        return '<div class="pp-ingrow" data-row="' + i + '">' +
          '<input class="pp-input nm" type="text" data-f="name" placeholder="Ingredient" aria-label="Ingredient" autocomplete="off" value="' + esc(g.name) + '">' +
          '<input class="pp-input a" type="text" inputmode="decimal" data-f="amount" placeholder="Amt" aria-label="Amount" autocomplete="off" value="' + esc(g.amount) + '">' +
          '<select class="pp-input u" data-f="unit" aria-label="Unit">' + UNITS.map(function (u) {
            return '<option value="' + u + '"' + (g.unit === u ? ' selected' : '') + '>' + (u || 'count') + '</option>';
          }).join('') + '</select>' +
          '<button class="pp-x" type="button" data-pp-act="rmrow" data-i="' + i + '" aria-label="Remove ingredient">' + CHECK.x + '</button></div>';
      }).join('') +
      '<button class="pp-link-btn" type="button" data-pp-act="addrow">+ Ingredient</button>' +
      '<div class="pp-actions">' +
      (editing ? '<button class="pp-btn quiet" type="button" data-pp-act="rmdraft">Delete</button><span style="flex:1"></span>' : '') +
      '<button class="pp-btn" type="button" data-pp-act="cancel">Cancel</button>' +
      '<button class="pp-btn primary" type="button" data-pp-act="savedraft">' + (editing ? 'Save' : 'Add') + '</button></div>' +
      '</div>';
  }

  function readDraft() {
    if (!draft || !el('pp-dname')) return;
    draft.name = el('pp-dname').value;
    Array.prototype.forEach.call(document.querySelectorAll('.pp-ingrow'), function (r) {
      var g = draft.ings[Number(r.getAttribute('data-row'))];
      if (!g) return;
      g.name = r.querySelector('[data-f="name"]').value;
      g.amount = r.querySelector('[data-f="amount"]').value;
      g.unit = r.querySelector('[data-f="unit"]').value;
    });
  }

  // "1.5", "1,5", "3/4", "1 1/2" -> number; blank -> null; anything else stays text ("top").
  function parseAmount(s) {
    s = String(s || '').trim().replace(',', '.');
    if (!s) return null;
    var m;
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)) && Number(m[3])) return Number(m[1]) + Number(m[2]) / Number(m[3]);
    if ((m = s.match(/^(\d+)\/(\d+)$/)) && Number(m[2])) return Number(m[1]) / Number(m[2]);
    if (/^\d*\.?\d+$/.test(s)) return Number(s);
    return s;
  }

  function saveDraft() {
    readDraft();
    var name = draft.name.trim();
    if (!name) { el('pp-dname').focus(); return; }
    var ings = draft.ings.filter(function (g) { return g.name.trim(); }).map(function (g) {
      var a = parseAmount(g.amount), ing = { name: g.name.trim() };
      if (a !== null) ing.amount = a;
      if (typeof a === 'number' && g.unit) ing.unit = g.unit;
      return ing;
    });
    var c = customById(party, draft.id);
    if (c) { c.name = name; c.ingredients = ings; }
    else {
      party.custom.push({ id: draft.id, name: name, ingredients: ings });
      party.picks.push(draft.id);
    }
    draft = null;
    touch();
    drawTabs(); drawChips(); drawForm(); drawPickList();
  }

  function editDraft(id) {
    var c = customById(party, id);
    if (!c) return;
    draft = { id: c.id, name: c.name, ings: (c.ingredients || []).map(function (i) {
      return { name: i.name, amount: i.amount == null ? '' : String(i.amount), unit: typeof i.amount === 'number' ? (i.unit || '') : 'oz' };
    }) };
    if (!draft.ings.length) draft.ings.push({ name: '', amount: '', unit: 'oz' });
    drawForm();
    el('pp-form').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function togglePick(id) {
    var i = party.picks.indexOf(id);
    if (i === -1) party.picks.push(id); else party.picks.splice(i, 1);
    touch();
    drawTabs(); drawChips(); drawPickList();
  }

  // Step 2: counts + ingredients
  function setCount(id, v) {
    v = Math.max(0, Math.min(999, Math.floor(Number(v) || 0)));
    if (v) party.counts[id] = v; else delete party.counts[id];
    touch();
    var input = document.querySelector('[data-pp-count="' + id.replace(/"/g, '\\"') + '"]');
    if (input && document.activeElement !== input) input.value = v || '';
    drawIngs(); drawTabs();
  }

  function itemRow(it, attr, done, qty, sub) {
    return '<li class="pp-row"><button class="pp-item' + (done ? ' done' : '') + '" type="button" ' + attr + '="' + esc(it.key) + '" aria-pressed="' + done + '">' +
      (done ? CHECK.on : CHECK.off) + '<span class="pp-text"><span class="pp-name">' + esc(it.name) + '</span>' +
      (sub ? '<span class="pp-sub">' + esc(sub) + '</span>' : '') + '</span>' +
      (qty ? '<span class="pp-qty">' + esc(qty) + '</span>' : '') + '</button></li>';
  }

  function drawIngs() {
    var list = needs(party), cs = partyCocktails(party);
    var counted = cs.filter(function (c) { return party.counts[c.id]; }).length;
    el('pp-inote').textContent = 'Tick what you already have.' +
      (counted && counted < cs.length ? ' Totals show once every cocktail using an ingredient has a count.' : '');
    el('pp-ings').innerHTML = list.length ? list.map(function (it) {
      return itemRow(it, 'data-pp-have', hasIt(party, it.key), totalText(it, false), usesText(it));
    }).join('') : '<li class="pp-row"><p class="pp-note pp-pad">These cocktails have no ingredients listed.</p></li>';
  }

  // Step 3: shopping list
  function drawShop() {
    var buy = toBuy(party), left = buy.filter(function (it) { return !party.bought[it.key]; }).length;
    el('pp-left').textContent = !buy.length ? 'You have everything.' : left ? left + ' to buy' : 'All bought';
    el('pp-copy').style.visibility = buy.length ? '' : 'hidden';
    el('pp-shop').innerHTML = buy.map(function (it) {
      return itemRow(it, 'data-pp-bought', !!party.bought[it.key], totalText(it, true), '');
    }).join('');
  }

  function shopText() {
    var buy = toBuy(party), left = buy.filter(function (it) { return !party.bought[it.key]; });
    return party.name + '\n' + (left.length ? left : buy).map(function (it) {
      var q = totalText(it, true);
      return '- ' + it.name + (q ? ': ' + q : '');
    }).join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  function flash(btn, text) {
    var was = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', was);
    btn.textContent = text;
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { btn.textContent = was; }, 1600);
  }

  // --- party events ---

  app.addEventListener('submit', function (e) {
    if (e.target.id !== 'pp-new') return;
    e.preventDefault();
    var input = el('pp-name'), name = input.value.trim();
    if (!name) { input.focus(); return; }
    input.blur();
    startParty(name);
  });

  app.addEventListener('input', function (e) {
    var t = e.target;
    if (!party) return;
    if (t.id === 'pp-q') { pickQuery = t.value; drawPickList(); }
    else if (t.hasAttribute('data-pp-count')) {
      t.value = t.value.replace(/\D/g, '');
      setCount(t.getAttribute('data-pp-count'), t.value);
    }
  });

  app.addEventListener('click', function (e) {
    if (!party) return;
    var t = e.target.closest('[data-pp-step], [data-pp-pick], [data-pp-edit], [data-pp-have], [data-pp-bought], [data-pp-inc], [data-pp-dec], [data-pp-act]');
    if (!t) return;
    var v;
    if ((v = t.getAttribute('data-pp-step'))) {
      readDraft();
      party.step = Number(v);
      touch();
      if (party.step !== 1) draft = null;
      drawTabs(); drawBody();
      if (!t.classList.contains('pp-tab')) el('pp-tabs').scrollIntoView({ block: 'start' });
    } else if ((v = t.getAttribute('data-pp-pick'))) {
      readDraft(); togglePick(v);
    } else if ((v = t.getAttribute('data-pp-edit'))) {
      editDraft(v);
    } else if ((v = t.getAttribute('data-pp-have'))) {
      party.have[v] = !hasIt(party, v); touch(); drawIngs(); drawTabs();
    } else if ((v = t.getAttribute('data-pp-bought'))) {
      if (party.bought[v]) delete party.bought[v]; else party.bought[v] = true;
      touch(); drawShop(); drawTabs();
    } else if ((v = t.getAttribute('data-pp-inc'))) {
      setCount(v, (party.counts[v] || 0) + 1);
    } else if ((v = t.getAttribute('data-pp-dec'))) {
      setCount(v, (party.counts[v] || 0) - 1);
    } else {
      var act = t.getAttribute('data-pp-act');
      if (act === 'new') {
        draft = { id: 'x' + Date.now().toString(36), name: pickQuery.trim(), ings: [{ name: '', amount: '', unit: 'oz' }] };
        drawForm(); el('pp-dname').focus();
      } else if (act === 'addrow') {
        readDraft(); draft.ings.push({ name: '', amount: '', unit: 'oz' }); drawForm();
        var rows = document.querySelectorAll('.pp-ingrow [data-f="name"]');
        rows[rows.length - 1].focus();
      } else if (act === 'rmrow') {
        readDraft(); draft.ings.splice(Number(t.getAttribute('data-i')), 1);
        if (!draft.ings.length) draft.ings.push({ name: '', amount: '', unit: 'oz' });
        drawForm();
      } else if (act === 'cancel') {
        draft = null; drawForm();
      } else if (act === 'savedraft') {
        saveDraft();
      } else if (act === 'rmdraft') {
        var id = draft.id;
        party.custom = party.custom.filter(function (c) { return c.id !== id; });
        party.picks = party.picks.filter(function (x) { return x !== id; });
        delete party.counts[id];
        draft = null; touch();
        drawTabs(); drawChips(); drawForm(); drawPickList();
      } else if (act === 'conv') {
        openConversions();
      } else if (act === 'closeconv') {
        el('pp-sheet').innerHTML = '';
      } else if (act === 'copy') {
        copyText(shopText()).then(function () { flash(t, 'Copied'); }, function () { flash(t, 'Couldn’t copy'); });
      } else if (act === 'delete') {
        if (!window.confirm('Delete “' + party.name + '”?')) return;
        deleteParty(party.id);
        party = null;
        goUp('#/parties');
      }
    }
  });

  // ---------- routing & events ----------
  // History mirrors the hierarchy: going into something pushes one step, going back
  // (button or edge swipe) pops one. Forward navigation is refused, so swiping can
  // never jump sideways or past the home screen.

  var idx = 0;              // this screen's position in the history stack
  var shown = '#/';         // hash of the screen currently rendered
  var scrollPos = {};       // list scroll positions, restored on the way back
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  function norm(h) { return !h || h === '#' || h === '#/' ? '#/' : h; }
  function mark(i) { return { bennys: 1, i: i }; }

  function route(restore) {
    current = null;
    party = null;
    planning = false;
    releaseWake();
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var id = parts[1] ? decodeURIComponent(parts[1]) : '';
    if (parts[0] === 'c' && id) renderCocktail(id);
    else if (parts[0] === 'f' && id) renderFolder(id);
    else if (parts[0] === 'all') renderList('All cocktails', data.cocktails.slice().sort(byName), '#/all');
    else if (parts[0] === 'search') renderSearch();
    else if (parts[0] === 'parties') renderParties();
    else if (parts[0] === 'p' && id) renderParty(id, parts[2] === 'f' && parts[3] ? decodeURIComponent(parts[3]) : '');
    else renderHome();
    shown = norm(location.hash);
    window.scrollTo(0, restore ? scrollPos[shown] || 0 : 0);
  }

  function goDown(target) {
    scrollPos[shown] = window.scrollY;
    idx += 1;
    history.pushState(mark(idx), '', target);
    route(false);
  }
  function goUp(fallback) {
    if (idx > 0) { history.back(); return; }
    history.replaceState(mark(0), '', fallback);
    route(false);
  }

  window.addEventListener('popstate', function (e) {
    var i = e.state && e.state.bennys ? e.state.i : null;
    if (i === null) { idx += 1; history.replaceState(mark(idx), '', location.hash || '#/'); route(false); return; }
    if (i > idx) { history.go(idx - i); return; }   // no forward swipes
    if (i === idx) return;
    scrollPos[shown] = window.scrollY;
    idx = i;
    route(true);
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    if (a.hasAttribute('data-up')) goUp(a.getAttribute('href'));
    else goDown(a.getAttribute('href'));
  });

  // Start: home is always the bottom of the stack.
  (function initHistory() {
    if (history.state && history.state.bennys) { idx = history.state.i; return; }
    var start = norm(location.hash);
    history.replaceState(mark(0), '', '#/');
    if (start !== '#/') { idx = 1; history.pushState(mark(1), '', start); }
  })();

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
        data = { favorites: parsed.favorites || [], folders: parsed.folders || [], cocktails: parsed.cocktails || [] };
        dataText = text;
        // Refresh the screen with new recipes, but never yank a recipe out from under you.
        if (!quiet) route();
        else if (!current && !planning) { var y = window.scrollY; route(); window.scrollTo(0, y); }
      })
      .catch(function (err) {
        if (quiet) return;
        app.innerHTML = '<div class="page"><div class="brand"><h1 class="page-title">Benny’s</h1>' + DECO + '</div>' +
          '<p class="empty">Couldn’t load recipes (' + esc(err.message) + '). Check your connection and reopen.</p></div>';
      });
  }

  load(false);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
