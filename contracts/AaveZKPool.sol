//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "hardhat/console.sol";

import {ILendingPool} from "./aave/interfaces/ILendingPool.sol";
import {
    ILendingPoolAddressesProvider
} from "./aave/interfaces/ILendingPoolAddressesProvider.sol";
import {
    AaveProtocolDataProvider
} from "./aave/misc/AaveProtocolDataProvider.sol";

//import {IAToken} from "./aave/interfaces/IAToken.sol";
import {IERC20} from "./aave/dependencies/openzeppelin/contracts/IERC20.sol";

import {Errors} from "./aave/protocol/libraries/helpers/Errors.sol";

import {
    SafeMath
} from "./aave/dependencies/openzeppelin/contracts/SafeMath.sol";
import {WadRayMath} from "./aave/protocol/libraries/math/WadRayMath.sol";
import {
    SafeERC20
} from "./aave/dependencies/openzeppelin/contracts/SafeERC20.sol";

// Snark Proofs

import {ZKPool} from "./ZKPool.sol";

// In this extension, we have to take care of the actual tokens

contract AaveZKPool is ZKPool {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using WadRayMath for uint256;

    ILendingPool immutable lendingPool;
    address public immutable underlyingAsset;
    address public immutable aToken;

    constructor(
        uint8 _treeLevels,
        address _asset,
        address _lendingpool,
        address _aToken,
        uint256 _depositSize
    ) public ZKPool(_treeLevels, _depositSize) {
        underlyingAsset = _asset;
        lendingPool = ILendingPool(_lendingpool);
        aToken = _aToken;
    }

    function _processDeposit() internal override {
        uint256 aTokenAmount = _toAtokens(depositSize);
        IERC20(aToken).safeTransferFrom(
            msg.sender,
            address(this),
            aTokenAmount
        );
    }

    function _processWithdraw(address _to, uint256 _withdrawAmount) internal override {
        uint256 _withdrawScaled = _toAtokens(_withdrawAmount);
        IERC20(aToken).safeTransfer(_to, _withdrawScaled);
    }

    // Views
    /**
     * @notice Computes the current aToken balance for `_scaledATokens` scaled aTokens
     * @param _scaledATokens The amount of scaled aTokens
     * @return The current aToken balance
     */
    function _toAtokens(uint256 _scaledATokens)
        internal
        view
        returns (uint256)
    {
        return
            _scaledATokens.rayMul(
                lendingPool.getReserveNormalizedIncome(underlyingAsset)
            );
    }

    /**
     * @notice Computes the number of scaled aTokens that one have with a given aTokens amount.
     * @param _aTokens The aMount of aTokens
     * @return The current number of scaled aTokens
     */
    function _toScaledTokens(uint256 _aTokens) internal view returns (uint256) {
        return
            _aTokens.rayDiv(
                lendingPool.getReserveNormalizedIncome(underlyingAsset)
            );
    }

}
