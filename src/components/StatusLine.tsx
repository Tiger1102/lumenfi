import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";

type StatusLineProps = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  txHash?: string;
};

const ARC_EXPLORER_TX_URL = "https://testnet.arcscan.app/tx/";

export function StatusLine({ status, message, txHash }: StatusLineProps) {
  if (!message) {
    return null;
  }

  const icon =
    status === "loading" ? (
      <Loader2 className="spin" size={16} />
    ) : status === "success" ? (
      <CheckCircle2 size={16} />
    ) : status === "error" ? (
      <AlertCircle size={16} />
    ) : null;

  return (
    <div className={`status ${status}`}>
      {icon}
      <span>{message}</span>
      {txHash && (
        <a href={`${ARC_EXPLORER_TX_URL}${txHash}`} target="_blank" rel="noreferrer">
          View transaction
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}
