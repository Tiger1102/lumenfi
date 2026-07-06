import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseUnits } from "viem";

describe("LumenFi contracts", async function () {
  const { viem } = await network.create();
  const [deployer, alice, bob] = await viem.getWalletClients();

  async function deployTokens() {
    const usdc = await viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
    const eurc = await viem.deployContract("MockERC20", ["Euro Coin", "EURC", 6]);

    for (const wallet of [deployer, alice, bob]) {
      await usdc.write.mint([wallet.account.address, parseUnits("1000", 6)]);
      await eurc.write.mint([wallet.account.address, parseUnits("1000", 6)]);
    }

    return { usdc, eurc };
  }

  it("supports permissionless USDC/EURC liquidity, swaps, and withdrawals", async function () {
    const { usdc, eurc } = await deployTokens();
    const pool = await viem.deployContract("PermissionlessStablePool", [usdc.address, eurc.address]);

    await usdc.write.approve([pool.address, parseUnits("300", 6)]);
    await eurc.write.approve([pool.address, parseUnits("300", 6)]);
    await pool.write.addLiquidity([parseUnits("300", 6), parseUnits("300", 6), 1n]);

    assert.equal(await pool.read.totalSupply(), parseUnits("300", 6));
    assert.equal(await usdc.read.balanceOf([pool.address]), parseUnits("300", 6));
    assert.equal(await eurc.read.balanceOf([pool.address]), parseUnits("300", 6));

    const [, amountOut] = await pool.read.quote([usdc.address, parseUnits("10", 6)]);
    assert.ok(amountOut > 0n);

    await usdc.write.approve([pool.address, parseUnits("10", 6)], { account: alice.account });
    const aliceEurcBefore = await eurc.read.balanceOf([alice.account.address]);
    await pool.write.swap([usdc.address, parseUnits("10", 6)], { account: alice.account });
    const aliceEurcAfter = await eurc.read.balanceOf([alice.account.address]);

    assert.ok(aliceEurcAfter > aliceEurcBefore);

    const shares = await pool.read.balanceOf([deployer.account.address]);
    await pool.write.removeLiquidity([shares / 2n, 1n, 1n, deployer.account.address]);

    assert.equal(await pool.read.balanceOf([deployer.account.address]), shares / 2n);
  });

  it("enforces lending LTV, repayment, and healthy withdrawals", async function () {
    const { usdc, eurc } = await deployTokens();
    const lending = await viem.deployContract("LendingPool", [
      [usdc.address, eurc.address],
      [6, 6],
      [1_000_000n, 1_080_000n]
    ]);

    await usdc.write.approve([lending.address, parseUnits("500", 6)]);
    await usdc.write.approve([lending.address, parseUnits("200", 6)], { account: alice.account });
    await eurc.write.approve([lending.address, parseUnits("500", 6)], { account: alice.account });

    await lending.write.deposit([usdc.address, parseUnits("500", 6)]);
    await lending.write.deposit([usdc.address, parseUnits("200", 6)], { account: alice.account });
    await lending.write.borrow([usdc.address, parseUnits("100", 6)], { account: alice.account });

    const [, debtValue, availableBorrows, healthFactorBps] = await lending.read.getAccountData([alice.account.address]);
    assert.equal(debtValue, parseUnits("100", 6));
    assert.ok(availableBorrows > 0n);
    assert.ok(healthFactorBps > 10_000n);

    await assert.rejects(
      lending.write.borrow([usdc.address, parseUnits("100", 6)], { account: alice.account }),
      /LTV_EXCEEDED/
    );

    await usdc.write.approve([lending.address, parseUnits("40", 6)], { account: alice.account });
    await lending.write.repay([usdc.address, parseUnits("40", 6)], { account: alice.account });
    assert.equal(await lending.read.debtOf([alice.account.address, usdc.address]), parseUnits("60", 6));

    await lending.write.withdraw([usdc.address, parseUnits("50", 6)], { account: alice.account });
    assert.equal(await lending.read.collateralOf([alice.account.address, usdc.address]), parseUnits("150", 6));
  });
});
