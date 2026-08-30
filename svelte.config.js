import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Dev-only allowance so Impeccable live mode can load its local picker.
const __impeccableLiveDev = process.env.NODE_ENV === 'development' ? ['http://localhost:8400'] : [];

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self', ...__impeccableLiveDev],
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        'img-src': [
          'self',
          'data:',
          'https://*.basemaps.cartocdn.com',
          'https://images.unsplash.com'
        ],
        'connect-src': ['self', 'ws:', 'wss:', ...__impeccableLiveDev],
        'font-src': ['self', 'https://fonts.gstatic.com'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'frame-ancestors': ['none'],
        'form-action': ['self']
      }
    },
    // Pin the serverless runtime so builds work regardless of the local Node version.
    adapter: adapter({ runtime: 'nodejs22.x' })
  }
};

export default config;
