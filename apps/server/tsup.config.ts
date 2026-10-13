import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/worker.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  clean: true,
  // The shared workspace package ships TypeScript source, so bundle it in.
  noExternal: ['@gym/shared'],
});
