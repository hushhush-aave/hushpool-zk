import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";

import * as Hush from "./../zk-proofs/hush-withdraw/js/hush-js";

import { abi, bytecode } from "./../utils/mimc-util";

describe("ERC20 ZKPool", function () {
    let owner: Signer;
    let user: Signer;
    let user2: Signer;

    let addrString = "0xD81523Da11b9A55cB1b39f08bd59319E5143A910";
    let receiverAddr = BigInt(addrString);

    let getWei = (eth: string) => {
        return ethers.utils.parseEther(eth);
    };
    let getEth = (wei: BigNumber) => {
        return ethers.utils.formatUnits(wei, "ether");
    };

    let token: Contract;
    let pool: Contract;

    let depositAmount = BigInt(getWei("1000"));

    beforeEach(async function () {
        [owner, user, user2] = await ethers.getSigners();

        const MIMCLibrary = await ethers.getContractFactory(abi, bytecode, owner);
        let mimc = await MIMCLibrary.deploy();
        await mimc.deployed();

        const TestERC = await ethers.getContractFactory("TestERC20", owner);
        token = await TestERC.deploy("TesterERC20", "tst");
        await token.deployed();
        // console.log("Token deployed to: ", token.address);

        const ERCZKPool = await ethers.getContractFactory("ERCZKPool", {
            signer: owner,
            libraries: {
                MiMC: mimc.address
            }
        });

        pool = await ERCZKPool.deploy(3, token.address, depositAmount);
        await pool.deployed();
        // console.log("ERCZKPool deployed to: ", pool.address);
    });

    it("Multiple deposits, then same user withdraws multiple withdraws", async function () {
        // Mint 10000 tokens for user and user2
        await token.mint(await user.getAddress(), getWei("10000"));
        await token.mint(await user2.getAddress(), getWei("10000"));
        expect(await token.balanceOf(await user.getAddress())).to.equal(getWei("10000"));
        expect(await token.balanceOf(await user2.getAddress())).to.equal(getWei("10000"));

        // user and user2 approves the pool to spend their erc20
        await token.connect(user).approve(pool.address, depositAmount);
        await token.connect(user2).approve(pool.address, depositAmount);
        expect(await token.allowance(await user.getAddress(), pool.address)).to.equal(depositAmount);
        expect(await token.allowance(await user2.getAddress(), pool.address)).to.equal(depositAmount);

        // Now for the real testing. Let us build some commitments.
        let leafs = [];
        let commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        let emptyTree = Hush.buildTree(3, leafs);

        // Check that the pool holds no tokens and has an empty tree
        expect(await pool.root()).to.equal(emptyTree.root);
        expect(await token.balanceOf(pool.address)).to.equal(getWei("0"));

        // Create a note and have user deposit
        let firstNote = Hush.createLeaf(depositAmount);
        let firstInner = Hush.getInnerCommitmentFromLeaf(firstNote); 
        leafs.push(firstNote);
        commits = leafs.map(leaf => Hush.getCommitmentFromLeaf(leaf));
        let tree = Hush.buildTree(3, commits);

        await pool.connect(user).deposit(firstInner);
        expect(await pool.root()).to.equal(tree.root);
        expect(await token.balanceOf(pool.address)).to.equal(depositAmount);

        // Create a note and have user2 deposit
        let secondNote = Hush.createLeaf(depositAmount);
        let secondInner = Hush.getInnerCommitmentFromLeaf(secondNote);
        leafs.push(secondNote);
        commits = leafs.map(leaf => Hush.getCommitmentFromLeaf(leaf));
        tree = Hush.buildTree(3, commits);

        await pool.connect(user2).deposit(secondInner);
        expect(await pool.root()).to.equal(tree.root);
        expect(await token.balanceOf(pool.address)).to.equal(getWei("2000"));

        // Can we then make a withdraw here :O!
        // User withdraws his deposit and then withdraws from the change of that withdraw,
        // Example: 
        // Deposit 1000 aTokens
        // Withdraw 250 aTokens and pay 0.005 in fee from the deposit, change = 749.995
        // Withdraw 250 aTokens and pay 0.005 in fee from the change, newChange = 499.99
        for (let i = 0; i < 2; i++) {
            let index = leafs.length - 1;
            let note = leafs[index];

            let _withdrawAmount = BigInt(getWei("250"));
            let _fee = BigInt(getWei("0.005"));// BigInt(5);
            let removed = _fee + _withdrawAmount;

            // Generate the proof and inputs for solidity + the new note 
            let { solidityProof, soliditySignals, newLeaf: changeNote } = await Hush.getProof(note, index, tree, _withdrawAmount, _fee, receiverAddr);

            // Get balances before withdraw
            let poolBalance = await token.balanceOf(pool.address);
            let userBalance = await token.balanceOf(addrString);
            let ownerBalance = await token.balanceOf(await owner.getAddress());

            // Perform actual withdraw
            await pool.connect(owner).withdraw(addrString, solidityProof, soliditySignals);

            // Push changenote to list and build tree
            leafs.push(changeNote);
            commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
            tree = Hush.buildTree(3, commits);

            // Check that tree matches and that values are updated properly.
            expect(await pool.root()).to.equal(tree.root);
            expect(await pool.leafCount()).to.equal(3 + i);
            expect(await token.balanceOf(pool.address)).to.equal(BigInt(poolBalance) - removed);
            expect(await token.balanceOf(addrString)).to.equal(BigInt(userBalance) + _withdrawAmount);
            expect(await token.balanceOf(await owner.getAddress())).to.equal(BigInt(ownerBalance) + _fee);
        }
    });


    it("Withdraw (snarkmax - fee + 1) to force an overflow.", async function () {
        // Mint 10000 tokens for user and user2
        await token.mint(await user.getAddress(), getWei("10000"));
        await token.mint(await user2.getAddress(), getWei("10000"));
        expect(await token.balanceOf(await user.getAddress())).to.equal(getWei("10000"));
        expect(await token.balanceOf(await user2.getAddress())).to.equal(getWei("10000"));

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

    it("Relayer changes fee to increase profit", async function () {
        // Mint 10000 tokens for user and user2
        await token.mint(await user.getAddress(), getWei("10000"));
        await token.mint(await user2.getAddress(), getWei("10000"));
        expect(await token.balanceOf(await user.getAddress())).to.equal(getWei("10000"));
        expect(await token.balanceOf(await user2.getAddress())).to.equal(getWei("10000"));

        await token.connect(user).approve(pool.address, depositAmount);
        await token.connect(user2).approve(pool.address, depositAmount);
        expect(await token.allowance(await user.getAddress(), pool.address)).to.equal(depositAmount);
        expect(await token.allowance(await user2.getAddress(), pool.address)).to.equal(depositAmount);

        // Now for the real testing. Let us build some commitments.
        let leafs = [];
        let commits = leafs.map(leaf => Hush.getCommitmentFromLeaf(leaf));
        let emptyTree = Hush.buildTree(3, leafs);

        expect(await pool.root()).to.equal(emptyTree.root);
        expect(await token.balanceOf(pool.address)).to.equal(getWei("0"));

        // Initial deposit
        let firstNote = Hush.createLeaf(depositAmount);
        let firstInner = Hush.getInnerCommitmentFromLeaf(firstNote);
        leafs.push(firstNote);
        commits = leafs.map(leaf => Hush.getCommitmentFromLeaf(leaf));
        let tree = Hush.buildTree(3, commits);

        await pool.connect(user).deposit(firstInner);
        expect(await pool.root()).to.equal(tree.root);
        expect(await token.balanceOf(pool.address)).to.equal(depositAmount);

        // Can we then make a withdraw here :O!
        let index = leafs.length - 1;
        let note = leafs[index];

        let _withdrawAmount: bigint = BigInt(getWei("250"));
        let _fee: bigint = BigInt(getWei("0.005"));// BigInt(5);

        let { solidityProof, soliditySignals, newLeaf: changeNote } = await Hush.getProof(note, index, tree, _withdrawAmount, _fee, receiverAddr);

        // The actual withdraw
        let poolBalance = await token.balanceOf(pool.address);
        let userBalance = await token.balanceOf(addrString);
        let ownerBalance = await token.balanceOf(await owner.getAddress());

        // Try to extract double the fee
        soliditySignals[1] = _fee * BigInt(2);// BigInt(10);

        await expect(pool.connect(owner).withdraw(addrString, solidityProof, soliditySignals)).to.be.revertedWith("The proof is invalid");

        expect(await pool.root()).to.equal(tree.root);
        expect(await pool.leafCount()).to.equal(1);
        expect(await token.balanceOf(pool.address)).to.equal(BigInt(poolBalance));
        expect(await token.balanceOf(addrString)).to.equal(BigInt(userBalance));
        expect(await token.balanceOf(await owner.getAddress())).to.equal(BigInt(ownerBalance));
    });


    it("Multiple deposits, tries to doublespend", async function () {
        // Mint 10000 tokens for user and user2
        await token.mint(await user.getAddress(), getWei("10000"));
        await token.mint(await user2.getAddress(), getWei("10000"));
        expect(await token.balanceOf(await user.getAddress())).to.equal(getWei("10000"));
        expect(await token.balanceOf(await user2.getAddress())).to.equal(getWei("10000"));

        await token.connect(user).approve(pool.address, depositAmount);
        expect(await token.allowance(await user.getAddress(), pool.address)).to.equal(depositAmount);

        await token.connect(user2).approve(pool.address, depositAmount);
        expect(await token.allowance(await user2.getAddress(), pool.address)).to.equal(depositAmount);

        // Now for the real testing. Let us build some commitments.
        let leafs = [];
        let commits = leafs.map(leaf => Hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
        let emptyTree = Hush.buildTree(3, leafs);

        expect(await pool.root()).to.equal(emptyTree.root);
        expect(await token.balanceOf(pool.address)).to.equal(getWei("0"));

        // Initial deposit
        let firstNote = Hush.createLeaf(depositAmount);
        let firstInner = Hush.getInnerCommitmentFromLeaf(firstNote);//(firstNote.secret, firstNote.nonce);
        leafs.push(firstNote);
        commits = leafs.map(leaf => Hush.getCommitmentFromLeaf(leaf));//   (leaf.balance, leaf.secret, leaf.nonce));
        let tree = Hush.buildTree(3, commits);

        await pool.connect(user).deposit(firstInner);
        expect(await pool.root()).to.equal(tree.root);
        expect(await token.balanceOf(pool.address)).to.equal(depositAmount);

        // Second deposit
        let secondLeaf = Hush.createLeaf(depositAmount);
        let secondInner = Hush.getInnerCommitmentFromLeaf(secondLeaf);// (secondLeaf.secret, secondLeaf.nonce);
        leafs.push(secondLeaf);
        commits = leafs.map(leaf => Hush.getCommitmentFromLeaf(leaf));// (leaf.balance, leaf.secret, leaf.nonce));
        tree = Hush.buildTree(3, commits);

        await pool.connect(user2).deposit(secondInner);
        expect(await pool.root()).to.equal(tree.root);
        expect(await token.balanceOf(pool.address)).to.equal(getWei("2000"));

        // Can we then make a withdraw here :O!
        for (let i = 0; i < 2; i++) {
            let index = 1;
            let oldLeaf = leafs[index];

            let _withdrawAmount = BigInt(getWei("250"));//  BigInt(2500);
            let _fee = BigInt(getWei("0.5"));
            let removed = _fee + _withdrawAmount;

            let { solidityProof, soliditySignals, newLeaf } = await Hush.getProof(oldLeaf, index, tree, _withdrawAmount, _fee, receiverAddr);

            // The actual withdraw
            let poolBalance = await token.balanceOf(pool.address);
            let userBalance = await token.balanceOf(addrString);
            let ownerBalance = await token.balanceOf(await owner.getAddress());

            if (i == 1) { // This is the reuse.
                await expect(pool.connect(owner).withdraw(addrString, solidityProof, soliditySignals)).to.be.revertedWith("Reuse of nullifier");

                expect(await pool.root()).to.equal(tree.root);
                expect(await pool.leafCount()).to.equal(3);
                expect(await token.balanceOf(pool.address)).to.equal(BigInt(poolBalance));
                expect(await token.balanceOf(addrString)).to.equal(BigInt(userBalance));
                expect(await token.balanceOf(await owner.getAddress())).to.equal(BigInt(ownerBalance));
            } else {
                await pool.connect(owner).withdraw(addrString, solidityProof, soliditySignals);
                leafs.push(newLeaf);
                commits = leafs.map(leaf => Hush.getCommitmentFromLeaf(leaf));// (leaf.balance, leaf.secret, leaf.nonce));
                tree = Hush.buildTree(3, commits);
                expect(await pool.root()).to.equal(tree.root);
                expect(await pool.leafCount()).to.equal(3);
                expect(await token.balanceOf(pool.address)).to.equal(BigInt(poolBalance) - removed);
                expect(await token.balanceOf(addrString)).to.equal(BigInt(userBalance) + _withdrawAmount);
                expect(await token.balanceOf(await owner.getAddress())).to.equal(BigInt(ownerBalance) + _fee);
            }
        }
    });

});