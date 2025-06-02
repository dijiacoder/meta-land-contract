const { ethers } = require("hardhat");

async function main() {
  const address = "0x3591069494E3c11e6C488C6d36b4B3779Fde422B";

  const BountyFactory = await ethers.getContractAt("BountyFactory", address);

//   console.log(BountyFactory.createBounty, ethers.utils,);
  

  const tx = await BountyFactory.createBounty(
    '0x0000000000000000000000000000000000000000',
    // ethers.utils.parseEther("0.01"),
    0,
    ethers.parseEther("0.1"),
    Date.now() + 10000000000000,
    // {
    //   value: ethers.utils.parseEther("0.01"),
    // }
  );

  console.log(tx);
// '0x749406bDF11DE48901CCDC4cfa928e10cE730b1F'
const bounty = await BountyFactory.children()

console.log(bounty);

  // BountyFactory.
}

main();
