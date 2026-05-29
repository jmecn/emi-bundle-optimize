import fs from 'node:fs';
import path from 'node:path';

import { fail, readJson } from './util.mjs';

const ROUTES_DIR = 'recipes/routes';
const LAYOUT_PACKS_DIR = 'recipes/layout-packs';
const HARD_CAP_BYTES = 2 * 1024 * 1024;

function routeShardPath(bundleRoot, namespace, file) {
  return path.join(bundleRoot, ROUTES_DIR, namespace, `${file}.json`);
}

function layoutPackPath(bundleRoot, namespace, file) {
  return path.join(bundleRoot, LAYOUT_PACKS_DIR, namespace, `${file}.json`);
}

function assertFileSize(relPath, absPath, maxBytes) {
  const bytes = fs.statSync(absPath).size;
  if (bytes > maxBytes) {
    fail(`${relPath} exceeds ${maxBytes} bytes (actual ${bytes})`);
  }
  return bytes;
}

export function readRecipeBundle(bundleRoot) {
  const bundle = readJson(path.join(bundleRoot, 'bundle.json'));
  if (bundle.schema !== 1) {
    fail(`bundle.schema expected 1, got ${bundle.schema}`);
  }
  if (!Number.isFinite(bundle.layoutSchema)) {
    fail('bundle.json missing required field: layoutSchema');
  }
  if (!Number.isFinite(bundle.scale)) {
    fail('bundle.json missing required field: scale');
  }
  if (!Number.isFinite(bundle.packMaxBytes) || bundle.packMaxBytes <= 0) {
    fail('bundle.json missing required field: packMaxBytes');
  }
  const { mods } = bundle;
  if (!mods || typeof mods !== 'object' || Array.isArray(mods)) {
    fail('bundle.json must contain mods object');
  }
  const namespaces = Object.keys(mods)
    .filter((id) => typeof id === 'string' && id.length > 0)
    .sort();
  if (namespaces.length === 0) {
    fail('bundle.json mods must be non-empty');
  }
  for (const ns of namespaces) {
    const mod = mods[ns];
    if (!mod || typeof mod !== 'object') {
      fail(`bundle.json mods.${ns} must be an object`);
    }
    if (!Array.isArray(mod.routes) || mod.routes.length === 0) {
      fail(`bundle.json mods.${ns}.routes must be a non-empty array`);
    }
    if (!Array.isArray(mod.packs) || mod.packs.length === 0) {
      fail(`bundle.json mods.${ns}.packs must be a non-empty array`);
    }
    for (const file of mod.routes) {
      if (typeof file !== 'string' || file.length === 0) {
        fail(`bundle.json mods.${ns}.routes entries must be non-empty strings`);
      }
    }
    for (const pack of mod.packs) {
      if (!pack || typeof pack !== 'object') {
        fail(`bundle.json mods.${ns}.packs entries must be objects`);
      }
      if (typeof pack.file !== 'string' || pack.file.length === 0) {
        fail(`bundle.json mods.${ns}.packs[].file must be a non-empty string`);
      }
      if (!Number.isFinite(pack.bytes) || pack.bytes <= 0) {
        fail(`bundle.json mods.${ns}.packs[].bytes must be a positive number`);
      }
    }
  }
  return { bundle, mods, namespaces };
}

export function readRouteShard(bundleRoot, namespace, file) {
  const rel = `${ROUTES_DIR}/${namespace}/${file}.json`;
  const abs = routeShardPath(bundleRoot, namespace, file);
  if (!fs.existsSync(abs)) {
    fail(`missing route shard: ${rel}`);
  }
  assertFileSize(rel, abs, HARD_CAP_BYTES);
  const shard = readJson(abs);
  if (shard.schema !== 1) {
    fail(`${rel} schema expected 1, got ${shard.schema}`);
  }
  if (shard.namespace !== namespace) {
    fail(`${rel} namespace expected ${namespace}, got ${shard.namespace}`);
  }
  if (!shard.routes || typeof shard.routes !== 'object' || Array.isArray(shard.routes)) {
    fail(`${rel} must contain routes object`);
  }
  return shard.routes;
}

export function readLayoutPack(bundleRoot, namespace, file) {
  const rel = `${LAYOUT_PACKS_DIR}/${namespace}/${file}.json`;
  const abs = layoutPackPath(bundleRoot, namespace, file);
  if (!fs.existsSync(abs)) {
    fail(`missing layout pack: ${rel}`);
  }
  const bytes = assertFileSize(rel, abs, HARD_CAP_BYTES);
  const pack = readJson(abs);
  if (pack.schema !== 1) {
    fail(`${rel} schema expected 1, got ${pack.schema}`);
  }
  if (pack.namespace !== namespace) {
    fail(`${rel} namespace expected ${namespace}, got ${pack.namespace}`);
  }
  if (!pack.layouts || typeof pack.layouts !== 'object' || Array.isArray(pack.layouts)) {
    fail(`${rel} must contain layouts object`);
  }
  return { pack, bytes, rel };
}

/**
 * @returns {{ bundle: object, recipeIds: string[], namespaces: string[], mods: object }}
 */
export function readRecipeIds(bundleRoot) {
  const { bundle, mods, namespaces } = readRecipeBundle(bundleRoot);
  const recipeIds = [];

  for (const ns of namespaces) {
    const mod = mods[ns];
    const routeToPackIndex = new Map();

    for (const routeFile of mod.routes) {
      const routes = readRouteShard(bundleRoot, ns, routeFile);
      for (const [recipePath, packIndex] of Object.entries(routes)) {
        if (typeof recipePath !== 'string' || recipePath.length === 0) {
          fail(`${ROUTES_DIR}/${ns}/${routeFile}.json has invalid route key`);
        }
        if (!Number.isInteger(packIndex) || packIndex < 0 || packIndex >= mod.packs.length) {
          fail(`${ROUTES_DIR}/${ns}/${routeFile}.json routes["${recipePath}"]=${packIndex} out of range for packs (${mod.packs.length})`);
        }
        if (routeToPackIndex.has(recipePath)) {
          fail(`duplicate route path in mods.${ns}: ${recipePath}`);
        }
        routeToPackIndex.set(recipePath, packIndex);
        recipeIds.push(`${ns}:${recipePath}`);
      }
    }

    const layoutPaths = new Set();
    const packLayouts = [];
    for (let i = 0; i < mod.packs.length; i += 1) {
      const packRef = mod.packs[i];
      const { pack, bytes, rel } = readLayoutPack(bundleRoot, ns, packRef.file);
      if (packRef.bytes !== bytes) {
        fail(`${rel} bytes=${bytes} but bundle.mods.${ns}.packs[${i}].bytes=${packRef.bytes}`);
      }
      if (bytes > bundle.packMaxBytes) {
        fail(`${rel} exceeds bundle.packMaxBytes=${bundle.packMaxBytes} (actual ${bytes})`);
      }
      packLayouts[i] = pack.layouts;
      for (const recipePath of Object.keys(pack.layouts)) {
        layoutPaths.add(recipePath);
      }
    }

    for (const [recipePath, packIndex] of routeToPackIndex) {
      if (!Object.hasOwn(packLayouts[packIndex], recipePath)) {
        fail(`missing layout for ${ns}:${recipePath} in pack ${mod.packs[packIndex].file}`);
      }
    }

    if (routeToPackIndex.size !== layoutPaths.size) {
      fail(`mods.${ns} route/layout path sets differ (routes=${routeToPackIndex.size}, layouts=${layoutPaths.size})`);
    }
    for (const recipePath of routeToPackIndex.keys()) {
      if (!layoutPaths.has(recipePath)) {
        fail(`route path missing from layout packs: ${ns}:${recipePath}`);
      }
    }
    for (const recipePath of layoutPaths) {
      if (!routeToPackIndex.has(recipePath)) {
        fail(`layout path missing from route shards: ${ns}:${recipePath}`);
      }
    }
  }

  if (recipeIds.length === 0) {
    fail('bundle has zero recipe paths');
  }
  return { bundle, recipeIds, namespaces, mods };
}

export function forEachLayout(bundleRoot, callback) {
  const { mods, namespaces } = readRecipeBundle(bundleRoot);
  for (const ns of namespaces) {
    for (const packRef of mods[ns].packs) {
      const { pack } = readLayoutPack(bundleRoot, ns, packRef.file);
      for (const layout of Object.values(pack.layouts)) {
        callback(layout);
      }
    }
  }
}

export function loadLayoutForRecipeId(bundleRoot, recipeId, ctx) {
  const { mods, namespaces } = ctx || readRecipeBundle(bundleRoot);
  const value = String(recipeId || '');
  const idx = value.indexOf(':');
  if (idx <= 0 || idx >= value.length - 1) {
    fail(`invalid recipe id: ${recipeId}`);
  }
  const ns = value.slice(0, idx);
  const recipePath = value.slice(idx + 1);
  if (!namespaces.includes(ns)) {
    fail(`unknown recipe namespace: ${ns}`);
  }
  const mod = mods[ns];
  let packIndex = null;
  for (const routeFile of mod.routes) {
    const routes = readRouteShard(bundleRoot, ns, routeFile);
    if (Object.hasOwn(routes, recipePath)) {
      packIndex = routes[recipePath];
      break;
    }
  }
  if (packIndex == null) {
    fail(`no route for recipe id: ${recipeId}`);
  }
  const packRef = mod.packs[packIndex];
  const { pack } = readLayoutPack(bundleRoot, ns, packRef.file);
  const layout = pack.layouts[recipePath];
  if (!layout) {
    fail(`no layout for recipe id: ${recipeId}`);
  }
  return layout;
}
