import { ethers } from "hardhat";
import * as Hush from "./../zk-proofs/hush-withdraw/js/hush-js";

//import * as Addr from "./../addresses";
import { KOVAN_ADDRESSES } from './../utils/addresses';


let getWei = (eth: string) => {
    return ethers.utils.parseEther(eth);
};

/**
 * Will retrieve the commitments in thre tree.
 * Create a deposit 
 * This code will look at the current state. 
 * Then deposit into the tree
 * Then withdraw from it.
 * Full circle
 */

async function main() {
    let [owner, user, user2] = await ethers.getSigners();

    let addrString = "0xD81523Da11b9A55cB1b39f08bd59319E5143A910";
    let receiverAddr = BigInt(addrString);
    console.log("How far to we get!");

    let token = await ethers.getContractAt("TestERC20", KOVAN_ADDRESSES["erc20"], owner);
    let pool = await ethers.getContractAt("ERCZKPool", KOVAN_ADDRESSES["erczkpool"], owner);
    let depositAmount = await pool.depositSize();

    console.log("token at: ", token.address);
    console.log("pool at: ", pool.address);

    await token.mint(await user.getAddress(), getWei("10000"));

    console.log("user balance: ", (await token.balanceOf(await user.getAddress())).toString());
    let allowance = await token.allowance(await user.getAddress(), pool.address);
    console.log("user approval: ", allowance.toString());

    if (allowance < depositAmount) {
        console.log("Approving", depositAmount.toString());
        await token.connect(user).approve(pool.address, depositAmount);
        allowance = await token.allowance(await user.getAddress(), pool.address);
        console.log("user approval: ", allowance.toString());
    }

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

    let tree = Hush.buildTree(3, commits);
    console.log("Tree with deposit size of: ", depositAmount.toString(), "contains", commits.length, "elements");
    console.log("Expected root: ", tree.root.toString());
    console.log("Real root    : ", (await pool.root()).toString())
    console.log("Pool balance : ", (await token.balanceOf(pool.address)).toString());

    // Perform new withdraw. Ahh shit. We have not stored anything xD But we can do a new deposit! and then withdraw?

    console.log("--- Fresh Deposit ---");
    let freshLeaf = Hush.createLeaf(BigInt(depositAmount));
    let freshInner = Hush.getInnerCommitmentFromLeaf(freshLeaf);
    let freshCommit = Hush.getCommitmentFromLeaf(freshLeaf);

    commits.push(freshCommit);
    tree = Hush.buildTree(3, commits);
    console.log("Expected root: ", tree.root.toString());

    let index = commits.length - 1;
    await pool.connect(user).deposit(freshInner, { gasPrice: 15000000000, gasLimit: 900000 });

    console.log("Real root    : ", (await pool.root()).toString());
    console.log("Pool balance : ", (await token.balanceOf(pool.address)).toString());

    console.log("--- Withdraw ---");
    let _withdrawAmount = BigInt(3000);
    let _fee = BigInt(100);

    let { solidityProof, soliditySignals, newLeaf } = await Hush.getProof(freshLeaf, index, tree, _withdrawAmount, _fee, receiverAddr);

    console.log("Pre receiver balance: ", (await token.balanceOf(addrString)).toString());
    await pool.connect(owner).withdraw(addrString, solidityProof, soliditySignals, { gasPrice: 15000000000, gasLimit: 900000 });

    commits.push(Hush.getCommitmentFromLeaf(newLeaf));
    tree = Hush.buildTree(3, commits);

    console.log("Post receiver balance: ", (await token.balanceOf(addrString)).toString());
    console.log("Expected root: ", tree.root.toString());
    console.log("Real root    : ", (await pool.root()).toString());
    console.log("Pool balance : ", (await token.balanceOf(pool.address)).toString());
}



main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    })