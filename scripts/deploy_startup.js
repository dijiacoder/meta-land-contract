const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const Startup = await ethers.getContractFactory("Startup");
    // 部署Startup可升级合约
    const startup = await upgrades.deployProxy(Startup, [], {
        initializer: 'initialize',
        kind: 'uups'
    });
    await startup.deployed();

    const proxy = await startup.address
    console.log("Startup deployed to(proxy contract):", proxy);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 