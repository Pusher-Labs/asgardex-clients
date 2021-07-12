import {
  Address,
  Bech32WalletParams,
  Wallet as BaseWallet,
  WalletFactory,
  WalletParams,
  isBech32WalletParams,
} from '@xchainjs/xchain-client'
import { validatePhrase } from '@xchainjs/xchain-crypto'
import { PrivKey } from 'cosmos-client'

import { CosmosSDKClient } from './cosmos'

export interface Wallet extends BaseWallet {
  getPrivateKey(index: number): Promise<PrivKey>
}

class DefaultWallet implements Wallet {
  protected readonly params: Bech32WalletParams
  protected readonly phrase: string
  protected readonly sdkClient: CosmosSDKClient

  protected constructor(params: Bech32WalletParams, phrase: string) {
    this.params = params
    this.phrase = phrase
    this.sdkClient = new CosmosSDKClient({
      server: '',
      chainId: '',
      prefix: this.params.bech32Prefix,
    })
  }

  static create(phrase: string): WalletFactory<DefaultWallet> {
    return async (params: WalletParams) => {
      if (!isBech32WalletParams(params)) throw new Error('bech32Prefix must be specified')
      if (!validatePhrase(phrase)) throw new Error('Invalid phrase')
      return new this(params, phrase)
    }
  }

  async getAddress(index: number): Promise<Address> {
    const privateKey = await this.getPrivateKey(index)
    return this.sdkClient.getAddressFromPrivKey(privateKey)
  }

  async getPrivateKey(index: number): Promise<PrivKey> {
    const path = this.params.getFullDerivationPath(index)
    return this.sdkClient.getPrivKeyFromMnemonic(this.phrase, path)
  }
}

export const Wallet = DefaultWallet
