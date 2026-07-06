// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IERC20.sol";

contract PermissionlessStablePool {
    uint256 public constant BPS = 10_000;
    uint256 public constant FEE_BPS = 30;
    uint8 public constant decimals = 18;

    string public constant name = "LumenFi USDC/EURC LP";
    string public constant symbol = "LUMEN-LP";

    address public immutable usdc;
    address public immutable eurc;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event LiquidityAdded(address indexed provider, uint256 usdcAmount, uint256 eurcAmount, uint256 shares);
    event LiquidityRemoved(address indexed provider, address indexed receiver, uint256 usdcAmount, uint256 eurcAmount, uint256 shares);
    event Swapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    constructor(address usdc_, address eurc_) {
        require(usdc_ != address(0) && eurc_ != address(0), "ZERO_TOKEN");
        usdc = usdc_;
        eurc = eurc_;
    }

    function reserves() public view returns (uint256 usdcReserve, uint256 eurcReserve) {
        usdcReserve = IERC20(usdc).balanceOf(address(this));
        eurcReserve = IERC20(eurc).balanceOf(address(this));
    }

    function addLiquidity(uint256 usdcAmount, uint256 eurcAmount, uint256 minShares) external returns (uint256 shares) {
        require(usdcAmount > 0 && eurcAmount > 0, "ZERO_AMOUNT");
        (uint256 usdcReserve, uint256 eurcReserve) = reserves();

        if (totalSupply == 0) {
            shares = sqrt(usdcAmount * eurcAmount);
        } else {
            uint256 usdcShares = (usdcAmount * totalSupply) / usdcReserve;
            uint256 eurcShares = (eurcAmount * totalSupply) / eurcReserve;
            shares = min(usdcShares, eurcShares);
        }

        require(shares >= minShares && shares > 0, "INSUFFICIENT_SHARES");
        _mint(msg.sender, shares);

        require(IERC20(usdc).transferFrom(msg.sender, address(this), usdcAmount), "USDC_TRANSFER_FAILED");
        require(IERC20(eurc).transferFrom(msg.sender, address(this), eurcAmount), "EURC_TRANSFER_FAILED");

        emit LiquidityAdded(msg.sender, usdcAmount, eurcAmount, shares);
    }

    function removeLiquidity(uint256 shares, uint256 minUsdc, uint256 minEurc, address receiver) external returns (uint256 usdcAmount, uint256 eurcAmount) {
        require(receiver != address(0), "ZERO_RECEIVER");
        require(shares > 0, "ZERO_SHARES");
        require(balanceOf[msg.sender] >= shares, "INSUFFICIENT_LP");

        (uint256 usdcReserve, uint256 eurcReserve) = reserves();
        usdcAmount = (shares * usdcReserve) / totalSupply;
        eurcAmount = (shares * eurcReserve) / totalSupply;

        require(usdcAmount >= minUsdc && eurcAmount >= minEurc, "SLIPPAGE");
        _burn(msg.sender, shares);

        require(IERC20(usdc).transfer(receiver, usdcAmount), "USDC_TRANSFER_FAILED");
        require(IERC20(eurc).transfer(receiver, eurcAmount), "EURC_TRANSFER_FAILED");

        emit LiquidityRemoved(msg.sender, receiver, usdcAmount, eurcAmount, shares);
    }

    function quote(address tokenIn, uint256 amountIn) public view returns (address tokenOut, uint256 amountOut) {
        require(amountIn > 0, "ZERO_AMOUNT");
        (uint256 usdcReserve, uint256 eurcReserve) = reserves();

        uint256 reserveIn;
        uint256 reserveOut;
        if (tokenIn == usdc) {
            tokenOut = eurc;
            reserveIn = usdcReserve;
            reserveOut = eurcReserve;
        } else if (tokenIn == eurc) {
            tokenOut = usdc;
            reserveIn = eurcReserve;
            reserveOut = usdcReserve;
        } else {
            revert("UNSUPPORTED_TOKEN");
        }

        require(reserveIn > 0 && reserveOut > 0, "POOL_LIQUIDITY_LOW");
        uint256 amountInWithFee = amountIn * (BPS - FEE_BPS);
        amountOut = (amountInWithFee * reserveOut) / ((reserveIn * BPS) + amountInWithFee);
        require(amountOut > 0 && reserveOut >= amountOut, "POOL_LIQUIDITY_LOW");
    }

    function swap(address tokenIn, uint256 amountIn) external returns (address tokenOut, uint256 amountOut) {
        (tokenOut, amountOut) = quote(tokenIn, amountIn);

        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "TRANSFER_FROM_FAILED");
        require(IERC20(tokenOut).transfer(msg.sender, amountOut), "TRANSFER_FAILED");

        emit Swapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = (y / 2) + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
