// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { IBallastFactory } from "./interfaces/IBallastFactory.sol";
import { IBallastVault } from "./interfaces/IBallastVault.sol";

/**
 * @title BallastFactory
 * @notice Immutable, trustless factory deploying deterministic minimal proxy BallastVaults.
 * @dev Uses OpenZeppelin Clones with CREATE2 for deterministic address calculation.
 *      Has zero admin keys, zero owner privileges, no pause mechanisms, and no fees.
 */
contract BallastFactory is IBallastFactory {
    /// @inheritdoc IBallastFactory
    address public immutable override implementation;

    /// @inheritdoc IBallastFactory
    mapping(address => address) public override vaultOf;

    /**
     * @notice Deploys the factory with the immutable master implementation contract.
     * @param _implementation Address of the pre-deployed BallastVault implementation.
     */
    constructor(address _implementation) {
        if (_implementation == address(0)) revert ZeroAddress();
        implementation = _implementation;
    }

    /**
     * @notice Computes the deterministic CREATE2 address for a given owner's vault.
     * @param owner The address of the borrower.
     * @return Predicted address of the clone proxy.
     */
    function predictVault(address owner) external view override returns (address) {
        if (owner == address(0)) revert ZeroAddress();
        bytes32 salt = keccak256(abi.encode(owner));
        return Clones.predictDeterministicAddress(implementation, salt, address(this));
    }

    /**
     * @notice Deploys a new BallastVault minimal proxy for the caller and initializes it.
     * @return vault The address of the deployed proxy.
     */
    function createVault() external override returns (address vault) {
        address existing = vaultOf[msg.sender];
        if (existing != address(0)) {
            revert VaultAlreadyExists(msg.sender, existing);
        }

        bytes32 salt = keccak256(abi.encode(msg.sender));
        vault = Clones.cloneDeterministic(implementation, salt);

        vaultOf[msg.sender] = vault;
        emit VaultCreated(msg.sender, vault);

        IBallastVault(vault).initialize(msg.sender);
    }
}
