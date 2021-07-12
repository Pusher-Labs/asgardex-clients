import { HDNode } from '@ethersproject/hdnode'
import { Address, Wallet as BaseWallet, WalletFactory, WalletParams } from '@xchainjs/xchain-client'
import { validatePhrase } from '@xchainjs/xchain-crypto'
import * as ethers from 'ethers'

export interface Wallet extends BaseWallet {
  getSigner(index: number, provider?: ethers.providers.Provider): Promise<ethers.Signer>
}

class BoundSigner extends ethers.Signer {
  private readonly wallet: DefaultWallet
  private readonly index: number
  readonly provider?: ethers.providers.Provider

  constructor(wallet: DefaultWallet, index: number, provider?: ethers.providers.Provider) {
    super()
    this.wallet = wallet
    this.index = index
    this.provider = provider
  }

  getAddress() {
    return this.wallet.getAddress(this.index)
  }

  signMessage(message: ethers.Bytes | string): Promise<string> {
    return this.wallet.signMessage(this.index, message)
  }

  signTransaction(transaction: ethers.providers.TransactionRequest): Promise<string> {
    return this.wallet.signTransaction(this.index, transaction)
  }

  connect(provider: ethers.providers.Provider): ethers.Signer {
    return new BoundSigner(this.wallet, this.index, provider)
  }
}

class DefaultWallet implements Wallet {
  protected readonly params: WalletParams
  protected readonly hdNode: HDNode
  protected readonly hdNodeRevoker: () => void

  protected constructor(params: WalletParams, phrase: string) {
    this.params = params
    const { proxy: hdNode, revoke: hdNodeRevoker } = Proxy.revocable(HDNode.fromMnemonic(phrase), {})
    this.hdNode = hdNode
    this.hdNodeRevoker = hdNodeRevoker
  }

  async purge(): Promise<void> {
    this.hdNodeRevoker()
  }

  static create(phrase: string): WalletFactory<DefaultWallet> {
    return async (params: WalletParams) => {
      if (!validatePhrase(phrase)) throw new Error('Invalid phrase')
      return new this(params, phrase)
    }
  }

  protected async getWallet(index: number, provider?: ethers.providers.Provider): Promise<ethers.Wallet> {
    const derivationPath = this.params.getFullDerivationPath(index)
    const node = this.hdNode.derivePath(derivationPath)
    const out = new ethers.Wallet(node)
    if (provider !== undefined) return out.connect(provider)
    return out
  }

  async getAddress(index: number): Promise<Address> {
    return this.hdNode.derivePath(this.params.getFullDerivationPath(index)).address.toLowerCase()
  }

  async getSigner(index: number, provider?: ethers.providers.Provider): Promise<ethers.Signer> {
    return new BoundSigner(this, index, provider)
  }

  async signMessage(index: number, message: ethers.Bytes | string): Promise<string> {
    const wallet = await this.getWallet(index)
    return await wallet.signMessage(message)
  }

  async signTransaction(index: number, transaction: ethers.providers.TransactionRequest): Promise<string> {
    const wallet = await this.getWallet(index)
    return await wallet.signTransaction(transaction)
  }
}

export const Wallet = DefaultWallet
