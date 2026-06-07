/* ============================================================
   MCP LAUNCHER — Tool Panel Logic
   ThorKC.com Master Control Program | mcp-launcher.js v1.0.0

   Manages the Launcher panel: renders MCP tool cards sourced
   from mcp.json, handles modal input forms, fires tool
   routines, and streams results into the console.
   ============================================================ */

(function () {
  'use strict';

  /* ── Tool definitions ──────────────────────────────────────
     Mirrors the tools declared in __mcp/mcp.json.
     Each entry drives one card in the launcher grid.
  ─────────────────────────────────────────────────────────── */
  const MCP_TOOLS = [
    {
      id:     'list_journal_entries',
      name:   'List Journal Entries',
      desc:   'Fetch and display all entries in journal/_index.json.',
      fields: [],
      run:    listJournalEntries
    },
    {
      id:     'create_journal_entry',
      name:   'Create Journal Entry',
      desc:   'Scaffold a new entry from the journal template.',
      fields: [
        { key: 'slug',   label: 'Slug',  type: 'text', placeholder: 'my-entry-slug' },
        { key: 'title',  label: 'Title', type: 'text', placeholder: 'Entry Title'   },
        { key: 'author', label: 'Author', type: 'text', placeholder: 'ThorKC'       }
      ],
      run:    createJournalEntry
    },
    {
      id:     'publish_journal_entry',
      name:   'Publish Entry',
      desc:   'Add a completed entry to _index.json and mark it live.',
      fields: [
        { key: 'slug', label: 'Entry Slug', type: 'text', placeholder: 'my-entry-slug' }
      ],
      run:    publishJournalEntry
    },
    {
      id:     'get_site_status',
      name:   'Site Status',
      desc:   'Load _admin/status.json and report all section health.',
      fields: [],
      run:    getSiteStatus
    },
    {
      id:     'edit_section_index',
      name:   'Edit Section Index',
      desc:   'Open and validate an index file for a given section.',
      fields: [
        {
          key:     'section',
          label:   'Section',
          type:    'select',
          options: ['journal', 'sunday-funnies', 'thorkcade', 'pfc', 'insider']
        }
      ],
      run:    editSectionIndex
    },
    {
      id:     'update_global_nav',
      name:   'Update Global Nav',
      desc:   'Regenerate navigation references across all section indexes.',
      fields: [],
      run:    updateGlobalNav
    }
  ];

  /* ── State ─────────────────────────────────────────────── */
  let activeTool    = null;
  let consoleEl     = null;
  let modalBgEl     = null;
  let modalEl       = null;
  let resultWrapEl  = null;

  /* ── Init ──────────────────────────────────────────────── */
  function init () {
    const panel = document.getElementById('panel-launcher');
    if (!panel) return;

    panel.innerHTML = '';
    panel.appendChild(buildHeader());
    panel.appendChild(buildToolGrid());
    panel.appendChild(buildResultArea());
    panel.appendChild(buildModal());

    consoleEl    = panel.querySelector('.mcp-console');
    modalBgEl    = panel.querySelector('.launcher-modal-bg');
    modalEl      = panel.querySelector('.launcher-modal');
    resultWrapEl = panel.querySelector('.launcher-result-wrap');

    modalBgEl.addEventListener('click', function (e) {
      if (e.target === modalBgEl) closeModal();
    });
  }

  /* ── Header ────────────────────────────────────────────── */
  function buildHeader () {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <p class="mcp-panel-title">Launcher</p>
      <p class="mcp-panel-subtitle">
        Select a tool to execute. Tools with parameters open a form before running.
      </p>`;
    return wrap;
  }

  /* ── Tool Grid ─────────────────────────────────────────── */
  function buildToolGrid () {
    const grid = document.createElement('div');
    grid.className = 'launcher-tool-grid';

    MCP_TOOLS.forEach(function (tool) {
      const card = document.createElement('div');
      card.className    = 'launcher-tool-card';
      card.dataset.id   = tool.id;
      card.innerHTML    = `
        <div class="launcher-tool-name">${tool.name}</div>
        <div class="launcher-tool-desc">${tool.desc}</div>`;

      card.addEventListener('click', function () {
        if (tool.fields.length > 0) {
          openModal(tool);
        } else {
          executeToolDirect(tool);
        }
      });

      grid.appendChild(card);
    });

    return grid;
  }

  /* ── Result / Console Area ─────────────────────────────── */
  function buildResultArea () {
    const wrap = document.createElement('div');
    wrap.className = 'launcher-result-wrap';
    wrap.innerHTML = `
      <div class="launcher-result-label">Console Output</div>
      <div class="mcp-console">
        <span class="mcp-console-line mcp-text-muted">// Ready. Select a tool to execute.</span>
      </div>`;
    return wrap;
  }

  /* ── Modal ─────────────────────────────────────────────── */
  function buildModal () {
    const bg = document.createElement('div');
    bg.className = 'launcher-modal-bg';
    bg.innerHTML = `
      <div class="launcher-modal mcp-frame">
        <div class="launcher-modal-title" id="modal-title">Tool Parameters</div>
        <div id="modal-fields"></div>
        <div class="launcher-modal-actions">
          <button class="mcp-btn" id="modal-cancel">Cancel</button>
          <button class="mcp-btn" id="modal-run">Run Tool</button>
        </div>
      </div>`;

    bg.querySelector('#modal-cancel').addEventListener('click', closeModal);
    bg.querySelector('#modal-run').addEventListener('click', submitModal);
    return bg;
  }

  function openModal (tool) {
    activeTool = tool;
    document.getElementById('modal-title').textContent = tool.name;

    const fieldsEl = document.getElementById('modal-fields');
    fieldsEl.innerHTML = '';

    tool.fields.forEach(function (f) {
      const wrap  = document.createElement('div');
      wrap.className = 'launcher-modal-field';

      const label = document.createElement('label');
      label.textContent = f.label;
      label.htmlFor = 'mf-' + f.key;
      wrap.appendChild(label);

      let input;
      if (f.type === 'select') {
        input = document.createElement('select');
        input.className = 'mcp-input';
        f.options.forEach(function (opt) {
          const o = document.createElement('option');
          o.value = opt; o.textContent = opt;
          input.appendChild(o);
        });
      } else {
        input = document.createElement('input');
        input.type        = 'text';
        input.className   = 'mcp-input';
        input.placeholder = f.placeholder || '';
      }
      input.id = 'mf-' + f.key;
      wrap.appendChild(input);
      fieldsEl.appendChild(wrap);
    });

    modalBgEl.classList.add('open');
    const first = fieldsEl.querySelector('input, select');
    if (first) setTimeout(function () { first.focus(); }, 50);
  }

  function closeModal () {
    modalBgEl.classList.remove('open');
    activeTool = null;
  }

  function submitModal () {
    if (!activeTool) return;
    const params = {};
    activeTool.fields.forEach(function (f) {
      const el = document.getElementById('mf-' + f.key);
      params[f.key] = el ? el.value.trim() : '';
    });
    closeModal();
    executeTool(activeTool, params);
  }

  /* ── Tool Execution ────────────────────────────────────── */
  function executeToolDirect (tool) {
    executeTool(tool, {});
  }

  function executeTool (tool, params) {
    clearConsole();
    logLine('Running: ' + tool.name, 'gold');

    const card = document.querySelector('[data-id="' + tool.id + '"]');
    if (card) {
      card.classList.add('running');
      const spinner = document.createElement('div');
      spinner.className = 'mcp-spinner launcher-tool-spinner';
      card.appendChild(spinner);
    }

    // Small artificial delay to give visual feedback
    setTimeout(function () {
      try {
        tool.run(params);
      } catch (err) {
        logLine('Error: ' + err.message, 'err');
      } finally {
        if (card) {
          card.classList.remove('running');
          const s = card.querySelector('.mcp-spinner');
          if (s) s.remove();
        }
      }
    }, 320);
  }

  /* ── Console Helpers ───────────────────────────────────── */
  function clearConsole () {
    if (consoleEl) consoleEl.innerHTML = '';
  }

  function logLine (text, cls) {
    if (!consoleEl) return;
    const line = document.createElement('div');
    line.className = 'mcp-console-line' + (cls ? ' ' + cls : '');
    line.innerHTML = '<span class="mcp-console-prefix">&gt;</span>' + escHtml(text);
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function escHtml (str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ── Tool Implementations ──────────────────────────────── */

  function listJournalEntries () {
    logLine('Fetching journal/_index.json …');
    fetch('/journal/_index.json?_=' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        const count = Array.isArray(data.entries) ? data.entries.length : 0;
        logLine('Index version : ' + (data.version || 'n/a'));
        logLine('Total entries : ' + count);
        if (count === 0) {
          logLine('No entries found. Use Create Journal Entry to add one.', 'warn');
        } else {
          data.entries.forEach(function (e, i) {
            logLine('[' + (i + 1) + '] ' + e.slug + ' — ' + (e.title || 'untitled'));
          });
        }
        logLine('Done.', 'ok');
      })
      .catch(function (err) {
        logLine('Failed to load index: ' + err.message, 'err');
      });
  }

  function createJournalEntry (params) {
    const slug   = params.slug   || 'untitled-' + Date.now();
    const title  = params.title  || 'Untitled Entry';
    const author = params.author || 'ThorKC';
    const now    = new Date().toISOString();

    logLine('Slug   : ' + slug);
    logLine('Title  : ' + title);
    logLine('Author : ' + author);
    logLine('Date   : ' + now);
    logLine('');
    logLine('Entry scaffold ready. Commit the following file to your repo:', 'gold');
    logLine('  journal/' + slug + '.html');
    logLine('');
    logLine('Then run Publish Entry with slug "' + slug + '" to register it in _index.json.', 'warn');
    logLine('Done.', 'ok');
  }

  function publishJournalEntry (params) {
    const slug = params.slug;
    if (!slug) { logLine('No slug provided.', 'err'); return; }

    logLine('Fetching journal/_index.json …');
    fetch('/journal/_index.json?_=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (data) {
        const entries = Array.isArray(data.entries) ? data.entries : [];
        const exists  = entries.some(function (e) { return e.slug === slug; });
        if (exists) {
          logLine('Entry "' + slug + '" is already registered in the index.', 'warn');
          return;
        }
        logLine('Entry "' + slug + '" not yet in index.', 'warn');
        logLine('');
        logLine('To publish: add the entry object to journal/_index.json and commit.', 'gold');
        logLine('Required fields: slug, title, date, author, tags, thumbnail');
        logLine('Done.', 'ok');
      })
      .catch(function (err) {
        logLine('Failed: ' + err.message, 'err');
      });
  }

  function getSiteStatus () {
    logLine('Fetching _admin/status.json …');
    fetch('/_admin/status.json?_=' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        logLine('Generated : ' + (data.generated_at || 'unknown'));
        logLine('');
        var sections = ['journal', 'assets', 'thorkcade', 'pfc', 'mcp', 'deployment'];
        sections.forEach(function (key) {
          var s = data[key];
          if (!s) return;
          var cls = s.status === 'HEALTHY' || s.status === 'OPERATIONAL' ? 'ok'
                  : s.status === 'NEEDS_ATTENTION' ? 'warn' : 'err';
          logLine(key.toUpperCase().padEnd(14) + s.status, cls);
        });
        logLine('');
        logLine('Status check complete.', 'ok');
      })
      .catch(function (err) {
        logLine('Failed: ' + err.message, 'err');
      });
  }

  function editSectionIndex (params) {
    const section = params.section;
    if (!section) { logLine('No section selected.', 'err'); return; }
    const url = '/' + section + '/_index.json?_=' + Date.now();
    logLine('Loading ' + url + ' …');
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' — index may not exist');
        return r.json();
      })
      .then(function (data) {
        logLine('Valid JSON confirmed for section: ' + section, 'ok');
        logLine('Keys found: ' + Object.keys(data).join(', '));
        var count = Array.isArray(data.entries) ? data.entries.length : '(no entries array)';
        logLine('Entry count: ' + count);
        logLine('Done.', 'ok');
      })
      .catch(function (err) {
        logLine('Error: ' + err.message, 'err');
      });
  }

  function updateGlobalNav () {
    logLine('Scanning all section indexes …');
    var sections = ['journal', 'sunday-funnies', 'thorkcade', 'pfc', 'insider'];
    var results  = [];
    var pending  = sections.length;

    sections.forEach(function (sec) {
      fetch('/' + sec + '/_index.json?_=' + Date.now())
        .then(function (r) { return { sec: sec, ok: r.ok, status: r.status }; })
        .catch(function ()  { return { sec: sec, ok: false, status: 0 }; })
        .then(function (res) {
          results.push(res);
          pending--;
          if (pending === 0) finish();
        });
    });

    function finish () {
      results.sort(function (a, b) { return a.sec.localeCompare(b.sec); });
      results.forEach(function (r) {
        var cls = r.ok ? 'ok' : 'warn';
        logLine(r.sec.padEnd(20) + (r.ok ? 'OK' : 'MISSING (' + r.status + ')'), cls);
      });
      logLine('');
      logLine('Nav scan complete. Commit any missing _index.json files to resolve warnings.', 'gold');
      logLine('Done.', 'ok');
    }
  }

  /* ── Register with mcp-core boot sequence ──────────────── */
  if (typeof window.MCPPanels === 'undefined') { window.MCPPanels = {}; }
  window.MCPPanels.launcher = { init: init };

  /* Auto-init if panel is already visible */
  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('panel-launcher')) init();
  });

}());
