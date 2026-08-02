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
    copy: "Added live pool depth, LP supply, reserve analytics, pool rate, swap fee visibility, route estimates, minimum received, and price-impact context for USDC/EURC market actions."
  },
  {
    phase: "06",
    title: "Onchain action agent",
    status: "Live",
    copy: "Reads live Arc balances, lending positions, pool reserves, prices, and block evidence; then prepares bounded repay, supply, swap, or bridge actions with prefilled values and mandatory wallet confirmation."
  },
  {
    phase: "07",
    title: "Permissioned automation",
    status: "Research",
    copy: "Extend today's user-approved action drafts with smart wallets and session keys using action allowlists, USDC limits, expiry, revocation, and simulation. No custody or unrestricted execution."
  }
];
