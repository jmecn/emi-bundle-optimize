import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJson } from './util.mjs';
import { collectTreeStats, formatBytes } from './stats.mjs';
import { validateBundle } from './validate.mjs';

const packageRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PACKAGE_VERSION = JSON.parse(
  fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
).version;

/**
 * Phase 2b v1: validate raw bundle, copy tree, stamp bundle.json for optimized profile.
 * @param {{ inDir: string, outDir: string, force?: boolean, reportPath?: string }} options
 */
export function optimizeBundle(options) {
  const inDir = path.resolve(options.inDir);
  const outDir = path.resolve(options.outDir);
  const force = Boolean(options.force);

  if (inDir === outDir) {
    throw new Error('input and output directories must differ');
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

  const validation = validateBundle(inDir);
  const inStats = collectTreeStats(inDir);

  const startedAt = Date.now();
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(inDir, outDir, { recursive: true, dereference: true });

  const bundlePath = path.join(outDir, 'bundle.json');
  const bundle = readJson(bundlePath);
  bundle.profile = 'optimized';
  bundle.optimizedBy = `emi-bundle-optimize@${PACKAGE_VERSION}`;
  bundle.optimizedFrom = inDir;
  bundle.optimizedAt = new Date().toISOString();
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');

  const outStats = collectTreeStats(outDir);
  const elapsedMs = Date.now() - startedAt;

  const report = {
    tool: 'emi-bundle-optimize',
    version: PACKAGE_VERSION,
    phase: '2b-v1',
    input: inDir,
    output: outDir,
    elapsedMs,
    inputStats: inStats,
    outputStats: outStats,
    recipeCount: validation.recipeCount,
    profile: bundle.profile,
  };

  const defaultReportPath = path.join(outDir, 'optimize-report.json');
  const reportPath = options.reportPath ? path.resolve(options.reportPath) : defaultReportPath;
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return { report, reportPath, validation };
}

export function printOptimizeOk(result) {
  const { report, reportPath } = result;
  console.log(`OK: optimized bundle -> ${report.output}`);
  console.log(`  profile: ${report.profile}`);
  console.log(`  recipes: ${report.recipeCount}`);
  console.log(
    `  size: ${formatBytes(report.inputStats.byteCount)} -> ${formatBytes(report.outputStats.byteCount)} (${report.inputStats.fileCount} files)`,
  );
  console.log(`  elapsed: ${report.elapsedMs} ms`);
  console.log(`  report: ${reportPath}`);
}
