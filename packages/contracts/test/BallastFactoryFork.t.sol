// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseForkTest} from "./BaseForkTest.t.sol";
import {BallastFactory} from "../src/BallastFactory.sol";
import {BallastVault} from "../src/BallastVault.sol";
import {IBallastFactory} from "../src/interfaces/IBallastFactory.sol";
import {IBallastVault} from "../src/interfaces/IBallastVault.sol";

contract BallastFactoryForkTest is BaseForkTest {
    function test_factory_predictsDeterministicAddress() public {
        address predicted = factory.predictVault(alice);
        assertTrue(predicted != address(0));

        vm.prank(alice);
        address vault = factory.createVault();

        assertEq(vault, predicted, "Predicted address must match deployed clone address");
        assertEq(factory.vaultOf(alice), vault);
    }

    function test_factory_deploysOneVaultPerOwner() public {
        vm.prank(alice);
        address vaultAlice = factory.createVault();

        vm.prank(bob);
        address vaultBob = factory.createVault();

        assertTrue(vaultAlice != vaultBob, "Different owners must receive distinct vaults");
        assertEq(factory.vaultOf(alice), vaultAlice);
        assertEq(factory.vaultOf(bob), vaultBob);
    }

    function test_factory_revertsIfOwnerAlreadyHasVault() public {
        vm.prank(alice);
        address vault = factory.createVault();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IBallastFactory.VaultAlreadyExists.selector, alice, vault));
        factory.createVault();
    }

    function test_factory_cloneCannotBeReinitialized() public {
        vm.prank(alice);
        address vault = factory.createVault();

        vm.prank(bob);
        vm.expectRevert(IBallastVault.AlreadyInitialized.selector);
        IBallastVault(vault).initialize(bob);
    }

    function test_factory_implementationCannotBeInitialized() public {
        assertEq(implementation.owner(), address(1), "Implementation owner must be address(1)");

        vm.expectRevert(IBallastVault.AlreadyInitialized.selector);
        implementation.initialize(alice);
    }

    function test_factory_predictRevertsOnZeroAddress() public {
        vm.expectRevert(IBallastFactory.ZeroAddress.selector);
        factory.predictVault(address(0));
    }

    function test_factory_constructorRevertsOnZeroAddress() public {
        vm.expectRevert(IBallastFactory.ZeroAddress.selector);
        new BallastFactory(address(0));
    }
}
