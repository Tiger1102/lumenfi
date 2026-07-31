type RoadmapItem = {
  phase: string;
  title: string;
  status: "Live" | "Next" | "Planned" | "Research";
  copy: string;
  href?: string;
  linkLabel?: string;
};

export const roadmapItems: RoadmapItem[] = [
  {
    phase: "01",
    title: "Live professional MVP",
    status: "Live",
    copy: "Professional dark-mode interface with overview-first navigation, wallet balances, module-level transaction feedback, docs, and Cloudflare-hosted production deployment."
  },
  {
    phase: "02",
    title: "Permissionless LP pool",
    status: "Live",
    copy: "Replaced the owner-only swap pool with a permissionless USDC/EURC pool where users can add liquidity, receive LP shares, and realize swap fees when removing liquidity."
  },
  {
    phase: "03",
    title: "Circle bridge routes",
    status: "Live",
    copy: "Enabled Circle App Kit bridge flow from Base Sepolia, Ethereum Sepolia, and Arbitrum Sepolia into Arc Testnet with visible from-chain and to-chain routing."
  },
  {
    phase: "04",
    title: "Lending market and risk controls",
    status: "Live",
    copy: "Deployed USDC/EURC lending with deposit, withdraw, borrow, repay, account health, liquidation buffer, max-withdraw guidance, and clearer borrower risk feedback in the app."
  },
  {
    phase: "05",
    title: "Market depth and analytics",
    status: "Live",
    copy: "Added live pool depth, LP supply, reserve analytics, pool rate, swap fee visibility, route estimates, minimum received, and price-impact context for USDC/EURC market actions."
  },
  {
    phase: "06",
    title: "Agent identity (ERC-8004)",
    status: "Next",
    copy: "Register LumenFi agent metadata on Arc, expose its agent ID and owner, and read reputation and validation records. Portfolio and risk analysis remains read-only at this stage.",
    href: "https://docs.arc.io/arc/tutorials/register-your-first-ai-agent",
    linkLabel: "ERC-8004 quickstart"
  },
  {
    phase: "07",
    title: "Risk copilot and event monitoring",
    status: "Planned",
    copy: "Monitor pool and lending events, explain health factor and slippage changes, and draft swap, lending, or bridge actions without signing transactions.",
    href: "https://docs.arc.io/arc/tutorials/monitor-contract-events",
    linkLabel: "Event monitoring guide"
  },
  {
    phase: "08",
    title: "USDC agent jobs (ERC-8183)",
    status: "Planned",
    copy: "Create jobs, fund USDC escrow, submit deliverable hashes, require evaluator approval, and settle completed research or automation tasks through Arc's reference job flow.",
    href: "https://docs.arc.io/arc/tutorials/create-your-first-erc-8183-job",
    linkLabel: "ERC-8183 quickstart"
  },
  {
    phase: "09",
    title: "Guarded agent execution",
    status: "Research",
    copy: "Evaluate smart wallets and session keys with action allowlists, USDC limits, expiry, revocation, simulation, and explicit user confirmation. No custody or unrestricted execution.",
    href: "https://docs.arc.io/arc/tools/account-abstraction",
    linkLabel: "Account abstraction"
  }
];
