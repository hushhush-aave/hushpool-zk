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

import {IAToken} from "./aave/interfaces/IAToken.sol";
import {IWETH} from "./aave/misc/interfaces/IWETH.sol";
import {IERC20} from "./aave/dependencies/openzeppelin/contracts/IERC20.sol";

import {Errors} from './aave/protocol/libraries/helpers/Errors.sol';

import {
    SafeMath
} from "./aave/dependencies/openzeppelin/contracts/SafeMath.sol";
import {
    SafeERC20
} from "./aave/dependencies/openzeppelin/contracts/SafeERC20.sol";
import {WadRayMath} from "./aave/protocol/libraries/math/WadRayMath.sol";

// Only support eth?
interface IHushDarkPool {
    function deposit(uint256 _depositAmount) external;
    function withdraw(address _to, uint256 _withdrawAmount) external;
}

contract HushDarkPool is IHushDarkPool {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using WadRayMath for uint256;

    mapping(address => uint256) scaledBalance;
    address immutable underlyingAsset;
    address immutable aToken;

    ILendingPool immutable lendingPool;

    constructor(address _asset, address _lendingpool, address _aToken) public {
        underlyingAsset = _asset;
        lendingPool = ILendingPool(_lendingpool);
        aToken = _aToken;
    }

    /**
     * @notice Deposit into the pool, by performing a `safeTransferFrom`. Will require the msg.sender to have approved this contract.
     * Be aware that the aTokens amount transferred is computed from the scaled `_depositAmount` meaning that it grows over time. 
     * We need to approve more than our current balance to catch this
     * @param _depositAmount The amount of scaled Atokens to deposit
     */
    function deposit(uint256 _depositAmount) public override {
        uint256 aTokenAmount = _toAtokens(_depositAmount);
        IERC20(aToken).safeTransferFrom(msg.sender, address(this), aTokenAmount);
        scaledBalance[msg.sender] = scaledBalance[msg.sender].add(_depositAmount);
    }

    /**
     * @notice Withdraw funds `_withdrawAmount` scaled aTokens and transfer the amount of aTokens to `_to`
     * @param _to The address that should receive the underlying underlyingAsset
     * @param _withdrawAmount The amount of scaled aTokens to withdraw.
     */
    function withdraw(address _to, uint256 _withdrawAmount) public override {
        scaledBalance[msg.sender] = scaledBalance[msg.sender].sub(
            _withdrawAmount
        );
        uint256 _withdrawScaled = _toAtokens(_withdrawAmount);
        IERC20(aToken).safeTransfer(_to, _withdrawScaled);
    }

    // Views

    /**
     * @notice Computes the current aToken balance for `_scaledATokens` scaled aTokens
     * @param _scaledATokens The amount of scaled aTokens
     * @return The current aToken balance 
     */
    function _toAtokens(uint256 _scaledATokens) internal view returns (uint256) {
        return _scaledATokens.rayMul(lendingPool.getReserveNormalizedIncome(underlyingAsset));
    }

    /**
     * @notice Computes the number of scaled aTokens that one have with a given aTokens amount.
     * @param _aTokens The aMount of aTokens
     * @return The current number of scaled aTokens
     */
    function _toScaledTokens(uint256 _aTokens) internal view returns (uint256) {
        return _aTokens.rayDiv(lendingPool.getReserveNormalizedIncome(underlyingAsset));
    }

    /**
     * @notice Will return the internal pool balance of `_user` in scaled aTokens
     * @param _user The user to query
     * @return The amount of scaled aTokens the user have in the pool
     */
    function scaledBalanceOf(address _user) public view returns (uint256) {
        return scaledBalance[_user];
    }

    /**
     * @notice Will return the internal pool balance of `_user` in aTokens, e.g., the amount of aTokens that one can expect to withdrawr
     * @param _user The user to query
     * @return The amount of aTokens the user have in the pool
     */
    function balanceOf(address _user) public view returns (uint256) {
        return _toAtokens(scaledBalance[_user]);
    }
    
}
