#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { BundleOptimizeError } from '../src/util.mjs';
import { optimizeBundle, printOptimizeOk } from '../src/optimize.mjs';
import { printValidationOk, validateBundle } from '../src/validate.mjs';

const HELP = `emi-bundle-optimize — Phase 2b offline EMI bundle tooling

Usage:
  emi-bundle-optimize validate <bundle-dir>
  emi-bundle-optimize optimize --in <raw-dir> --out <optimized-dir> [--force]

Commands:
  validate   Contract check (same rules as recipe-viewer validate)
  optimize   v1: copy raw bundle, set bundle.json profile=optimized, write optimize-report.json

Options:
  --force    Remove existing output directory before optimize
  --report   Write optimize-report.json to this path (default: <out>/optimize-report.json)
  -h, --help Show help
`;

function printHelp() {
  console.log(HELP);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    printHelp();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  const command = argv[0];

  try {
    if (command === 'validate') {
      const bundleDir = argv[1] || process.env.EMI_BUNDLE_ROOT;
      if (!bundleDir) {
        console.error('validate: missing bundle directory (argv[1] or EMI_BUNDLE_ROOT)');
        process.exit(1);
      }
      const result = validateBundle(bundleDir);
      printValidationOk(result);
      return;
    }

    if (command === 'optimize') {
      const { values } = parseArgs({
        args: argv.slice(1),
        options: {
          in: { type: 'string' },
          out: { type: 'string' },
          force: { type: 'boolean', default: false },
          report: { type: 'string' },
        },
        allowPositionals: false,
      });

      if (!values.in || !values.out) {
        console.error('optimize: requires --in <raw-dir> and --out <optimized-dir>');
        process.exit(1);
      }

      const result = optimizeBundle({
        inDir: values.in,
        outDir: values.out,
        force: values.force,
        reportPath: values.report,
      });
      printOptimizeOk(result);
      return;
    }

    console.error(`unknown command: ${command}`);
    printHelp();
    process.exit(1);
  } catch (err) {
    if (err instanceof BundleOptimizeError) {
      console.error(`FAIL: ${err.message}`);
      process.exit(1);
    }
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
