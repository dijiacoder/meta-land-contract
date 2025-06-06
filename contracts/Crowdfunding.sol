// SPDX-License-Identifier: SimPL-2.0
pragma solidity ^0.8.0;

import {IERC20, IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ICrowdfundingFactory.sol";
import "./FactoryStore.sol";
import "./CrowdfundingStore.sol";
import "./Error.sol";
import "./Whitelist.sol";

contract Crowdfunding is OwnableUpgradeable, EIP712Upgradeable {
    enum Status {
        Pending,
        Upcoming,
        Live,
        Ended,
        Cancel
    }
    event Created(
        address owner,
        address factory,
        address founder,
        uint256 deposit,
        ICrowdfundingFactory.Parameters paras
    );
    event Buy(
        address caller,
        uint256 buyAmount,
        uint256 sellAmount,
        uint256 buyTokenBalance,
        uint256 sellTokenBalance,
        uint256 swapPoolBalance,
        uint256 _timestamp
    );
    event Sell(
        address caller,
        uint256 buyAmount,
        uint256 sellAmount,
        uint256 buyTokenBalance,
        uint256 sellTokenBalance,
        uint256 swapPoolBalance,
        uint256 _timestamp
    );
    event Cancel(address caller, Status status);
    event Remove(address caller, Status status);
    event TransferToLiquidity(address caller, Status status, bytes data);
    event Receive(address sender, string func);
    event UpdateParas(
        address caller,
        // uint256 buyPrice,
        // uint16 swapPercent,
        // uint256 maxBuyAmount,
        // uint16 maxSellPercent,
        uint256 endTime
    );

    CrowdfundingStore store;
    IERC20Metadata private sellToken;
    IERC20Metadata private buyToken;
    ICrowdfundingFactory private ifactory;
    address private factory;
    address private founder;
    uint256 private depositSellAmount;
    uint256 private depositAmount;
    uint256 private buyTokenAmount;
    uint256 private swapPoolAmount;
    uint256 private sellTokenAmount;
    ICrowdfundingFactory.Parameters private paras;
    address private thisAccount;
    address payable private vault;
    Status private status;
    bool internal locked;

    function initialize(
        address _factory, 
        address _founder, 
        string memory _name, 
        string memory _version, 
        ICrowdfundingFactory.Parameters memory _parameters
    ) public initializer {
        __Ownable_init(_founder);
        __EIP712_init(_name, _version);

        factory = _factory;
        founder = _founder;
        thisAccount = address(this);
        ifactory = ICrowdfundingFactory(factory);

        store = new CrowdfundingStore();
        vault = payable(address(store));
        
        paras = _parameters;
        status = _statusFromTime();
        sellToken = IERC20Metadata(paras.sellTokenAddress);
        paras.sellTokenDecimals = sellToken.decimals();
        
        if (paras.sellTokenAddress == paras.buyTokenAddress) {
            paras.buyTokenIsNative = true;
            paras.buyTokenDecimals = 18;
        } else {
            paras.buyTokenIsNative = false;
            buyToken = IERC20Metadata(paras.buyTokenAddress);
            paras.buyTokenDecimals = buyToken.decimals();
        }

        // depositSellAmount = _calculateDeposit();
        (, depositSellAmount) = _swapAmount(paras.raiseTotal, 0);
        sellTokenAmount = depositSellAmount;
        depositAmount = paras.raiseTotal * paras.swapPercent * paras.dexInitPrice / 10000 / (10 ** paras.buyTokenDecimals) + depositSellAmount;

        emit Created(owner(), factory, founder, depositSellAmount, paras);
    }

    function buy(
        uint256 _buyAmount,
        uint256 _sellAmount
    ) public payable isActive inTime noReentrant returns (bool) {
        // require(_buyAmount != 0 && _sellAmount != 0, "Amount is zero");
        // if (_buyAmount == 0 || _sellAmount == 0) {
        //     revert ZeroAmount();
        // }
        // // require(_checkPrice(_buyAmount, _sellAmount), "Price is mismatch");
        // if (!_checkPrice(_buyAmount, _sellAmount)) {
        //     revert PriceIsMismatch();
        // }

        _checkAmount(_buyAmount, _sellAmount);
        if (_buyAmount < paras.minBuyAmount) {
            revert AmountLTMinimum();
        }

        // require(_checkMaxBuyAmount(msg.sender, _buyAmount), "Amount exceeds maximum");
        if (!_checkMaxBuyAmount(msg.sender, _buyAmount)) {
            revert AmountExceedsMaximum();
        }

        // require(sellToken.balanceOf(vault) >= _sellAmount, "Sell token balance is insufficient");
        if (sellToken.balanceOf(vault) < _sellAmount) {
            revert TokenBalanceInsufficient("Sell");
        }

        uint256 _toPoolAmount = _toSwapPoolAmount(_buyAmount);
        if (paras.buyTokenIsNative) {
            require(msg.value == _buyAmount, "msg.value is not valid");
            (bool isSend, ) = vault.call{value: _toPoolAmount}("");
            
            // require(isSend, "Transfer failure");
            if (!isSend) {
                revert Transfer("Buy");
            }

            (isSend, ) = paras.teamWallet.call{value: msg.value - _toPoolAmount}("");

            // require(isSend, "Transfer team failure");
            if (!isSend) {
                revert Transfer("Buy");
            }
        } else {
            // require(buyToken.allowance(msg.sender, thisAccount) >= _buyAmount, "Your buy token allowance is insufficient");
            if (buyToken.allowance(msg.sender, thisAccount) < _buyAmount) {
                revert TokenAllowanceInsufficient("Buy");
            }

            // require(buyToken.balanceOf(msg.sender) >= _buyAmount, "Your buy token balance is insufficient");
            if (buyToken.balanceOf(msg.sender) < _buyAmount) {
                revert TokenBalanceInsufficient("Buy");
            }

            // require(buyToken.transferFrom(msg.sender, paras.teamWallet, _buyAmount.sub(_toPoolAmount)), "Buy token transfer team failure");
            if (!buyToken.transferFrom(msg.sender, vault, _toPoolAmount)) {
                revert Transfer("Buy");
            }

            // require(buyToken.transferFrom(msg.sender, vault, _toPoolAmount), "Buy token transferFrom failure");
            if (!buyToken.transferFrom(msg.sender, paras.teamWallet, _buyAmount - _toPoolAmount)) {
                revert Transfer("Buy");
            }
        }
        // require(store.transferToken(sellToken, msg.sender, _sellAmount), "Sell token transfer failure");
        if (!store.transferToken(sellToken, msg.sender, _sellAmount)) {
            revert Transfer("Sell");
        }

        buyTokenAmount = buyTokenAmount + _buyAmount;
        sellTokenAmount = sellTokenAmount - _sellAmount;
        swapPoolAmount = swapPoolAmount + _toPoolAmount;
        store.addTotal(msg.sender, _buyAmount, _sellAmount);
        store.addAmount(msg.sender, _buyAmount, _sellAmount);
        
        emit Buy(
            msg.sender,
            _buyAmount,
            _sellAmount,
            buyTokenAmount,
            sellTokenAmount,
            swapPoolAmount,
            block.timestamp
        );

        return true;
    }

    function _checkAmount(
        uint256 _buyAmount,
        uint256 _sellAmount
    ) internal view {
        if (_buyAmount == 0 || _sellAmount == 0) {
            revert ZeroAmount();
        }

        // require(_checkPrice(_buyAmount, _sellAmount), "Price is mismatch");
        if (!_checkPrice(_buyAmount, _sellAmount)) {
            revert PriceIsMismatch();
        }
    }

    function sell(
        uint256 _buyAmount,
        uint256 _sellAmount
    ) public payable isActive inTime noReentrant returns (bool) {
        // require(_buyAmount != 0 && _sellAmount != 0, "Amount is zero");
        // if (_buyAmount == 0 || _sellAmount == 0) {
        //     revert ZeroAmount();
        // }
        // // require(_checkPrice(_buyAmount, _sellAmount), "Price is mismatch");
        // if (!_checkPrice(_buyAmount, _sellAmount)) {
        //     revert PriceIsMismatch();
        // }

        _checkAmount(_buyAmount, _sellAmount);
        // require(_checkMaxSellAmount(msg.sender, _sellAmount), "Amount exceeds maximum");
        if (!_checkMaxSellAmount(msg.sender, _sellAmount)) {
            revert AmountExceedsMaximum();
        }

        uint256 _buyAmountAfterTax = _amountAfterTax(_buyAmount);
        // require(_buyBalance() >= _buyAmountAfterTax, "Balance is insufficient");
        if (_buyBalance() < _buyAmountAfterTax) {
            revert TokenBalanceInsufficient("Buy");
        }

        // require(sellToken.allowance(msg.sender, thisAccount) >= _sellAmount, "Your sell token allowance is insufficient");
        if (sellToken.allowance(msg.sender, thisAccount) < _sellAmount) {
            revert TokenAllowanceInsufficient("Sell token");
        }

        // require(sellToken.balanceOf(msg.sender) >= _sellAmount, "Your sell token balance is insufficient");
        if (sellToken.balanceOf(msg.sender) < _sellAmount) {
            revert TokenBalanceInsufficient("Sell token");
        }

        // require(sellToken.transferFrom(msg.sender, vault, _sellAmount), "Sell token transferFrom failure");
        if (!sellToken.transferFrom(msg.sender, vault, _sellAmount)) {
            revert Transfer("Sell");
        }

        if (paras.buyTokenIsNative) {
            // require(vault.balance >= _buyAmountAfterTax, "Balance is insufficient");
            // require(store.transfer(msg.sender, _buyAmountAfterTax), "Transfer buyer failure");
            if (vault.balance < _buyAmountAfterTax) {
                revert TokenAllowanceInsufficient("Buy token");
            }

            if (!store.transfer(msg.sender, _buyAmountAfterTax)) {
                revert Transfer("Buy token");
            }
        } else {
            // require(buyToken.balanceOf(vault) >= _buyAmountAfterTax, "Buy token balance is insufficient");
            // require(store.transferToken(buyToken, msg.sender, _buyAmountAfterTax), "Buy token transfer buyer failure");
            if (buyToken.balanceOf(vault) < _buyAmountAfterTax) {
                revert TokenAllowanceInsufficient("Buy token");
            }

            if (!store.transferToken(buyToken, msg.sender, _buyAmountAfterTax)) {
                revert Transfer("Buy token");
            }
        }

        buyTokenAmount = buyTokenAmount - _buyAmount;
        sellTokenAmount = sellTokenAmount + _sellAmount;
        swapPoolAmount = swapPoolAmount - _buyAmountAfterTax;
        store.subAmount(msg.sender, _buyAmount, _sellAmount);

        emit Sell(
            msg.sender,
            _buyAmount,
            _sellAmount,
            buyTokenAmount,
            sellTokenAmount,
            swapPoolAmount,
            block.timestamp
        );

        return true;
    }

    function cancel() public onlyOwner isActive beforeStart {
        // require(
        //     _refundSellToken(payable(paras.teamWallet)),
        //     "Refund sell token failure"
        // );

        if (!_refundSellToken(payable(paras.teamWallet))) {
            revert RefundSellTokenFailed();
        }

        status = Status.Cancel;
        emit Cancel(msg.sender, status);
    }

    function remove() public onlyOwner isActive canOver {
        if (_buyBalance() > 0) {
            if (paras.router != address(0)) {
                revert TransferLiquidity("only auto listing");
            }

            // require(paras.router==address(0), "Can only be closed by transferring liquidity");
            bool ok = _takeFee();
            if (!ok) {
                revert HandleFeeError();
            }
            // require(ok, "There is an error in withdrawing the handling fee");
        }
        // require(
        //     _refundBuyToken(payable(paras.teamWallet)),
        //     "Refund buy token failure"
        // );

        if (!_refundBuyToken(payable(paras.teamWallet))) {
            revert RefundBuyTokenFailed();
        }
        // require(
        //     _refundSellToken(payable(paras.teamWallet)),
        //     "Refund sell token failure"
        // );

        if (!_refundSellToken(payable(paras.teamWallet))) {
            revert RefundSellTokenFailed();
        }

        status = Status.Ended;
        emit Remove(msg.sender, status);
    }

    function updateParas(
        // uint256 _buyPrice,
        // uint16 _swapPercent,
        // uint256 _maxBuyAmount,
        // uint256 _minBuyAmount,
        // uint16 _maxSellPercent,
        uint256 _endTime
    ) public onlyOwner isActive beforeEnd {
        // paras.buyPrice = _buyPrice;
        // paras.swapPercent = _swapPercent;
        // paras.maxBuyAmount = _maxBuyAmount;
        // paras.minBuyAmount = _minBuyAmount;
        // paras.maxSellPercent = _maxSellPercent;
        paras.endTime = _endTime;
        emit UpdateParas(
            msg.sender,
            // _buyPrice,
            // _swapPercent,
            // _maxBuyAmount,
            // _maxSellPercent,
            _endTime
        );
    }

    function vaultAccount() public view returns (address) {
        return vault;
    }

    function state()
        public
        view
        returns (
            uint256 _raiseTotal,
            uint256 _raiseAmount,
            uint256 _swapPoolAmount,
            uint256 _buyTokenBalance,
            Status _status,
            uint256 _dexInitPrice
        )
    {
        uint256 _raiseBalance = vault.balance;
        if (!paras.buyTokenIsNative) {
            _raiseBalance = buyToken.balanceOf(vault);
        }
        // (uint256 _buyAmount, uint256 _sellAmount) = store.getAmount(msg.sender);
        return (
            paras.raiseTotal,
            buyTokenAmount,
            swapPoolAmount,
            _raiseBalance,
            status,
            paras.dexInitPrice
        );
    }

    // function account() public view returns (address, address, address) {
    //     return (owner(), factory, founder);
    // }

    function parameters()
        public
        view
        returns (
            address _sellTokenAddress,
            address _buyTokenAddress,
            uint8 _buyTokenDecimals,
            uint256 _buyPrice,
            uint16 _swapPercent,
            uint256 _maxBuyAmount,
            uint256 _minBuyAmount,
            uint16 _maxSellPercent,
            uint256 _dexInitPrice
        )
    {
        return (
            paras.sellTokenAddress,
            paras.buyTokenAddress,
            paras.buyTokenDecimals,
            paras.buyPrice,
            paras.swapPercent,
            paras.maxBuyAmount,
            paras.minBuyAmount,
            paras.maxSellPercent,
            paras.dexInitPrice
        );
    }

    // function sellDeposit() public view returns (uint256 _depositAmount) {
    //     return (depositSellAmount);
    // }

    function deposit() public view returns (uint256 _depositAmount) {
        return depositAmount;
    }

    function maxBuyAmount()
        public
        view
        returns (uint256 _buyAmount, uint256 _sellAmount)
    {
        return _getBuyMaxAmount(msg.sender);
    }

    function maxSellAmount()
        public
        view
        returns (uint256 _buyAmount, uint256 _sellAmount)
    {
        return _getSellMaxAmount(msg.sender);
    }

    // function buyTokenIsNative() public view returns (bool isNative) {
    //     return paras.buyTokenIsNative;
    // }

    function getStore() external view returns (address) {
        return address(store);
    }

    function transferToLiquidity(
        address _router,
        uint256 _amountA,
        bytes calldata _data,
        bytes calldata _signature
    )
        public
        payable
        onlyOwner
        noReentrant
        isActive
        canOver
        returns (bool success, bytes memory result)
    {
        // require(paras.router!=address(0), "Does not support automatic transfer of liquidity");
        if (paras.router == address(0)) {
            revert TransferLiquidity("not allow auto listing");
        }

        if (_router != paras.router) {
            revert TransferLiquidity("Inconsistent router");
        }

        ICrowdfundingFactory _factory = ICrowdfundingFactory(factory);
        if (
            _verify(
                _factory.transferSigner(),
                getHash(_router, _amountA, _data),
                _signature
            )
        ) {
            revert TransferLiquiditySignatureVerificationFailed();
        }

        // require(_router==paras.router, "Please transfer to the dex you chose when creating");
        bool ok = _takeFee();
        // require(ok, "There is an error in withdrawing the handling fee");
        if (!ok) {
            revert HandleFeeError();
        }

        uint256 amountB = _buyBalance();
        uint256 amountA = amountB * paras.dexInitPrice / 10 ** paras.buyTokenDecimals;

        // require(, "The balance of the token sold is insufficient to complete the automatic transfer of liquidity");
        if (amountA > sellToken.balanceOf(vault)) {
            revert TokenBalanceInsufficient("sell token");
        }

        bytes calldata data = _data;
        (success, result) = store.transferToLiquidity(
            _router,
            sellToken,
            buyToken,
            amountA,
            amountB,
            data,
            paras.buyTokenIsNative
        );
        // require(success, "Failed to add liquidity");
        if (!success) {
            revert AddLiquidityFailed();
        }

        // require(
        //     _refundSellToken(payable(paras.teamWallet)),
        //     "Refund sell token failure"
        // );
        if (!_refundSellToken(payable(paras.teamWallet))) {
            revert RefundSellTokenFailed();
        }

        status = Status.Ended;
        emit TransferToLiquidity(msg.sender, status, result);
        return (success, result);
    }

    function getHash(
        address _router,
        uint256 _amountA,
        bytes calldata _data
    ) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "TransferLiquidity(address _router,uint256 _amountA,bytes calldata _data)"
                        ),
                        _amountA,
                        _router,
                        _data
                    )
                )
            );
    }

    function _verify(
        address _signer,
        bytes32 _hash,
        bytes calldata _signature
    ) internal pure returns (bool) {
        return ECDSA.recover(_hash, _signature) == _signer;
    }

    function _takeFee() internal returns (bool) {
        uint256 fee = _buyBalance() * ifactory.fee() /10000;
        bool ok;
        if (paras.buyTokenIsNative) {
            (ok) = store.transfer(ifactory.feeTo(), fee);
        } else {
            (ok) = store.transferToken(buyToken, ifactory.feeTo(), fee);
        }
        return (ok);
    }

    function _refundBuyToken(address payable _to) internal returns (bool) {
        bool isSend = true;
        if (paras.buyTokenIsNative) {
            if (vault.balance > 0) {
                isSend = store.transfer(_to, vault.balance);
            }
        } else {
            if (buyToken.balanceOf(vault) > 0) {
                isSend = store.transferToken(
                    buyToken,
                    _to,
                    buyToken.balanceOf(vault)
                );
            }
        }
        return isSend;
    }

    function _refundSellToken(address payable _to) internal returns (bool) {
        bool isSend = true;
        if (sellToken.balanceOf(vault) > 0) {
            isSend = store.transferToken(
                sellToken,
                _to,
                sellToken.balanceOf(vault)
            );
        }
        return isSend;
    }

    function _buyBalance() internal view returns (uint256) {
        if (paras.buyTokenIsNative) {
            return vault.balance;
        } else {
            return buyToken.balanceOf(vault);
        }
    }

    function _amountAfterTax(uint256 _amount) internal view returns (uint256) {
        return _amount - (_amount * paras.sellTax) / 10000;
    }

    function _toSwapPoolAmount(
        uint256 _amount
    ) internal view returns (uint256) {
        return (_amount * paras.swapPercent) / 10000;
    }

    function _checkMaxBuyAmount(
        address buyer,
        uint256 _amount
    ) internal view returns (bool) {
        (uint256 _buyMaxAmount, ) = _getBuyMaxAmount(buyer);
        return _amount <= _buyMaxAmount;
        // if (_amount <= _buyMaxAmount) {
        //     return true;
        // } else {
        //     return false;
        // }
    }

    function _checkMaxSellAmount(
        address seller,
        uint256 _amount
    ) internal view returns (bool) {
        (, uint256 _sellMaxAmount) = _getSellMaxAmount(seller);
        return _amount <= _sellMaxAmount;
        // if (_amount <= _sellMaxAmount) {
        //     return true;
        // } else {
        //     return false;
        // }
    }

    function _getBuyMaxAmount(
        address buyer
    ) internal view returns (uint256, uint256) {
        (uint256 _buyAmount, ) = store.getAmount(buyer);
        uint256 _buyMaxAmount = Math.min(
            paras.maxBuyAmount - _buyAmount,
            paras.raiseTotal - buyTokenAmount
        );
        (uint256 _remainBuyAmount, ) = _swapAmount(0, sellTokenAmount);
        return _swapAmount(Math.min(_buyMaxAmount, _remainBuyAmount), 0);
    }

    function _getSellMaxAmount(
        address seller
    ) internal view returns (uint256, uint256) {
        (, uint256 _tSellAmount) = store.getTotal(seller);
        (, uint256 _aSellAmount) = store.getAmount(seller);
        uint256 _sellMaxAmount = Math.min(
            _aSellAmount + (_tSellAmount * paras.maxSellPercent) / 10000 - _tSellAmount,
            _aSellAmount
        );
        (, uint256 _remainSellAmount) = _swapAmount(swapPoolAmount, 0);
        return _swapAmount(0, Math.min(_sellMaxAmount, _remainSellAmount));
    }

    function _checkPrice(
        uint256 _buyAmount,
        uint256 _sellAmount
    ) internal view returns (bool) {
        // console.log("_buyAmount: ",_buyAmount);
        // console.log("_sellAmount: ",_sellAmount);
        (, uint256 _sAmount) = _swapAmount(_buyAmount, 0);
        (uint256 _bAmount, ) = _swapAmount(0, _sellAmount);
        if (_bAmount == _buyAmount || _sAmount == _sellAmount) {
            return true;
        }
        return false;
    }

    function _swapAmount(
        uint256 _buyAmount,
        uint256 _sellAmount
    ) internal view returns (uint256, uint256) {
        // if (_buyAmount > 0) {
        //     return (
        //         _buyAmount,
        //         (_buyAmount * _swapPrice()) / (10 ** paras.buyTokenDecimals)
        //     );
        // } else if (_sellAmount > 0) {
        //     return (
        //         (_sellAmount * (10 ** paras.buyTokenDecimals)) / _swapPrice(),
        //         _sellAmount
        //     );
        // } else {
        //     return (0, 0);
        // }
        if (_buyAmount > 0) {
            _sellAmount = _buyAmount * _swapPrice() / 10 ** paras.buyTokenDecimals;
        } else if (_sellAmount > 0) {
            _buyAmount = _sellAmount * 10 ** paras.buyTokenDecimals / _swapPrice();
        }
        
        return (_buyAmount, _sellAmount);
    }

    function _swapPrice() internal view returns (uint256) {
        return paras.buyPrice;
    }

    function _checkActive() internal view virtual {
        if (status == Status.Cancel) {
            revert Canceled();
        }
        // require(status != Status.Cancel, "Crowdfunding is cancel");
    }

    function _checkInTime() internal view virtual {
        if (block.timestamp < paras.startTime) {
            revert NotStarted();
        }
        if (block.timestamp > paras.endTime) {
            revert HasEnded();
        }
        // require(block.timestamp >= paras.startTime, "Crowdfunding not started");
        // require(block.timestamp <= paras.endTime, "Crowdfunding has ended");
    }

    function _checkBeforeStart() internal view virtual {
        // require(block.timestamp < paras.startTime, "Crowdfunding has started");
        if (block.timestamp >= paras.startTime) {
            revert HasStarted();
        }
    }

    function _checkBeforeEnd() internal view virtual {
        // require(block.timestamp <= paras.endTime, "Crowdfunding has ended");
        if (block.timestamp > paras.endTime) {
            revert HasEnded();
        }
    }

    function _checkCanOver() internal view virtual {
        require(
            block.timestamp > paras.endTime ||
                buyTokenAmount >= paras.raiseTotal,
            "ERR: NE"
        );
        if (status == Status.Ended) {
            revert StatusIsEnded();
        }
        // require(status != Status.Ended, "Crowdfunding status is ended");
    }

    function _statusFromTime() internal view returns (Status) {
        if (block.timestamp < paras.startTime) {
            return Status.Upcoming;
        } else if (block.timestamp <= paras.endTime) {
            return Status.Live;
        } else {
            return Status.Ended;
        }
    }

    receive() external payable {
        emit Receive(msg.sender, "receive");
    }

    modifier isActive() {
        _checkActive();
        _;
    }

    modifier inTime() {
        _checkInTime();
        _;
    }

    modifier beforeStart() {
        _checkBeforeStart();
        _;
    }

    modifier beforeEnd() {
        _checkBeforeEnd();
        _;
    }

    modifier canOver() {
        _checkCanOver();
        _;
    }

    modifier noReentrant() {
        require(!locked, "No re-entrancy");
        locked = true;
        _;
        locked = false;
    }
}

contract CrowdfundingBeacon is UpgradeableBeacon {
    constructor(address _implementation) UpgradeableBeacon(_implementation, msg.sender) {}

    function implementation() public view override returns (address) {
        return super.implementation();
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        super.upgradeTo(newImplementation);
    }
}
