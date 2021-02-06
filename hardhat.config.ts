import { task } from "hardhat/config"
import "@nomiclabs/hardhat-waffle";
import { HardhatUserConfig } from "hardhat/config";
import * as Config from "./config";



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

const INFURA_PROJECT_ID = Config.INFURA_PROJECT_ID;
const KOVAN_PRIVATE_KEY = Config.KOVAN_PRIVATE_KEY;
const KOVAN_PRIVATE_KEY_USER = Config.KOVAN_PRIVATE_KEY_USER;
const KOVAN_PRIVATE_KEY_USER2 = Config.KOVAN_PRIVATE_KEY_USER2;

const mnemonic = 'test test test test test test test test test test test junk'
const accounts = {
	mnemonic,
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
	namedAccounts: {
		deployer: {
			default: 0,
			1: 0,
			"kovan": 0,
		},
		collector: {
			default: 1,
			1: 1,
		}
	},
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
	networks: {
		localhost: {
			live: false,
			saveDeployments: true,
			tags: ["local"],
			accounts,
		},
		hardhat: {
			live: false,
			saveDeployments: true,
			tags: ["test", "local"],
			accounts,
			/*forking: {
				url:  `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`
			}*/
		},
		kovan: {
			url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
			//accounts,
			accounts: [`0x${KOVAN_PRIVATE_KEY}`, `0x${KOVAN_PRIVATE_KEY_USER}`, `0x${KOVAN_PRIVATE_KEY_USER2}`],
			live: true,
			saveDeployments: true,
			tags: ["staging"]
		}
	},
	mocha: {
		timeout: 600000
	}
};

const config: HardhatUserConfig = {

}

export default config;
