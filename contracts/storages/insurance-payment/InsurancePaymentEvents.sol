pragma solidity >=0.5.0 <0.7.0;
pragma experimental ABIEncoderV2;

import { FixedProductMarketMaker } from "@gnosis.pm/conditional-tokens-market-makers/contracts/FixedProductMarketMaker.sol";


contract InsurancePaymentEvents {

    event TransactionClaimed(
        bytes32 indexed claimHash,
        uint indexed availableTime,
        address indexed to,
        uint value,
        bytes data,
        FixedProductMarketMaker fpmm
    );

    event TransactionClaimResolved(
        bytes32 indexed claimHash,
        uint indexed availableTime,
        address indexed to,
        bool executed
    );

    event EpochPassed(
        uint indexed epochEndTime,
        uint timeResolved,
        uint resultStonkPrice
    );

}
