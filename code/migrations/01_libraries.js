const ONEWallet = artifacts.require('ONEWallet')
const DomainManager = artifacts.require('DomainManager')
const TokenTracker = artifacts.require('TokenTracker')
const WalletGraph = artifacts.require('WalletGraph')
const RandomNumberConsumer= artifacts.require('RandomNumberConsumer')


async function doDeploy(deployer) {
   /*
   await deployer.deploy(DomainManager)
   await deployer.deploy(TokenTracker)
   await deployer.link(DomainManager, WalletGraph);
   await deployer.deploy(WalletGraph)
   await deployer.link(DomainManager, ONEWallet);
   await deployer.link(TokenTracker, ONEWallet);
   await deployer.link(WalletGraph, ONEWallet);
   await deployer.deploy(ONEWallet)
   */
   await deployer.deploy(RandomNumberConsumer)
}

module.exports = function (deployer) {
   deployer.then(async()=>{
      await doDeploy(deployer)
   })
}

// var DailyLimit = artifacts.require('DailyLimit')
// var Guardians = artifacts.require('Guardians')
// var Recovery = artifacts.require('Recovery')
//
// module.exports = function (deployer) {
//   deployer.deploy(DailyLimit)
//   deployer.deploy(Guardians)
//   deployer.deploy(Recovery)
// }
