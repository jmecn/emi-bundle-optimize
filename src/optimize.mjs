import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readRecipeBundle } from './layouts.mjs';
import { collectTreeStats, formatBytes } from './stats.mjs';
import { convertIconAtlasesToWebp } from './webp-icons.mjs';
import { pruneLangFiles } from './lang-prune.mjs';

const packageRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PACKAGE_VERSION = JSON.parse(
  fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
).version;

/**
 * @param {{
 *   inDir: string,
 *   outDir: string,
 *   force?: boolean,
 *   reportPath?: string,
 *   webp?: boolean,
 *   webpQuality?: number,
 *   keepPng?: boolean,
 *   dryRun?: boolean,
 *   pruneLang?: boolean,
 * }} options
 */
export async function optimizeBundle(options) {
  const inDir = path.resolve(options.inDir);
  const outDir = path.resolve(options.outDir);
  const force = Boolean(options.force);
  const webp = options.webp !== false;
  const webpQuality = options.webpQuality ?? 88;
  const keepPng = Boolean(options.keepPng);
  const dryRun = Boolean(options.dryRun);
  const pruneLang = Boolean(options.pruneLang);

  if (inDir === outDir) {
    throw new Error('input and output directories must differ');
  }

  const inStats = collectTreeStats(inDir);
  const inputBundle = readRecipeBundle(inDir);
  const recipeCount = inputBundle.recipeCount ?? null;

  if (dryRun) {
    const lang = pruneLang ? pruneLangFiles(inDir, { write: false }) : null;
    const report = {
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
      lang,
    };
    return { report, reportPath: null };
  }

  if (fs.existsSync(outDir)) {
    const existing = fs.readdirSync(outDir);
    if (existing.length > 0 && !force) {
      throw new Error(
        `output directory is not empty: ${outDir} (use --force to overwrite after removing contents)`,
      );
    }
    if (force) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }

  const startedAt = Date.now();
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(inDir, outDir, { recursive: true, dereference: true });

  let webpResult = null;
  if (webp) {
    webpResult = await convertIconAtlasesToWebp(path.join(outDir, 'icons'), {
      quality: webpQuality,
      keepPng,
    });
  }
  const langResult = pruneLang ? pruneLangFiles(outDir, { write: true }) : null;

  const bundlePath = path.join(outDir, 'bundle.json');
  const bundle = readRecipeBundle(outDir);
  bundle.profile = 'optimized';
  bundle.optimizedBy = `emi-bundle-optimize@${PACKAGE_VERSION}`;
  bundle.optimizedFrom = inDir;
  bundle.optimizedAt = new Date().toISOString();
  if (webp && webpResult?.converted?.length) {
    bundle.iconAtlases = keepPng ? 'webp+png' : 'webp';
  }
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');

  const outStats = collectTreeStats(outDir);
  const elapsedMs = Date.now() - startedAt;

  const report = {
    tool: 'emi-bundle-optimize',
    version: PACKAGE_VERSION,
    input: inDir,
    output: outDir,
    elapsedMs,
    inputStats: inStats,
    outputStats: outStats,
    recipeCount: bundle.recipeCount ?? recipeCount,
    profile: bundle.profile,
    webp: webpResult,
    lang: langResult,
  };

  const defaultReportPath = path.join(outDir, 'optimize-report.json');
  const reportPath = options.reportPath ? path.resolve(options.reportPath) : defaultReportPath;
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return { report, reportPath };
}

export function printOptimizeOk(result) {
  const { report, reportPath } = result;
  if (report.dryRun) {
    console.log(`OK: dry-run -> ${report.input}`);
    if (report.recipeCount != null) {
      console.log(`  recipes: ${report.recipeCount}`);
    }
    console.log(`  size: ${formatBytes(report.inputStats.byteCount)} (${report.inputStats.fileCount} files)`);
    if (report.webp) {
      console.log(`  webp: enabled (quality=${report.webp.quality}, keepPng=${Boolean(report.webp.keepPng)})`);
    } else {
      console.log('  webp: disabled');
    }
    if (report.lang?.enabled) {
      console.log(
        `  lang: ${report.lang.totalKeysBefore} -> ${report.lang.totalKeysAfter} keys (removed ${report.lang.totalRemovedKeys})`,
      );
    }
    return;
  }
  console.log(`OK: optimized bundle -> ${report.output}`);
  console.log(`  profile: ${report.profile}`);
  if (report.recipeCount != null) {
    console.log(`  recipes: ${report.recipeCount}`);
  }
  console.log(
    `  size: ${formatBytes(report.inputStats.byteCount)} -> ${formatBytes(report.outputStats.byteCount)} (${report.inputStats.fileCount} -> ${report.outputStats.fileCount} files)`,
  );
  const webp = report.webp?.converted;
  if (webp?.length) {
    const saved = webp.reduce((n, entry) => n + (entry.pngBytes - entry.webpBytes), 0);
    console.log(
      `  icon atlases: ${webp.length} PNG -> WebP (saved ~${formatBytes(Math.max(0, saved))})`,
    );
  }
  if (report.lang?.enabled) {
    console.log(
      `  lang keys: ${report.lang.totalKeysBefore} -> ${report.lang.totalKeysAfter} (removed ${report.lang.totalRemovedKeys})`,
    );
  }
  console.log(`  elapsed: ${report.elapsedMs} ms`);
  if (reportPath) console.log(`  report: ${reportPath}`);
}
