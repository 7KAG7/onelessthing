import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
await mkdir(new URL('../.build/', import.meta.url), { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: ['lambda/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  outfile: '.build/handler.js',
  metafile: true,
  sourcemap: false,
  minify: false,
  legalComments: 'eof',
});
const inputs = Object.keys(result.metafile.inputs);
if (inputs.some((path) => /(?:src\/server|usersStore|data\/users)/.test(path))) {
  throw new Error('The Lambda bundle must not include the legacy server or user store');
}
await writeFile(new URL('../.build/package.json', import.meta.url), JSON.stringify({ type: 'commonjs' }));
console.log('Built .build/handler.js with the shared mobile API and bundled AWS SDK');
