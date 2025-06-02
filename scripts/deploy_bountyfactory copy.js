const { ethers, upgrades } = require("hardhat")

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("deployer: ", deployer.address)

  MockERC20 = await ethers.getContractFactory("MockERC20");
  mockToken = await MockERC20.deploy("Mock Token", "MTK");
  mockTokenAddress = await mockToken.getAddress();
  console.log("mockTokenAddress:", mockTokenAddress);

  BountyFactory = await ethers.getContractFactory("BountyFactory");
  bountyFactory = await upgrades.deployProxy(BountyFactory, [], {
      initializer: 'initialize',
      kind: 'uups'
  });
  await bountyFactory.waitForDeployment();

  proxyAddress = await bountyFactory.getAddress();
  console.log("proxyAddress:", proxyAddress);
  implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("implementationAddress:", implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })