import { Asset, BaseAmount } from '@xchainjs/xchain-util'
import { BigNumber } from 'bignumber.js'

export type Address = string

export type Network = 'testnet' | 'mainnet'

export type Balance = {
  asset: Asset
  amount: BaseAmount
}

export type Balances = Balance[]

export type TxType = 'transfer' | 'unknown'

export type TxHash = string

export type TxTo = {
  to: Address // address
  amount: BaseAmount // amount
}

export type TxFrom = {
  from: Address | TxHash // address or tx id
  amount: BaseAmount // amount
}

export type Tx = {
  asset: Asset // asset
  from: TxFrom[] // list of "from" txs. BNC will have one `TxFrom` only, `BTC` might have many transactions going "in" (based on UTXO)
  to: TxTo[] // list of "to" transactions. BNC will have one `TxTo` only, `BTC` might have many transactions going "out" (based on UTXO)
  date: Date // timestamp of tx
  type: TxType // type
  hash: string // Tx hash
}

export type Txs = Tx[]

export type TxsPage = {
  total: number
  txs: Txs
}

export type TxHistoryParams = {
  address: Address // Address to get history for
  offset?: number // Optional Offset
  limit?: number // Optional Limit of transactions
  startTime?: Date // Optional start time
  asset?: string // Optional asset. Result transactions will be filtered by this asset
}

export type TxParams = {
  walletIndex?: number // send from this HD index
  asset?: Asset
  amount: BaseAmount
  recipient: Address
  memo?: string // optional memo to pass
}

export type FeeOptions = {
  feeOptionKey?: FeeOptionKey
  feeRate?: number
  gasPrice?: BaseAmount
  gasLimit?: BigNumber
}

// In most cases, clients don't expect any paramter in `getFees`
// but in some cases, they do (e.g. in xchain-ethereum).
// To workaround this, we just define an "empty" (optional) param for now.
// If needed, any client can extend `FeeParams` to add more  (Check `xchain-ethereum` as an example)
// Let me know if we can do it better ... :)
export type FeesParams = { readonly empty?: '' }

export type FeeOptionKey = 'average' | 'fast' | 'fastest'
export type FeeOption = Record<FeeOptionKey, BaseAmount>
export type FeeRate = number
export type FeeRates = Record<FeeOptionKey, FeeRate>

export type FeeType =
  | 'byte' // fee will be measured as `BaseAmount` per `byte`
  | 'base' // fee will be "flat" measured in `BaseAmount`

export type Fees = FeeOption & {
  type: FeeType
}
export type FeesWithRates = { rates: FeeRates; fees: Fees }

export type RootDerivationPaths = {
  mainnet: string
  testnet: string
}

export type XChainClientParams = {
  network?: Network
  phrase?: string
  rootDerivationPaths?: RootDerivationPaths
}

export interface XChainClient {
  setNetwork(net: Network): void
  getNetwork(): Network

  getExplorerUrl(): string
  getExplorerAddressUrl(address: Address): string
  getExplorerTxUrl(txID: string): string

  validateAddress(address: string): boolean
  getAddress(walletIndex?: number): Address

  setPhrase(phrase: string, walletIndex: number): Address

  getBalance(address: Address, assets?: Asset[]): Promise<Balances>

  getTransactions(params?: TxHistoryParams): Promise<TxsPage>

  getTransactionData(txId: string, assetAddress?: Address): Promise<Tx>

  getFees(params?: FeesParams): Promise<Fees>

  transfer(params: TxParams & FeeOptions): Promise<TxHash>

  purgeClient(): void
}
