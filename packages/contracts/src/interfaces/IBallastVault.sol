// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IBallastVault
 * @notice Interface for BallastVault instances defending individual MUSD troves on Mezo.
 */
interface IBallastVault {
    // --- Data Types ---
    struct Rule {
        bool enabled;
        uint64 triggerICR; // 1e18 precision (e.g. 1.20e18 = 120%)
        uint64 targetICR; // 1e18 precision (e.g. 1.50e18 = 150%)
        uint16 maxTipBps; // Basis points (e.g. 50 = 0.50%, max 100 = 1.00%)
    }

    // --- Custom Errors ---
    error Unauthorized();
    error AlreadyInitialized();
    error ZeroAddress();
    error RuleDisabled();
    error TroveNotActive();
    error ICRNotDefendable();
    error InsufficientReserves();
    error ICRDidNotImprove();
    error InvalidTriggerICR();
    error InvalidTargetICR();
    error InvalidMaxTipBps();
    error BtcTransferFailed();
    error MusdTransferFailed();
    error ZeroAmount();

    // --- Events ---
    event RuleSet(
        address indexed vault, bool enabled, uint64 triggerICR, uint64 targetICR, uint16 maxTipBps
    );

    event ReserveDeposited(
        address indexed vault, address indexed asset, uint256 amount, uint256 newReserve
    );

    event ReserveWithdrawn(
        address indexed vault, address indexed asset, uint256 amount, uint256 newReserve
    );

    event Defended(
        address indexed vault,
        address indexed keeper,
        uint256 musdRepaid,
        uint256 btcAdded,
        uint256 musdTip,
        uint256 btcTip,
        uint256 oldICR,
        uint256 newICR
    );

    event TroveOpened(address indexed vault, uint256 debtAmount, uint256 collAmount);

    event TroveAdjusted(
        address indexed vault, uint256 collChange, uint256 debtChange, bool isDebtIncrease
    );

    event TroveClosed(address indexed vault);
    event CollateralClaimed(address indexed vault, uint256 amount);
    event AssetSwept(address indexed vault, address indexed token, uint256 amount);

    // --- Configuration & Reserves (Owner Only) ---

    /**
     * @notice Initializes the clone proxy with its borrower owner.
     * @param ownerAddress The address of the borrower owning this vault.
     */
    function initialize(address ownerAddress) external;

    /**
     * @notice Configures or updates the autonomous defense rule.
     * @param enabled Whether defense execution by keepers is permitted.
     * @param triggerICR Individual Collateral Ratio threshold below which defense triggers (1e18 precision).
     * @param targetICR Target Individual Collateral Ratio to restore the position to (1e18 precision).
     * @param maxTipBps Maximum percentage tip granted to the keeper in basis points (max 100 = 1.00%).
     */
    function setRule(bool enabled, uint64 triggerICR, uint64 targetICR, uint16 maxTipBps) external;

    /**
     * @notice Deposits MUSD into the vault's tracked defense reserve.
     * @param amount The wei amount of MUSD to transfer from caller.
     */
    function depositMUSD(uint256 amount) external;

    /**
     * @notice Deposits native BTC into the vault's tracked defense reserve.
     */
    function depositBTC() external payable;

    /**
     * @notice Withdraws MUSD from the tracked reserve to the owner.
     * @param amount The wei amount of MUSD to withdraw.
     */
    function withdrawMUSD(uint256 amount) external;

    /**
     * @notice Withdraws native BTC from the tracked reserve to the owner.
     * @param amount The wei amount of BTC to withdraw.
     */
    function withdrawBTC(uint256 amount) external;

    /**
     * @notice Sweeps non-reserve ERC20 tokens or untracked native BTC to the owner.
     * @param token Address of ERC20 token, or address(0) for native BTC.
     */
    function sweep(address token) external;

    // --- Trove Management Wrappers (Owner Only) ---

    /**
     * @notice Opens a new trove on Mezo owned by this vault.
     * @param debtAmount Amount of MUSD to borrow.
     * @param upperHint SortedTroves upper neighbor hint.
     * @param lowerHint SortedTroves lower neighbor hint.
     */
    function openTrove(uint256 debtAmount, address upperHint, address lowerHint) external payable;

    /**
     * @notice Opens a new trove on Mezo owned by this vault, delivering borrowed MUSD to a recipient.
     * @param debtAmount Amount of MUSD to borrow.
     * @param upperHint SortedTroves upper neighbor hint.
     * @param lowerHint SortedTroves lower neighbor hint.
     * @param recipient The recipient of borrowed MUSD (defaults to owner if address(0)).
     */
    function openTrove(uint256 debtAmount, address upperHint, address lowerHint, address recipient)
        external
        payable;

    /**
     * @notice Borrows additional MUSD from the vault's trove.
     * @param amount Amount of MUSD to borrow.
     * @param upperHint SortedTroves upper neighbor hint.
     * @param lowerHint SortedTroves lower neighbor hint.
     * @param recipient Address to receive borrowed MUSD.
     */
    function borrowMore(uint256 amount, address upperHint, address lowerHint, address recipient)
        external;

    /**
     * @notice Adds collateral BTC to the vault's trove.
     * @param upperHint SortedTroves upper neighbor hint.
     * @param lowerHint SortedTroves lower neighbor hint.
     */
    function addCollateral(address upperHint, address lowerHint) external payable;

    /**
     * @notice Repays MUSD debt using owner-supplied tokens.
     * @param amount Amount of MUSD to repay.
     * @param upperHint SortedTroves upper neighbor hint.
     * @param lowerHint SortedTroves lower neighbor hint.
     */
    function repay(uint256 amount, address upperHint, address lowerHint) external;

    /**
     * @notice Withdraws collateral BTC from the vault's trove to the owner.
     * @param amount Amount of BTC collateral to withdraw.
     * @param upperHint SortedTroves upper neighbor hint.
     * @param lowerHint SortedTroves lower neighbor hint.
     */
    function withdrawCollateral(uint256 amount, address upperHint, address lowerHint) external;

    /**
     * @notice Adjusts the trove's collateral and debt simultaneously.
     * @param collWithdrawal Amount of BTC collateral to withdraw.
     * @param debtChange Amount of MUSD debt to borrow or repay.
     * @param isDebtIncrease True to borrow, false to repay.
     * @param upperHint SortedTroves upper neighbor hint.
     * @param lowerHint SortedTroves lower neighbor hint.
     */
    function adjustTrove(
        uint256 collWithdrawal,
        uint256 debtChange,
        bool isDebtIncrease,
        address upperHint,
        address lowerHint
    ) external payable;

    /**
     * @notice Closes the vault's trove, returning collateral and leftover reserves to the owner.
     */
    function closeTrove() external;

    /**
     * @notice Claims surplus collateral from redemption/liquidation pools to the owner.
     */
    function claimCollateral() external;

    // --- Keeper & Public Automation ---

    /**
     * @notice Executes defense on this vault if ICR is below configured trigger.
     * @param upperHint SortedTroves upper neighbor hint.
     * @param lowerHint SortedTroves lower neighbor hint.
     * @return musdRepaid Amount of MUSD debt repaid.
     * @return btcAdded Amount of native BTC collateral added.
     */
    function defend(address upperHint, address lowerHint)
        external
        returns (uint256 musdRepaid, uint256 btcAdded);

    /**
     * @notice Evaluates whether this vault currently requires and can execute defense.
     * @return defendable True if ICR is below trigger and reserves permit action.
     * @return currentICR Current Individual Collateral Ratio in 1e18 precision.
     * @return musdToRepay Projected MUSD repayment amount.
     * @return btcToAdd Projected BTC collateral addition amount.
     */
    function checkDefense()
        external
        view
        returns (bool defendable, uint256 currentICR, uint256 musdToRepay, uint256 btcToAdd);

    // --- View State ---

    function owner() external view returns (address);
    function rule()
        external
        view
        returns (bool enabled, uint64 triggerICR, uint64 targetICR, uint16 maxTipBps);
    function musdReserve() external view returns (uint256);
    function btcReserve() external view returns (uint256);
}
