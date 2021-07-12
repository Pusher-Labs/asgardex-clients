import { Keyring } from '@polkadot/api'
import { KeyringPair } from '@polkadot/keyring/types'
import { Address, Wallet as BaseWallet, WalletFactory, WalletParams as BaseWalletParams } from '@xchainjs/xchain-client'
import { validatePhrase } from '@xchainjs/xchain-crypto'

export interface WalletParams extends BaseWalletParams {
  ss58Format: number
}

export interface Wallet extends BaseWallet {
  getKeyringPair(index: number): Promise<KeyringPair>
}

class DefaultWallet implements Wallet {
  protected readonly params: WalletParams
  protected readonly phrase: string

  protected constructor(params: WalletParams, phrase: string) {
    this.params = params
    this.phrase = phrase
  }

  static create(phrase: string): WalletFactory<DefaultWallet, WalletParams> {
    return async (params: WalletParams) => {
      if (!validatePhrase(phrase)) throw new Error('Invalid phrase')
      return new this(params, phrase)
    }
  }

  async getAddress(index: number): Promise<Address> {
    return (await this.getKeyringPair(index)).address
  }

  async getKeyringPair(index: number): Promise<KeyringPair> {
    const key = new Keyring({ ss58Format: this.params.ss58Format, type: 'ed25519' })
    return key.createFromUri(`${this.phrase}//${this.params.getFullDerivationPath(index)}`)
  }
}

export const Wallet = DefaultWallet
