import { createWalletClient, custom, getAddress, type Address, type WalletClient } from "viem";
import { arcTestnet, switchToArc, type EIP1193Provider } from "./arc";

export type ConnectedWallet = {
  address: Address;
  provider: EIP1193Provider;
  walletClient: WalletClient;
};

export async function connectInjectedWallet(): Promise<ConnectedWallet> {
  const provider = window.ethereum?.providers?.[0] ?? window.ethereum;

  if (!provider) {
    throw new Error("No injected wallet found. Install MetaMask or Rabby.");
  }

  await switchToArc(provider);
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = getAddress(accounts[0]);

  return {
    address,
    provider,
    walletClient: createWalletClient({
      account: address,
      chain: arcTestnet,
      transport: custom(provider)
    })
  };
}

export function shortAddress(address?: string) {
  if (!address) {
    return "";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
