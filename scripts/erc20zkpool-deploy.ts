// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
//const { ethers } = require("hardhat");

import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";


import chalk from 'chalk';


import { abi, bytecode } from "./../utils/mimc-util";

let getWei = (eth: string) => {
    return ethers.utils.parseEther(eth);
};

let formatVal = (val, unit = 'ether') => {
    return ethers.utils.formatUnits(val, unit);
}

async function main() {
    let [owner] = await ethers.getSigners();
    let depositAmount = BigInt(getWei("1000"));

    const MIMCLibrary = await ethers.getContractFactory(abi, bytecode, owner);
    let mimc = await MIMCLibrary.deploy();
    await mimc.deployed();
    console.log("MiMC deployed to: ", chalk.green(mimc.address));

    const TestERC = await ethers.getContractFactory("TestERC20", owner);
    let token = await TestERC.deploy("Tester", "tst");
    await token.deployed();
    console.log("Token deployed to: ", chalk.green(token.address));

    console.log("Deploying ERCZKPool for depositamount: ", formatVal(depositAmount.toString()));

    const ERCZKPool = await ethers.getContractFactory("ERCZKPool", {
        signer: owner,
        libraries: {
            MiMC: mimc.address
        }
    });

    let pool = await ERCZKPool.deploy(3, token.address, depositAmount);
    await pool.deployed();
    console.log("ERCZKPool deployed to: ", chalk.green(pool.address));
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
