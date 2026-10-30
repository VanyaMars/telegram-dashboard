import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',
 timeout:45_000,
 expect:{timeout:10_000},
 fullyParallel:false,
 retries:process.env.CI?1:0,
 reporter:process.env.CI?[['list'],['html',{open:'never'}]]:[['list']],
 use:{baseURL:'http://127.0.0.1:4173/telegram-dashboard/',trace:'retain-on-failure',screenshot:'only-on-failure',reducedMotion:'reduce'},
 projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',url:'http://127.0.0.1:4173/telegram-dashboard/',reuseExistingServer:!process.env.CI,timeout:90_000}
});
