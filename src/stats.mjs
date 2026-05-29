import fs from 'node:fs';
import path from 'node:path';

export function collectTreeStats(root) {
  let fileCount = 0;
  let byteCount = 0;

  function walk(dir) {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, name.name);
      if (name.isDirectory()) {
        walk(abs);
      } else if (name.isFile()) {
        fileCount += 1;
        byteCount += fs.statSync(abs).size;
      }
    }
  }

  walk(path.resolve(root));
  return { fileCount, byteCount };
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}
