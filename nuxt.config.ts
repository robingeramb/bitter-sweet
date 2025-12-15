// https://nuxt.com/docs/api/configuration/nuxt-config

import glsl from "vite-plugin-glsl";

export default defineNuxtConfig({
  modules: ["@pinia/nuxt", "@tresjs/nuxt"],
  vite: {
    build: {
      target: "esnext", // Für WASM-Unterstützung
    },
    plugins: [glsl()],
  },
  link: [
    {
      rel: "stylesheet",
      href: "https://use.typekit.net/ayn0exx.css", // Adobe Fonts Link
    },
  ],
  compatibilityDate: "2024-11-01",
  devtools: { enabled: false },
  css: ["~/assets/css/main.css"],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
});
