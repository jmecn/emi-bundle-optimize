import path from 'node:path';

import { fail, readJson } from './util.mjs';

/** Same rule as minecraft-web-export RecipeLayoutPaths.safeFileName */
export function layoutPathForRecipeId(recipeId) {
  const file = String(recipeId).replace(/:/g, '_').replace(/\//g, '_') + '.json';
  return `recipes/layouts/${file}`;
}

function normalizeNamespace(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRecipePath(value) {
  return typeof value === 'string' ? value : '';
}

export function readRecipeIds(bundleRoot) {
  const recipeIndex = readJson(path.join(bundleRoot, 'recipes/index.json'));
  if (recipeIndex.schema !== 1) {
    fail(`recipes/index.json schema expected 1, got ${recipeIndex.schema}`);
  }
  if (!Array.isArray(recipeIndex.namespaces)) {
    fail('recipes/index.json must contain namespaces array');
  }
  const namespaces = recipeIndex.namespaces
    .map(normalizeNamespace)
    .filter((ns) => ns.length > 0);
  if (namespaces.length === 0) {
    fail('recipes/index.json has zero namespaces');
  }

  const recipeIds = [];
  for (const ns of namespaces) {
    const shard = readJson(path.join(bundleRoot, `recipes/shards/${ns}.json`));
    if (!Array.isArray(shard)) {
      fail(`recipes/shards/${ns}.json must be an array`);
    }
    for (const recipePath of shard.map(normalizeRecipePath).filter((id) => id.length > 0)) {
      recipeIds.push(`${ns}:${recipePath}`);
    }
  }
  if (recipeIds.length === 0) {
    fail('recipes/shards/*.json has zero recipe paths');
  }
  return { recipeIndex, recipeIds, namespaces };
}
