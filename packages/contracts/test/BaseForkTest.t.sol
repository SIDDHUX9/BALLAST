// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {BallastFactory} from "../src/BallastFactory.sol";
import {BallastVault} from "../src/BallastVault.sol";
import {IBallastVault} from "../src/interfaces/IBallastVault.sol";
import {IBorrowerOperationsMinimal} from "../src/interfaces/IBorrowerOperationsMinimal.sol";
import {ITroveManagerMinimal} from "../src/interfaces/ITroveManagerMinimal.sol";
import {IPriceFeedMinimal} from "../src/interfaces/IPriceFeedMinimal.sol";
import {IMUSDMinimal} from "../src/interfaces/IMUSDMinimal.sol";
import {ISortedTrovesMinimal} from "../src/interfaces/ISortedTrovesMinimal.sol";
import {IHintHelpersMinimal} from "../src/interfaces/IHintHelpersMinimal.sol";

abstract contract BaseForkTest is Test {
    // Pinned block on Mezo Testnet (Matsnet, Chain ID 31611) for deterministic fork state
    uint256 public constant FORK_BLOCK = 16250250;
    string public constant DEFAULT_RPC_URL = "https://rpc.test.mezo.org";

    // Canonical Mezo Protocol Addresses (Derived from protocol reconnaissance and deployments)
    address public constant BORROWER_OPERATIONS = 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5;
    address public constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address public constant PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;
    address public constant MUSD_TOKEN = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address public constant SORTED_TROVES = 0x722E4D24FD6Ff8b0AC679450F3D91294607268fA;
    address public constant HINT_HELPERS = 0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6;

    // Protocol Constants
    uint256 public constant MCR = 1.10e18; // 110%
    uint256 public constant CCR = 1.50e18; // 150%
    uint256 public constant MIN_NET_DEBT = 1800e18; // 1,800 MUSD
    uint256 public constant MUSD_GAS_COMPENSATION = 200e18; // 200 MUSD

    // Core Ballast Deployments
    BallastVault public implementation;
    BallastFactory public factory;

    // Test actors
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public keeper = address(0xDEFE4D);

    uint256 public forkId;

    function setUp() public virtual {
        string memory rpcUrl = vm.envOr("MATSNET_RPC_URL", DEFAULT_RPC_URL);
        forkId = vm.createSelectFork(rpcUrl, FORK_BLOCK);

        // Deploy Ballast implementation with canonical Mezo protocol addresses
        implementation = new BallastVault(
            BORROWER_OPERATIONS,
            TROVE_MANAGER,
            PRICE_FEED,
            MUSD_TOKEN,
            SORTED_TROVES
        );

        // Deploy BallastFactory
        factory = new BallastFactory(address(implementation));

        // Mock canonical PriceFeed fetchPrice to 80,000 USD (80,000e18).
        // Reason: Mezo's on-chain PriceFeed delegates to an L2-specific precompile (0x7b7c...0015)
        // not activated in local EVM fork engines.
        _mockBtcPrice(80_000e18);

        // Fund test accounts with native BTC
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(keeper, 10 ether);
    }

    /**
     * @notice Helper to mock the BTC price on PriceFeed.
     * @dev PERMITTED TEST DOUBLE EXCEPTION:
     *      `vm.mockCall` on PriceFeed is the ONLY permitted test double in this suite.
     *      Reason: To test liquidation and keeper defense triggers deterministically,
     *      we must simulate downward price drawdowns on the oracle without waiting
     *      for real market crashes or breaking other protocol components.
     */
    function _mockBtcPrice(uint256 newPrice) internal {
        vm.mockCall(
            PRICE_FEED,
            abi.encodeWithSelector(IPriceFeedMinimal.fetchPrice.selector),
            abi.encode(newPrice)
        );
    }

    address public constant CANONICAL_HEAD = 0x52d033E64774F31A8B7562806aA5782CbbD29382;
    address public constant CANONICAL_TAIL = 0xDA04759E54728B6636Fe48F7c9795c7B609bAaAa;

    /**
     * @notice Computes exact upper and lower hints for a given collateral and debt.
     * @dev Uses findInsertPosition starting between head and tail to locate hints efficiently.
     */
    function _getHints(uint256 coll, uint256 debt) internal view returns (address upperHint, address lowerHint) {
        if (debt == 0) return (address(0), address(0));
        uint256 nicr = (coll * 1e20) / debt;
        return ISortedTrovesMinimal(SORTED_TROVES).findInsertPosition(nicr, CANONICAL_HEAD, CANONICAL_TAIL);
    }

    /**
     * @notice Funds a recipient with MUSD tokens using forge-std deal.
     */
    function _fundMusd(address recipient, uint256 amount) internal {
        deal(MUSD_TOKEN, recipient, amount);
    }
}
