import { CloseOutlined, ScanOutlined } from '@ant-design/icons'
import { Select, Button, Tooltip, Row, Col, Spin, Typography, Space, message } from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import util, { useWaitExecution, useWindowDimensions, updateQRCodeState } from '../util'
import WalletConstants from '../constants/wallet'
import api from '../api'
import { isEmpty, trim } from 'lodash'
import ONEConstants from '../../../lib/constants'
import QrCodeScanner from './QrCodeScanner'

const { Text } = Typography

const delayDomainOperationMillis = 1000

const ScanButton = ({ isMobile, showQrCodeScanner, setShowQrCodeScanner }) => {
  const inner = showQrCodeScanner
    ? <CloseOutlined style={{ fontSize: '24px', marginTop: -8 }} onClick={() => setShowQrCodeScanner(false)} />
    : <ScanOutlined style={{ fontSize: '24px', marginTop: -8 }} onClick={() => setShowQrCodeScanner(true)} />

  if (!isMobile) {
    return (
      <Tooltip title='Scan address QR Code'>
        {inner}
      </Tooltip>
    )
  }
  return inner
}

/**
 * Renders address input that provides type ahead search for any known addresses.
 * Known addresses are addresses that have been entered by user for at least once.
 */
const AddressInput = ({ setAddressCallback, currentWallet, addressValue, extraSelectOptions, disableManualInput, disabled, style, allowTemp }) => {
  const dispatch = useDispatch()
  const state = useRef({ last: undefined, lastTime: Date.now() }).current
  const [searchingAddress, setSearchingAddress] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [showQrCodeScanner, setShowQrCodeScanner] = useState('')
  const walletsMap = useSelector(state => state.wallet.wallets)
  const wallets = Object.keys(walletsMap).map((k) => walletsMap[k])
  const knownAddresses = useSelector(state =>
    state.wallet.knownAddresses || {}
  )
  const network = useSelector(state => state.wallet.network)
  const { isMobile } = useWindowDimensions()
  const deleteKnownAddress = useCallback((address) => {
    setAddressCallback({ value: '', label: '' })
    dispatch(walletActions.deleteKnownAddress(address))
  }, [dispatch])

  const onSearchAddress = (value) => {
    setSearchingAddress(true)
    setSearchValue(value)
  }

  // Scanned value for address prefill will be ROOT_URL/to/{address}?d=xxx, we take address here for prefill.
  const onScan = async (v) => {
    setSearchingAddress(true)
    if (!updateQRCodeState(v, state)) {
      return
    }

    state.last = v
    state.lastTime = Date.now()
    const pattern = WalletConstants.qrcodePattern
    const m = v.match(pattern)
    if (!m) {
      message.error('Unrecognizable code')
      return
    }
    const maybeAddress = m[1]
    const validAddress = util.safeNormalizedAddress(maybeAddress)
    if (maybeAddress && validAddress) {
      const oneAddress = util.safeOneAddress(validAddress)
      const domainName = await api.blockchain.domain.reverseLookup({ address: validAddress })

      onSelectAddress({
        label: domainName || oneAddress,
        value: validAddress
      })

      setShowQrCodeScanner(false)
    }

    if (maybeAddress && !validAddress) {
      message.error('Address not found')
      setShowQrCodeScanner(false)
    }
    setSearchingAddress(false)
  }

  useWaitExecution(
    async () => {
      try {
        const value = trim(searchValue)

        const validAddress = util.safeNormalizedAddress(value)

        if (validAddress) {
          const domainName = await api.blockchain.domain.reverseLookup({ address: validAddress })

          setAddressCallback({
            value: validAddress,
            domainName,
            filterValue: searchValue,
            selected: false
          })
        }

        if (!isEmpty(value) && value.includes(`${ONEConstants.Domain.DEFAULT_PARENT_LABEL}.${ONEConstants.Domain.DEFAULT_TLD}`)) {
          const resolvedAddress = await api.blockchain.domain.resolve({ name: value })

          if (!util.isEmptyAddress(resolvedAddress)) {
            setAddressCallback({
              value: resolvedAddress,
              domainName: value,
              filterValue: searchValue,
              selected: false
            })
          }
        }

        setSearchingAddress(false)
      } catch (e) {
        console.error(e)
        setSearchingAddress(false)
      }
    },
    true,
    delayDomainOperationMillis,
    [searchValue, setSearchingAddress, setAddressCallback]
  )

  const walletsAddresses = wallets.map((wallet) => wallet.address)

  /**
   * Determines if the input wallet wallet is for the current wallet. Applicable for existing wallet management.
   */
  const notCurrentWallet = useCallback((inputWalletAddress) =>
    !currentWallet || currentWallet?.address !== inputWalletAddress,
  [currentWallet])

  useEffect(() => {
    const initKnownAddresses = async () => {
      const existingKnownAddresses = Object.keys(knownAddresses)
        .map((address) => knownAddresses[address])

      const walletsNotInKnownAddresses = wallets.filter((wallet) =>
        !existingKnownAddresses.find((knownAddress) =>
          knownAddress.address === wallet.address && knownAddress.network === wallet.network && (!wallet.temp || allowTemp))
      )

      const knownAddressesWithoutDomain = existingKnownAddresses.filter((knownAddress) =>
        !isEmpty(knownAddress.domain?.name)
      )

      const unlabelledWalletAddress = wallets.filter(w => existingKnownAddresses.find(a => !a.label && !a.domain?.name && a.address === w.address && (!w.temp || allowTemp)))

      // Init the known address entries for existing wallets.
      walletsNotInKnownAddresses.forEach((wallet) => {
        dispatch(walletActions.setKnownAddress({
          label: wallet.name,
          address: wallet.address,
          network: wallet.network,
          creationTime: wallet.effectiveTime,
          numUsed: 0
        }))
      })

      unlabelledWalletAddress.forEach((w) => {
        dispatch(walletActions.setKnownAddress({
          ...knownAddresses[w],
          label: w.name,
        }))
      })

      await Promise.all(knownAddressesWithoutDomain.map(async (knownAddress) => {
        const domainName = await api.blockchain.domain.reverseLookup({ address: knownAddress.address })
        const nowInMillis = new Date().valueOf()

        if (!isEmpty(domainName)) {
          dispatch(walletActions.setKnownAddress({
            ...knownAddress,
            domain: {
              ...knownAddress.domain,
              name: domainName,
              lookupTime: nowInMillis
            }
          }))
        }
      }))
    }

    initKnownAddresses()
  }, [])

  const onSelectAddress = useCallback((addressObject) => {
    const validAddress = util.normalizedAddress(addressObject.value)
    const nowInMillis = new Date().valueOf()

    if (validAddress) {
      const existingKnownAddress = knownAddresses[validAddress]
      // console.log(addressObject)
      setAddressCallback(addressObject.label
        ? {
            ...addressObject,
            selected: true
          }
        : {
            value: addressObject.value,
            label: util.safeOneAddress(addressObject.value),
            domainName: addressObject.domainName,
            selected: true
          })

      dispatch(walletActions.setKnownAddress({
        ...existingKnownAddress,
        label: existingKnownAddress?.label,
        creationTime: existingKnownAddress?.creationTime || nowInMillis,
        numUsed: (existingKnownAddress?.numUsed || 0) + 1,
        network: network,
        lastUsedTime: nowInMillis,
        address: validAddress,
        domain: {
          ...existingKnownAddress?.domain,
          name: addressObject.domainName,
          lookupTime: nowInMillis
        }
      }))
    }
  }, [knownAddresses, setAddressCallback])

  const showSelectManualInputAddress = !disableManualInput && util.safeOneAddress(addressValue.value) &&
    !wallets[util.safeNormalizedAddress(addressValue.value)] &&
    !Object.keys(knownAddresses).includes(util.safeNormalizedAddress(addressValue.value))

  const knownAddressesOptions = Object.keys(knownAddresses).map((address) => ({
    address,
    label: knownAddresses[address].label,
    network: knownAddresses[address].network,
    domain: knownAddresses[address].domain
  }))

  /**
   * Since we are applying setAddressCallback on searching, the addressValue is set as we typing in valid address or domain name.
   * When user click away (blur) from the Select box without clicking an option, the addressValue will be set incorrectly as
   * we are performing extra logic in the onSelectAddress.
   * Perform manual onSelectAddress when user click away from Select box or press keyboard without clicking a Select Option in search/filter result.
   */
  const onEnterSelect = (e) => {
    if (e.type === 'keydown' && e.keyCode === 13 || e.type === 'blur') {
      !addressValue.selected && onSelectAddress({
        ...addressValue,
        label: addressValue.domainName
      })
    }
  }

  /**
   * Builds the Select Option component with given props.
   * ONE address is only used for display, normalized address is used for any internal operations and keys.
   * @param {*} address normalized address for the selection.
   * @param {*} key key for the iterated rendering.
   * @param {*} displayDeleteButton indicates if this option should display delete button or not.
   * @param {*} label of the rendered address option.
   * @param {*} domainName of the displayed address.
   * @param {*} filterValue value used to perform filter, this value should match the user input value.
   * @returns Select Option component for the address.
   */
  const buildSelectOption = ({
    address,
    key = address,
    displayDeleteButton,
    label,
    domainName,
    filterValue
  }) => {
    const oneAddress = util.safeOneAddress(address)
    const addressDisplay = util.shouldShortenAddress({ label, isMobile }) ? util.ellipsisAddress(oneAddress) : oneAddress
    const displayLabel = `${label ? `(${label})` : ''} ${addressDisplay}`
    return (
      <Select.Option key={addressDisplay} value={filterValue} style={{ padding: 0 }}>
        <Row align='left'>
          <Col span={!displayDeleteButton ? 24 : 20}>
            <Tooltip title={oneAddress}>
              <Button
                block
                type='text'
                style={{ textAlign: 'left', height: '100%', padding: '5px' }}
                onClick={() => {
                  onSelectAddress({ value: address, label: displayLabel, key, domainName })
                }}
              >
                <Space direction={isMobile ? 'vertical' : 'horizontal'}>
                  {label ? `(${label})` : ''}
                  {addressDisplay}
                </Space>
              </Button>
            </Tooltip>
          </Col>
          <Col span={4}>
            {
            displayDeleteButton
              ? (
                <Button
                  type='text' style={{ textAlign: 'left', height: '50px' }} onClick={(e) => {
                    deleteKnownAddress(address)
                    e.stopPropagation()
                    return false
                  }}
                >
                  <CloseOutlined />
                </Button>
                )
              : <></>
          }
          </Col>
        </Row>
      </Select.Option>
    )
  }

  // Make sure there is no value set for Select input if no selection since we are using labelInValue, which a default value/label
  // will cover the inner search input that will make the right-click to paste not available.
  const selectInputValueProp = addressValue.value !== ''
    ? {
        value: addressValue
      }
    : {}

  return (
    <>
      <Space direction='vertical' style={{ width: '100%' }}>
        <Select
          suffixIcon={<ScanButton isMobile={isMobile} setShowQrCodeScanner={setShowQrCodeScanner} showQrCodeScanner={showQrCodeScanner} />}
          placeholder='one1......'
          labelInValue
          style={{
            width: isMobile ? '100%' : 500,
            borderBottom: '1px dashed black',
            ...style
          }}
          notFoundContent={searchingAddress ? <Spin size='small' /> : <Text type='secondary'>No address found</Text>}
          bordered={false}
          showSearch
          onBlur={onEnterSelect}
          onInputKeyDown={onEnterSelect}
          onSearch={onSearchAddress}
          disabled={disabled}
          {
          ...selectInputValueProp
        }
        >
          {
          knownAddressesOptions
            .filter((knownAddress) =>
              knownAddress.network === network &&
              notCurrentWallet(knownAddress.address) &&
              (!walletsMap?.[knownAddress.address]?.temp || allowTemp) && // not a temporary wallet
              knownAddress.address !== WalletConstants.oneWalletTreasury.address)
            .sort((knownAddress) => knownAddress.label ? -1 : 0)
            .map((knownAddress, index) => {
              const oneAddress = util.safeOneAddress(knownAddress.address)
              const addressLabel = knownAddress.label || knownAddress.domain?.name

              // Only display actions for addresses that are not selected.
              // User's wallets addresses are not deletable.
              const displayDeleteButton = addressValue.value !== knownAddress.address && !walletsAddresses.includes(knownAddress.address)

              return buildSelectOption({
                key: index,
                address: knownAddress.address,
                displayDeleteButton,
                label: addressLabel,
                domainName: knownAddress.domain?.name,
                filterValue: `${knownAddress.address} ${oneAddress} ${knownAddress.domain?.name}`
              })
            })
        }
          {
          showSelectManualInputAddress && buildSelectOption({
            address: addressValue.value,
            label: addressValue.domainName,
            domainName: addressValue.domainName,
            filterValue: addressValue.filterValue
          })
        }
          {
          extraSelectOptions ? extraSelectOptions.map(buildSelectOption) : <></>
        }
        </Select>
        {showQrCodeScanner && <QrCodeScanner shouldInit onScan={onScan} />}
      </Space>
    </>
  )
}

export default AddressInput
