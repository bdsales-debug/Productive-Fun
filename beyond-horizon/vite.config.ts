import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Code and styles are inlined into one HTML file; the artwork stays as separate files in images/.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2019' },
});
