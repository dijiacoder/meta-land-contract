// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Base
{
    address internal  _owner;
    address payable internal  _coinbase;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier isOwner() {
        assert(msg.sender == _owner);
        _;
    }

    constructor()
    {
        _owner = msg.sender;
    }

    fallback() external virtual payable {
        revert();
    }

    receive() external payable {
        revert();
    }

    function setCoinBase(address payable cb) internal isOwner {
        _coinbase = cb;
    }

    function transferOwnership(address newOwner) public virtual isOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function suicide0(address payable receiver)
    public
    isOwner {
        selfdestruct(receiver);
    }
}
