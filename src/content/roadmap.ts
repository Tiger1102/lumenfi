type RoadmapItem = {
  phase: string;
  title: string;
  status: "Live" | "Beta" | "Next" | "Planned" | "Research";
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
    title: "AI Agent (Arc Blueprints)",
    status: "Beta",
    copy: "Live read-only assistant for real-time portfolio insights, lending risk summaries, guided swaps, bridge preparation, passive asset reviews, and yield recommendations grounded in Arc contract state.",
    href: "https://docs.arc.io/build/agentic-economy",
    linkLabel: "Arc agentic economy"
  },
  {
    phase: "07",
    title: "Agent identity (ERC-8004)",
    status: "Next",
    copy: "Register LumenFi agent metadata on Arc, expose its agent ID and owner, and read reputation and validation records while keeping all financial guidance read-only.",
    href: "https://docs.arc.io/arc/tutorials/register-your-first-ai-agent",
    linkLabel: "ERC-8004 quickstart"
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
