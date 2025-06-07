// SPDX-License-Identifier: SimPL-2.0
pragma solidity ^0.8.0;

import "../Bounty.sol";


contract BountyV2 is Bounty {
    uint256 public isUpgraded;

    function setUpgrade(uint256 _u) public onlyOwner {
        isUpgraded = _u;
    }
}
