type RoadmapItem = {
  phase: string;
  title: string;
  status: "Live" | "Beta" | "Next" | "Planned" | "Research";
  copy: string;
};

export const roadmapItems: RoadmapItem[] = [
  {
    phase: "01",
    title: "Core market release",
    status: "Live",
    copy: "Wallet connection, Arc balances, market navigation, inline transaction receipts, public contracts, and release documentation."
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
    status: "Beta",
    copy: "Circle App Kit route estimates and bridge execution for supported testnet paths, with explicit unavailable and recovery states still being expanded."
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
    copy: "Added total pool liquidity, LP positions, reserve analytics, pool rate, swap fee visibility, live quotes, minimum received, and price impact for USDC/EURC market actions."
  },
  {
    phase: "06",
    title: "Onchain action agent",
    status: "Live",
    copy: "Reads live Arc balances, lending positions, pool reserves, prices, and block evidence; prepares bounded repay, supply, swap, or bridge actions; and withholds position-changing drafts when required evidence is incomplete."
  },
  {
    phase: "07",
    title: "Signed permission controls",
    status: "Live",
    copy: "Wallet-signed policies constrain Agent drafts with action allowlists, per-action and rolling daily USDC-equivalent limits, expiry, local revocation, block freshness, wallet-scoped activity, and current-price preflight before execution."
  },
  {
    phase: "08",
    title: "Model-assisted reasoning",
    status: "Next",
    copy: "Add a server-side model that converts natural-language goals into a strict action schema, while deterministic tools own contract reads, policy decisions, simulations, and calldata."
  },
  {
    phase: "09",
    title: "ERC-4337 smart-account relay",
    status: "Planned",
    copy: "Connect an audited smart-account, bundler, and paymaster stack so short-lived session permissions can submit policy-approved actions without exposing keys or granting unrestricted custody."
  },
  {
    phase: "10",
    title: "Independent risk engine",
    status: "Planned",
    copy: "Replace owner-managed prices and fixed rates with resilient oracle inputs, utilization-based rates, liquidation monitoring, stress tests, and machine-readable risk explanations."
  },
  {
    phase: "11",
    title: "Cross-chain strategy orchestration",
    status: "Research",
    copy: "Coordinate bridge, swap, and lending intents across supported networks with route attestations, recovery states, cost ceilings, and end-to-end settlement tracking."
  }
];
