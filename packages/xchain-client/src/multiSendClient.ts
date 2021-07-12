import { Asset, BaseAmount } from '@xchainjs/xchain-util'

import { Client } from './client'
import { Address, Fees, TxHash } from './types'

export type SingleAndMultiFees = {
  single: Fees
  multi: Fees
}

export type MultiSendParams = {
  walletIndex?: number
  transactions: Array<{
    to: Address
    coins: Array<{
      asset: Asset
      amount: BaseAmount
    }>
  }>
  memo?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MultiSendClient extends Client<any, any> {
  getMultiSendFees(): Promise<Fees>
  getSingleAndMultiFees(): Promise<SingleAndMultiFees>
  multiSend(params: MultiSendParams): Promise<TxHash>
}
