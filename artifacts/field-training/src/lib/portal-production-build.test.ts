import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../../dist/public/', import.meta.url));

test('production bundle includes the preview route, fictional workspace, and sign-in boundary', async () => {
  const html = await readFile(join(publicDir, 'index.html'), 'utf8');
  assert.match(html, /\/field-training-preview\/assets\//);

  const assetsDir = join(publicDir, 'assets');
  const bundle = (await Promise.all(
    (await readdir(assetsDir))
      .filter((file) => file.endsWith('.js'))
      .map((file) => readFile(join(assetsDir, file), 'utf8')),
  )).join('\n');

  assert.match(bundle, /\/ui-preview/);
  assert.match(bundle, /fieldready-ui-preview/);
  assert.match(bundle, /substation-orientation/);
  assert.match(bundle, /sign-in/);
  assert.match(bundle, /UI test workspace/);
  assert.match(bundle, /This role cannot access operational training records/);
  assert.match(bundle, /Fictional role preview/);
});
