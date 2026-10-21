import { defineConfig, devices } from "@playwright/test";

// The page is built and served with the export in WEND_DATA (the fixture export in CI). The e2e
// mode build is the only one with the window.wendGraph hook the tests read.
export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    // Every test starts in a browser that was already offered the first-run tour; tour.spec.ts clears it.
    storageState: { cookies: [], origins: [{ origin: "http://localhost:4173", localStorage: [{ name: "wend.tourOffered", value: "1" }] }] },
  },
  webServer: {
    command: "npx vite build --mode e2e && npx vite preview --port 4173 --strictPort",
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
