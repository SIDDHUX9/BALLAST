// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseForkTest} from "./BaseForkTest.t.sol";
import {BallastVault} from "../src/BallastVault.sol";
import {IBallastVault} from "../src/interfaces/IBallastVault.sol";
import {ITroveManagerMinimal} from "../src/interfaces/ITroveManagerMinimal.sol";
import {IMUSDMinimal} from "../src/interfaces/IMUSDMinimal.sol";

/**
 * @notice Mock Smart Account representing a Mezo Passport Bitcoin-wallet smart account.
 * @dev Validates that Ballast operates seamlessly with smart contract owners that receive native BTC.
 */
contract MockSmartAccountWallet {
    uint256 public btcReceivedTotal;

    receive() external payable {
        btcReceivedTotal += msg.value;
    }

    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "SmartAccount call failed");
        return result;
    }
}

contract BallastSmartAccountForkTest is BaseForkTest {
    MockSmartAccountWallet public smartAccount;
    BallastVault public vault;

    function setUp() public override {
        super.setUp();

        smartAccount = new MockSmartAccountWallet();
        vm.deal(address(smartAccount), 50 ether);

        // Smart account creates its BallastVault
        bytes memory createData = abi.encodeWithSelector(factory.createVault.selector);
        bytes memory ret = smartAccount.execute(address(factory), 0, createData);
        address vaultAddr = abi.decode(ret, (address));
        vault = BallastVault(payable(vaultAddr));
    }

    function test_smartAccount_ownerLifecycleAndReceivesBtcRefunds() public {
        assertEq(vault.owner(), address(smartAccount), "Vault owner must be the smart account address");

        // 1. Smart account opens a trove with 3 BTC and 3,000 MUSD
        uint256 coll = 3 ether;
        uint256 debt = 3000e18;
        (address u, address l) = _getHints(coll, debt);

        bytes memory openData = abi.encodeWithSignature(
            "openTrove(uint256,address,address,address)",
            debt,
            u,
            l,
            address(smartAccount)
        );
        smartAccount.execute(address(vault), coll, openData);

        assertEq(
            uint256(ITroveManagerMinimal(TROVE_MANAGER).getTroveStatus(address(vault))),
            uint256(ITroveManagerMinimal.Status.active),
            "Trove owned by smart account must be active"
        );

        // 2. Smart account configures rule and deposits reserves
        _fundMusd(address(smartAccount), 2000e18);

        smartAccount.execute(
            MUSD_TOKEN,
            0,
            abi.encodeWithSelector(IMUSDMinimal.approve.selector, address(vault), 1000e18)
        );

        smartAccount.execute(
            address(vault),
            0,
            abi.encodeWithSelector(vault.depositMUSD.selector, 1000e18)
        );

        smartAccount.execute(
            address(vault),
            1 ether,
            abi.encodeWithSelector(vault.depositBTC.selector)
        );

        assertEq(vault.musdReserve(), 1000e18);
        assertEq(vault.btcReserve(), 1 ether);

        // 3. Smart account withdraws 0.5 BTC collateral - must receive native BTC via low-level call
        (address u2, address l2) = _getHints(coll - 0.5 ether, debt);
        uint256 smartAccountBtcBefore = address(smartAccount).balance;

        smartAccount.execute(
            address(vault),
            0,
            abi.encodeWithSelector(vault.withdrawCollateral.selector, 0.5 ether, u2, l2)
        );

        assertEq(
            address(smartAccount).balance - smartAccountBtcBefore,
            0.5 ether,
            "Smart account wallet must receive native BTC refund"
        );

        // 4. Smart account closes trove - recovers all collateral and leftover BTC/MUSD reserves
        uint256 totalDebt = ITroveManagerMinimal(TROVE_MANAGER).getTroveDebt(address(vault));
        uint256 netDebt = totalDebt > MUSD_GAS_COMPENSATION ? totalDebt - MUSD_GAS_COMPENSATION : 0;
        uint256 shortfall = netDebt > 1000e18 ? netDebt - 1000e18 : 0;

        _fundMusd(address(smartAccount), shortfall + 100e18);
        smartAccount.execute(
            MUSD_TOKEN,
            0,
            abi.encodeWithSelector(IMUSDMinimal.approve.selector, address(vault), shortfall)
        );

        uint256 btcBeforeClose = address(smartAccount).balance;
        smartAccount.execute(
            address(vault),
            0,
            abi.encodeWithSelector(vault.closeTrove.selector)
        );

        // Recovered 2.5 BTC remaining collateral + 1 BTC reserve = 3.5 BTC total
        assertEq(
            address(smartAccount).balance - btcBeforeClose,
            3.5 ether,
            "Smart account must recover full BTC collateral and reserves on close"
        );

        assertEq(
            uint256(ITroveManagerMinimal(TROVE_MANAGER).getTroveStatus(address(vault))),
            uint256(ITroveManagerMinimal.Status.closedByOwner)
        );
    }
}
