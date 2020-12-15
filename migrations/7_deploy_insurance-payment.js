//@dev - Import from exported file
var contractAddressList = require('./addressesList/contractAddress/contractAddress.js');
var tokenAddressList = require('./addressesList/tokenAddress/tokenAddress.js');
var walletAddressList = require('./addressesList/walletAddress/walletAddress.js');

const _wETH9 = tokenAddressList["Goerli"]["General"]["WETH9"];
const _uniswapFactory = contractAddressList["Goerli"]["UniswapV1"]["Factory"];
const _conditionalTokens = tokenAddressList["Goerli"]["Gnosis"]["ConditionalTokens"];
const _fPMMDeterministicFactory = contractAddressList["Goerli"]["Gnosis"]["FPMMDeterministicFactory"];


module.exports = (d) => d.deploy(
  artifacts.require('InsurancePayment'),
  _wETH9,
  _uniswapFactory,
  _conditionalTokens,
  _fPMMDeterministicFactory,
).then(async (insurancePayment) => {
  await insurancePayment.setup({ value: 1e18 });
});
