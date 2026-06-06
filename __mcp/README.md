# ThorKC MCP Layer

Operator tooling for ThorKC.com  not public-facing.

## Access
- Dashboard: `/__mcp/`
- - Manifest: `/__mcp/mcp.json`
  - - Protected by Cloudflare Access (Zero Trust, 2FA required)
   
    - ## Tools (mcp.json)
    - 1. `list_journal_entries`  Read journal/_index.json
      2. 2. `create_journal_entry`  Scaffold new article from template
         3. 3. `publish_journal_entry`  Set status -> published
            4. 4. `get_site_status`  Return _admin/status.json
               5. 5. `edit_section_index`  Open section index.html for editing
                  6. 6. `update_global_nav`  Patch nav links across all pages
                     7. 7. `process_graphics`  Scan _incoming, route by prefix, optimize to WebP
                       
                        8. ## Setup
                        9. - robots.txt blocks `/__mcp/`
                           - - All MCP pages carry `>meta name="robots" content="noindex, nofollow">`
                             - - Cloudflare Access application covers `thorkc.com/__mcp/*`
                              
                               - ## File Map
                               - | File | Purpose |
                               - |------|---------|
                               - | `__mcp/mcp.json` | Tool manifest |
                               - | `__mcp/index.html` | Operator dashboard |
                               - | `_admin/status.json` | Site state |
                               - | `journal/_index.json` | Journal entry registry |
                               - | `process-graphics.js` | Graphics pipeline script |
