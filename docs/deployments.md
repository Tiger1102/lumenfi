# LumenFi Deployments

## Arc Testnet - June 30, 2026

Deployer:

```text
0x5bc6225a3D4150d49BD6A199C9235d72eCaEb691
```

Contracts:

```text
LendingPool: 0x474552ce815a68443bdfcafd089cdb345791d204
PermissionlessStablePool: 0xfd34e43021f20f585db8f078471c7107d8d1da30
```

Deployment checks:

- Contract bytecode exists for LendingPool and PermissionlessStablePool.
- USDC and EURC token references resolve on Arc Testnet.
- LendingPool lists USDC and EURC with 6 decimals.
- PermissionlessStablePool uses a 30 bps swap fee.
- The deploy script skipped automatic seeding because the deployer did not hold both tokens at deploy time.
- Liquidity was added after deployment.
- Latest local check observed `300 USDC` and `217.654226 EURC` in pool reserves.
- Latest local check observed a working 1 USDC quote: `0.720941 EURC`.

Arc Explorer:

```text
https://testnet.arcscan.app/address/0x474552ce815a68443bdfcafd089cdb345791d204
https://testnet.arcscan.app/address/0xfd34e43021f20f585db8f078471c7107d8d1da30
```
