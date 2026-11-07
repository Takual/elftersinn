/* ELFTER SINN – lädt data/aktuell.json und data/archiv.json und baut die Seite.
   Die Inhalte kommen ausschließlich aus den JSON-Dateien; fehlende Werte werden als „–“ gezeigt. */
(function () {
  'use strict';

  // Vereinsfarben (Kreise mit Kürzel, keine Logos)
  var COLORS = {
    FCB: ['#DC052D', '#FFFFFF'], BVB: ['#FDE100', '#111111'], SCF: ['#1A1A1A', '#FFFFFF'], RBL: ['#DD0741', '#FFFFFF'],
    SVW: ['#1D9053', '#FFFFFF'], B04: ['#E32221', '#FFFFFF'], SVE: ['#2B2B2B', '#FFFFFF'], SGE: ['#111111', '#FFFFFF'],
    M05: ['#C3141E', '#FFFFFF'], FCA: ['#BA3733', '#FFFFFF'], VFB: ['#FFFFFF', '#E32219'], TSG: ['#1961B5', '#FFFFFF'],
    KOE: ['#ED1C24', '#FFFFFF'], SCP: ['#005CA9', '#FFFFFF'], HSV: ['#0A3F86', '#FFFFFF'], FCU: ['#EB1923', '#FFFFFF'],
    S04: ['#004D9D', '#FFFFFF'], BMG: ['#FFFFFF', '#111111']
  };
  var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var STATUS = { stronger: 'Formkurve steigt', weaker: 'Formkurve fällt', stable: 'Stabil' };
  var RISK = { low: 'niedrig', medium: 'mittel', high: 'hoch' };

  // ---------- Helfer ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function svg(markup) { var t = document.createElement('template'); t.innerHTML = markup.trim(); return t.content.firstChild; }
  function num(v, d) { return v == null ? '–' : Number(v).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function pct(v, d) { return v == null ? '–' : num(v, d == null ? 1 : d) + ' %'; }
  function eur(v) { return v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v), 2) + ' €'; }
  function sign(v) { return v == null ? '' : v < 0 ? 'neg' : v > 0 ? 'pos' : ''; }
  function dayLabel(iso) {
    if (!iso) return '–';
    var p = iso.split('-'), dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return WD[dt.getDay()] + ', ' + p[2] + '.' + p[1] + '.';
  }
  function stamp(iso) {
    if (!iso) return '';
    var dt = new Date(iso);
    return WD[dt.getDay()] + ', ' + dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' · ' + dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  function crest(code, large, label) {
    var c = COLORS[code] || ['#1C2F2A', '#EEF4F2'];
    return h('span', { class: 'crest' + (large ? ' lg' : ''), style: 'background:' + c[0] + ';color:' + c[1], title: label || null }, code || '?');
  }
  function favOf(m) {
    if (!m || m.p1 == null) return null;
    var best = [['1', m.p1], ['X', m.px], ['2', m.p2]].sort(function (a, b) { return b[1] - a[1]; })[0];
    return { side: best[0], p: best[1] };
  }
  function icon(path, color, size) {
    return svg('<svg width="' + (size || 30) + '" height="' + (size || 30) + '" viewBox="0 0 24 24" fill="none" stroke="' + (color || '#EEF4F2') +
      '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>');
  }
  var I = {
    bars: '<path d="M5 20v-6M10 20V9M15 20v-9M20 20V5"/>',
    cup: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
    trend: '<path d="M3 7l6 6 4-4 8 8M21 11v6h-6"/>',
    trendUp: '<path d="M3 17l6-6 4 4 8-8M21 13V7h-6"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    target: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    brain: '<path d="M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5v1a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM15 3a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5 3 3 0 0 1-2 5v1a3 3 0 0 1-6 0"/>',
    pitch: '<rect x="2" y="5" width="20" height="14" rx="1"/><path d="M12 5v14M2 9h3v6H2M22 9h-3v6h3"/><circle cx="12" cy="12" r="2.5"/>',
    news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2V5zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5"/>',
    table: '<path d="M4 6h16M4 12h16M4 18h16"/>'
  };

  // ---------- Bausteine ----------
  function renderTicker(a) {
    var t = document.getElementById('ticker');
    (a.current.ticker || []).slice(0, 5).forEach(function (x, i) {
      if (i) t.appendChild(h('span', { class: 'sep more', 'aria-hidden': 'true' }, '|'));
      t.appendChild(h('span', { class: i ? 'more' : null }, x));
    });
    document.getElementById('stand').textContent = 'Stand: ' + stamp(a.updated_at);
  }

  function kpi(ic, color, val, lbl, cls) {
    return h('div', { class: 'panel kpi' }, icon(ic, color, 40),
      h('div', null, h('div', { class: 'kpi-val ' + (cls || '') }, val), h('div', { class: 'kpi-lbl' }, lbl)));
  }

  function renderKpis(a) {
    var s = a.summary, k = s.kicktipp || {};
    var roiLive = s.roi_pct, roiAll = s.incl_backfill && s.incl_backfill.roi_pct;
    return h('section', { class: 'kpis', 'aria-label': 'Saisonbilanz' },
      kpi(I.bars, '#22E3A2', pct(s.tendency_accuracy_pct), 'Tendenztreffer (diese Saison)'),
      kpi(I.cup, '#E9C24A', k.rank != null ? 'Platz ' + k.rank : '–',
        'in unserem Kicktipp' + (k.as_of_date ? ' (Stand ' + dayLabel(k.as_of_date).slice(4) + ')' : k.as_of_matchday ? ' (Stand Spieltag ' + k.as_of_matchday + ')' : '')),
      kpi((roiAll != null ? roiAll : roiLive) < 0 ? I.trend : I.trendUp, (roiAll != null ? roiAll : roiLive) < 0 ? '#FF9A62' : '#22E3A2',
        pct(roiAll != null ? roiAll : roiLive), 'Virtuelle Rendite (5 € pro Tipp)', sign(roiAll != null ? roiAll : roiLive)),
      kpi(I.ball, '#22E3A2', num(s.matches_analyzed), 'Spiele analysiert')
    );
  }

  function tipCell(m) {
    if (!m.tip || !m.tip.score) return h('td', { class: 'c' }, h('span', { class: 'tip none' }, '–:–'), h('span', { class: 'tip-state' }, 'folgt'));
    return h('td', { class: 'c' },
      h('span', { class: 'tip' + (m.tip.final ? '' : ' pre') }, m.tip.score.replace(':', ':')),
      h('span', { class: 'tip-state' + (m.tip.final ? ' final' : '') }, m.tip.final ? 'eingefroren' : 'vorläufig'));
  }

  function resultCell(m) {
    var r = m.result || {};
    if (!r.score) {
      var f = favOf(m.market);
      return h('td', { class: 'r' }, f ? h('span', { class: 'mkt', title: 'Marktwahrscheinlichkeit des Favoriten' }, f.side + ' · ' + num(f.p, 0) + ' %') : '–');
    }
    var cls = r.exact_hit ? 'exact' : r.tendency_hit ? 'yes' : 'no';
    var lbl = r.exact_hit ? 'exakt' : r.tendency_hit ? 'Tendenz' : 'daneben';
    return h('td', { class: 'r' }, h('span', { class: 'res' }, r.score), ' ', h('span', { class: 'hit ' + cls }, lbl));
  }

  function detailBox(m) {
    var list = function (t, arr) { return arr && arr.length ? h('div', null, h('h4', null, t), h('ul', null, arr.map(function (x) { return h('li', null, x); }))) : null; };
    var para = function (t, v) { return v ? h('div', null, h('h4', null, t), h('p', null, v)) : null; };
    var b = m.bet || {};
    return h('div', { class: 'detail-box' },
      h('div', { class: 'legend' },
        h('strong', null, m.home + ' – ' + m.away),
        m.risk ? h('span', null, h('i', { class: 'risk ' + m.risk }), 'Risiko ' + (RISK[m.risk] || m.risk)) : null,
        m.risk_tip ? h('span', { class: 'hit no' }, 'Risikotipp') : null,
        m.market && m.market.p1 != null ? h('span', null, 'Markt: 1 ' + num(m.market.p1, 0) + ' % · X ' + num(m.market.px, 0) + ' % · 2 ' + num(m.market.p2, 0) + ' %') : null,
        b.odds ? h('span', null, 'Wettquote ' + num(b.odds, 2)) : null,
        b.profit_loss != null ? h('span', { class: sign(b.profit_loss) }, '5-€-Simulation ' + eur(b.profit_loss)) : null
      ),
      m.short ? h('p', null, m.short) : null,
      h('div', { class: 'detail-grid' },
        list('Dafür spricht', m.main_arguments),
        list('Dagegen spricht', m.counter_arguments)),
      h('div', { class: 'detail-grid' },
        para('Entscheidender Faktor', m.decisive_factor),
        para('Warum genau dieses Ergebnis?', m.why_this_score),
        m.alternative_score ? para('Alternativergebnis', m.alternative_score) : null,
        para('Warum gegen den Markt?', m.reason_against_market)),
      m.post_analysis ? para('Nachanalyse: ' + (m.post_analysis.error_class || ''), m.post_analysis.note) : null
    );
  }

  function renderSpieltag(a) {
    var c = a.current;
    var range = (c.date_range || '').split('–');
    var tbody = h('tbody');
    (c.matches || []).forEach(function (m) {
      var detail = h('tr', { class: 'detail', hidden: 'hidden' }, h('td', { colspan: '6' }, detailBox(m)));
      var row = h('tr', {
        class: 'row', tabindex: '0', 'aria-expanded': 'false',
        onclick: toggle, onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }
      },
        h('td', { class: 'date' }, dayLabel(m.date), h('span', { class: 'tip-state' }, (m.kickoff || '') + ' Uhr')),
        h('td', { class: 'c' }, crest(m.home_code, false, m.home)),
        h('td', { class: 'c' }, crest(m.away_code, false, m.away)),
        tipCell(m),
        resultCell(m),
        h('td', { class: 'c' }, m.risk ? h('i', { class: 'risk ' + m.risk, title: 'Risiko ' + (RISK[m.risk] || m.risk) }) : null));
      function toggle() {
        var open = detail.hidden;
        detail.hidden = !open; row.classList.toggle('open', open); row.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      tbody.appendChild(row); tbody.appendChild(detail);
    });
    var hasResults = (c.matches || []).some(function (m) { return m.result && m.result.score; });
    return h('div', { class: 'panel col-spieltag', id: 'spieltag' },
      h('div', { class: 'panel-head' },
        h('div', { class: 'panel-title' }, icon(I.cal),
          h('div', null, h('h2', null, 'Aktueller Spieltag'),
            h('div', { class: 'sub' }, c.matchday + '. Spieltag · ' + dayLabel(range[0]).slice(4) + ' – ' + dayLabel(range[1] || range[0]).slice(4))))),
      h('div', { class: 'scroll' }, h('table', { class: 'matches' },
        h('thead', null, h('tr', null,
          h('th', { class: 'l', scope: 'col' }, 'Datum'), h('th', { class: 'c', scope: 'col' }, 'Heim'),
          h('th', { class: 'c', scope: 'col' }, 'Auswärts'), h('th', { class: 'c', scope: 'col' }, 'Tipp'),
          h('th', { class: 'r', scope: 'col' }, hasResults ? 'Ergebnis / Markt' : 'Markt'),
          h('th', { class: 'c', scope: 'col' }, h('span', { class: 'sr-only' }, 'Risiko'), '●'))),
        tbody)),
      h('div', { class: 'legend' },
        h('span', null, h('i', { class: 'risk low' }), 'Risiko niedrig'), h('span', null, h('i', { class: 'risk medium' }), 'mittel'),
        h('span', null, h('i', { class: 'risk high' }), 'hoch')),
      h('p', { class: 'note' }, 'Zeile antippen für die Begründung. „Markt“ = margenbereinigte Wahrscheinlichkeit des Favoriten. Vorläufige Tipps werden 60–90 Minuten vor Anpfiff eingefroren und danach nie mehr geändert.')
    );
  }

  function renderTeams(a) {
    var byName = {};
    (a.teams || []).forEach(function (t) { byName[t.team] = t; });
    var ranks = {};
    (a.current.table || []).forEach(function (r) { ranks[r.code] = r; });
    var list = (a.current.team_analyses || []).map(function (t) {
      var info = byName[t.team] || {};
      return { name: t.team, code: info.code, form: info.form || [], record: info.tip_record, status: t.status, text: t.assessment, cons: t.consequence, updated: t.updated_at };
    }).filter(function (t) { return t.code; });
    list.sort(function (x, y) { return ((ranks[x.code] || {}).rank || 99) - ((ranks[y.code] || {}).rank || 99); });

    var card = h('div', { class: 'team-card', 'aria-live': 'polite' });
    var picker = h('div', { class: 'picker', role: 'group', 'aria-label': 'Team auswählen' });
    function show(t) {
      Array.prototype.forEach.call(picker.children, function (b) { b.setAttribute('aria-pressed', b.dataset.code === t.code ? 'true' : 'false'); });
      var r = ranks[t.code] || {};
      card.textContent = '';
      add(card, [
        h('div', { class: 'team-head' }, h('h3', null, t.name),
          h('span', { class: 'status ' + (t.status || 'stable') }, STATUS[t.status] || 'Stabil'),
          r.rank ? h('span', { class: 'sub' }, 'Platz ' + r.rank + ' · ' + r.points + ' Pkt.') : null),
        t.form.length ? h('div', { class: 'form', 'aria-label': 'Formkurve, letzte ' + t.form.length + ' Spiele' },
          h('span', { class: 'sub' }, 'Form:'),
          t.form.map(function (f) { return h('b', { class: f, title: f === 'W' ? 'Sieg' : f === 'D' ? 'Remis' : 'Niederlage' }, f === 'W' ? 'S' : f === 'D' ? 'U' : 'N'); })) : null,
        h('p', null, t.text || '–'),
        h('div', { class: 'cons' }, h('div', { class: 'kicker' }, 'Konsequenz für die Tipps'), h('p', { style: 'margin-top:4px' }, t.cons || '–')),
        t.record ? h('p', { class: 'note' }, 'Unsere Tipps auf dieses Team: ' + t.record.tendency_hits + ' von ' + t.record.matches_tipped + ' Tendenzen richtig, ' + t.record.exact_hits + ' exakt.') : null
      ]);
    }
    list.forEach(function (t) {
      var c = COLORS[t.code] || ['#1C2F2A', '#EEF4F2'];
      picker.appendChild(h('button', {
        type: 'button', class: 'crest lg', 'data-code': t.code, 'aria-pressed': 'false', 'aria-label': t.name,
        style: 'background:' + c[0] + ';color:' + c[1], onclick: function () { show(t); }
      }, t.code));
    });
    if (list.length) show(list[0]);
    return h('div', { class: 'panel col-teams', id: 'teams' },
      h('div', { class: 'panel-title' }, icon(I.bars, '#22E3A2'),
        h('div', null, h('h2', null, 'Team-Analysen'), h('div', { class: 'sub' }, 'Form. Daten. KI-Einschätzungen.'))),
      picker, card,
      h('p', { class: 'note' }, 'Stand Lagebericht ' + (list[0] && list[0].updated ? dayLabel(list[0].updated) : '') + ' · Quellen unter „Meldungen“'));
  }

  function renderMarkt(a) {
    var seg = a.summary.by_favorite_probability || {};
    var defs = [['<45', 'Fav. < 45 %', 33.3, 45], ['45-55', '45–55 %', 45, 55], ['55-70', '55–70 %', 55, 70], ['>=70', 'ab 70 %', 70, 90]];
    var y = function (v) { return 170 - v * 1.5; };
    var parts = '';
    defs.forEach(function (d, i) {
      var s = seg[d[0]]; if (!s) return;
      var cx = 38 + 36.5 + i * 73, hit = s.accuracy_pct;
      var col = hit > d[3] ? '#22E3A2' : hit < d[2] ? '#FF8A4C' : '#CFE3DC';
      parts += '<rect x="' + (cx - 22) + '" y="' + y(d[3]) + '" width="44" height="' + (d[3] - d[2]) * 1.5 + '" rx="3" fill="#2A4A42"/>' +
        '<circle cx="' + cx + '" cy="' + y(hit) + '" r="7" fill="' + col + '" stroke="#06100E" stroke-width="2"/>' +
        '<text x="' + cx + '" y="' + (y(hit) - 12) + '" text-anchor="middle" fill="#EEF4F2" font-size="12" font-weight="600">' + num(hit, 1) + ' %</text>' +
        '<text x="' + cx + '" y="190" text-anchor="middle" fill="#B9CCC6" font-size="11">' + d[1] + '</text>' +
        '<text x="' + cx + '" y="204" text-anchor="middle" fill="#8DA59E" font-size="10">' + s.tips + ' Tipps</text>';
    });
    var grid = [100, 75, 50, 25, 0].map(function (v) {
      return '<line x1="38" y1="' + y(v) + '" x2="330" y2="' + y(v) + '" stroke="#1B2E29"/><text x="30" y="' + (y(v) + 4) + '" text-anchor="end" fill="#8DA59E" font-size="11">' + v + ' %</text>';
    }).join('');
    var label = defs.map(function (d) { var s = seg[d[0]]; return s ? d[1] + ': ' + num(s.accuracy_pct, 1) + ' Prozent' : ''; }).join(', ');
    var chart = svg('<svg viewBox="-12 0 352 210" role="img" aria-label="Trefferquote nach Marktwahrscheinlichkeit des Favoriten: ' + label +
      '" style="width:100%;height:auto;display:block;font-family:Inter,sans-serif">' + grid + parts + '</svg>');
    return h('div', { class: 'panel', id: 'markt', style: 'display:flex;flex-direction:column;gap:12px' },
      h('div', { class: 'panel-title' }, icon(I.target),
        h('div', null, h('h2', null, 'KI vs. Markt'), h('div', { class: 'sub' }, 'Unsere Trefferquote je nach Stärke des Marktfavoriten'))),
      chart,
      h('div', { class: 'legend' },
        h('span', null, h('i', { style: 'width:14px;height:10px;background:#2A4A42;border-radius:2px;display:inline-block' }), 'Markt erwartet (Spanne)'),
        h('span', null, h('i', { class: 'risk low' }), 'über Markt'),
        h('span', null, h('i', { class: 'risk high' }), 'unter Markt')));
  }

  function renderInsights(a) {
    var cols = ['#FF8A4C', '#E9C24A', '#22E3A2', '#7FD3F0', '#CFE3DC'];
    return h('div', { class: 'panel', style: 'display:flex;flex-direction:column;gap:12px;flex-grow:1' },
      h('div', { class: 'panel-title' }, icon(I.bulb), h('h2', null, 'Insights der Woche')),
      (a.current.weekly_insights || []).map(function (t, i) {
        return h('div', { class: 'insight' }, h('i', { style: 'background:' + cols[i % cols.length] }), h('span', null, t));
      }));
  }

  function renderBilanz(a) {
    var s = a.summary, pm = s.per_matchday || [];
    var max = Math.max.apply(null, pm.map(function (d) { return Math.abs(d.profit_loss_eur || 0); }).concat([1]));
    var bars = h('div', { class: 'bars', style: 'grid-template-columns:repeat(' + Math.max(pm.length, 1) + ',minmax(0,1fr))' });
    pm.forEach(function (d) {
      var v = d.profit_loss_eur || 0, px = Math.round(Math.abs(v) / max * 60) + 'px';
      bars.appendChild(h('div', { class: 'bar', title: 'Spieltag ' + d.matchday + ': ' + eur(v) + ' (Einsatz ' + num(d.stake_eur) + ' €)' },
        h('span', { class: 'lbl' }, v > 0 ? eur(v) : ''),
        h('div', { class: 'half up' }, h('span', { style: 'height:' + (v > 0 ? px : '0') })),
        h('div', { class: 'axis' }),
        h('div', { class: 'half down' }, h('span', { style: 'height:' + (v < 0 ? px : '0') })),
        h('span', { class: 'lbl' }, v < 0 ? eur(v) : ''),
        h('span', { class: 'md' }, 'ST ' + d.matchday)));
    });
    var ib = s.incl_backfill || {};
    return h('section', { class: 'panel bilanz', id: 'bilanz' },
      h('div', { class: 'bilanz-text' },
        h('h2', null, '5-€-Simulation pro Spieltag'),
        h('p', null, '5 € auf jede getippte Tendenz, Quote 60–90 Minuten vor Anpfiff.'),
        h('p', null, 'Nur Live-Quoten: ', h('b', { class: sign(s.profit_loss) }, eur(s.profit_loss)), ' bei ' + num(s.stake_total) + ' € Einsatz (ROI ' + pct(s.roi_pct) + ').'),
        ib.profit_loss_eur != null ? h('p', null, 'Inkl. ' + ib.backfilled_bets + ' nachgetragener Schlussquoten: ', h('b', { class: sign(ib.profit_loss_eur) }, eur(ib.profit_loss_eur)), ' (ROI ' + pct(ib.roi_pct) + ').') : null,
        h('p', { class: 'note' }, 'Exakte Treffer: ' + num(s.exact_hits) + ' · Remis-Tipps: ' + num(s.draw_tips_hit) + ' von ' + num(s.draw_tips) + ' richtig · Risikotipps: ' +
          num((s.risk_tips || {}).tendency_hits) + ' von ' + num((s.risk_tips || {}).tips))),
      bars);
  }

  function renderTabelleNews(a) {
    var tb = h('tbody');
    (a.current.table || []).forEach(function (r) {
      tb.appendChild(h('tr', null,
        h('td', { class: 'r' }, r.rank),
        h('td', { class: 'team' }, h('span', null, crest(r.code), r.team)),
        h('td', { class: 'r' }, r.played),
        h('td', { class: 'r' }, r.won + '-' + r.drawn + '-' + r.lost),
        h('td', { class: 'r' }, r.goals_for + ':' + r.goals_against),
        h('td', { class: 'r pts' }, r.points)));
    });
    var news = h('div', { class: 'news' });
    (a.current.news || []).forEach(function (n) {
      var src = null;
      if (n.source && /^https?:\/\//.test(n.source.split(' ')[0])) {
        var u = n.source.split(' ')[0];
        src = h('a', { href: u, target: '_blank', rel: 'noopener nofollow' }, 'Quelle: ' + u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]);
      }
      news.appendChild(h('div', { class: 'news-item' },
        h('time', null, n.date ? dayLabel(n.date).slice(4) : '–'),
        h('span', { class: 't' }, n.team),
        h('p', null, n.message), src));
    });
    return h('section', { class: 'split' },
      h('div', { class: 'panel', id: 'tabelle', style: 'display:flex;flex-direction:column;gap:12px' },
        h('div', { class: 'panel-title' }, icon(I.table), h('h2', null, 'Tabelle')),
        h('div', { class: 'scroll' }, h('table', { class: 'league' },
          h('thead', null, h('tr', null, h('th', { class: 'r', scope: 'col' }, '#'), h('th', { class: 'l', scope: 'col' }, 'Team'),
            h('th', { class: 'r', scope: 'col' }, 'Sp'), h('th', { class: 'r', scope: 'col' }, 'S-U-N'),
            h('th', { class: 'r', scope: 'col' }, 'Tore'), h('th', { class: 'r', scope: 'col' }, 'Pkt'))), tb)),
        h('p', { class: 'note' }, a.current.table_note || '')),
      h('div', { class: 'panel', id: 'meldungen', style: 'display:flex;flex-direction:column;gap:12px' },
        h('div', { class: 'panel-title' }, icon(I.news), h('div', null, h('h2', null, 'Meldungen'), h('div', { class: 'sub' }, 'Prognoserelevante Nachrichten mit Quelle'))),
        news));
  }

  function renderArchiv(ar) {
    var box = h('div', { class: 'archive' });
    (ar.matchdays || []).forEach(function (md) {
      var ms = md.matches || [];
      var hits = ms.filter(function (m) { return m.result && m.result.tendency_hit; }).length;
      var exact = ms.filter(function (m) { return m.result && m.result.exact_hit; }).length;
      var pl = ms.reduce(function (s, m) { return s + ((m.bet && m.bet.profit_loss) || 0); }, 0);
      var withBet = ms.some(function (m) { return m.bet && m.bet.profit_loss != null; });
      var tb = h('tbody');
      ms.forEach(function (m) {
        var r = m.result || {};
        var cls = r.exact_hit ? 'exact' : r.tendency_hit ? 'yes' : 'no';
        tb.appendChild(h('tr', null,
          h('td', { class: 'date' }, dayLabel(m.date)),
          h('td', { class: 'c' }, crest(m.home_code, false, m.home)),
          h('td', { class: 'c' }, crest(m.away_code, false, m.away)),
          h('td', { class: 'c' }, h('span', { class: 'tip' }, (m.tip && m.tip.score) || '–')),
          h('td', { class: 'c' }, h('span', { class: 'res' }, r.score || '–')),
          h('td', { class: 'r' }, r.score ? h('span', { class: 'hit ' + cls }, r.exact_hit ? 'exakt' : r.tendency_hit ? 'Tendenz' : 'daneben') : null),
          h('td', { class: 'r ' + sign(m.bet && m.bet.profit_loss) }, m.bet && m.bet.profit_loss != null ? eur(m.bet.profit_loss) : '–')));
        if (m.post_analysis && m.post_analysis.error_class) {
          tb.appendChild(h('tr', { class: 'detail' }, h('td', { colspan: '7' },
            h('p', { class: 'note', style: 'padding:0 4px 6px' }, 'Nachanalyse: ' + m.post_analysis.error_class + (m.post_analysis.note ? ' – ' + m.post_analysis.note : '')))));
        }
      });
      box.appendChild(h('details', null,
        h('summary', null, h('b', null, 'Spieltag ' + md.matchday),
          h('span', { class: 'sub' }, hits + '/' + ms.length + ' Tendenzen · ' + exact + ' exakt'),
          withBet ? h('span', { class: sign(pl) }, eur(pl)) : null,
          h('span', { class: 'chev', 'aria-hidden': 'true' }, '▾')),
        h('div', { class: 'inner' },
          h('div', { class: 'scroll' }, h('table', { class: 'matches' },
            h('thead', null, h('tr', null, h('th', { class: 'l' }, 'Datum'), h('th', { class: 'c' }, 'Heim'), h('th', { class: 'c' }, 'Auswärts'),
              h('th', { class: 'c' }, 'Tipp'), h('th', { class: 'c' }, 'Ergebnis'), h('th', { class: 'r' }, 'Treffer'), h('th', { class: 'r' }, '5 €'))), tb)),
          md.learnings && md.learnings.length ? h('div', null, h('div', { class: 'kicker' }, 'Was wir gelernt haben'),
            h('ul', { class: 'learn' }, md.learnings.map(function (l) { return h('li', null, l); }))) : null)));
    });
    return h('section', { id: 'archiv' }, h('h2', { class: 'section-title' }, 'Archiv'), box);
  }

  function renderMethode() {
    var m = function (ic, k, t) { return h('div', { class: 'panel' }, icon(ic, '#22E3A2', 34), h('div', null, h('div', { class: 'k' }, k), h('p', null, t))); };
    return h('section', { id: 'methode' },
      h('h2', { class: 'section-title' }, 'Methodik'),
      h('div', { class: 'method' },
        m(I.bars, 'DATEN · ANALYSEN', 'Form, Ausfälle, Belastung durch Europapokal und Pokal – zweimal pro Woche für alle 18 Teams, jede Meldung mit Quelle.'),
        m(I.brain, 'PROGNOSEN · INSIGHTS', 'Erst die sportliche Analyse, dann der Markt (margenbereinigt), dann das exakte Ergebnis – mit Begründung. Gegen klare Favoriten nur mit starkem Grund.'),
        m(I.pitch, 'FUSSBALL MIT ANDEREN AUGEN', 'Nach jedem Spieltag ehrlich ausgewertet: Warum lagen wir richtig oder falsch? Eingefrorene Tipps werden nie nachträglich geändert.')));
  }

  // ---------- Start ----------
  function load(url) {
    return fetch(url + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.json();
    });
  }

  Promise.all([load('data/aktuell.json'), load('data/archiv.json').catch(function () { return { matchdays: [] }; })])
    .then(function (res) {
      var a = res[0], ar = res[1], app = document.getElementById('app');
      app.textContent = '';
      renderTicker(a);
      add(app, [
        renderKpis(a),
        h('section', { class: 'cols' }, renderSpieltag(a), renderTeams(a),
          h('div', { class: 'col-right' }, renderMarkt(a), renderInsights(a))),
        renderBilanz(a),
        renderTabelleNews(a),
        renderArchiv(ar),
        renderMethode()
      ]);
    })
    .catch(function (e) {
      var app = document.getElementById('app');
      app.textContent = '';
      app.appendChild(h('p', { class: 'error' }, 'Die Daten konnten gerade nicht geladen werden. Bitte später noch einmal versuchen.'));
      if (window.console) console.error(e);
    });
})();
