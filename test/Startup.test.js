const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");


describe("Startup", function () {
  let startup;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    // 部署合约
    const Startup = await ethers.getContractFactory("Startup");

    /* 这样是部署普通合约，init函数不会被触发，会造成问题，虽然链上合约被正确部署，但是owner初始化没成功（因为init函数没有被触发
    startup = await Startup.deploy();
    await startup.deployed();
     */
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    //    console.log("Deploying contracts with the account:", deployer.address);

    startup = await upgrades.deployProxy(Startup, [], {
      initializer: 'initialize',
      kind: 'uups'
    });
    // await startup.deployed();
    await startup.waitForDeployment();
    console.log("Startup deployed to:", startup.address);

    // 获取测试账户
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    /*
    console.log("owner: ", owner.address)
    console.log("addr1: ", addr1.address)
    console.log("addr2: ", addr2.address)
    // 测试时候用
    throw new Error('合约部署结束', error);
     */
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const contractOwner = await startup.owner();// 等待Promise解析
      console.log("startup.owner(): ", contractOwner)
      expect(contractOwner).to.equal(owner.address);
    });
  });

  describe("Startup Creation", function () {
    it("Should create a new startup", async function () {
      let curName = "TestStartup" + (Math.floor(Math.random() * 100000) + 1)
      const profile = {
        name: curName,
        mode: 2, // NGO
        logo: "https://example.com/logo.png",
        mission: "Test mission",
        overview: "Test overview",
        isValidate: true
      };

      const tx = await startup.newStartup(profile);
      await tx.wait(); // 等待交易被确认

      const createdStartup = await startup.startups(curName);
      // console.log("now is ", createdStartup)
      expect(createdStartup.name).to.equal(curName);
      expect(createdStartup.mode).to.equal(2);
      expect(createdStartup.logo).to.equal("https://example.com/logo.png");
      expect(createdStartup.mission).to.equal("Test mission");
      expect(createdStartup.overview).to.equal("Test overview");
      expect(createdStartup.isValidate).to.equal(true);
    });

    it("Should not allow duplicate startup names", async function () {
      // 拼接字符串
      let curName = "TestStartup";
      const profile = {
        name: curName,
        mode: 2,
        logo: "https://example.com/logo.png",
        mission: "Test mission",
        overview: "Test overview",
        isValidate: true
      };

      const tx = await startup.newStartup(profile);
      await tx.wait(); // 等待交易被确认

      await expect(startup.newStartup(profile))
        .to.be.revertedWith("startup name has been used");
    });

    it("Should not allow empty startup names", async function () {
      const profile = {
        name: "",
        mode: 2,
        logo: "https://example.com/logo.png",
        mission: "Test mission",
        overview: "Test overview",
        isValidate: true
      };

      await expect(startup.newStartup(profile))
        .to.be.revertedWith("name can not be null");
    });
  });
}); 