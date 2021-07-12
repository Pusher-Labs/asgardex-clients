import { FeeType, Fees, Tx, TxFrom, TxTo, TxType } from '@xchainjs/xchain-client'
import { Asset, BaseAmount, assetToString, baseAmount } from '@xchainjs/xchain-util'
import { Msg, codec } from 'cosmos-client'
import { Input, MsgMultiSend, MsgSend, Output } from 'cosmos-client/x/bank'

import { APIQueryParam, RawTxResponse, TxResponse } from './cosmos/types'
import { AssetAtom, AssetMuon } from './types'

/**
 * The decimal for cosmos chain.
 */
export const DECIMAL = 6

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
 * Get denomination from Asset
 *
 * @param {Asset} asset
 * @returns {string} The denomination of the given asset.
 */
export const getDenom = (asset: Asset): string => {
  if (assetToString(asset) === assetToString(AssetAtom)) return 'uatom'
  if (assetToString(asset) === assetToString(AssetMuon)) return 'umuon'
  return asset.symbol
}

/**
 * Get Asset from denomination
 *
 * @param {string} denom
 * @returns {Asset|null} The asset of the given denomination.
 */
export const getAsset = (denom: string): Asset | null => {
  if (denom === getDenom(AssetAtom)) return AssetAtom
  if (denom === getDenom(AssetMuon)) return AssetMuon
  return null
}

/**
 * Parse transaction type
 *
 * @param {TxResponse[]} txs The transaction response from the node.
 * @param {Asset} mainAsset Current main asset which depends on the network.
 * @returns {Tx[]} The parsed transaction result.
 */
export const parseTxResponse = (
  tx: TxResponse,
  mainAsset: Asset,
): Tx & {
  msgs: Array<{
    type: string
    value: Record<string, unknown>
  }>
} => {
  const rawTxTx = tx.tx
  if (rawTxTx === undefined) throw new Error("can't parse TxResponse with missing 'tx' property")
  const txTx: Exclude<typeof rawTxTx, codec.AminoWrapping> = codec.fromJSONString(codec.toJSONString(rawTxTx))

  const isRecord = (x: unknown): x is Record<string, unknown> => ['object', 'function'].includes(typeof x) && x !== null
  const isRawTxResponse = (x: unknown): x is RawTxResponse => isRecord(x) && 'body' in x && x.body !== undefined

  const msgs: Msg[] = (() => {
    if (isRawTxResponse(txTx)) {
      return txTx.body.messages
    } else {
      return txTx.msg
    }
  })()

  const inputs: Input[] = []
  const outputs: Output[] = []
  for (const msg of msgs) {
    if (isMsgSend(msg)) {
      inputs.push({
        address: msg.from_address.toBech32(),
        coins: [...msg.amount],
      })
      outputs.push({
        address: msg.to_address.toBech32(),
        coins: [...msg.amount],
      })
    } else if (isMsgMultiSend(msg)) {
      inputs.push(...msg.inputs)
      outputs.push(...msg.outputs)
    }
  }

  const deduplicate = <T extends Input | Output>(a: T[], x: T) => {
    const i = a.findIndex((y) => y.address === x.address)
    if (i !== -1) {
      a[i].coins.push(...x.coins)
    } else {
      a.push(x)
    }
    return a
  }

  const sumCoins = (coins: Input['coins']) => {
    return coins.reduce<{ denom?: string; baseAmount: BaseAmount }>(
      (acc, coin) => {
        const coinAmount = baseAmount(coin.amount, 6).amount()
        const denom = acc.denom ?? coin.denom
        if (coin.denom !== denom) throw new Error("can't add Coins of different denominations")
        return {
          denom,
          baseAmount: baseAmount(acc.baseAmount.amount().plus(coinAmount), 6),
        }
      },
      {
        denom: undefined,
        baseAmount: baseAmount(0, 6),
      },
    ).baseAmount
  }

  const from: TxFrom[] = inputs.reduce(deduplicate, [] as Input[]).map((input) => ({
    from: input.address,
    amount: sumCoins(input.coins),
  }))
  const to: TxTo[] = outputs.reduce(deduplicate, [] as Output[]).map((output) => ({
    to: output.address,
    amount: sumCoins(output.coins),
  }))

  return {
    asset: mainAsset,
    from,
    to,
    msgs: JSON.parse(codec.toJSONString(msgs)),
    date: new Date(tx.timestamp),
    type: from.length > 0 || to.length > 0 ? TxType.Transfer : TxType.Unknown,
    hash: tx.txhash ?? '',
  }
}

/**
 * Get Query String
 *
 * @param {APIQueryParam}
 * @returns {string} The query string.
 */
export const getQueryString = (params: APIQueryParam): string => {
  return Object.keys(params)
    .filter((key) => key.length > 0)
    .map((key) => (params[key] == null ? key : `${key}=${encodeURIComponent(params[key].toString())}`))
    .join('&')
}

/**
 * Register message codecs.
 *
 * @returns {void}
 */
export const registerCodecs = () => {
  codec.registerCodec('cosmos-sdk/MsgSend', MsgSend, MsgSend.fromJSON)
  codec.registerCodec('cosmos-sdk/MsgMultiSend', MsgMultiSend, MsgMultiSend.fromJSON)
}

/**
 * Get the default fee.
 *
 * @returns {Fees} The default fee.
 */
export const getDefaultFees = (): Fees => {
  return {
    type: FeeType.FlatFee,
    fast: baseAmount(750, DECIMAL),
    fastest: baseAmount(2500, DECIMAL),
    average: baseAmount(0, DECIMAL),
  }
}
