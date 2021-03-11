import * as web3 from '@solana/web3.js'
import * as bip39 from 'bip39'
import * as bs58 from 'bs58'
import nacl from 'tweetnacl'
import BN from 'bn.js'

import { AssetSOL, baseAmount } from '@xchainjs/xchain-util'
import * as Crypto from '@xchainjs/xchain-crypto'

import { SolanaAPI } from './solana-api'

import type { TxFrom, TxTo } from '@xchainjs/xchain-client'
import type { Asset } from '@xchainjs/xchain-util'
import type {
  Address,
  Balances,
  Network,
  Tx,
  TxsPage,
  XChainClient,
  XChainClientParams,
  TxParams,
  TxHash,
  Fees,
  TxHistoryParams,
} from './types'
import type { TGetConfirmedSignaturesForAddress2Options } from './solana-api'

export const SOL_DECIMAL = 9

/**
 * Custom Solana client constructor params
 */
export type SolanaClientParams = XChainClientParams

/**
 * Custom Solana client
 */
export default class Client implements XChainClient {
  private network: Network
  private address: Address | null = null
  private keypair: nacl.SignKeyPair | null = null
  private api: SolanaAPI
  private baseExplorerUrl = 'https://explorer.solana.com/'

  private static checkNetwork(network: Network) {
    if (!network) {
      throw new Error('Network must be provided')
    }

    if (!(network == 'testnet' || network == 'mainnet')) {
      throw new Error('Unknown network name')
    }
  }

  /**
   * Constructor
   * @param {SolanaClientParams} params
   */
  constructor({ network = 'mainnet', phrase }: SolanaClientParams) {
    Client.checkNetwork(network)
    this.network = network
    this.api = this.createAPI()

    if (phrase) {
      this.setPhrase(phrase)
    }
  }

  private createAPI(): SolanaAPI {
    return new SolanaAPI(`https://${this.getApiCluster()}.solana.com/`)
  }

  private getApiCluster(): web3.Cluster {
    return this.network != 'mainnet' ? 'testnet' : 'mainnet-beta'
  }

  private getExplorerUrlSearch(): string {
    return this.network != 'mainnet' ? '?cluster=testnet' : ''
  }

  /**
   * Purge client.
   *
   * @returns {void}
   */
  public purgeClient = (): void => {
    this.address = null
    this.keypair = null
  }

  /**
   * Get the current network.
   *
   * @returns {Network} The current network. (`mainnet` or `testnet`)
   */
  public getNetwork(): Network {
    return this.network
  }

  /**
   * Get the current address.
   *
   * @returns {Address} The current address.
   *
   * @throws {"Phrase must be provided"}
   * Thrown if phrase has not been set before. A phrase is needed to create a wallet and to derive an address from it.
   */
  public getAddress(): Address {
    if (!this.address) {
      throw new Error('Phrase must be provided')
    }
    return this.address
  }

  /**
   * Get the explorer url.
   *
   * @returns {string} The explorer url for ethereum based on the current network.
   */
  public getExplorerUrl(): string {
    return `${this.baseExplorerUrl}${this.getExplorerUrlSearch()}`
  }

  /**
   * Get the explorer url for the given address.
   *
   * @param {Address} address
   * @returns {string} The explorer url for the given address.
   */
  public getExplorerAddressUrl(address: Address): string {
    return `${this.baseExplorerUrl}address/${address}${this.getExplorerUrlSearch()}`
  }

  /**
   * Get the explorer url for the given transaction id.
   *
   * @param {string} txId
   * @returns {string} The explorer url for the given transaction id.
   */
  public getExplorerTxUrl(txId: string): string {
    return `${this.baseExplorerUrl}tx/${txId}${this.getExplorerUrlSearch()}`
  }

  /**
   * Set/update the current network.
   *
   * @param {Network} network `mainnet` or `testnet`.
   * @returns {void}
   *
   * @throws {"Network must be provided"}
   * Thrown if network has not been set before.
   */
  public setNetwork(network: Network): void {
    Client.checkNetwork(network)
    this.network = network
    this.api = this.createAPI()
  }

  /**
   * Set/update a new phrase (Eg. If user wants to change wallet)
   *
   * @param {string} phrase A new phrase.
   * @returns {Address} The address from the given phrase
   *
   * @throws {"Invalid phrase"}
   * Thrown if the given phase is invalid.
   */
  public setPhrase(phrase: string): Address {
    if (!Crypto.validatePhrase(phrase)) {
      throw new Error('Invalid phrase')
    }

    const seed = bip39.mnemonicToSeedSync(phrase)
    this.keypair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32))

    const account: web3.Account = new web3.Account(this.keypair.secretKey)
    this.address = account.publicKey.toString()

    return this.address
  }

  /**
   * Validate the given address.
   *
   * @param {Address} address
   * @returns {boolean} `true` or `false`
   */
  public validateAddress(address: Address): boolean {
    try {
      return bs58.decode(address).length == 32
    } catch {
      return false
    }
  }

  /**
   * Get the SOL balance of a given address.
   *
   * @param {Address} address By default, it will return the balance of the current wallet. (optional)
   * @param {Asset[]} assets Only {AssetSOL} supported. (optional)
   * @returns {Array<Balances>} The all balance of the address.
   *
   * @throws {"Unsupported asset"}
   * Thrown for any asset but {AssetSOL}.
   */
  public async getBalance(address?: Address, assets?: Asset[]): Promise<Balances> {
    const addr = address || this.getAddress()

    if (assets?.length && (assets.length > 1 || assets[0].symbol != AssetSOL.symbol)) {
      throw new Error('Unsupported asset')
    }

    try {
      const balance = await this.api.getBalance(addr)
      const amount = baseAmount(balance.toString(), SOL_DECIMAL)

      return [{ asset: AssetSOL, amount }]
    } catch (error) {
      throw new Error('Invalid address') // ???
    }
  }

  /**
   * Get transaction history of a given address with pagination options.
   * By default it will return the transaction history of the current wallet.
   *
   * @param {TxHistoryParams} params The options to get transaction history. (optional)
   * @returns {TxsPage} The transaction history.
   */
  public async getTransactions(
    params?: TxHistoryParams & {
      before?: string
      until?: string
    },
  ): Promise<TxsPage> {
    const { address, limit, before, until } = params || {}
    const addr = address || this.getAddress() // ???

    const options: TGetConfirmedSignaturesForAddress2Options = {}
    if (limit) {
      options.limit = limit
    }
    if (before) {
      options.before = before
    }
    if (until) {
      options.until = until
    }

    const result: { total: number; txs: Tx[] } = { total: 0, txs: [] }

    try {
      const res = await this.api.getConfirmedSignaturesForAddress2(addr, options)

      result.total = res.length
      result.txs = res.map((t) => ({
        asset: AssetSOL,
        from: [],
        to: [],
        date: new Date(t.blockTime * 1000),
        type: 'transfer',
        hash: t.signature,
      }))
    } catch (error) {
      throw new Error(error)
    }
    return result
  }

  /**
   * Get the transaction details of a given transaction id.
   *
   * @param {string} txId The transaction id.
   * @param {string} assetAddress The asset address. (optional)
   * @returns {Tx} The transaction details of the given transaction id.
   *
   * @throws {"Need to provide valid txId"}
   * Thrown if the given txId is invalid.
   * @throws {"Unsupported asset"}
   * Thrown if the given txId is invalid.
   */
  public async getTransactionData(txId: string, assetAddress?: string): Promise<Tx> {
    if (assetAddress) {
      throw new Error('Unsupported asset')
    }
    const res = await this.api.getConfirmedTransaction(txId)

    const { info } = res.transaction.message.instructions[0].parsed
    const { source, destination, lamports } = info
    const amount = baseAmount(lamports, SOL_DECIMAL)
    const fromAddress: TxFrom = { from: source, amount }
    const toAddress: TxTo = { to: destination, amount }

    const tx /* : Tx */ = {
      asset: AssetSOL,
      from: [fromAddress],
      to: [toAddress],
      date: new Date(res.blockTime * 1000),
      type: 'transfer',
      hash: res.transaction.signatures[0],
      original: res,
    }

    return tx as Tx
  }

  /**
   * Transfer SOL.
   *
   * @param {TxParams} params The transfer options.
   *
   * @returns {TxHash} The transaction hash.
   *
   * @throws {"Unsupported asset"}
   * Thrown for any asset but {AssetSOL}.
   * @throws {"Invalid recipient address"}
   * Thrown if the given recipient is invalid.
   * @throws {"Phrase must be provided"}
   * Thrown if sender not initialized by phrase.
   */
  public async transfer({ asset, memo, amount, recipient }: TxParams): Promise<TxHash> {
    if (asset && asset.symbol != AssetSOL.symbol) {
      throw new Error('Unsupported asset')
    }
    if (memo) {
      throw new Error('Memo not implemented')
    }

    // throws "Phrase must be provided"
    const fromPubkey = new web3.PublicKey(this.getAddress())

    if (!this.validateAddress(recipient)) {
      throw new Error('Invalid recipient address')
    }
    const toPubkey = new web3.PublicKey(recipient)

    const lamports = new BN(amount.amount().toString()).toNumber()

    const params: web3.TransferParams = { fromPubkey, toPubkey, lamports }
    const TransactionInstruction = web3.SystemProgram.transfer(params)
    const transaction = new web3.Transaction().add(TransactionInstruction)

    const account = new web3.Account(this.keypair?.secretKey)
    const web3Client = new web3.Connection(web3.clusterApiUrl(this.getApiCluster()))
    const signature = await web3.sendAndConfirmTransaction(web3Client, transaction, [account])

    return signature
  }

  /**
   * Get fees.
   *
   * @param {FeesParams} params
   * @returns {Fees} The average/fast/fastest fees.
   *
   * @throws {"Failed to get fees"} Thrown if failed to get fees.
   */
  public async getFees(): Promise<Fees> {
    try {
      const res = await this.api.getFees()

      const { lamportsPerSignature } = res.feeCalculator
      const fee = baseAmount(lamportsPerSignature, SOL_DECIMAL)

      const fees: Fees = {
        type: 'base',
        average: fee,
        fast: fee,
        fastest: fee,
      }

      return fees
    } catch (error) {
      throw new Error('Failed to get fees')
    }
  }
}

export { Client }
