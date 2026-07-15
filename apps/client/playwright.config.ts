import { defineConfig, devices } from "@playwright/test";

const goEnv = {
  GOPATH: "D:\\Code\\NLtyping\\.tools\\go-path",
  GOROOT: "D:\\Code\\NLtyping\\.tools\\go",
  GOCACHE: "D:\\Code\\NLtyping\\.tools\\go-cache",
  GOPROXY: "https://goproxy.cn,direct",
  CORS_ORIGIN: "http://localhost:5173",
  JWT_SECRET: "playwright-test-secret",
  PATH: `D:\\Code\\NLtyping\\.tools\\go\\bin;${process.env.PATH}`,
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      port: 5173,
      reuseExistingServer: true,
    },
    {
      command: "go run ./cmd/server",
      port: 3001,
      cwd: "../server",
      env: goEnv,
      reuseExistingServer: true,
    },
  ],
});
