const { ethers, upgrades } = require("hardhat");

async function main() {
    // 这里使用第一次部署得到的代理合约地址，而不是重新部署代理合约
    //const proxyAddress = 'YOUR_PROXY_CONTRACT_ADDRESS';
    const proxyAddress = '0xa8350afcE21cD92b1795Fc77c229786FF4B7b5D5';

    let implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Old implementation address:", implementationAddress);

    const [deployer] = await ethers.getSigners();
    console.log("upgrade with contracts using account:", deployer.address);

    // 假设新写的合约 还是原来的Startup，但实际上可以改名
    // const startupFactory = await ethers.getContractFactory('Startup');
    // const startupContract = await startupFactory.deploy()
    // await startupContract.deployed()
    // console.log("new impl: ", startupContract.address)

    // 获取逻辑合约的ABI
    // const proxyContract = await ethers.getContractFactory("Startup")
    // 连接代理合约
    // const proxyContractInstance = proxyContract.attach(proxyAddress)

    // let tx = await proxyContractSigner.upgradeToAndCall(startupContract.address, 0)
    // let tx = await proxyContractInstance.upgradeToAndCall("0xd734B56D5c8A25198b15F7F84a2f03EA44f7B071", "0x", { value:0 })
    // await tx.wait()
    // console.log("upgrade tx: ", tx)

    const newContract = await ethers.getContractFactory("Startup")
    const upgraded = await upgrades.upgradeProxy(proxyAddress, newContract, { call:"owner" });

    await upgraded.deployed();
    console.log('Contract upgraded');

    // 获取升级后的逻辑合约地址
    implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("new implementation address:", implementationAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 