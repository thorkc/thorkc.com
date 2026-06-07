/* ============================================================
   MCP SYSTEM MONITOR — Site Health & Operator Console
   ThorKC.com Master Control Program | mcp-system.js v1.0.0

   Manages the System Mode panel: loads _admin/status.json,
   renders health tiles for every section, drives the topbar
   clock, handles nav switching, and wires the boot sequence
   dismiss into the full app shell reveal.
   ============================================================ */

(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────── */
  var STATUS_URL    = '/_admin/status.json';
  var REFRESH_MS    = 60000; // auto-refresh every 60 s
  var CLOCK_TICK_MS = 1000;

  /* ── State ─────────────────────────────────────────────── */
  var refreshTimer = null;
  var clockTimer   = null;
  var lastStatus   = null;

  /* ── Section display config ────────────────────────────── */
  var SECTIONS = [
    { key: 'journal',    label: 'Journal',      icon: '✦' },
    { key: 'assets',     label: 'Assets / CDN', icon: '◈' },
    { key: 'thorkcade',  label: 'ThorKCade',    icon: '◉' },
    { key: 'pfc',        label: 'PFC',          icon: '◆' },
    { key: 'mcp',        label: 'MCP',          icon: '⬡' },
    { key: 'deployment', label: 'Deployment',   icon: '▲' }
  ];

  /* ── Init (called by boot sequence after reveal) ───────── */
  function init () {
    buildNav();
    buildSystemPanel();
    buildDeployPanel();
    startClock();
    // Show launcher panel by default
    activatePanel('launcher');
    // Kick off first status load for system panel
    loadStatus();
    // Schedule auto-refresh
    refreshTimer = setInterval(loadStatus, REFRESH_MS);
  }

  /* ── Navigation ────────────────────────────────────────── */
  function buildNav () {
    var nav = document.getElementById('mcp-nav');
    if (!nav) return;

    var items = [
      { panel: 'launcher', label: 'Launcher',      icon: '▶' },
      { panel: 'system',   label: 'System Monitor', icon: '◈' },
      { panel: 'deploy',   label: 'Deploy Engine',  icon: '▲' }
    ];

    nav.innerHTML = '';

    var sectionLabel = document.createElement('div');
    sectionLabel.className   = 'mcp-nav-section-label';
    sectionLabel.textContent = 'Operator';
    nav.appendChild(sectionLabel);

    items.forEach(function (item) {
      var el = document.createElement('div');
      el.className      = 'mcp-nav-item';
      el.dataset.panel  = item.panel;
      el.innerHTML      =
        '<span class="mcp-nav-icon">' + item.icon + '</span>' + item.label;
      el.addEventListener('click', function () { activatePanel(item.panel); });
      nav.appendChild(el);
    });

    var divider = document.createElement('div');
    divider.className = 'mcp-nav-divider';
    nav.appendChild(divider);

    var metaLabel = document.createElement('div');
    metaLabel.className   = 'mcp-nav-section-label';
    metaLabel.textContent = 'Site';
    nav.appendChild(metaLabel);

    ['Journal', 'ThorKCade', 'PFC'].forEach(function (name) {
      var link = document.createElement('a');
      link.className   = 'mcp-nav-item';
      link.href        = '/' + name.toLowerCase() + '/';
      link.target      = '_blank';
      link.rel         = 'noopener';
      link.innerHTML   = '<span class="mcp-nav-icon">↗</span>' + name;
      nav.appendChild(link);
    });
  }

  function activatePanel (id) {
    document.querySelectorAll('.mcp-panel').forEach(function (p) {
      p.classList.remove('active');
    });
    document.querySelectorAll('.mcp-nav-item').forEach(function (n) {
      n.classList.toggle('active', n.dataset.panel === id);
    });
    var target = document.getElementById('panel-' + id);
    if (target) {
      target.classList.add('active');
      target.classList.add('mcp-fadein');
      // Remove animation class after it completes so it can replay
      setTimeout(function () { target.classList.remove('mcp-fadein'); }, 400);
    }
    // Lazy-init launcher panel if needed
    if (id === 'launcher' && window.MCPPanels && window.MCPPanels.launcher) {
      window.MCPPanels.launcher.init();
    }
  }

  /* ── System Panel Build ────────────────────────────────── */
  function buildSystemPanel () {
    var panel = document.getElementById('panel-system');
    if (!panel) return;

    panel.innerHTML =
      '<p class="mcp-panel-title">System Monitor</p>' +
      '<p class="mcp-panel-subtitle">Live site health pulled from _admin/status.json.</p>' +

      '<div class="system-controls">' +
        '<button class="mcp-btn" id="sys-refresh-btn">↻ Refresh</button>' +
        '<span class="system-last-updated" id="sys-last-updated">—</span>' +
      '</div>' +

      '<div class="system-health-bar" id="sys-health-bar"></div>' +

      '<div class="mcp-section-label">Detail</div>' +
      '<div id="sys-detail"></div>' +

      '<div class="mcp-section-label">Raw</div>' +
      '<div class="mcp-console" id="sys-raw" style="max-height:200px">// Loading…</div>';

    document.getElementById('sys-refresh-btn')
      .addEventListener('click', loadStatus);
  }

  /* ── Status Load & Render ──────────────────────────────── */
  function loadStatus () {
    var btn = document.getElementById('sys-refresh-btn');
    if (btn) btn.disabled = true;

    fetch(STATUS_URL + '?_=' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        lastStatus = data;
        renderStatus(data);
        if (btn) btn.disabled = false;
      })
      .catch(function (err) {
        renderStatusError(err.message);
        if (btn) btn.disabled = false;
      });
  }

  function renderStatus (data) {
    var bar    = document.getElementById('sys-health-bar');
    var detail = document.getElementById('sys-detail');
    var raw    = document.getElementById('sys-raw');
    var ts     = document.getElementById('sys-last-updated');

    if (ts) ts.textContent = 'Updated: ' + fmtTime(new Date());

    // ── Health tiles
    if (bar) {
      bar.innerHTML = '';
      SECTIONS.forEach(function (sec) {
        var s   = data[sec.key] || {};
        var cls = statusClass(s.status);
        var tile = document.createElement('div');
        tile.className = 'system-health-tile ' + cls;
        tile.innerHTML =
          '<div class="system-health-section">' + sec.icon + ' ' + sec.label + '</div>' +
          '<div class="system-health-status">' + (s.status || 'UNKNOWN') + '</div>';
        bar.appendChild(tile);
      });
    }

    // ── Detail cards
    if (detail) {
      detail.innerHTML = '';
      detail.appendChild(buildDetailGrid(data));
    }

    // ── Raw JSON
    if (raw) {
      raw.textContent = JSON.stringify(data, null, 2);
    }
  }

  function buildDetailGrid (data) {
    var grid = document.createElement('div');
    grid.className = 'mcp-grid-2';

    // Journal card
    var j = data.journal || {};
    grid.appendChild(buildDetailCard('Journal', [
      ['Status',        j.status        || '—'],
      ['Entry count',   j.entry_count   !== undefined ? j.entry_count : '—'],
      ['Index current', j.index_current !== undefined ? String(j.index_current) : '—']
    ]));

    // Assets card
    var a = data.assets || {};
    grid.appendChild(buildDetailCard('Assets / CDN', [
      ['Status',         a.status             || '—'],
      ['Local files',    a.local_file_count   !== undefined ? a.local_file_count : '—'],
      ['CDN base',       a.cdn_base           || '—'],
      ['Manifest ver',   a.manifest_version   || '—'],
      ['Pipeline run',   a.pipeline_last_run  ? fmtIso(a.pipeline_last_run) : '—']
    ]));

    // ThorKCade card
    var t = data.thorkcade || {};
    grid.appendChild(buildDetailCard('ThorKCade', [
      ['Status',     t.status     || '—'],
      ['File count', t.file_count !== undefined ? t.file_count : '—'],
      ['Note',       t.note       || '—']
    ]));

    // MCP card
    var m = data.mcp || {};
    grid.appendChild(buildDetailCard('MCP', [
      ['Status',  m.status  || '—'],
      ['Version', m.version || '—'],
      ['Auth',    m.auth    || '—']
    ]));

    // Deployment card
    var d = data.deployment || {};
    grid.appendChild(buildDetailCard('Deployment', [
      ['Status',   d.status   || '—'],
      ['Platform', d.platform || '—'],
      ['Trigger',  d.trigger  || '—']
    ]));

    // Generated timestamp card
    grid.appendChild(buildDetailCard('Index Metadata', [
      ['Generated at', data.generated_at ? fmtIso(data.generated_at) : '—'],
      ['Schema',       data.schema || '—']
    ]));

    return grid;
  }

  function buildDetailCard (title, rows) {
    var card = document.createElement('div');
    card.className = 'mcp-card';
    var header = '<div class="mcp-card-header"><span class="mcp-card-title">' + title + '</span></div>';
    var body   = rows.map(function (r) {
      return '<div class="mcp-kv-row">' +
        '<span class="mcp-kv-key">'   + escHtml(r[0]) + '</span>' +
        '<span class="mcp-kv-value">' + escHtml(String(r[1])) + '</span>' +
        '</div>';
    }).join('');
    card.innerHTML = header + '<div class="mcp-card-body">' + body + '</div>';
    return card;
  }

  function renderStatusError (msg) {
    var bar = document.getElementById('sys-health-bar');
    if (bar) {
      bar.innerHTML =
        '<div style="color:var(--mcp-err-bright);font-size:12px;padding:12px 0;">' +
        '⚠ Failed to load status.json: ' + escHtml(msg) + '</div>';
    }
    var ts = document.getElementById('sys-last-updated');
    if (ts) ts.textContent = 'Failed at ' + fmtTime(new Date());
  }

  /* ── Deploy Panel Build ────────────────────────────────── */
  function buildDeployPanel () {
    var panel = document.getElementById('panel-deploy');
    if (!panel) return;

    panel.innerHTML =
      '<p class="mcp-panel-title">Deploy Engine</p>' +
      '<p class="mcp-panel-subtitle">' +
        'Deployment is triggered automatically by a push to <strong>main</strong>. ' +
        'Use these controls to verify readiness before committing.' +
      '</p>' +

      '<div class="deploy-warning-bar">' +
        'This panel reads live site data. Deployment itself requires a git push to main — ' +
        'the Cloudflare Pages build runs automatically from there.' +
      '</div>' +

      '<div class="mcp-section-label">Pre-flight Checks</div>' +

      buildDeployAction(
        'Validate MCP Assets',
        'Confirm all CSS and JS files load without 404.',
        'run-validate'
      ) +
      buildDeployAction(
        'Validate Journal Index',
        'Confirm journal/_index.json is valid JSON.',
        'run-journal'
      ) +
      buildDeployAction(
        'Validate ThorKCade Index',
        'Confirm thorkcade/index.html and metadata are present.',
        'run-thorkcade'
      ) +
      buildDeployAction(
        'Full Site Health Check',
        'Load _admin/status.json and report all section statuses.',
        'run-health'
      ) +

      '<div class="mcp-section-label">Deploy Log</div>' +
      '<div class="deploy-log-header">' +
        '<span class="deploy-log-title">Output</span>' +
        '<span class="deploy-status-indicator">' +
          '<span class="deploy-status-dot idle" id="deploy-dot"></span>' +
          '<span id="deploy-status-text">Idle</span>' +
        '</span>' +
      '</div>' +
      '<div class="mcp-console" id="deploy-console">// Ready.</div>';

    // Wire buttons
    panel.querySelector('[data-action="run-validate"]')
      .addEventListener('click', function () { deployCheck('validate'); });
    panel.querySelector('[data-action="run-journal"]')
      .addEventListener('click', function () { deployCheck('journal'); });
    panel.querySelector('[data-action="run-thorkcade"]')
      .addEventListener('click', function () { deployCheck('thorkcade'); });
    panel.querySelector('[data-action="run-health"]')
      .addEventListener('click', function () { deployCheck('health'); });
  }

  function buildDeployAction (name, desc, action) {
    return '<div class="deploy-action-row">' +
      '<div class="deploy-action-info">' +
        '<div class="deploy-action-name">' + name + '</div>' +
        '<div class="deploy-action-desc">' + desc + '</div>' +
      '</div>' +
      '<button class="mcp-btn" data-action="' + action + '">Run</button>' +
    '</div>';
  }

  function deployCheck (type) {
    var con  = document.getElementById('deploy-console');
    var dot  = document.getElementById('deploy-dot');
    var stat = document.getElementById('deploy-status-text');

    if (con)  con.innerHTML = '';
    if (dot)  { dot.className = 'deploy-status-dot running'; }
    if (stat) stat.textContent = 'Running…';

    function dlog (msg, cls) {
      if (!con) return;
      var line = document.createElement('div');
      line.className = 'mcp-console-line' + (cls ? ' ' + cls : '');
      line.innerHTML = '<span class="mcp-console-prefix">&gt;</span>' + escHtml(msg);
      con.appendChild(line);
      con.scrollTop = con.scrollHeight;
    }

    function done (ok) {
      if (dot)  { dot.className = 'deploy-status-dot ' + (ok ? 'ok' : 'err'); }
      if (stat) stat.textContent = ok ? 'Passed' : 'Failed';
    }

    var checks = {
      validate: function () {
        var assets = [
          '/__mcp/assets/css/mcp-core.css',
          '/__mcp/assets/css/mcp-theme.css',
          '/__mcp/assets/css/mcp-panels.css',
          '/__mcp/assets/js/mcp-core.js',
          '/__mcp/assets/js/mcp-deploy.js',
          '/__mcp/assets/js/mcp-launcher.js',
          '/__mcp/assets/js/mcp-system.js'
        ];
        dlog('Checking ' + assets.length + ' MCP assets…');
        var pending = assets.length;
        var allOk   = true;
        assets.forEach(function (url) {
          fetch(url, { method: 'HEAD' })
            .then(function (r) {
              var ok = r.ok;
              if (!ok) allOk = false;
              dlog((ok ? '✓' : '✗') + ' ' + url, ok ? 'ok' : 'err');
              if (--pending === 0) {
                dlog(allOk ? 'All assets OK.' : 'Some assets missing — commit package required.', allOk ? 'ok' : 'warn');
                done(allOk);
              }
            })
            .catch(function () {
              allOk = false;
              dlog('✗ ' + url + ' (network error)', 'err');
              if (--pending === 0) { done(false); }
            });
        });
      },

      journal: function () {
        dlog('Fetching /journal/_index.json…');
        fetch('/journal/_index.json?_=' + Date.now())
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then(function (d) {
            dlog('Valid JSON ✓', 'ok');
            dlog('Entries: ' + (Array.isArray(d.entries) ? d.entries.length : '(no array)'));
            dlog('Version: ' + (d.version || '—'));
            done(true);
          })
          .catch(function (e) { dlog('Failed: ' + e.message, 'err'); done(false); });
      },

      thorkcade: function () {
        dlog('Checking /thorkcade/index.html…');
        fetch('/thorkcade/index.html', { method: 'HEAD' })
          .then(function (r) {
            dlog(r.ok ? '✓ index.html present' : '✗ index.html missing (HTTP ' + r.status + ')', r.ok ? 'ok' : 'err');
            done(r.ok);
          })
          .catch(function (e) { dlog('Network error: ' + e.message, 'err'); done(false); });
      },

      health: function () {
        dlog('Loading _admin/status.json…');
        fetch(STATUS_URL + '?_=' + Date.now())
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var allOk = true;
            SECTIONS.forEach(function (sec) {
              var s   = d[sec.key] || {};
              var ok  = s.status === 'HEALTHY' || s.status === 'OPERATIONAL';
              if (!ok) allOk = false;
              dlog(sec.label.padEnd(18) + (s.status || 'UNKNOWN'), ok ? 'ok' : 'warn');
            });
            dlog(allOk ? 'All sections healthy.' : 'Attention required on one or more sections.', allOk ? 'ok' : 'warn');
            done(allOk);
          })
          .catch(function (e) { dlog('Failed: ' + e.message, 'err'); done(false); });
      }
    };

    setTimeout(checks[type] || function () { dlog('Unknown check.', 'err'); done(false); }, 200);
  }

  /* ── Topbar Clock ──────────────────────────────────────── */
  function startClock () {
    var el = document.getElementById('mcp-clock') ||
             document.querySelector('.mcp-clock');
    if (!el) return;
    function tick () {
      el.textContent = fmtTime(new Date()) + ' CDT';
    }
    tick();
    clockTimer = setInterval(tick, CLOCK_TICK_MS);
  }

  /* ── Utilities ─────────────────────────────────────────── */
  function statusClass (s) {
    if (!s) return 'err';
    s = s.toUpperCase();
    if (s === 'HEALTHY' || s === 'OPERATIONAL') return 'ok';
    if (s === 'NEEDS_ATTENTION')                return 'warn';
    return 'err';
  }

  function fmtTime (d) {
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function fmtIso (iso) {
    try {
      return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) { return iso; }
  }

  function escHtml (str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ── Boot Sequence Integration ─────────────────────────── */
  // mcp-core.js calls MCPSystem.init() after dismissing the boot screen.
  window.MCPSystem = { init: init };

  // Also handle the case where mcp-core.js already ran and is waiting.
  document.addEventListener('DOMContentLoaded', function () {
    var boot = document.getElementById('mcp-boot');
    var app  = document.getElementById('mcp-app');

    if (!boot || !app) return;

    function reveal () {
      boot.classList.add('dismissed');
      app.classList.add('visible');
      init();
    }

    // Honour the existing mcp-core.js 1500 ms timeout — just extend it
    // with proper reveal logic if MCPSystem was not yet init'd.
    setTimeout(function () {
      if (!app.classList.contains('visible')) reveal();
    }, 1600);

    boot.addEventListener('click', reveal);
    document.addEventListener('keydown', function onKey (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        document.removeEventListener('keydown', onKey);
        reveal();
      }
    });
  });

}());
