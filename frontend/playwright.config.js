import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    baseURL: process.env.UI_URL || "http://127.0.0.1:3030",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        ...(process.env.BROWSER_CHANNEL
          ? { channel: process.env.BROWSER_CHANNEL }
          : {}),
      },
    },
  ],
});
