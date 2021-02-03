import { task } from "hardhat/config"
import "@nomiclabs/hardhat-waffle";
import { HardhatUserConfig } from "hardhat/config";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
	const accounts = await hre.ethers.getSigners();
	for (const account of accounts) {
		console.log(account.address);
	}
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
	solidity: {
		compilers: [
			{
				version: "0.5.5"
			},
			{
				version: "0.6.12",
				settings: {
					optimizer: {
						enabled: true,
						runs: 1000
					}
				}
			},
			{
				version: "0.7.4",
				settings: {}
			}
		]
	},
/*	networks: {
		hardhat: {
			forking: {
				url: "https://mainnet.infura.io/v3/e76402c868ca42f0a2871cb64b9eb0ca"
			}
		}
	},*/
	mocha: {
		timeout: 60000
	}
};

const config: HardhatUserConfig = {

}

export default config;
