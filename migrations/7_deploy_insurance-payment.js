//@dev - Import from exported file
var contractAddressList = require('./addressesList/contractAddress/contractAddress.js');
var tokenAddressList = require('./addressesList/tokenAddress/tokenAddress.js');
var walletAddressList = require('./addressesList/walletAddress/walletAddress.js');

const _uniswapFactory = contractAddressList["Goerli"]["UniswapV1"]["Factory"];

module.exports = (d) => d.deploy(
  artifacts.require('InsurancePayment'),
  artifacts.require('WETH9').address,
  _uniswapFactory,
  artifacts.require('ConditionalTokens').address,
  artifacts.require('FPMMDeterministicFactory').address,
).then(async (insurancePayment) => {
  await insurancePayment.setup({ value: 1e18 });
});
