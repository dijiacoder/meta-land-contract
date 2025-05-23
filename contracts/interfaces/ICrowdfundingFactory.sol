// SPDX-License-Identifier: SimPL-2.0
pragma solidity ^0.8.20;

interface ICrowdfundingFactory {
    function fee() external view returns (uint24);

    function feeTo() external view returns (address);

    function feeToSetter() external view returns (address);

    function transferSigner() external view returns (address);
}
