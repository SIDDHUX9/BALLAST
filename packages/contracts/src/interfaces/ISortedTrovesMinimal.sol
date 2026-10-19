// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ISortedTrovesMinimal {
    function findInsertPosition(
        uint256 _NICR,
        address _prevId,
        address _nextId
    ) external view returns (address, address);

    function contains(address _id) external view returns (bool);
}
