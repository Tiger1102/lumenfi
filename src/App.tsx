import { Activity, ArrowRight, ArrowRightLeft, BrainCircuit, CheckCircle2, ChevronDown, Copy, ExternalLink, Landmark, Layers3, PlugZap, ShieldCheck, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import projectSubmission from "../docs/project-submission.md?raw";
import whitepaper from "../docs/whitepaper.md?raw";
import { BridgePanel } from "./components/BridgePanel";
import { LendingPanel } from "./components/LendingPanel";
import { MarkdownDoc } from "./components/MarkdownDoc";
import { PoolLiquidityPanel } from "./components/PoolLiquidityPanel";
import { SwapPanel } from "./components/SwapPanel";
import { roadmapItems } from "./content/roadmap";
import { arcPublicClient, ARC_TESTNET_CHAIN_ID, ARC_TOKENS, BALANCE_TOKEN_SYMBOLS, erc20Abi, formatTokenAmount, getTokenAddress, readWithRetry, switchToArc, type TokenSymbol } from "./lib/arc";
import { lendingPoolAddress } from "./lib/lending";
import { swapPoolAddress } from "./lib/swapPool";
import { connectInjectedWallet, type ConnectedWallet } from "./lib/wallet";

type StatusState = { state: "idle" | "loading" | "success" | "error"; message: string; txHash?: string };
type Page = "overview" | "app" | "bridge";
type MarketTab = "swap" | "pool" | "lending";

const pagePaths: Record<Page, string> = {
  overview: "/",
  app: "/market",
  bridge: "/bridge"
};

function pageFromPath(pathname: string): Page {
  if (pathname === "/market" || pathname === "/markets" || pathname === "/app") return "app";
  if (pathname === "/bridge") return "bridge";
  return "overview";
}

const featureCards = [
  { icon: Landmark, title: "Money Market", copy: "Supply USDC or EURC, borrow against collateral, and monitor account health from a focused lending workspace.", accent: "cyan" },
  { icon: ArrowRightLeft, title: "Liquidity Pool", copy: "Swap USDC/EURC, provide liquidity, track LP shares, and review pool ownership in one operator view.", accent: "pink" },
  { icon: Layers3, title: "USDC Bridge", copy: "Prepare USDC bridge flows into Arc with clear source-chain, destination-chain, and balance context.", accent: "violet" }
];

const marketRows = [
  { symbol: "USDC" as TokenSymbol, name: "USD Coin", ltv: "70%", decimals: "6", state: "Live" },
  { symbol: "EURC" as TokenSymbol, name: "Euro Coin", ltv: "70%", decimals: "6", state: "Live" },
  { symbol: "cirBTC" as TokenSymbol, name: "Circle Bitcoin", ltv: "Planned", decimals: "8", state: "App Kit" }
];

const protocolLinks = [
  ["Arc Network", "Stablecoin-native EVM testnet used by LumenFi.", "https://arc.io"],
  ["Arc Docs", "Network references, RPC details, and builder resources.", "https://docs.arc.network"],
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
  ["Pool fee", "0.30%", "Accrues to reserves"],
  ["LP access", "Open", "USDC + EURC"],
  ["Pair", "USDC/EURC", "Live pool route"],
  ["Tx visibility", "Inline", "Module-level receipts"]
];

const heroProofPoints = [
  "Production hosted",
  "Inline transaction tracking",
  "Permissionless liquidity",
  "Arc-native USDC flows"
];

const workspaceTrustItems = [
  "Public contract links",
  "Explorer-ready receipts",
  "Wallet balance refresh"
];

const marketTabs: { id: MarketTab; label: string }[] = [
  { id: "swap", label: "Swap" },
  { id: "pool", label: "Liquidity Pools" },
  { id: "lending", label: "Lending Market" }
];

export default function App() {
  const [wallet, setWallet] = useState<ConnectedWallet>();
  const [balances, setBalances] = useState<Partial<Record<TokenSymbol, bigint>>>({});
  const [status, setStatusState] = useState<StatusState>({ state: "idle", message: "" });
  const [activeDoc, setActiveDoc] = useState<"whitepaper" | "submission" | null>(null);
  const [page, setPageState] = useState<Page>(() => pageFromPath(window.location.pathname));
  const [balancePopoverOpen, setBalancePopoverOpen] = useState(false);
  const [isArcNetwork, setIsArcNetwork] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [activeMarketTab, setActiveMarketTab] = useState<MarketTab>("swap");
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
    setStatus("Wallet disconnected.", "idle");
  }

  function setPage(nextPage: Page, options: { replace?: boolean } = {}) {
    setPageState(nextPage);
    const nextPath = pagePaths[nextPage];
    if (window.location.pathname !== nextPath) {
      const method = options.replace ? "replaceState" : "pushState";
      window.history[method]({ page: nextPage }, "", nextPath);
    }
  }

  function openRoadmap() {
    setActiveDoc(null);
    setPage("overview");
    window.setTimeout(() => document.getElementById("roadmap")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function openDoc(doc: "whitepaper" | "submission") {
    setPage("overview");
    window.setTimeout(() => setActiveDoc(doc), 50);
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
      const entries: [TokenSymbol, bigint][] = [];
      for (const symbol of BALANCE_TOKEN_SYMBOLS) {
        const token = ARC_TOKENS[symbol];
        if (!token.address) {
          entries.push([token.symbol, 0n]);
          continue;
        }

        const value = await readWithRetry(
          () => arcPublicClient.readContract({ address: getTokenAddress(symbol), abi: erc20Abi, functionName: "balanceOf", args: [address] }),
          `${symbol} balance`
        );
        entries.push([token.symbol, value]);
      }
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
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setPage("overview")} aria-label="LumenFi overview">
          <img className="brandMark" src="/lumenfi-logo.svg" alt="" />
          <span>LumenFi</span>
        </button>
        <nav className="navLinks" aria-label="Primary navigation">
          <button className={page === "overview" ? "active" : ""} type="button" onClick={() => setPage("overview")}>Overview</button>
          <button className={page === "app" ? "active" : ""} type="button" onClick={() => setPage("app")}>Markets</button>
          <button className={page === "bridge" ? "active" : ""} type="button" onClick={() => setPage("bridge")}>Bridge</button>
          <button type="button" onClick={openRoadmap}>Roadmap</button>
          <a href="https://faucet.circle.com" target="_blank" rel="noreferrer">Faucet</a>
          <button type="button" onClick={() => openDoc("whitepaper")}>Docs</button>
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
                <button className="disconnectButton" type="button" onClick={disconnect}>Disconnect</button>
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

      {page === "overview" ? (
        <>
          <section className="heroBanner">
            <div className="heroCopy">
              <p className="liveBadge"><span /> Production preview on Arc Testnet</p>
              <h1>The smartest stablecoin DeFi workspace on Arc.</h1>
              <p>LumenFi is a clean, all-in-one DeFi market interface on Arc Testnet, combining balances, swaps, LP positions, credit markets, and seamless USDC bridging.</p>
              <div className="heroActions">
                <button className="primaryButton heroConnect" type="button" onClick={() => setPage("app")}>Launch App <ArrowRight size={18} /></button>
              </div>
              <div className="heroProofList" aria-label="LumenFi product highlights">
                {heroProofPoints.map((item) => <span key={item}><CheckCircle2 size={15} />{item}</span>)}
              </div>
            </div>
            <div className="heroTerminal" aria-label="LumenFi market status">
              <div className="terminalHeader"><div><span>Market status</span><strong>Arc Testnet</strong></div><Activity size={20} /></div>
              <div className="snapshotGrid">
                <div><span>Supported assets</span><strong>USDC / EURC / cirBTC</strong></div>
                <div><span>Liquidity route</span><strong>LumenFi pool</strong></div>
                <div><span>Credit market</span><strong>Deployed</strong></div>
                <div><span>Gas model</span><strong>USDC</strong></div>
                <div><span>Deployment</span><strong>Cloudflare Hosted (Production)</strong></div>
                <div><span>Execution UX</span><strong>Inline tx receipts</strong></div>
              </div>
              <div className="heroStats" aria-label="Project status">
                <div><Zap size={18} /><span>Sub-second UX</span><strong>Testnet</strong></div>
                <div><ShieldCheck size={18} /><span>Chain ID</span><strong>5042002</strong></div>
                <a href="https://lumenfi.click" target="_blank" rel="noreferrer"><ExternalLink size={18} /><span>Live app</span><strong>Open</strong></a>
              </div>
            </div>
          </section>

          <section className="sectionBlock">
            <div className="sectionHeader"><p className="eyebrow">Product stack</p><h2>A focused DeFi market layer for Arc.</h2><p>Markets, liquidity, credit, and bridge controls are grouped into a single operator view.</p></div>
            <div className="featureGrid">
              {featureCards.map((card) => { const Icon = card.icon; return <article className={`featureCard ${card.accent}`} key={card.title}><div className="featureIcon"><Icon size={22} /></div><h3>{card.title}</h3><p>{card.copy}</p></article>; })}
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
            <div className="sectionHeader"><p className="eyebrow">Roadmap</p><h2>From testnet review to production markets.</h2><p>Live modules stay visible, while upcoming work is scoped around risk controls, liquidity depth, analytics, and the AI assistant layer.</p></div>
            <div className="roadmapGrid">{roadmapItems.map((item) => <article className="roadmapCard" key={item.phase}><span>{item.phase}</span><em>{item.status}</em><h3>{item.title}</h3><p>{item.copy}</p></article>)}</div>
          </section>
        </>
      ) : page === "app" ? (
        <section className="dashboardShell appPage">
          <div className="dashboardHeader">
            <div>
              <p className="eyebrow">LumenFi Market Dashboard</p>
              <h2>Arc-native stablecoin markets.</h2>
            </div>
          </div>
          <div className="metricDeck" aria-label="LumenFi key metrics">
            {marketMetrics.map(([label, value, note]) => <div key={label}><span>{label}</span><strong>{value}</strong><p>{note}</p></div>)}
          </div>
          <div className="trustStrip proMaxTrust" aria-label="Workspace quality controls">
            {workspaceTrustItems.map((item) => <span key={item}>{item}</span>)}
          </div>

          <div className="proSections">
            <div className="moduleTabs" aria-label="Market modules">
              {marketTabs.map((tab) => (
                <button className={activeMarketTab === tab.id ? "active" : ""} type="button" key={tab.id} onClick={() => setActiveMarketTab(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="marketModule" aria-label="Selected market action">
              {activeMarketTab === "swap" && (
                <SwapPanel
                  address={wallet?.address}
                  provider={wallet?.provider}
                  walletClient={wallet?.walletClient}
                  balances={balances}
                  balancesLoading={balancesLoading}
                  onConnect={connect}
                  setStatus={setStatus}
                />
              )}
              {activeMarketTab === "pool" && (
                <PoolLiquidityPanel address={wallet?.address} walletClient={wallet?.walletClient} onConnect={connect} setStatus={setStatus} />
              )}
              {activeMarketTab === "lending" && (
                <LendingPanel address={wallet?.address} walletClient={wallet?.walletClient} onConnect={connect} setStatus={setStatus} />
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="dashboardShell bridgePage">
          <div className="dashboardHeader">
            <div>
              <p className="eyebrow">Bridge</p>
              <h2>Move USDC across supported testnet networks.</h2>
            </div>
          </div>
          <div className="trustStrip proMaxTrust bridgeTrust" aria-label="Bridge quality controls">
            <span>Source and destination chains</span>
            <span>Arc destination context</span>
            <span>USDC route preparation</span>
            <strong><BrainCircuit size={16} />Designed for guided bridge execution and future assistant support.</strong>
          </div>

          <div className="bridgeWorkspace single">
            <BridgePanel address={wallet?.address} provider={wallet?.provider} setStatus={setStatus} />
          </div>
        </section>
      )}

      {activeDoc && <div className="docOverlay" role="dialog" aria-modal="true" aria-label={activeDoc === "whitepaper" ? "Whitepaper" : "Submission"}><div className="docModal"><div className="docHeader"><div><p className="eyebrow">LumenFi docs</p><h2>{activeDoc === "whitepaper" ? "Whitepaper" : "Project submission"}</h2></div><button className="iconButton" type="button" onClick={() => setActiveDoc(null)} title="Close document"><X size={18} /></button></div><MarkdownDoc content={activeDoc === "whitepaper" ? whitepaper : projectSubmission} /></div></div>}

      <footer className="siteFooter">
        <div className="footerTop">
          <div className="footerBrand"><div><img src="/lumenfi-logo.svg" alt="" /><strong>LumenFi</strong></div><p>Premium DeFi workspace for Arc stablecoin liquidity, credit markets, LP positions, and USDC onboarding.</p></div>
          <div className="footerColumns">
            <nav className="footerColumn" aria-label="Resources links">
              <p>Resources</p>
              <button type="button" onClick={() => openDoc("whitepaper")}>Whitepaper</button>
              <button type="button" onClick={() => openDoc("submission")}>Submission</button>
              <a href="https://docs.arc.network" target="_blank" rel="noreferrer">Arc Docs</a>
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




