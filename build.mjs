import * as esbuild from 'esbuild';
import { rmSync } from 'fs';

const watch = process.argv.includes('--watch');

// Clean out directory before building
try {
  rmSync('out', { recursive: true, force: true });
  console.log('Cleaned out directory');
} catch (error) {
  // Directory might not exist, ignore
}

const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
  minify: !watch,
  logLevel: 'info',
  banner: {
    js: 'const __importMetaUrl = require("url").pathToFileURL(__filename).href;',
  },
  define: {
    'import.meta.url': '__importMetaUrl',
  },
});

if (watch) {
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Build complete');
}
