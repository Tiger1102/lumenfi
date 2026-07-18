/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CIRCLE_APP_KIT_KEY?: string;
  readonly VITE_LENDING_POOL_ADDRESS?: string;
  readonly VITE_SWAP_POOL_ADDRESS?: string;
  readonly VITE_CIRBTC_ADDRESS?: string;
  readonly VITE_ARC_FALLBACK_RPCS?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}
