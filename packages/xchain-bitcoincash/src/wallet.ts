import * as bitcash from '@psf/bitcoincashjs-lib'
import { Address, Wallet as BaseWallet, WalletFactory, WalletParams } from '@xchainjs/xchain-client'
import { getSeed, validatePhrase } from '@xchainjs/xchain-crypto'

import { KeyPair } from './types/bitcoincashjs-types'
import * as utils from './utils'

export interface Wallet extends BaseWallet {
  getBCHKeys(index: number): Promise<KeyPair>
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

  async getAddress(index: number): Promise<Address> {
    const keyPair = await this.getBCHKeys(index)
    const address = keyPair.getAddress(index)
    return utils.stripPrefix(utils.toCashAddress(address))
  }

  async getBCHKeys(index: number): Promise<KeyPair> {
    const derivationPath = this.params.getFullDerivationPath(index)
    const rootSeed = getSeed(this.phrase)
    const masterHDNode = bitcash.HDNode.fromSeedBuffer(rootSeed, utils.bchNetwork(this.params.network))

    return masterHDNode.derivePath(derivationPath).keyPair
  }
}

export const Wallet = DefaultWallet
