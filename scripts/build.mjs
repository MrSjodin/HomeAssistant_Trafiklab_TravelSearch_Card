import { build, context } from 'esbuild';
import { readFile } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

const banner = `/*!
 * Trafiklab Travel Search Card for Home Assistant
 * Build time: ${new Date().toISOString()}
 */`;

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/travel-card.ts'],
  bundle: true,
  minify: !watch,
  sourcemap: true,
  format: 'esm',
  target: ['es2020'],
  outfile: 'dist/travel-search-card.js',
  banner: { js: banner },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build(options);
  console.log('Built dist/travel-search-card.js');
}
