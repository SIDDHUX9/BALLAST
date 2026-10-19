// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {BallastVault} from "../../src/BallastVault.sol";
import {IBallastVault} from "../../src/interfaces/IBallastVault.sol";
import {ITroveManagerMinimal} from "../../src/interfaces/ITroveManagerMinimal.sol";
import {ISortedTrovesMinimal} from "../../src/interfaces/ISortedTrovesMinimal.sol";
import {IMUSDMinimal} from "../../src/interfaces/IMUSDMinimal.sol";
import {IPriceFeedMinimal} from "../../src/interfaces/IPriceFeedMinimal.sol";

contract BallastHandler is Test {
    BallastVault public immutable vault;
    address public immutable owner;
    address public immutable musdToken;
    address public immutable troveManager;
    address public immutable priceFeed;
    address public immutable sortedTroves;

    address internal constant CANONICAL_HEAD = 0x52d033E64774F31A8B7562806aA5782CbbD29382;
    address internal constant CANONICAL_TAIL = 0xDA04759E54728B6636Fe48F7c9795c7B609bAaAa;

    // Ghost variables
    uint256 public ghost_trackedMusdReserve;
    uint256 public ghost_trackedBtcReserve;
    uint256 public ghost_lastDefendIcrBefore;
    uint256 public ghost_lastDefendIcrAfter;
    bool public ghost_strangerReducedReserves;
    bool public ghost_strangerMovedCollateral;
    bool public ghost_defendSucceededWhenIcrAboveTrigger;

    uint256 public currentMockPrice = 80_000e18;

    constructor(
        BallastVault _vault,
        address _owner,
        address _musd,
        address _tm,
        address _pf,
        address _st
    ) {
        vault = _vault;
        owner = _owner;
        musdToken = _musd;
        troveManager = _tm;
        priceFeed = _pf;
        sortedTroves = _st;
    }

    function _setPrice(uint256 price) internal {
        currentMockPrice = price;
        vm.mockCall(
            priceFeed,
            abi.encodeWithSelector(IPriceFeedMinimal.fetchPrice.selector),
            abi.encode(price)
        );
    }

    function depositMUSD(uint256 amount) external {
        amount = bound(amount, 1e18, 10_000e18);

        // Fund owner with MUSD
        deal(musdToken, owner, IMUSDMinimal(musdToken).balanceOf(owner) + amount);

        vm.startPrank(owner);
        IMUSDMinimal(musdToken).approve(address(vault), amount);
        vault.depositMUSD(amount);
        vm.stopPrank();

        ghost_trackedMusdReserve += amount;
    }

    function withdrawMUSD(uint256 amount) external {
        if (ghost_trackedMusdReserve == 0) return;
        amount = bound(amount, 1e18, ghost_trackedMusdReserve);

        vm.prank(owner);
        vault.withdrawMUSD(amount);

        ghost_trackedMusdReserve -= amount;
    }

    function depositBTC(uint256 amount) external {
        amount = bound(amount, 0.01 ether, 5 ether);
        vm.deal(owner, owner.balance + amount);

        vm.prank(owner);
        vault.depositBTC{value: amount}();

        ghost_trackedBtcReserve += amount;
    }

    function withdrawBTC(uint256 amount) external {
        if (ghost_trackedBtcReserve == 0) return;
        amount = bound(amount, 0.01 ether, ghost_trackedBtcReserve);

        vm.prank(owner);
        vault.withdrawBTC(amount);

        ghost_trackedBtcReserve -= amount;
    }

    address internal constant STRANGER = address(0x999999);
    address internal constant KEEPER = address(0x888888);

    function strangerAttemptWithdrawMUSD(uint256 amount) external {
        amount = bound(amount, 1e18, 10_000e18);

        uint256 musdBefore = vault.musdReserve();

        vm.prank(STRANGER);
        try vault.withdrawMUSD(amount) {
            // Should never succeed
            ghost_strangerReducedReserves = true;
        } catch {
            // Expected revert
        }

        if (vault.musdReserve() < musdBefore) {
            ghost_strangerReducedReserves = true;
        }
    }

    function strangerAttemptWithdrawBTC(uint256 amount) external {
        amount = bound(amount, 0.01 ether, 5 ether);

        uint256 btcBefore = vault.btcReserve();

        vm.prank(STRANGER);
        try vault.withdrawBTC(amount) {
            ghost_strangerReducedReserves = true;
        } catch {
            // Expected revert
        }

        if (vault.btcReserve() < btcBefore) {
            ghost_strangerReducedReserves = true;
        }
    }

    function strangerAttemptWithdrawCollateral(uint256 amount) external {
        amount = bound(amount, 0.01 ether, 1 ether);

        vm.prank(STRANGER);
        try vault.withdrawCollateral(amount, CANONICAL_HEAD, CANONICAL_TAIL) {
            ghost_strangerMovedCollateral = true;
        } catch {
            // Expected revert
        }
    }

    function sendStrayBTC(uint256 amount) external {
        amount = bound(amount, 0.01 ether, 10 ether);
        vm.deal(STRANGER, STRANGER.balance + amount);

        vm.prank(STRANGER);
        (bool s,) = address(vault).call{value: amount}("");
        require(s, "stray btc failed");
        // Stray BTC does NOT increase ghost_trackedBtcReserve
    }

    function dropPriceToTrigger(uint256 dropPercent) external {
        dropPercent = bound(dropPercent, 10, 70); // Drop 10% to 70%

        (, uint64 triggerICR,,) = vault.rule();
        if (triggerICR == 0) return;

        uint256 coll = ITroveManagerMinimal(troveManager).getTroveColl(address(vault));
        uint256 debt = ITroveManagerMinimal(troveManager).getTroveDebt(address(vault));
        if (coll == 0 || debt == 0) return;

        // Calculate price that puts ICR below triggerICR
        uint256 newPrice = (debt * triggerICR * (100 - dropPercent)) / (coll * 100);
        if (newPrice > 0 && newPrice < 100_000e18) {
            _setPrice(newPrice);
        }
    }

    function executeDefend() external {
        (bool defendable, uint256 icrBefore, uint256 musdToRepay, uint256 btcToAdd) = vault.checkDefense();
        (, uint64 triggerICR,, uint16 maxTipBps) = vault.rule();

        if (defendable) {
            if (icrBefore >= triggerICR) {
                ghost_defendSucceededWhenIcrAboveTrigger = true;
            }

            uint256 coll = ITroveManagerMinimal(troveManager).getTroveColl(address(vault)) + btcToAdd;
            uint256 debt = ITroveManagerMinimal(troveManager).getTroveDebt(address(vault)) - musdToRepay;
            uint256 nicr = debt > 0 ? (coll * 1e20) / debt : type(uint256).max;
            (address u, address l) = ISortedTrovesMinimal(sortedTroves).findInsertPosition(nicr, CANONICAL_HEAD, CANONICAL_TAIL);

            vm.prank(KEEPER);
            (uint256 repaid, uint256 added) = vault.defend(u, l);

            uint256 icrAfter = ITroveManagerMinimal(troveManager).getCurrentICR(address(vault), currentMockPrice);

            ghost_lastDefendIcrBefore = icrBefore;
            ghost_lastDefendIcrAfter = icrAfter;

            uint256 musdTip = (repaid * maxTipBps) / 10_000;
            uint256 btcTip = (added * maxTipBps) / 10_000;

            ghost_trackedMusdReserve -= (repaid + musdTip);
            ghost_trackedBtcReserve -= (added + btcTip);
        } else {
            // If checkDefense reports not defendable, verify calling defend reverts
            vm.prank(KEEPER);
            try vault.defend(CANONICAL_HEAD, CANONICAL_TAIL) {
                // If it succeeded despite not being defendable
                if (icrBefore >= triggerICR) {
                    ghost_defendSucceededWhenIcrAboveTrigger = true;
                }
            } catch {
                // Expected revert
            }
        }
    }
}
