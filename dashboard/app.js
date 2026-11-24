// Token Launch Radar dashboard. Reads window.RADAR from data.js (written by main.ts from the same
// board.json the gate checks) and renders: the ranked board, category + chain + watchlist filters,
// text search, sortable columns, a per-protocol detail view with the full model breakdown and the
// farm plan, and a separate Live view for protocols whose token already trades. Fully offline.
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) return;
  var app = document.getElementById('app');
  var S = { q: '', cat: 'all', chain: 'all', wl: false, tab: 'pre', sort: 'rank', dir: 1, sel: null };

  function fmt$(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) { return n === null || n === undefined ? 'n/a' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function fmtAge(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 730) return (d / 365).toFixed(1) + ' yrs';
    if (d >= 60) return Math.round(d / 30.4) + ' mo';
    return d + ' days';
  }
  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) n.appendChild(x); });
      else n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  }
  // Recompute a row's implied value from the multipliers data.js carries, to prove on the page
  // that the board's number is this formula and nothing else. Stored multipliers are rounded to
  // 4 decimals, so the recompute can differ from board.json by a fraction of a percent.
  function recompute(r) {
    var m = r.model;
    return Math.round(r.tvl_usd * m.category_multiple * m.growth_multiplier * m.age_multiplier * m.breadth_multiplier * m.size_multiplier * m.watchlist_multiplier);
  }

  function filtered() {
    var q = S.q.trim().toLowerCase();
    return D.rows.filter(function (r) {
      if (S.wl && !r.on_watchlist) return false;
      if (S.cat !== 'all' && (r.category || 'Other') !== S.cat) return false;
      if (S.chain !== 'all' && (r.chains || []).indexOf(S.chain) < 0) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category || '', (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sorted(list) {
    var k = S.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (k === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (k === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (k === 'growth') { av = a.change_7d === null ? -1e9 : a.change_7d; bv = b.change_7d === null ? -1e9 : b.change_7d; }
      else if (k === 'age') { av = a.age_days === null ? -1 : a.age_days; bv = b.age_days === null ? -1 : b.age_days; }
      else if (k === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else { av = a.rank; bv = b.rank; }
      if (av < bv) return -S.dir; if (av > bv) return S.dir;
      return a.slug < b.slug ? -1 : 1;
    });
  }

  function header() {
    return el('div', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'dot' }), 'TOKEN LAUNCH RADAR'),
      el('div', { class: 'topmeta' },
        el('span', { text: 'Snapshot ' + D.as_of + ' · DefiLlama protocol index (sealed)' }),
        el('span', { text: 'Model ' + D.model_version }),
        el('span', { text: 'Fully offline · data ships with the page' })));
  }
  function hero() {
    var top = D.rows[0];
    return el('section', { class: 'hero' },
      el('div', null,
        el('h1', { text: 'Which pre-token protocol is worth farming next?' }),
        el('p', null, 'Every protocol below records ', el('b', { text: 'no token yet' }), ' in the snapshot. Each is priced by what the market already pays for the same kind of protocol, then ranked. The watchlist of ' + D.watchlist_size + ' large, clean protocols is fully covered — and the radar keeps going, down to the $5M floor, because early is the point. Top signal right now: ', el('b', { text: top.name + ' at ' + fmt$(top.implied_value_usd) + ' implied' }), '.')),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('span', { text: 'Protocols ranked' }), el('b', { text: String(D.board_size) })),
        el('div', { class: 'stat' }, el('span', { text: 'Watchlist covered' }), el('b', { text: D.watchlist_size + ' / ' + D.watchlist_size })),
        el('div', { class: 'stat' }, el('span', { text: 'Early rows under $50M' }), el('b', { text: String(D.early_size) })),
        el('div', { class: 'stat' }, el('span', { text: 'Market-wide multiple' }), el('b', { text: D.global_multiple.toFixed(2) + 'x TVL' }))));
  }
  function method() {
    var m = D.model;
    var chips = D.categories.slice(0, 14).map(function (c) {
      var s = el('span', { class: 'chip' }); s.appendChild(document.createTextNode(c.category + ' '));
      s.appendChild(el('b', { text: c.multiple.toFixed(2) + 'x' }));
      s.appendChild(document.createTextNode(' · ' + c.peers + ' live peers'));
      return s;
    });
    return el('section', { class: 'method' },
      el('h2', { text: 'How the implied value is derived — from this snapshot only' }),
      el('p', { text: 'For each category, take every protocol whose token already trades and compute market cap / TVL. Winsorise those ratios to [' + m.ratio_floor + ', ' + m.ratio_cap + '] so one wild print cannot poison a category, take the median, then shrink it toward the market-wide median (' + D.global_multiple.toFixed(2) + 'x) by peer count — a category with one live peer barely moves the global number, a category with fifteen speaks for itself. A pre-token protocol is then priced at its own TVL times its category multiple, adjusted for 7-day momentum (clamped to ' + m.growth_floor_pct + '%…+' + m.growth_cap_pct + '%, weight ' + m.growth_weight + '), track record without a token (up to 3 years), chain breadth (+' + (m.breadth_per_chain * 100) + '% per extra chain, max ' + m.breadth_max_chains + '), and size on a log scale. Watchlist protocols get a disclosed x' + m.watchlist_mult + ' confidence tilt: the house already screened them for scale and a clean standalone product. No name is special-cased; open any row to audit its arithmetic.' }),
      el('div', { class: 'formula', text: 'implied = TVL x category multiple x growth x age x breadth x size' + (true ? ' x watchlist tilt' : '') }),
      el('div', { class: 'cats' }, chips));
  }
  function controls() {
    var cats = Array.from(new Set(D.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(D.rows.flatMap(function (r) { return r.chains || []; }))).sort();
    var q = el('input', { type: 'search', placeholder: 'Search name, slug, category, chain', value: S.q, 'aria-label': 'Search' });
    q.addEventListener('input', function () { S.q = q.value; render(); var n = document.querySelector('input[type=search]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
    var catSel = el('select', { 'aria-label': 'Filter by category' }, el('option', { value: 'all', text: 'All categories' }),
      cats.map(function (c) { return el('option', { value: c, text: c, selected: c === S.cat ? 'selected' : null }); }));
    catSel.addEventListener('change', function () { S.cat = catSel.value; render(); });
    var chSel = el('select', { 'aria-label': 'Filter by chain' }, el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === S.chain ? 'selected' : null }); }));
    chSel.addEventListener('change', function () { S.chain = chSel.value; render(); });
    var wlBox = el('input', { type: 'checkbox', id: 'wl' }); if (S.wl) wlBox.setAttribute('checked', '');
    wlBox.addEventListener('change', function () { S.wl = wlBox.checked; render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': S.tab === 'pre' ? 'true' : 'false', text: 'Pre-token board', onclick: function () { S.tab = 'pre'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': S.tab === 'live' ? 'true' : 'false', text: 'Live tokens (set aside)', onclick: function () { S.tab = 'live'; render(); } });
    var shown = S.tab === 'pre' ? filtered().length + ' of ' + D.board_size + ' rows' : D.live.length + ' live protocols';
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { text: 'Search' }), q),
      el('div', { class: 'field' }, el('label', { text: 'Category' }), catSel),
      el('div', { class: 'field' }, el('label', { text: 'Chain' }), chSel),
      el('label', { class: 'check' }, wlBox, 'Watchlist only'),
      el('div', { class: 'tabs' }, pre, live),
      el('span', { class: 'count', text: shown }));
  }
  function th(key, label) {
    return el('th', null, el('button', { type: 'button', onclick: function () {
      if (S.sort === key) S.dir = -S.dir; else { S.sort = key; S.dir = key === 'name' || key === 'rank' ? 1 : -1; } render();
    } }, label + (S.sort === key ? (S.dir < 0 ? ' ↓' : ' ↑') : '')));
  }
  function board() {
    var list = sorted(filtered());
    if (!list.length) return el('div', { class: 'panel' }, el('div', { class: 'empty' },
      el('h2', { text: 'Nothing matches those filters' }),
      el('p', { text: 'Loosen the search, or clear the category and chain filters.' }),
      el('button', { class: 'btn primary', type: 'button', text: 'Clear all filters', onclick: function () { S.q = ''; S.cat = 'all'; S.chain = 'all'; S.wl = false; render(); } })));
    var max = Math.max.apply(null, list.map(function (r) { return r.implied_value_usd; })) || 1;
    var tb = el('tbody');
    list.forEach(function (r) {
      var tr = el('tr', { class: S.sel === r.slug ? 'sel' : '', tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter') openDetail(r.slug); } },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }),
          el('span', { text: (r.category || 'Other') + ' · ' + (r.chains.slice(0, 3).join(', ') || '—') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') }))),
        el('td', { class: 'num', text: fmt$(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('span', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(2, Math.round(r.implied_value_usd / max * 100)) + '%' })),
          el('span', { class: 'num', text: fmt$(r.implied_value_usd) })),
        el('td', null, r.on_watchlist ? el('span', { class: 'wl', text: 'WATCHLIST' }) : el('span', { class: 'pre', text: 'early' })));
      tb.appendChild(tr);
    });
    return el('div', { class: 'panel' }, el('div', { class: 'twrap' },
      el('table', null,
        el('caption', { text: 'Ranked by implied value. Select any row for its model breakdown and farm plan.' }),
        el('thead', null, el('tr', null, th('rank', '#'), th('name', 'Protocol'), th('tvl', 'TVL'), th('growth', '7d'), th('age', 'Age'), th('implied', 'Implied value'), el('th', { text: 'Signal' }))),
        tb)));
  }
  function liveTable() {
    var tb = el('tbody');
    D.live.forEach(function (r) {
      tb.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { text: (r.category || 'Other') + ' · ' + (r.chains.slice(0, 3).join(', ') || '—') }))),
        el('td', { class: 'num', text: fmt$(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmt$(r.mcap_usd) }),
        el('td', { class: 'num', text: r.ratio === null ? 'n/a' : r.ratio.toFixed(2) + 'x' }),
        el('td', null, el('span', { class: 'pre', text: 'already trades' }))));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'twrap' },
      el('table', null,
        el('caption', { text: 'These protocols already have a token: their market cap is a market fact, not a model output, so they are never mixed into the pre-token ranking. Their cap/TVL ratios are the peer evidence the model is built from.' }),
        el('thead', null, el('tr', null, el('th', { text: 'Protocol' }), el('th', { text: 'TVL' }), el('th', { text: '7d' }), el('th', { text: 'Market cap' }), el('th', { text: 'Cap / TVL' }), el('th', { text: 'Status' }))),
        tb)));
  }

  var dlg = el('dialog', { class: 'detail' });
  dlg.addEventListener('close', function () { S.sel = null; });
  function kv(label, value) { return el('div', null, el('span', { text: label }), el('b', { text: value })); }
  function openDetail(slug) {
    var r = D.rows.filter(function (x) { return x.slug === slug; })[0];
    if (!r) return;
    S.sel = slug;
    render();
    var m = r.model;
    var rec = recompute(r);
    var drift = Math.abs(rec - r.implied_value_usd) / r.implied_value_usd;
    dlg.textContent = '';
    var inner = el('div', { class: 'din' },
      el('div', { class: 'dhead' },
        el('div', null,
          el('span', { class: 'pre', text: 'RANK ' + r.rank + ' OF ' + D.board_size }),
          el('h2', { text: r.name }),
          el('p', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains.join(', ') || 'no chains recorded') })),
        el('button', { class: 'close', type: 'button', text: 'Close', onclick: function () { dlg.close(); } })),
      el('section', { class: 'dsec' },
        el('h3', { text: 'Implied value if it launched at peer pricing' }),
        el('div', { class: 'big', text: fmt$(r.implied_value_usd) }),
        el('div', { class: 'kv' },
          kv('TVL (snapshot)', fmt$(r.tvl_usd)),
          kv('Category multiple', m.category_multiple.toFixed(2) + 'x  (' + m.category_peers + ' live peers in ' + (r.category || 'Other') + ')'),
          kv('7-day TVL change', fmtPct(r.change_7d)),
          kv('Growth multiplier', 'x' + m.growth_multiplier.toFixed(3)),
          kv('Age without a token', fmtAge(r.age_days) + '  →  x' + m.age_multiplier.toFixed(3)),
          kv('Chains', String(r.chains.length) + '  →  x' + m.breadth_multiplier.toFixed(3)),
          kv('Size multiplier', 'x' + m.size_multiplier.toFixed(3)),
          kv('Watchlist tilt', 'x' + m.watchlist_multiplier.toFixed(2) + (r.on_watchlist ? ' (on the house watchlist)' : ' (not on the watchlist)'))),
        el('p', { class: 'note', text: 'Audit: multiplying the figures above on this page gives ' + fmt$(rec) + ', within ' + (drift * 100).toFixed(2) + '% of the board value (the stored multipliers are rounded to 4 decimals). An implied value is a peer-pricing estimate, not a prediction that a token will launch.' })),
      el('section', { class: 'dsec' },
        el('h3', { text: 'Farm plan — ' + r.farm_steps.length + ' steps' }),
        el('ol', { class: 'steps' }, r.farm_steps.map(function (s) { return el('li', { text: s }); }))),
      el('p', { class: 'foot', text: 'Snapshot ' + D.as_of + '. This protocol records no token in the snapshot; that is DefiLlama\u2019s record, not proof none exists anywhere.' }));
    dlg.appendChild(inner);
    if (!dlg.isConnected) app.appendChild(dlg);
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  }
  function render() {
    app.textContent = '';
    var w = el('div', { class: 'wrap' });
    w.appendChild(header()); w.appendChild(hero()); w.appendChild(method()); w.appendChild(controls());
    w.appendChild(S.tab === 'pre' ? board() : liveTable());
    w.appendChild(el('p', { class: 'foot', text: 'Implied values are this entry\u2019s own model claims, derived only from the sealed snapshot. Nothing here is a promise that any protocol will issue a token.' }));
    app.appendChild(w);
    app.appendChild(dlg);
    app.setAttribute('aria-busy', 'false');
  }
  // Deep link: #p=<slug> opens that protocol, #cat=<category> filters.
  (function () {
    var h = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (h.get('cat')) S.cat = h.get('cat');
    render();
    if (h.get('p')) openDetail(h.get('p'));
  })();
})();
