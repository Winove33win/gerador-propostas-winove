import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  build: {
    outDir: 'Backend/dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'path',
        'url',
        'crypto',
        'fs',
        'os',
        'events',
        'http',
        'https',
        'net',
        'tls',
        'stream',
        'util',
        'buffer',
        'zlib',
        'querystring',
        'child_process',
        'cluster',
        'dgram',
        'dns',
        'readline',
        'repl',
        'tty',
        'v8',
        'vm',
        'worker_threads',
        'assert',
        'constants',
        'module',
        'timers',
        'process',
        'async_hooks',
        'perf_hooks',
        'trace_events',
        'inspector',
        'console',
        'global',
        'punycode',
        'string_decoder',
        'sys'
      ],
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
}));
