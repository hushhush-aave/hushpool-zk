// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
// const { ethers } = require("hardhat");

import { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";

import { abi, bytecode } from "./../utils/mimc-util";
import { KOVAN_ADDRESSES } from './../utils/addresses';

let getWei = (eth: string) => {
    return ethers.utils.parseEther(eth);
};

async function main() {
    let [owner, user, user2] = await ethers.getSigners();

    console.log(await owner.getAddress(), (await user2.getBalance()).toString());

    const MIMCLibrary = await ethers.getContractFactory(abi, bytecode, owner);
    let mimc = await MIMCLibrary.deploy();
    await mimc.deployed();
    console.log("MiMC deployed to: ", mimc.address);

    let weth = await ethers.getContractAt("IWETH", KOVAN_ADDRESSES["weth"], owner);
    let wethERC20 = await ethers.getContractAt("IERC20", KOVAN_ADDRESSES["weth"], owner);

    let lendingPool = await ethers.getContractAt("ILendingPool", KOVAN_ADDRESSES["lendingpool"], owner);
    let dataProvider = await ethers.getContractAt("AaveProtocolDataProvider", KOVAN_ADDRESSES["dataprovider"], owner);

    let reserveAddresses = await dataProvider.getReserveTokensAddresses(weth.address);
    let aTokenAddress = reserveAddresses["aTokenAddress"];

    let aToken = await ethers.getContractAt(
        "AToken",
        aTokenAddress,
        owner
    );

    const AaveZKPool = await ethers.getContractFactory("AaveZKPool", {
        libraries: {
            MiMC: KOVAN_ADDRESSES["mimc"]
        }
    })

    let depositAmount = BigInt(getWei("0.01"));
    console.log(depositAmount);

    let zkpool = await AaveZKPool.connect(user2).deploy(3, weth.address, lendingPool.address, aToken.address, depositAmount);
    await zkpool.deployed();

    console.log("AaveZKPool deployed to: ", zkpool.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
