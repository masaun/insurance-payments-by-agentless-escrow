require('dotenv').config();

const Tx = require('ethereumjs-tx').Transaction;
const Web3 = require('web3');
const provider = new Web3.providers.HttpProvider(`https://goerli.infura.io/v3/${ process.env.INFURA_KEY }`);
const web3 = new Web3(provider);

/* Wallet */
const walletAddress1 = process.env.WALLET_ADDRESS_1;
const privateKey1 = process.env.PRIVATE_KEY_1;

/* Import contract addresses */
let contractAddressList = require('../../migrations/addressesList/contractAddress/contractAddress.js');

/* Set up contract */
let InsurancePayment = {};
InsurancePayment = require("../../build/contracts/InsurancePayment.json");
insurancePaymentABI = InsurancePayment.abi;
insurancePaymentAddr = InsurancePayment["networks"]["5"]["address"];
insurancePayment = new web3.eth.Contract(insurancePaymentABI, insurancePaymentAddr);


/***
 * @notice - Execute all methods
 **/
async function main() {
    await getStartTime();
    await getExchangeContractAddress();
    await claim();
    //await getReserve();
    await buyInsupayToken();
}
main();


///------------------------- 
/// Unit test
///-------------------------

/***
 * @notice - Get start time
 **/
async function getStartTime() {
    /// Get start time
    let startTime = await insurancePayment.methods.startTime().call();
    console.log('=== startTime ===', startTime);
}


/***
 * @notice - Get exchange contract address (InsurancePaymentToken/ETH)
 **/
async function getExchangeContractAddress() {
    let exchange = await insurancePayment.methods.exchange().call();
    console.log('=== exchange contract address (InsurancePaymentToken/ETH) ===', exchange);
}


/***
 * @notice - Claim a insurance payment
 **/
async function claim() {
    /// [Note]: "txClaim" is the TransactionClaim struct
    const txClaim = {
        availableTime: 1608422400,                             /// [Note]: Future timestamp 12/20, 2020, UTC 0:00 am (unit: second)
        //availableTime: 1607950030,                           /// [Note]: Current timestamp (unit: second)
        //availableTime: startTime,                            /// [Note]: Claim's available time must be same with start time.
        to: "0x718E3ea0B8C2911C5e54Cb4b9B2075fdd87B55a7",                           /// [Note]: 
        value: web3.utils.toWei('0.1', 'ether'),                                    /// [Note]: 0.1
        data: "0x0000000000000000000000000000000000000000000000000000000000000000"  /// [Note]: Data type is bytes32
    }

    const ethValue = '0';        /// 0 ETH (msg.value)

    let inputData1 = await insurancePayment.methods.claim(txClaim).encodeABI();
    let transaction1 = await sendTransaction(walletAddress1, privateKey1, insurancePaymentAddr, inputData1, ethValue);
}


/***
 * @notice - Get reserve of insupayTokens/ETH
 **/
// async function getReserve() {
//     let reserve = await insurancePayment.methods.getReserve().call();
//     console.log('=== reserve (insupayTokens/ETH) ===', reserve);
// }


/***
 * @notice - Buy insupay tokens (conditional tokens)
 **/
async function buyInsupayToken() {
    const insupayPurchaseAmount = '10000000000000000000';  /// 10 InsupayToken
    //const insupayPurchaseAmount = await web3.utils.toHex(web3.utils.toWei('0.001', 'ether')); 
    const deadline = Math.floor(new Date().getTime() / 1000) + 600;                              /// Now + 10 minutes (600 sec)

    /// Get ethOfferAmount
    // const ethSold = await insurancePayment.methods.getEthToTokenOutputPrice(insupayPurchaseAmount).call();  /// Result: e.g. 1004013040121366
    // const ethOfferAmount = await web3.utils.fromWei(ethSold, 'ether');
    // console.log('=== ethOfferAmount (ethSold) ===', ethOfferAmount);

    const ethOfferAmount = '10000000000000000';  /// 0.01 ETH;

    /// Execute 
    let IUniswapExchange = {};
    IUniswapExchange = require("../../build/contracts/IUniswapExchange.json");
    uniswapExchangeABI = IUniswapExchange.abi;
    uniswapExchangeAddr = await insurancePayment.methods.exchange().call();
    uniswapExchange = new web3.eth.Contract(uniswapExchangeABI, uniswapExchangeAddr);
    console.log('=== uniswapExchange ===\n', uniswapExchange);
    let inputData = await uniswapExchange.methods.ethToTokenSwapInput(insupayPurchaseAmount, deadline).encodeABI();
    let transaction = await sendTransaction(walletAddress1, privateKey1, insurancePaymentAddr, inputData, ethOfferAmount);   

    /// Execute buyInsupay
    // let inputData1 = await insurancePayment.methods.buyInsupayToken(insupayPurchaseAmount, deadline).encodeABI();
    // let transaction1 = await sendTransaction(walletAddress1, privateKey1, insurancePaymentAddr, inputData1, ethOfferAmount);
}

/***
 * @notice - Sell insupay tokens (conditional tokens)
 **/
async function sellInsupayToken() {
    const insupaySaleAmount = await web3.utils.toHex(web3.utils.toWei('0.001', 'ether'));  /// 0.01 ETH
    const deadline = Math.floor(new Date().getTime() / 1000) + 600;                        /// Now + 10 minutes (600 sec)

    /// Get minEthAmount
    const ethBought = await insurancePayment.methods.getTokenToEthInputPrice(insupaySaleAmount).call();
    const minEthAmount = await web3.utils.fromWei(ethBought, 'ether');
    console.log('=== minEthAmount (ethBought) ===', minEthAmount);  /// Result: e.g. 1004013040121366

    /// Approve
    let inputData1 = await insurancePayment.methods.approve(insurancePaymentAddr, insupaySaleAmount).encodeABI();
    let transaction1 = await sendTransaction(walletAddress1, privateKey1, insurancePaymentAddr, inputData1, ethOfferAmount);   

    /// Execute sellInsupay
    let inputData2 = await insurancePayment.methods.sellInsupayToken(insupaySaleAmount, minEthAmount, deadline).encodeABI();
    let transaction1 = await sendTransaction(walletAddress1, privateKey1, insurancePaymentAddr, inputData2, ethOfferAmount);
}


/***
 * @notice - Sign and Broadcast the transaction
 **/
async function sendTransaction(walletAddress, privateKey, contractAddress, inputData, ethValue) {
    try {
        const txCount = await web3.eth.getTransactionCount(walletAddress);
        const nonce = await web3.utils.toHex(txCount);
        console.log('=== txCount, nonce ===', txCount, nonce);

        /// Build the transaction
        const txObject = {
            nonce:    web3.utils.toHex(txCount),
            from:     walletAddress,
            to:       contractAddress,  /// Contract address which will be executed
            //value:    web3.utils.toHex(web3.utils.toWei('0.05', 'ether')),  /// [Note]: 0.05 ETH as a msg.value
            //value:    web3.utils.toHex(web3.utils.toWei('0', 'ether')),     /// [Note]: 0 ETH as a msg.value
            value:    web3.utils.toHex(web3.utils.toWei(ethValue, 'wei')),
            gasLimit: web3.utils.toHex(2100000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),   /// [Note]: Gas Price is 10 Gwei 
            //gasPrice: web3.utils.toHex(web3.utils.toWei('100', 'gwei')),   /// [Note]: Gas Price is 100 Gwei 
            data: inputData  
        }
        console.log('=== txObject ===', txObject)

        /// Sign the transaction
        privateKey = Buffer.from(privateKey, 'hex');
        let tx = new Tx(txObject, { 'chain': 'goerli' });  /// Chain ID = Goerli
        tx.sign(privateKey);

        const serializedTx = tx.serialize();
        const raw = '0x' + serializedTx.toString('hex');

        /// Broadcast the transaction
        const transaction = await web3.eth.sendSignedTransaction(raw);
        console.log('=== transaction ===', transaction)

        /// Return the result above
        return transaction;
    } catch(e) {
        console.log('=== e ===', e);
        return String(e);
    }
}
