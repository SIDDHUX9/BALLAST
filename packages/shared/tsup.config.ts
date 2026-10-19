import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/brand.ts',
    'src/protocol.ts',
    'src/math.ts',
    'src/schemas.ts',
    'src/deployments.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
