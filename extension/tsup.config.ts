import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  platform: 'node',
  target: 'node18',
  clean: true,
  dts: false,
  external: ['vscode'],
  noExternal: [],
  shims: false,
});
