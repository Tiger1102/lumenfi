import { ARC_TOKENS, type TokenSymbol } from "../lib/arc";

type TokenSelectProps = {
  value: TokenSymbol;
  onChange: (value: TokenSymbol) => void;
  tokens?: TokenSymbol[];
};

export function TokenSelect({ value, onChange, tokens = ["USDC", "EURC", "cirBTC"] }: TokenSelectProps) {
  return (
    <div className="segmented">
      {tokens.map((symbol) => (
        <button
          key={symbol}
          type="button"
          className={symbol === value ? "active" : ""}
          onClick={() => onChange(symbol)}
          aria-pressed={symbol === value}
        >
          <span className="tokenIcon" style={{ background: ARC_TOKENS[symbol].accent }}>
            {symbol === "cirBTC" ? "B" : symbol.slice(0, 1)}
          </span>
          {symbol}
        </button>
      ))}
    </div>
  );
}
