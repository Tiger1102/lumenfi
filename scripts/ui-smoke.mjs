import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = process.env.UI_BASE_URL || "http://127.0.0.1:5173";
const captureDir = process.env.UI_CAPTURE_DIR;
const profileDir = mkdtempSync(join(tmpdir(), "lumenfi-ui-smoke-"));
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--no-first-run",
    "--disable-extensions",
    "--disable-gpu",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "about:blank"
  ],
  { stdio: "ignore", windowsHide: true }
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDevtoolsPort() {
  const portFile = join(profileDir, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(portFile)) {
      return Number(readFileSync(portFile, "utf8").split(/\r?\n/)[0]);
    }
    await delay(50);
  }
  throw new Error("Chrome DevTools port was not created.");
}

function createSession(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let id = 0;
  const pending = new Map();
  const events = new Map();

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }

    const listeners = events.get(message.method) || [];
    listeners.forEach((listener) => listener(message.params));
  });

  function send(method, params = {}) {
    id += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  function once(method, timeout = 10_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeout);
      const listener = (params) => {
        clearTimeout(timer);
        events.set(method, (events.get(method) || []).filter((item) => item !== listener));
        resolve(params);
      };
      events.set(method, [...(events.get(method) || []), listener]);
    });
  }

  return { socket, ready, send, once };
}

async function evaluate(session, expression) {
  const result = await session.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function navigate(session, path, viewport) {
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile
  });
  const loaded = session.once("Page.loadEventFired");
  await session.send("Page.navigate", { url: `${baseUrl}${path}` });
  await loaded;
  await delay(1_200);
}

async function setReducedMotion(session, reduce) {
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: reduce ? "reduce" : "no-preference" }]
  });
}

async function inspect(session, label) {
  return evaluate(
    session,
    `(() => {
      const interactive = [...document.querySelectorAll("button, a, input, select, summary")]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        });
      const undersized = interactive
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return (rect.width < 44 || rect.height < 44) && !element.closest(".navLinks, .footerColumn, .contractTable");
        })
        .map((element) => ({
          text: (element.textContent || element.getAttribute("aria-label") || element.tagName).trim().slice(0, 40),
          width: Math.round(element.getBoundingClientRect().width),
          height: Math.round(element.getBoundingClientRect().height)
        }));
      return {
        label: ${JSON.stringify(label)},
        viewport: { width: innerWidth, height: innerHeight },
        scrollWidth: document.documentElement.scrollWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
        title: document.title,
        h1: document.querySelector("h1")?.textContent?.trim() || null,
        h2: document.querySelector("h2")?.textContent?.trim() || null,
        undersized
      };
    })()`
  );
}

async function capture(session, label) {
  if (!captureDir) return;
  mkdirSync(captureDir, { recursive: true });
  const result = await session.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  writeFileSync(join(captureDir, `${label}.png`), Buffer.from(result.data, "base64"));
}

try {
  const port = await waitForDevtoolsPort();
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const pageTarget = targets.find((target) => target.type === "page");
  if (!pageTarget) throw new Error("Chrome page target was not found.");

  const session = createSession(pageTarget.webSocketDebuggerUrl);
  await session.ready;
  await session.send("Page.enable");
  await session.send("Runtime.enable");

  const results = [];
  await navigate(session, "/", { width: 1440, height: 1000, mobile: false });
  results.push(await inspect(session, "overview-desktop"));
  await capture(session, "overview-desktop");

  await navigate(session, "/", { width: 390, height: 844, mobile: true });
  results.push(await inspect(session, "overview-mobile"));
  await capture(session, "overview-mobile");

  await setReducedMotion(session, true);
  await navigate(session, "/", { width: 375, height: 812, mobile: true });
  results.push(await inspect(session, "overview-small-reduced-motion"));
  await capture(session, "overview-small-reduced-motion");
  await setReducedMotion(session, false);

  await navigate(session, "/market", { width: 1440, height: 1000, mobile: false });
  results.push(await inspect(session, "market-swap"));
  await capture(session, "market-swap");

  for (const [index, label] of [["1", "market-liquidity"], ["2", "market-lending"]]) {
    await evaluate(
      session,
      `document.querySelectorAll(".moduleTabs button")[${index}]?.click()`
    );
    await delay(1_500);
    results.push(await inspect(session, label));
    await capture(session, label);
  }

  await navigate(session, "/market", { width: 390, height: 844, mobile: true });
  results.push(await inspect(session, "market-mobile"));
  await capture(session, "market-mobile");

  await navigate(session, "/market", { width: 844, height: 390, mobile: true });
  results.push(await inspect(session, "market-landscape"));
  await capture(session, "market-landscape");

  await navigate(session, "/bridge", { width: 390, height: 844, mobile: true });
  results.push(await inspect(session, "bridge-mobile"));
  await capture(session, "bridge-mobile");

  await navigate(session, "/agent", { width: 390, height: 844, mobile: true });
  results.push(await inspect(session, "agent-mobile"));
  await capture(session, "agent-mobile");

  await navigate(session, "/docs", { width: 1440, height: 1000, mobile: false });
  results.push(await inspect(session, "docs-desktop"));
  await capture(session, "docs-desktop");

  await navigate(session, "/docs", { width: 390, height: 844, mobile: true });
  results.push(await inspect(session, "docs-mobile"));
  await capture(session, "docs-mobile");

  console.log(JSON.stringify(results, null, 2));
  session.socket.close();
} finally {
  chrome.kill();
  await Promise.race([
    new Promise((resolve) => chrome.once("exit", resolve)),
    delay(2_000)
  ]);
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 120 });
}
