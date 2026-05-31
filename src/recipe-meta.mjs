import fs from 'node:fs';
import path from 'node:path';

import { readJson } from './util.mjs';

const RECIPES_DIR = 'recipes';

export function readBundleJson(bundleRoot) {
  return readJson(path.join(bundleRoot, 'bundle.json'));
}

/** Iterate every v2 recipe meta JSON under recipes/<namespace>/*.json */
export function forEachRecipeMeta(bundleRoot, callback) {
  const recipesRoot = path.join(bundleRoot, RECIPES_DIR);
  if (!fs.existsSync(recipesRoot)) return;
  for (const namespace of fs.readdirSync(recipesRoot)) {
    const nsDir = path.join(recipesRoot, namespace);
    if (!fs.statSync(nsDir).isDirectory()) continue;
    for (const file of fs.readdirSync(nsDir)) {
      if (!file.endsWith('.json')) continue;
      const meta = readJson(path.join(nsDir, file));
      callback(meta);
    }
  }
}

/** @deprecated v1 layout packs — use {@link forEachRecipeMeta} */
export function forEachLayout(bundleRoot, callback) {
  forEachRecipeMeta(bundleRoot, callback);
}
