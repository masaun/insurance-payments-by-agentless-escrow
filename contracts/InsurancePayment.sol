pragma solidity >=0.5.0 <0.7.0;
pragma experimental ABIEncoderV2;

import { InsurancePaymentStorages } from "./storages/insurance-payment/InsurancePaymentStorages.sol";
import { InsurancePaymentEvents } from "./storages/insurance-payment/InsurancePaymentEvents.sol";

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IUniswapFactory } from "project-name/contracts/interfaces/IUniswapFactory.sol";
import { IUniswapExchange } from "project-name/contracts/interfaces/IUniswapExchange.sol";
import { ConditionalTokens } from "@gnosis.pm/conditional-tokens-contracts/contracts/ConditionalTokens.sol";
import { CTHelpers } from "@gnosis.pm/conditional-tokens-contracts/contracts/CTHelpers.sol";
import { FixedProductMarketMaker } from "@gnosis.pm/conditional-tokens-market-makers/contracts/FixedProductMarketMaker.sol";
import { FPMMDeterministicFactory, IERC20 } from "@gnosis.pm/conditional-tokens-market-makers/contracts/FPMMDeterministicFactory.sol";
import { WETH9 } from "canonical-weth/contracts/WETH9.sol";


contract InsurancePayment is ERC20, InsurancePaymentStorages, InsurancePaymentEvents {
    using SafeMath for uint;

    /// [Note]: A conditionl token data (as an ERC20 token)
    string public constant name = "Insurance Payment Token";
    string public constant symbol = "INSUPAY";
    uint public constant decimals = 18;

    /// [Note]: Uniswap V1
    IUniswapFactory public uniswapFactory;
    IUniswapExchange public uniswapExchange;

    ConditionalTokens public conditionalTokens;
    FPMMDeterministicFactory public fpmmFactory;
    WETH9 public weth;

    address payable public exchange;              /// [Note]: Pool (exchange) address between InsupayToken/ETH

    uint constant START_AMOUNT = 100 ether;
    //uint public constant EPOCH_PERIOD = 86400;  /// [Note]: 1 day == 86400 second
    uint public constant EPOCH_PERIOD = 10;       /// [Note]: 10 second    
    uint constant FPMM_FEE = 0.01 ether;

    uint public startTime;
    uint public nextMarketCapPollTime;
    uint public lastInsupayPrice;

    constructor(WETH9 _weth, IUniswapFactory _uniswapFactory, ConditionalTokens _conditionalTokens, FPMMDeterministicFactory _fpmmFactory) public {
        weth = _weth;
        uniswapFactory = _uniswapFactory;
        conditionalTokens = _conditionalTokens;
        fpmmFactory = _fpmmFactory;
    }

    /***
     * @notice - Set up with Uniswap V1
     **/
    function setup() external payable {
        require(address(uniswapExchange) == address(0), "already setup");
        /// Mint conditional tokens (ERC20)
        _mint(address(this), START_AMOUNT);

        /// Create exchange contract address of conditional tokens (ERC20)
        exchange = uniswapFactory.createExchange(address(this));
        //address payable exchange = uniswapFactory.createExchange(address(this));

        /// Create Uniswap v1 pool (pair is Conditional tokens/ETH) by adding liquidity
        _approve(address(this), exchange, START_AMOUNT);
        IUniswapExchange(exchange).addLiquidity.value(msg.value)(0, START_AMOUNT, uint(-1));
        lastInsupayPrice = uint(1 ether).mul(exchange.balance) / balanceOf(exchange);

        uniswapExchange = IUniswapExchange(exchange);
        startTime = block.timestamp;
        nextMarketCapPollTime = startTime.add(EPOCH_PERIOD);
    }


    /***
     * @notice - Claim a insurance payment
     **/
    function claim(TransactionClaim calldata claim) external payable {
        bytes32 claimHash = keccak256(abi.encode(claim));

        /// Check this claim (the TransactionClaim struct) is initialized or not
        require(
            claimedTransactions[claimHash] == FixedProductMarketMaker(0),
            "transaction already claimed"
        );

        /// [Note]: Claim's available time must be after start time.
        require(
            claim.availableTime.sub(startTime) != 0, 
            "claim time must be after"
        );

        /// [Note]: Original condtion
        // require(
        //     claim.availableTime.sub(startTime, "claim time must be after") % EPOCH_PERIOD == 0,
        //     "claim available time must be aligned"
        // );

        require(
            claim.availableTime > block.timestamp + EPOCH_PERIOD,
            "claim must have an epoch for deciding"
        );

        /// Create a condition (condition ID)
        conditionalTokens.prepareCondition(address(this), claimHash, 2);
        bytes32 txConditionId = keccak256(abi.encodePacked(address(this), claimHash, uint(2)));

        bytes32 pollConditionId = CTHelpers.getConditionId(
            address(this),
            bytes32(claim.availableTime.add(EPOCH_PERIOD)),
            2
        );

        if (conditionalTokens.getOutcomeSlotCount(pollConditionId) == 0) {
            conditionalTokens.prepareCondition(
                address(this),
                bytes32(claim.availableTime.add(EPOCH_PERIOD)),
                2
            );
        }

        bytes32[] memory conditionIds = new bytes32[](2);
        conditionIds[0] = pollConditionId;
        conditionIds[1] = txConditionId;

        /// Create a prediction market for a condition above
        FixedProductMarketMaker fpmm = fpmmFactory.create2FixedProductMarketMaker(
            uint(bytes32("LAND OF ECODELIA")),
            conditionalTokens,
            IERC20(address(weth)),
            conditionIds,
            FPMM_FEE,
            0,
            new uint[](0)
        );

        claimedTransactions[claimHash] = fpmm;

        emit TransactionClaimed(
            claimHash,
            claim.availableTime,
            claim.to,
            claim.value,
            claim.data,
            fpmm
        );
    }


    /***
     * @notice - Buy INSUPAY tokens (=conditional tokens)
     * @param deadline - Transaction deadline
     **/
    function buyInsupayToken(uint insupayPurchaseAmount, uint deadline) public payable returns (bool) {
        /// [Note]: A user need to send ETH (Sent ETH amount is amount that they want to exchange) in advance
        uint purchasedInsupayAmount = uniswapExchange.ethToTokenSwapInput(insupayPurchaseAmount, deadline);

        /// Back insupay tokens to a user (msg.sender)
        transfer(msg.sender, purchasedInsupayAmount);
    }

    /***
     * @notice - Sell INSUPAY tokens (=conditional tokens)
     * @param insupaySaleAmount - Minimum conditional tokens (ERC20 tokens) sold
     * @param deadline - Transaction deadline
     **/
    function sellInsupayToken(uint insupaySaleAmount, uint minEthAmount, uint deadline) public payable returns (bool) {
        uint ethBought = uniswapExchange.tokenToEthSwapInput(insupaySaleAmount,  minEthAmount, deadline);

        /// Back ETH to a user (msg.sender)
        msg.sender.transfer(ethBought);
    }


    /***
     * @notice - Judge whether it doed insurance payment or do not insurance payment
     **/
    function payOrDoNotPay(TransactionClaim calldata claim) external payable {
        /// Create a FixedProductMarketMaker instance by assigning a existing claim (the TransactionClaim struct)
        bytes32 claimHash = keccak256(abi.encode(claim));

        FixedProductMarketMaker fpmm = claimedTransactions[claimHash];

        /// Check whether assigned claim is existing or not
        require(fpmm != FixedProductMarketMaker(0), "transaction missing");

        uint[] memory balances;

        /// Define positions for this claim (In case of this claim, 4 positions are defined)
        {
            uint[] memory positionIds = new uint[](4);
            {
                bytes32 txConditionId = keccak256(abi.encodePacked(address(this), claimHash, uint(2)));

                bytes32 pollConditionId = CTHelpers.getConditionId(
                    address(this),
                    bytes32(claim.availableTime.add(EPOCH_PERIOD)),
                    2
                );

                /// Yes Lo
                positionIds[0] = CTHelpers.getPositionId(IERC20(address(weth)), CTHelpers.getCollectionId(
                    CTHelpers.getCollectionId(bytes32(0), txConditionId, 1),
                    pollConditionId, 1
                ));

                /// Yes Hi
                positionIds[1] = CTHelpers.getPositionId(IERC20(address(weth)), CTHelpers.getCollectionId(
                    CTHelpers.getCollectionId(bytes32(0), txConditionId, 1),
                    pollConditionId, 2
                ));
                
                /// No Lo
                positionIds[2] = CTHelpers.getPositionId(IERC20(address(weth)), CTHelpers.getCollectionId(
                    CTHelpers.getCollectionId(bytes32(0), txConditionId, 2),
                    pollConditionId, 1
                ));
                
                /// No Hi
                positionIds[3] = CTHelpers.getPositionId(IERC20(address(weth)), CTHelpers.getCollectionId(
                    CTHelpers.getCollectionId(bytes32(0), txConditionId, 2),
                    pollConditionId, 2
                ));
            }

            address[] memory exchangeArr = new address[](4);
            exchangeArr[0] = address(fpmm);
            exchangeArr[1] = address(fpmm);
            exchangeArr[2] = address(fpmm);
            exchangeArr[3] = address(fpmm);
            balances = conditionalTokens.balanceOfBatch(exchangeArr, positionIds);
        }

        uint[] memory payouts = new uint[](2);
        bool execute = balances[1].mul(balances[2]) > balances[0].mul(balances[3]);
        if (execute) {
            // do
            payouts[0] = 1; payouts[1] = 0;
            conditionalTokens.reportPayouts(claimHash, payouts);
            (bool success, bytes memory retdata) = claim.to.call.value(claim.value)(claim.data);
            require(success, string(retdata));
        } else {
            // do not
            payouts[0] = 0; payouts[1] = 1;
            conditionalTokens.reportPayouts(claimHash, payouts);
        }

        delete claimedTransactions[claimHash];

        emit TransactionClaimResolved(
            claimHash,
            claim.availableTime,
            claim.to,
            execute
        );
    }


    /***
     * @notice - Poke for result
     * @notice - "Insupay" is the symbol of conditonal token (ERC20)
     **/
    function poke() external payable {
        uint[] memory payouts = new uint[](2);
        address exchange = address(uniswapExchange);
        uint currentInsupayPrice = uint(1 ether).mul(exchange.balance) / balanceOf(exchange);
        uint loPrice = lastInsupayPrice / 2;
        uint hiPrice = loPrice.add(lastInsupayPrice);
        if (currentInsupayPrice < loPrice) {
            payouts[0] = 1;
            payouts[1] = 0;
        } else if (currentInsupayPrice > hiPrice) {
            payouts[0] = 0;
            payouts[1] = 1;
        } else {
            payouts[0] = hiPrice - currentInsupayPrice;
            payouts[1] = currentInsupayPrice - loPrice;
        }

        uint nextTime = nextMarketCapPollTime;
        while (nextTime <= now) {
            bytes32 pollConditionId = CTHelpers.getConditionId(
                address(this),
                bytes32(nextTime),
                2
            );
            if (conditionalTokens.getOutcomeSlotCount(pollConditionId) > 0) {
                conditionalTokens.reportPayouts(bytes32(nextTime), payouts);
            }
            emit EpochPassed(nextTime, now, currentInsupayPrice);
            nextTime = nextTime.add(EPOCH_PERIOD);
        }
        nextMarketCapPollTime = nextTime;
        lastInsupayPrice = currentInsupayPrice;
    }


    /***
     * @notice - Works for payable
     **/
    function() external payable {}



    ///------------------
    /// Getter methods
    ///------------------

    function getEthToTokenOutputPrice(uint256 insupayBoughtAmount) public view returns (uint256 ethSoldAmount) {
        return IUniswapExchange(exchange).getEthToTokenOutputPrice(insupayBoughtAmount);
    }

    function getTokenToEthInputPrice(uint256 insupaySaleAmount) public view returns (uint256 ethBoughtAmount) {
        return IUniswapExchange(exchange).getTokenToEthInputPrice(insupaySaleAmount);
    }

    function getReserve() public view returns (uint256 reserve) {
        
    }
    
}
