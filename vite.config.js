import { defineConfig } from 'vite';

export default defineConfig(({  }) => {
  return {
    build: {
      lib: {
        entry: 'src/index.js',
        name: 'CloudsDemo',
        fileName: 'build.js',
      },
      rollupOptions: {
        input: 'src/index.js',
        output: [
          {
            dir: 'build/',
            entryFileNames: 'index.js',
            format: 'es',
            name: 'CloudsDemo',
            sourcemap: false,
            inlineDynamicImports: true
          }
        ],
      }
    },
    server: {
      host: 'localhost',
      port: 8080,
    }
  };
});
