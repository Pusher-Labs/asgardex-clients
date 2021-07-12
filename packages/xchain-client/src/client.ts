import { Chain } from '@xchainjs/xchain-util'

import { Address, Balance, Fees, Network, Tx, TxHash, TxHistoryParams, TxParams, TxsPage } from './types'

export interface Explorer {
  url: string
  getAddressUrl(address: Address): string
  getTxUrl(txID: string): string
}

export interface WalletParams {
  chain: Chain
  network: Network
  getFullDerivationPath: (index: number) => string
  bech32Prefix?: string
}

export type Bech32WalletParams = WalletParams & Required<Pick<WalletParams, 'bech32Prefix'>>
export const isBech32WalletParams = (x: WalletParams): x is Bech32WalletParams => !!x.bech32Prefix

export interface ClientParams extends WalletParams {
  explorer: Readonly<Explorer>
  extraPrefixes?: string[]
}

export interface Wallet {
  purge?(): Promise<void>
  getAddress(index: number): Promise<Address>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WalletFactory<WalletType extends Wallet, WalletParamsType extends WalletParams = WalletParams> = (
  params: Readonly<WalletParamsType>,
) => Promise<WalletType>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClientFactory<ClientType extends Client<any, any>> = (
  params: Readonly<ClientClientParamsType<ClientType>>,
  walletFactory?: WalletFactory<ClientWalletType<ClientType>, ClientClientParamsType<ClientType>>,
) => Promise<ClientType>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClientClientParamsType<T> = T extends Client<infer R, any> ? R : never
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClientWalletType<T> = T extends Client<any, infer R> ? R : never

export abstract class Client<ClientParamsType extends ClientParams, WalletType extends Wallet> {
  readonly params: Readonly<ClientParamsType>
  protected wallet: WalletType | null = null

  protected constructor(params: Readonly<ClientParamsType>) {
    this.params = params
  }

  protected async init(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected static bindFactory<ClientType extends Client<any, any>>(
    baseFactory: (params: Readonly<ClientClientParamsType<ClientType>>) => ClientType,
  ): ClientFactory<ClientType> {
    return async (params, walletFactory) => {
      const out = baseFactory(params)
      const inits = []
      for (let prototype = out; prototype !== Object.prototype; prototype = Object.getPrototypeOf(prototype)) {
        if ('init' in prototype && typeof prototype.init === 'function') inits.unshift(prototype.init)
      }
      for (const init of inits) {
        await init.call(out)
      }
      if (walletFactory) await out.unlock(walletFactory)
      return out
    }
  }

  async unlock(walletFactory: WalletFactory<WalletType, ClientParamsType>): Promise<void> {
    const newWallet = await walletFactory(this.params)
    await this.purgeClient()
    this.wallet = newWallet
  }
  async purgeClient(): Promise<void> {
    const oldWallet = this.wallet
    this.wallet = null
    await oldWallet?.purge?.()
  }

  getChain(): Chain {
    return this.params.chain
  }
  getNetwork(): Network {
    return this.params.network
  }

  getPrefix(): string {
    if (this.params.bech32Prefix) return `${this.params.bech32Prefix}1`
    return this.params.extraPrefixes?.[0] ?? ''
  }

  getExplorerUrl() {
    return this.params.explorer.url
  }
  getExplorerAddressUrl(address: Address): string {
    return this.params.explorer.getAddressUrl(address)
  }
  getExplorerTxUrl(txid: string): string {
    return this.params.explorer.getTxUrl(txid)
  }

  getFullDerivationPath(index: number): string {
    return this.params.getFullDerivationPath(index)
  }

  async validateAddress(address: string): Promise<boolean> {
    const prefixes = [...(this.params.extraPrefixes ?? ([] as string[]))]
    if (this.params.bech32Prefix) prefixes.unshift(`${this.params.bech32Prefix}1`)

    for (const prefix of prefixes) {
      if (prefix === undefined) continue
      if (address.startsWith(prefix)) return true
    }
    return false
  }

  abstract getBalance(address: Address): Promise<Balance[]>
  abstract getTransactions(params: TxHistoryParams): Promise<TxsPage>
  abstract getTransactionData(txId: string): Promise<Tx>
  abstract getFees(): Promise<Fees>

  async getAddress(index = 0): Promise<Address> {
    if (this.wallet === null) throw new Error('client must be unlocked')
    if (!(Number.isSafeInteger(index) && index >= 0)) throw new Error('index must be a non-negative integer')
    return this.wallet.getAddress(index)
  }

  abstract transfer(params: TxParams): Promise<TxHash>
}
