import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { maskSecret, safeFileName, safeRelativePath, sha256Text } from './security.js';

test('safeFileName removes unsafe path characters', () => {
  assert.equal(safeFileName('../.env:prod?*'), '.._.env_prod__');
  assert.equal(safeFileName('  api key.txt  '), 'api key.txt');
});

test('safeRelativePath drops traversal segments', () => {
  assert.equal(safeRelativePath('../project/.env.local'), path.join('project', '.env.local'));
  assert.equal(safeRelativePath('assets\\video.mp4'), path.join('assets', 'video.mp4'));
});

test('maskSecret never exposes short secrets', () => {
  assert.equal(maskSecret('sk-123'), '••••••••');
  assert.equal(maskSecret('sk-local-one-secret'), 'sk-••••••••et');
});

test('sha256Text is stable', () => {
  assert.equal(
    sha256Text('Local ONE'),
    '85db15827d2b99e63555a6a1c01048620ab8d71b6df62c0c91ab1ab1c44bd51a'
  );
});
