// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { stdJson } from "forge-std/StdJson.sol";
import { BallastVault } from "../src/BallastVault.sol";
import { BallastFactory } from "../src/BallastFactory.sol";

/**
 * @title DeployScript
 * @notice Idempotent deployment script for BallastVault implementation and BallastFactory.
 * @dev Reads protocol addresses directly from packages/shared/protocol-addresses.json.
 */
contract DeployScript is Script {
    using stdJson for string;

    struct ProtocolConfig {
        address borrowerOperations;
        address troveManager;
        address musd;
        address priceFeed;
        address sortedTroves;
    }

    function run() external returns (address implementation, address factory) {
        string memory root = vm.projectRoot();
        string memory sharedProtocolPath = string.concat(root, "/../../packages/shared/protocol-addresses.json");
        string memory protocolJson = vm.readFile(sharedProtocolPath);

        ProtocolConfig memory proto = ProtocolConfig({
            borrowerOperations: protocolJson.readAddress(".matsnet.borrowerOperations"),
            troveManager: protocolJson.readAddress(".matsnet.troveManager"),
            musd: protocolJson.readAddress(".matsnet.musd"),
            priceFeed: protocolJson.readAddress(".matsnet.priceFeed"),
            sortedTroves: protocolJson.readAddress(".matsnet.sortedTroves")
        });

        console2.log("=== Ballast Deployment Script ===");
        console2.log("Chain ID:", block.chainid);
        console2.log("BorrowerOperations:", proto.borrowerOperations);
        console2.log("TroveManager:", proto.troveManager);
        console2.log("MUSD:", proto.musd);
        console2.log("PriceFeed:", proto.priceFeed);
        console2.log("SortedTroves:", proto.sortedTroves);

        // Check if deployment already exists for idempotency
        string memory deploymentsPath = string.concat(root, "/../../deployments/matsnet.json");
        if (vm.isFile(deploymentsPath)) {
            try vm.readFile(deploymentsPath) returns (string memory existingJson) {
                if (bytes(existingJson).length > 0) {
                    try vm.parseJsonAddress(existingJson, ".ballastVaultImplementation") returns (address existingImpl) {
                        if (existingImpl.code.length > 0) {
                            implementation = existingImpl;
                            console2.log("Reusing existing BallastVault implementation:", implementation);
                        }
                    } catch {}
                    try vm.parseJsonAddress(existingJson, ".ballastFactory") returns (address existingFactory) {
                        if (existingFactory.code.length > 0) {
                            factory = existingFactory;
                            console2.log("Reusing existing BallastFactory:", factory);
                        }
                    } catch {}
                }
            } catch {}
        }

        vm.startBroadcast();

        if (implementation == address(0)) {
            console2.log("Deploying new BallastVault implementation...");
            BallastVault vaultImpl = new BallastVault(
                proto.borrowerOperations,
                proto.troveManager,
                proto.priceFeed,
                proto.musd,
                proto.sortedTroves
            );
            implementation = address(vaultImpl);
            console2.log("Deployed BallastVault implementation at:", implementation);
        }

        if (factory == address(0)) {
            console2.log("Deploying new BallastFactory pointing to:", implementation);
            BallastFactory ballastFactory = new BallastFactory(implementation);
            factory = address(ballastFactory);
            console2.log("Deployed BallastFactory at:", factory);
        }

        vm.stopBroadcast();

        console2.log("=== Deployment Summary ===");
        console2.log("BallastVault Implementation:", implementation);
        console2.log("BallastFactory:", factory);
        console2.log("Current Block:", block.number);
    }
}
