// SPDX-License-Identifier: SimPL-2.0
 pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ownership/Secondary.sol";

contract BountyStore is Secondary {
    struct Applicant {
        uint256 amount;
        uint8 status;
    }

    event Receive(address sender, string func);

    address[] arrayApplicants;
    mapping(address => Applicant) mappedApplicants;
    mapping(address => bool) mappedDepositLockers;
    mapping(address => bool) mappedDepositUnlockers;

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

    function applicants() public view onlyPrimary returns(address[] memory) {
        return arrayApplicants;
    }

    function pushApplicant(address _address) public onlyPrimary {
        arrayApplicants.push(_address);
    }

    function putApplicant(address _address, uint256 _amount, uint8 _status) public onlyPrimary {
        Applicant memory a = Applicant(_amount, _status);
        mappedApplicants[_address] = a;
    }

    function putApplicantAmount(address _address, uint256 _amount) public onlyPrimary {
        mappedApplicants[_address].amount = _amount;
    }

    function putApplicantStatus(address _address, uint8 _status) public onlyPrimary {
        mappedApplicants[_address].status = _status;
    }

    function getApplicant(address _address) public view onlyPrimary returns(uint256 amount, uint8 status) {
        Applicant memory a = mappedApplicants[_address];
        return (a.amount, a.status);
    }

    function putDepositLocker(address _address, bool _bool) public onlyPrimary {
        mappedDepositLockers[_address] = _bool;
    }

    function getDepositLocker(address _address) public view onlyPrimary returns(bool) {
        return mappedDepositLockers[_address];
    }

    function putDepositUnlocker(address _address, bool _bool) public onlyPrimary {
        mappedDepositUnlockers[_address] = _bool;
    }

    function getDepositUnlocker(address _address) public view onlyPrimary returns(bool) {
        return mappedDepositUnlockers[_address];
    }

}