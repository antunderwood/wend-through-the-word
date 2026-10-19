import { defineConfig, devices } from "@playwright/test";

// The page is built and served with the export in WEND_DATA (the fixture export in CI).
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Software WebGL: Linux CI has no GPU, and recent Chromium needs both flags to fall back.
        launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
      },
    },
  ],
});
