import fs from 'node:fs';
import path from 'node:path';

import { forEachRecipeMeta } from './recipe-meta.mjs';
import { readJson, writeJson } from './util.mjs';
import {
  buildGtceuPruneContext,
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

function addRegistryKeys(usedKeys, kind, id, gtceuCtx = null) {
  for (const key of registryLangKeyCandidates(kind, id)) {
    usedKeys.add(key);
  }
  if (gtceuCtx) {
    for (const key of collectGtceuComposedLangKeys(kind, id, gtceuCtx)) {
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

function collectFluidFromNbt(usedKeys, nbt, gtceuCtx) {
  if (!nbt || typeof nbt !== 'string') return;
  const match = nbt.match(/FluidName:"([^"]+)"/);
  if (!match) return;
  addRegistryKeys(usedKeys, 'fluid', match[1], gtceuCtx);
}

function collectLayoutKeys(usedKeys, layout, gtceuCtx) {
  for (const widget of layout?.widgets || []) {
    if (typeof widget?.translationKey === 'string' && widget.translationKey.length > 0) {
      usedKeys.add(widget.translationKey);
    }
    collectIngredientKeys(usedKeys, widget?.ingredient, gtceuCtx);
  }
}

function collectInteractionKeys(usedKeys, interaction, gtceuCtx) {
  if (!interaction || typeof interaction !== 'object') return;
  const kind = interaction.kind;
  if (kind === 'item' && interaction.id) {
    addRegistryKeys(usedKeys, 'item', interaction.id, gtceuCtx);
    collectFluidFromNbt(usedKeys, interaction.nbt, gtceuCtx);
    return;
  }
  if (kind === 'fluid' && interaction.id) {
    addRegistryKeys(usedKeys, 'fluid', interaction.id, gtceuCtx);
    return;
  }
  if (kind === 'tag' && interaction.tag) {
    addTagKeys(usedKeys, interaction.tag);
    if (interaction.displayId) {
      addRegistryKeys(usedKeys, 'item', interaction.displayId, gtceuCtx);
    }
    return;
  }
  if (kind === 'list' && Array.isArray(interaction.entries)) {
    for (const entry of interaction.entries) {
      collectInteractionKeys(usedKeys, entry, gtceuCtx);
    }
  }
}

function collectMetaKeys(usedKeys, meta, gtceuCtx) {
  collectLayoutCategoryKeys(usedKeys, meta);
  for (const widget of meta?.widgets || []) {
    collectInteractionKeys(usedKeys, widget?.interaction, gtceuCtx);
  }
}

function collectIngredientKeys(usedKeys, ingredient, gtceuCtx) {
  if (ingredient == null) return;
  if (Array.isArray(ingredient)) {
    for (const entry of ingredient) collectIngredientKeys(usedKeys, entry, gtceuCtx);
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
      addRegistryKeys(usedKeys, 'item', ingredient.slice(5), gtceuCtx);
      return;
    }
    if (ingredient.startsWith('fluid:')) {
      const body = ingredient.slice(6);
      const idx = body.lastIndexOf(':');
      const fluidId = idx > 0 ? body.slice(0, idx) : body;
      addRegistryKeys(usedKeys, 'fluid', fluidId, gtceuCtx);
      return;
    }
    addRegistryKeys(usedKeys, 'item', ingredient, gtceuCtx);
    return;
  }
  if (typeof ingredient !== 'object') return;
  if (ingredient.type === 'item' && ingredient.id) {
    addRegistryKeys(usedKeys, 'item', ingredient.id, gtceuCtx);
    collectFluidFromNbt(usedKeys, ingredient.nbt, gtceuCtx);
    return;
  }
  if (ingredient.type === 'fluid' && ingredient.id) {
    addRegistryKeys(usedKeys, 'fluid', ingredient.id, gtceuCtx);
    return;
  }
  if (ingredient.id) addRegistryKeys(usedKeys, 'item', ingredient.id, gtceuCtx);
}

function collectItemIndexKeys(usedKeys, bundleRoot, gtceuCtx) {
  const indexPath = path.join(bundleRoot, 'items/index.json');
  if (!fs.existsSync(indexPath)) return;
  const index = readJson(indexPath);
  if (!index || typeof index !== 'object') return;
  for (const [ns, paths] of Object.entries(index)) {
    if (ns === 'schema' || !Array.isArray(paths)) continue;
    for (const itemPath of paths) {
      if (typeof itemPath !== 'string' || itemPath.length === 0) continue;
      addRegistryKeys(usedKeys, 'item', `${ns}:${itemPath}`, gtceuCtx);
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

function collectFluidIndexKeys(usedKeys, bundleRoot, gtceuCtx) {
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
    addRegistryKeys(usedKeys, 'fluid', `${ns}:${fluidId}`, gtceuCtx);
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

function collectCategoryManifestKeys(usedKeys, bundleRoot, gtceuCtx) {
  const categoriesPath = path.join(bundleRoot, 'categories/index.json');
  if (!fs.existsSync(categoriesPath)) return;
  const manifest = readJson(categoriesPath);
  for (const entry of manifest?.categories || []) {
    if (typeof entry?.nameKey === 'string' && entry.nameKey.length > 0) {
      usedKeys.add(entry.nameKey);
    }
    const categoryKey = emiCategoryLangKey(entry?.id);
    if (categoryKey) usedKeys.add(categoryKey);
    if (entry?.iconItem) addRegistryKeys(usedKeys, 'item', entry.iconItem, gtceuCtx);
    if (entry?.iconKey) addRegistryKeys(usedKeys, 'item', entry.iconKey, gtceuCtx);
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

/** GTCEu composed labels: keep material/tagprefix/fluid templates (see emi-recipe-renderer/gtceu-translate.js). */
function isGtceuTranslationKey(key) {
  return key.startsWith('material.gtceu.')
    || key.startsWith('tagprefix.')
    || key.startsWith('gtceu.fluid.')
    || key === 'item.gtceu.bucket';
}

/** EMI recipe category tabs (emi.category.*) — keep full locale tables, not only keys seen in layouts. */
function isEmiCategoryLangKey(key) {
  return key.startsWith('emi.category.');
}

function shouldKeepLangKey(key, usedKeys) {
  if (usedKeys.has(key)) return true;
  return isGtceuTranslationKey(key) || isEmiCategoryLangKey(key);
}

function collectUsedLangKeys(bundleRoot, log) {
  const usedKeys = new Set();
  const langTables = readLangTables(bundleRoot);
  const gtceuCtx = buildGtceuPruneContext(langTables);
  forEachRecipeMeta(bundleRoot, (meta) => {
    collectMetaKeys(usedKeys, meta, gtceuCtx);
  }, { log, progressEvery: 10_000, progressLabel: 'lang prune scan' });
  if (log) log('[emi-bundle-optimize]   lang prune: item index + categories + tags ...');
  collectItemIndexKeys(usedKeys, bundleRoot, gtceuCtx);
  collectFluidIndexKeys(usedKeys, bundleRoot, gtceuCtx);
  collectCategoryManifestKeys(usedKeys, bundleRoot, gtceuCtx);
  collectTagIndexKeys(usedKeys, bundleRoot);
  return usedKeys;
}

export function pruneLangFiles(bundleRoot, options = {}) {
  const write = options.write !== false;
  const log = options.log ?? (() => {});
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
  const usedKeys = collectUsedLangKeys(bundleRoot, log);
  log(`[emi-bundle-optimize]   used lang keys: ${usedKeys.size}`);
  const files = [];
  let totalKeysBefore = 0;
  let totalKeysAfter = 0;
  let totalBytesBefore = 0;
  let totalBytesAfter = 0;
  let totalRemovedKeys = 0;
  for (const name of fs.readdirSync(langDir)) {
    if (!name.endsWith('.json')) continue;
    const locale = name.replace(/\.json$/, '');
    const filePath = path.join(langDir, name);
    const raw = fs.readFileSync(filePath, 'utf8');
    const table = readJson(filePath);
    const beforeEntries = Object.entries(table || {});
    totalKeysBefore += beforeEntries.length;
    totalBytesBefore += Buffer.byteLength(raw, 'utf8');
    const pruned = {};
    for (const [key, value] of beforeEntries) {
      if (shouldKeepLangKey(key, usedKeys)) pruned[key] = value;
    }
    const nextText = `${JSON.stringify(pruned, null, 2)}\n`;
    const afterEntries = Object.keys(pruned).length;
    totalKeysAfter += afterEntries;
    totalBytesAfter += Buffer.byteLength(nextText, 'utf8');
    totalRemovedKeys += beforeEntries.length - afterEntries;
    if (write) {
      log(`[emi-bundle-optimize]   lang prune write ${locale}: ${beforeEntries.length} -> ${afterEntries} keys`);
      writeJson(filePath, pruned);
    }
    files.push({
      locale,
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
