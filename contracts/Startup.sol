// SPDX-License-Identifier: SimPL-2.0
pragma solidity ^0.8.0;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

// 逻辑合约, 这个合约末尾有升级函数
contract Startup is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    enum Mode {
        NONE,
        ESG,
        NGO,
        DAO,
        COM
    }

    struct wallet {
        string name;
        address walletAddress;
    }

    struct Profile {
        /** startup name */
        string name;
        /** startup type */
        Mode mode;
        /** startup hash */
        // string[] hashtag;
        /** startup logo src */
        string logo;
        /** startup mission */
        string mission;
        /** startup token contract */
        // address tokenContract;
        /** startup compose wallet */
        // wallet[] wallets;
        string overview;
        /** is validate the startup name is only */
        bool isValidate;
    }

    event created(string name, Profile startUp, address msg);

    //public name mappong to startup
    mapping(string => Profile) public startups;

    // for web front, ["zehui",1,"avatar","mission","overview",true]
    function newStartup(Profile calldata p) public payable nonReentrant {
        // require(_coinbase != address(0), "the address can not be the smart contract address");
        require(bytes(p.name).length != 0, "name can not be null");
        //名称唯一
        require(!startups[p.name].isValidate, "startup name has been used");
        // require(startups[p.name].tokenContract != p.tokenContract, "token contract has been used");
        // p.isValidate = true;
        startups[p.name] = p;
        emit created(p.name, p, msg.sender);
    }

    ///// 此处开始加入可升级部分，上面👆是逻辑
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
    }

    // 获取逻辑地址
    // function getImplementation() public view returns (address) {
    //     return ERC1967Utils.getImplementation();
    // }

    function _authorizeUpgrade(address) internal view override onlyOwner {}
}
