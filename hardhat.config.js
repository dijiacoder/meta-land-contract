require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
require('solidity-coverage')

const infuraKey = "d8ed0bd1de8242d998a1405b6932ab33";

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      evmVersion: "shanghai",
      optimizer: {
        enabled: true,
        runs: 200, // 增加 runs 值以提高优化效果
      },
    },
    metadata: {
      bytecodeHash: 'none', // 禁用字节码哈希，加速编译速度
    }
  },
  networks: {
    sepolia: {
      allowUnlimitedContractSize: true,
      url: "https://sepolia.infura.io/v3/" + infuraKey,
      accounts: [
        "e6277f1f6d301bd3faf38e02f27f068b15abd3dc9f40a898112df9a287fbaef7",
      ],
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
};
