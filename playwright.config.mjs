import {defineConfig,devices} from '@playwright/test';
const projects=[{name:'chromium',use:{...devices['Desktop Chrome']}}];
if(process.env.APPLYPILOT_TEST_INSTALLED_BROWSERS === '1') projects.push(
  {name:'chrome',use:{...devices['Desktop Chrome'],channel:'chrome'}},
  {name:'edge',use:{...devices['Desktop Edge'],channel:'msedge'}},
);
export default defineConfig({
  testDir:'./tests/browser',timeout:30000,workers:1,fullyParallel:false,
  reporter:[['list'],['json',{outputFile:'test-results/browser-results.json'}]],
  use:{baseURL:'http://127.0.0.1:4174',trace:'retain-on-failure',screenshot:'only-on-failure'},projects,
  webServer:process.env.APPLYPILOT_EXTERNAL_TEST_SERVER ? undefined : {command:'node scripts/serve-local.mjs',url:'http://127.0.0.1:4174',reuseExistingServer:false},
});
