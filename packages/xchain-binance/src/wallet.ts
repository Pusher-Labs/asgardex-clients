import { BncClient } from '@binance-chain/javascript-sdk'
import * as crypto from '@binance-chain/javascript-sdk/lib/crypto'
import {
  Address,
  Bech32WalletParams,
  Wallet as BaseWallet,
  WalletFactory,
  WalletParams,
  isBech32WalletParams,
} from '@xchainjs/xchain-client'
import { getSeed, validatePhrase } from '@xchainjs/xchain-crypto'
import * as bip32 from 'bip32'

type SigningDelegate = BncClient['_signingDelegate']

export interface Wallet extends BaseWallet {
  getSigningDelegate(index: number): Promise<SigningDelegate>
}

class DefaultWallet implements Wallet {
  protected readonly params: Bech32WalletParams
  protected readonly phrase: string

  protected constructor(params: Bech32WalletParams, phrase: string) {
    this.params = params
    this.phrase = phrase
  }

  static create(phrase: string): WalletFactory<DefaultWallet> {
    return async (params: WalletParams) => {
      if (!isBech32WalletParams(params)) throw new Error('bech32Prefix must be specified')
      if (!validatePhrase(phrase)) throw new Error('Invalid phrase')
      return new this(params, phrase)
    }
  }

  protected async getPrivateKey(index: number): Promise<string> {
    const seed = getSeed(this.phrase)
    const path = this.params.getFullDerivationPath(index)
    const node = bip32.fromSeed(seed).derivePath(path)
    if (node.privateKey === undefined) throw new Error('child does not have a privateKey')
    return node.privateKey.toString('hex')
  }

  async getAddress(index: number): Promise<Address> {
    const privateKey = await this.getPrivateKey(index)
    return crypto.getAddressFromPrivateKey(privateKey, this.params.bech32Prefix)
  }

  async getSigningDelegate(index: number): Promise<SigningDelegate> {
    const privateKey = await this.getPrivateKey(index)
    return async (tx, signMsg?) => {
      return tx.sign(privateKey, signMsg)
    }
  }
}

export const Wallet = DefaultWallet
