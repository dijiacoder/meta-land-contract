// SPDX-License-Identifier: SimPL-2.0
pragma solidity ^0.8.20;

import "./ownership/Secondary.sol";

contract StartupStore is Secondary {
    struct Profile {
        string name;
        uint256 chainId;
        address founder;
        bool used;
    }

    string[] private arrStartup;
    mapping(string => Profile) private mapStartup;

    function putStartup(string memory _name, uint256 _chainId, address _founder, bool _used) public onlyPrimary {
        Profile memory p = Profile(_name, _chainId, _founder, _used);
        mapStartup[_name] = p;
        arrStartup.push(_name);
    }

    function getStartup(string memory _name) public view returns (string memory name, uint256 chainId, address founder, bool used) {
        Profile memory p = mapStartup[_name];
        return (p.name, p.chainId, p.founder, p.used);
    }

    function getStartups() public view returns (string[] memory) {
        return arrStartup;
    }
}