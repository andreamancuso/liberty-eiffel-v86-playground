import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
const out = process.env.RESULTS_DIR || '/results';
const url = process.env.PLAYGROUND_URL || 'http://127.0.0.1:8080';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await context.newPage();
const requests = [], failures = [], consoleLog = [], responseJobs = [];
const network = { requests: 0, bytes: 0, methods: {}, origins: {} };
context.on('request', request => {
  const origin = new URL(request.url()).origin;
  network.requests++;
  network.methods[request.method()] = (network.methods[request.method()] || 0) + 1;
  network.origins[origin] = (network.origins[origin] || 0) + 1;
  requests.push({ method: request.method(), url: request.url() });
});
context.on('response', response => {
  responseJobs.push((async () => {
    const headers = await response.allHeaders();
    network.bytes += Number(headers['content-length'] || 0);
    if (response.status() >= 400) failures.push(`HTTP ${response.status()}: ${response.url()}`);
  })().catch(error => failures.push(String(error))));
});
context.on('requestfailed', request => failures.push(`${request.url()}: ${request.failure()?.errorText}`));
page.on('console', message => consoleLog.push(`${message.type()}: ${message.text()}`));
page.on('pageerror', error => { failures.push(String(error)); console.log('Page error:', String(error)); });
const heartbeat = setInterval(async () => {
  try {
    console.log('Progress:', await page.locator('#status').innerText(), JSON.stringify(network));
    console.log('Terminal:', (await page.locator('#output').textContent()).slice(-900));
  } catch {}
}, 15000);
let passed = false, liveObservation = null;
try {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.benchmarkReport?.ready || window.benchmarkReport?.error, {}, { timeout: 240000 });
  let report = await page.evaluate(() => window.benchmarkReport);
  assert.equal(report.error, undefined, report.error);
  console.log('Boot:', report.bootMs, 'ms');
  assert.equal(await page.locator('#output').isVisible(), true);
  assert.match(await page.locator('#output').textContent(), /Linux version/);
  await page.locator('#benchmark').click();
  await page.waitForFunction(() => window.benchmarkReport.streamedBytes > 0 && document.getElementById('output').textContent.includes('System call'), {}, { timeout: 120000 });
  liveObservation = await page.evaluate(() => ({
    streamedBytes: window.benchmarkReport.streamedBytes,
    compilerExit: window.benchmarkReport.runs[0].compileStatus,
    status: document.getElementById('status').textContent,
    text: document.getElementById('output').textContent.slice(-2500),
  }));
  assert.equal(liveObservation.compilerExit, null, 'Actual compiler output must be visible before compilation finishes');
  assert.match(liveObservation.status, /elapsed/);
  const statusBefore = liveObservation.status;
  await page.waitForFunction(before => document.getElementById('status').textContent !== before, statusBefore, { timeout: 5000 });
  await page.screenshot({ path: `${out}/live-compilation.png`, fullPage: true });
  console.log('LIVE OUTPUT VERIFIED:', JSON.stringify(liveObservation));
  await page.waitForFunction(() => window.benchmarkReport.complete || window.benchmarkReport.error, {}, { timeout: 1980000 });
  report = await page.evaluate(() => window.benchmarkReport);
  assert.equal(report.error, undefined, report.error);
  assert.equal(report.runs.length, 3);
  for (const run of report.runs.slice(0, 2)) {
    assert.equal(run.compileStatus, 0, run.compilerOutput);
    assert.equal(run.executeStatus, 0, run.programOutput);
    assert.match(run.programOutput, /Hello from Eiffel in v86! Browser source marker: 42/);
  }
  assert.equal(report.runs[2].compileStatus, 1, report.runs[2].compilerOutput);
  assert.equal(report.runs[2].executeStatus, null);
  assert.match(report.runs[2].compilerOutput, /this_feature_does_not_exist/);
  const terminal = await page.locator('#output').textContent();
  assert.match(terminal, /Hello from Eiffel in v86! Browser source marker: 42/);
  assert.match(terminal, /Unknown feature/);
  assert.match(terminal, /Program was not run because compilation failed/);
  assert.doesNotMatch(terminal, /^V86_(PHASE|DONE|EIFFEL_READY)/m);
  assert.equal(await page.locator('#status').getAttribute('data-busy'), 'false');
  await Promise.all(responseJobs);
  assert.deepEqual(Object.keys(network.origins), [new URL(url).origin], 'All runtime and guest files must be locally hosted');
  assert.deepEqual(Object.keys(network.methods), ['GET'], 'No server execution endpoint');
  assert.equal(failures.length, 0, JSON.stringify(failures));
  passed = true;
  console.log('PASS:', JSON.stringify(report));
} catch (error) {
  failures.push(error.stack || String(error));
  console.error(error);
  process.exitCode = 1;
} finally {
  clearInterval(heartbeat);
  await Promise.allSettled(responseJobs);
  const report = await page.evaluate(() => window.benchmarkReport).catch(() => ({}));
  await page.screenshot({ path: `${out}/${passed ? 'benchmark' : 'failure'}.png`, fullPage: true }).catch(() => {});
  await writeFile(`${out}/browser.json`, JSON.stringify({ passed, date: new Date().toISOString(), browser: browser.version(), host: { cpu: os.cpus()[0]?.model, cpus: os.cpus().length, memory: os.totalmem() }, report, liveObservation, network, failures }, null, 2));
  await writeFile(`${out}/terminal.log`, await page.locator('#output').textContent().catch(() => ''));
  await writeFile(`${out}/serial.log`, await page.locator('#serial').textContent().catch(() => ''));
  await writeFile(`${out}/console.log`, consoleLog.join('\n'));
  await writeFile(`${out}/requests.json`, JSON.stringify(requests, null, 2));
  await browser.close();
}
