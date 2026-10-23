import { defineConfig, devices } from "@playwright/test";

// Software WebGL: Linux CI has no GPU, and recent Chromium needs both flags to fall back.
const launchOptions = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] };

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
  // Each project runs only its own specs: the phone and tablet specs live in folders of their own,
  // which the desktop project skips. The devices run in Chromium, the only browser CI installs.
  projects: [
    {
      name: "chromium",
      testIgnore: ["phone/**", "tablet/**"],
      use: { ...devices["Desktop Chrome"], launchOptions },
    },
    {
      // The whole 390 x 844 screen, with touch.
      name: "phone",
      testDir: "e2e/phone",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, defaultBrowserType: "chromium", launchOptions },
    },
    {
      // 820 x 1180 with touch: the desktop layout with a coarse pointer.
      name: "tablet",
      testDir: "e2e/tablet",
      use: { ...devices["iPad Pro 11"], viewport: { width: 820, height: 1180 }, defaultBrowserType: "chromium", launchOptions },
    },
  ],
});
