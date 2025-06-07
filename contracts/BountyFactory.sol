// SPDX-License-Identifier: SimPL-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./interfaces/IBounty.sol";
import "./FactoryStore.sol";
import "./Bounty.sol";

contract BountyFactory is OwnableUpgradeable, UUPSUpgradeable {
    event Created(address founder, address bounty, Parameters paras);

    FactoryStore store;
    address public bountyBeacon;

    function initialize(address _bountyBeacon) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        bountyBeacon = _bountyBeacon;
        store = new FactoryStore();
    }

    // UUPS升级授权函数，只有合约所有者能升级
    function _authorizeUpgrade(address) internal view override onlyOwner {}

    function createBounty(address _depositToken, uint256 _founderDepositAmount, uint256 _applicantDepositAmount, uint256 _applyDeadline) payable public {
        require(_applyDeadline > block.timestamp, "Applicant cutoff date is expired");
        Parameters memory paras = Parameters({depositToken: _depositToken,
            depositTokenIsNative: false,
            founderDepositAmount: _founderDepositAmount,
            applicantDepositMinAmount: _applicantDepositAmount,
            applyDeadline: _applyDeadline
        });

        bytes memory data = abi.encodeWithSelector(
            Bounty.initialize.selector,
            address(this),
            msg.sender,
            paras
        );
        BeaconProxy bounty = new BeaconProxy(bountyBeacon, data);

        if (paras.founderDepositAmount > 0) {
            if (_depositToken == address(0)) {
                require(msg.value == paras.founderDepositAmount, "msg.value is not valid");
                // require(msg.sender.balance >= paras.founderDepositAmount, "Your balance is insufficient");
                (bool isSend,) = IBounty(address(bounty)).vaultAccount().call{value: paras.founderDepositAmount}("");
                require(isSend, "Transfer contract failure");
                paras.depositTokenIsNative = true;
            } else {
                IERC20 depositToken = IERC20(_depositToken);
                require(depositToken.balanceOf(msg.sender) >= _founderDepositAmount, "Deposit token balance is insufficient");
                require(depositToken.allowance(msg.sender, address(this)) >= _founderDepositAmount, "Deposit token allowance is insufficient");
                require(depositToken.transferFrom(msg.sender, IBounty(address(bounty)).vaultAccount(), _founderDepositAmount), "Deposit token transferFrom failure");
            }
        }

        store.push(address(bounty));
        emit Created(msg.sender, address(bounty), paras);
    }

    function children() external view returns (address[] memory) {
        return store.children();
    }

    function isChild(address childAddr) external view returns (bool) {
        return store.isChild(childAddr);
    }

    function getStore() external view returns (address) {
        return address(store);
    }
}