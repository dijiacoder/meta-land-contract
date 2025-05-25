const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Bounty", function () {
    let bountyFactory;
    let MockERC20;
    let mockToken;
    let deployer;
    let user1;
    let user2;
    let user3;
    let bounty;
    let bountyAddress;

    const APPLY_DEADLINE = Math.floor(Date.now() / 1000) + 3600;

    this.beforeAll(async function () {
        [deployer, founder, user1, user2, user3] = await ethers.getSigners();
        console.log("deployer address:", deployer.address);
        console.log("founder address:", founder.address);

        // 部署 Mock ERC20
        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockToken = await MockERC20.deploy("Mock Token", "MTK");
        await mockToken.deployed();

        // 部署 BountyFactory
        let BountyFactory = await ethers.getContractFactory("BountyFactory");
        bountyFactory = await upgrades.deployProxy(BountyFactory, [], {
            initializer: 'initialize',
            kind: 'uups'
        });

        await mockToken.mint(founder.address, ethers.utils.parseEther("10.0"));
        await mockToken.connect(founder).approve(bountyFactory.address, ethers.utils.parseEther("1.0"));
        const tx = await bountyFactory.connect(founder).createBounty(
            mockToken.address,
            ethers.utils.parseEther("1.0"),
            ethers.utils.parseEther("0.5"),
            APPLY_DEADLINE
        );
        const receipt = await tx.wait();
        const event = receipt.events.find(e => e.event === 'Created');

        bountyAddress = event.args.bounty;
        bounty = await ethers.getContractAt("Bounty", bountyAddress);
    });

    describe("初始化", function () {
        it("应该正确初始化合约", async function () {
            const parameters = await bounty.parameters();
            expect(parameters.depositToken).to.equal(mockToken.address);
            expect(parameters.founderDepositAmount).to.equal(ethers.utils.parseEther("1.0"));
            expect(parameters.applicantDepositMinAmount).to.equal(ethers.utils.parseEther("0.5"));
            expect(parameters.applyDeadline).to.equal(APPLY_DEADLINE);
        });

        it("不应该允许重复初始化", async function () {
            const parameters = await bounty.parameters();
            console.log("parameters:", parameters);
            await expect(bounty.init(parameters))
                .to.be.revertedWith("Store is not zero");
        });
    });

    describe.only("存款功能", function () {
        it("不能存入零金额", async function () {
            await expect(bounty.connect(founder).deposit(0))
                .to.be.revertedWith("Deposit amount is zero");
        });

        it("创始人能够存款", async function () {
            await mockToken.connect(founder).approve(bounty.address, ethers.utils.parseEther("1.0"));
            await expect(bounty.connect(founder).deposit(ethers.utils.parseEther("1.0")))
                .to.emit(bounty, "Deposit")
                .withArgs(founder.address, ethers.utils.parseEther("1.0"), ethers.utils.parseEther("2.0"));
        });

        it("非创始人不能存款", async function () {
            await mockToken.connect(user1).approve(bounty.address, ethers.utils.parseEther("1.0"));
            await expect(bounty.connect(user1).deposit(ethers.utils.parseEther("1.0")))
                .to.be.revertedWith("Caller is not the founder");
        });
    });

    //TODO
    describe("申请功能", function () {
        it("正常申请", async function () {
            await mockToken.mint(user1.address, ethers.utils.parseEther("1.0"));
            await mockToken.connect(user1).approve(bounty.address, ethers.utils.parseEther("1.0"));
            await expect(bounty.connect(user1).applyFor(ethers.utils.parseEther("0.6")))
                .to.emit(bounty, "Apply")
                .withArgs(user1.address, ethers.utils.parseEther("0.6"), ethers.utils.parseEther("0.6"), ethers.utils.parseEther("0.6"));
        });

        it("申请金额不能小于最小要求", async function () {
            await mockToken.mint(user1.address, ethers.utils.parseEther("1.0"));
            await mockToken.connect(user1).approve(bounty.address, ethers.utils.parseEther("1.0"));
            await expect(bounty.connect(user1).applyFor(ethers.utils.parseEther("0.4")))
                .to.be.revertedWith("Deposit amount less than limit");
        });

        it("不能在申请截止日期后申请", async function () {
            // 等待截止日期
            await ethers.provider.send("evm_increaseTime", [86400]); // 增加86400秒(1天)的区块链时间
            await ethers.provider.send("evm_mine"); //挖一个新块使时间变更生效

            await mockToken.mint(user1.address, ethers.utils.parseEther("1.0"));
            await mockToken.connect(user1).approve(bounty.address, ethers.utils.parseEther("1.0"));
            await expect(bounty.connect(user1).applyFor(ethers.utils.parseEther("0.6")))
                .to.be.revertedWith("Time past the application deadline");
        });
    });

    describe("审批功能", function () {
        beforeEach(async function () {
            // 设置一个申请人
            await mockToken.mint(user1.address, ethers.utils.parseEther("1.0"));
            await mockToken.connect(user1).approve(bounty.address, ethers.utils.parseEther("1.0"));
            await bounty.connect(user1).applyFor(ethers.utils.parseEther("0.5"));
        });

        it("创始人能设置审批申请人", async function () {
            await expect(bounty.approveApplicant(user1.address))
                .to.emit(bounty, "Approve")
                .withArgs(deployer.address, user1.address);
        });

        // it("非创始人不能审批", async function () {
        //     await expect(bounty.connect(applicant1).approveApplicant(applicant1.address))
        //         .to.be.revertedWith("Caller is not the founder");
        // });

        // it("不能审批未申请的地址", async function () {
        //     await expect(bounty.approveApplicant(applicant2.address))
        //         .to.be.revertedWith("To be approved must a applicant");
        // });
    });

    // describe("存款释放功能", function () {
    //     beforeEach(async function () {
    //         // 设置一个申请人并审批
    //         await mockToken.connect(applicant1).approve(bounty.address, APPLICANT_DEPOSIT);
    //         await bounty.connect(applicant1).applyFor(APPLICANT_DEPOSIT);
    //         await bounty.approveApplicant(applicant1.address);
    //     });

    //     it("申请人应该能够释放自己的存款", async function () {
    //         await expect(bounty.connect(applicant1).releaseMyDeposit())
    //             .to.emit(bounty, "ReleaseApplicantDeposit")
    //             .withArgs(applicant1.address, APPLICANT_DEPOSIT, 0, 0);
    //     });

    //     it("创始人应该能够释放所有存款", async function () {
    //         await expect(bounty.release())
    //             .to.emit(bounty, "ReleaseFounderDeposit")
    //             .withArgs(founder.address, FOUNDER_DEPOSIT, 0);
    //     });
    // });

    // describe("状态查询功能", function () {
    //     it("应该能够查询合约状态", async function () {
    //         const state = await bounty.state();
    //         expect(state[0]).to.equal(1); // ReadyToWork
    //         expect(state[1]).to.equal(0); // 申请人数量
    //         expect(state[3]).to.equal(FOUNDER_DEPOSIT); // 创始人存款
    //         expect(state[4]).to.equal(0); // 申请人存款
    //     });

    //     it("应该能够查询用户角色", async function () {
    //         const [role, amount, status] = await bounty.whoAmI();
    //         expect(role).to.equal(2); // Founder
    //         expect(amount).to.equal(FOUNDER_DEPOSIT);
    //     });
    // });
}); 