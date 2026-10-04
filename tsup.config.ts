import { defineConfig } from 'tsup';
import fs from 'node:fs';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs'],
  platform: 'node',
  target: 'node18',
  clean: true,
  dts: false,
  noExternal: [/(.*)/],
  outExtension() {
    return {
      js: '.cjs',
    };
  },
  banner: {
    js: '#!/usr/bin/env node',
  },
  onSuccess: async () => {
    fs.writeFileSync('dist/cli.js', "#!/usr/bin/env node\nimport './cli.cjs';\n");
  },
});
