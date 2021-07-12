import { Asset } from '@xchainjs/xchain-util'

import { Client } from './client'
import { Address, Balance } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MultiAssetClient extends Client<any, any> {
  getBalance(address: Address, assets?: Asset[]): Promise<Balance[]>
}
