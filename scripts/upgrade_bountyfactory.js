const { ethers, upgrades } = require("hardhat")

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("deployer: ", deployer.address)
  
  const proxyAddress = "0x95A687fb4e3D9D8A19bFDc7ba701D9CD47f7d71C"

  // const BountyFactoryV2 = await ethers.getContractFactory("BountyFactoryV2");
  // const newBountyFactory = await upgrades.upgradeProxy(proxyAddress, BountyFactoryV2);
  // await newBountyFactory.waitForDeployment();

  // const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  // console.log("New Impl Address:", newImplAddress);

  const bountyFactoryV2 = await ethers.getContractAt("BountyFactoryV2", proxyAddress);
  const value = await bountyFactoryV2.connect(deployer).newFunction();
  console.log("value:", value);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })