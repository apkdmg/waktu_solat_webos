import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

// Everything is compiled to ES5: webOS TV 3.x (Chromium 38) parses nothing newer,
// and Enact CLI does not transpile packages in node_modules.
const ts = () => typescript({ tsconfig: './tsconfig.json', declaration: false });

export default [
  {
    input: { index: 'src/index.ts', webos: 'src/webos.ts' },
    output: [
      { dir: 'dist', format: 'es', entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs', sourcemap: true },
      { dir: 'dist', format: 'cjs', entryFileNames: '[name].cjs', chunkFileNames: '[name]-[hash].cjs', sourcemap: true, exports: 'named' },
    ],
    plugins: [ts()],
  },
  {
    // Drop-in <script> build for packaged webOS apps (no ES modules under file://):
    // exposes window.WaktuSolat
    input: 'src/browser.ts',
    output: [
      { file: 'dist/waktu-solat.js', format: 'iife', name: 'WaktuSolat', sourcemap: true },
      { file: 'dist/waktu-solat.min.js', format: 'iife', name: 'WaktuSolat', sourcemap: true, plugins: [terser({ ecma: 5 })] },
    ],
    plugins: [ts()],
  },
];
