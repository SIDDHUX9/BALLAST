// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBallastVault } from "./interfaces/IBallastVault.sol";
import { IBorrowerOperationsMinimal } from "./interfaces/IBorrowerOperationsMinimal.sol";
import { ITroveManagerMinimal } from "./interfaces/ITroveManagerMinimal.sol";
import { IPriceFeedMinimal } from "./interfaces/IPriceFeedMinimal.sol";
import { IMUSDMinimal } from "./interfaces/IMUSDMinimal.sol";
import { ISortedTrovesMinimal } from "./interfaces/ISortedTrovesMinimal.sol";
import { BallastMath } from "./libraries/BallastMath.sol";

/**
 * @title BallastVault
 * @notice Isolated proxy vault owning a single MUSD trove on Mezo, holding defense reserves,
 *         and allowing permissionless keeper defense execution when pre-configured rules trigger.
 */
contract BallastVault is IBallastVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Constants & Immutables ---
    uint256 public constant MUSD_GAS_COMPENSATION = 200e18;

    IBorrowerOperationsMinimal public immutable borrowerOperations;
    ITroveManagerMinimal public immutable troveManager;
    IPriceFeedMinimal public immutable priceFeed;
    IMUSDMinimal public immutable musdToken;
    ISortedTrovesMinimal public immutable sortedTroves;

    // --- State Storage in Proxy ---
    address public override owner;
    Rule public override rule;
    uint256 public override musdReserve;
    uint256 public override btcReserve;

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /**
     * @notice Constructor initializes immutables and locks the implementation contract permanently.
     */
    constructor(
        address _borrowerOperations,
        address _troveManager,
        address _priceFeed,
        address _musdToken,
        address _sortedTroves
    ) {
        if (
            _borrowerOperations == address(0) || _troveManager == address(0)
                || _priceFeed == address(0) || _musdToken == address(0)
                || _sortedTroves == address(0)
        ) {
            revert ZeroAddress();
        }

        borrowerOperations = IBorrowerOperationsMinimal(_borrowerOperations);
        troveManager = ITroveManagerMinimal(_troveManager);
        priceFeed = IPriceFeedMinimal(_priceFeed);
        musdToken = IMUSDMinimal(_musdToken);
        sortedTroves = ISortedTrovesMinimal(_sortedTroves);

        // Lock implementation so it can never be initialized or used as a vault
        owner = address(1);
    }

    /// @inheritdoc IBallastVault
    function initialize(address ownerAddress) external override {
        if (owner != address(0)) revert AlreadyInitialized();
        if (ownerAddress == address(0)) revert ZeroAddress();
        owner = ownerAddress;
    }

    // --- Trove Management Wrappers (Owner Only) ---

    /// @inheritdoc IBallastVault
    function openTrove(uint256 debtAmount, address upperHint, address lowerHint)
        external
        payable
        override
        onlyOwner
        nonReentrant
    {
        _openTroveInternal(debtAmount, upperHint, lowerHint, owner);
    }

    /// @inheritdoc IBallastVault
    function openTrove(uint256 debtAmount, address upperHint, address lowerHint, address recipient)
        external
        payable
        override
        onlyOwner
        nonReentrant
    {
        _openTroveInternal(debtAmount, upperHint, lowerHint, recipient);
    }

    function _openTroveInternal(
        uint256 debtAmount,
        address upperHint,
        address lowerHint,
        address recipient
    ) internal {
        address to = recipient == address(0) ? owner : recipient;
        uint256 musdBefore = musdToken.balanceOf(address(this));

        borrowerOperations.openTrove{ value: msg.value }(debtAmount, upperHint, lowerHint);

        uint256 musdAfter = musdToken.balanceOf(address(this));
        uint256 borrowed = musdAfter > musdBefore ? musdAfter - musdBefore : 0;

        if (borrowed > 0) {
            IERC20(address(musdToken)).safeTransfer(to, borrowed);
        }

        emit TroveOpened(address(this), debtAmount, msg.value);
    }

    /// @inheritdoc IBallastVault
    function borrowMore(uint256 amount, address upperHint, address lowerHint, address recipient)
        external
        override
        onlyOwner
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();
        address to = recipient == address(0) ? owner : recipient;
        uint256 musdBefore = musdToken.balanceOf(address(this));

        borrowerOperations.withdrawMUSD(amount, upperHint, lowerHint);

        uint256 musdAfter = musdToken.balanceOf(address(this));
        uint256 borrowed = musdAfter > musdBefore ? musdAfter - musdBefore : 0;

        if (borrowed > 0) {
            IERC20(address(musdToken)).safeTransfer(to, borrowed);
        }

        emit TroveAdjusted(address(this), 0, amount, true);
    }

    /// @inheritdoc IBallastVault
    function addCollateral(address upperHint, address lowerHint)
        external
        payable
        override
        onlyOwner
        nonReentrant
    {
        if (msg.value == 0) revert ZeroAmount();
        borrowerOperations.addColl{ value: msg.value }(upperHint, lowerHint);
        emit TroveAdjusted(address(this), msg.value, 0, false);
    }

    /// @inheritdoc IBallastVault
    function repay(uint256 amount, address upperHint, address lowerHint)
        external
        override
        onlyOwner
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();

        IERC20(address(musdToken)).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(address(musdToken)).forceApprove(address(borrowerOperations), amount);
        borrowerOperations.repayMUSD(amount, upperHint, lowerHint);

        emit TroveAdjusted(address(this), 0, amount, false);
    }

    /// @inheritdoc IBallastVault
    function withdrawCollateral(uint256 amount, address upperHint, address lowerHint)
        external
        override
        onlyOwner
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();
        uint256 btcBefore = address(this).balance;

        borrowerOperations.withdrawColl(amount, upperHint, lowerHint);

        uint256 btcReceived =
            address(this).balance > btcBefore ? address(this).balance - btcBefore : 0;

        if (btcReceived > 0) {
            (bool success,) = owner.call{ value: btcReceived }("");
            if (!success) revert BtcTransferFailed();
        }

        emit TroveAdjusted(address(this), amount, 0, false);
    }

    /// @inheritdoc IBallastVault
    function adjustTrove(
        uint256 collWithdrawal,
        uint256 debtChange,
        bool isDebtIncrease,
        address upperHint,
        address lowerHint
    ) external payable override onlyOwner nonReentrant {
        if (debtChange > 0 && !isDebtIncrease) {
            IERC20(address(musdToken)).safeTransferFrom(msg.sender, address(this), debtChange);
            IERC20(address(musdToken)).forceApprove(address(borrowerOperations), debtChange);
        }

        uint256 btcBefore = address(this).balance - msg.value;
        uint256 musdBefore = musdToken.balanceOf(address(this));

        borrowerOperations.adjustTrove{ value: msg.value }(
            collWithdrawal, debtChange, isDebtIncrease, upperHint, lowerHint
        );

        if (debtChange > 0 && isDebtIncrease) {
            uint256 musdAfter = musdToken.balanceOf(address(this));
            uint256 borrowed = musdAfter > musdBefore ? musdAfter - musdBefore : 0;
            if (borrowed > 0) {
                IERC20(address(musdToken)).safeTransfer(owner, borrowed);
            }
        }

        if (collWithdrawal > 0) {
            uint256 btcAfter = address(this).balance;
            uint256 btcReceived = btcAfter > btcBefore ? btcAfter - btcBefore : 0;
            if (btcReceived > 0) {
                (bool success,) = owner.call{ value: btcReceived }("");
                if (!success) revert BtcTransferFailed();
            }
        }

        emit TroveAdjusted(
            address(this),
            collWithdrawal > 0 ? collWithdrawal : msg.value,
            debtChange,
            isDebtIncrease
        );
    }

    /// @inheritdoc IBallastVault
    function closeTrove() external override onlyOwner nonReentrant {
        uint256 debt = troveManager.getTroveDebt(address(this));
        uint256 netDebt = debt > MUSD_GAS_COMPENSATION ? debt - MUSD_GAS_COMPENSATION : 0;

        uint256 shortfall = 0;
        uint256 leftoverMusd = 0;
        if (netDebt > 0) {
            if (musdReserve < netDebt) {
                shortfall = netDebt - musdReserve;
            } else {
                leftoverMusd = musdReserve - netDebt;
            }
        } else {
            leftoverMusd = musdReserve;
        }

        uint256 leftoverBtc = btcReserve;

        // Effects: Clear tracked reserves before external calls
        musdReserve = 0;
        btcReserve = 0;

        // Interactions
        if (shortfall > 0) {
            IERC20(address(musdToken)).safeTransferFrom(msg.sender, address(this), shortfall);
        }

        if (netDebt > 0) {
            IERC20(address(musdToken)).forceApprove(address(borrowerOperations), netDebt);
        }

        uint256 btcBefore = address(this).balance;
        borrowerOperations.closeTrove();
        uint256 btcReturned =
            address(this).balance > btcBefore ? address(this).balance - btcBefore : 0;

        if (btcReturned > 0) {
            (bool success,) = owner.call{ value: btcReturned }("");
            if (!success) revert BtcTransferFailed();
        }

        if (leftoverMusd > 0) {
            IERC20(address(musdToken)).safeTransfer(owner, leftoverMusd);
        }

        if (leftoverBtc > 0) {
            (bool sBtc,) = owner.call{ value: leftoverBtc }("");
            if (!sBtc) revert BtcTransferFailed();
        }

        emit TroveClosed(address(this));
    }

    /// @inheritdoc IBallastVault
    function claimCollateral() external override onlyOwner nonReentrant {
        uint256 btcBefore = address(this).balance;
        borrowerOperations.claimCollateral();
        uint256 claimed = address(this).balance > btcBefore ? address(this).balance - btcBefore : 0;

        if (claimed > 0) {
            (bool success,) = owner.call{ value: claimed }("");
            if (!success) revert BtcTransferFailed();
        }

        emit CollateralClaimed(address(this), claimed);
    }

    // --- Configuration & Reserves (Owner Only) ---

    /// @inheritdoc IBallastVault
    function setRule(bool enabled, uint64 triggerICR, uint64 targetICR, uint16 maxTipBps)
        external
        override
        onlyOwner
    {
        if (enabled) {
            if (triggerICR < 1.12e18 || triggerICR > 2.5e18) revert InvalidTriggerICR();
            if (targetICR < triggerICR + 0.05e18 || targetICR > 3.0e18) revert InvalidTargetICR();
            if (maxTipBps > 100) revert InvalidMaxTipBps();
        }

        rule = Rule(enabled, triggerICR, targetICR, maxTipBps);
        emit RuleSet(address(this), enabled, triggerICR, targetICR, maxTipBps);
    }

    /// @inheritdoc IBallastVault
    function depositMUSD(uint256 amount) external override onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();

        musdReserve += amount;
        IERC20(address(musdToken)).safeTransferFrom(msg.sender, address(this), amount);

        emit ReserveDeposited(address(this), address(musdToken), amount, musdReserve);
    }

    /// @inheritdoc IBallastVault
    function depositBTC() external payable override onlyOwner nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        btcReserve += msg.value;
        emit ReserveDeposited(address(this), address(0), msg.value, btcReserve);
    }

    /// @inheritdoc IBallastVault
    function withdrawMUSD(uint256 amount) external override onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > musdReserve) revert InsufficientReserves();

        musdReserve -= amount;
        IERC20(address(musdToken)).safeTransfer(owner, amount);

        emit ReserveWithdrawn(address(this), address(musdToken), amount, musdReserve);
    }

    /// @inheritdoc IBallastVault
    function withdrawBTC(uint256 amount) external override onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > btcReserve) revert InsufficientReserves();

        btcReserve -= amount;
        (bool success,) = owner.call{ value: amount }("");
        if (!success) revert BtcTransferFailed();

        emit ReserveWithdrawn(address(this), address(0), amount, btcReserve);
    }

    /// @inheritdoc IBallastVault
    function sweep(address token) external override onlyOwner nonReentrant {
        if (token == address(0)) {
            uint256 excessBtc =
                address(this).balance > btcReserve ? address(this).balance - btcReserve : 0;
            if (excessBtc > 0) {
                (bool success,) = owner.call{ value: excessBtc }("");
                if (!success) revert BtcTransferFailed();
            }
            emit AssetSwept(address(this), address(0), excessBtc);
        } else if (token == address(musdToken)) {
            uint256 actualBal = musdToken.balanceOf(address(this));
            uint256 excessMusd = actualBal > musdReserve ? actualBal - musdReserve : 0;
            if (excessMusd > 0) {
                IERC20(address(musdToken)).safeTransfer(owner, excessMusd);
            }
            emit AssetSwept(address(this), token, excessMusd);
        } else {
            uint256 bal = IMUSDMinimal(token).balanceOf(address(this));
            if (bal > 0) {
                IERC20(token).safeTransfer(owner, bal);
            }
            emit AssetSwept(address(this), token, bal);
        }
    }

    // --- Keeper & Public Automation ---

    /// @inheritdoc IBallastVault
    function checkDefense()
        external
        view
        override
        returns (bool defendable, uint256 currentICR, uint256 musdToRepay, uint256 btcToAdd)
    {
        if (!rule.enabled) return (false, 0, 0, 0);
        if (troveManager.getTroveStatus(address(this)) != ITroveManagerMinimal.Status.active) {
            return (false, 0, 0, 0);
        }

        uint256 price = priceFeed.fetchPrice();
        (uint256 totalColl, uint256 totalDebt) = _getDebtAndColl();

        currentICR = BallastMath.calculateICR(totalColl, price, totalDebt);
        if (currentICR >= rule.triggerICR) {
            return (false, currentICR, 0, 0);
        }

        BallastMath.DefenseResult memory res = BallastMath.computeDefenseAmounts(
            BallastMath.DefenseParams({
                currentCollateral: totalColl,
                currentDebt: totalDebt,
                price: price,
                targetICR: rule.targetICR,
                minNetDebt: borrowerOperations.minNetDebt(),
                gasCompensation: MUSD_GAS_COMPENSATION,
                musdReserve: musdReserve,
                btcReserve: btcReserve,
                maxTipBps: rule.maxTipBps
            })
        );

        musdToRepay = res.musdToRepay;
        btcToAdd = res.btcToAdd;
        defendable = (musdToRepay > 0 || btcToAdd > 0);
    }

    /// @inheritdoc IBallastVault
    function defend(address upperHint, address lowerHint)
        external
        override
        nonReentrant
        returns (uint256 musdRepaid, uint256 btcAdded)
    {
        if (!rule.enabled) revert RuleDisabled();
        if (troveManager.getTroveStatus(address(this)) != ITroveManagerMinimal.Status.active) {
            revert TroveNotActive();
        }

        uint256 price = priceFeed.fetchPrice();
        (uint256 totalColl, uint256 totalDebt) = _getDebtAndColl();

        uint256 icrBefore = BallastMath.calculateICR(totalColl, price, totalDebt);
        if (icrBefore >= rule.triggerICR) revert ICRNotDefendable();

        BallastMath.DefenseResult memory res = BallastMath.computeDefenseAmounts(
            BallastMath.DefenseParams({
                currentCollateral: totalColl,
                currentDebt: totalDebt,
                price: price,
                targetICR: rule.targetICR,
                minNetDebt: borrowerOperations.minNetDebt(),
                gasCompensation: MUSD_GAS_COMPENSATION,
                musdReserve: musdReserve,
                btcReserve: btcReserve,
                maxTipBps: rule.maxTipBps
            })
        );

        musdRepaid = res.musdToRepay;
        btcAdded = res.btcToAdd;

        if (musdRepaid == 0 && btcAdded == 0) revert InsufficientReserves();

        // Effects: Deduct tracked reserves before external interactions
        if (musdRepaid > 0) {
            musdReserve -= (musdRepaid + res.musdTip);
        }
        if (btcAdded > 0) {
            btcReserve -= (btcAdded + res.btcTip);
        }

        // Interactions: Phase 1: Repay debt
        if (musdRepaid > 0) {
            IERC20(address(musdToken)).forceApprove(address(borrowerOperations), musdRepaid);
            borrowerOperations.repayMUSD(musdRepaid, upperHint, lowerHint);

            if (res.musdTip > 0) {
                IERC20(address(musdToken)).safeTransfer(msg.sender, res.musdTip);
            }
        }

        // Interactions: Phase 2: Add collateral
        if (btcAdded > 0) {
            borrowerOperations.addColl{ value: btcAdded }(upperHint, lowerHint);

            if (res.btcTip > 0) {
                (bool success,) = msg.sender.call{ value: res.btcTip }("");
                if (!success) revert BtcTransferFailed();
            }
        }

        // Phase 3: Post-defense invariant verification
        uint256 icrAfter = troveManager.getCurrentICR(address(this), price);
        assert(icrAfter > icrBefore);

        emit Defended(
            address(this),
            msg.sender,
            musdRepaid,
            btcAdded,
            res.musdTip,
            res.btcTip,
            icrBefore,
            icrAfter
        );
    }

    /**
     * @dev Internal helper aggregating total debt and total collateral to avoid stack depth limits.
     */
    function _getDebtAndColl() internal view returns (uint256 totalColl, uint256 totalDebt) {
        (
            uint256 coll,
            uint256 principal,
            uint256 interest,
            uint256 pColl,
            uint256 pPrin,
            uint256 pInt
        ) = troveManager.getEntireDebtAndColl(address(this));

        totalColl = coll + pColl;
        totalDebt = principal + interest + pPrin + pInt;
    }

    /**
     * @notice Accepts native BTC refunds from protocol pools without affecting tracked reserve.
     */
    receive() external payable { }
}
