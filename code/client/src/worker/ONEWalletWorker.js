const ONE = require('../../../lib/onewallet')
const ONEUtil = require('../../../lib/util')

async function recoverRandomness ({ randomness, hseed, otp, otp2, nonce, leaf, hasher }) {
  const encodedOtp = ONEUtil.encodeNumericalOtp(otp)
  const encodedOtp2 = (otp2 !== undefined && otp2 !== null) ? ONEUtil.encodeNumericalOtp(otp2) : undefined
  // console.log('worker', { otp, otp2, encodedOtp, encodedOtp2 })
  try {
    const rand = await ONE.recoverRandomness({
      randomness,
      hseed: ONEUtil.hexToBytes(hseed),
      otp: encodedOtp,
      otp2: encodedOtp2,
      nonce,
      leaf,
      hasher: ONEUtil.getHasher(hasher)
    })
    postMessage({ status: 'rand', result: { rand } })
  } catch (ex) {
    console.error(ex)
    postMessage({ status: 'error', result: { error: ex.toString() } })
  }
}

onmessage = async function (event) {
  const { salt, seed, seed2, effectiveTime, duration, slotSize, interval, randomness, hasher, action } = event.data

  if (action === 'recoverRandomness') {
    return recoverRandomness(event.data)
  }

  if (!seed) {
    // console.log('worker: received event but it has no valid data', event)
    return
  }
  // console.log('worker: generating wallet:', event.data)

  try {
    const {
      hseed,
      doubleOtp,
      leaves,
      root,
      layers,
      maxOperationsPerInterval,
    } = await ONE.computeMerkleTree({
      otpSeed: seed,
      otpSeed2: seed2,
      effectiveTime,
      duration,
      randomness,
      hasher: ONEUtil.getHasher(hasher),
      maxOperationsPerInterval: slotSize,
      otpInterval: interval,
      progressObserver: (current, total, stage) => {
        postMessage({ status: 'working', current: current, total: total, stage, salt })
      }
    })
    console.log('worker: done')
    postMessage({
      status: 'done',
      salt,
      result: {
        hseed,
        doubleOtp,
        leaves,
        root,
        layers,
        maxOperationsPerInterval,
      }
    })
  } catch (ex) {
    console.error(ex)
    postMessage({ status: 'error', result: { error: ex.toString() } })
  }
}
