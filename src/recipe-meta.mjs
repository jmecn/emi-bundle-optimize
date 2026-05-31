import fs from 'node:fs';
import path from 'node:path';

import { readJson } from './util.mjs';

const RECIPES_DIR = 'recipes';

export function readBundleJson(bundleRoot) {
  return readJson(path.join(bundleRoot, 'bundle.json'));
}

/**
 * Iterate every v2 recipe meta JSON under recipes/<namespace>/*.json
 * @param {string} bundleRoot
 * @param {(meta: object) => void} callback
 * @param {{ log?: (msg: string) => void, progressEvery?: number, progressLabel?: string }} [progress]
 */
export function forEachRecipeMeta(bundleRoot, callback, progress) {
  const recipesRoot = path.join(bundleRoot, RECIPES_DIR);
  if (!fs.existsSync(recipesRoot)) return;

  const log = progress?.log;
  const progressEvery = progress?.progressEvery ?? 10_000;
  const progressLabel = progress?.progressLabel ?? 'recipe meta scan';
  const startedAt = Date.now();
  let count = 0;

  for (const namespace of fs.readdirSync(recipesRoot)) {
    const nsDir = path.join(recipesRoot, namespace);
    if (!fs.statSync(nsDir).isDirectory()) continue;
    for (const file of fs.readdirSync(nsDir)) {
      if (!file.endsWith('.json')) continue;
      const meta = readJson(path.join(nsDir, file));
      callback(meta);
      count += 1;
      if (log && progressEvery > 0 && count % progressEvery === 0) {
        log(`[emi-bundle-optimize]   ${progressLabel}: ${count} (${Date.now() - startedAt} ms)`);
      }
    }
  }

  if (log && count > 0) {
    log(`[emi-bundle-optimize]   ${progressLabel}: ${count} done (${Date.now() - startedAt} ms)`);
  }
}

/** @deprecated v1 layout packs — use {@link forEachRecipeMeta} */
export function forEachLayout(bundleRoot, callback) {
  forEachRecipeMeta(bundleRoot, callback);
}
