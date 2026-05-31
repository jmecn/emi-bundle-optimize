import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readBundleJson } from './layouts.mjs';
import { pruneLangFiles } from './lang-prune.mjs';
import { collectTreeStats, formatBytes } from './stats.mjs';
import { readJson, writeJson } from './util.mjs';
import { convertIconAtlasesToWebp } from './webp-icons.mjs';
import { convertRecipeCardsToWebp } from './webp-recipes.mjs';

const packageRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PACKAGE_VERSION = readJson(path.join(packageRoot, 'package.json')).version;

const LEGACY_V1_DIRS = [
  'recipes/routes',
  'recipes/layout-packs',
  'chrome',
];

function stripLegacyV1Artifacts(outDir, log) {
  for (const rel of LEGACY_V1_DIRS) {
    const target = path.join(outDir, rel);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    log(`[emi-bundle-optimize] removed legacy ${rel}`);
  }
}

function prepareOutDir(outDir, force) {
  if (!fs.existsSync(outDir)) return;
  if (fs.readdirSync(outDir).length > 0 && !force) {
    throw new Error(
      `output directory is not empty: ${outDir} (use --force to overwrite after removing contents)`,
    );
  }
  if (force) fs.rmSync(outDir, { recursive: true, force: true });
}

function stampBundle(bundle, { inDir, webp, webpResult, recipeWebpResult, keepPng }) {
  bundle.profile = 'optimized';
  bundle.optimizedBy = `emi-bundle-optimize@${PACKAGE_VERSION}`;
  bundle.optimizedFrom = inDir;
  bundle.optimizedAt = new Date().toISOString();
  if (webp && webpResult?.converted?.length) {
    bundle.iconAtlases = keepPng ? 'webp+png' : 'webp';
  }
  if (recipeWebpResult?.converted?.length) {
    bundle.recipeImageFormat = 'webp';
  } else if (bundle.recipeImageFormat == null) {
    bundle.recipeImageFormat = 'png';
  }
  return bundle;
}

export async function optimizeBundle(options) {
  const inDir = path.resolve(options.inDir);
  const outDir = path.resolve(options.outDir);
  const webp = options.webp !== false;
  const recipeWebp = webp && options.recipeWebp !== false;
  const webpQuality = options.webpQuality ?? 98;
  const keepPng = Boolean(options.keepPng);
  const pruneLang = Boolean(options.pruneLang);

  if (inDir === outDir) {
    throw new Error('input and output directories must differ');
  }

  const log = options.log ?? ((msg) => console.log(msg));
  log('[emi-bundle-optimize] scanning input tree stats ...');
  const inStats = collectTreeStats(inDir);
  const recipeCount = readBundleJson(inDir).recipeCount ?? null;

  if (options.dryRun) {
    return {
      report: {
        tool: 'emi-bundle-optimize',
        version: PACKAGE_VERSION,
        dryRun: true,
        input: inDir,
        output: outDir,
        elapsedMs: 0,
        inputStats: inStats,
        outputStats: inStats,
        recipeCount,
        profile: 'raw',
        webp: webp ? { skipped: true, converted: [], quality: webpQuality, keepPng } : null,
        recipeWebp: recipeWebp ? { skipped: true, converted: [] } : { skipped: true, reason: 'disabled' },
        lang: pruneLang ? pruneLangFiles(inDir, { write: false }) : null,
      },
      reportPath: null,
    };
  }

  prepareOutDir(outDir, Boolean(options.force));
  const startedAt = Date.now();

  log(`[emi-bundle-optimize] copy ${inDir} -> ${outDir} ...`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(inDir, outDir, { recursive: true, dereference: true });
  stripLegacyV1Artifacts(outDir, log);
  log(`[emi-bundle-optimize] copy done (${Date.now() - startedAt} ms)`);

  let webpResult = null;
  let recipeWebpResult = null;
  if (webp) {
    log('[emi-bundle-optimize] WebP icon atlases ...');
    webpResult = await convertIconAtlasesToWebp(path.join(outDir, 'icons'), {
      quality: webpQuality,
      keepPng,
      log,
    });
    if (recipeWebp) {
      log('[emi-bundle-optimize] WebP recipe card images ...');
      recipeWebpResult = await convertRecipeCardsToWebp(outDir, {
        quality: webpQuality,
        keepPng,
        log,
      });
    } else {
      log('[emi-bundle-optimize] WebP recipe card images skipped (--no-recipe-webp)');
      recipeWebpResult = { converted: [], skipped: true, reason: 'disabled' };
    }
    log(`[emi-bundle-optimize] WebP done (${Date.now() - startedAt} ms)`);
  }

  let langResult = null;
  if (pruneLang) {
    log('[emi-bundle-optimize] lang prune (scan recipe meta + item index) ...');
    langResult = pruneLangFiles(outDir, { write: true, log });
    log(`[emi-bundle-optimize] lang prune done (${Date.now() - startedAt} ms)`);
  }

  const bundle = stampBundle(readBundleJson(outDir), {
    inDir,
    webp,
    webpResult,
    recipeWebpResult,
    keepPng,
  });
  writeJson(path.join(outDir, 'bundle.json'), bundle);

  const reportPath = options.reportPath
    ? path.resolve(options.reportPath)
    : path.join(outDir, 'optimize-report.json');
  const report = {
    tool: 'emi-bundle-optimize',
    version: PACKAGE_VERSION,
    input: inDir,
    output: outDir,
    elapsedMs: Date.now() - startedAt,
    inputStats: inStats,
    outputStats: collectTreeStats(outDir),
    recipeCount: bundle.recipeCount ?? recipeCount,
    profile: bundle.profile,
    webp: webpResult,
    recipeWebp: recipeWebpResult,
    lang: langResult,
  };
  writeJson(reportPath, report);

  return { report, reportPath };
}

function logRecipeCount(recipeCount) {
  if (recipeCount != null) console.log(`  recipes: ${recipeCount}`);
}

function logLangSummary(lang) {
  if (!lang?.enabled) return;
  const { totalKeysBefore, totalKeysAfter, totalRemovedKeys } = lang;
  console.log(
    `  lang keys: ${totalKeysBefore} -> ${totalKeysAfter} (removed ${totalRemovedKeys})`,
  );
}

export function printOptimizeOk({ report, reportPath }) {
  if (report.dryRun) {
    console.log(`OK: dry-run -> ${report.input}`);
    logRecipeCount(report.recipeCount);
    console.log(`  size: ${formatBytes(report.inputStats.byteCount)} (${report.inputStats.fileCount} files)`);
    if (report.webp) {
      console.log(`  webp: enabled (quality=${report.webp.quality}, keepPng=${Boolean(report.webp.keepPng)})`);
    } else {
      console.log('  webp: disabled');
    }
    if (report.lang) {
      console.log(
        `  lang: ${report.lang.totalKeysBefore} -> ${report.lang.totalKeysAfter} keys (removed ${report.lang.totalRemovedKeys})`,
      );
    }
    return;
  }

  console.log(`OK: optimized bundle -> ${report.output}`);
  console.log(`  profile: ${report.profile}`);
  logRecipeCount(report.recipeCount);
  console.log(
    `  size: ${formatBytes(report.inputStats.byteCount)} -> ${formatBytes(report.outputStats.byteCount)} (${report.inputStats.fileCount} -> ${report.outputStats.fileCount} files)`,
  );

  const iconConverted = report.webp?.converted;
  if (iconConverted?.length) {
    const saved = iconConverted.reduce((n, e) => n + (e.pngBytes - e.webpBytes), 0);
    console.log(`  icon atlases: ${iconConverted.length} PNG -> WebP (saved ~${formatBytes(Math.max(0, saved))})`);
  }
  const recipeConverted = report.recipeWebp?.converted;
  if (recipeConverted?.length) {
    const saved = (report.recipeWebp.pngBytes ?? 0) - (report.recipeWebp.webpBytes ?? 0);
    console.log(
      `  recipe images: ${recipeConverted.length} PNG -> WebP (saved ~${formatBytes(Math.max(0, saved))})`,
    );
  }
  logLangSummary(report.lang);
  console.log(`  elapsed: ${report.elapsedMs} ms`);
  if (reportPath) console.log(`  report: ${reportPath}`);
}
