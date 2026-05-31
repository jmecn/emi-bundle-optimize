import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildItemsSearchIndexes } from '../src/items-search-index.mjs';
import { optimizeBundle } from '../src/optimize.mjs';

const fixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/minimal-bundle',
);

test('buildItemsSearchIndexes writes per-locale haystack with zh pinyin and en name', () => {
  const bundleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'emi-items-search-'));
  try {
    fs.cpSync(fixtureRoot, bundleRoot, { recursive: true, dereference: true });
    fs.writeFileSync(path.join(bundleRoot, 'bundle.json'), `${JSON.stringify({
      schema: 2,
      languages: ['en_us', 'zh_cn'],
      recipeCount: 1,
    }, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(bundleRoot, 'items/index.json'), `${JSON.stringify({
      schema: 1,
      test: ['iron_ingot'],
    }, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(bundleRoot, 'lang/en_us.json'), `${JSON.stringify({
      'item.test.iron_ingot': 'Iron Ingot',
    }, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(bundleRoot, 'lang/zh_cn.json'), `${JSON.stringify({
      'item.test.iron_ingot': '铁锭',
    }, null, 2)}\n`, 'utf8');

    const result = buildItemsSearchIndexes(bundleRoot);
    assert.equal(result.itemCount, 1);
    assert.equal(result.locales.length, 2);

    const zh = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'items-search/zh_cn.json'), 'utf8'));
    assert.equal(zh.schema, 1);
    assert.equal(zh.items[0].id, 'test:iron_ingot');
    const hay = zh.items[0].haystack;
    assert.ok(hay.includes('test:iron_ingot'));
    assert.ok(hay.includes('铁锭'));
    assert.ok(hay.includes('iron ingot'));
    assert.ok(hay.includes('tie ding') || hay.includes('tieding'), hay);

    const en = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'items-search/en_us.json'), 'utf8'));
    assert.ok(en.items[0].haystack.includes('iron ingot'));
    assert.equal(en.items[0].haystack.includes('tie'), false);
  } finally {
    fs.rmSync(bundleRoot, { recursive: true, force: true });
  }
});

test('optimizeBundle generates items-search and stamps bundle.json', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emi-opt-items-search-'));
  try {
    const { report } = await optimizeBundle({ inDir: fixtureRoot, outDir, webp: false });
    assert.ok(report.itemsSearch?.enabled);
    assert.ok(fs.existsSync(path.join(outDir, 'items-search/en_us.json')));
    const bundle = JSON.parse(fs.readFileSync(path.join(outDir, 'bundle.json'), 'utf8'));
    assert.deepEqual(bundle.itemsSearch?.locales, ['en_us']);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
