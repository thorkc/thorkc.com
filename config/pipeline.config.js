/**
 * ThorKC Asset Pipeline — Central Configuration
 * Edit this file to tune pipeline behavior for your environment.
 * All values can be overridden by environment variables (highest priority).
 */

module.exports = {
  sections: {
    homepage:  { path: 'homepage',  cdnPrefix: 'assets/homepage'  },
    journal:   { path: 'journal',   cdnPrefix: 'assets/journal'   },
    thorkade:  { path: 'thorkade',  cdnPrefix: 'assets/thorkade'  },
    basement:  { path: 'basement',  cdnPrefix: 'assets/basement'  },
    pfc:       { path: 'pfc',       cdnPrefix: 'assets/pfc'       },
    shared:    { path: 'shared',    cdnPrefix: 'assets/shared'    },
  },

  quality: {
    homepage: { webp: 85, avif: 80, jpeg: 85, png: 9 },
    journal:  { webp: 82, avif: 78, jpeg: 82, png: 9 },
    thorkade: { webp: 80, avif: 75, jpeg: 80, png: 8 },
    basement: { webp: 80, avif: 75, jpeg: 80, png: 8 },
    pfc:      { webp: 82, avif: 78, jpeg: 82, png: 9 },
    shared:   { webp: 85, avif: 80, jpeg: 85, png: 9 },
  },

  fileTypes: {
    images:  ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.avif'],
    vectors: ['.svg'],
    static:  ['.pdf', '.json', '.txt', '.ico', '.woff', '.woff2'],
  },

  cacheControl: 'public, max-age=31536000, immutable',

  outputFormats: {
    webp:     true,
    avif:     true,
    original: true,
  },

  watcher: {
    debounceMs:  1200,
    stabilityMs: 800,
  },

  paths: {
    assets:   'assets',
    dist:     'dist',
    manifest: 'assets-manifest.json',
  },
};
