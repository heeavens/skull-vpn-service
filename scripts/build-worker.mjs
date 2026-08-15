import { build } from 'esbuild';

await build({
  entryPoints: ['src/worker.ts'],
  outfile: 'build/worker.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  sourcemap: true
});
