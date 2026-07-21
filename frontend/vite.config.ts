import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dashboard is a pure client SPA that talks to the FastAPI service.
// VITE_API_BASE_URL is read at build/runtime (see src/lib/api.ts); it must
// point at a URL the *browser* can reach (e.g. http://localhost:8000),
// not the docker-internal service name.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
});
