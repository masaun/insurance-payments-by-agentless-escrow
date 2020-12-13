pragma solidity >=0.5.0 <0.7.0;
pragma experimental ABIEncoderV2;

contract InsurancePaymentObjects {

    struct TransactionProposal {
        uint availableTime;

        address to;
        uint value;
        bytes data;
    }

}