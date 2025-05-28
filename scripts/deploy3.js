const { ethers } = require("hardhat");

const addressZero = "0x0000000000000000000000000000000000000000";
async function main() {
  const [deployer] = await ethers.getSigners();

  const CrowdfundingFactory = await ethers.getContractFactory(
    "CrowdfundingFactory"
  );
  const crowdfundingFactory = await CrowdfundingFactory.deploy(
    addressZero,
    addressZero,
    deployer.address
  );
  console.log("CrowdfundingFactory address:", crowdfundingFactory.address);
}

main();
