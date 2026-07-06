import { RefreshCcw } from "lucide-react";
import type { Address } from "viem";
import { arcPublicClient, ARC_TOKENS, BALANCE_TOKEN_SYMBOLS, erc20Abi, formatTokenAmount, getTokenAddress, type TokenSymbol } from "../lib/arc";

type BalancesProps = {
  address?: Address;
  balances: Partial<Record<TokenSymbol, bigint>>;
  setBalances: (balances: Partial<Record<TokenSymbol, bigint>>) => void;
  setStatus: (message: string) => void;
};

export function Balances({ address, balances, setBalances, setStatus }: BalancesProps) {
  async function refresh() {
    if (!address) {
      return;
    }

    setStatus("Refreshing Arc balances...");
    const entries = await Promise.all(
      BALANCE_TOKEN_SYMBOLS.map(async (symbol) => {
        const token = ARC_TOKENS[symbol];
        const value = token.address
          ? await arcPublicClient.readContract({
              address: getTokenAddress(symbol),
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address]
            })
          : 0n;
        return [token.symbol, value] as const;
      })
    );

    setBalances(Object.fromEntries(entries) as Partial<Record<TokenSymbol, bigint>>);
    setStatus("Balances updated.");
  }

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Arc Testnet</p>
          <h2>Wallet balances</h2>
        </div>
        <button className="iconButton" type="button" onClick={refresh} disabled={!address} title="Refresh balances">
          <RefreshCcw size={18} />
        </button>
      </div>
      <div className="balanceGrid">
        {BALANCE_TOKEN_SYMBOLS.map((symbol) => {
          const token = ARC_TOKENS[symbol];

          return (
            <div className="balanceTile" key={token.symbol}>
              <span className="tokenMark" style={{ background: token.accent }} />
              <div>
                <strong>{balances[token.symbol] === undefined ? "--" : formatTokenAmount(balances[token.symbol]!, token)}</strong>
                <span>{token.symbol}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
