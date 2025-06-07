const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");


describe("Bounty", function () {
    let BountyFactory, BountyBeacon, Bounty, BountyV2, FactoryStore, BountyStore;
    let owner, addr1, addr2, addr3;
    let bountyFactory, bountyFactoryProxy, bountyBeacon, bountyV1, bountyV2;
    let erc20A, erc20B;
    let provider;
    let ERC20Token;
    let erc20TokenAddress;

    beforeEach(async function () {
        FactoryStore = await ethers.getContractFactory("FactoryStore");
        BountyStore = await ethers.getContractFactory("BountyStore");
        BountyFactory = await ethers.getContractFactory("BountyFactory");
        BountyBeacon = await ethers.getContractFactory("BountyBeacon");
        Bounty = await ethers.getContractFactory("Bounty");
        BountyV2 = await ethers.getContractFactory("BountyV2");
        const ERC20 = await ethers.getContractFactory("TokenERC20");
        provider = ethers.provider;

        [owner, addr1, addr2, addr3] = await ethers.getSigners();

        const erc20ADeploy = await ERC20.deploy(ethers.utils.parseEther("1000"), "Test Token A", "TTA");
        await erc20ADeploy.deployed();
        erc20A = erc20ADeploy.address;
        const erc20BDeploy = await ERC20.deploy(ethers.utils.parseEther("1000"), "Test Token B", "TTB");
        await erc20BDeploy.deployed();
        erc20B = erc20BDeploy.address;
        // console.log("erc20 address: ", erc20A, erc20B)

        const bountyDeploy1 = await Bounty.deploy();
        await bountyDeploy1.deployed();
        bountyV1 = bountyDeploy1.address
        // console.log("bounty1 address: ", bountyDeploy1.address)

        const bountyDeploy2 = await BountyV2.deploy();
        await bountyDeploy2.deployed();
        bountyV2 = bountyDeploy2.address
        // console.log("bounty2 address: ", bountyDeploy2.address)

        bountyBeacon = await BountyBeacon.deploy(bountyV1);
        await bountyBeacon.deployed();
        bountyBeaconAddress = bountyBeacon.address;
        // console.log("bountyBeacon address: ", bountyBeaconAddress)

        const bountyFactoryProxyDeploy = await upgrades.deployProxy(BountyFactory, [bountyBeaconAddress], {
            initializer: 'initialize',
            kind: 'uups'
        })
        await bountyFactoryProxyDeploy.deployed()
        bountyFactoryProxy = bountyFactoryProxyDeploy.address
        // console.log("bountyFactoryProxy address: ", bountyFactoryProxyDeploy.address)

        // 使用逻辑合约ABI
        bountyFactory = await BountyFactory.attach(bountyFactoryProxy)

        // deploy ERC20Token
        const ERC20TokenFactory = await ethers.getContractFactory("ERC20Token");
        ERC20Token = await ERC20TokenFactory.deploy("ERC20Token", "TESTToken");
        await ERC20Token.deployed();
        erc20TokenAddress = ERC20Token.address;
        // console.log("ERC20Token address: ", erc20TokenAddress)
    });

    describe("BountyFactory", function () {
        it("Should initialize successfully", async function () {
            expect(await bountyFactory.bountyBeacon()).to.eq(bountyBeacon.address);

            const storeAddress = await bountyFactory.getStore();
            expect(storeAddress).to.not.eq(ethers.constants.AddressZero);

            const store = await FactoryStore.attach(storeAddress);
            expect(await store.owner()).to.eq(bountyFactoryProxy);

            await expect(store.push(addr1.address)).to.be.revertedWith("caller is not the owner account");
        });

        it("Should createBounty successfully", async function () {
            const block = await provider.getBlock('latest');

            await expect(bountyFactory.createBounty(erc20A, "1000", "1000", 1000)).to.be.revertedWith("Applicant cutoff date is expired");
            await expect(bountyFactory.createBounty(ethers.constants.AddressZero, "1000", "1000", block.timestamp + 1000, { value: "10" })).to.be.revertedWith("msg.value is not valid");

            const tx = await bountyFactory.createBounty(ethers.constants.AddressZero, "1000", "1000", block.timestamp + 1000, { value: "1000" })
            await tx.wait()

            const storeAddress = await bountyFactory.getStore();
            const store = await FactoryStore.attach(storeAddress);
            await expect(store.children()).to.be.revertedWith("caller is not the owner account");

            const storeByFactory = await FactoryStore.attach(storeAddress).connect(bountyFactoryProxy);
            expect(await storeByFactory.children()).to.be.an("array").have.lengthOf(1);
        });

        it("Should upgrade successfully", async function () {
            const oldImplAddress = await upgrades.erc1967.getImplementationAddress(bountyFactoryProxy);
            // console.log("old impl: ", implAddress)

            const oldStore = await bountyFactory.getStore();
            const oldBeacon = await bountyFactory.bountyBeacon();

            const newFactory = await BountyFactory.deploy();
            await newFactory.deployed();

            // await expect(await bountyFactory.connect(addr1).upgradeToAndCall(newFactory.address, '0x')).to.be.revertedWithCustomError(bountyFactory, "OwnableUnauthorizedAccount");

            const tx = await bountyFactory.upgradeToAndCall(newFactory.address, '0x');
            await tx.wait()

            const newImplAddress = await upgrades.erc1967.getImplementationAddress(bountyFactoryProxy);
            // console.log("new impl: ", implAddress)

            const newStore = await bountyFactory.getStore();
            const newBeacon = await bountyFactory.bountyBeacon();

            expect(oldImplAddress).to.not.eq(newImplAddress);
            expect(oldStore).to.eq(newStore);
            expect(oldBeacon).to.eq(newBeacon);
        });
    });

    describe("Use BountyFactory createBounty", function () {
        const founderDepositAmount = ethers.utils.parseEther("1.0");
        const applicantDepositAmount = ethers.utils.parseEther("0.1");

        it("Use ETH create bounty (_founderDepositAmount = 0)", async function () {
            const block = await provider.getBlock('latest');
            const applyDeadline = block.timestamp + 7 * 3600;
            const tx = await bountyFactory.connect(addr1).createBounty(
                ethers.constants.AddressZero,
                0,
                applicantDepositAmount,
                applyDeadline
            );

            const receipt = await tx.wait();
            const event = receipt.logs.map(log => {
                try {
                    return bountyFactory.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            }).find(e => e?.name === 'Created');

            expect(event).to.not.be.undefined;
            expect(event.args.founder).to.equal(addr1.address);
            // console.log("event.args.bounty:", event.args.bounty);
            expect(event.args.bounty).to.not.equal(ethers.constants.AddressZero);

            const children = await bountyFactory.children();
            expect(children.length).to.equal(1);
            expect(children[0]).to.equal(event.args.bounty);

            const isChild = await bountyFactory.connect(addr1).isChild(event.args.bounty);
            // console.log("isChild:", isChild);
            expect(isChild).to.equal(true);
        });

        it("Use ETH create bounty (_founderDepositAmount > 0)", async function () {
            const block = await provider.getBlock('latest');
            const applyDeadline = block.timestamp + 7 * 3600;
            const tx = await bountyFactory.connect(addr1).createBounty(
                ethers.constants.AddressZero,
                founderDepositAmount,
                applicantDepositAmount,
                applyDeadline,
                { value: founderDepositAmount }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.map(log => {
                try {
                    return bountyFactory.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            }).find(e => e?.name === 'Created');

            expect(event).to.not.be.undefined;
            expect(event.args.founder).to.equal(await addr1.getAddress());
            const bountyAddress = event.args.bounty;
            // console.log("bountyAddress:", bountyAddress);

            const bounty = await ethers.getContractAt("Bounty", bountyAddress);
            const vaultAddress = await bounty.connect(addr1).vaultAccount();
            // console.log("vaultAddress:", vaultAddress);
            const balance = await ethers.provider.getBalance(vaultAddress);
            // console.log("balance:", balance);
            expect(balance).to.equal(founderDepositAmount);
        });

        it("Use ERC20 create bounty", async function () {
            const block = await provider.getBlock('latest');
            const applyDeadline = block.timestamp + 7 * 3600;
            await ERC20Token.mint(addr1.address, founderDepositAmount);
            await ERC20Token.connect(addr1).approve(bountyFactory.address, founderDepositAmount);

            const tx = await bountyFactory.connect(addr1).createBounty(
                erc20TokenAddress,
                founderDepositAmount,
                applicantDepositAmount,
                applyDeadline
            );

            const receipt = await tx.wait();
            const event = receipt.logs.map(log => {
                try {
                    return bountyFactory.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            }).find(e => e?.name === 'Created');

            expect(event).to.not.be.undefined;
            expect(event.args.founder).to.equal(addr1.address);

            const bounty = await ethers.getContractAt("Bounty", event.args.bounty);
            const vaultAddress = await bounty.connect(owner).vaultAccount();
            // console.log("vaultAddress:", vaultAddress);
            const balance = await ERC20Token.connect(addr1).balanceOf(vaultAddress);
            // console.log("balance:", balance);
            expect(balance).to.equal(founderDepositAmount);
        });

        it("Should create failed (Applicant cutoff date is expired)", async function () {
            const block = await provider.getBlock('latest');
            const expiredDeadline = block.timestamp - 3600;
            await expect(bountyFactory.connect(addr1).createBounty(
                ethers.constants.AddressZero,
                0,
                applicantDepositAmount,
                expiredDeadline
            )).to.be.revertedWith("Applicant cutoff date is expired");
        });

        it("Should create failed (msg.value is not valid)", async function () {
            const block = await provider.getBlock('latest');
            const applyDeadline = block.timestamp + 7 * 3600;
            const founderDepositAmount2 = ethers.utils.parseEther("2.0");
            await expect(bountyFactory.connect(addr1).createBounty(
                ethers.constants.AddressZero,
                founderDepositAmount,
                applicantDepositAmount,
                applyDeadline,
                { value: founderDepositAmount2 }
            )).to.be.revertedWith("msg.value is not valid");
        });

        it("Should create failed (Deposit token balance is insufficient)", async function () {
            const block = await provider.getBlock('latest');
            const applyDeadline = block.timestamp + 7 * 3600;
            await ERC20Token.mint(addr2.address, ethers.utils.parseEther("0.5"));
            await ERC20Token.connect(addr2).approve(bountyFactory.address, ethers.utils.parseEther("0.5"));
            await expect(bountyFactory.connect(addr2).createBounty(
                erc20TokenAddress,
                ethers.utils.parseEther("1.0"),
                applicantDepositAmount,
                applyDeadline,
                { value: ethers.utils.parseEther("1.0") }
            )).to.be.revertedWith("Deposit token balance is insufficient");
        });

        it("Should create failed (Deposit token allowance is insufficient)", async function () {
            const block = await provider.getBlock('latest');
            const applyDeadline = block.timestamp + 7 * 3600;
            await ERC20Token.mint(addr2.address, ethers.utils.parseEther("1.0"));
            await ERC20Token.connect(addr2).approve(bountyFactory.address, ethers.utils.parseEther("0.5"));
            await expect(bountyFactory.connect(addr2).createBounty(
                erc20TokenAddress,
                ethers.utils.parseEther("1.0"),
                applicantDepositAmount,
                applyDeadline,
                { value: ethers.utils.parseEther("1.0") }
            )).to.be.revertedWith("Deposit token allowance is insufficient");
        });
    })

    describe("Bounty", function () {
        it("Should initialize successfully", async function () {
            const block = await provider.getBlock('latest');

            const tx = await bountyFactory.createBounty(ethers.constants.AddressZero, "1000", "1000", block.timestamp + 1000, { value: "1000" });
            await tx.wait();

            const children = await bountyFactory.children();
            const bountyProxy = children[0];
            const bounty = await Bounty.attach(bountyProxy);

            const params = await bounty.parameters();
            expect(params.depositToken).to.eq(ethers.constants.AddressZero);
            expect(params.depositTokenIsNative).to.eq(true);
            expect(params.founderDepositAmount).to.eq("1000");
            expect(params.applicantDepositMinAmount).to.eq("1000");
            expect(params.applyDeadline).to.eq(block.timestamp + 1000);
        });

        it("Should checking permission successfully", async function () {
            const block = await provider.getBlock('latest');

            const tx = await bountyFactory.createBounty(ethers.constants.AddressZero, "1000", "1000", block.timestamp + 1000, { value: "1000" });
            await tx.wait();

            const childrens = await bountyFactory.children();
            const bountyProxy = childrens[0];
            const bounty = await Bounty.attach(bountyProxy);

            await expect(bounty.connect(addr1).deposit("1000", { value: "1000" })).to.be.reverted;
            await bounty.deposit("1000", { value: "1000" });
        });

        it("Should upgrade successfully", async function () {
            const block = await provider.getBlock('latest');

            let tx = await bountyFactory.createBounty(ethers.constants.AddressZero, "1000", "1000", block.timestamp + 1000, { value: "1000" });
            await tx.wait();

            tx = await bountyFactory.createBounty(ethers.constants.AddressZero, "2000", "2000", block.timestamp + 2000, { value: "2000" });
            await tx.wait();

            const oldImpl = await bountyBeacon.implementation();
            // console.log("oldImpl: ", oldImpl);

            const childrens = await bountyFactory.children();
            const bountyProxy1 = childrens[0];
            const bountyProxy2 = childrens[1];

            const bounty1V1Ins = await Bounty.attach(bountyProxy1);
            const bounty2V1Ins = await Bounty.attach(bountyProxy2);

            expect('isUpgraded' in bounty1V1Ins.functions).to.be.false;
            expect('isUpgraded' in bounty2V1Ins.functions).to.be.false;

            await expect(bountyBeacon.connect(addr1).upgradeTo(bountyV2)).to.be.reverted;
            tx = await bountyBeacon.upgradeTo(bountyV2);
            await tx.wait();

            const newImpl = await bountyBeacon.implementation();
            // console.log("newImpl: ", newImpl);

            const bounty1V2Ins = await BountyV2.attach(bountyProxy1);
            const bounty2V2Ins = await BountyV2.attach(bountyProxy2);

            expect('isUpgraded' in bounty1V2Ins.functions).to.be.true;
            expect('isUpgraded' in bounty2V2Ins.functions).to.be.true;

            tx = await bounty1V2Ins.setUpgrade(100);
            await tx.wait();

            tx = await bounty2V2Ins.setUpgrade(1000);
            await tx.wait();

            expect(await bounty1V2Ins.isUpgraded()).to.eq(100);
            expect(await bounty2V2Ins.isUpgraded()).to.eq(1000);
        });
    });

    describe("Bounty ApplyFor with ETH", function () {

        let bounty;

        beforeEach(async function () {
            const block = await provider.getBlock('latest');
            const applyDeadline = block.timestamp + 7 * 3600;
            const founderDepositAmount = ethers.utils.parseEther("1.0");
            const applicantDepositAmount = ethers.utils.parseEther("1.0");
            const tx = await bountyFactory.connect(addr1).createBounty(
                ethers.constants.AddressZero,
                founderDepositAmount,
                applicantDepositAmount,
                applyDeadline,
                { value: founderDepositAmount }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.map(log => {
                try {
                    return bountyFactory.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            }).find(e => e?.name === 'Created');
            expect(event).to.not.be.undefined;
            expect(event.args.founder).to.equal(addr1.address);
            expect(event.args.bounty).to.not.equal(ethers.constants.AddressZero);
            const bountyAddress = event.args.bounty;
            // console.log("bountyAddress:", bountyAddress);
            bounty = await ethers.getContractAt("Bounty", bountyAddress);
        })

        it("Should apply for successfully (use ETH)", async function () {
            // addr2 applyFor
            const tx = await bounty.connect(addr2).applyFor(ethers.utils.parseEther("1.1"), { value: ethers.utils.parseEther("1.1") });
            const receipt = await tx.wait();
            const event = receipt.logs.map(log => {
                try {
                    return bounty.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            }).find(e => e?.name === 'Apply');

            expect(event).to.not.be.undefined;
            expect(event.args.applicant).to.equal(addr2.address);
            expect(event.args.amount).to.equal(ethers.utils.parseEther("1.1"));
            expect(event.args.balance).to.equal(ethers.utils.parseEther("1.1"));
            expect(event.args.applicantsBalance).to.equal(ethers.utils.parseEther("1.1"));

            // addr3 applyFor
            const tx2 = await bounty.connect(addr3).applyFor(ethers.utils.parseEther("1.2"), { value: ethers.utils.parseEther("1.2") });
            const receipt2 = await tx2.wait();
            const event2 = receipt2.logs.map(log => {
                try {
                    return bounty.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            }).find(e => e?.name === 'Apply');

            expect(event2).to.not.be.undefined;
            expect(event2.args.applicant).to.equal(addr3.address);
            expect(event2.args.amount).to.equal(ethers.utils.parseEther("1.2"));
            expect(event2.args.balance).to.equal(ethers.utils.parseEther("1.2"));
            expect(event2.args.applicantsBalance).to.equal(ethers.utils.parseEther("2.3"));

            const vaultAddress = await bounty.connect(owner).vaultAccount();
            const bountyStore = await ethers.getContractAt("BountyStore", vaultAddress);
            const [amount, status] = await bountyStore.connect(bounty.address).getApplicant(addr2.address);
            expect(amount).to.equal(ethers.utils.parseEther("1.1"));
            expect(status).to.equal(1);
            const [amount2, status2] = await bountyStore.connect(bounty.address).getApplicant(addr3.address);
            expect(amount2).to.equal(ethers.utils.parseEther("1.2"));
            expect(status2).to.equal(1);
        })

        it("Should applyFor failed (msg.value is not valid)", async function () {
            await expect(bounty.connect(addr2).applyFor(ethers.utils.parseEther("1.0"), { value: ethers.utils.parseEther("1.1") }))
                .to.be.revertedWith("msg.value is not valid");
        })

        it("Should applyFor failed (Deposit amount less than limit)", async function () {
            await expect(bounty.connect(addr2).applyFor(ethers.utils.parseEther("0.1"), { value: ethers.utils.parseEther("0.1") }))
                .to.be.revertedWith("Deposit amount less than limit");
        })
    });

    describe("Bounty ApplyFor with ERC20Token", function () {

        let bounty;

        beforeEach(async function () {

            await ERC20Token.mint(addr1.address, ethers.utils.parseEther("1.0"));
            await ERC20Token.connect(addr1).approve(bountyFactory.address, ethers.utils.parseEther("1.0"));

            const block = await provider.getBlock('latest');
            const applyDeadline = block.timestamp + 7 * 3600;
            const founderDepositAmount = ethers.utils.parseEther("1.0");
            const applicantDepositAmount = ethers.utils.parseEther("1.0");
            const tx = await bountyFactory.connect(addr1).createBounty(
                erc20TokenAddress,
                founderDepositAmount,
                applicantDepositAmount,
                applyDeadline,
                { value: founderDepositAmount }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.map(log => {
                try {
                    return bountyFactory.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            }).find(e => e?.name === 'Created');
            expect(event).to.not.be.undefined;
            expect(event.args.founder).to.equal(addr1.address);
            expect(event.args.bounty).to.not.equal(ethers.constants.AddressZero);
            const bountyAddress = event.args.bounty;
            // console.log("bountyAddress:", bountyAddress);
            bounty = await ethers.getContractAt("Bounty", bountyAddress);
        })

        it("Should apply for successfully (use ERC20Token)", async function () {
            // addr2 applyFor
            await ERC20Token.mint(addr2.address, ethers.utils.parseEther("1.0"));
            await ERC20Token.connect(addr2).approve(bounty.address, ethers.utils.parseEther("1.0"));
            
            const tx = await bounty.connect(addr2).applyFor(ethers.utils.parseEther("1.0"), { value: ethers.utils.parseEther("1.0") });
            const receipt = await tx.wait();
            const event = receipt.logs.map(log => {
                try {
                    return bounty.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            }).find(e => e?.name === 'Apply');

            expect(event).to.not.be.undefined;
            expect(event.args.applicant).to.equal(addr2.address);
            expect(event.args.amount).to.equal(ethers.utils.parseEther("1.0"));
            expect(event.args.balance).to.equal(ethers.utils.parseEther("1.0"));
            expect(event.args.applicantsBalance).to.equal(ethers.utils.parseEther("1.0"));
        })

        it("Should applyFor failed (Your deposit token allowance is insufficient)", async function () {
            await ERC20Token.mint(addr2.address, ethers.utils.parseEther("1.0"));
            await ERC20Token.connect(addr2).approve(bounty.address, ethers.utils.parseEther("0.5"));
            await expect(bounty.connect(addr2).applyFor(ethers.utils.parseEther("1.0"), { value: ethers.utils.parseEther("1.0") }))
                .to.be.revertedWith("Your deposit token allowance is insufficient");
        })

        it("Should applyFor failed (Your deposit token balance is insufficient)", async function () {
            await ERC20Token.mint(addr2.address, ethers.utils.parseEther("0.9"));
            await ERC20Token.connect(addr2).approve(bounty.address, ethers.utils.parseEther("1.0"));
            await expect(bounty.connect(addr2).applyFor(ethers.utils.parseEther("1.0"), { value: ethers.utils.parseEther("1.0") }))
                .to.be.revertedWith("Your deposit token balance is insufficient");
        })
    });
});