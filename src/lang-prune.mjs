import fs from 'node:fs';
import path from 'node:path';

import { forEachLayout } from './layouts.mjs';
import { readJson, writeJson } from './util.mjs';
import {
  collectGtceuComposedLangKeys,
} from './gtceu-composed-keys.mjs';

function stripRegistryId(id) {
  if (!id) return '';
  let s = String(id);
  const brace = s.indexOf('{');
  if (brace >= 0) s = s.slice(0, brace);
  const at = s.indexOf('@');
  if (at >= 0) s = s.slice(0, at);
  return s;
}

function registryLangKeyCandidates(kind, registryId) {
  const id = stripRegistryId(registryId);
  if (!id) return [];
  const dotted = id.replace(/\//g, '.').replace(/:/g, '.');
  let prefixes;
  if (kind === 'fluid') {
    prefixes = ['fluid', 'item', 'block'];
  } else if (kind === 'block') {
    prefixes = ['block', 'item'];
  } else {
    prefixes = ['item', 'block', 'fluid'];
  }
  return prefixes.map((p) => `${p}.${dotted}`);
}

function addRegistryKeys(usedKeys, kind, id, langTables = null) {
  for (const key of registryLangKeyCandidates(kind, id)) {
    usedKeys.add(key);
  }
  if (langTables) {
    for (const key of collectGtceuComposedLangKeys(kind, id, langTables)) {
      usedKeys.add(key);
    }
  }
}

function addTagKeys(usedKeys, tagId) {
  if (!tagId) return;
  const dotted = String(tagId).replace(/\//g, '.').replace(/:/g, '.');
  usedKeys.add(`tag.item.${dotted}`);
  usedKeys.add(`tag.block.${dotted}`);
  usedKeys.add(`tag.fluid.${dotted}`);
}

function collectFluidFromNbt(usedKeys, nbt, langTables) {
  if (!nbt || typeof nbt !== 'string') return;
  const match = nbt.match(/FluidName:"([^"]+)"/);
  if (!match) return;
  addRegistryKeys(usedKeys, 'fluid', match[1], langTables);
}

function collectLayoutKeys(usedKeys, layout, langTables) {
  for (const widget of layout?.widgets || []) {
    if (typeof widget?.translationKey === 'string' && widget.translationKey.length > 0) {
      usedKeys.add(widget.translationKey);
    }
    collectIngredientKeys(usedKeys, widget?.ingredient, langTables);
  }
}

function collectIngredientKeys(usedKeys, ingredient, langTables) {
  if (ingredient == null) return;
  if (Array.isArray(ingredient)) {
    for (const entry of ingredient) collectIngredientKeys(usedKeys, entry, langTables);
    return;
  }
  if (typeof ingredient === 'string') {
    if (ingredient.startsWith('#item:')) {
      addTagKeys(usedKeys, ingredient.slice(6));
      return;
    }
    if (ingredient.startsWith('#block:')) {
      addTagKeys(usedKeys, ingredient.slice(7));
      return;
    }
    if (ingredient.startsWith('#fluid:')) {
      addTagKeys(usedKeys, ingredient.slice(7));
      return;
    }
    if (ingredient.startsWith('item:')) {
      addRegistryKeys(usedKeys, 'item', ingredient.slice(5), langTables);
      return;
    }
    if (ingredient.startsWith('fluid:')) {
      const body = ingredient.slice(6);
      const idx = body.lastIndexOf(':');
      const fluidId = idx > 0 ? body.slice(0, idx) : body;
      addRegistryKeys(usedKeys, 'fluid', fluidId, langTables);
      return;
    }
    addRegistryKeys(usedKeys, 'item', ingredient, langTables);
    return;
  }
  if (typeof ingredient !== 'object') return;
  if (ingredient.type === 'item' && ingredient.id) {
    addRegistryKeys(usedKeys, 'item', ingredient.id, langTables);
    collectFluidFromNbt(usedKeys, ingredient.nbt, langTables);
    return;
  }
  if (ingredient.type === 'fluid' && ingredient.id) {
    addRegistryKeys(usedKeys, 'fluid', ingredient.id, langTables);
    return;
  }
  if (ingredient.id) addRegistryKeys(usedKeys, 'item', ingredient.id, langTables);
}

function collectItemIndexKeys(usedKeys, bundleRoot, langTables) {
  const indexPath = path.join(bundleRoot, 'items/index.json');
  if (!fs.existsSync(indexPath)) return;
  const index = readJson(indexPath);
  if (!index || typeof index !== 'object') return;
  for (const [ns, paths] of Object.entries(index)) {
    if (ns === 'schema' || !Array.isArray(paths)) continue;
    for (const itemPath of paths) {
      if (typeof itemPath !== 'string' || itemPath.length === 0) continue;
      addRegistryKeys(usedKeys, 'item', `${ns}:${itemPath}`, langTables);
    }
  }
}

function readLangTables(bundleRoot) {
  const langDir = path.join(bundleRoot, 'lang');
  if (!fs.existsSync(langDir)) return [];
  const tables = [];
  for (const name of fs.readdirSync(langDir)) {
    if (!name.endsWith('.json')) continue;
    tables.push(readJson(path.join(langDir, name)));
  }
  return tables;
}

function collectFluidIndexKeys(usedKeys, bundleRoot, langTables) {
  const indexPath = path.join(bundleRoot, 'items/index.json');
  if (!fs.existsSync(indexPath)) return;
  const index = readJson(indexPath);
  if (!index || typeof index !== 'object') return;
  const fluidPaths = index.fluid;
  if (!Array.isArray(fluidPaths)) return;
  for (const fluidPath of fluidPaths) {
    if (typeof fluidPath !== 'string' || fluidPath.length === 0) continue;
    const colon = fluidPath.indexOf(':');
    const ns = colon > 0 ? fluidPath.slice(0, colon) : 'minecraft';
    const fluidId = colon > 0 ? fluidPath.slice(colon + 1) : fluidPath;
    addRegistryKeys(usedKeys, 'fluid', `${ns}:${fluidId}`, langTables);
  }
}

function emiCategoryLangKey(categoryId) {
  if (!categoryId) return null;
  return `emi.category.${String(categoryId).replace(':', '.').replace(/\//g, '.')}`;
}

function collectLayoutCategoryKeys(usedKeys, layout) {
  const key = emiCategoryLangKey(layout?.category);
  if (key) usedKeys.add(key);
}

function collectCategoryManifestKeys(usedKeys, bundleRoot, langTables) {
  const categoriesPath = path.join(bundleRoot, 'categories/index.json');
  if (!fs.existsSync(categoriesPath)) return;
  const manifest = readJson(categoriesPath);
  for (const entry of manifest?.categories || []) {
    if (typeof entry?.nameKey === 'string' && entry.nameKey.length > 0) {
      usedKeys.add(entry.nameKey);
    }
    const categoryKey = emiCategoryLangKey(entry?.id);
    if (categoryKey) usedKeys.add(categoryKey);
    if (entry?.iconItem) addRegistryKeys(usedKeys, 'item', entry.iconItem, langTables);
    if (entry?.iconKey) addRegistryKeys(usedKeys, 'item', entry.iconKey, langTables);
  }
}

function collectTagIndexKeys(usedKeys, bundleRoot) {
  const tagsIndexPath = path.join(bundleRoot, 'tags/index.json');
  if (!fs.existsSync(tagsIndexPath)) return;
  const tagsIndex = readJson(tagsIndexPath);
  for (const bucket of ['items', 'blocks', 'fluids']) {
    for (const tagId of tagsIndex?.[bucket] || []) {
      if (typeof tagId === 'string' && tagId.length > 0) addTagKeys(usedKeys, tagId);
    }
  }
}

function collectUsedLangKeys(bundleRoot) {
  const usedKeys = new Set();
  const langTables = readLangTables(bundleRoot);
  forEachLayout(bundleRoot, (layout) => {
    collectLayoutCategoryKeys(usedKeys, layout);
    collectLayoutKeys(usedKeys, layout, langTables);
  });
  collectItemIndexKeys(usedKeys, bundleRoot, langTables);
  collectFluidIndexKeys(usedKeys, bundleRoot, langTables);
  collectCategoryManifestKeys(usedKeys, bundleRoot, langTables);
  collectTagIndexKeys(usedKeys, bundleRoot);
  return usedKeys;
}

export function pruneLangFiles(bundleRoot, options = {}) {
  const write = options.write !== false;
  const langDir = path.join(bundleRoot, 'lang');
  if (!fs.existsSync(langDir)) {
    return {
      enabled: true,
      write,
      fileCount: 0,
      totalKeysBefore: 0,
      totalKeysAfter: 0,
      totalBytesBefore: 0,
      totalBytesAfter: 0,
      totalRemovedKeys: 0,
      files: [],
    };
  }
  const usedKeys = collectUsedLangKeys(bundleRoot);
  const files = [];
  let totalKeysBefore = 0;
  let totalKeysAfter = 0;
  let totalBytesBefore = 0;
  let totalBytesAfter = 0;
  let totalRemovedKeys = 0;
  for (const name of fs.readdirSync(langDir)) {
    if (!name.endsWith('.json')) continue;
    const filePath = path.join(langDir, name);
    const raw = fs.readFileSync(filePath, 'utf8');
    const table = readJson(filePath);
    const beforeEntries = Object.entries(table || {});
    totalKeysBefore += beforeEntries.length;
    totalBytesBefore += Buffer.byteLength(raw, 'utf8');
    const pruned = {};
    for (const [key, value] of beforeEntries) {
      if (usedKeys.has(key)) pruned[key] = value;
    }
    const nextText = `${JSON.stringify(pruned, null, 2)}\n`;
    const afterEntries = Object.keys(pruned).length;
    totalKeysAfter += afterEntries;
    totalBytesAfter += Buffer.byteLength(nextText, 'utf8');
    totalRemovedKeys += beforeEntries.length - afterEntries;
    if (write) writeJson(filePath, pruned);
    files.push({
      locale: name.replace(/\.json$/, ''),
      beforeKeys: beforeEntries.length,
      afterKeys: afterEntries,
      beforeBytes: Buffer.byteLength(raw, 'utf8'),
      afterBytes: Buffer.byteLength(nextText, 'utf8'),
    });
  }
  return {
    enabled: true,
    write,
    fileCount: files.length,
    totalKeysBefore,
    totalKeysAfter,
    totalBytesBefore,
    totalBytesAfter,
    totalRemovedKeys,
    files,
  };
}
