require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-toolbox");
require('hardhat-abi-exporter');

// 配置参考 .env.example里的，换成自己真实的，放到.env里就可以了
// config
const { config: dotenvConfig } = require("dotenv")
const { resolve } = require("path")
dotenvConfig({ path: resolve(__dirname, "./.env") })

const SEPOLIA_PK_ONE = process.env.SEPOLIA_PK_ONE
const SEPOLIA_PK_TWO = process.env.SEPOLIA_PK_TWO
const SEPOLIA_PK_THREE = process.env.SEPOLIA_PK_THREE
if (!SEPOLIA_PK_ONE) {
  throw new Error("Please set at least one private key in a .env file")
}
if (!SEPOLIA_PK_TWO) {
  throw new Error("Please set two private key in a .env file, in case of interact.js not working...")
}
if (!SEPOLIA_PK_THREE) {
  throw new Error("Please set three private key in a .env file, in case of interact.js not working...")
}

const MAINNET_PK = process.env.MAINNET_PK
const MAINNET_ALCHEMY_AK = process.env.MAINNET_ALCHEMY_AK

const SEPOLIA_ALCHEMY_AK = process.env.SEPOLIA_ALCHEMY_AK
if (!SEPOLIA_ALCHEMY_AK) {
  throw new Error("Please set your SEPOLIA_ALCHEMY_AK in a .env file")
}

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      evmVersion: "shanghai",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // 启用中间表示优化
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    // mainnet: {
    //   url: `https://eth-mainnet.g.alchemy.com/v2/${MAINNET_ALCHEMY_AK}`,
    //   accounts: [`${MAINNET_PK}`],
    //   saveDeployments: true,
    //   chainId: 1,
    // },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${SEPOLIA_ALCHEMY_AK}`,
      accounts: [`${SEPOLIA_PK_ONE}`, `${SEPOLIA_PK_TWO}`, `${SEPOLIA_PK_THREE}`],
      chainId: 11155111,
    },
  },
  abiExporter: {
    path: './abi',  // 导出路径
    clear: true,    // 每次编译前清空目录
    flat: true,     // 扁平化输出（不创建子目录）
  },
  etherscan: {
    apiKey: ""
  }
};
