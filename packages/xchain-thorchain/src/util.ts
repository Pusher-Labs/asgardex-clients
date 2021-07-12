import { Address, FeeType, Fees, TxType, singleFee } from '@xchainjs/xchain-client'
import { TxLog } from '@xchainjs/xchain-cosmos'
import { Asset, BaseAmount, Chain, assetFromString, assetToString, baseAmount } from '@xchainjs/xchain-util'
import { AccAddress, Msg, codec } from 'cosmos-client'
import { MsgMultiSend, MsgSend } from 'cosmos-client/x/bank'

import { AssetRune, TxData } from './types'

export const DECIMAL = 8
export const DEFAULT_GAS_VALUE = '2000000'
export const MAX_TX_COUNT = 100

/**
 * Get denomination from Asset
 *
 * @param {Asset} asset
 * @returns {string} The denomination of the given asset.
 */
export const getDenom = (asset: Asset): string => {
  if (assetToString(asset) === assetToString(AssetRune)) return 'rune'
  return asset.symbol
}

/**
 * Get denomination with chainname from Asset
 *
 * @param {Asset} asset
 * @returns {string} The denomination with chainname of the given asset.
 */
export const getDenomWithChain = (asset: Asset): string => {
  return `${Chain.THORChain}.${asset.symbol.toUpperCase()}`
}

/**
 * Get Asset from denomination
 *
 * @param {string} denom
 * @returns {Asset|null} The asset of the given denomination.
 */
export const getAsset = (denom: string): Asset | null => {
  if (denom === getDenom(AssetRune)) return AssetRune
  return assetFromString(`${Chain.THORChain}.${denom.toUpperCase()}`)
}

/**
 * Type guard for MsgSend
 *
 * @param {Msg} msg
 * @returns {boolean} `true` or `false`.
 */
export const isMsgSend = (msg: Msg): msg is MsgSend =>
  (msg as MsgSend)?.amount !== undefined &&
  (msg as MsgSend)?.from_address !== undefined &&
  (msg as MsgSend)?.to_address !== undefined

/**
 * Type guard for MsgMultiSend
 *
 * @param {Msg} msg
 * @returns {boolean} `true` or `false`.
 */
export const isMsgMultiSend = (msg: Msg): msg is MsgMultiSend =>
  (msg as MsgMultiSend)?.inputs !== undefined && (msg as MsgMultiSend)?.outputs !== undefined

/**
 * Response guard for transaction broadcast
 *
 * @param {any} response The response from the node.
 * @returns {boolean} `true` or `false`.
 */
export const isBroadcastSuccess = (response: unknown): boolean =>
  typeof response === 'object' &&
  response !== null &&
  'logs' in response &&
  (response as Record<string, unknown>).logs !== undefined

/**
 * Register Codecs based on the prefix.
 *
 * @param {string} prefix
 */
export const registerCodecs = (prefix: string): void => {
  codec.registerCodec('thorchain/MsgSend', MsgSend, MsgSend.fromJSON)
  codec.registerCodec('thorchain/MsgMultiSend', MsgMultiSend, MsgMultiSend.fromJSON)

  AccAddress.setBech32Prefix(
    prefix,
    prefix + 'pub',
    prefix + 'valoper',
    prefix + 'valoperpub',
    prefix + 'valcons',
    prefix + 'valconspub',
  )
}

/**
 * Parse transaction data from event logs
 *
 * @param {TxLog[]} logs List of tx logs
 * @param {Address} address - Address to get transaction data for
 * @returns {TxData} Parsed transaction data
 */
export const getDepositTxDataFromLogs = (logs: TxLog[], address: Address): TxData => {
  const events = logs[0]?.events

  if (!events) throw new Error('No events in logs available')

  type TransferData = { sender: string; recipient: string; amount: BaseAmount }
  type TransferDataList = TransferData[]
  const transferDataList: TransferDataList = events.reduce((acc: TransferDataList, { type, attributes }) => {
    if (type === 'transfer') {
      return attributes.reduce((acc2, { key, value }, index) => {
        if (index % 3 === 0) acc2.push({ sender: '', recipient: '', amount: baseAmount(0, DECIMAL) })
        const newData = acc2[acc2.length - 1]
        if (key === 'sender') newData.sender = value
        if (key === 'recipient') newData.recipient = value
        if (key === 'amount') newData.amount = baseAmount(value.replace(/rune/, ''), DECIMAL)
        return acc2
      }, acc)
    }
    return acc
  }, [])

  const txData: TxData = transferDataList
    // filter out txs which are not based on given address
    .filter(({ sender, recipient }) => sender === address || recipient === address)
    // transform `TransferData` -> `TxData`
    .reduce(
      (acc: TxData, { sender, recipient, amount }) => ({
        ...acc,
        from: [...acc.from, { amount, from: sender }],
        to: [...acc.to, { amount, to: recipient }],
      }),
      { from: [], to: [], type: TxType.Transfer },
    )

  return txData
}

/**
 * Get the default fee.
 *
 * @returns {Fees} The default fee.
 */
export const getDefaultFees = (): Fees => {
  const fee = baseAmount(DEFAULT_GAS_VALUE, DECIMAL)
  return singleFee(FeeType.FlatFee, fee)
}

/**
 * Get transaction type.
 *
 * @param {string} txData the transaction input data
 * @param {string} encoding `base64` or `hex`
 * @returns {string} the transaction type.
 */
export const getTxType = (txData: string, encoding: 'base64' | 'hex'): string => {
  return Buffer.from(txData, encoding).toString().slice(4)
}
