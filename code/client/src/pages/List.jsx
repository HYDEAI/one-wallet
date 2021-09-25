import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import { values } from 'lodash'
import { Card, Row, Space, Typography, message, Col, Tag } from 'antd'
import util, { useWindowDimensions } from '../util'
import { useHistory, useLocation } from 'react-router'
import Paths from '../constants/paths'
import BN from 'bn.js'
import { getAddress } from '@harmony-js/crypto'
import storage from '../storage'
import ONEConstants from '../../../lib/constants'
const { Text, Title } = Typography
const walletShortName = (fullName) => {
  if (!fullName) {
    return null
  }
  const walletNameParts = fullName.split(' ')

  return walletNameParts.length > 1 ? `${walletNameParts[0]}...` : fullName
}

const WalletCard = ({ wallet }) => {
  const { isMobile } = useWindowDimensions()
  const history = useHistory()
  const location = useLocation()
  const { address, name, forwardAddress, temp } = wallet
  const oneAddress = getAddress(address).bech32
  const dispatch = useDispatch()
  const balance = useSelector(state => state.wallet.balances[address])
  const price = useSelector(state => state.wallet.price)
  const { formatted, fiatFormatted } = util.computeBalance(balance, price)
  const walletOutdated = util.isWalletOutdated(wallet)

  useEffect(() => {
    dispatch(walletActions.fetchBalance({ address }))
    dispatch(walletActions.fetchWallet({ address }))
  }, [location.pathname])

  return (
    <Card
      onClick={() => history.push(Paths.showAddress(oneAddress))}
      title={<Title level={2}>{walletShortName(name)}</Title>}
      hoverable style={{ borderRadius: 20, minWidth: 200, width: (isMobile ? '100%' : 360), height: 196 }}
      extra={<Space style={{ alignItems: 'baseline' }}><Title level={3} style={{ marginBottom: 0 }}>{formatted}</Title><Text type='secondary'>ONE</Text></Space>}
    >
      <Space direction='vertical' size='large'>
        <Space>
          <Title level={4}>≈ ${fiatFormatted}</Title>
          <Text type='secondary'>USD</Text>
        </Space>
        <Text
          ellipsis={{ tooltip: oneAddress }} style={{ width: 196 }} onClick={() => {
            navigator.clipboard.writeText(oneAddress)
            message.info('Copied address to clipboard')
          }}
        >
          {oneAddress}
        </Text>
        {
          (walletOutdated || util.isEmptyAddress(wallet.lastResortAddress)) &&
            <Tag color='warning' style={{ position: 'absolute', bottom: isMobile ? 32 : 16, right: 16 }}>
              needs attention
            </Tag>
        }
      </Space>

    </Card>
  )
}

const List = () => {
  const { isMobile } = useWindowDimensions()
  const wallets = useSelector(state => state.wallet.wallets)
  const balances = useSelector(state => state.wallet.balances)
  const price = useSelector(state => state.wallet.price)
  const network = useSelector(state => state.wallet.network)
  const dispatch = useDispatch()
  const totalBalance = Object.keys(balances)
    .filter(a => wallets[a] && wallets[a].network === network && !wallets[a].temp)
    .map(a => balances[a])
    .reduce((a, b) => a.add(new BN(b, 10)), new BN(0)).toString()
  const { formatted, fiatFormatted } = util.computeBalance(totalBalance, price)
  const titleLevel = isMobile ? 4 : 3
  const [purged, setPurged] = useState(false)

  const purge = (wallet) => {
    const { root, address } = wallet || {}
    if (address) {
      dispatch(walletActions.deleteWallet(address))
    }
    if (root) {
      storage.removeItem(root)
    }
  }
  useEffect(() => {
    if (purged || !wallets || wallets.length === 0) {
      return
    }
    const now = Date.now()
    setPurged(true)
    Object.keys(wallets || {}).forEach((address) => {
      const wallet = wallets[address]
      if (!wallet) {
        return
      }
      if (
        (wallet?.temp && wallet.temp < now) ||
        address === ONEConstants.EmptyAddress ||
        !wallet.network
      ) {
        purge(wallet)
      }
    })
  }, [wallets])

  const isMatchingWallet = (w) => {
    return w.network === network &&
      !w.temp &&
      w.address !== ONEConstants.EmptyAddress
  }

  return (
    <>
      <Row gutter={[24, 24]}>
        {values(wallets).filter(w => isMatchingWallet(w)).map((w, i) => <Col span={isMobile && 24} key={`${w.address}-${i}`}><WalletCard wallet={w} /></Col>)}
      </Row>
      <Row style={{ marginTop: 36 }}>
        <Space direction='vertical'>
          <Space align='baseline' style={{ justifyContent: 'space-between', marginLeft: isMobile ? '24px' : undefined }}>
            <Title level={titleLevel} style={{ marginRight: isMobile ? 16 : 48 }}>Total Balance</Title>
            <Title level={titleLevel}>{formatted}</Title><Text type='secondary'>ONE</Text>
          </Space>
          <Space align='baseline' style={{ justifyContent: 'space-between', marginLeft: isMobile ? '24px' : undefined }}>
            <Title level={titleLevel} style={{ marginRight: isMobile ? 16 : 48, opacity: 0 }}>Total Balance</Title>
            <Title style={{ whiteSpace: 'nowrap' }} level={titleLevel}>≈ ${fiatFormatted}</Title><Text type='secondary'>USD</Text>
          </Space>
        </Space>
      </Row>
    </>
  )
}
export default List
