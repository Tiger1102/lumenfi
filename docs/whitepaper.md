# LumenFi Whitepaper

LumenFi Whitepaper v0.3
Arc Testnet Release
June 2026

Built by a solo developer exploring stablecoin-native DeFi workflows on Arc.

## Executive Summary

LumenFi is a stablecoin-native DeFi application built for Arc Testnet. It brings wallet balances, USDC/EURC swaps, lending actions, borrowing controls, and cross-chain onboarding hooks into one focused product surface.

The project is designed to demonstrate how Arc's USDC gas model can simplify user experience for stablecoin finance. Instead of sending users across separate explorers, bridges, swap tools, and lending dashboards, LumenFi consolidates the core workflow into a single web application.

LumenFi is a testnet release for technical review. It is not audited, not production-ready, and does not represent a live lending or investment product.

## Market Problem

Stablecoin workflows are still fragmented. A user often needs one interface to bridge assets, another to check balances, a third to swap tokens, and a separate lending market to manage collateral or debt.

This creates unnecessary operational overhead. Users must understand chain selection, token addresses, gas assets, approvals, route availability, and position health before they can complete basic financial actions.

LumenFi tests a cleaner approach: a stablecoin control desk where the most important actions are visible, inspectable, and connected.

## Why Arc

Arc is a stablecoin-native EVM network where USDC is used as gas. This makes it a strong environment for applications where user balances, transaction costs, collateral, and accounting are all denominated in familiar stablecoin units.

For LumenFi, Arc provides EVM compatibility, Solidity deployment support, wallet compatibility, an Arc Testnet RPC, and a product context aligned with payments, treasury, lending, and foreign exchange workflows.

## Product Surface

### Wallet Balances

Users connect an injected EVM wallet and view Arc Testnet balances for USDC and EURC. Balances are read directly from Arc Testnet using viem.

### Stablecoin Swaps

The testnet deployment supports USDC/EURC swaps through a deployed LumenFi stable swap pool. Circle App Kit swap routes remain part of the product direction, but public builds keep service credentials out of the browser bundle.

The current pool uses a 1:1 testnet stable-pair model with a 30 bps fee so the market workflow remains functional while external Arc Testnet routes mature.

### Lending and Borrowing

LumenFi deploys a basic lending pool where users can deposit USDC or EURC, borrow supported stable assets, repay debt, withdraw collateral, and monitor collateral value, debt value, available borrow, and health factor.

The lending pool is scoped for Arc Testnet review. A production version would require audited accounting, resilient price feeds, interest accrual, reserves, caps, emergency controls, and extensive risk testing.

### Cross-Chain Onboarding

The interface includes bridge and unified-balance controls that represent the intended Circle App Kit onboarding path. In the testnet deployment, these controls fail gracefully when a production-safe route or public configuration is not available.

## Architecture

LumenFi uses a lightweight architecture:

- User wallet connection through EIP-1193 and viem.
- React, Vite, and TypeScript frontend.
- Arc Testnet RPC reads and writes.
- Solidity contracts for lending and pool-based stable swaps.
- Circle App Kit integration points for future route, bridge, and unified-balance workflows.
- Cloudflare Pages deployment served through the LumenFi domain.

## Deployed Components

### LendingPool

Address: 0x474552ce815a68443bdfcafd089cdb345791d204

Purpose: collateral deposits, withdrawals, borrowing, repayment, and account health views.

### PermissionlessStablePool

Address: 0xfd34e43021f20f585db8f078471c7107d8d1da30

Purpose: USDC/EURC pool swaps for the testnet deployment. Fresh pool deployments require initial USDC/EURC liquidity before swaps can quote.

### Arc Testnet Assets

USDC: 0x3600000000000000000000000000000000000000

EURC: 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a

## Smart Contract Scope

### LendingPool

Core actions include deposit, withdraw, borrow, repay, liquidate, and getAccountData. The contract tracks collateral and debt by user and asset.

Current testnet parameters include a 70 percent loan-to-value target, an 85 percent liquidation threshold, and a 5 percent liquidation bonus. These values are testnet parameters and should not be interpreted as final production risk settings.

### PermissionlessStablePool

Core actions include addLiquidity, removeLiquidity, quote, and swap. The pool supports USDC/EURC only and keeps the market workflow usable while external routing is unavailable or not configured.

## User Flow

1. Open LumenFi.
2. Connect a wallet and switch to Arc Testnet.
3. Review USDC and EURC balances.
4. Swap between USDC and EURC through the LumenFi pool.
5. Deposit collateral into the lending pool.
6. Borrow or repay supported assets.
7. Monitor collateral, debt, available borrow, and health.

## Risk Considerations

LumenFi is a testnet application. Key risk areas include smart contract correctness, oracle design, liquidity depth, liquidation mechanics, route availability, approval UX, and production compliance requirements.

The current implementation reduces scope by using testnet assets, limited pool liquidity, no production yield claims, and clear testnet labeling.

## Production Requirements

Before any production deployment, LumenFi would require independent smart contract audits, stronger invariant testing, robust oracle infrastructure, dynamic interest rates, reserve accounting, collateral and borrow caps, liquidation infrastructure, monitoring, incident response, and a legal and compliance review.

## Roadmap

Phase 01 - Live professional MVP: released. LumenFi is live with a professional dark-mode dashboard, overview-first navigation, wallet balances, module-level transaction feedback, documentation, and Cloudflare-hosted production deployment.

Phase 02 - Permissionless LP pool: live. Users can add liquidity to the USDC/EURC pool, receive LP shares, swap through pool liquidity, and remove liquidity with accrued fees.

Phase 03 - Circle bridge routes: live testnet surface. The app includes bridge controls for Base Sepolia, Ethereum Sepolia, Arbitrum Sepolia, and Arc Testnet routing with visible source and destination networks.

Phase 04 - Lending market and risk controls: live. LumenFi includes USDC/EURC deposit, withdraw, borrow, repay, account health, liquidation buffer, max-withdraw guidance, and clearer borrower risk feedback in the app.

Phase 05 - Market depth and analytics: live. LumenFi now shows live pool depth, LP supply, reserve analytics, pool rate, swap fee visibility, route estimates, minimum received, and price-impact context for USDC/EURC market actions.

Phase 06 - AI Agent (Arc Blueprints): soon. LumenFi plans to develop an Arc Blueprints-powered assistant for real-time portfolio insights, risk summaries, guided swaps, lending checks, optimal bridge preparation, passive asset management, and read-only yield recommendations. The next phase would enable limited-permission execution with USDC gas and explicit user confirmation.

## Current Status

LumenFi is live on Arc Testnet at https://lumenfi.click.

The current release is suitable for product review, Arc ecosystem feedback, and stablecoin workflow exploration. It is not suitable for production capital.

## Disclaimer

LumenFi is software deployed on Arc Testnet. It is not audited, not production-ready, and not financial advice. Users should treat it as a technical review build only.


