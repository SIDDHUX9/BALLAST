// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ITroveManagerMinimal {
    enum Status {
        nonExistent,
        active,
        closedByOwner,
        closedByLiquidation,
        closedByRedemption
    }

    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256);

    function getEntireDebtAndColl(address _borrower)
        external
        view
        returns (
            uint256 coll,
            uint256 principal,
            uint256 interest,
            uint256 pendingCollateral,
            uint256 pendingPrincipal,
            uint256 pendingInterest
        );

    function getTroveDebt(address _borrower) external view returns (uint256);

    function getTroveColl(address _borrower) external view returns (uint256);

    function getTroveStatus(address _borrower) external view returns (Status);

    function MCR() external view returns (uint256);

    function CCR() external view returns (uint256);

    function checkRecoveryMode(uint256 _price) external view returns (bool);

    function getTCR(uint256 _price) external view returns (uint256);

    function priceFeed() external view returns (address);
}
