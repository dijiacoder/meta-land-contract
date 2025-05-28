// SPDX-License-Identifier: SimPL-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Whitelist is Ownable {
    mapping(address => bool) private whitelist;

    event AddressAdded(address indexed account);
    event AddressRemoved(address indexed account);
    constructor() Ownable(msg.sender) {}

    modifier onlyWhitelisted() {
        require(whitelist[msg.sender], "Only whitelisted addresses can call this function.");
        _;
    }
    function addToWhitelist(address account) external onlyOwner {
        require(account != address(0), "Invalid address.");
        require(!whitelist[account], "Address is already whitelisted.");
        whitelist[account] = true;
        emit AddressAdded(account);
    }
    function removeFromWhitelist(address account) external onlyOwner {
        require(whitelist[account], "Address is not whitelisted.");
        whitelist[account] = false;
        emit AddressRemoved(account);
    }
    function isWhitelisted(address account) public view returns (bool) {
        return whitelist[account];
    }
}
