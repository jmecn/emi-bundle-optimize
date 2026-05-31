import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildGtceuPruneContext,
  collectGtceuComposedLangKeys,
} from '../src/gtceu-composed-keys.mjs';

const zhCn = {
  'tagprefix.ingot': '%s锭',
  'gtceu.fluid.liquid_generic': '液态%s',
};

test('collectGtceuComposedLangKeys matches renderer rules for ingot', () => {
  const ctx = buildGtceuPruneContext([zhCn]);
  const keys = collectGtceuComposedLangKeys('item', 'gtceu:aluminium_ingot', ctx);
  assert.ok(keys.has('item.gtceu.aluminium_ingot'));
  assert.ok(keys.has('tagprefix.ingot'));
  assert.ok(keys.has('material.gtceu.aluminium'));
});

test('collectGtceuComposedLangKeys matches renderer rules for liquid fluid', () => {
  const ctx = buildGtceuPruneContext([zhCn]);
  const keys = collectGtceuComposedLangKeys('fluid', 'gtceu:liquid_air', ctx);
  assert.ok(keys.has('gtceu.fluid.liquid_generic'));
  assert.ok(keys.has('material.gtceu.air'));
  assert.ok(keys.has('material.gtceu.liquid_air'));
});

test('collectGtceuComposedLangKeys matches renderer rules for bucket', () => {
  const ctx = buildGtceuPruneContext([zhCn]);
  const keys = collectGtceuComposedLangKeys('item', 'gtceu:liquid_air_bucket', ctx);
  assert.ok(keys.has('item.gtceu.bucket'));
  assert.ok(keys.has('gtceu.fluid.liquid_generic'));
  assert.ok(keys.has('material.gtceu.air'));
});
