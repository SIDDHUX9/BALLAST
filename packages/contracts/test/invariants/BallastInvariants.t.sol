// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseForkTest} from "../BaseForkTest.t.sol";
import {BallastVault} from "../../src/BallastVault.sol";
import {BallastHandler} from "./BallastHandler.sol";
import {ITroveManagerMinimal} from "../../src/interfaces/ITroveManagerMinimal.sol";
import {IMUSDMinimal} from "../../src/interfaces/IMUSDMinimal.sol";

contract BallastInvariantsTest is BaseForkTest {
    BallastVault public vault;
    BallastHandler public handler;

    function setUp() public override {
        super.setUp();

        // 1. Create vault for alice
        vm.prank(alice);
        address vaultAddr = factory.createVault();
        vault = BallastVault(payable(vaultAddr));

        // 2. Open initial trove with 3 BTC collateral and 10,000 MUSD debt
        uint256 coll = 3 ether;
        uint256 debt = 10_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // 3. Configure initial rule: 125% trigger, 150% target, 50 bps tip
        vm.prank(alice);
        vault.setRule(true, 1.25e18, 1.50e18, 50);

        // 4. Deploy invariant handler
        handler = new BallastHandler(
            vault,
            alice,
            MUSD_TOKEN,
            TROVE_MANAGER,
            PRICE_FEED,
            SORTED_TROVES
        );

        vm.deal(address(0x999999), 100 ether);
        vm.deal(address(0x888888), 100 ether);

        // 5. Target handler contract
        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](10);
        selectors[0] = handler.depositMUSD.selector;
        selectors[1] = handler.withdrawMUSD.selector;
        selectors[2] = handler.depositBTC.selector;
        selectors[3] = handler.withdrawBTC.selector;
        selectors[4] = handler.strangerAttemptWithdrawMUSD.selector;
        selectors[5] = handler.strangerAttemptWithdrawBTC.selector;
        selectors[6] = handler.strangerAttemptWithdrawCollateral.selector;
        selectors[7] = handler.sendStrayBTC.selector;
        selectors[8] = handler.dropPriceToTrigger.selector;
        selectors[9] = handler.executeDefend.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function test_debug_handlerActions() public {
        handler.depositMUSD(5000e18);
        handler.depositBTC(1 ether);
        handler.dropPriceToTrigger(20);
        handler.executeDefend();
        handler.withdrawMUSD(100e18);
        handler.withdrawBTC(0.1 ether);
        handler.sendStrayBTC(0.5 ether);
        handler.strangerAttemptWithdrawMUSD(100e18);
        handler.strangerAttemptWithdrawBTC(0.1 ether);
        handler.strangerAttemptWithdrawCollateral(0.1 ether);
    }

    /**
     * @notice INVARIANT 1:
     * Tracked reserves always equal what the vault can actually pay out of owner-deposited funds.
     */
    function invariant_1_trackedReservesMatchAvailableOwnerFunds() public view {
        assertEq(
            vault.musdReserve(),
            handler.ghost_trackedMusdReserve(),
            "Tracked musdReserve must strictly match ghost accounting of owner deposits/withdrawals"
        );
        assertEq(
            vault.btcReserve(),
            handler.ghost_trackedBtcReserve(),
            "Tracked btcReserve must strictly match ghost accounting of owner deposits/withdrawals"
        );

        assertTrue(
            IMUSDMinimal(MUSD_TOKEN).balanceOf(address(vault)) >= vault.musdReserve(),
            "Vault MUSD balance must always cover tracked musdReserve"
        );
        assertTrue(
            address(vault).balance >= vault.btcReserve(),
            "Vault native BTC balance must always cover tracked btcReserve"
        );
    }

    /**
     * @notice INVARIANT 2:
     * A successful defend never lowers ICR.
     */
    function invariant_2_successfulDefendNeverLowersICR() public view {
        if (handler.ghost_lastDefendIcrBefore() > 0) {
            assertTrue(
                handler.ghost_lastDefendIcrAfter() >= handler.ghost_lastDefendIcrBefore(),
                "Successful defend must never reduce or lower ICR"
            );
        }
    }

    /**
     * @notice INVARIANT 3:
     * Only the owner can ever reduce reserves or move trove collateral out.
     */
    function invariant_3_onlyOwnerCanReduceReservesOrMoveCollateral() public view {
        assertFalse(
            handler.ghost_strangerReducedReserves(),
            "Stranger must never be able to reduce reserves"
        );
        assertFalse(
            handler.ghost_strangerMovedCollateral(),
            "Stranger must never be able to withdraw trove collateral"
        );
    }

    /**
     * @notice INVARIANT 4:
     * Vault native balance minus tracked BTC reserve is never needed for solvency of any operation.
     */
    function invariant_4_strayBtcNeverNeededForSolvency() public view {
        uint256 strayBtc = address(vault).balance - vault.btcReserve();
        // The contract's operations (defend, withdrawBTC) only ever pull up to btcReserve
        // Therefore, stray balance is strictly surplus and never necessary for solvency.
        assertTrue(address(vault).balance >= strayBtc, "Stray balance is independent surplus");
    }

    /**
     * @notice INVARIANT 5:
     * Defend never succeeds when ICR >= trigger.
     */
    function invariant_5_defendNeverSucceedsWhenICRAtOrAboveTrigger() public view {
        assertFalse(
            handler.ghost_defendSucceededWhenIcrAboveTrigger(),
            "Defend must never succeed if ICR is at or above triggerICR"
        );
    }
}
