import { Network } from '@xchainjs/xchain-client'
import { BaseAmount, assetAmount, assetToBase } from '@xchainjs/xchain-util'
import axios from 'axios'

import { BTC_DECIMAL } from './const'
import {
  AddressParams,
  BtcAddressDTO,
  BtcAddressUTXO,
  BtcGetBalanceDTO,
  BtcUnspentTxsDTO,
  SochainResponse,
  Transaction,
  TxConfirmedStatus,
  TxHashParams,
} from './types/sochain-api-types'

const DEFAULT_SUGGESTED_TRANSACTION_FEE = 127

const toSochainNetwork = (network: Network): string => {
  switch (network) {
    case Network.Mainnet:
      return 'BTC'
    case Network.Testnet:
      return 'BTCTEST'
  }
}

/**
 * Get address information.
 *
 * @see https://sochain.com/api#get-display-data-address
 *
 * @param {string} sochainUrl The sochain node url.
 * @param {string} network
 * @param {string} address
 * @returns {BtcAddressDTO}
 */
export const getAddress = async ({ sochainUrl, network, address }: AddressParams): Promise<BtcAddressDTO> => {
  const url = `${sochainUrl}/address/${toSochainNetwork(network)}/${address}`
  const response = await axios.get(url)
  const addressResponse: SochainResponse<BtcAddressDTO> = response.data
  return addressResponse.data
}

/**
 * Get transaction by hash.
 *
 * @see https://sochain.com/api#get-tx
 *
 * @param {string} sochainUrl The sochain node url.
 * @param {string} network network id
 * @param {string} hash The transaction hash.
 * @returns {Transactions}
 */
export const getTx = async ({ sochainUrl, network, hash }: TxHashParams): Promise<Transaction> => {
  const url = `${sochainUrl}/get_tx/${toSochainNetwork(network)}/${hash}`
  const response = await axios.get(url)
  const tx: SochainResponse<Transaction> = response.data
  return tx.data
}

/**
 * Get address balance.
 *
 * @see https://sochain.com/api#get-balance
 *
 * @param {string} sochainUrl The sochain node url.
 * @param {string} network
 * @param {string} address
 * @returns {number}
 */
export const getBalance = async ({ sochainUrl, network, address }: AddressParams): Promise<BaseAmount> => {
  const url = `${sochainUrl}/get_address_balance/${toSochainNetwork(network)}/${address}`
  const response = await axios.get(url)
  const balanceResponse: SochainResponse<BtcGetBalanceDTO> = response.data
  const confirmed = assetAmount(balanceResponse.data.confirmed_balance, BTC_DECIMAL)
  const unconfirmed = assetAmount(balanceResponse.data.unconfirmed_balance, BTC_DECIMAL)
  const netAmt = confirmed.amount().plus(unconfirmed.amount())
  const result = assetToBase(assetAmount(netAmt, BTC_DECIMAL))
  return result
}

/**
 * Get unspent txs
 *
 * @see https://sochain.com/api#get-unspent-tx
 *
 * @param {string} sochainUrl The sochain node url.
 * @param {string} network
 * @param {string} address
 * @returns {BtcAddressUTXO[]}
 */
export const getUnspentTxs = async ({
  sochainUrl,
  network,
  address,
  startingFromTxId,
}: AddressParams): Promise<BtcAddressUTXO[]> => {
  const response: SochainResponse<BtcUnspentTxsDTO> = (
    await axios.get(
      `${sochainUrl}/get_tx_unspent/${toSochainNetwork(network)}/${address}${
        startingFromTxId ? `/${startingFromTxId}` : ''
      }`,
    )
  ).data
  const txs = response.data.txs
  if (txs.length !== 100) return txs

  //fetch the next batch
  const lastTxId = txs[99].txid

  const nextBatch = await getUnspentTxs({
    sochainUrl,
    network,
    address,
    startingFromTxId: lastTxId,
  })
  return txs.concat(nextBatch)
}

/**
 * Get Tx Confirmation status
 *
 * @see https://sochain.com/api#get-is-tx-confirmed
 *
 * @param {string} sochainUrl The sochain node url.
 * @param {Network} network
 * @param {string} hash tx id
 * @returns {TxConfirmedStatus}
 */
export const getIsTxConfirmed = async ({ sochainUrl, network, hash }: TxHashParams): Promise<TxConfirmedStatus> => {
  const response: SochainResponse<TxConfirmedStatus> = (
    await axios.get(`${sochainUrl}/is_tx_confirmed/${toSochainNetwork(network)}/${hash}`)
  ).data
  return response.data
}

/**
 * Get unspent txs and filter out pending UTXOs
 *
 * @see https://sochain.com/api#get-unspent-tx
 *
 * @param {string} sochainUrl The sochain node url.
 * @param {Network} network
 * @param {string} address
 * @returns {BtcAddressUTXO[]}
 */
export const getConfirmedUnspentTxs = async ({
  sochainUrl,
  network,
  address,
}: AddressParams): Promise<BtcAddressUTXO[]> => {
  const txs = await getUnspentTxs({
    sochainUrl,
    network,
    address,
  })

  const confirmedUTXOs: BtcAddressUTXO[] = []

  await Promise.all(
    txs.map(async (tx: BtcAddressUTXO) => {
      const { is_confirmed: isTxConfirmed } = await getIsTxConfirmed({
        sochainUrl,
        network,
        hash: tx.txid,
      })

      if (isTxConfirmed) {
        confirmedUTXOs.push(tx)
      }
    }),
  )

  return confirmedUTXOs
}

/**
 * Get Bitcoin suggested transaction fee.
 *
 * @returns {number} The Bitcoin suggested transaction fee per bytes in sat.
 */
export const getSuggestedTxFee = async (): Promise<number> => {
  //Note: sochain does not provide fee rate related data
  //So use Bitgo API for fee estimation
  //Refer: https://app.bitgo.com/docs/#operation/v2.tx.getfeeestimate
  try {
    const response = await axios.get('https://app.bitgo.com/api/v2/btc/tx/fee')
    return response.data.feePerKb / 1000 // feePerKb to feePerByte
  } catch (error) {
    return DEFAULT_SUGGESTED_TRANSACTION_FEE
  }
}
