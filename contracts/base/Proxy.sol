// SPDX-License-Identifier: SimPL-2.0
pragma solidity ^0.8.0;

import "../base/Base.sol";

contract Proxy is Base
{
    event Upgraded(address indexed implementation);

    bytes32 internal constant K_SLOT = 0xd5f7436adc48afaf7bd9d058121474d0b68958267edd0b25260c99ad5fb8f7e0;

    constructor() Base()
    {
        _owner = msg.sender;
    }

    function _implementation() internal view returns (address impl) {
        bytes32 slot = K_SLOT;

        assembly {
            impl := sload(slot)
        }
    }

    function isContract(address _addr) private view returns (bool){
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }

        return (size > 0);
    }

    function _upgradeTo(address newImpl) public isOwner {
        require(newImpl != address(0), "Cannot upgrade to invalid address");
        require(isContract(newImpl), "Not a contract");
        require(newImpl != _implementation(), "Cannot upgrade to the same implementation");
        bytes32 slot = K_SLOT;

        assembly {
            sstore(slot, newImpl)
        }
        emit Upgraded(newImpl);
    }

    function _delegate(address implementation) internal {
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {revert(0, returndatasize())}
            default {return (0, returndatasize())}
        }
    }

    fallback() external override payable {
        address _impl = _implementation();
        require(_impl != address(0), "implementation contract not set");
        _delegate(_impl);
    }
}
