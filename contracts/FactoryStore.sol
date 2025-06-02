// SPDX-License-Identifier: SimPL-2.0
pragma solidity ^0.8.0;

import "./ownership/Secondary.sol";

contract FactoryStore is Secondary {
    address[] private arrChildren;
    mapping(address => bool) private mapChildren;

    function push(address child) external onlyPrimary {
        arrChildren.push(child);
        mapChildren[child] = true;
    }

    function children() external onlyPrimary view returns (address[] memory) {
        return arrChildren;
    }

    function isChild(address childAddr) external onlyPrimary view returns (bool) {
        return mapChildren[childAddr];
    }
}