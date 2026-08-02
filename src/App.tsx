import { Activity, ArrowRight, ArrowRightLeft, ChevronDown, Copy, ExternalLink, Landmark, Layers3, PlugZap, ShieldCheck, Zap } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { DocsPage } from "./components/DocsPage";
import { roadmapItems } from "./content/roadmap";
import type { AgentActionDraft, AgentActivity, AgentDestination } from "./lib/agent";
import { arcPublicClient, ARC_TESTNET_CHAIN_ID, ARC_TOKENS, BALANCE_TOKEN_SYMBOLS, erc20Abi, formatTokenAmount, getTokenAddress, readWithRetry, switchToArc, type TokenSymbol } from "./lib/arc";
import { lendingPoolAddress } from "./lib/lending";
import { swapPoolAddress } from "./lib/swapPool";
import { connectInjectedWallet, type ConnectedWallet } from "./lib/wallet";

const BridgePanel = lazy(() => import("./components/BridgePanel").then((module) => ({ default: module.BridgePanel })));
const AgentPanel = lazy(() => import("./components/AgentPanel").then((module) => ({ default: module.AgentPanel })));
const LendingPanel = lazy(() => import("./components/LendingPanel").then((module) => ({ default: module.LendingPanel })));
const PoolLiquidityPanel = lazy(() => import("./components/PoolLiquidityPanel").then((module) => ({ default: module.PoolLiquidityPanel })));
const SwapPanel = lazy(() => import("./components/SwapPanel").then((module) => ({ default: module.SwapPanel })));

type StatusState = { state: "idle" | "loading" | "success" | "error"; message: string; txHash?: string };
type Page = "overview" | "app" | "bridge" | "agent" | "docs";
type MarketTab = "swap" | "pool" | "lending";

const pagePaths: Record<Page, string> = {
  overview: "/",
  app: "/market",
  bridge: "/bridge",
  agent: "/agent",
  docs: "/docs"
};

function pageFromPath(pathname: string): Page {
  if (pathname === "/market" || pathname === "/markets" || pathname === "/app") return "app";
  if (pathname === "/bridge") return "bridge";
  if (pathname === "/agent") return "agent";
  if (pathname === "/docs") return "docs";
  return "overview";
}

const featureCards = [
  { icon: Landmark, title: "Borrow against stablecoins", copy: "Supply USDC or EURC, borrow against collateral, and monitor account health from a focused lending workspace." },
  { icon: ArrowRightLeft, title: "Manage USDC/EURC liquidity", copy: "Swap stablecoins, provide liquidity, track LP shares, and review pool ownership in one operator view." },
  { icon: Layers3, title: "Prepare cross-chain USDC", copy: "Set up bridge flows into Arc with clear source, destination, recipient, and balance context." }
];

const marketRows = [
  { symbol: "USDC" as TokenSymbol, name: "USD Coin", ltv: "70%", decimals: "6", state: "Live" },
  { symbol: "EURC" as TokenSymbol, name: "Euro Coin", ltv: "70%", decimals: "6", state: "Live" },
  { symbol: "cirBTC" as TokenSymbol, name: "Circle Bitcoin", ltv: "Planned", decimals: "8", state: "App Kit" }
];

const protocolLinks = [
  ["Arc Network", "Stablecoin-native EVM testnet used by LumenFi.", "https://arc.io"],
  ["Arc Docs", "Network references, agent standards, and builder resources.", "https://docs.arc.io/build"],
  ["Arc Explorer", "Inspect transactions, contracts, and testnet state.", "https://testnet.arcscan.app"],
  ["Circle Faucet", "Get Arc Testnet assets for wallet testing.", "https://faucet.circle.com"]
];

const contractRows = [
  ["LendingPool", "Collateralized lending, borrowing, repayment, and account health", lendingPoolAddress],
  ["PermissionlessStablePool", "USDC/EURC liquidity pool with LP shares and swap fee accrual", swapPoolAddress],
  ["USDC", "Arc ERC-20 USDC balance and approvals", "0x3600000000000000000000000000000000000000"],
  ["EURC", "Arc Testnet EURC asset", "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"]
];

const marketMetrics = [
  ["Swap fee", "0.30%", "Accrues to pool reserves"],
  ["LP access", "Open", "USDC + EURC"],
  ["Active pair", "USDC/EURC", "Arc Testnet pool"],
  ["Receipts", "Inline", "Explorer-ready"]
];

const marketTabs: { id: MarketTab; label: string }[] = [
  { id: "swap", label: "Swap" },
  { id: "pool", label: "Liquidity Pools" },
  { id: "lending", label: "Lending Market" }
];

const AGENT_ACTIVITY_STORAGE_KEY = "lumenfi:agent-activity:v1";

function readAgentActivity(): AgentActivity[] {
  try {
    const stored = window.localStorage.getItem(AGENT_ACTIVITY_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AgentActivity[]).slice(0, 12) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [wallet, setWallet] = useState<ConnectedWallet>();
  const [balances, setBalances] = useState<Partial<Record<TokenSymbol, bigint>>>({});
  const [status, setStatusState] = useState<StatusState>({ state: "idle", message: "" });
  const [page, setPageState] = useState<Page>(() => pageFromPath(window.location.pathname));
  const [balancePopoverOpen, setBalancePopoverOpen] = useState(false);
  const [isArcNetwork, setIsArcNetwork] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [activeMarketTab, setActiveMarketTab] = useState<MarketTab>("swap");
  const [agentDraft, setAgentDraft] = useState<AgentActionDraft>();
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>(readAgentActivity);
  const balancePopoverRef = useRef<HTMLDivElement>(null);

  const totalBalance = useMemo(() => {
    const usdc = Number(formatTokenAmount(balances.USDC ?? 0n, ARC_TOKENS.USDC));
    const eurc = Number(formatTokenAmount(balances.EURC ?? 0n, ARC_TOKENS.EURC));
    return usdc + eurc;
  }, [balances]);

  const balanceBreakdown = useMemo(
    () =>
      BALANCE_TOKEN_SYMBOLS.map((symbol) => {
        const token = ARC_TOKENS[symbol];
        const value = balances[symbol] ?? 0n;
        return {
          symbol,
          token,
          value,
          formatted: formatTokenAmount(value, token)
        };
      }),
    [balances]
  );

  function setStatus(message: string, state: StatusState["state"] = "idle", txHash?: string) {
    setStatusState({ message, state, txHash });

    if (txHash && state === "success" && wallet?.address) {
      refreshBalances(wallet.address).catch(() => undefined);

      const draftMatchesCurrentModule = agentDraft && (
        (agentDraft.destination === "bridge" && page === "bridge") ||
        (page === "app" && agentDraft.destination === activeMarketTab)
      );

      if (agentDraft && draftMatchesCurrentModule) {
        const completed: AgentActivity = {
          id: `${agentDraft.id}-${txHash}`,
          title: agentDraft.title,
          action: agentDraft.action,
          asset: agentDraft.secondaryAsset ? `${agentDraft.asset} → ${agentDraft.secondaryAsset}` : agentDraft.asset,
          amount: agentDraft.amount,
          destination: agentDraft.destination,
          txHash,
          completedAt: new Date().toISOString()
        };
        setAgentActivity((current) => {
          const next = [completed, ...current.filter((item) => item.txHash !== txHash)].slice(0, 12);
          try {
            window.localStorage.setItem(AGENT_ACTIVITY_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // The in-memory receipt still remains available when storage is blocked.
          }
          return next;
        });
        setAgentDraft(undefined);
      }
    }
  }

  async function connect() {
    try {
      setStatus("Connecting wallet and switching to Arc...", "loading");
      const connected = await connectInjectedWallet();
      setWallet(connected);
      await updateNetworkState(connected.provider);
      setStatus("Wallet connected on Arc Testnet.", "success");
      await refreshBalances(connected.address);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Wallet connection failed.", "error");
    }
  }

  function disconnect() {
    setWallet(undefined);
    setBalances({});
    setAgentDraft(undefined);
    setStatus("Wallet disconnected.", "idle");
  }

  function setPage(nextPage: Page, options: { replace?: boolean } = {}) {
    setPageState(nextPage);
    const nextPath = pagePaths[nextPage];
    if (window.location.pathname !== nextPath) {
      const method = options.replace ? "replaceState" : "pushState";
      window.history[method]({ page: nextPage }, "", nextPath);
    }
    window.setTimeout(() => document.getElementById("page-content")?.focus({ preventScroll: true }), 0);
  }

  function openRoadmap() {
    setPage("overview");
    window.setTimeout(() => document.getElementById("roadmap")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function openAgentDestination(destination: AgentDestination, draft?: AgentActionDraft) {
    setAgentDraft(draft);
    if (destination === "bridge") {
      setPage("bridge");
      return;
    }

    setActiveMarketTab(destination);
    setPage("app");
  }

  async function copyAddress() {
    if (!wallet?.address) return;
    await navigator.clipboard?.writeText(wallet.address);
    setStatus("Address copied.", "success");
  }

  async function updateNetworkState(provider: ConnectedWallet["provider"]) {
    const chainId = await provider.request({ method: "eth_chainId" });
    const nextIsArcNetwork = chainId === `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`;
    setIsArcNetwork(nextIsArcNetwork);
    return nextIsArcNetwork;
  }

  async function switchArcNetwork() {
    if (!wallet?.provider) return;

    try {
      setStatus("Switching wallet to Arc Testnet...", "loading");
      await switchToArc(wallet.provider);
      await updateNetworkState(wallet.provider);
      setStatus("Wallet is on Arc Testnet.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Network switch failed.", "error");
    }
  }

  async function refreshBalances(address: Address) {
    setBalancesLoading(true);

    try {
      const entries = await Promise.all(BALANCE_TOKEN_SYMBOLS.map(async (symbol): Promise<[TokenSymbol, bigint]> => {
        const token = ARC_TOKENS[symbol];
        if (!token.address) {
          return [token.symbol, 0n];
        }

        const value = await readWithRetry(
          () => arcPublicClient.readContract({ address: getTokenAddress(symbol), abi: erc20Abi, functionName: "balanceOf", args: [address] }),
          `${symbol} balance`
        );
        return [token.symbol, value];
      }));
      setBalances(Object.fromEntries(entries) as Partial<Record<TokenSymbol, bigint>>);
    } catch (error) {
      setStatus(error instanceof Error ? `Balance read failed: ${error.message}` : "Balance read failed.", "error");
      throw error;
    } finally {
      setBalancesLoading(false);
    }
  }

  useEffect(() => {
    setPage(pageFromPath(window.location.pathname), { replace: true });
    const handlePopState = () => setPageState(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const titles: Record<Page, string> = {
      overview: "LumenFi | Stablecoin markets for Arc",
      app: "Markets | LumenFi",
      bridge: "Bridge USDC | LumenFi",
      agent: "Onchain agent | LumenFi",
      docs: "Documentation | LumenFi"
    };
    document.title = titles[page];
  }, [page]);

  useEffect(() => {
    if (status.state === "idle" || status.state === "loading" || !status.message) return;
    const timer = window.setTimeout(() => setStatusState({ state: "idle", message: "" }), 5_000);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!wallet?.provider?.on) return;
    const handleAccountsChanged = () => connect().catch(() => undefined);
    const handleChainChanged = () => {
      updateNetworkState(wallet.provider)
        .then((nextIsArcNetwork) => {
          if (!nextIsArcNetwork) {
            setStatus("Wrong network. Switch wallet to Arc Testnet.", "error");
            return;
          }

          if (wallet.address) {
            refreshBalances(wallet.address).catch(() => undefined);
          }
        })
        .catch(() => undefined);
    };
    wallet.provider.on("accountsChanged", handleAccountsChanged);
    wallet.provider.on("chainChanged", handleChainChanged);
    return () => {
      wallet.provider.removeListener?.("accountsChanged", handleAccountsChanged);
      wallet.provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [wallet?.provider]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (balancePopoverRef.current && !balancePopoverRef.current.contains(event.target as Node)) {
        setBalancePopoverOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setBalancePopoverOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <main>
      <a className="skipLink" href="#page-content">Skip to main content</a>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setPage("overview")} aria-label="LumenFi overview">
          <img className="brandMark" src="/lumenfi-logo.svg" alt="" />
          <span>LumenFi</span>
        </button>
        <nav className="navLinks" aria-label="Primary navigation">
          <button className={page === "overview" ? "active" : ""} type="button" onClick={() => setPage("overview")}>Overview</button>
          <button className={page === "app" ? "active" : ""} type="button" onClick={() => setPage("app")}>Markets</button>
          <button className={page === "bridge" ? "active" : ""} type="button" onClick={() => setPage("bridge")}>Bridge</button>
          <button className={page === "agent" ? "active" : ""} type="button" onClick={() => setPage("agent")}>Agent</button>
          <button type="button" onClick={openRoadmap}>Roadmap</button>
          <a href="https://faucet.circle.com" target="_blank" rel="noreferrer">Faucet</a>
          <button className={page === "docs" ? "active" : ""} type="button" onClick={() => setPage("docs")}>Docs</button>
        </nav>
        <div className="headerRight">
          {wallet && (
            <button
              className={isArcNetwork ? "networkBadge" : "networkBadge warning"}
              type="button"
              onClick={switchArcNetwork}
              title={isArcNetwork ? "Connected to Arc Testnet" : "Switch to Arc Testnet"}
            >
              <span />
              {isArcNetwork ? "Arc Testnet" : "Wrong Network"}
            </button>
          )}
          {wallet && (
            <div
              className="balancePopover"
              ref={balancePopoverRef}
              onMouseEnter={() => setBalancePopoverOpen(true)}
              onMouseLeave={() => setBalancePopoverOpen(false)}
            >
              <button
                className="balanceTrigger"
                type="button"
                aria-expanded={balancePopoverOpen}
                aria-label={`Wallet ${formatAddress(wallet.address)}, total balance $${totalBalance.toFixed(2)}`}
                onClick={() => setBalancePopoverOpen((value) => !value)}
              >
                <span>{formatAddress(wallet.address)}</span>
                <strong>${totalBalance.toFixed(2)}</strong>
                <ChevronDown size={14} />
              </button>
              {balancePopoverOpen && (
                <div className="balanceDropdown" role="menu" aria-label="Token balances">
                  {balanceBreakdown.map(({ symbol, token, formatted }) => (
                    <div className="balanceDropdownRow" key={symbol}>
                      <span className="tokenIcon" style={{ background: token.accent }}>{symbol === "cirBTC" ? "B" : symbol.slice(0, 1)}</span>
                      <div>
                        <strong>{symbol}</strong>
                        <small>{token.name}</small>
                      </div>
                      <b>{formatted}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="walletActions">
            {wallet ? (
              <>
                <div className="walletTools" aria-label="Wallet tools">
                  <button type="button" onClick={copyAddress} title="Copy address"><Copy size={14} /></button>
                  <a href={`https://testnet.arcscan.app/address/${wallet.address}`} target="_blank" rel="noreferrer" title="View wallet on Arc Explorer"><ExternalLink size={14} /></a>
                </div>
                <button className="disconnectButton" type="button" onClick={disconnect} aria-label="Disconnect wallet">Disconnect</button>
              </>
            ) : (
              <button className="connectButton" type="button" onClick={connect}>
                <PlugZap size={18} />
                Connect wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="mobileNav" aria-label="Mobile navigation">
        <button className={page === "overview" ? "active" : ""} type="button" onClick={() => setPage("overview")}>Overview</button>
        <button className={page === "app" ? "active" : ""} type="button" onClick={() => setPage("app")}>Markets</button>
        <button className={page === "bridge" ? "active" : ""} type="button" onClick={() => setPage("bridge")}>Bridge</button>
        <button className={page === "agent" ? "active" : ""} type="button" onClick={() => setPage("agent")}>Agent</button>
        <button className={page === "docs" ? "active" : ""} type="button" onClick={() => setPage("docs")}>Docs</button>
      </nav>

      <div id="page-content" tabIndex={-1}>
      {page === "overview" ? (
        <>
          <section className="heroBanner">
            <div className="heroCopy">
              <p className="liveBadge"><span /> Live on Arc Testnet</p>
              <h1>Stablecoin markets, built for Arc.</h1>
              <p>Swap, supply liquidity, borrow, and prepare USDC routes from one Arc Testnet workspace.</p>
              <div className="heroActions">
                <button className="primaryButton heroConnect" type="button" onClick={() => setPage("app")}>Launch App <ArrowRight size={18} /></button>
              </div>
            </div>
            <div className="heroTerminal" aria-label="LumenFi market status">
              <div className="terminalHeader"><div><span>Market status</span><strong>Arc Testnet</strong></div><Activity size={20} /></div>
              <div className="snapshotGrid">
                <div><span>Market assets</span><strong>USDC / EURC</strong></div>
                <div><span>Liquidity route</span><strong>LumenFi pool</strong></div>
                <div><span>Credit market</span><strong>Deployed</strong></div>
                <div><span>Contracts</span><strong>2 deployed</strong></div>
              </div>
              <div className="heroStats" aria-label="Project status">
                <div><Zap size={18} /><span>Gas token</span><strong>USDC</strong></div>
                <div><ShieldCheck size={18} /><span>Chain ID</span><strong>5042002</strong></div>
              </div>
            </div>
          </section>

          <section className="sectionBlock">
            <div className="sectionHeader"><p className="eyebrow">Product</p><h2>One workspace for Arc stablecoin markets.</h2><p>Liquidity, credit, bridge preparation, and account guidance stay close to the action that needs them.</p></div>
            <div className="featureGrid">
              {featureCards.map((card) => { const Icon = card.icon; return <article className="featureCard" key={card.title}><div className="featureIcon"><Icon size={22} /></div><h3>{card.title}</h3><p>{card.copy}</p></article>; })}
            </div>
          </section>

          <section className="sectionBlock marketSection">
            <div className="sectionHeader compact"><p className="eyebrow">Markets</p><h2>Supported assets</h2></div>
            <div className="marketTable" role="table" aria-label="Supported assets">
              <div className="marketRow marketHead" role="row"><span>Asset</span><span>Collateral factor</span><span>Decimals</span><span>Status</span></div>
              {marketRows.map(({ symbol, name, ltv, decimals, state }) => (
                <div className="marketRow" role="row" key={symbol}>
                  <span className="assetCell">
                    <i className="tokenIcon" style={{ background: ARC_TOKENS[symbol].accent }}>
                      {symbol === "cirBTC" ? "B" : symbol.slice(0, 1)}
                    </i>
                    <b>{symbol}</b>
                    <small>{name}</small>
                  </span>
                  <span>{ltv}</span>
                  <span>{decimals}</span>
                  <span><em>{state}</em></span>
                </div>
              ))}
            </div>
          </section>

          <section className="sectionBlock infraSection" aria-label="Protocol infrastructure">
            <div className="sectionHeader"><p className="eyebrow">Infrastructure</p><h2>Transparent market infrastructure.</h2><p>Wallet actions use public contracts, Arc network resources, and Circle-powered USDC workflows.</p></div>
            <div className="infraGrid">
              {protocolLinks.map(([title, copy, href]) => <a className="infraCard" href={href} target="_blank" rel="noreferrer" key={title}><span>{title}</span><p>{copy}</p><ExternalLink size={16} /></a>)}
            </div>
            <div className="contractTable" aria-label="Contract addresses">
              {contractRows.map(([name, purpose, address]) => (
                <div className="contractRow" key={name}>
                  <span>{name}</span>
                  <p>{purpose}</p>
                  <a className="contractAddress" href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noreferrer" title={address}>
                    <code>{shortHex(address)}</code>
                    <ExternalLink size={13} />
                  </a>
                </div>
              ))}
            </div>
          </section>

          <section id="roadmap" className="sectionBlock roadmapPage" aria-label="LumenFi roadmap">
            <div className="sectionHeader"><p className="eyebrow">Roadmap</p><h2>From live markets to controlled automation.</h2><p>The action agent is live with wallet-controlled execution. Stronger evidence, simulation, and permission policies remain separate milestones.</p></div>
            <div className="roadmapGrid">
              {roadmapItems.map((item) => (
                <article className="roadmapCard" key={item.phase}>
                  <span>{item.phase}</span>
                  <em>{item.status}</em>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : page === "app" ? (
        <section className="dashboardShell appPage">
          <div className="dashboardHeader">
            <div>
              <p className="eyebrow">Markets</p>
              <h1>Arc stablecoin workspace</h1>
            </div>
          </div>
          <div className="metricDeck" aria-label="LumenFi key metrics">
            {marketMetrics.map(([label, value, note]) => <div key={label}><span>{label}</span><strong>{value}</strong><p>{note}</p></div>)}
          </div>
          <div className="proSections">
            <div className="moduleTabs" aria-label="Market modules">
              {marketTabs.map((tab) => (
                <button
                  className={activeMarketTab === tab.id ? "active" : ""}
                  type="button"
                  key={tab.id}
                  onClick={() => {
                    setActiveMarketTab(tab.id);
                    if (agentDraft && agentDraft.destination !== tab.id) setAgentDraft(undefined);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="marketModule" aria-label="Selected market action">
              <Suspense fallback={<ModuleFallback label="Loading market module..." />}>
                {activeMarketTab === "swap" ? (
                  <SwapPanel
                    address={wallet?.address}
                    provider={wallet?.provider}
                    walletClient={wallet?.walletClient}
                    balances={balances}
                    balancesLoading={balancesLoading}
                    agentDraft={agentDraft}
                    onDismissAgentDraft={() => setAgentDraft(undefined)}
                    onConnect={connect}
                    setStatus={setStatus}
                  />
                ) : activeMarketTab === "pool" ? (
                  <PoolLiquidityPanel address={wallet?.address} walletClient={wallet?.walletClient} onConnect={connect} setStatus={setStatus} />
                ) : (
                  <LendingPanel
                    address={wallet?.address}
                    walletClient={wallet?.walletClient}
                    agentDraft={agentDraft}
                    onDismissAgentDraft={() => setAgentDraft(undefined)}
                    onConnect={connect}
                    setStatus={setStatus}
                  />
                )}
              </Suspense>
            </div>
          </div>
        </section>
      ) : page === "bridge" ? (
        <section className="dashboardShell bridgePage">
          <div className="dashboardHeader">
            <div>
              <p className="eyebrow">Bridge</p>
              <h1>Move USDC across supported testnet networks.</h1>
            </div>
          </div>
          <div className="bridgeWorkspace single">
            <Suspense fallback={<ModuleFallback label="Loading bridge module..." />}>
              <BridgePanel
                address={wallet?.address}
                provider={wallet?.provider}
                agentDraft={agentDraft}
                onDismissAgentDraft={() => setAgentDraft(undefined)}
                setStatus={setStatus}
              />
            </Suspense>
          </div>
        </section>
      ) : page === "agent" ? (
        <section className="dashboardShell agentPage">
          <div className="dashboardHeader agentPageHeader">
            <div>
              <p className="eyebrow">User-controlled Arc intelligence</p>
              <h1>From onchain evidence to an executable draft</h1>
              <p>Ask for portfolio, lending, yield, swap, or bridge guidance. The agent prepares bounded actions from live contract state; your wallet reviews and signs every transaction.</p>
            </div>
            <a href="https://docs.arc.io/build/agentic-economy" target="_blank" rel="noreferrer">Arc agentic economy <ExternalLink size={15} /></a>
          </div>
          <Suspense fallback={<ModuleFallback label="Loading LumenFi Agent..." />}>
            <AgentPanel
              address={wallet?.address}
              balances={balances}
              balancesLoading={balancesLoading}
              activity={agentActivity}
              onConnect={connect}
              onNavigate={openAgentDestination}
            />
          </Suspense>
        </section>
      ) : (
        <DocsPage />
      )}
      </div>

      {status.message && <div className={`systemToast ${status.state}`} role="status"><span>{status.message}</span>{status.txHash && <a href={`https://testnet.arcscan.app/tx/${status.txHash}`} target="_blank" rel="noreferrer">View transaction</a>}<button type="button" onClick={() => setStatusState({ state: "idle", message: "" })}>Close</button></div>}

      <footer className="siteFooter">
        <div className="footerTop">
          <div className="footerBrand"><div><img src="/lumenfi-logo.svg" alt="" /><strong>LumenFi</strong></div><p>Arc Testnet workspace for stablecoin liquidity, credit markets, LP positions, and USDC onboarding.</p></div>
          <div className="footerColumns">
            <nav className="footerColumn" aria-label="Resources links">
              <p>Resources</p>
              <button type="button" onClick={() => setPage("docs")}>Documentation</button>
              <a href="https://docs.arc.io/build" target="_blank" rel="noreferrer">Arc Docs</a>
              <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">Arc Explorer</a>
            </nav>
            <nav className="footerColumn footerConnect" aria-label="Connect links">
              <p>Contact Dev</p>
              <a href="https://x.com/Hydra12351" target="_blank" rel="noreferrer">X</a>
              <a href="https://t.me/NFTlet" target="_blank" rel="noreferrer">Telegram</a>
            </nav>
          </div>
        </div>
        <div className="footerBottom"><span>2026 LumenFi Protocol. Powered by Circle and Arc Network.</span><span>Arc-native market workspace</span></div>
      </footer>
    </main>
  );
}

function shortHex(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function ModuleFallback({ label }: { label: string }) {
  return (
    <section className="panel" role="status" aria-live="polite">
      <p className="eyebrow">{label}</p>
      <i className="skeletonText" />
    </section>
  );
}




