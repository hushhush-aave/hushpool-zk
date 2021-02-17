import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";

import * as Hush from "./../zk-proofs/hush-withdraw/js/hush-js";
//const websnarkUtils = require("websnark/tools/stringifybigint");

//const snarkjs = require("snarkjs");

import { abi, bytecode } from "./../utils/mimc-util";


describe("Aave ZKPool", function () {
    let owner: Signer;
    let user: Signer;
    let user2: Signer;

    //let addrString = "0xD81523Da11b9A55cB1b39f08bd59319E5143A910";
    //let receiverAddr = BigInt(addrString);

    let zkpool: Contract;

    let wethERC20: Contract;
    let weth: Contract;
    let lendingPool: Contract;
    let aToken: Contract;

    let getWei = (eth: string) => {
        return ethers.utils.parseEther(eth);
    };

    let getEth = (wei: BigNumber) => {
        return wei.div("1000000000000000000");
    };

    let depositAmount = BigInt(getWei("10"));

    async function showMeBalances() {
        let scaledBalanceOwner = await aToken.scaledBalanceOf(await owner.getAddress());        
        let scaledBalance = await aToken.scaledBalanceOf(await user.getAddress());
        let scaledBalance2 = await aToken.scaledBalanceOf(await user2.getAddress());
        let poolscaledBalance = await aToken.scaledBalanceOf(zkpool.address);
        console.log( (await owner.getAddress()).toString(), "has", scaledBalanceOwner.toString(), "scaled");
        console.log( (await user.getAddress()).toString(), "has", scaledBalance.toString(), "scaled");
        console.log( (await user2.getAddress()).toString(), "has", scaledBalance2.toString(), "scaled");
        console.log( (zkpool.address).toString(), "has", poolscaledBalance.toString(), "scaled");
    }

    beforeEach(async function () {
        [owner, user, user2] = await ethers.getSigners();

        wethERC20 = await ethers.getContractAt(
			"IERC20",
			"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			owner
		);
		weth = await ethers.getContractAt(
			"IWETH",
			"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			owner
        );
        
        lendingPool = await ethers.getContractAt(
            "ILendingPool",
            "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9",
            owner
        );
		//let lendingPoolAddress: String = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";

        let aaveProtocolDataProvider = await ethers.getContractAt(
            "AaveProtocolDataProvider",
            "0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d",
            owner
        );
        //let aaveProtocolDataProvider: String = "0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d";
        
        let reserveAddresses = await aaveProtocolDataProvider.getReserveTokensAddresses(weth.address);
        let aTokenAddress = reserveAddresses["aTokenAddress"];

        aToken = await ethers.getContractAt(
            "AToken",
            aTokenAddress,
            owner
        );

        const MIMCLibrary = await ethers.getContractFactory(abi, bytecode, owner);
        let mimc = await MIMCLibrary.deploy();
        await mimc.deployed();


        const AaveZKPool = await ethers.getContractFactory("AaveZKPool", {
            libraries: {
                MiMC: mimc.address
            }
        })

        zkpool = await AaveZKPool.deploy(3, weth.address, lendingPool.address, aToken.address, depositAmount);
        await zkpool.deployed();
    });

    it("User deposits and withdraws", async function () {
        // User deposits weth into Aave to receive aWet
        await weth.connect(user).deposit({value: getWei("50")});
        await weth.connect(user).approve(lendingPool.address, getWei("50"));
        await lendingPool.connect(user).deposit(weth.address, getWei("40"), await user.getAddress(), 0);
        await showMeBalances();

        // Approve pool to spend aTokens
        await aToken.connect(user).approve(zkpool.address, getWei("100"));

        // Time to make a deposit
        let leafs = [];
        let note = Hush.createLeaf(BigInt(depositAmount)); 
        let inner = Hush.getInnerCommitmentFromLeaf(note);
        leafs.push(note);
        let commits = leafs.map(leaf => Hush.getCommitmentFromLeaf(leaf));//(leaf.balance, leaf.secret, leaf.nonce));
        let tree = Hush.buildTree(3, commits);
        
        console.log("Build root: ", tree.root.toString());
        console.log("Pool Pre:   ", (await zkpool.root()).toString());

        console.log("--- DEPOSIT ---");
        await zkpool.connect(user).deposit(inner);
        console.log("Pool Post:  ", (await zkpool.root()).toString());

        await showMeBalances();

        // Withdraws 2500 + 5 fee
        let index = 0;
        let oldLeaf = leafs[index];

        let _withdrawAmount = BigInt(2500);
        let _fee = BigInt(5);
        let removed = _fee + _withdrawAmount;

        let user2Addr =  (await user2.getAddress()).toString();

        let { solidityProof, soliditySignals, newLeaf } = await Hush.getProof(oldLeaf, index, tree, _withdrawAmount, _fee, user2Addr);

        console.log("--- WITHDRAW ---");
        await zkpool.connect(owner).withdraw(user2Addr, solidityProof, soliditySignals);

        leafs.push(newLeaf);
        commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        tree = Hush.buildTree(3, commits);

        console.log("Build root: ", tree.root.toString());
        console.log("Pool Post:  ", (await zkpool.root()).toString());

        await showMeBalances();
    


        /*

        const TestERC = await ethers.getContractFactory("TestERC20", owner);
        let token = await TestERC.deploy("Tester", "tst");
        await token.deployed();

        let depositAmount = BigInt(getWei("1000"));

        await token.mint(await user.getAddress(), getWei("10000"));
        expect(await token.balanceOf(await user.getAddress())).to.equal(getWei("10000"));
        await token.mint(await user2.getAddress(), getWei("10000"));
        expect(await token.balanceOf(await user2.getAddress())).to.equal(getWei("10000"));







        const ERCZKPool = await ethers.getContractFactory("ERCZKPool", {
            libraries: {
                MiMC: mimc.address
            }
        });

        let pool = await ERCZKPool.deploy(3, token.address, depositAmount);
        await pool.deployed();

        await token.connect(user).approve(pool.address, depositAmount);
        expect(await token.allowance(await user.getAddress(), pool.address)).to.equal(depositAmount);

        await token.connect(user2).approve(pool.address, depositAmount);
        expect(await token.allowance(await user2.getAddress(), pool.address)).to.equal(depositAmount);

        // Now for the real testing. Let us build some commitments.
        let leafs = [];
        let commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        let emptyTree = Hush.buildTree(3, leafs);
        let emptyRoot = emptyTree.root;

        expect(await pool.root()).to.equal(emptyRoot);
        expect(await token.balanceOf(pool.address)).to.equal(getWei("0"));

        // Initial deposit
        let firstLeaf = Hush.createLeaf(depositAmount);
        let firstInner = Hush.getInnerCommitment(firstLeaf.secret, firstLeaf.nonce);
        leafs.push(firstLeaf);
        commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        let firstTree = Hush.buildTree(3, commits);
        let firstRoot = firstTree.root;

        await pool.connect(user).deposit(firstInner);
        expect(await pool.root()).to.equal(firstRoot);
        expect(await token.balanceOf(pool.address)).to.equal(depositAmount);

        // Second deposit
        let secondLeaf = Hush.createLeaf(depositAmount);
        let secondInner = Hush.getInnerCommitment(secondLeaf.secret, secondLeaf.nonce);
        leafs.push(secondLeaf);
        commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        let secondTree = Hush.buildTree(3, commits);
        let secondRoot = secondTree.root;

        await pool.connect(user2).deposit(secondInner);
        expect(await pool.root()).to.equal(secondRoot);
        expect(await token.balanceOf(pool.address)).to.equal(getWei("2000"));

        let lastTree = secondTree;

        // Can we then make a withdraw here :O!
        for (let i = 0; i < 2; i++) {
            let index = leafs.length - 1;
            let oldLeaf = leafs[index];

            let _withdrawAmount = BigInt(2500);
            let _fee = BigInt(5);
            let removed = _fee + _withdrawAmount;

            let { solidityProof, soliditySignals, newLeaf } = await Hush.getProof(oldLeaf, index, lastTree, _withdrawAmount, _fee, receiverAddr);

            // The actual withdraw
            let poolBalance = await token.balanceOf(pool.address);
            let userBalance = await token.balanceOf(addrString);
            let ownerBalance = await token.balanceOf(await owner.getAddress());

            await pool.connect(owner).withdraw(addrString, solidityProof, soliditySignals);

            leafs.push(newLeaf);
            commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
            lastTree = Hush.buildTree(3, commits);
            expect(await pool.root()).to.equal(lastTree.root);
            expect(await pool.leafCount()).to.equal(3 + i);
            expect(await token.balanceOf(pool.address)).to.equal(BigInt(poolBalance) - removed);
            expect(await token.balanceOf(addrString)).to.equal(BigInt(userBalance) + _withdrawAmount);
            expect(await token.balanceOf(await owner.getAddress())).to.equal(BigInt(ownerBalance) + _fee);
        }
        */
    });
/*
    it("Try to withdraw (snarkmax - fee + 1) to force an overflow.", async function () {
        const MIMCLibrary = await ethers.getContractFactory(abi, bytecode, owner);
        let mimc = await MIMCLibrary.deploy();
        await mimc.deployed();

        const TestERC = await ethers.getContractFactory("TestERC20", owner);
        let token = await TestERC.deploy("Tester", "tst");
        await token.deployed();

        let depositAmount = BigInt(getWei("1000"));

        await token.mint(await user.getAddress(), getWei("10000"));
        expect(await token.balanceOf(await user.getAddress())).to.equal(getWei("10000"));
        await token.mint(await user2.getAddress(), getWei("10000"));
        expect(await token.balanceOf(await user2.getAddress())).to.equal(getWei("10000"));

        const ERCZKPool = await ethers.getContractFactory("ERCZKPool", {
            libraries: {
                MiMC: mimc.address
            }
        });

        let pool = await ERCZKPool.deploy(3, token.address, depositAmount);
        await pool.deployed();

        await token.connect(user).approve(pool.address, depositAmount);
        expect(await token.allowance(await user.getAddress(), pool.address)).to.equal(depositAmount);

        await token.connect(user2).approve(pool.address, depositAmount);
        expect(await token.allowance(await user2.getAddress(), pool.address)).to.equal(depositAmount);

        // Now for the real testing. Let us build some commitments.
        let leafs = [];
        let commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        let emptyTree = Hush.buildTree(3, leafs);
        let emptyRoot = emptyTree.root;

        expect(await pool.root()).to.equal(emptyRoot);
        expect(await token.balanceOf(pool.address)).to.equal(getWei("0"));

        // Initial deposit
        let firstLeaf = Hush.createLeaf(depositAmount);
        let firstInner = Hush.getInnerCommitment(firstLeaf.secret, firstLeaf.nonce);
        leafs.push(firstLeaf);
        commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        let firstTree = Hush.buildTree(3, commits);
        let firstRoot = firstTree.root;

        await pool.connect(user).deposit(firstInner);
        expect(await pool.root()).to.equal(firstRoot);
        expect(await token.balanceOf(pool.address)).to.equal(depositAmount);

        let lastTree = firstTree;

        // Can we then make a withdraw here :O!
        let index = leafs.length - 1;
        let oldLeaf = leafs[index];

        let maxVal = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        let maxVal128 = BigInt("340282366920938463463374607431768211455");
    
        let _fee = BigInt(5);
        let _withdrawAmount = maxVal - _fee + BigInt(1); // Overflow to 1 when we add the fee
        let removed = _fee + _withdrawAmount;

        let { solidityProof, soliditySignals, newLeaf } = await Hush.getProof(oldLeaf, index, lastTree, _withdrawAmount, _fee, receiverAddr);

        // The actual withdraw
        let poolBalance = await token.balanceOf(pool.address);
        let userBalance = await token.balanceOf(addrString);
        let ownerBalance = await token.balanceOf(await owner.getAddress());

        await expect(pool.connect(owner).withdraw(addrString, solidityProof, soliditySignals)).to.be.revertedWith("The proof is invalid");

        expect(await pool.root()).to.equal(lastTree.root);
        expect(await pool.leafCount()).to.equal(1);
        expect(await token.balanceOf(pool.address)).to.equal(BigInt(poolBalance));
        expect(await token.balanceOf(addrString)).to.equal(BigInt(userBalance));
        expect(await token.balanceOf(await owner.getAddress())).to.equal(BigInt(ownerBalance));
    });

    it("Try to change the fee to gain extra cash.", async function () {
        const MIMCLibrary = await ethers.getContractFactory(abi, bytecode, owner);
        let mimc = await MIMCLibrary.deploy();
        await mimc.deployed();

        const TestERC = await ethers.getContractFactory("TestERC20", owner);
        let token = await TestERC.deploy("Tester", "tst");
        await token.deployed();

        let depositAmount = BigInt(getWei("1000"));

        await token.mint(await user.getAddress(), getWei("10000"));
        expect(await token.balanceOf(await user.getAddress())).to.equal(getWei("10000"));
        await token.mint(await user2.getAddress(), getWei("10000"));
        expect(await token.balanceOf(await user2.getAddress())).to.equal(getWei("10000"));

        const ERCZKPool = await ethers.getContractFactory("ERCZKPool", {
            libraries: {
                MiMC: mimc.address
            }
        });

        let pool = await ERCZKPool.deploy(3, token.address, depositAmount);
        await pool.deployed();

        await token.connect(user).approve(pool.address, depositAmount);
        expect(await token.allowance(await user.getAddress(), pool.address)).to.equal(depositAmount);

        await token.connect(user2).approve(pool.address, depositAmount);
        expect(await token.allowance(await user2.getAddress(), pool.address)).to.equal(depositAmount);

        // Now for the real testing. Let us build some commitments.
        let leafs = [];
        let commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        let emptyTree = Hush.buildTree(3, leafs);
        let emptyRoot = emptyTree.root;

        expect(await pool.root()).to.equal(emptyRoot);
        expect(await token.balanceOf(pool.address)).to.equal(getWei("0"));

        // Initial deposit
        let firstLeaf = Hush.createLeaf(depositAmount);
        let firstInner = Hush.getInnerCommitment(firstLeaf.secret, firstLeaf.nonce);
        leafs.push(firstLeaf);
        commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        let firstTree = Hush.buildTree(3, commits);
        let firstRoot = firstTree.root;

        await pool.connect(user).deposit(firstInner);
        expect(await pool.root()).to.equal(firstRoot);
        expect(await token.balanceOf(pool.address)).to.equal(depositAmount);

        let lastTree = firstTree;

        // Can we then make a withdraw here :O!
        let index = leafs.length - 1;
        let oldLeaf = leafs[index];
    
        let _fee = BigInt(5);
        let _withdrawAmount = BigInt(2500); // Overflow to 1 when we add the fee
        let removed = _fee + _withdrawAmount;

        let { solidityProof, soliditySignals, newLeaf } = await Hush.getProof(oldLeaf, index, lastTree, _withdrawAmount, _fee, receiverAddr);

        // The actual withdraw
        let poolBalance = await token.balanceOf(pool.address);
        let userBalance = await token.balanceOf(addrString);
        let ownerBalance = await token.balanceOf(await owner.getAddress());

        // Try to update the fee input
        soliditySignals[1] = BigInt(10);

        await expect(pool.connect(owner).withdraw(addrString, solidityProof, soliditySignals)).to.be.revertedWith("The proof is invalid");

        expect(await pool.root()).to.equal(lastTree.root);
        expect(await pool.leafCount()).to.equal(1);
        expect(await token.balanceOf(pool.address)).to.equal(BigInt(poolBalance));
        expect(await token.balanceOf(addrString)).to.equal(BigInt(userBalance));
        expect(await token.balanceOf(await owner.getAddress())).to.equal(BigInt(ownerBalance));
    });

    it("Multiple deposits, tries to doublespend", async function () {
        const MIMCLibrary = await ethers.getContractFactory(abi, bytecode, owner);
        let mimc = await MIMCLibrary.deploy();
        await mimc.deployed();

        const TestERC = await ethers.getContractFactory("TestERC20", owner);
        let token = await TestERC.deploy("Tester", "tst");
        await token.deployed();

        let depositAmount = BigInt(getWei("1000"));

        await token.mint(await user.getAddress(), getWei("10000"));
        expect(await token.balanceOf(await user.getAddress())).to.equal(getWei("10000"));
        await token.mint(await user2.getAddress(), getWei("10000"));
        expect(await token.balanceOf(await user2.getAddress())).to.equal(getWei("10000"));

        const ERCZKPool = await ethers.getContractFactory("ERCZKPool", {
            libraries: {
                MiMC: mimc.address
            }
        });

        let pool = await ERCZKPool.deploy(3, token.address, depositAmount);
        await pool.deployed();

        await token.connect(user).approve(pool.address, depositAmount);
        expect(await token.allowance(await user.getAddress(), pool.address)).to.equal(depositAmount);

        await token.connect(user2).approve(pool.address, depositAmount);
        expect(await token.allowance(await user2.getAddress(), pool.address)).to.equal(depositAmount);

        // Now for the real testing. Let us build some commitments.
        let leafs = [];
        let commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        let emptyTree = Hush.buildTree(3, leafs);
        let emptyRoot = emptyTree.root;

        expect(await pool.root()).to.equal(emptyRoot);
        expect(await token.balanceOf(pool.address)).to.equal(getWei("0"));

        // Initial deposit
        let firstLeaf = Hush.createLeaf(depositAmount);
        let firstInner = Hush.getInnerCommitment(firstLeaf.secret, firstLeaf.nonce);
        leafs.push(firstLeaf);
        commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        let firstTree = Hush.buildTree(3, commits);
        let firstRoot = firstTree.root;

        await pool.connect(user).deposit(firstInner);
        expect(await pool.root()).to.equal(firstRoot);
        expect(await token.balanceOf(pool.address)).to.equal(depositAmount);

        // Second deposit
        let secondLeaf = Hush.createLeaf(depositAmount);
        let secondInner = Hush.getInnerCommitment(secondLeaf.secret, secondLeaf.nonce);
        leafs.push(secondLeaf);
        commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        let secondTree = Hush.buildTree(3, commits);
        let secondRoot = secondTree.root;

        await pool.connect(user2).deposit(secondInner);
        expect(await pool.root()).to.equal(secondRoot);
        expect(await token.balanceOf(pool.address)).to.equal(getWei("2000"));

        let lastTree = secondTree;

        // Can we then make a withdraw here :O!
        for (let i = 0; i < 2; i++) {
            let index = 1;
            let oldLeaf = leafs[index];

            let _withdrawAmount = BigInt(2500);
            let _fee = BigInt(5);
            let removed = _fee + _withdrawAmount;

            let { solidityProof, soliditySignals, newLeaf } = await Hush.getProof(oldLeaf, index, lastTree, _withdrawAmount, _fee, receiverAddr);

            // The actual withdraw
            let poolBalance = await token.balanceOf(pool.address);
            let userBalance = await token.balanceOf(addrString);
            let ownerBalance = await token.balanceOf(await owner.getAddress());

            if (i == 1){ // This is the reuse.
                await expect(pool.connect(owner).withdraw(addrString, solidityProof, soliditySignals)).to.be.revertedWith("Reuse of nullifier");

                expect(await pool.root()).to.equal(lastTree.root);
                expect(await pool.leafCount()).to.equal(3);
                expect(await token.balanceOf(pool.address)).to.equal(BigInt(poolBalance));
                expect(await token.balanceOf(addrString)).to.equal(BigInt(userBalance));
                expect(await token.balanceOf(await owner.getAddress())).to.equal(BigInt(ownerBalance));    
            } else {
                await pool.connect(owner).withdraw(addrString, solidityProof, soliditySignals);
                leafs.push(newLeaf);
                commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
                lastTree = Hush.buildTree(3, commits);
                expect(await pool.root()).to.equal(lastTree.root);
                expect(await pool.leafCount()).to.equal(3);
                expect(await token.balanceOf(pool.address)).to.equal(BigInt(poolBalance) - removed);
                expect(await token.balanceOf(addrString)).to.equal(BigInt(userBalance) + _withdrawAmount);
                expect(await token.balanceOf(await owner.getAddress())).to.equal(BigInt(ownerBalance) + _fee);    
            }
        }
    });

    /*
        it("Multiple deposits, then trying to double-spend", async function () {
            const MIMCLibrary = await ethers.getContractFactory(abi, bytecode, owner);
            let mimc = await MIMCLibrary.deploy();
            await mimc.deployed();
    
            const TestERC = await ethers.getContractFactory("TestERC20", owner);
            let token = await TestERC.deploy("Tester", "tst");
            await token.deployed();
    
            let depositAmount = BigInt(getWei("1000"));
    
            await token.mint(await user.getAddress(), getWei("10000"));
            expect(await token.balanceOf(await user.getAddress())).to.equal(getWei("10000"));
            await token.mint(await user2.getAddress(), getWei("10000"));
            expect(await token.balanceOf(await user2.getAddress())).to.equal(getWei("10000"));
    
            const ERCZKPool = await ethers.getContractFactory("ERCZKPool", {
                libraries: {
                    MiMC: mimc.address
                }
            });
    
            let pool = await ERCZKPool.deploy(3, token.address, depositAmount);
            await pool.deployed();
    
            await token.connect(user).approve(pool.address, depositAmount);
            expect(await token.allowance(await user.getAddress(), pool.address)).to.equal(depositAmount);
    
            await token.connect(user2).approve(pool.address, depositAmount);
            expect(await token.allowance(await user2.getAddress(), pool.address)).to.equal(depositAmount);
    
            // Now for the real testing. Let us build some commitments.
            let leafs = [];
            let commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
            let emptyTree = Hush.buildTree(3, leafs);
            let emptyRoot = emptyTree.root;
    
            expect(await pool.root()).to.equal(emptyRoot);
            expect(await token.balanceOf(pool.address)).to.equal(getWei("0"));
    
            // Initial deposit
            let firstLeaf = Hush.createLeaf(depositAmount);
            let firstInner = Hush.getInnerCommitment(firstLeaf.secret, firstLeaf.nonce);
            leafs.push(firstLeaf);
            commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
            let firstTree = Hush.buildTree(3, commits);
            let firstRoot = firstTree.root;
    
            await pool.connect(user).deposit(firstInner);
            expect(await pool.root()).to.equal(firstRoot);
            expect(await token.balanceOf(pool.address)).to.equal(depositAmount);
    
            // Second deposit
            let secondLeaf = Hush.createLeaf(depositAmount);
            let secondInner = Hush.getInnerCommitment(secondLeaf.secret, secondLeaf.nonce);
            leafs.push(secondLeaf);
            commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
            let secondTree = Hush.buildTree(3, commits);
            let secondRoot = secondTree.root;
    
            await pool.connect(user2).deposit(secondInner);
            expect(await pool.root()).to.equal(secondRoot);
            expect(await token.balanceOf(pool.address)).to.equal(getWei("2000"));
    
            let lastTree = secondTree;
    
            // Can we then make a withdraw here :O!
            for(let i = 0; i < 2; i++){
                let index = 1;
                let oldLeaf = leafs[index];
        
                let { proof, publicSignals, newLeaf } = await createProof(oldLeaf, index, receiverAddr, lastTree);
                let nullifier = publicSignals[0];
                let newLeafCommit = publicSignals[1];
                let withdrawAmount = publicSignals[2];
                let root = publicSignals[3];
        
                // There seem to be a difference on how we showcase it in solidity and js
                // We need to make a y,x for the b coords.
                let proofList = [
                    proof["pi_a"][0], proof["pi_a"][1],
                    proof["pi_b"][0][1], proof["pi_b"][0][0],
                    proof["pi_b"][1][1], proof["pi_b"][1][0],
                    proof["pi_c"][0], proof["pi_c"][1]
                ];
            
                // The actual withdraw
                let poolBalance = await token.balanceOf(pool.address);
                let ownerBalance = await token.balanceOf(await owner.getAddress());
    
                if (i == 1){
                    await expect(pool.connect(owner).withdraw(await owner.getAddress(), proofList, withdrawAmount, root, nullifier, newLeafCommit)).to.be.revertedWith("Reuse of nullifier");
    
                    expect(await pool.leafCount()).to.equal(3);
                    expect(await pool.root()).to.equal(lastTree.root);
                    expect(await token.balanceOf(pool.address)).to.equal( BigInt(poolBalance));
                    expect(await token.balanceOf(await owner.getAddress())).to.equal(BigInt(ownerBalance));
                } else {
                    await pool.connect(owner).withdraw(await owner.getAddress(), proofList, withdrawAmount, root, nullifier, newLeafCommit);
                    leafs.push(newLeaf);
                    commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
                    lastTree = Hush.buildTree(3, commits);
                    expect(await pool.leafCount()).to.equal(3);
                    expect(await pool.root()).to.equal(lastTree.root);
                    expect(await token.balanceOf(pool.address)).to.equal( BigInt(poolBalance) - BigInt(withdrawAmount));
                    expect(await token.balanceOf(await owner.getAddress())).to.equal(BigInt(ownerBalance) + BigInt(withdrawAmount));
                }
        
            }
        });
    
    */
});