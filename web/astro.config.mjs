import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://quicksync.ktz.me',
  output: 'static',
  // Uncomment for SSR if needed:
  // adapter: cloudflare(),
  // output: 'server',
});
