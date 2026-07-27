import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  // Served at https://ozdna.com/app/verify/ (Netlify rewrite → /deep-verify/).
  base: "/app/verify/",
  publicDir: "public",
  build: {
    outDir: "../../../deep-verify",
    emptyOutDir: true,
    target: "es2022",
  },
  server: {
    port: 5173,
  },
});
