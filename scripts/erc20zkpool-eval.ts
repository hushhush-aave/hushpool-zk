import { ethers } from "hardhat";
import * as Addr from "./../addresses";
import * as Hush from "./../zk-proofs/hush-withdraw/js/hush-js";


let getWei = (eth: string) => {
    return ethers.utils.parseEther(eth);
};

async function main() {
    let [owner, user, user2] = await ethers.getSigners();

    let addrString = "0xD81523Da11b9A55cB1b39f08bd59319E5143A910";
    let receiverAddr = BigInt(addrString);

    let token = await ethers.getContractAt("TestERC20", Addr.getERC20Token(), owner);
    let pool = await ethers.getContractAt("ERCZKPool", Addr.getERCZKPool(), owner);

    console.log("Using token at: ", token.address);
    console.log("Using pool at:  ", pool.address);

    let depositAmount = BigInt(getWei("1000"));
    console.log("With depositamount: ", depositAmount);

    console.log("--- Mint ---");
    await token.mint(await user.getAddress(), getWei("10000"));
    await token.mint(await user2.getAddress(), getWei("10000"));

    console.log("--- Approve ---");
    await token.connect(user).approve(pool.address, depositAmount);
    await token.connect(user2).approve(pool.address, depositAmount);

    return;

    console.log("--- Before Deposit ---");
    // Now for the real testing. Let us build some commitments.
    let leafs = [];
    let commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
    let emptyTree = Hush.buildTree(3, commits);
    let emptyRoot = emptyTree.root;

    console.log("Expected root: ", (emptyRoot).toString());
    console.log("Real root:     ", (await pool.root()).toString());
    console.log("Pool balance:  ", (await token.balanceOf(pool.address)).toString());

    // Initial deposit
    console.log("--- First Deposit ---");
    let firstLeaf = Hush.createLeaf(depositAmount);
    let firstInner = Hush.getInnerCommitment(firstLeaf.secret, firstLeaf.nonce);
    leafs.push(firstLeaf);
    commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
    let firstTree = Hush.buildTree(3, commits);
    let firstRoot = firstTree.root;

    console.log("Expected commitment: ", commits[0].toString());
    await pool.connect(user).deposit(firstInner);

    console.log("Expected root: ", (firstRoot).toString());
    console.log("Real root:     ", (await pool.root()).toString());
    console.log("Pool balance:  ", (await token.balanceOf(pool.address)).toString());
    
    // Second deposit
    console.log("--- Second Deposit ---");
    let secondLeaf = Hush.createLeaf(depositAmount);
    let secondInner = Hush.getInnerCommitment(secondLeaf.secret, secondLeaf.nonce);
    leafs.push(secondLeaf);
    commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
    let secondTree = Hush.buildTree(3, commits);
    let secondRoot = secondTree.root;

    console.log("Expected commitment: ", commits[1].toString());

    await pool.connect(user2).deposit(secondInner);
    console.log("Expected root: ", (secondRoot).toString());
    console.log("Real root:     ", (await pool.root()).toString());
    console.log("Pool balance:  ", (await token.balanceOf(pool.address)).toString());
    
    let lastTree = secondTree;

    console.log("--- Withdrawing ---");

    // Can we then make a withdraw here :O!
    for (let i = 0; i < 1; i++) {
        let s = ["--- First Withdraw ---", "--- Second Withdraw ---"];
        console.log(s[i]);
        let index = leafs.length - 1;
        let oldLeaf = leafs[index];

        let _withdrawAmount = BigInt(2500);
        let _fee = BigInt(5);
        let removed = _fee + _withdrawAmount;

        console.log("Withdrawing", _withdrawAmount.toString(), "with", _fee.toString(), "fee");
        
        let { solidityProof, soliditySignals, newLeaf } = await Hush.getProof(oldLeaf, index, lastTree, _withdrawAmount, _fee, receiverAddr);

        // The actual withdraw
        let poolBalance = await token.balanceOf(pool.address);
        let userBalance = await token.balanceOf(addrString);
        let ownerBalance = await token.balanceOf(await owner.getAddress());

        console.log("Poolbalance pre: ", poolBalance.toString());
        console.log("Userbalance pre: ", userBalance.toString());
        console.log("Ownerbalance pre: ", ownerBalance.toString());
        console.log("actual withdraw");
        await pool.connect(owner).withdraw(addrString, solidityProof, soliditySignals);

        leafs.push(newLeaf);
        commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        console.log("Expected commitment: ", commits[2 + i].toString());
        lastTree = Hush.buildTree(3, commits);

        console.log("Expected root: ", (lastTree.root).toString());
        console.log("Real root: ", (await pool.root()).toString());
        console.log("Pool balance: ", (await token.balanceOf(pool.address)).toString());
        console.log("User balance: ", (await token.balanceOf(addrString)).toString());
        console.log("Owner balance: ", (await token.balanceOf(await owner.getAddress())).toString());        
    }

}




main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    })