//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "hardhat/console.sol";

//import {IAToken} from "./aave/interfaces/IAToken.sol";
import {IERC20} from "./aave/dependencies/openzeppelin/contracts/IERC20.sol";

import {
    SafeERC20
} from "./aave/dependencies/openzeppelin/contracts/SafeERC20.sol";

// Snark Proofs

import {ZKPool} from "./ZKPool.sol";

// Hush Hush ERC20 pool
contract ERCZKPool is ZKPool {
    using SafeERC20 for IERC20;

    address public immutable token;

    constructor(
        uint8 _treeLevels,
        address _token,
        uint256 _depositSize
    ) public ZKPool(_treeLevels, _depositSize) {
        token = _token;
    }

    function _processDeposit() internal override{
        IERC20(token).safeTransferFrom(
            msg.sender,
            address(this),
            depositSize
        );
    }

    function _processWithdraw(address _to, uint256 _withdrawAmount, uint256 _fee) internal override {
        IERC20(token).safeTransfer(_to, _withdrawAmount);
        if (_fee > 0){
            IERC20(token).safeTransfer(msg.sender, _fee);
        }
    }

}
