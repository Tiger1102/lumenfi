import { ARC_TOKENS, type TokenSymbol } from "../lib/arc";

type TokenSelectProps = {
  value: TokenSymbol;
  onChange: (value: TokenSymbol) => void;
  tokens?: TokenSymbol[];
};

export function TokenSelect({ value, onChange, tokens = ["USDC", "EURC", "cirBTC"] }: TokenSelectProps) {
  const selected = ARC_TOKENS[value];

  return (
    <div className="tokenSelectCompact">
      <span className="tokenIcon" style={{ background: selected.accent }}>
        {value === "cirBTC" ? "B" : value.slice(0, 1)}
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value as TokenSymbol)} aria-label="Select token">
        {tokens.map((symbol) => (
          <option key={symbol} value={symbol}>
            {symbol}
          </option>
        ))}
      </select>
    </div>
  );
}
