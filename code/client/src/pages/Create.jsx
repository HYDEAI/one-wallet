import React, { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory } from 'react-router'
import Paths from '../constants/paths'
import api from '../api'
import ONEUtil from '../../../lib/util'
import ONEConstants from '../../../lib/constants'
import ONENames from '../../../lib/names'
import axios from 'axios'

import { MigrationPayload } from '../proto/oauthMigration'
// import { uniqueNamesGenerator, colors, animals } from 'unique-names-generator'
import {
  Button,
  Row,
  Space,
  Typography,
  Slider,
  Image,
  message,
  Checkbox,
  Tooltip,
  Input,
  Form
} from 'antd'
import CountryPhoneInput, {ConfigProvider} from 'antd-country-phone-input'
import en from 'world_countries_lists/data/en/world.json'
import { RedoOutlined, LoadingOutlined, QuestionCircleOutlined, SnippetsOutlined } from '@ant-design/icons'
import humanizeDuration from 'humanize-duration'
import AnimatedSection from '../components/AnimatedSection'
import b32 from 'hi-base32'
import qrcode from 'qrcode'
import storage from '../storage'
import walletActions from '../state/modules/wallet/actions'
import WalletConstants from '../constants/wallet'
import util, { useWindowDimensions, OSType, generateOtpSeed } from '../util'
import { handleAPIError, handleAddressError } from '../handler'
import { Hint, Heading, InputBox, Warning } from '../components/Text'
import OtpBox from '../components/OtpBox'
import { getAddress } from '@harmony-js/crypto'
import AddressInput from '../components/AddressInput'
import WalletCreateProgress from '../components/WalletCreateProgress'
import { TallRow } from '../components/Grid'
import { FlashyButton } from '../components/Buttons'
const { Text, Link } = Typography
import config from '.././config'

// const genName = () => uniqueNamesGenerator({
//   dictionaries: [colors, animals],
//   style: 'capital',
//   separator: ' ',
//   length: 1
// })

const genName = (existingNames) => {
  const name = `${ONENames.randomWord()} ${ONENames.randomWord()} ${ONENames.randomWord()}`
  if (existingNames && existingNames.includes(name)) {
    return genName()
  }
  return name
}

const OTPUriMode = {
  STANDARD: 0,
  MIGRATION: 1,
  TOTP: 2, // seems deprecated, should not use unless it is for testing
}

const getQRCodeUri = (otpSeed, otpDisplayName, mode = OTPUriMode.STANDARD) => {
  if (mode === OTPUriMode.STANDARD) {
    // otpauth://TYPE/LABEL?PARAMETERS
    return `otpauth://totp/${otpDisplayName}?secret=${b32.encode(otpSeed)}&issuer=Harmony`
  }
  if (mode === OTPUriMode.MIGRATION) {
    const payload = MigrationPayload.create({
      otpParameters: [{
        issuer: 'Harmony',
        secret: otpSeed,
        name: otpDisplayName,
        algorithm: MigrationPayload.Algorithm.ALGORITHM_SHA1,
        digits: MigrationPayload.DigitCount.DIGIT_COUNT_SIX,
        type: MigrationPayload.OtpType.OTP_TYPE_TOTP,
      }],
      version: 1,
      batchIndex: 0,
      batchSize: 1,
    })
    const bytes = MigrationPayload.encode(payload).finish()
    const b64 = Buffer.from(bytes).toString('base64')
    // console.log({ payload, bytes, b64 })
    return `otpauth-migration://offline?data=${encodeURIComponent(b64)}`
  }
  return null
}

const getGoogleAuthenticatorAppLink = (os) => {
  let link = 'https://apps.apple.com/us/app/google-authenticator/id388497605'
  if (os === OSType.Android) {
    link = 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2'
  }
  return <Link href={link} target='_blank' rel='noreferrer'>Google Authenticator</Link>
}

const getSecondCodeName = (name) => `${name} - 2nd`

// not constructing qrCodeData on the fly (from seed) because generating a PNG takes noticeable amount of time. Caller needs to make sure qrCodeData is consistent with seed
const buildQRCodeComponent = ({ seed, name, os, isMobile, qrCodeData }) => {
  const image = (url) =>
    <Image
      src={qrCodeData}
      preview={false}
      width={isMobile ? 192 : 256}
      style={isMobile && { border: '1px solid lightgrey', borderRadius: 8, boxShadow: '0px 0px 10px lightgrey' }}
      onClick={url && (() => window.open(url, '_self').focus())}
    />
  let href
  if (os === OSType.iOS) {
    href = getQRCodeUri(seed, name, OTPUriMode.MIGRATION)
  } else if (os === OSType.Android) {
    href = getQRCodeUri(seed, name, OTPUriMode.STANDARD)
  } else if (isMobile) {
    // To test in more devices
    href = getQRCodeUri(seed, name, OTPUriMode.MIGRATION)
  }

  return (
    <Row justify='center'>
      {isMobile && qrCodeData && image(href)}
      {!isMobile && qrCodeData && image()}
    </Row>
  )
}

const sectionViews = {
  setupWalletDetails: 1,
  setupOtp: 2,
  setupSecondOtp: 3,
  prepareWallet: 4,
  walletSetupDone: 5
}

const Create = ({ expertMode, showRecovery }) => {

  // Additional device OTP
  const [userPhone, setUserPhone] = useState()
  const [smsSent,setSmsSent] = useState()
  const [appleWatchOtpRegistered,setAppleWatchOtpRegistered] = useState()
  const [appleWatchDeviceId,setAppleWatchDeviceId] = useState()
  const [deviceRegistered ,setDeviceRegistered] = useState()

  // eslint-disable-next-line no-unused-vars
  const dev = useSelector(state => state.wallet.dev)
  const { isMobile, os } = useWindowDimensions()
  const dispatch = useDispatch()
  const history = useHistory()
  const network = useSelector(state => state.wallet.network)
  const wallets = useSelector(state => state.wallet.wallets)
  const generateNewOtpName = () => genName(Object.keys(wallets).map(k => wallets[k].name))
  const [name, setName] = useState(generateNewOtpName())
  // eslint-disable-next-line no-unused-vars
  const [seed, setSeed] = useState(generateOtpSeed())
  // eslint-disable-next-line no-unused-vars
  const [seed2, setSeed2] = useState(generateOtpSeed())
  const [duration, setDuration] = useState(WalletConstants.defaultDuration)
  const [showRecoveryDetail, setShowRecoveryDetail] = useState(false)

  // Used for Recovery address setup. Only used when user does not choose a Recovery address.
  const oneWalletTreasurySelectOption = {
    value: WalletConstants.oneWalletTreasury.address,
    label: `(${WalletConstants.oneWalletTreasury.label}) ${util.safeOneAddress(WalletConstants.oneWalletTreasury.address)}`
  }

  // A valid wallet of user's wallets in the network can be used as default recovery wallet.
  // const defaultRecoveryWallet = Object.keys(wallets)
  //   .map((address) => ({ ...wallets[address], oneAddress: util.safeOneAddress(wallets[address].address) }))
  //   .find((wallet) => util.safeOneAddress(wallet.address) && wallet.network === network && !wallet.temp)

  // const defaultRecoveryAddress = defaultRecoveryWallet ? { value: defaultRecoveryWallet.oneAddress, label: `(${defaultRecoveryWallet.name}) ${defaultRecoveryWallet.oneAddress}` } : oneWalletTreasurySelectOption
  const defaultRecoveryAddress = oneWalletTreasurySelectOption

  const [lastResortAddress, setLastResortAddress] = useState(defaultRecoveryAddress)
  const [spendingLimit, setSpendingLimit] = useState(WalletConstants.defaultSpendingLimit) // ONEs, number
  const [spendingInterval, setSpendingInterval] = useState(WalletConstants.defaultSpendingInterval) // seconds, number

  const [worker, setWorker] = useState()
  const [root, setRoot] = useState()
  const [hseed, setHseed] = useState()
  const [layers, setLayers] = useState()
  const [slotSize, setSlotSize] = useState(1)
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)
  const [address, setAddress] = useState() // '0x12345678901234567890'
  const [effectiveTime, setEffectiveTime] = useState()
  const [doubleOtp, setDoubleOtp] = useState(false)
  const [appleWatchOtp, setAppleWatchOtp] = useState(false)

  const [durationVisible, setDurationVisible] = useState(false)
  const [section, setSection] = useState(sectionViews.setupOtp)
  const [qrCodeData, setQRCodeData] = useState()
  const [secondOtpQrCodeData, setSecondOtpQrCodeData] = useState()
  const [otp, setOtp] = useState('')
  const [deploying, setDeploying] = useState()

  const otpRef = useRef()

  const securityParameters = ONEUtil.securityParameters({
    majorVersion: ONEConstants.MajorVersion,
    minorVersion: ONEConstants.MinorVersion,
  })

  useEffect(() => {
    (async function () {
      const otpUri = getQRCodeUri(seed, name, OTPUriMode.MIGRATION)
      const secondOtpUri = getQRCodeUri(seed2, getSecondCodeName(name), OTPUriMode.MIGRATION)
      const otpQrCodeData = await qrcode.toDataURL(otpUri, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      const secondOtpQrCodeData = await qrcode.toDataURL(secondOtpUri, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      setQRCodeData(otpQrCodeData)
      setSecondOtpQrCodeData(secondOtpQrCodeData)
    })()
  }, [name])

  useEffect(() => {
    if (section === sectionViews.setupOtp && worker) {
      // console.log('Posting to worker. Security parameters:', securityParameters)
      const t = Math.floor(Date.now() / WalletConstants.interval) * WalletConstants.interval
      const salt = ONEUtil.hexView(generateOtpSeed())
      setEffectiveTime(t)
      if (worker) {
        worker.postMessage({
          salt,
          seed,
          seed2: doubleOtp && seed2,
          effectiveTime: t,
          duration,
          slotSize,
          interval: WalletConstants.interval,
          ...securityParameters,
        })
        setRoot(undefined)
        setHseed(undefined)
        setLayers(undefined)
        setSlotSize(1)
        worker.onmessage = (event) => {
          const { status, current, total, stage, result, salt: workerSalt } = event.data
          if (workerSalt && workerSalt !== salt) {
            // console.log(`Discarding outdated worker result (salt=${workerSalt}, expected=${salt})`)
            return
          }
          if (status === 'working') {
            // console.log(`Completed ${(current / total * 100).toFixed(2)}%`)
            setProgress(Math.round(current / total * 100))
            setProgressStage(stage)
          }
          if (status === 'done') {
            const { hseed, root, layers, maxOperationsPerInterval } = result
            setRoot(root)
            setHseed(hseed)
            setLayers(layers)
            setSlotSize(maxOperationsPerInterval)
            // console.log('Received created wallet from worker:', result)
          }
        }
      }
    }
  }, [section, worker, doubleOtp])

  useEffect(() => {
    const settingUpSecondOtp = section === sectionViews.setupSecondOtp
    if (otp.length !== 6) {
      return
    }
    if (otp.toLowerCase() === '0x1337' || otp.toLowerCase() === 'expert') {
      history.push(Paths.create2)
      message.success('Expert mode unlocked')
      setOtp('')
      return
    }
    if (expertMode && (otp === '0x0000' || otp === 'normal')) {
      history.push(Paths.create)
      message.success('Expert mode disabled')
      setOtp('')
      return
    }
    const currentSeed = settingUpSecondOtp ? seed2 : seed
    const expected = ONEUtil.genOTP({ seed: currentSeed })
    const code = new DataView(expected.buffer).getUint32(0, false).toString()
    setOtp('')
    if (code.padStart(6, '0') !== otp.padStart(6, '0')) {
      message.error('Code is incorrect. Please try again.')
      otpRef?.current?.focusInput(0)
    } else if (doubleOtp && !settingUpSecondOtp) {
      setSection(sectionViews.setupSecondOtp)
      otpRef?.current?.focusInput(0)
    } else {
      setSection(sectionViews.prepareWallet)
    }
  }, [otp])

  const storeLayers = async () => {
    if (!root) {
      message.error('Cannot store credentials of the wallet. Error: Root is not set')
      return
    }
    return storage.setItem(ONEUtil.hexView(root), layers)
  }

  const deploy = async () => {
    if (!(root && hseed && layers && slotSize)) {
      message.error('Cannot deploy wallet. Error: root is not set.')
      return
    }

    // Ensure valid address for both 0x and one1 formats
    const normalizedAddress = util.safeExec(util.normalizedAddress, [lastResortAddress?.value], handleAddressError)

    if (!normalizedAddress) {
      return
    }

    setDeploying(true)

    try {
      const { address } = await api.relayer.create({
        root: ONEUtil.hexString(root),
        height: layers.length,
        interval: WalletConstants.interval / 1000,
        t0: effectiveTime / WalletConstants.interval,
        lifespan: duration / WalletConstants.interval,
        slotSize,
        lastResortAddress: normalizedAddress,
        spendingLimit: ONEUtil.toFraction(spendingLimit).toString(),
        spendingInterval,
      })
      // console.log('Deployed. Received contract address', address)
      const wallet = {
        name,
        address,
        root: ONEUtil.hexView(root),
        duration,
        slotSize,
        effectiveTime,
        lastResortAddress: normalizedAddress,
        spendingLimit: ONEUtil.toFraction(spendingLimit).toString(),
        hseed: ONEUtil.hexView(hseed),
        spendingInterval: spendingInterval * 1000,
        majorVersion: ONEConstants.MajorVersion,
        minorVersion: ONEConstants.MinorVersion,
        network,
        doubleOtp,
        appleWatchOtp,
        appleWatchDeviceId,
        ...securityParameters,
        expert: !!expertMode,
      }
      await storeLayers()
      dispatch(walletActions.updateWallet(wallet))
      dispatch(walletActions.fetchBalanceSuccess({ address, balance: 0 }))
      setAddress(address)
      setDeploying(false)
      message.success('Your wallet is deployed!')
      setTimeout(() => {
        dispatch(walletActions.fetchWallet({ address }))
        history.push(Paths.showAddress(address))
      }, 2500)
      // setSection(4)
    } catch (ex) {
      handleAPIError(ex)
      setDeploying(false)
    }
  }

  useEffect(() => {
    const worker = new Worker('/ONEWalletWorker.js')
    setWorker(worker)
  }, [])

  //Additional auth device functions
  const onSendSMSFinish = (values) => {
    setAppleWatchOtpRegistered(true)
    setSmsSent(true)
    let phoneNumber = values['reg'].code + '' + values['reg'].phone
    phoneNumber = phoneNumber.replace(/\D/g,'');
    setUserPhone(phoneNumber)
    //Make API call to server
    const registerUrl = config.appleWatchOtpService.registerDevice.replace('{{number}}',phoneNumber)+'&f=r'
    axios.get(registerUrl).then((status)=>{
      setAppleWatchOtpRegistered(true)
    })
    //Get device id, store in wallet meta data

    //message.info(`onFinish: ${values && JSON.stringify(values)}`);
    //message.info('onFinish: '+registerUrl);
    //setAppleWatchOtpRegistered()
  };
  //Additional auth device functions
  const onValidCodeFinish = (values) => {
    setAppleWatchOtpRegistered(true)
    let smsCode = values.sms
    let phoneNumber= userPhone
    //Make API call to server
    const registerUrl = config.appleWatchOtpService.registerDevice.replace('{{number}}',phoneNumber)+'&c='+smsCode+'&f=v'
    axios.get(registerUrl).then((status)=>{
      setAppleWatchDeviceId(status['device_id']);
      setSmsSent(false)
      setDeviceRegistered(true)
    })
    //Get device id, store in wallet meta data

    //message.info(`onFinish: ${values && JSON.stringify(values)}`);
    //message.info('onFinish: '+registerUrl);
    //setAppleWatchOtpRegistered()
  };
  const onFinishFailed = (errorInfo) => {
    message.info(`onFinishFailed: ${errorInfo && JSON.stringify(errorInfo)}`);
  };
  useEffect(() => {
    if (section === sectionViews.prepareWallet && !showRecovery &&
      root && hseed && slotSize && layers) {
      deploy()
    }
  }, [section, root, hseed, layers, slotSize])

  return (
    <>
      <AnimatedSection show={section === sectionViews.setupWalletDetails} style={{ maxWidth: 640 }}>
        <Heading>What do you want to call your wallet?</Heading>
        <Hint>This is only stored on your computer to distinguish your wallets.</Hint>
        <Row align='middle' style={{ marginBottom: 32, marginTop: 16 }}>
          <Space size='large'>
            <InputBox
              prefix={<Button type='text' onClick={() => setName(genName())} style={{ }}><RedoOutlined /></Button>}
              value={name} onChange={({ target: { value } }) => setName(value)}
              style={{ padding: 0 }}
            />
            <Button type='primary' shape='round' size='large' onClick={() => setSection(sectionViews.setupOtp)}>Next</Button>
          </Space>
        </Row>
        <Space direction='vertical'>
          <Hint>Next, we will set up a 1wallet that expires in a year. When the wallet expires, you may create a new wallet and transfer the funds. The funds can also be recovered to an address you set later.</Hint>
          <Link onClick={() => setDurationVisible(true)}>Need more time?</Link>
          {durationVisible &&
            <Space>
              <Slider
                style={{ width: 200 }}
                value={duration} tooltipVisible={false} onChange={(v) => setDuration(v)}
                min={WalletConstants.minDuration} max={WalletConstants.maxDuration}
              />
              <Hint>{humanizeDuration(duration, { units: ['y', 'mo'], round: true })}</Hint>
            </Space>}
        </Space>
      </AnimatedSection>
      <AnimatedSection show={section === sectionViews.setupOtp} style={{ maxWidth: 640 }}>
        <Row>
          <Space direction='vertical'>
            {/* <Heading>Now, scan the QR code with your Google Authenticator</Heading> */}
            <Heading level={isMobile ? 4 : 2}>Create Your 1wallet</Heading>
            {!isMobile && <Hint>Scan the QR code to setup {getGoogleAuthenticatorAppLink(os)}. You need it to use, copy, or restore the wallet </Hint>}
            {isMobile && <Hint>Tap QR code to setup {getGoogleAuthenticatorAppLink(os)}. You need it to use, copy, or restore the wallet</Hint>}
            {buildQRCodeComponent({ seed, name, os, isMobile, qrCodeData })}
          </Space>
        </Row>
        <Row style={{ marginTop: 16 }}>
          <Space direction='vertical' size='large' align='center' style={{ width: '100%' }}>
            <Hint>Copy the 6-digit code from authenticator</Hint>
            <Hint style={{ fontSize: isMobile ? 12 : undefined }}>
              Code for <b>Harmony ({name})</b>
            </Hint>
            <OtpBox
              shouldAutoFocus={!isMobile}
              ref={otpRef}
              value={otp}
              onChange={setOtp}
            />
            {appleWatchOtp && !appleWatchOtpRegistered &&
                <Space>
                  <ConfigProvider locale={en}>
                    <Form
                      onFinish={onSendSMSFinish}
                      onFinishFailed={onFinishFailed}
                      initialValues={{
                        reg:{ short:'ca',code:1,phone:''}
                      }}
                      >
                        <Form.Item name="reg">
                          <CountryPhoneInput/>
                        </Form.Item>
                        <Button type="primary" htmlType="submit">
                          Send SMS code
                        </Button>
                      </Form>
                  </ConfigProvider>
                </Space>
              }
              {appleWatchOtp && smsSent &&
                <Space>
                    <Form
                      onFinish={onValidCodeFinish}
                      onFinishFailed={onFinishFailed}
                      >
                        <Form.Item name="sms">
                          <Input id="smsCode" placeholder="Enter SMS code" />
                        </Form.Item>
                        <Button type="primary" htmlType="submit">
                          Register Device
                        </Button>
                      </Form>
                </Space>
              }
              {appleWatchOtp && deviceRegistered &&
                <Space>
                  ✅ Phone and Apple Device ready to link to this wallet.
                </Space>
              }
            {isMobile && <Button type='default' shape='round' icon={<SnippetsOutlined />} onClick={() => { navigator.clipboard.readText().then(t => setOtp(t)) }}>Paste from Clipboard</Button>}
            {expertMode &&
              <Checkbox onChange={() => setDoubleOtp(!doubleOtp)}>
                <Space>
                  <Hint style={{ fontSize: isMobile ? 12 : undefined }}>
                    Use two codes to enhance security
                  </Hint>
                  <Tooltip title={<div>You will need to scan another QR-code on the next page. Each time you make a transaction, you will need to type in two 6-digit codes, which are shown simultaneously next to each other on your Google Authenticator.<br /><br />This is advisable if you intend to make larger transactions with this wallet</div>}>
                    <QuestionCircleOutlined />
                  </Tooltip>
                </Space>
              </Checkbox>}
          </Space>
        </Row>
      </AnimatedSection>
      <AnimatedSection show={section === sectionViews.setupSecondOtp} style={{ maxWidth: 640 }}>
        <Row>
          <Space direction='vertical'>
            <Heading>Create Your 1wallet (second code)</Heading>
            <Hint align='center'>{isMobile ? 'Tap' : 'Scan'} to setup the <b>second</b> code</Hint>
            {buildQRCodeComponent({ seed: seed2, name: getSecondCodeName(name), os, isMobile, qrCodeData: secondOtpQrCodeData })}
          </Space>
        </Row>
        <Row>
          <Space direction='vertical' size='large' align='center' style={{ width: '100%' }}>
            <Hint>Copy the 6-digit code from authenticator</Hint>
            <Hint style={{ fontSize: isMobile ? 12 : undefined }}>Code for <b>Harmony ({getSecondCodeName(name)})</b></Hint>
            <OtpBox
              shouldAutoFocus={!isMobile}
              ref={otpRef}
              value={otp}
              onChange={setOtp}
            />
            {isMobile && <Button type='default' shape='round' icon={<SnippetsOutlined />} onClick={() => { navigator.clipboard.readText().then(t => setOtp(t)) }}>Paste from Clipboard</Button>}
          </Space>
        </Row>
      </AnimatedSection>
      <AnimatedSection show={section === sectionViews.prepareWallet} style={{ maxWidth: 640 }}>
        <Row>
          <Space direction='vertical'>
            <Heading>Prepare Your 1wallet</Heading>
          </Space>
        </Row>
        {expertMode &&
          <Row style={{ marginBottom: 16 }}>
            <Space direction='vertical' size='small'>
              <Hint>Set up a spending limit:</Hint>
              <Space align='baseline' direction={isMobile ? 'vertical' : 'horizontal'}>
                <InputBox
                  margin={16} width={160} value={spendingLimit}
                  onChange={({ target: { value } }) => setSpendingLimit(parseInt(value || 0))} suffix='ONE'
                />
                <Space align='baseline'>
                  <Hint>per</Hint>
                  <InputBox
                    margin={16} width={128} value={spendingInterval}
                    onChange={({ target: { value } }) => setSpendingInterval(parseInt(value || 0))}
                  />
                  <Hint>seconds</Hint>
                </Space>
              </Space>
              <Row justify='end'>
                <Hint>≈ {humanizeDuration(spendingInterval * 1000, { largest: 2, round: true })}</Hint>
              </Row>

            </Space>
          </Row>}
        {showRecovery &&
          <Row style={{ marginBottom: 24 }}>
            {!showRecoveryDetail &&
              <Space>
                <Button style={{ padding: 0 }} type='link' onClick={() => setShowRecoveryDetail(true)}>Set up a recovery address?</Button>
                <Tooltip title={'It is where you could send your money to if you lost the authenticator. You don\'t have to configure this. By default it goes to 1wallet DAO'}>
                  <QuestionCircleOutlined />
                </Tooltip>

              </Space>}
            {showRecoveryDetail &&
              <Space direction='vertical' size='small' style={{ width: '100%' }}>
                <Hint>Set up a fund recovery address (it's public):</Hint>
                <AddressInput
                  addressValue={lastResortAddress}
                  setAddressCallback={setLastResortAddress}
                  extraSelectOptions={[{
                    address: WalletConstants.oneWalletTreasury.address,
                    label: WalletConstants.oneWalletTreasury.label
                  }]}
                />
                <Hint>
                  {lastResortAddress.value !== WalletConstants.oneWalletTreasury.address && <span style={{ color: 'red' }}>This is permanent. </span>}
                  If you lost access, you can still send your assets there or use <Link href='https://github.com/polymorpher/one-wallet/releases/tag/v0.2' target='_blank' rel='noreferrer'>auto-recovery</Link>
                </Hint>
                {lastResortAddress.value === WalletConstants.oneWalletTreasury.address &&
                  <Warning style={{ marginTop: 24 }}>
                    Please use your own address if you can. 1wallet DAO is controlled by Harmony team. They may help you recover funds as the last resort.
                  </Warning>}
              </Space>}
          </Row>}
        <Row style={{ marginBottom: 32 }}>
          <Space direction='vertical'>
            {showRecovery &&
              <Space>
                <FlashyButton
                  disabled={!root || deploying} type='primary' shape='round' size='large'
                  onClick={() => deploy()}
                >Confirm: Create Now
                </FlashyButton>
                {deploying && <LoadingOutlined />}
              </Space>}
            {!showRecovery &&
              <TallRow>
                {(deploying || !root) && <Space><Text>Working on your 1wallet...</Text><LoadingOutlined /></Space>}
                {(!deploying && root) && <Text>Your 1wallet is ready!</Text>}
              </TallRow>}
            {!root && <WalletCreateProgress progress={progress} isMobile={isMobile} progressStage={progressStage} />}
          </Space>
        </Row>
        <Row>
          <Space direction='vertical'>
            <Hint>No private key. No mnemonic. Simple and Secure. </Hint>
            <Hint>To learn more, visit <Link href='https://github.com/polymorpher/one-wallet/wiki'>1wallet Wiki</Link></Hint>
            <Hint>In Beta, your wallet is subject to a daily spending limit of {WalletConstants.defaultSpendingLimit} ONE</Hint>
          </Space>
        </Row>
      </AnimatedSection>
      <AnimatedSection show={section === sectionViews.walletSetupDone}>
        <Space direction='vertical'>
          <Heading>You are all set!</Heading>
          <Space direction='vertical' size='small'>
            <Hint>Wallet Address</Hint>
            <Text>{address && getAddress(address).bech32}</Text>
          </Space>
          <Button style={{ marginTop: 32 }} disabled={!address} type='primary' shape='round' size='large' onClick={() => history.push(Paths.showAddress(address))}>Go to My Wallet</Button>
        </Space>
      </AnimatedSection>
    </>
  )
}

export default Create
