import baseConfig from '../../lib/config/common'
import { merge } from 'lodash'
const config = merge({}, baseConfig, {
  priceRefreshInterval: 60 * 1000,
  defaults: {
    sentryDsn: process.env.SENTRY_DSN
  },
  debug: process.env.DEBUG,
  ipfs: {
    // gateway: process.env.IPFS_GATEWAY || 'https://dweb.link/ipfs/{{hash}}'
    // gateway: process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/{{hash}}'
    gateway: process.env.IPFS_GATEWAY || 'https://1wallet.mypinata.cloud/ipfs/{{hash}}'
  },
  appleWatchOtpService:{
    registerDevice: process.env.DEVICE_OTP_REG || 'https://us-central1-brother-nft.cloudfunctions.net/hwalletreg/?n={{number}}',
    writeOtp: process.env.DEVICE_OTP_SET || 'https://us-central1-brother-nft.cloudfunctions.net/harmony-authenticate/?id={{deviceId}}',
    checkOtp: process.env.DEVICE_OTP_CHECK || 'https://us-central1-brother-nft.cloudfunctions.net/harmony-authenticate/?id={{deviceId}}'
  },
  rootUrl: process.env.ROOT_URL || 'https://1wallet.crazy.one'
})

export default config
