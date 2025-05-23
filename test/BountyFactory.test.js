const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe.only("BountyFactory", function () {
    let BountyFactory;
    let bountyFactory;
    let MockERC20;
    let mockToken;
    let deployer;
    let addr1;
    let addr2;
    let proxyAddress;
    let implementationAddress;

    beforeEach(async function () {
        [deployer, addr1, addr2] = await ethers.getSigners();

        // Mock ERC20 Token
        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockToken = await MockERC20.deploy("Mock Token", "MTK");
        await mockToken.deployed();

        BountyFactory = await ethers.getContractFactory("BountyFactory");
        bountyFactory = await upgrades.deployProxy(BountyFactory, [], {
            initializer: 'initialize',
            kind: 'uups'
        });

        proxyAddress = bountyFactory.address;
        implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    });

    describe("initialize", function () {
        it("should correctly initialize the contract", async function () {
            expect(await bountyFactory.owner()).to.equal(deployer.address);
            expect(await bountyFactory.store()).to.not.equal(ethers.constants.AddressZero);
        });

        it("should not allow duplicate initialization", async function () {
            await expect(bountyFactory.initialize())
                .to.be.revertedWith("Initializable: contract is already initialized");
        });
    });

    describe("createBounty", function () {
        const applyDeadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        const founderDepositAmount = ethers.utils.parseEther("1.0");
        const applicantDepositAmount = ethers.utils.parseEther("0.1");

        it("使用ETH Create Bounty, _founderDepositAmount = 0", async function () {
            const tx = await bountyFactory.createBounty(
                ethers.constants.AddressZero,
                0,
                applicantDepositAmount,
                applyDeadline
            );

            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === 'Created');
            
            expect(event).to.not.be.undefined;
            expect(event.args.founder).to.equal(deployer.address);
            console.log("event.args.bounty:", event.args.bounty);
            expect(event.args.bounty).to.not.equal(ethers.constants.AddressZero);
            
            const children = await bountyFactory.children();
            expect(children.length).to.equal(1);
            expect(children[0]).to.equal(event.args.bounty);
        });

        it("使用ETH Create Bounty, _founderDepositAmount != 0", async function () {
            const tx = await bountyFactory.createBounty(
                ethers.constants.AddressZero,
                founderDepositAmount,
                applicantDepositAmount,
                applyDeadline,
                { value: founderDepositAmount }
            );

            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === 'Created');
            
            expect(event).to.not.be.undefined;
            expect(event.args.founder).to.equal(deployer.address);
            
            const bounty = await ethers.getContractAt("Bounty", event.args.bounty);
            const vaultAddress = await bounty.vaultAccount();
            console.log("vaultAddress:", vaultAddress);
            const balance = await ethers.provider.getBalance(vaultAddress);
            console.log("balance:", balance);
            expect(balance).to.equal(founderDepositAmount);
        });

        it("使用ERC20 create Bounty", async function () {

            await mockToken.mint(deployer.address, founderDepositAmount);
            await mockToken.approve(bountyFactory.address, founderDepositAmount);

            const tx = await bountyFactory.createBounty(
                mockToken.address,
                founderDepositAmount,
                applicantDepositAmount,
                applyDeadline
            );

            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === 'Created');
            
            expect(event).to.not.be.undefined;
            expect(event.args.founder).to.equal(deployer.address);
            
            const bounty = await ethers.getContractAt("Bounty", event.args.bounty);
            const vaultAddress = await bounty.vaultAccount();
            console.log("vaultAddress:", vaultAddress);
            const balance = await mockToken.balanceOf(vaultAddress);
            console.log("balance:", balance);
            expect(balance).to.equal(founderDepositAmount);
        });

        it("时间过期, 不允许 Create Bounty", async function () {
            const expiredDeadline = Math.floor(Date.now() / 1000) - 3600; // 1小时前
            
            await expect(bountyFactory.createBounty(
                ethers.constants.AddressZero,
                founderDepositAmount,
                applicantDepositAmount,
                expiredDeadline,
                { value: founderDepositAmount }
            )).to.be.revertedWith("Applicant cutoff date is expired");
        });

        it("ETH余额不足, 不允许 Create Bounty", async function () {
            const largeAmount = ethers.utils.parseEther("1000000.0"); // 一个很大的金额
            
            await expect(bountyFactory.createBounty(
                ethers.constants.AddressZero,
                largeAmount,
                applicantDepositAmount,
                applyDeadline,
                { value: founderDepositAmount } // 发送的金额小于要求金额
            )).to.be.revertedWith("msg.value is not valid");
        });

        it("ERC20余额不足, 不允许 Create Bounty", async function () {
            const largeAmount = ethers.utils.parseEther("1000000.0"); // 一个很大的金额
            
            await expect(bountyFactory.createBounty(
                mockToken.address,
                largeAmount,
                applicantDepositAmount,
                applyDeadline
            )).to.be.revertedWith("Deposit token balance is insufficient");
        });

        it("ERC20未授权, 不允许 Create Bounty", async function () {
 
            await mockToken.mint(deployer.address, founderDepositAmount);
            
            await expect(bountyFactory.createBounty(
                mockToken.address,
                founderDepositAmount,
                applicantDepositAmount,
                applyDeadline
            )).to.be.revertedWith("Deposit token allowance is insufficient");
        });
    });
});