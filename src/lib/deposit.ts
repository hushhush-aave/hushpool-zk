import { ethers } from "hardhat";
import chalk from 'chalk';
import figlet from 'figlet';

const queries = require('./inquirer');

const KOVAN_ADDRESSES = {
    "weth": "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
    "aweth": "0x87b1f4cf9BD63f7BBD3eE1aD04E8F52540349347",
    "dataprovider": "0x3c73A5E5785cAC854D468F727c606C07488a29D6",
    "lendingpool": "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",
    "aavepool": "0x1631FFf000DF62c63A03E420c9627bc76eC562b7",
}

const hush = require("../../zk-proofs/hush-withdraw/js/hush-js.js");

const ConfigStore = require('configstore');
const conf = new ConfigStore('hushhush');

let getWei = (eth: string) => {
    return ethers.utils.parseEther(eth);
};

let formatVal = (val, unit = 'ether') => {
    return ethers.utils.formatUnits(val, unit);
}

function deposit_clear() {
    conf.set("myDeposits", []);
    conf.set("myOldDeposits", []);
}

function toWithDraw(_index, _leaf) {
    // Index is the one we want to remove
    // Leaf is the one we add.
    let deps = conf.get("myDeposits");
    if (deps) {
        let _toRemove = deps[_index];

        let oldDeps = conf.get("myOldDeposits");
        if (!oldDeps) {
            conf.set("myOldDeposits", [hush.stringifyLeaf(_toRemove)]);
        } else {
            conf.set("myOldDeposits", [...oldDeps, hush.stringifyLeaf(_toRemove)]);
        }
        deps.splice(_index, 1);
        conf.set("myDeposits", deps);
        add_deposit(_leaf);
    } else {
        console.log("ERROR");
        return 1;
    }
}

function add_deposit(leaf) {
    let deps = conf.get("myDeposits");
    if (!deps) {
        conf.set("myDeposits", [hush.stringifyLeaf(leaf)]);
    } else {
        conf.set("myDeposits", [...deps, hush.stringifyLeaf(leaf)]);
    }
}

async function deposit_show() {
    // We should probably make the computation to show how much we have!
    let deposits = conf.get("myDeposits");
    if (deposits) {
        let i = 0;
        let sum = BigInt(0);
        deposits.forEach(deposit => {
            console.log(i++, formatVal(deposit["balance"]), hush.getCommitmentFromLeaf(deposit).toString(16));
            sum += BigInt(deposit["balance"]);
        });
        console.log(chalk.bold("Summed balance: "), chalk.green(formatVal(sum)));
    }
    return 1;
}

async function deposit_show_old() {
    // We should probably make the computation to show how much we have!
    let deposits = conf.get("myOldDeposits");
    if (deposits) {
        let i = 0;
        let sum = BigInt(0);
        deposits.forEach(deposit => {
            console.log(i++, formatVal(deposit["balance"]), hush.getCommitmentFromLeaf(deposit).toString(16));
            sum += BigInt(deposit["balance"]);
        });
        console.log(chalk.bold("Summed balance: "), chalk.green(formatVal(sum)));
    }
    return 1;
}

async function deposit_create() {
    // Måske skal man vælge en account også. Vi kan lige gøre det easy for nu.
    let [owner] = await ethers.getSigners();
    console.log("Using: ", await owner.getAddress());

    let weth = await ethers.getContractAt("IWETH", KOVAN_ADDRESSES["weth"], owner);
    let wethERC20 = await ethers.getContractAt("IERC20", KOVAN_ADDRESSES["weth"], owner);
    let lendingPool = await ethers.getContractAt("ILendingPool", KOVAN_ADDRESSES["lendingpool"], owner);
    let aToken = await ethers.getContractAt("AToken", KOVAN_ADDRESSES["aweth"], owner);
    let pool = await ethers.getContractAt("AaveZKPool", KOVAN_ADDRESSES["aavepool"], owner);

    let curBalance = await owner.getBalance();
    console.log("Eth balance: ", chalk.green(formatVal(curBalance.toString())));
    let wethBalance = await wethERC20.balanceOf(await owner.getAddress());
    console.log("Weth balance: ", formatVal(wethBalance.toString()));

    let depositAmount = await pool.depositSize();
    let poolSize = await pool.leafCount();
    console.log(`Pool deposit size ${formatVal(depositAmount)}`);
    console.log(`Pool contains ${poolSize.toString()} elements`);

    let val = getWei("0.015");
    await weth.connect(owner).deposit({ value: val});
    console.log(`\t User swapped ${formatVal(val)} eth -> weth`);
    await weth.connect(owner).approve(lendingPool.address, val, { gasPrice: 15000000000, gasLimit: 900000 });
    console.log("\t User approved lendingpool to spend weth");
    await lendingPool.connect(owner).deposit(weth.address, val, await owner.getAddress(), 0, { gasPrice: 15000000000, gasLimit: 900000 });
    console.log("\t User deposited weth into Aave");
    await aToken.connect(owner).approve(pool.address, getWei("1"), { gasPrice: 15000000000, gasLimit: 900000 });
    console.log("\t User approved zkpool to spend aWeth");

    let scaledBalanceUser = await aToken.scaledBalanceOf(await owner.getAddress());
    console.log("User scaled balance: ", formatVal(scaledBalanceUser.toString()));
    //let allowance = await aToken.allowance(await owner.getAddress(), pool.address);
    //console.log("User approval: ", formatVal(allowance.toString()));

    let filter = pool.filters.LeafInsertion();
    let res = await pool.queryFilter(filter, 0, 'latest');

    let leafs = res.map(event => {
        return { index: event.args["leafIndex"], leaf: event.args["leaf"] };
    });

    // Let us compute the shit for the real leafs!
    let compare = (a, b) => {
        if (a["index"] < b["index"]) {
            return -1;
        } else if (a["index"] > b["index"]) {
            return 1;
        } else {
            return 0;
        }
    }

    leafs.sort(compare);

    let commits = [];
    leafs.forEach((leaf) => {
        commits.push(leaf["leaf"]);
    });

    let tree = hush.buildTree(3, commits);

    let freshLeaf = hush.createLeaf(BigInt(depositAmount));
    let freshInner = hush.getInnerCommitmentFromLeaf(freshLeaf);
    let freshCommit = hush.getCommitmentFromLeaf(freshLeaf);

    add_deposit(freshLeaf);

    commits.push(freshCommit);
    tree = hush.buildTree(3, commits);

    let tx = await pool.connect(owner).deposit(freshInner, { gasPrice: 15000000000, gasLimit: 900000 });
    console.log(chalk.bold("Tx hash: ", chalk.green(tx["hash"])));
    console.log("Leaf hash: ", freshCommit.toString(16));
    //console.log("Expected root: ", tree.root.toString(16));
    //console.log("Real root    : ", (await pool.root()).toString());
    console.log("Scaled Pool balance : ", formatVal((await aToken.scaledBalanceOf(pool.address))));
    console.log("Pool balance : ", formatVal((await aToken.balanceOf(pool.address))));
}


async function initWithdraw() {
    let deposits = conf.get("myDeposits");
    if (deposits) {
        let choices = [];
        deposits.forEach(deposit => {
            let s = formatVal(deposit["balance"]) + " " + hush.getCommitmentFromLeaf(deposit).toString(16);
            choices.push(s);
        });
        choices.push(chalk.red("Cancel"));

        let pick = await queries.askWithdraw(choices);
        if (pick["index"] == choices[choices.length - 1]) {
            return -1;
        }

        let index = choices.indexOf(pick["index"]);
        console.log(index);

        let spendLeaf = deposits[index];
        return await withdrawStep2(index, spendLeaf);
    }
}

async function withdrawStep2(_spendIndex, _leaf) {
    let amount = BigInt(getWei("0.003").toString());
    let fee = BigInt(getWei("0.0005").toString());
    let receiver = "0xD81523Da11b9A55cB1b39f08bd59319E5143A910";

    console.log("Here you should have picked amounts, but not done yet, using amount:", formatVal(amount), "fee:", formatVal(fee), "receiver:", receiver);

    return await withdraw(_spendIndex, hush.destringifyLeaf(_leaf), amount, fee, receiver);
}

async function withdraw(_spendIndex, _withdrawLeaf, _amount, _fee, _receiver) {
    let receiverAddr = BigInt(_receiver);
    // Måske skal man vælge en account også. Vi kan lige gøre det easy for nu.
    let [owner, relayer] = await ethers.getSigners();
    console.log("Using: ", await owner.getAddress());

    let aToken = await ethers.getContractAt("AToken", KOVAN_ADDRESSES["aweth"], owner);
    let pool = await ethers.getContractAt("AaveZKPool", KOVAN_ADDRESSES["aavepool"], owner);

    let filter = pool.filters.LeafInsertion();
    let res = await pool.queryFilter(filter, 0, 'latest');

    let withdrawLeafCommit = hush.getCommitmentFromLeaf(_withdrawLeaf);
    let myIndex;

    let leafs = res.map(event => {
        if (event.args["leaf"] == withdrawLeafCommit) {
            myIndex = event.args["leafIndex"];
        }
        return { index: event.args["leafIndex"], leaf: event.args["leaf"] };
    });

    if (myIndex == undefined) {
        console.log("We got an issue")
        return 1;
    }

    // Let us compute the shit for the real leafs!
    let compare = (a, b) => {
        if (a["index"] < b["index"]) {
            return -1;
        } else if (a["index"] > b["index"]) {
            return 1;
        } else {
            return 0;
        }
    }

    leafs.sort(compare);

    let commits = [];
    leafs.forEach((leaf) => {
        commits.push(leaf["leaf"]);
    });

    let tree = hush.buildTree(3, commits);

    let { solidityProof, soliditySignals, newLeaf } = await hush.getProof(_withdrawLeaf, myIndex, tree, _amount, _fee, receiverAddr);
    console.log(chalk.bold("Proof generated"));

    let solidityInput = { to: _receiver, proof: solidityProof, signals: soliditySignals };

    console.log("Solidity function input: ", solidityInput);
    // console.log(newLeaf);
    // console.log(newLeaf);
    // Remember to save the newLeaf!
    // Remember to delete the old!
    toWithDraw(_spendIndex, newLeaf);

    console.log("Raleying withdraw through: ", (await relayer.getAddress()));
    console.log("Pre receiver balance: ", formatVal((await aToken.scaledBalanceOf(_receiver))));
    console.log("Pre Pool balance : ", formatVal((await aToken.balanceOf(pool.address))));
    let tx = await pool.connect(relayer).withdraw(_receiver, solidityProof, soliditySignals, { gasPrice: 15000000000, gasLimit: 900000 });
    console.log(chalk.bold("Tx hash: ", chalk.green(tx["hash"])));

    commits.push(hush.getCommitmentFromLeaf(newLeaf));
    //console.log("New leaf: ", commits[commits.length - 1].toString(16));
    tree = hush.buildTree(3, commits);

    console.log("Post receiver balance: ", formatVal((await aToken.scaledBalanceOf(_receiver))));
    //console.log("Expected root: ", tree.root.toString(16));
    //console.log("Real root    : ", (await pool.root()).toString(16));
    console.log("Scaled Pool balance : ", formatVal((await aToken.scaledBalanceOf(pool.address))));
    console.log("Pool balance : ", formatVal((await aToken.balanceOf(pool.address))));

    return 0;
}




export {KOVAN_ADDRESSES, deposit_show, deposit_show_old, deposit_create, initWithdraw, deposit_clear};