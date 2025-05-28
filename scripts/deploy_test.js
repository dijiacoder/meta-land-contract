const { ethers, upgrades } = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying contracts with the account:', deployer.address)
  // const token = await ethers.getContractFactory('TokenERC20')
  // const tokenContract = await token.deploy("10000000000000000000000", "LC-SC-001", "LC-SC-001")

  // console.log('Deploying contracts with the account:', tokenContract.deployTransaction.hash)
  // await tokenContract.deployed()

  // console.log('tokenContract address:', tokenContract.address)

  // const Startup = await ethers.getContractFactory("Startup")
  // const st = await Startup.deploy()
  // await st.deployed()
  // console.log(st.address)

  // const Proxy = upgrades.deployProxy(Startup, [], {
  //   kind: "uups",
  //   initializer: "initialize"
  // })

  // await Proxy.waitForDeployment()
  // console.log("proxy address: ", await Proxy.getAddress())

  const selector = ethers.utils.id("upgradeTo(address)").slice(0, 10);
  console.log(selector); // 0xa9059cbb
}


main()