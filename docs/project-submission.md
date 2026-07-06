# LumenFi Arc Project Submission

## Project Name

LumenFi

## Project Overview

LumenFi is a stablecoin-native DeFi dashboard on Arc Testnet for USDC/EURC balances, swaps, lending, borrowing, and cross-chain onboarding workflows.

## Product Summary

LumenFi is built for Arc's stablecoin-native environment. The application gives users one clean web interface to connect a wallet, view Arc balances, swap USDC/EURC through a deployed stable swap pool, interact with a testnet lending market, and review cross-chain onboarding controls.

The product demonstrates how stablecoin applications can become more intuitive when gas, balances, collateral, and protocol accounting are all aligned around familiar stablecoin units.

## Live App

https://lumenfi.click

Latest deployment preview: https://c6bc6deb.lumenfi.pages.dev

## Contract Addresses

LendingPool: 0x474552ce815a68443bdfcafd089cdb345791d204

PermissionlessStablePool: 0xfd34e43021f20f585db8f078471c7107d8d1da30

## Tech Stack

React, Vite, TypeScript, viem, Solidity, Hardhat, Circle App Kit, Cloudflare Pages, Cloudflare Worker, and Arc Testnet.

## Arc and Circle Features

LumenFi uses Arc Testnet, Arc RPC, USDC gas model, ERC-20 USDC, EURC, deployed Solidity contracts, Circle App Kit integration points, and bridge/unified-balance workflow surfaces.

## Why Arc

Arc is a strong fit for LumenFi because the product is centered on stablecoin-native user journeys: balances, gas context, swaps, credit, and onboarding all make more sense when the chain is optimized for programmable money. LumenFi uses Arc Testnet to demonstrate how a user can move from wallet connection to market actions without leaving a stablecoin-first workspace.

The app also creates a foundation for future Arc-native financial agents: read account state, summarize risk, prepare swaps or lending checks, and eventually request explicit user-confirmed execution.

## Current Status

The testnet deployment is live. Wallet connect, Arc balance reads, USDC/EURC pool swaps, lending pool actions, documentation, and deployed contract references are available.

Latest contract check confirms deployed bytecode for both contracts, listed USDC/EURC lending assets, active USDC/EURC pool reserves, and a working 1 USDC swap quote.

Circle App Kit routes are represented in the product surface, but public builds keep service credentials out of the browser bundle. When routes are unavailable, the app fails gracefully and keeps the USDC/EURC pool workflow usable.

## Feedback Requested

LumenFi is seeking feedback on stablecoin-native product direction, Arc-specific UX patterns, lending and swap workflow clarity, bridge onboarding, risk controls, and what would be required before a production-grade release.

## Roadmap

Live: professional MVP, permissionless USDC/EURC LP pool, lending market risk controls, market depth analytics, module-level transaction feedback, and testnet bridge workflow surface.

Soon: additional risk hardening, deeper historical LP fee insights, and an Arc Blueprints-powered AI Agent for portfolio insights, risk summaries, guided swaps, lending checks, optimal bridge preparation, passive asset management, and read-only yield recommendations.

## Demo Script

1. Open the web app.
2. Connect MetaMask or another injected wallet on Arc Testnet.
3. Review USDC and EURC wallet balances.
4. Swap USDC to EURC through the LumenFi stable swap pool.
5. Deposit USDC or EURC into the lending pool.
6. Review collateral, debt, available borrow, and health.
7. Open the whitepaper or submission pack from the docs controls.

## Validation

- `npm run build` passes.
- `npm run compile` passes.
- `npm test` passes with contract tests for pool and lending flows.
- `node scripts/check-contracts.mjs` confirms deployed bytecode, token metadata, pool reserves, a working swap quote, and listed lending assets.

## Disclaimer

LumenFi is an Arc Testnet review build. It is not a production lending product and should not be treated as financial advice.




