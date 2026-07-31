import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";

type PanelNoticeProps = {
  status?: "loading" | "success" | "error";
  message?: string;
  txHash?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const ARC_EXPLORER_TX_URL = "https://testnet.arcscan.app/tx/";

export function PanelNotice({ status, message, txHash, actionLabel, onAction }: PanelNoticeProps) {
  if (!message || !status) {
    return null;
  }

  const icon =
    status === "loading" ? (
      <Loader2 className="spin" size={15} />
    ) : status === "success" ? (
      <CheckCircle2 size={15} />
    ) : (
      <AlertCircle size={15} />
    );

  return (
    <div className={`panelNotice ${status}`}>
      {icon}
      <span>{message}</span>
      {txHash && (
        <a href={`${ARC_EXPLORER_TX_URL}${txHash}`} target="_blank" rel="noreferrer">
          View tx {txHash.slice(0, 8)}...{txHash.slice(-6)}
          <ExternalLink size={13} />
        </a>
      )}
      {actionLabel && onAction && (
        <button className="panelNoticeAction" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
