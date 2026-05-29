import fs from 'node:fs';

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

export function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
