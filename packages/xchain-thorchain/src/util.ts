import { Asset, assetToString, baseAmount, assetFromString, THORChain, BaseAmount } from '@xchainjs/xchain-util'
import { AssetRune, ExplorerUrl, ClientUrl, ExplorerUrls, TxData } from './types'
import { TxLog } from '@xchainjs/xchain-cosmos'
import { Fees, Network, Address, TxHash, TxType, TxFrom, TxTo } from '@xchainjs/xchain-client'
import { AccAddress, codec, Msg } from 'cosmos-client'
import { MsgMultiSend, MsgSend } from 'cosmos-client/x/bank'

export const DECIMAL = 8
export const DEFAULT_GAS_VALUE = '2000000'
export const MAX_TX_COUNT = 100

export const isAssetRune = (asset: Asset): boolean => assetToString(asset) === assetToString(AssetRune)

export const isSynthAsset = (asset: Asset): boolean => asset.chain === THORChain && !isAssetRune(asset)

/**
 * Get denomination from Asset
 *
 * @param {Asset} asset
 * @returns {string} The denomination of the given asset.
 */
export const getDenom = (asset: Asset): string => {
  if (isAssetRune(asset)) return 'rune'
  return asset.symbol.toLowerCase()
}

/**
 * Get denomination with chainname from Asset
 *
 * @param {Asset} asset
 * @returns {string} The denomination with chainname of the given asset.
 */
export const getDenomWithChain = (asset: Asset): string => {
  return `${THORChain}.${asset.symbol.toUpperCase()}`
}

/**
 * Get Asset from denomination
 *
 * @param {string} denom
 * @returns {Asset|null} The asset of the given denomination.
 */
export const getAsset = (denom: string): Asset | null => {
  if (denom === getDenom(AssetRune)) return AssetRune
  return assetFromString(`${THORChain}.${denom.toUpperCase()}`)
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isBroadcastSuccess = (response: any): boolean => response.logs !== undefined

/**
 * Get address prefix based on the network.
 *
 * @param {string} network
 * @returns {string} The address prefix based on the network.
 *
 **/
export const getPrefix = (network: string) => (network === 'testnet' ? 'tthor' : 'thor')

/**
 * Register Codecs based on the network.
 *
 * @param {Network}
 */
export const registerCodecs = (network: Network): void => {
  codec.registerCodec('thorchain/MsgSend', MsgSend, MsgSend.fromJSON)
  codec.registerCodec('thorchain/MsgMultiSend', MsgMultiSend, MsgMultiSend.fromJSON)

  const prefix = getPrefix(network)
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

  if (!events) {
    throw Error('No events in logs available')
  }
  console.log(address)
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

  console.log(transferDataList)
  const from: TxFrom[] = []
  const to: TxTo[] = []
  const txType: TxType = 'unknown'

  return {
    from,
    to,
    type: txType,
  }
  // Need to get correct asset from msg
  // const asset: Asset | null = null
  // for (const msg of msgs) {
  //   if (isMsgSend(msg)) {
  //     const msgSend = msg as MsgSend
  //     const amount = msgSend.amount
  //       .map((coin) => baseAmount(coin.amount, DECIMAL))
  //       .reduce((acc, cur) => baseAmount(acc.amount().plus(cur.amount()), DECIMAL), baseAmount(0, DECIMAL))

  //     if (!asset) {
  //       msgSend.amount.forEach((coin) => {
  //         if (coin.denom) asset = getAsset(coin.denom) ?? asset
  //       })
  //     }

  //     let from_index = -1

  //     from.forEach((value, index) => {
  //       if (value.from === msgSend.from_address.toBech32()) from_index = index
  //     })

  //     if (from_index === -1) {
  //       from.push({
  //         from: msgSend.from_address.toBech32(),
  //         amount,
  //       })
  //     } else {
  //       from[from_index].amount = baseAmount(from[from_index].amount.amount().plus(amount.amount()), DECIMAL)
  //     }

  //     let to_index = -1

  //     to.forEach((value, index) => {
  //       if (value.to === msgSend.to_address.toBech32()) to_index = index
  //     })

  //     if (to_index === -1) {
  //       to.push({
  //         to: msgSend.to_address.toBech32(),
  //         amount,
  //       })
  //     } else {
  //       to[to_index].amount = baseAmount(to[to_index].amount.amount().plus(amount.amount()), DECIMAL)
  //     }
  //   } else if (isMsgMultiSend(msg)) {
  //     const msgMultiSend = msg as MsgMultiSend

  //     msgMultiSend.inputs.map((input) => {
  //       const amount = input.coins
  //         .map((coin) => baseAmount(coin.amount, DECIMAL))
  //         .reduce((acc, cur) => baseAmount(acc.amount().plus(cur.amount()), DECIMAL), baseAmount(0, DECIMAL))

  //       if (!asset) {
  //         input.coins.forEach((coin) => {
  //           if (coin.denom) asset = getAsset(coin.denom) ?? asset
  //         })
  //       }

  //       let from_index = -1

  //       from.forEach((value, index) => {
  //         if (value.from === input.address) from_index = index
  //       })

  //       if (from_index === -1) {
  //         from.push({
  //           from: input.address,
  //           amount,
  //         })
  //       } else {
  //         from[from_index].amount = baseAmount(from[from_index].amount.amount().plus(amount.amount()), DECIMAL)
  //       }
  //     })

  //     msgMultiSend.outputs.map((output) => {
  //       const amount = output.coins
  //         .map((coin) => baseAmount(coin.amount, DECIMAL))
  //         .reduce((acc, cur) => baseAmount(acc.amount().plus(cur.amount()), DECIMAL), baseAmount(0, DECIMAL))

  //       if (!asset) {
  //         output.coins.forEach((coin) => {
  //           if (coin.denom) asset = getAsset(coin.denom) ?? asset
  //         })
  //       }

  //       let to_index = -1

  //       to.forEach((value, index) => {
  //         if (value.to === output.address) to_index = index
  //       })

  //       if (to_index === -1) {
  //         to.push({
  //           to: output.address,
  //           amount,
  //         })
  //       } else {
  //         to[to_index].amount = baseAmount(to[to_index].amount.amount().plus(amount.amount()), DECIMAL)
  //       }
  //     })
  //   }
  // }

  //   return [
  //     ...acc,
  //     {
  //       asset: asset || AssetRune,
  //       from,
  //       to,
  //       date: new Date(tx.timestamp),
  //       type: from.length > 0 || to.length > 0 ? 'transfer' : 'unknown',
  //       hash: tx.txhash || '',
  //     },
  //   ]
  // }, [] as Txs)

  // const txData: TxData = transferDataList
  //   // filter out txs which are not based on given address
  //   .filter(({ sender, recipient }) => sender === address || recipient === address)
  //   // transform `TransferData` -> `TxData`
  //   .reduce(
  //     (acc: TxData, { sender, recipient, amount }) => ({
  //       ...acc,
  //       from: [...acc.from, { amount, from: sender }],
  //       to: [...acc.to, { amount, to: recipient }],
  //     }),
  //     { from: [], to: [], type: 'transfer' },
  //   )

  // return txData
}

/**
 * Get the default fee.
 *
 * @returns {Fees} The default fee.
 */
export const getDefaultFees = (): Fees => {
  const fee = baseAmount(DEFAULT_GAS_VALUE, DECIMAL)
  return {
    type: 'base',
    fast: fee,
    fastest: fee,
    average: fee,
  }
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

/**
 * Get the client url.
 *
 * @returns {ClientUrl} The client url (both mainnet and testnet) for thorchain.
 */
export const getDefaultClientUrl = (): ClientUrl => {
  return {
    testnet: {
      node: 'https://testnet.thornode.thorchain.info',
      rpc: 'https://testnet.rpc.thorchain.info',
    },
    mainnet: {
      node: 'https://thornode.thorchain.info',
      rpc: 'https://rpc.thorchain.info',
    },
  }
}

const DEFAULT_EXPLORER_URL = 'https://viewblock.io/thorchain'

/**
 * Get default explorer urls.
 *
 * @returns {ExplorerUrls} Default explorer urls (both mainnet and testnet) for thorchain.
 */
export const getDefaultExplorerUrls = (): ExplorerUrls => {
  const root: ExplorerUrl = {
    testnet: `${DEFAULT_EXPLORER_URL}?network=testnet`,
    mainnet: DEFAULT_EXPLORER_URL,
  }
  const txUrl = `${DEFAULT_EXPLORER_URL}/tx`
  const tx: ExplorerUrl = {
    testnet: txUrl,
    mainnet: txUrl,
  }
  const addressUrl = `${DEFAULT_EXPLORER_URL}/address`
  const address: ExplorerUrl = {
    testnet: addressUrl,
    mainnet: addressUrl,
  }

  return {
    root,
    tx,
    address,
  }
}

/**
 * Get the explorer url.
 *
 * @param {Network} network
 * @param {ExplorerUrls} Explorer urls
 * @returns {string} The explorer url for thorchain based on the given network.
 */
export const getExplorerUrl = ({ root }: ExplorerUrls, network: Network): string => root[network]

/**
 * Get explorer address url.
 *
 * @param {ExplorerUrls} Explorer urls
 * @param {Network} network
 * @param {Address} address
 * @returns {string} The explorer url for the given address.
 */
export const getExplorerAddressUrl = ({
  urls,
  network,
  address,
}: {
  urls: ExplorerUrls
  network: Network
  address: Address
}): string => {
  const url = `${urls.address[network]}/${address}`
  return network === 'mainnet' ? url : `${url}?network=testnet`
}

/**
 * Get transaction url.
 *
 * @param {ExplorerUrls} Explorer urls
 * @param {Network} network
 * @param {TxHash} txID
 * @returns {string} The explorer url for the given transaction id.
 */
export const getExplorerTxUrl = ({
  urls,
  network,
  txID,
}: {
  urls: ExplorerUrls
  network: Network
  txID: TxHash
}): string => {
  const url = `${urls.tx[network]}/${txID}`
  return network === 'mainnet' ? url : `${url}?network=testnet`
}
