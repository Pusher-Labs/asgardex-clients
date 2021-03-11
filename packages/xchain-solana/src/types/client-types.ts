export type {
  Address,
  Balances,
  Network,
  Tx,
  TxsPage,
  XChainClientParams,
  TxParams,
  TxHash,
  Fees,
  TxHistoryParams,
  XChainClient,
} from '@xchainjs/xchain-client'

type TFieldStatus = {
  Ok: number
}
type TFieldMeta = {
  err: number
  fee: number
  innerInstructions: number
  logMessages: string[]
  postBalances: number[]
  postTokenBalances: number[]
  preBalances: number[]
  preTokenBalances: number[]
  status: TFieldStatus
}
type TItemAccountKey = {
  pubkey: string
  signer: boolean
  writable: boolean
}
type TFieldParsed = {
  info: TFieldInfo
  type: string
}
type TFieldInfo = {
  destination: string
  lamports: number
  source: string
}
type TItemInstructions = {
  parsed: TFieldParsed
  program: string
  programId: string
}
type TFieldMessage = {
  accountKeys: TItemAccountKey[]
  instructions: TItemInstructions[]
  recentBlockhash: string
}
type TFieldTransaction = {
  message: TFieldMessage
  signatures: string[]
}

export interface SolanaTx {
  blockTime: number
  meta: TFieldMeta
  slot: number
  transaction: TFieldTransaction
}
