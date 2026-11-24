import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));

test('public HTML and JS references resolve to existing files with consistent ?v= query tags', () => {
  const htmlFiles = readdirSync(publicDir).filter((name) => name.endsWith('.html')).map((name) => path.join(publicDir, name));
  const jsFiles = readdirSync(path.join(publicDir, 'js')).filter((name) => name.endsWith('.js')).map((name) => path.join(publicDir, 'js', name));

  const seenTags = new Map();
  const patterns = [
    /(?:src|href)=["'](\.[^"']+)["']/g,
    /from\s*["'](\.\.?\/[^"']+)["']/g,
    /import\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g,
  ];

  for (const file of [...htmlFiles, ...jsFiles]) {
    const text = readFileSync(file, 'utf8');
    const baseDir = path.dirname(file);
    const relSource = path.relative(publicDir, file).replaceAll('\\', '/');

    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const raw = match[1];
        const [pathPart, queryPart = ''] = raw.split('#')[0].split('?');
        if (!pathPart.endsWith('.js') && !pathPart.endsWith('.css')) continue;

        const targetPath = path.resolve(baseDir, pathPart);
        assert.ok(existsSync(targetPath), `Missing asset ${pathPart} referenced from ${relSource}`);

        const relTarget = path.relative(publicDir, targetPath).replaceAll('\\', '/');
        if (!seenTags.has(relTarget)) seenTags.set(relTarget, new Map());
        const versions = seenTags.get(relTarget);
        const tag = queryPart || '<none>';
        if (!versions.has(tag)) versions.set(tag, []);
        versions.get(tag).push(relSource);
      }
    }
  }

  const mismatches = [];
  for (const [target, versions] of seenTags) {
    if (versions.size > 1) {
      mismatches.push(`${target}: ${[...versions.entries()].map(([tag, srcs]) => `${tag} (${srcs.join(', ')})`).join(' vs ')}`);
    }
  }
  assert.deepEqual(mismatches, [], `Inconsistent cache-busting tags:\n${mismatches.join('\n')}`);
});
