// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import {ERC20} from "./aave/dependencies/openzeppelin/contracts/ERC20.sol";

contract TestERC20 is ERC20 {

    address public owner;

    constructor(string memory name, string memory symbol) public ERC20(name, symbol) {
        owner = msg.sender;
    }

    function mint(address account, uint256 amount) public {
        require(_msgSender() == owner, "Not owner");
        _mint(account, amount);
    }

}


