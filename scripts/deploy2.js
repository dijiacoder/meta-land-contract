const { ethers } = require('hardhat')


async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying contracts with the account:', deployer.address)
  const Startup = await ethers.getContractFactory('Startup')
  const StartupContract = await Startup.deploy()

  console.log('deployTransaction.hash:', StartupContract.deployTransaction.hash)
  await StartupContract.deployed()
  console.log('CrowdfundingFactory address:', StartupContract.address)
}


main()