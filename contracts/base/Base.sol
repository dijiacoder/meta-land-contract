// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

contract Base is Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable, OwnableUpgradeable
{
    address payable internal _coinbase;

    modifier isOwner() {
        require(_msgSender() == owner(), "Base: caller is not the owner");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public virtual initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Ownable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override isOwner {}

    fallback() external virtual payable {
        revert();
    }

    receive() external payable {
        revert();
    }

    function setCoinBase(address payable cb) internal isOwner {
        _coinbase = cb;
    }

    function transferOwnership(address newOwner) public virtual override isOwner {
        super.transferOwnership(newOwner);
    }

    function suicide0(address payable receiver)
    public
    isOwner {
        assembly {
            selfdestruct(receiver)
        }
    }
}
