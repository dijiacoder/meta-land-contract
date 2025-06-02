// SPDX-License-Identifier: SimPL-2.0
pragma solidity ^0.8.22;

import {BountyFactory} from "../Bounty.sol";

contract BountyFactoryV2 is BountyFactory {
    
    function newFunction() external pure returns (string memory) {
        return "TEST";
    }
}