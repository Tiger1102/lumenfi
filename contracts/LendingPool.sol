// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IERC20.sol";

contract LendingPool {
    uint256 public constant BPS = 10_000;
    uint256 public constant LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    address public owner;
    address[] public assets;

    mapping(address => bool) public isAsset;
    mapping(address => uint8) public assetDecimals;
    mapping(address => uint256) public priceUsd; // 1e6 USD price.
    mapping(address => uint256) public totalSupplied;
    mapping(address => uint256) public totalBorrowed;
    mapping(address => mapping(address => uint256)) public collateralOf;
    mapping(address => mapping(address => uint256)) public debtOf;

    event AssetListed(address indexed asset, uint8 decimals, uint256 priceUsd);
    event PriceUpdated(address indexed asset, uint256 priceUsd);
    event Deposited(address indexed user, address indexed asset, uint256 amount);
    event Withdrawn(address indexed user, address indexed asset, uint256 amount);
    event Borrowed(address indexed user, address indexed asset, uint256 amount);
    event Repaid(address indexed user, address indexed asset, uint256 amount);
    event Liquidated(
        address indexed liquidator,
        address indexed user,
        address indexed debtAsset,
        address collateralAsset,
        uint256 repayAmount,
        uint256 seizedAmount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(address[] memory initialAssets, uint8[] memory decimals_, uint256[] memory pricesUsd_) {
        require(initialAssets.length == decimals_.length && initialAssets.length == pricesUsd_.length, "BAD_LENGTH");
        owner = msg.sender;

        for (uint256 i = 0; i < initialAssets.length; i++) {
            _listAsset(initialAssets[i], decimals_[i], pricesUsd_[i]);
        }
    }

    function listAsset(address asset, uint8 decimals_, uint256 priceUsd_) external onlyOwner {
        _listAsset(asset, decimals_, priceUsd_);
    }

    function setPrice(address asset, uint256 priceUsd_) external onlyOwner {
        require(isAsset[asset], "UNLISTED_ASSET");
        require(priceUsd_ > 0, "BAD_PRICE");
        priceUsd[asset] = priceUsd_;
        emit PriceUpdated(asset, priceUsd_);
    }

    function deposit(address asset, uint256 amount) external {
        require(isAsset[asset], "UNLISTED_ASSET");
        require(amount > 0, "ZERO_AMOUNT");

        collateralOf[msg.sender][asset] += amount;
        totalSupplied[asset] += amount;

        require(IERC20(asset).transferFrom(msg.sender, address(this), amount), "TRANSFER_FROM_FAILED");
        emit Deposited(msg.sender, asset, amount);
    }

    function withdraw(address asset, uint256 amount) external {
        require(isAsset[asset], "UNLISTED_ASSET");
        require(amount > 0, "ZERO_AMOUNT");
        require(collateralOf[msg.sender][asset] >= amount, "INSUFFICIENT_COLLATERAL");

        collateralOf[msg.sender][asset] -= amount;
        totalSupplied[asset] -= amount;

        require(_isHealthy(msg.sender), "WOULD_BE_UNHEALTHY");

        require(IERC20(asset).transfer(msg.sender, amount), "TRANSFER_FAILED");
        emit Withdrawn(msg.sender, asset, amount);
    }

    function borrow(address asset, uint256 amount) external {
        require(isAsset[asset], "UNLISTED_ASSET");
        require(amount > 0, "ZERO_AMOUNT");
        require(IERC20(asset).balanceOf(address(this)) >= amount, "POOL_LIQUIDITY_LOW");

        uint256 debtValueAfter = _totalDebtValue(msg.sender) + _assetValue(asset, amount);
        uint256 maxBorrowValue = (_totalCollateralValue(msg.sender) * LTV_BPS) / BPS;
        require(debtValueAfter <= maxBorrowValue, "LTV_EXCEEDED");

        debtOf[msg.sender][asset] += amount;
        totalBorrowed[asset] += amount;

        require(IERC20(asset).transfer(msg.sender, amount), "TRANSFER_FAILED");
        emit Borrowed(msg.sender, asset, amount);
    }

    function repay(address asset, uint256 amount) external {
        require(isAsset[asset], "UNLISTED_ASSET");
        require(amount > 0, "ZERO_AMOUNT");

        uint256 debt = debtOf[msg.sender][asset];
        uint256 repayAmount = amount > debt ? debt : amount;
        require(repayAmount > 0, "NO_DEBT");

        debtOf[msg.sender][asset] -= repayAmount;
        totalBorrowed[asset] -= repayAmount;

        require(IERC20(asset).transferFrom(msg.sender, address(this), repayAmount), "TRANSFER_FROM_FAILED");
        emit Repaid(msg.sender, asset, repayAmount);
    }

    function liquidate(address user, address debtAsset, address collateralAsset, uint256 repayAmount) external {
        require(isAsset[debtAsset] && isAsset[collateralAsset], "UNLISTED_ASSET");
        require(!_isHealthy(user), "ACCOUNT_HEALTHY");

        uint256 userDebt = debtOf[user][debtAsset];
        uint256 actualRepay = repayAmount > userDebt ? userDebt : repayAmount;
        require(actualRepay > 0, "NO_DEBT");

        uint256 repayValue = _assetValue(debtAsset, actualRepay);
        uint256 seizeValue = repayValue + ((repayValue * LIQUIDATION_BONUS_BPS) / BPS);
        uint256 seizeAmount = _amountFromValue(collateralAsset, seizeValue);
        uint256 userCollateral = collateralOf[user][collateralAsset];

        if (seizeAmount > userCollateral) {
            seizeAmount = userCollateral;
        }

        debtOf[user][debtAsset] -= actualRepay;
        totalBorrowed[debtAsset] -= actualRepay;
        collateralOf[user][collateralAsset] -= seizeAmount;
        totalSupplied[collateralAsset] -= seizeAmount;

        require(IERC20(debtAsset).transferFrom(msg.sender, address(this), actualRepay), "TRANSFER_FROM_FAILED");
        require(IERC20(collateralAsset).transfer(msg.sender, seizeAmount), "TRANSFER_FAILED");

        emit Liquidated(msg.sender, user, debtAsset, collateralAsset, actualRepay, seizeAmount);
    }

    function getAccountData(address user)
        public
        view
        returns (uint256 collateralValue, uint256 debtValue, uint256 availableBorrows, uint256 healthFactorBps)
    {
        collateralValue = _totalCollateralValue(user);
        debtValue = _totalDebtValue(user);
        uint256 maxBorrowValue = (collateralValue * LTV_BPS) / BPS;
        availableBorrows = maxBorrowValue > debtValue ? maxBorrowValue - debtValue : 0;
        healthFactorBps = debtValue == 0 ? type(uint256).max : ((collateralValue * LIQUIDATION_THRESHOLD_BPS) / debtValue);
    }

    function _listAsset(address asset, uint8 decimals_, uint256 priceUsd_) private {
        require(asset != address(0), "ZERO_ASSET");
        require(!isAsset[asset], "ASSET_EXISTS");
        require(priceUsd_ > 0, "BAD_PRICE");

        isAsset[asset] = true;
        assetDecimals[asset] = decimals_;
        priceUsd[asset] = priceUsd_;
        assets.push(asset);

        emit AssetListed(asset, decimals_, priceUsd_);
    }

    function _isHealthy(address user) private view returns (bool) {
        (, uint256 debtValue,, uint256 healthFactorBps) = getAccountData(user);
        return debtValue == 0 || healthFactorBps >= BPS;
    }

    function _totalCollateralValue(address user) private view returns (uint256 value) {
        for (uint256 i = 0; i < assets.length; i++) {
            address asset = assets[i];
            value += _assetValue(asset, collateralOf[user][asset]);
        }
    }

    function _totalDebtValue(address user) private view returns (uint256 value) {
        for (uint256 i = 0; i < assets.length; i++) {
            address asset = assets[i];
            value += _assetValue(asset, debtOf[user][asset]);
        }
    }

    function _assetValue(address asset, uint256 amount) private view returns (uint256) {
        return (amount * priceUsd[asset]) / (10 ** assetDecimals[asset]);
    }

    function _amountFromValue(address asset, uint256 value) private view returns (uint256) {
        return (value * (10 ** assetDecimals[asset])) / priceUsd[asset];
    }
}
