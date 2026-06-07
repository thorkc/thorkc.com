# _incoming/ — Graphics Pipeline Staging

Drop new graphics here. The asset pipeline reads this folder and routes
files automatically based on filename prefix.

## Routing Rules (from GRAPHICS-PIPELINE.md)

| Prefix        | Routes to                        | Format output        |
|---------------|----------------------------------|----------------------|
| `jrnl-`       | `assets/journal/`                | WebP + AVIF + orig   |
| `thor-`       | `assets/thorkcade/`              | WebP + AVIF + orig   |
| `pfc-`        | `assets/pfc/`                    | WebP + AVIF + orig   |
| `sf-`         | `assets/sunday-funnies/`         | WebP + AVIF + orig   |
| `brand-`      | `assets/brand/`                  | WebP + PNG           |
| `og-`         | `assets/og/`                     | JPEG 1200×630        |
| (no prefix)   | `assets/misc/`                   | WebP + orig          |

## Pipeline Commands

```bash
# Optimize all files in _incoming/ and route to assets/
npm run optimize

# Upload processed files to CDN (assets.thorkc.com)
npm run upload

# Update asset manifest
npm run manifest

# Purge CDN cache
npm run purge

# Full pipeline in one command
npm run deploy
```

## Notes

- Processed originals are moved to `_incoming/processed/` after a successful run.
- `.gitkeep` holds the folder in git when empty.
- Never commit large unprocessed images to the repo — stage here, run pipeline, commit manifests only.
