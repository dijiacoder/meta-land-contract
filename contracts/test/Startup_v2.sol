// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../contracts/base/Base.sol";

contract StartupV2 is Base
{
    enum Mode{
        NONE, ESG, NGO, DAO, COM
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public override initializer {
        super.initialize();
    }

    // for web front, ["zehui",1,"avatar","mission","overview",true]
    function newStartup(Profile calldata p) public payable nonReentrant {
        require(bytes(p.name).length != 0, "name can not be null");
        // require(bytes(startups[p.name].name).length == 0, "startup name has been used");
        require(!startups[p.name].isValidate, "startup name has been used");
        startups[p.name] = p;
        emit created(p.name, p, msg.sender);
    }
}

