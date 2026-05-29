import path from 'node:path';

import { readJson } from './util.mjs';

const LAYOUT_PACKS_DIR = 'recipes/layout-packs';

export function readBundleJson(bundleRoot) {
  return readJson(path.join(bundleRoot, 'bundle.json'));
}

export function forEachLayout(bundleRoot, callback) {
  const bundle = readBundleJson(bundleRoot);
  for (const [ns, mod] of Object.entries(bundle.mods || {})) {
    for (const packRef of mod.packs || []) {
      const packPath = path.join(
        bundleRoot,
        LAYOUT_PACKS_DIR,
        ns,
        `${packRef.file}.json`,
      );
      const pack = readJson(packPath);
      for (const layout of Object.values(pack.layouts || {})) {
        callback(layout);
      }
    }
  }
}
