# ThorKC Graphics Pipeline

Drop images into `assets/_incoming/`. Run the pipeline. Done.

## Quick Start

```bash
npm install          # install sharp (one time)
npm run build        # process all files in _incoming/
npm run watch        # auto-process when files land in _incoming/
npm run process-graphics -- --dry-run   # preview without moving files
```

## Naming Convention -> Target Folder

| Prefix | Target Folder |
|--------|---------------|
| `brand-*` | `assets/brand/` |
| `journal-*` | `assets/journal/` |
| `cade-*` | `assets/thorkcade/` |
| `ui-*` | `assets/ui/` |
| `icon-*` | `assets/icons/` |
| `bg-*` | `assets/backgrounds/` |
| *(no match)* | `assets/ui/` *(fallback)* |

## What It Does

1. Scans `assets/_incoming/` for new image files
2. 2. Determines target folder from filename prefix
   3. 3. Converts PNG/JPG/TIFF to optimized WebP (quality 82, effort 5) via sharp
      4. 4. Passes SVG/GIF through unchanged
         5. 5. Moves processed file to `assets/{target}/`
            6. 6. Appends entry to `assets/_pipeline-log.json`
              
               7. ## Output Format
              
               8. All raster images exit as `.webp` - original filename preserved, extension swapped.
              
               9. ## MCP Integration
              
               10. Trigger via MCP tool `process_graphics` - scans _incoming, routes, optimizes, logs.
               11. The dashboard at `/__mcp/` shows the pipeline log and lets you trigger a run manually.
              
               12. ## Cloudflare Pages Build
              
               13. No build command is set - pipeline runs locally or via MCP only.
               14. Set Build output directory to `/` (root).
