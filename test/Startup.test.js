const { expect } = require("chai");
const { ethers } = require("hardhat");
const { upgrades } = require("hardhat");

describe.only("Startup", function () {
    let Startup;
    let startupProxy;
    let deployer;
    let addr1;
    let addr2;
    let implementationAddress;
    let proxyAddress;

    beforeEach(async function () {
        // get test account
        [deployer, addr1, addr2] = await ethers.getSigners();
        // console.log("deployer:", deployer.address);

        // deploy implementation contract
        Startup = await ethers.getContractFactory("Startup");
        startupProxy = await upgrades.deployProxy(Startup, [], {
            initializer: 'initialize',
            kind: 'uups'
        });

        // get proxy address
        proxyAddress = startupProxy.address;
        // console.log("proxy contract address:", proxyAddress);

        // get implementation address
        implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        // console.log("implementation contract address:", implementationAddress);
    });

    describe("initialize", function () {
        it("should correctly initialize the contract", async function () {
            expect(await startupProxy.owner()).to.equal(deployer.address);
        });

        it("should not allow duplicate initialization", async function () {
            await expect(startupProxy.initialize())
                .to.be.revertedWith("Initializable: contract is already initialized");
        });
    });

    describe("new Startup", function () {
        const testProfile = {
            name: "TestStartup",
            mode: 1, // ESG
            logo: "https://example.com/logo.png",
            mission: "Test Mission",
            overview: "Test Overview",
            isValidate: false
        };

        it("should successfully create Startup", async function () {
            await expect(startupProxy.newStartup(testProfile))
                .to.emit(startupProxy, "created")
                .withArgs(
                    testProfile.name,
                    [
                        testProfile.name,
                        testProfile.mode,
                        testProfile.logo,
                        testProfile.mission,
                        testProfile.overview,
                        testProfile.isValidate
                    ],
                    deployer.address
                );

            const createdStartup = await startupProxy.startups(testProfile.name);
            expect(createdStartup.name).to.equal(testProfile.name);
            expect(createdStartup.mode).to.equal(testProfile.mode);
            expect(createdStartup.isValidate).to.equal(false);
        });

        it("should not allow creating a Startup with the same name", async function () {
            startupProxy.newStartup(testProfile)
            await expect(
                startupProxy.newStartup(testProfile)
            ).to.be.revertedWith("startup name has been used");
        });

        it("should not allow creating a Startup with an empty name", async function () {
            const emptyNameProfile = { ...testProfile, name: "" };
            await expect(startupProxy.newStartup(emptyNameProfile))
                .to.be.revertedWith("name can not be null");
        });

        it("should support all Mode types", async function () {
            const modes = [1, 2, 3, 4]; // ESG, NGO, DAO, COM
            for (const mode of modes) {
                const profile = { ...testProfile, name: `TestStartup${mode}` };
                profile.mode = mode;
                await expect(startupProxy.newStartup(profile))
                    .to.emit(startupProxy, "created")
                    .withArgs(profile.name, [
                        profile.name,
                        profile.mode,
                        profile.logo,
                        profile.mission,
                        profile.overview,
                        profile.isValidate
                    ], deployer.address);
            }
        });
    });

    describe("ownership management", function () {
        it("should transfer ownership", async function () {
            await expect(startupProxy.transferOwnership(addr1.address))
                .to.emit(startupProxy, "OwnershipTransferred")
                .withArgs(deployer.address, addr1.address);

            expect(await startupProxy.owner()).to.equal(addr1.address);
        });

        // it("should not allow transferring ownership to a non-owner", async function () {
        //     await expect(startupProxy.connect(addr1).transferOwnership(addr2.address))
        //         .to.be.revertedWith("Ownable: caller is not the owner");
        // });

        it("should not allow transferring ownership to a zero address", async function () {
            await expect(startupProxy.transferOwnership(ethers.constants.AddressZero))
                .to.be.revertedWith("Ownable: new owner is the zero address");
        });
    });

    // describe("升级功能", function () {
    //     it("应该能升级到新版本", async function () {
    //         const StartupV2 = await ethers.getContractFactory("Startup_v2");
    //         await upgrades.upgradeProxy(proxyAddress, StartupV2);

    //         // 验证升级后的合约地址
    //         const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    //         expect(newImplementationAddress).to.not.equal(implementationAddress);
    //     });

    //     it("只有所有者能升级合约", async function () {
    //         const StartupV2 = await ethers.getContractFactory("Startup_v2");
    //         await expect(upgrades.upgradeProxy(proxyAddress, StartupV2.connect(addr1)))
    //             .to.be.revertedWith("Ownable: caller is not the owner");
    //     });
    // });

    // describe("防重入保护", function () {
    //     it("应该防止重入攻击", async function () {
    //         const MaliciousContract = await ethers.getContractFactory("MaliciousContract");
    //         const maliciousContract = await MaliciousContract.deploy(startupProxy.address);
    //         await maliciousContract.deployed();

    //         const testProfile = {
    //             name: "TestStartup",
    //             mode: 1,
    //             logo: "https://example.com/logo.png",
    //             mission: "Test Mission",
    //             overview: "Test Overview",
    //             isValidate: false
    //         };

    //         await expect(maliciousContract.attack(testProfile))
    //             .to.be.revertedWith("ReentrancyGuard: reentrant call");
    //     });
    // });
}); 