const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { AddressZero } = ethers;

describe("BountyFactory", function () {
    let BountyFactory;
    let bountyFactory;
    let MockERC20;
    let mockToken;
    let deployer;
    let owner;
    let addr1;
    let addr2;
    let proxyAddress;
    let implementationAddress;

    this.beforeEach(async function () {
        [deployer, owner, addr1, addr2] = await ethers.getSigners();
        // console.log("deployer:", await deployer.getAddress());
        // console.log("owner:", await owner.getAddress());
        // console.log("addr1:", await addr1.getAddress());
        // console.log("addr2:", await addr2.getAddress());

        // Mock ERC20 Token
        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockToken = await MockERC20.deploy("Mock Token", "MTK");
        mockTokenAddress = await mockToken.getAddress();
        // console.log("mockTokenAddress:", mockTokenAddress);

        BountyFactory = await ethers.getContractFactory("BountyFactory");
        bountyFactory = await upgrades.deployProxy(BountyFactory, [], {
            initializer: 'initialize',
            kind: 'uups'
        });
        await bountyFactory.waitForDeployment();

        proxyAddress = await bountyFactory.getAddress();
        // console.log("proxyAddress:", proxyAddress);
        implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        // console.log("implementationAddress:", implementationAddress);
    });

    describe("initialize", function () {
        it("should correctly initialize the contract", async function () {
            expect(await bountyFactory.owner()).to.equal(await deployer.getAddress());
            expect(await bountyFactory.store()).to.not.equal(ethers.ZeroAddress);
        });

        it("should not allow duplicate initialization", async function () {
            await expect(bountyFactory.initialize())
                .to.be.revertedWithCustomError(bountyFactory, "InvalidInitialization");
        });
    });

    describe("createBounty", function () {
        const applyDeadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        const founderDepositAmount = ethers.parseEther("1.0");
        const applicantDepositAmount = ethers.parseEther("0.1");

        it("使用ETH Create Bounty, _founderDepositAmount = 0", async function () {
            const tx = await bountyFactory.connect(owner).createBounty(
                ethers.ZeroAddress,
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
            expect(event.args.founder).to.equal(owner.address);
            console.log("event.args.bounty:", event.args.bounty);
            expect(event.args.bounty).to.not.equal(ethers.ZeroAddress);

            const children = await bountyFactory.children();
            expect(children.length).to.equal(1);
            expect(children[0]).to.equal(event.args.bounty);
        });

        it("使用ETH Create Bounty, _founderDepositAmount != 0", async function () {
            const tx = await bountyFactory.connect(owner).createBounty(
                ethers.ZeroAddress,
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
            expect(event.args.founder).to.equal(await owner.getAddress());
            const bountyAddress = event.args.bounty;
            console.log("bountyAddress:", bountyAddress);

            const bounty = await ethers.getContractAt("Bounty", bountyAddress);
            const vaultAddress = await bounty.connect(owner).vaultAccount();
            console.log("vaultAddress:", vaultAddress);
            const balance = await ethers.provider.getBalance(vaultAddress);
            console.log("balance:", balance);
            expect(balance).to.equal(founderDepositAmount);
        });

        it("使用ERC20 create Bounty", async function () {

            await mockToken.mint(await owner.getAddress(), founderDepositAmount);
            await mockToken.connect(owner).approve(await bountyFactory.getAddress(), founderDepositAmount);
            const tokenAddress = await mockToken.getAddress();
            console.log("Mock Token Address:", tokenAddress);

            const tx = await bountyFactory.connect(owner).createBounty(
                tokenAddress,
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
            expect(event.args.founder).to.equal(owner.address);

            const bounty = await ethers.getContractAt("Bounty", event.args.bounty);
            const vaultAddress = await bounty.connect(owner).vaultAccount();
            console.log("vaultAddress:", vaultAddress);
            const balance = await mockToken.connect(owner).balanceOf(vaultAddress);
            console.log("balance:", balance);
            expect(balance).to.equal(founderDepositAmount);
        });

        it("时间过期, 不允许 Create Bounty", async function () {
            const expiredDeadline = Math.floor(Date.now() / 1000) - 3600; // 1小时前

            await expect(bountyFactory.connect(owner).createBounty(
                ethers.ZeroAddress,
                founderDepositAmount,
                applicantDepositAmount,
                expiredDeadline,
                { value: founderDepositAmount }
            )).to.be.revertedWith("Applicant cutoff date is expired");
        });

        it("ETH余额不足, 不允许 Create Bounty", async function () {
            const largeAmount = ethers.parseEther("1000000.0"); // 一个很大的金额

            await expect(bountyFactory.connect(owner).createBounty(
                ethers.ZeroAddress,
                largeAmount,
                applicantDepositAmount,
                applyDeadline,
                { value: founderDepositAmount } // 发送的金额小于要求金额
            )).to.be.revertedWith("msg.value is not valid");
        });

        it("ERC20余额不足, 不允许 Create Bounty", async function () {
            const largeAmount = ethers.parseEther("1000000.0"); // 一个很大的金额

            await expect(bountyFactory.connect(owner).createBounty(
                await mockToken.getAddress(),
                largeAmount,
                applicantDepositAmount,
                applyDeadline
            )).to.be.revertedWith("Deposit token balance is insufficient");
        });

        it("ERC20未授权, 不允许 Create Bounty", async function () {

            await mockToken.mint(owner.address, founderDepositAmount);

            await expect(bountyFactory.connect(owner).createBounty(
                await mockToken.getAddress(),
                founderDepositAmount,
                applicantDepositAmount,
                applyDeadline
            )).to.be.revertedWith("Deposit token allowance is insufficient");
        });
    });

    const applyDeadline = Math.floor(Date.now() / 1000) + 3600;
    const founderDepositAmount = ethers.parseEther("1.0");
    const applicantDepositAmount = ethers.parseEther("0.1");

    describe("children() test", function () {

        it("children() is empty", async function () {
            const children = await bountyFactory.connect(owner).children();
            expect(children).to.be.an('array');
            expect(children.length).to.equal(0);
        });

        it("create one bounty", async function () {
            await mockToken.mint(await owner.getAddress(), founderDepositAmount);
            await mockToken.connect(owner).approve(await bountyFactory.getAddress(), founderDepositAmount);

            const tx = await bountyFactory.connect(owner).createBounty(
                await mockToken.getAddress(),
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

            const expectedBountyAddress = event.args.bounty;
            console.log("expectedBountyAddress:", expectedBountyAddress);

            const children = await bountyFactory.connect(owner).children();
            console.log("children:", children);

            expect(children).to.be.an('array');
            expect(children.length).to.equal(1);
            expect(children[0]).to.equal(expectedBountyAddress);

            const bounty = await ethers.getContractAt("Bounty", children[0]);
            expect(await bounty.getAddress()).to.equal(expectedBountyAddress);
        });
    });

    describe("isChild() test", function () {
        it("isChild() is empty", async function () {
            const isChild = await bountyFactory.connect(owner).isChild(ethers.ZeroAddress);
            console.log("isChild:", isChild);
            expect(isChild).to.equal(false);
        });

        it("isChild() is not empty", async function () {

            await mockToken.mint(await owner.getAddress(), founderDepositAmount);
            await mockToken.connect(owner).approve(await bountyFactory.getAddress(), founderDepositAmount);

            const tx = await bountyFactory.connect(owner).createBounty(
                await mockToken.getAddress(),
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
            const bountyAddress = event.args.bounty;

            const isChild = await bountyFactory.connect(owner).isChild(bountyAddress);
            console.log("isChild:", isChild);
            expect(isChild).to.equal(true);
        });
    })

    describe("Upgrade tests", function () {
        it("should upgrade", async function () {
            const oldImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
            console.log("Old Impl Address:", oldImplAddress);
            // 部署新版本
            const BountyFactoryV2 = await ethers.getContractFactory("BountyFactoryV2");
            const newBountyFactory = await upgrades.upgradeProxy(proxyAddress, BountyFactoryV2);
            await newBountyFactory.waitForDeployment();

            // 获取新实现地址
            const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
            console.log("New Impl Address:", newImplAddress);

            const newProxyAddress = await newBountyFactory.getAddress();

            // 验证代理地址没有改变
            expect(newProxyAddress).to.equal(proxyAddress);

            // 验证实现地址已更新
            expect(newImplAddress).to.not.equal(oldImplAddress);

            // 测试新功能
            const newValue = await newBountyFactory.newFunction();
            console.log("newValue:", newValue);
            expect(newValue).to.equal("TEST");
        });
    });
});