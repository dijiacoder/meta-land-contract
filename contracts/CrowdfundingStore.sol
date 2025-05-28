// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../utils/SafeMath.sol";
import "./ownership/Secondary.sol";

contract CrowdfundingStore is Secondary {
    using SafeMath for uint;
    struct PairAmount {
        uint256 buyAmount;
        uint256 sellAmount;
    }
    event Receive(address sender, string func);
    mapping(address => PairAmount) totals;
    mapping(address => PairAmount) amounts;
    receive() external payable {
        emit Receive(msg.sender, "receive");
    }
    function transfer(address _to, uint256 _amount) public onlyPrimary returns(bool) {
        (bool isSend,) = _to.call{value: _amount}("");
        return isSend;
    }
    function transferToken(IERC20 _token, address _to, uint256 _amount) public onlyPrimary returns(bool) {
        return _token.transfer(_to, _amount);
    }
    function approveToken(IERC20 _token, address _to, uint256 _amount) public onlyPrimary returns(bool) {
        return _token.approve(_to, _amount);
    }
    function transferToLiquidity(address _router,IERC20 _tokenA,IERC20 _tokenB, uint256 _amountA, uint256 _amountB, bytes calldata _data, bool _isNative) 
        public onlyPrimary returns(bool success, bytes memory result) {
        bool ok = _tokenA.approve(_router, _amountA);
        require(ok, "Approve sell token to router error");
        if (_isNative) {
            (success, result) = _router.call{value: _amountB}(_data);
        }else {
            ok = _tokenB.approve(_router, _amountB);
            require(ok, "An error occurred while sending the buy token to the router");
            ( success, result) = _router.call(_data);
        }
        return (success, result);
    }
    function getTotal(address _address) public view onlyPrimary returns (uint256, uint256) {
        return (totals[_address].buyAmount, totals[_address].sellAmount);
    }
    function addTotal(address _address, uint256 _buyAmount, uint256 _sellAmount) public onlyPrimary {
        totals[_address].buyAmount = totals[_address].buyAmount.add(_buyAmount);
        totals[_address].sellAmount = totals[_address].sellAmount.add(_sellAmount);
    }
    function subTotal(address _address, uint256 _buyAmount, uint256 _sellAmount) public onlyPrimary {
        totals[_address].buyAmount = totals[_address].buyAmount.sub(_buyAmount);
        totals[_address].sellAmount = totals[_address].sellAmount.sub(_sellAmount);
    }
    function getAmount(address _address) public view onlyPrimary returns (uint256, uint256) {
        return (amounts[_address].buyAmount, amounts[_address].sellAmount);
    }
    function addAmount(address _address, uint256 _buyAmount, uint256 _sellAmount) public onlyPrimary {
        amounts[_address].buyAmount = amounts[_address].buyAmount.add(_buyAmount);
        amounts[_address].sellAmount = amounts[_address].sellAmount.add(_sellAmount);
    }
    function subAmount(address _address, uint256 _buyAmount, uint256 _sellAmount) public onlyPrimary {
        amounts[_address].buyAmount = amounts[_address].buyAmount.sub(_buyAmount);
        amounts[_address].sellAmount = amounts[_address].sellAmount.sub(_sellAmount);
    }
}
