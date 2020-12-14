module.exports = (d) => d.deploy(
  artifacts.require('InsurancePayment'),
  artifacts.require('WETH9').address,
  artifacts.require('UniswapFactory').address,
  artifacts.require('ConditionalTokens').address,
  artifacts.require('FPMMDeterministicFactory').address,
).then(async (insurancePayment) => {
  await insurancePayment.setup({ value: 1e18 });
});
