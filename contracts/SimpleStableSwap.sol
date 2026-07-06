// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IERC20.sol";

contract SimpleStableSwap {
    uint256 public constant BPS = 10_000;
    uint256 public constant FEE_BPS = 30;

    address public immutable usdc;
    address public immutable eurc;
    address public owner;

    event LiquidityAdded(address indexed provider, uint256 usdcAmount, uint256 eurcAmount);
    event LiquidityRemoved(address indexed receiver, uint256 usdcAmount, uint256 eurcAmount);
    event Swapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(address usdc_, address eurc_) {
        require(usdc_ != address(0) && eurc_ != address(0), "ZERO_TOKEN");
        usdc = usdc_;
        eurc = eurc_;
        owner = msg.sender;
    }

    function addLiquidity(uint256 usdcAmount, uint256 eurcAmount) external onlyOwner {
        if (usdcAmount > 0) {
            require(IERC20(usdc).transferFrom(msg.sender, address(this), usdcAmount), "USDC_TRANSFER_FAILED");
        }

        if (eurcAmount > 0) {
            require(IERC20(eurc).transferFrom(msg.sender, address(this), eurcAmount), "EURC_TRANSFER_FAILED");
        }

        emit LiquidityAdded(msg.sender, usdcAmount, eurcAmount);
    }

    function removeLiquidity(uint256 usdcAmount, uint256 eurcAmount, address receiver) external onlyOwner {
        require(receiver != address(0), "ZERO_RECEIVER");

        if (usdcAmount > 0) {
            require(IERC20(usdc).transfer(receiver, usdcAmount), "USDC_TRANSFER_FAILED");
        }

        if (eurcAmount > 0) {
            require(IERC20(eurc).transfer(receiver, eurcAmount), "EURC_TRANSFER_FAILED");
        }

        emit LiquidityRemoved(receiver, usdcAmount, eurcAmount);
    }

    function quote(address tokenIn, uint256 amountIn) public view returns (address tokenOut, uint256 amountOut) {
        require(amountIn > 0, "ZERO_AMOUNT");

        if (tokenIn == usdc) {
            tokenOut = eurc;
        } else if (tokenIn == eurc) {
            tokenOut = usdc;
        } else {
            revert("UNSUPPORTED_TOKEN");
        }

        amountOut = amountIn - ((amountIn * FEE_BPS) / BPS);
        require(IERC20(tokenOut).balanceOf(address(this)) >= amountOut, "POOL_LIQUIDITY_LOW");
    }

    function swap(address tokenIn, uint256 amountIn) external returns (address tokenOut, uint256 amountOut) {
        (tokenOut, amountOut) = quote(tokenIn, amountIn);

        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "TRANSFER_FROM_FAILED");
        require(IERC20(tokenOut).transfer(msg.sender, amountOut), "TRANSFER_FAILED");

        emit Swapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }
}
