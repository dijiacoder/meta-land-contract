const { ethers } = require('hardhat')


async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying contracts with the account:', deployer.address)
  const Startup = await ethers.getContractFactory('BountyFactory')
  const bountyFactory = await Startup.deploy()

  console.log('Deploying contracts with the account:', bountyFactory.deployTransaction.hash)
  await bountyFactory.deployed()

  console.log('BountyFactory address:', bountyFactory.address)
}


main()