import { Address, Balance, FeeRate, TxHash } from '@xchainjs/xchain-client'

export type NormalTxParams = { addressTo: Address; amount: number; feeRate: FeeRate }
export type VaultTxParams = NormalTxParams & { memo: string }

export type Witness = {
  value: number
  script: Buffer
}

export type UTXO = {
  hash: TxHash
  index: number
  value: number
  witnessUtxo: Witness
  address: Address
  txHex: string
}

export type GetChangeParams = {
  valueOut: number
  bchBalance: Balance
}
