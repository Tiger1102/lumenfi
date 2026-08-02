# LumenFi Deployments

## Arc Testnet — August 2, 2026

Deployer:

```text
0x5bc6225a3D4150d49BD6A199C9235d72eCaEb691
```

Contracts:

```text
LendingPool: 0x474552ce815a68443bdfcafd089cdb345791d204
PermissionlessStablePool: 0x212622812664e37abbb99774ee7488bc721b38b3
```

Deployment checks:

- Contract bytecode exists for LendingPool and PermissionlessStablePool.
- USDC and EURC token references resolve on Arc Testnet.
- LendingPool lists USDC and EURC with 6 decimals.
- PermissionlessStablePool uses a 30 bps swap fee.
- Swap writes enforce minimum received and a transaction deadline.
- Add and remove liquidity writes enforce minimum outputs.
- LP shares use 6 display decimals, matching the scale minted from the USDC/EURC pair.
- Initial reserves are `5 USDC` and `5 EURC`.

Arc Explorer:

```text
https://testnet.arcscan.app/address/0x474552ce815a68443bdfcafd089cdb345791d204
https://testnet.arcscan.app/address/0x212622812664e37abbb99774ee7488bc721b38b3
```
