import * as bitcash from '@psf/bitcoincashjs-lib'
import {
  Address,
  Balance,
  Fee,
  FeeOption,
  FeeRate,
  Network,
  Tx,
  TxHash,
  TxHistoryParams,
  TxParams,
  TxsPage,
  UTXOClient,
  XChainClientParams,
} from '@xchainjs/xchain-client'
import { getSeed } from '@xchainjs/xchain-crypto'
import { Chain } from '@xchainjs/xchain-util'

import { getAccount, getSuggestedFee, getTransaction, getTransactions } from './haskoin-api'
import { broadcastTx } from './node-api'
import { NodeAuth } from './types'
import { KeyPair } from './types/bitcoincashjs-types'
import { ClientUrl } from './types/client-types'
import * as utils from './utils'

export type BitcoinCashClientParams = XChainClientParams & {
  haskoinUrl?: ClientUrl
  nodeUrl?: ClientUrl
  nodeAuth?: NodeAuth
  // index?: number
}

/**
 * Custom Bitcoin Cash client
 */
class Client extends UTXOClient {
  private haskoinUrl: ClientUrl
  private nodeUrl: ClientUrl
  private nodeAuth?: NodeAuth

  /**
   * Constructor
   * Client is initialised with network type
   *
   * @param {BitcoinCashClientParams} params
   */
  constructor({
    network = Network.Testnet,
    haskoinUrl = {
      [Network.Testnet]: 'https://api.haskoin.com/bchtest',
      [Network.Mainnet]: 'https://api.haskoin.com/bch',
    },
    phrase,
    nodeUrl = {
      [Network.Testnet]: 'https://testnet.bch.thorchain.info',
      [Network.Mainnet]: 'https://bch.thorchain.info',
    },
    nodeAuth = {
      username: 'thorchain',
      password: 'password',
    },
    rootDerivationPaths = {
      [Network.Mainnet]: `m/44'/145'/0'/0/`,
      [Network.Testnet]: `m/44'/1'/0'/0/`,
    },
  }: BitcoinCashClientParams) {
    super(Chain.BitcoinCash, { network, rootDerivationPaths, phrase })
    this.network = network
    this.haskoinUrl = haskoinUrl
    this.nodeUrl = nodeUrl
    this.rootDerivationPaths = rootDerivationPaths
    phrase && this.setPhrase(phrase)
    this.nodeAuth =
      // Leave possibility to send requests without auth info for user
      // by strictly passing nodeAuth as null value
      nodeAuth === null ? undefined : nodeAuth
  }

  /**
   * Set/Update the haskoin url.
   *
   * @param {string} url The new haskoin url.
   * @returns {void}
   */
  setHaskoinURL(url: ClientUrl): void {
    this.haskoinUrl = url
  }

  /**
   * Get the haskoin url.
   *
   * @returns {string} The haskoin url based on the current network.
   */
  getHaskoinURL(): string {
    return this.haskoinUrl[this.getNetwork()]
  }

  /**
   * Set/Update the node url.
   *
   * @param {string} url The new node url.
   * @returns {void}
   */
  setNodeURL(url: ClientUrl): void {
    this.nodeUrl = url
  }

  /**
   * Get the node url.
   *
   * @returns {string} The node url for thorchain based on the current network.
   */
  getNodeURL(): string {
    return this.nodeUrl[this.getNetwork()]
  }

  /**
   * Get the explorer url.
   *
   * @returns {string} The explorer url based on the network.
   */
  getExplorerUrl(): string {
    switch (this.network) {
      case Network.Mainnet:
        return 'https://www.blockchain.com/bch'
      case Network.Testnet:
        return 'https://www.blockchain.com/bch-testnet'
    }
  }

  /**
   * Get the explorer url for the given address.
   *
   * @param {Address} address
   * @returns {string} The explorer url for the given address based on the network.
   */
  getExplorerAddressUrl(address: Address): string {
    return `${this.getExplorerUrl()}/address/${address}`
  }

  /**
   * Get the explorer url for the given transaction id.
   *
   * @param {string} txID The transaction id
   * @returns {string} The explorer url for the given transaction id based on the network.
   */
  getExplorerTxUrl(txID: string): string {
    return `${this.getExplorerUrl()}/tx/${txID}`
  }

  /**
   * @private
   * Get private key.
   *
   * Private function to get keyPair from the this.phrase
   *
   * @param {string} phrase The phrase to be used for generating privkey
   * @param {string} derivationPath BIP44 derivation path
   * @returns {PrivateKey} The privkey generated from the given phrase
   *
   * @throws {"Invalid phrase"} Thrown if invalid phrase is provided.
   * */
  private getBCHKeys(phrase: string, derivationPath: string): KeyPair {
    const rootSeed = getSeed(phrase)
    const masterHDNode = bitcash.HDNode.fromSeedBuffer(rootSeed, utils.bchNetwork(this.network))

    return masterHDNode.derivePath(derivationPath).keyPair
  }

  /**
   * Get the current address.
   *
   * Generates a network-specific key-pair by first converting the buffer to a Wallet-Import-Format (WIF)
   * The address is then decoded into type P2WPKH and returned.
   *
   * @returns {Address} The current address.
   *
   * @throws {"Phrase must be provided"} Thrown if phrase has not been set before.
   * @throws {"Address not defined"} Thrown if failed creating account from phrase.
   */
  getAddress(index = 0): Address {
    if (!this.phrase) throw new Error('Phrase must be provided')
    try {
      const keys = this.getBCHKeys(this.phrase, this.getFullDerivationPath(index))
      const address = keys.getAddress(index)

      return utils.stripPrefix(utils.toCashAddress(address))
    } catch (error) {
      throw new Error('Address not defined')
    }
  }

  /**
   * Validate the given address.
   *
   * @param {Address} address
   * @returns {boolean} `true` or `false`
   */
  validateAddress(address: string): boolean {
    return utils.validateAddress(address, this.network)
  }

  /**
   * Get the BCH balance of a given address.
   *
   * @param {Address} address By default, it will return the balance of the current wallet. (optional)
   * @returns {Balance[]} The BCH balance of the address.
   *
   * @throws {"Invalid address"} Thrown if the given address is an invalid address.
   */
  async getBalance(address: Address): Promise<Balance[]> {
    return utils.getBalance({ haskoinUrl: this.getHaskoinURL(), address })
  }

  /**
   * Get transaction history of a given address with pagination options.
   * By default it will return the transaction history of the current wallet.
   *
   * @param {TxHistoryParams} params The options to get transaction history. (optional)
   * @returns {TxsPage} The transaction history.
   *
   * @throws {"Invalid address"} Thrown if the given address is an invalid address.
   */
  async getTransactions({ address, offset, limit }: TxHistoryParams): Promise<TxsPage> {
    offset = offset || 0
    limit = limit || 10

    const account = await getAccount({ haskoinUrl: this.getHaskoinURL(), address })
    const txs = await getTransactions({
      haskoinUrl: this.getHaskoinURL(),
      address,
      params: { offset, limit },
    })

    if (!account) throw new Error(`Invalid address: ${address}`)
    if (!txs) throw new Error(`Transactions could not found for address ${address}`)

    return {
      total: account.txs,
      txs: txs.map(utils.parseTransaction),
    }
  }

  /**
   * Get the transaction details of a given transaction id.
   *
   * @param {string} txId The transaction id.
   * @returns {Tx} The transaction details of the given transaction id.
   *
   * @throws {"Invalid TxID"} Thrown if the given transaction id is an invalid one.
   */
  async getTransactionData(txId: string): Promise<Tx> {
    const tx = await getTransaction({ haskoinUrl: this.getHaskoinURL(), txId })
    if (!tx) throw new Error('Invalid TxID')

    return utils.parseTransaction(tx)
  }

  protected async getSuggestedFeeRate(): Promise<FeeRate> {
    return await getSuggestedFee()
  }

  protected async calcFee(feeRate: FeeRate, memo?: string): Promise<Fee> {
    return utils.calcFee(feeRate, memo)
  }

  /**
   * Transfer BCH.
   *
   * @param {TxParams&FeeRate} params The transfer options.
   * @returns {TxHash} The transaction hash.
   */
  async transfer(params: TxParams & { feeRate?: FeeRate }): Promise<TxHash> {
    const index = params.walletIndex || 0
    const derivationPath = this.getFullDerivationPath(index)

    const feeRate = params.feeRate || (await this.getFeeRates())[FeeOption.Fast]
    const { builder, inputUTXOs } = await utils.buildTx({
      ...params,
      feeRate,
      sender: this.getAddress(index),
      haskoinUrl: this.getHaskoinURL(),
      network: this.network,
    })

    const keyPair = this.getBCHKeys(this.phrase, derivationPath)

    inputUTXOs.forEach((utxo, index) => {
      builder.sign(index, keyPair, undefined, 0x41, utxo.witnessUtxo.value)
    })

    const tx = builder.build()
    const txHex = tx.toHex()

    return await broadcastTx({
      network: this.network,
      txHex,
      nodeUrl: this.getNodeURL(),
      auth: this.nodeAuth,
    })
  }
}

export { Client }
