const $ = id => document.getElementById(id);
const report = { runtime: 'v86 0.5.473', ready: false, complete: false, runs: [], guestMemoryMiB: 1024, streamedBytes: 0 };
window.benchmarkReport = report;
let serial = '', serialLine = '', pending = null, nextId = 0;
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const streamDecoder = new TextDecoder();
let output = '', outputQueue = '', streamBytes = [], activity = null;
function say(text) { outputQueue += text; }
function flushTerminal() {
  if (!outputQueue) return;
  const terminal = $('output');
  const follow = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 40;
  output = (output + outputQueue).slice(-100000);
  outputQueue = '';
  terminal.textContent = output;
  if (follow) terminal.scrollTop = terminal.scrollHeight;
}
function flushStream() {
  if (!streamBytes.length) return;
  say(streamDecoder.decode(new Uint8Array(streamBytes), { stream: true }).replaceAll('\r', ''));
  streamBytes = [];
}
function updateStatus() {
  if (!activity) return;
  const elapsed = Math.floor((performance.now() - activity.start) / 1000);
  $('status').textContent = `${activity.label} · ${Math.floor(elapsed / 60)}m ${elapsed % 60}s elapsed`;
}
function status(label, busy = false) {
  activity = busy ? { label, start: performance.now() } : null;
  $('status').dataset.busy = String(busy);
  $('status').textContent = label;
  updateStatus();
}
// Batch rendering so verbose output does not trigger a DOM update per byte.
setInterval(() => { flushStream(); flushTerminal(); }, 100);
setInterval(updateStatus, 1000);
function failure(error) {
  report.error = String(error);
  flushStream();
  say(`\n[playground] Failed: ${error}\n`);
  flushTerminal();
  status(`Benchmark failed: ${error}`);
  $('benchmark').disabled = true;
}
window.addEventListener('error', event => failure(event.message));
window.addEventListener('unhandledrejection', event => failure(event.reason));
status('Loading Linux', true);
say('[playground] Loading the browser VM and Linux. Boot messages will appear below.\n');
flushTerminal();
const vm = new V86({
  wasm_path: '/assets/runtime/v86.wasm',
  bios: { url: '/assets/bios/seabios.bin' },
  vga_bios: { url: '/assets/bios/vgabios.bin' },
  bzimage: { url: '/assets/vmlinuz' },
  initrd: { url: '/assets/initrd.img' },
  filesystem: { basefs: '/assets/fs.json', baseurl: '/assets/fs/' },
  memory_size: 1024 * 1024 * 1024,
  vga_memory_size: 2 * 1024 * 1024,
  cmdline: 'root=host9p rootfstype=9p rw console=ttyS0 init=/usr/local/sbin/playground-init mitigations=off random.trust_cpu=on',
  uart1: true,
  autostart: true,
  disable_keyboard: true, disable_mouse: true, disable_speaker: true,
  screen_dummy: true,
  // No networking adapter/proxy is configured. The filesystem is local browser JS.
});
vm.add_listener('emulator-started', () => {
  status('Booting Linux', true);
  say('[playground] VM started. Booting Linux…\n');
});
vm.add_listener('serial1-output-byte', byte => {
  streamBytes.push(byte);
  report.streamedBytes++;
  if (pending) pending.run.streamedBytes = (pending.run.streamedBytes || 0) + 1;
});
vm.add_listener('serial0-output-byte', byte => {
  if (byte === 13) return;
  const char = String.fromCharCode(byte);
  serial = (serial + char).slice(-60000);
  serialLine += char;
  if (byte === 10) {
    const line = serialLine.trim();
    serialLine = '';
    $('serial').textContent = serial.slice(-60000);
    if (line === 'V86_EIFFEL_READY') {
      report.ready = true;
      report.bootMs = performance.now();
      status(`Linux ready in ${(report.bootMs / 1000).toFixed(2)} s`);
      say(`\n[playground] Linux ready in ${(report.bootMs / 1000).toFixed(2)} s. Press Run to compile the examples.\n`);
      $('summary').textContent = 'Ready to compile in the browser.';
      $('benchmark').disabled = false;
    }
    const phase = line.match(/^V86_PHASE:(\d+):(compile|execute):(start|end)(?::(\d+))?$/);
    if (phase && pending && Number(phase[1]) === pending.run.id) {
      const name = phase[2];
      flushStream();
      if (phase[3] === 'start') {
        pending[`${name}Start`] = performance.now();
        status(`${pending.run.label}: ${name === 'compile' ? 'compiling' : 'running'}`, true);
        say(name === 'compile' ? '$ se c -verbose -no_split -all_check -o hello hello.e\n' : '\n$ ./hello\n');
      }
      else {
        pending.run[`${name}Ms`] = performance.now() - pending[`${name}Start`];
        pending.run[`${name}Status`] = Number(phase[4]);
        say(`\n[playground] ${name === 'compile' ? 'Compiler' : 'Program'} exited ${phase[4]} after ${(pending.run[`${name}Ms`] / 1000).toFixed(2)} s.\n`);
        status(`${pending.run.label}: ${name} finished`);
      }
    }
    if (pending && line === `V86_DONE:${pending.run.id}`) pending.resolve();
    // Keep protocol markers in the diagnostic log, not in the user terminal.
    if (!line.startsWith('V86_')) say(line + '\n');
  }
});
async function run(source, label) {
  const id = ++nextId;
  const result = { id, label, compileStatus: null, executeStatus: null, compileMs: null, executeMs: null };
  report.runs.push(result);
  const begin = performance.now();
  say(`\n=== ${label} ===\n`);
  status(`${label}: sending source to Linux`, true);
  await vm.create_file(`/exchange/input-${id}.e`, encoder.encode(source));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${label} exceeded 660 seconds`)), 660000);
    pending = { run: result, resolve: () => { clearTimeout(timeout); resolve(); } };
    vm.serial0_send(`run ${id}\n`);
  });
  status(`${label}: collecting results`, true);
  result.compilerOutput = decoder.decode(await vm.read_file(`/exchange/compile-${id}.log`));
  result.programOutput = result.executeStatus === null ? '' : decoder.decode(await vm.read_file(`/exchange/execute-${id}.log`));
  pending = null;
  result.totalMs = performance.now() - begin;
  if (result.executeStatus === null) say('[playground] Program was not run because compilation failed.\n');
  $('summary').textContent = JSON.stringify({ bootSeconds: report.bootMs / 1000, runs: report.runs }, null, 2);
  return result;
}
$('benchmark').onclick = async () => {
  $('benchmark').disabled = true;
  try {
    const helloResponse = await fetch('/examples/hello.e');
    const errorResponse = await fetch('/examples/error.e');
    if (!helloResponse.ok || !errorResponse.ok) throw new Error('Could not load source examples');
    // A browser-added marker proves the source supplied by JS was compiled.
    const hello = (await helloResponse.text()).replace('Hello from Eiffel in your browser!', 'Hello from Eiffel in v86! Browser source marker: 42');
    const error = await errorResponse.text();
    const cold = await run(hello, 'Cold hello');
    if (cold.compileStatus === 0 && cold.executeStatus === 0) await run(hello, 'Warm hello');
    await run(error, 'Intentional error');
    report.complete = true;
    flushStream();
    say('\n[playground] Benchmark complete. Timings and results are available below.\n');
    flushTerminal();
    status('Benchmark complete');
  } catch (error) {
    failure(error);
    vm.stop();
  }
};
$('restart').onclick = () => location.reload();
