import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Expose to the local network (not just localhost) so phones/other
  // devices on the same Wi-Fi can load the game during local testing.
  server: { host: true },
  preview: { host: true },
});
