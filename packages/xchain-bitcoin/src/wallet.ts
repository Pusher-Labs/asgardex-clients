import { Address, Wallet as BaseWallet, WalletFactory, WalletParams } from '@xchainjs/xchain-client'
import { getSeed, validatePhrase } from '@xchainjs/xchain-crypto'
import * as Bitcoin from 'bitcoinjs-lib'

import * as Utils from './utils'

export interface Wallet extends BaseWallet {
  getBtcKeys(index: number): Promise<Bitcoin.ECPairInterface>
}

class DefaultWallet implements Wallet {
  protected readonly params: WalletParams
  protected readonly phrase: string

  protected constructor(params: WalletParams, phrase: string) {
    this.params = params
    this.phrase = phrase
  }

  static create(phrase: string): WalletFactory<DefaultWallet> {
    return async (params: WalletParams) => {
      if (!validatePhrase(phrase)) throw new Error('Invalid phrase')
      return new this(params, phrase)
    }
  }

  async getAddress(index = 0): Promise<Address> {
    const btcKeys = await this.getBtcKeys(index)

    const { address } = Bitcoin.payments.p2wpkh({
      pubkey: btcKeys.publicKey,
      network: Utils.btcNetwork(this.params.network),
    })

    // Despite the exported typings on Payment, this can never actually be undefined.
    if (address === undefined) throw new Error('could not get address')
    return address
  }

  async getBtcKeys(index: number): Promise<Bitcoin.ECPairInterface> {
    const btcNetwork = Utils.btcNetwork(this.params.network)

    const seed = getSeed(this.phrase)
    const master = Bitcoin.bip32.fromSeed(seed, btcNetwork).derivePath(this.params.getFullDerivationPath(index))
    if (!master.privateKey) throw new Error('Could not get private key from phrase')
    return Bitcoin.ECPair.fromPrivateKey(master.privateKey, { network: btcNetwork })
  }
}

export const Wallet = DefaultWallet
