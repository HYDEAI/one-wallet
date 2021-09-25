import React, { useEffect, useState } from 'react'
import { Button, Row, Space, Spin, Typography, message } from 'antd'
import api from '../../api'
import util, { useWaitExecution, useWindowDimensions } from '../../util'
import ONEUtil from '../../../../lib/util'
import ONENames from '../../../../lib/names'
import { useDispatch, useSelector } from 'react-redux'
import { AutoResizeInputBox, Warning, Hint } from '../../components/Text'
import { walletActions } from '../../state/modules/wallet'
import AnimatedSection from '../../components/AnimatedSection'
import { CheckCircleOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons'
import BN from 'bn.js'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
import ShowUtils from './show-util'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import ONEConstants from '../../../../lib/constants'

const { Text, Title, Link } = Typography

const inputStyle = {
  display: 'inline',
  margin: '0 8px',
  padding: 0,
  textAlign: 'center',
}

const priceRowStyle = {
  textAlign: 'center',
  marginBottom: 32
}

const inputRowStyle = {
  marginTop: '32px',
  marginBottom: '48px',
  alignItems: 'baseline',
}

const WarningTextStyle = {
  textAlign: 'center',
  margin: '24px 0',
  display: 'block'
}

const minDomainNameLength = 3

const delayCheckMillis = 1300

/**
 * A valid domain is more than [minDomainNameLength] and able to be normalized.
 */
const validateSubdomain = (subdomain) => {
  try {
    if (subdomain.length < minDomainNameLength) {
      return undefined
    }

    return ONEUtil.normalizeDomain(subdomain)
  } catch (e) {
    message.error(`Error parsing domain name: ${e.toString()}`)
    return undefined
  }
}

/**
 * Renders warning message block for the ability to purchase a domain based on the domain availability and balance availability.
 */
const WarningMessageBlock = ({ enoughBalance, domainAvailable, checkingAvailability, validatedDomain }) => (
  <Space direction='vertical' style={WarningTextStyle}>
    {!enoughBalance && !checkingAvailability && <Warning>Insufficient funds</Warning>}
    {!domainAvailable && !checkingAvailability && <Warning>Domain is not available</Warning>}
    {checkingAvailability && validatedDomain && <Spin />}
  </Space>
)

const prepareName = (name) => {
  if (!name) {
    name = `${ONENames.randomWord()} ${ONENames.randomWord()} ${ONENames.randomWord()}`
  }
  if (name.indexOf(' ') < 0) {
    name = `${name} ${ONENames.randomWord()} ${ONENames.randomWord()}`
  }
  name = name.replace(/ /g, '-').toLowerCase()
  return name
}

// eslint-disable-next-line no-unused-vars
const { balance: PAYMENT_EXCESS_BUFFER } = util.toBalance(0.1)
/**
 * Renders Purchase Domain section that enables users to purchase an available domain for their selected wallet using selected token.
 */
const PurchaseDomain = ({ show, address, onClose }) => {
  const dispatch = useDispatch()
  const balances = useSelector(state => state.wallet.balances)
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const network = useSelector(state => state.wallet.network)
  const oneBalance = balances[address] || 0
  const [subdomain, setSubdomain] = useState(prepareName(wallet.name))
  const [purchaseOnePrice, setPurchaseOnePrice] = useState({ value: '', formatted: '' })
  const [domainFiatPrice, setDomainFiatPrice] = useState(0)
  const [available, setAvailable] = useState(false)
  const [enoughBalance, setEnoughBalance] = useState(false)
  const [domainAvailable, setDomainAvailable] = useState(false)
  const [checkingAvailability, setCheckingAvailability] = useState(true)
  const price = useSelector(state => state.wallet.price)
  const validatedSubdomain = validateSubdomain(subdomain)

  const [stage, setStage] = useState(-1)
  const doubleOtp = wallet.doubleOtp
  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp
  const { resetWorker, recoverRandomness } = useRandomWorker()

  const { onCommitError, onCommitFailure, onRevealFailure, onRevealError, onRevealAttemptFailed, onRevealSuccess, prepareValidation, prepareProofFailed } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker })

  const doPurchase = async () => {
    const { otp, otp2, invalidOtp2, invalidOtp } = prepareValidation({ state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp }, checkAmount: false, checkDest: false }) || {}
    if (invalidOtp || invalidOtp2) return
    const data = ONE.encodeBuyDomainData({ subdomain: validatedSubdomain })
    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      prepareProofFailed,
      commitHashGenerator: ONE.computeBuyDomainCommitHash,
      commitHashArgs: { maxPrice: purchaseOnePrice.value, subdomain: validatedSubdomain },
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      onCommitError,
      onCommitFailure,
      revealAPI: api.relayer.revealBuyDomain,
      revealArgs: { subdomain: validatedSubdomain, maxPrice: purchaseOnePrice.value, data: ONEUtil.hexString(data) },
      onRevealFailure,
      onRevealError,
      onRevealAttemptFailed,
      onRevealSuccess: async (txId) => {
        onRevealSuccess(txId)
        setTimeout(async () => {
          setStage(-1)
          resetOtp()
          resetWorker()
          const lookup = await api.blockchain.domain.reverseLookup({ address })
          if (lookup) {
            dispatch(walletActions.bindDomain({ address, domain: lookup }))
          }
          onClose()
        }, 2500)
      }
    })
  }

  useWaitExecution(
    async () => {
      setCheckingAvailability(true)
      const domainOnePrice = await api.blockchain.domain.price({ name: subdomain })
      // const domainOnePrice = domainOnePriceRaw.add(PAYMENT_EXCESS_BUFFER)
      const domainAvailability = await api.blockchain.domain.available({ name: subdomain })
      const computedDomainOnePrice = util.computeBalance(domainOnePrice.toString(), price)
      const hasEnoughBalance = domainOnePrice.lte(new BN(oneBalance))
      const domainAvailableAndValid = domainAvailability && validatedSubdomain
      setPurchaseOnePrice({ formatted: computedDomainOnePrice.formatted, value: domainOnePrice.toString() })
      setDomainFiatPrice(computedDomainOnePrice.fiatFormatted)
      setEnoughBalance(hasEnoughBalance)
      setDomainAvailable(domainAvailableAndValid)
      setAvailable(domainAvailableAndValid && hasEnoughBalance)
      setCheckingAvailability(false)
    },
    validatedSubdomain,
    delayCheckMillis,
    [subdomain, validatedSubdomain]
  )

  useEffect(() => {
    if (!validatedSubdomain) {
      setEnoughBalance(false)
      setDomainAvailable(false)
      setAvailable(false)
      setCheckingAvailability(true)
      setPurchaseOnePrice({ formatted: '0', value: '0' })
      setDomainFiatPrice('0')
    }
  }, [validatedSubdomain, setEnoughBalance, setDomainAvailable, setAvailable, setPurchaseOnePrice, setDomainFiatPrice])
  const { isMobile } = useWindowDimensions()
  const titleLevel = isMobile ? 4 : 3
  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      show={show} title={<Title level={2}>Get Domain</Title>} extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Row>
        <Hint>
          Send and receive cryptos with your unique domain name. Starting from only 1 ONE.
        </Hint>
      </Row>
      <Row style={inputRowStyle} justify='center'>
        <AutoResizeInputBox extraWidth={16} style={inputStyle} value={subdomain} onChange={({ target: { value } }) => setSubdomain(value)} />
        <Text>.{ONEConstants.Domain.DEFAULT_PARENT_LABEL}.{ONEConstants.Domain.DEFAULT_TLD}</Text>
      </Row>
      <Row style={priceRowStyle} justify='center'>
        <Space direction='vertical' style={{ minWidth: 275 }}>
          <Space align='baseline' style={{ justifyContent: 'space-between', width: '100%' }}>
            <Title level={titleLevel} style={{ marginRight: isMobile ? 16 : 48 }}>Cost</Title>
            <Title level={titleLevel}><span style={{ opacity: 0 }}>≈ $</span>{purchaseOnePrice.formatted || '...'}</Title><Text type='secondary'>ONE</Text>
          </Space>
          <Space align='baseline' style={{ justifyContent: 'space-between', width: '100%' }}>
            <Title level={titleLevel} style={{ marginRight: isMobile ? 16 : 48, opacity: 0 }}>Cost</Title>
            <Title style={{ whiteSpace: 'nowrap' }} level={titleLevel}><span>≈ $</span>{domainFiatPrice}</Title><Text type='secondary'>USD</Text>
          </Space>
        </Space>
      </Row>
      <Row>
        <Hint>Cost is per year. Shorter names cost more. Learn more at <Link target='_blank' href='https://blog.harmony.one/harmony-community-launches-crazy-one-the-first-subdomain-nft/' rel='noreferrer'>Harmony blog</Link></Hint>
      </Row>
      <Row justify='center'>
        <WarningMessageBlock
          enoughBalance={enoughBalance}
          domainAvailable={domainAvailable}
          checkingAvailability={checkingAvailability}
          validatedDomain={validatedSubdomain}
        />
      </Row>
      {available && <OtpStack walletName={wallet.name} doubleOtp={doubleOtp} otpState={otpState} />}
      <Row justify='end' style={{ marginTop: 24 }}>
        <Space>
          {stage >= 0 && stage < 3 && <LoadingOutlined />}
          {stage === 3 && <CheckCircleOutlined />}
          <Button type='primary' size='large' shape='round' disabled={!available || stage >= 0} onClick={doPurchase}>Buy Now</Button>
        </Space>
      </Row>
      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
    </AnimatedSection>
  )
}

export default PurchaseDomain
