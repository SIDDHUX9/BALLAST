// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IBallastFactory
 * @notice Factory interface for deploying deterministic, minimal proxy BallastVaults per owner.
 */
interface IBallastFactory {
    // --- Custom Errors ---
    error VaultAlreadyExists(address owner, address vault);
    error ZeroAddress();
    error InitializationFailed();

    // --- Events ---
    event VaultCreated(address indexed owner, address indexed vault);

    /**
     * @notice Deploys a new BallastVault clone for the caller and initializes it.
     * @return vault The address of the newly deployed BallastVault proxy.
     */
    function createVault() external returns (address vault);

    /**
     * @notice Computes the deterministic CREATE2 address for a given owner's vault.
     * @param owner The address of the borrower.
     * @return The predicted proxy address.
     */
    function predictVault(address owner) external view returns (address);

    /**
     * @notice Returns the address of the deployed vault for a given owner.
     * @param owner The address of the borrower.
     * @return The deployed vault address, or address(0) if not yet created.
     */
    function vaultOf(address owner) external view returns (address);

    /**
     * @notice Returns the address of the master BallastVault implementation contract.
     * @return The implementation address.
     */
    function implementation() external view returns (address);
}
