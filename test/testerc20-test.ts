import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";


describe("Tester ERC20", function () {

	let owner: Signer;
	let user: Signer;
	let user2: Signer;

	let getWei = (eth: string) => {
		return ethers.utils.parseEther(eth);
	};
	let getEth = (wei: BigNumber) => {
		return wei.div("1000000000000000000");
	};

	beforeEach(async function () {
		[owner, user, user2] = await ethers.getSigners();
	});

	it("Create coin and mint 10000", async function () {
		const TestERC = await ethers.getContractFactory("TestERC20", owner);

		const token = await TestERC.deploy("Tester", "tst");
		await token.deployed();

		await token.mint(await user.getAddress(), getWei("10000"));
		expect(await token.balanceOf(await user.getAddress())).to.equal(getWei("10000"));

		await token.connect(user).approve(await user2.getAddress(), getWei("5000"));
		expect(await token.allowance(await user.getAddress(), await user2.getAddress())).to.equal(getWei("5000"));

		await token.connect(user2).transferFrom(await user.getAddress(), await user2.getAddress(), getWei("1000"));
		expect(await token.balanceOf(await user.getAddress())).to.equal(getWei("9000"));
		expect(await token.balanceOf(await user2.getAddress())).to.equal(getWei("1000"));
	});



});
