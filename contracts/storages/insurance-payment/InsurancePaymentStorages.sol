pragma solidity >=0.5.0 <0.7.0;
pragma experimental ABIEncoderV2;

import { InsurancePaymentObjects } from "./InsurancePaymentObjects.sol";

import { FixedProductMarketMaker } from "@gnosis.pm/conditional-tokens-market-makers/contracts/FixedProductMarketMaker.sol";


contract InsurancePaymentStorages is InsurancePaymentObjects {

    mapping (bytes32 => FixedProductMarketMaker) claimedTransactions;

}
