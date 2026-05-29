import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readBundleJson } from './layouts.mjs';
import { pruneLangFiles } from './lang-prune.mjs';
import { collectTreeStats, formatBytes } from './stats.mjs';
import { readJson, writeJson } from './util.mjs';
import { convertIconAtlasesToWebp } from './webp-icons.mjs';

const packageRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PACKAGE_VERSION = readJson(path.join(packageRoot, 'package.json')).version;

function prepareOutDir(outDir, force) {
  if (!fs.existsSync(outDir)) return;
  if (fs.readdirSync(outDir).length > 0 && !force) {
    throw new Error(
      `output directory is not empty: ${outDir} (use --force to overwrite after removing contents)`,
    );
  }
  if (force) fs.rmSync(outDir, { recursive: true, force: true });
}

function stampBundle(bundle, { inDir, webp, webpResult, keepPng }) {
  bundle.profile = 'optimized';
  bundle.optimizedBy = `emi-bundle-optimize@${PACKAGE_VERSION}`;
  bundle.optimizedFrom = inDir;
  bundle.optimizedAt = new Date().toISOString();
  if (webp && webpResult?.converted?.length) {
    bundle.iconAtlases = keepPng ? 'webp+png' : 'webp';
  }
  return bundle;
}

export async function optimizeBundle(options) {
  const inDir = path.resolve(options.inDir);
  const outDir = path.resolve(options.outDir);
  const webp = options.webp !== false;
  const webpQuality = options.webpQuality ?? 98;
  const keepPng = Boolean(options.keepPng);
  const pruneLang = Boolean(options.pruneLang);

  if (inDir === outDir) {
    throw new Error('input and output directories must differ');
  }

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
        lang: pruneLang ? pruneLangFiles(inDir, { write: false }) : null,
      },
      reportPath: null,
    };
  }

  prepareOutDir(outDir, Boolean(options.force));
  const startedAt = Date.now();
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(inDir, outDir, { recursive: true, dereference: true });

  const webpResult = webp
    ? await convertIconAtlasesToWebp(path.join(outDir, 'icons'), { quality: webpQuality, keepPng })
    : null;
  const langResult = pruneLang ? pruneLangFiles(outDir, { write: true }) : null;

  const bundle = stampBundle(readBundleJson(outDir), { inDir, webp, webpResult, keepPng });
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

  const converted = report.webp?.converted;
  if (converted?.length) {
    const saved = converted.reduce((n, e) => n + (e.pngBytes - e.webpBytes), 0);
    console.log(`  icon atlases: ${converted.length} PNG -> WebP (saved ~${formatBytes(Math.max(0, saved))})`);
  }
  logLangSummary(report.lang);
  console.log(`  elapsed: ${report.elapsedMs} ms`);
  if (reportPath) console.log(`  report: ${reportPath}`);
}
