import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = process.env.UI_BASE_URL || "http://127.0.0.1:5173";
const appOrigin = new URL(baseUrl).origin;
const captureDir = process.env.UI_CAPTURE_DIR;
const mockWallet = process.env.UI_MOCK_WALLET === "1";
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

  function on(method, listener) {
    events.set(method, [...(events.get(method) || []), listener]);
    return () => events.set(method, (events.get(method) || []).filter((item) => item !== listener));
  }

  return { socket, ready, send, once, on };
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
  await session.send("Log.enable");
  const runtimeErrors = [];
  session.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    runtimeErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || "Uncaught runtime exception");
  });
  session.on("Log.entryAdded", ({ entry }) => {
    if (entry?.level !== "error") return;
    const externalNetworkFailure = (
      entry.source === "network" && entry.url && !entry.url.startsWith(appOrigin)
    ) || /https:\/\/rpc(?:\.[\w-]+)?\.testnet\.arc\.network/i.test(entry.text || "");
    if (!externalNetworkFailure) runtimeErrors.push(entry.text || "Browser log error");
  });

  if (mockWallet) {
    await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        const address = "0x8ad78dacc1dc13ee0f0180eb991d2fdbc10af1d1";
        window.ethereum = {
          request: async ({ method }) => {
            if (method === "eth_requestAccounts" || method === "eth_accounts") return [address];
            if (method === "eth_chainId") return "0x4cf4b2";
            if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
            throw new Error("Mock wallet does not implement " + method);
          },
          on: () => undefined,
          removeListener: () => undefined
        };
      })();`
    });
  }

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
  const priceImpactVisible = await evaluate(session, `document.querySelector(".routeMeta")?.textContent?.includes("PRICE IMPACT")`);
  if (!priceImpactVisible) throw new Error("Swap does not expose price impact beside the live route.");
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

  await evaluate(session, `document.querySelectorAll(".moduleTabs button")[1]?.click()`);
  await delay(1_500);
  results.push(await inspect(session, "market-liquidity-mobile"));
  await capture(session, "market-liquidity-mobile");

  await navigate(session, "/market", { width: 844, height: 390, mobile: true });
  results.push(await inspect(session, "market-landscape"));
  await capture(session, "market-landscape");

  await navigate(session, "/bridge", { width: 390, height: 844, mobile: true });
  results.push(await inspect(session, "bridge-mobile"));
  await capture(session, "bridge-mobile");

  await navigate(session, "/agent", { width: 390, height: 844, mobile: true });
  results.push(await inspect(session, "agent-mobile"));
  await capture(session, "agent-mobile");

  if (mockWallet) {
    await evaluate(session, `(() => {
      const button = document.querySelector(".connectButton");
      if (button && !/disconnect/i.test(button.textContent || "")) button.click();
    })()`);
    await delay(8_000);
    const agentAnswerVisible = await evaluate(session, `Boolean(document.querySelector(".agentAnswerHeader") && document.querySelector(".agentTrace") && document.querySelector(".agentRecommendations"))`);
    if (!agentAnswerVisible) throw new Error("Connected Agent did not render its evidence trace and prepared plan.");
    results.push(await inspect(session, "agent-connected-mobile"));
    await capture(session, "agent-connected-mobile");
    const policyVisible = await evaluate(session, `Boolean(document.querySelector(".agentPolicyConsole") && document.querySelector("#agent-policy-title")?.textContent?.includes("Permission controls"))`);
    if (!policyVisible) throw new Error("Signed policy console was not rendered for the connected mock wallet.");
    await evaluate(session, `document.querySelector(".agentPolicyConsole")?.scrollIntoView({ block: "start" })`);
    await delay(300);
    results.push(await inspect(session, "agent-policy-mobile"));
    await capture(session, "agent-policy-mobile");

    await navigate(session, "/market", { width: 390, height: 844, mobile: true });
    await evaluate(session, `(() => {
      const button = document.querySelector(".connectButton");
      if (button && !/disconnect/i.test(button.textContent || "")) button.click();
    })()`);
    await delay(4_000);
    const approvalVisible = await evaluate(session, `Boolean(document.querySelector(".approvalGuidance")?.textContent?.includes("exact token approval"))`);
    if (!approvalVisible) throw new Error("Swap approval guidance was not rendered for the connected mock wallet.");
    await evaluate(session, `document.querySelector(".approvalGuidance")?.scrollIntoView({ block: "center" })`);
    await delay(300);
    results.push(await inspect(session, "swap-approval-mobile"));
    await capture(session, "swap-approval-mobile");
  }

  await navigate(session, "/docs", { width: 1440, height: 1000, mobile: false });
  const docsRoadmapReady = await evaluate(session, `(() => {
    const heading = [...document.querySelectorAll(".docBody h2")].find((item) => item.textContent?.trim() === "Roadmap");
    return heading?.nextElementSibling?.tagName === "OL" && heading.nextElementSibling.children.length === 11;
  })()`);
  if (!docsRoadmapReady) throw new Error("Docs roadmap is not aligned with all eleven product milestones.");
  results.push(await inspect(session, "docs-desktop"));
  await capture(session, "docs-desktop");

  await navigate(session, "/docs", { width: 390, height: 844, mobile: true });
  results.push(await inspect(session, "docs-mobile"));
  await capture(session, "docs-mobile");

  await navigate(session, "/", { width: 1440, height: 1000, mobile: false });
  const roadmapReady = await evaluate(session, `document.querySelectorAll(".roadmapCard").length === 11 && document.querySelector("#roadmap")?.textContent?.includes("Signed permission controls")`);
  if (!roadmapReady) throw new Error("Roadmap does not expose all eleven verified and future milestones.");
  await evaluate(session, `document.querySelector("#roadmap")?.scrollIntoView({ block: "start" })`);
  await delay(300);
  results.push(await inspect(session, "roadmap-desktop"));
  await capture(session, "roadmap-desktop");

  if (runtimeErrors.length > 0) {
    throw new Error(`Browser runtime errors detected:\n${[...new Set(runtimeErrors)].join("\n")}`);
  }

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
