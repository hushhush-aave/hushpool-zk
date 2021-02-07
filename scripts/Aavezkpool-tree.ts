import { ethers } from "hardhat";
import * as Addr from "./../addresses";
import * as Hush from "./../zk-proofs/hush-withdraw/js/hush-js";

let getWei = (eth: string) => {
    return ethers.utils.parseEther(eth);
};

/**
 * This code will look at the current state. 
 * Then deposit into the tree
 * Then withdraw from it.
 * Full circle
 */


 // It seems like there is some inconsistencies when we are using the Kovan network.
 // E.g., we can put stuff in, but not all the time it is updated right away when we ask for it
 // Had an example where I deposited, but when I read just after I found another value.
 // Possibly we read from different nodes xD. Then it seem that we have updated one
 // But receive answer from the other before it is updated.
 // Had a transaction where deposits did as they should but the balances stayed the same
 // Then if we read the values again, they were updated as intended.


async function main() {
    let [owner, user, user2] = await ethers.getSigners();

    let addrString = "0xD81523Da11b9A55cB1b39f08bd59319E5143A910";
    let receiverAddr = BigInt(addrString);

    let weth = await ethers.getContractAt("IWETH", Addr.getWETH(), owner);
    let wethERC20 = await ethers.getContractAt("IERC20", Addr.getWETH(), owner);
    let lendingPool = await ethers.getContractAt("ILendingPool", Addr.getLendingPool(), owner);
    let dataProvider = await ethers.getContractAt("AaveProtocolDataProvider", Addr.getDataProvider(), owner);
    let reserveAddresses = await dataProvider.getReserveTokensAddresses(weth.address);
    let aTokenAddress = reserveAddresses["aTokenAddress"];
    let aToken = await ethers.getContractAt(
        "AToken",
        aTokenAddress,
        owner
    );
    let pool = await ethers.getContractAt("AaveZKPool", Addr.getAavePool(), owner);

    let depositAmount = await pool.depositSize();
    console.log("DepositAmount: ", depositAmount.toString());
    console.log("Pool at: ", pool.address);
    console.log("Pool size: ", (await pool.leafCount()).toString());
    console.log("Pool root: ", (await pool.root()).toString());
    console.log("Scaled Pool balance : ", (await aToken.scaledBalanceOf(pool.address)).toString());
    console.log("Pool balance : ", (await aToken.balanceOf(pool.address)).toString());
    console.log("receiver balance: ", (await aToken.scaledBalanceOf(addrString)).toString());

    // return

    await weth.connect(user).deposit({value: getWei("0.015"), gasLimit: 900000});
    console.log("\t User ");
    await weth.connect(user).approve(lendingPool.address, getWei("0.015"));
    await lendingPool.connect(user).deposit(weth.address, getWei("0.015"), await user.getAddress(), 0);
    await aToken.connect(user).approve(pool.address, getWei("1"));

    return;


    let scaledBalanceUser = await aToken.scaledBalanceOf(await user.getAddress());
    console.log("User scaled balance: ", scaledBalanceUser.toString());
    let allowance = await aToken.allowance(await user.getAddress(), pool.address);
    console.log("User approval: ", allowance.toString());

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
    console.log("Scaled Pool balance : ", (await aToken.scaledBalanceOf(pool.address)).toString());
    console.log("Pool balance : ", (await aToken.balanceOf(pool.address)).toString());

    // Perform new withdraw. Ahh shit. We have not stored anything xD But we can do a new deposit! and then withdraw?

    console.log("--- Fresh Deposit ---");
    let freshLeaf = Hush.createLeaf(BigInt(depositAmount));
    let freshInner = Hush.getInnerCommitmentFromLeaf(freshLeaf);
    let freshCommit = Hush.getCommitmentFromLeaf(freshLeaf);

    commits.push(freshCommit);
    tree = Hush.buildTree(3, commits);

    let index = commits.length - 1;
    await pool.connect(user).deposit(freshInner);
    console.log("Depositing ", freshInner.toString(16));
    console.log("Leaf: ", freshCommit.toString(16));
    console.log("Expected root: ", tree.root.toString());
    console.log("Real root    : ", (await pool.root()).toString());
    console.log("Scaled Pool balance : ", (await aToken.scaledBalanceOf(pool.address)).toString());
    console.log("Pool balance : ", (await aToken.balanceOf(pool.address)).toString());

    console.log("--- Withdraw ---");
    let _withdrawAmount = BigInt(3000);
    let _fee = BigInt(100);

    let { solidityProof, soliditySignals, newLeaf } = await Hush.getProof(freshLeaf, index, tree, _withdrawAmount, _fee, receiverAddr);

    console.log("Pre receiver balance: ", (await aToken.scaledBalanceOf(addrString)).toString());
    await pool.connect(owner).withdraw(addrString, solidityProof, soliditySignals, {gasLimit: 900000});

    commits.push(Hush.getCommitmentFromLeaf(newLeaf));
    console.log("New leaf: ", commits[commits.length - 1].toString(16));
    tree = Hush.buildTree(3, commits);

    console.log("Post receiver balance: ", (await aToken.scaledBalanceOf(addrString)).toString());
    console.log("Expected root: ", tree.root.toString());
    console.log("Real root    : ", (await pool.root()).toString());
    console.log("Scaled Pool balance : ", (await aToken.scaledBalanceOf(pool.address)).toString());
    console.log("Pool balance : ", (await aToken.balanceOf(pool.address)).toString());
}



main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    })