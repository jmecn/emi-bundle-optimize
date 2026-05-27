import fs from 'node:fs';
import path from 'node:path';

export class BundleOptimizeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BundleOptimizeError';
  }
}

export function fail(message) {
  throw new BundleOptimizeError(message);
}

export function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`invalid JSON: ${filePath} (${err.message})`);
  }
}

export function assertFile(bundleRoot, rel) {
  const abs = path.join(bundleRoot, rel);
  if (!fs.existsSync(abs)) {
    fail(`missing file: ${rel} (under ${bundleRoot})`);
  }
}
