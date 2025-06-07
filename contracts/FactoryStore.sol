// SPDX-License-Identifier: SimPL-2.0
pragma solidity ^0.8.0;

contract FactoryStore {
    address[] private arrChildren;
    mapping(address => bool) private mapChildren;
    address private _owner;

    constructor() {
        _owner = msg.sender;
    }

    function push(address child) external onlyOwner {
        arrChildren.push(child);
        mapChildren[child] = true;
    }

    function children() external onlyOwner view returns (address[] memory) {
        return arrChildren;
    }

    function isChild(address childAddr) external onlyOwner view returns (bool) {
        return mapChildren[childAddr];
    }

    function owner() public view returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "caller is not the owner account");
        _;
    }
}