import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const { API_PROXY_TARGET = 'http://127.0.0.1:3001' } = loadEnv(
    mode,
    process.cwd(),
    'API_PROXY_TARGET',
  );

  return {
    plugins: [react(), tailwindcss()],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [{ name: 'react-runtime', test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/ }],
          },
        },
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': API_PROXY_TARGET,
      },
    },
  };
});
