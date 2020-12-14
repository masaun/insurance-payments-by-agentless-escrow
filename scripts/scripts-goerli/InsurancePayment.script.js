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
    await claim();
}
main();


/*** 
 * @dev - Unit test
 **/
async function claim() {  /// [Result]:
    /// [Note]: This is the TransactionClaim struct (value is empty)
    let txClaim = {
        availableTime: 1608422400,                             /// [Note]: Future timestamp 12/20, 2020, UTC 0:00 am (unit: second)
        //availableTime: 1607934124921,                        /// [Note]: Current timestamp (unit: mili-second)
        //availableTime: 1607934125,                           /// [Note]: Current timestamp (unit: second)
        to: "0x718E3ea0B8C2911C5e54Cb4b9B2075fdd87B55a7",                           /// [Note]: 
        value: web3.utils.toWei('0.1', 'ether'),                                    /// [Note]: 0.1
        data: "0x0000000000000000000000000000000000000000000000000000000000000000"  /// [Note]: Data type is bytes32
    }

    let inputData1 = await insurancePayment.methods.claim(txClaim).encodeABI();
    let transaction1 = await sendTransaction(walletAddress1, privateKey1, insurancePaymentAddr, inputData1);
}


/***
 * @notice - Sign and Broadcast the transaction
 **/
async function sendTransaction(walletAddress, privateKey, contractAddress, inputData) {
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
            value:    web3.utils.toHex(web3.utils.toWei('0', 'ether')),       /// [Note]: 0 ETH as a msg.value
            gasLimit: web3.utils.toHex(2100000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('100', 'gwei')),   /// [Note]: Gas Price is 100 Gwei 
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
