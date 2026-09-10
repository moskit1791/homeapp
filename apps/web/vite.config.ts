import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';

// ----------------------------------------------------------------------

const PORT = 4173;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    checker({
      // The build script checks TypeScript before Vite; CI runs ESLint separately.
      // Avoid a second compiler process on the 2 GB production build host.
      enableBuild: false,
      typescript: true,
      eslint: {
        lintCommand:
          'eslint src/homeapp src/app.tsx src/main.tsx src/global-config.ts src/routes/sections/index.tsx src/layouts/dashboard src/layouts/auth-centered src/layouts/components/settings-button.tsx src/components/logo/logo.tsx src/theme/theme-provider.tsx',
      },
      overlay: {
        position: 'tl',
        initialIsOpen: false,
      },
    }),
  ],
  resolve: {
    alias: [
      {
        find: /^src(.+)/,
        replacement: path.resolve(process.cwd(), 'src/$1'),
      },
    ],
  },
  server: { port: PORT, host: true },
  preview: { port: PORT, host: true },
});
