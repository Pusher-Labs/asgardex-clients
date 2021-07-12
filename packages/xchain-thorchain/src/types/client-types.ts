import { Tx } from '@xchainjs/xchain-client'
import { Asset, BaseAmount, Chain } from '@xchainjs/xchain-util'

export type DepositParam = {
  walletIndex?: number
  asset?: Asset
  amount: BaseAmount
  memo: string
}

export const AssetRune: Asset = { chain: Chain.THORChain, symbol: 'RUNE', ticker: 'RUNE' }

export type TxData = Pick<Tx, 'from' | 'to' | 'type'>
