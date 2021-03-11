import { JsonRpc } from './json-rpc'

import type { Address } from '@xchainjs/xchain-client'
import type { SolanaTx } from './types'

export type TGetBalanceResult = {
  value: number
}

export type TGetConfirmedSignaturesForAddress2Options = {
  limit?: number
  before?: string
  until?: string
}

export type TTransactionError = {
  //
}
export type TGetConfirmedSignaturesForAddress2Result = {
  blockTime: number
  signature: string
  slot: string | number
  err: TTransactionError | null
  memo: string | null
}

export type TGetConfirmedTransaction2Result = SolanaTx

export type TFeeCalculator = {
  lamportsPerSignature: number
}

export type TGetFeesResultValue = {
  blockhash: string
  feeCalculator: TFeeCalculator
  lastValidSlot: number
}

export type TGetFeesResult = {
  value: TGetFeesResultValue
}

export class SolanaAPI {
  private rpc: JsonRpc

  constructor(urlApi: string, private commitment: string = 'finalized') {
    this.rpc = new JsonRpc(urlApi)
  }

  public async getBalance(address: Address): Promise<number> {
    const { commitment } = this
    const method = 'getBalance'
    const params = [address, { commitment }]

    const res = await this.rpc.call<TGetBalanceResult>(method, params)
    const { value } = res
    return value
  }

  public async getConfirmedSignaturesForAddress2(
    address: Address,
    options: TGetConfirmedSignaturesForAddress2Options,
  ): Promise<TGetConfirmedSignaturesForAddress2Result[]> {
    const method = 'getConfirmedSignaturesForAddress2'
    const params = [address, { options }]

    return this.rpc.call<TGetConfirmedSignaturesForAddress2Result[]>(method, params)
  }

  public async getConfirmedTransaction(signature: string): Promise<TGetConfirmedTransaction2Result> {
    const method = 'getConfirmedTransaction'
    const params = [signature, 'jsonParsed']

    const res = await this.rpc.call<TGetConfirmedTransaction2Result>(method, params)

    return res
  }

  public async getFees(): Promise<TGetFeesResultValue> {
    const { commitment } = this
    const method = 'getFees'
    const params = [{ commitment }]

    const res = await this.rpc.call<TGetFeesResult>(method, params)

    const { value } = res
    return value
  }
}
