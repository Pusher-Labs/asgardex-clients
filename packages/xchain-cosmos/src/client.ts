import {
  RootDerivationPaths,
  Address,
  Balances,
  Fees,
  Network,
  Tx,
  TxParams,
  TxHash,
  TxHistoryParams,
  TxsPage,
  XChainClient,
  XChainClientParams,
  Network as XChainNetwork,
} from '@xchainjs/xchain-client'
import { Asset, baseAmount, assetToString } from '@xchainjs/xchain-util'
import * as xchainCrypto from '@xchainjs/xchain-crypto'

import { PrivKey, codec } from 'cosmos-client'
import { MsgSend, MsgMultiSend } from 'cosmos-client/x/bank'

import { CosmosSDKClient } from './cosmos/sdk-client'
import { AssetAtom, AssetMuon } from './types'
import { DECIMAL, getDenom, getAsset, getTxsFromHistory } from './util'

/**
 * Interface for custom Cosmos client
 */
export interface CosmosClient {
  getMainAsset(): Asset
}

const MAINNET_SDK = new CosmosSDKClient({
  server: 'https://api.cosmos.network',
  chainId: 'cosmoshub-3',
})
const TESTNET_SDK = new CosmosSDKClient({
  server: 'http://lcd.gaia.bigdipper.live:1317',
  chainId: 'gaia-3a',
})

/**
 * Custom Cosmos client
 */
class Client implements CosmosClient, XChainClient {
  private network: Network
  private phrase = ''
  private rootDerivationPaths: RootDerivationPaths

  private sdkClients: Map<XChainNetwork, CosmosSDKClient> = new Map<XChainNetwork, CosmosSDKClient>()

  /**
   * Constructor
   *
   * Client has to be initialised with network type and phrase.
   * It will throw an error if an invalid phrase has been passed.
   *
   * @param {XChainClientParams} params
   *
   * @throws {"Invalid phrase"} Thrown if the given phase is invalid.
   */
  constructor({
    network = 'testnet',
    phrase,
    rootDerivationPaths = {
      mainnet: `44'/118'/0'/0/`,
      testnet: `44'/118'/1'/0/`,
    },
  }: XChainClientParams) {
    this.network = network
    this.rootDerivationPaths = rootDerivationPaths
    this.sdkClients.set('testnet', TESTNET_SDK)
    this.sdkClients.set('mainnet', MAINNET_SDK)

    if (phrase) this.setPhrase(phrase)
  }

  /**
   * Purge client.
   *
   * @returns {void}
   */
  purgeClient(): void {
    this.phrase = ''
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
  setNetwork = (network: Network): void => {
    if (!network) {
      throw new Error('Network must be provided')
    } else {
      this.network = network
    }
  }

  /**
   * Get the current network.
   *
   * @returns {Network} The current network. (`mainnet` or `testnet`)
   */
  getNetwork(): Network {
    return this.network
  }

  /**
   * @private
   * Register message codecs.
   *
   * @returns {void}
   */
  private registerCodecs = (): void => {
    codec.registerCodec('cosmos-sdk/MsgSend', MsgSend, MsgSend.fromJSON)
    codec.registerCodec('cosmos-sdk/MsgMultiSend', MsgMultiSend, MsgMultiSend.fromJSON)
  }

  /**
   * Get the explorer url.
   *
   * @returns {string} The explorer url.
   */
  getExplorerUrl = (): string => {
    return this.network === 'testnet' ? 'https://gaia.bigdipper.live' : 'https://cosmos.bigdipper.live'
  }

  /**
   * Get the explorer url for the given address.
   *
   * @param {Address} address
   * @returns {string} The explorer url for the given address.
   */
  getExplorerAddressUrl = (address: Address): string => {
    return `${this.getExplorerUrl()}/account/${address}`
  }

  /**
   * Get the explorer url for the given transaction id.
   *
   * @param {string} txID
   * @returns {string} The explorer url for the given transaction id.
   */
  getExplorerTxUrl = (txID: string): string => {
    return `${this.getExplorerUrl()}/transactions/${txID}`
  }

  /**
   * Set/update a new phrase
   *
   * @param {string} phrase A new phrase.
   * @returns {Address} The address from the given phrase
   *
   * @throws {"Invalid phrase"}
   * Thrown if the given phase is invalid.
   */
  setPhrase = (phrase: string, walletIndex = 0): Address => {
    if (this.phrase !== phrase) {
      if (!xchainCrypto.validatePhrase(phrase)) {
        throw new Error('Invalid phrase')
      }

      this.phrase = phrase
    }

    return this.getAddress(walletIndex)
  }

  /**
   * @private
   * Get private key.
   *
   * @returns {PrivKey} The private key generated from the given phrase
   *
   * @throws {"Phrase not set"}
   * Throws an error if phrase has not been set before
   * */
  private getPrivateKey = (index = 0): PrivKey => {
    if (!this.phrase) throw new Error('Phrase not set')

    return this.getSDKClient().getPrivKeyFromMnemonic(this.phrase, this.getFullDerivationPath(index))
  }
  getSDKClient = (): CosmosSDKClient => {
    return this.sdkClients.get(this.network) || TESTNET_SDK
  }

  /**
   * Get getFullDerivationPath
   *
   * @param {number} index the HD wallet index
   * @returns {string} The bitcoin derivation path based on the network.
   */
  getFullDerivationPath(index: number): string {
    return this.rootDerivationPaths[this.network] + `${index}`
  }

  /**
   * Get the current address.
   *
   * @returns {Address} The current address.
   *
   * @throws {Error} Thrown if phrase has not been set before. A phrase is needed to create a wallet and to derive an address from it.
   */
  getAddress = (index = 0): string => {
    if (!this.phrase) throw new Error('Phrase not set')

    return this.getSDKClient().getAddressFromMnemonic(this.phrase, this.getFullDerivationPath(index))
  }

  /**
   * Validate the given address.
   *
   * @param {Address} address
   * @returns {boolean} `true` or `false`
   */
  validateAddress = (address: Address): boolean => {
    return this.getSDKClient().checkAddress(address)
  }

  /**
   * Get the main asset based on the network.
   *
   * @returns {string} The main asset based on the network.
   */
  getMainAsset = (): Asset => {
    return this.network === 'testnet' ? AssetMuon : AssetAtom
  }

  /**
   * Get the balance of a given address.
   *
   * @param {Address} address By default, it will return the balance of the current wallet. (optional)
   * @param {Asset} asset If not set, it will return all assets available. (optional)
   * @returns {Array<Balance>} The balance of the address.
   */
  getBalance = async (address: Address, assets?: Asset[]): Promise<Balances> => {
    try {
      const balances = await this.getSDKClient().getBalance(address)
      const mainAsset = this.getMainAsset()

      let assetBalances = balances.map((balance) => {
        return {
          asset: (balance.denom && getAsset(balance.denom)) || mainAsset,
          amount: baseAmount(balance.amount, DECIMAL),
        }
      })

      // make sure we always have the main asset as balance in the array
      if (assetBalances.length === 0) {
        assetBalances = [
          {
            asset: mainAsset,
            amount: baseAmount(0, DECIMAL),
          },
        ]
      }

      return assetBalances.filter(
        (balance) => !assets || assets.filter((asset) => assetToString(balance.asset) === assetToString(asset)).length,
      )
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * Get transaction history of a given address with pagination options.
   * By default it will return the transaction history of the current wallet.
   *
   * @param {TxHistoryParams} params The options to get transaction history. (optional)
   * @returns {TxsPage} The transaction history.
   */
  getTransactions = async (params?: TxHistoryParams): Promise<TxsPage> => {
    const messageAction = undefined
    const page = (params && params.offset) || undefined
    const limit = (params && params.limit) || undefined
    const txMinHeight = undefined
    const txMaxHeight = undefined

    try {
      this.registerCodecs()

      const mainAsset = this.getMainAsset()
      const txHistory = await this.getSDKClient().searchTx({
        messageAction,
        messageSender: (params && params.address) || this.getAddress(),
        page,
        limit,
        txMinHeight,
        txMaxHeight,
      })

      return {
        total: parseInt(txHistory.total_count?.toString() || '0'),
        txs: getTxsFromHistory(txHistory.txs || [], mainAsset),
      }
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * Get the transaction details of a given transaction id.
   *
   * @param {string} txId The transaction id.
   * @returns {Tx} The transaction details of the given transaction id.
   */
  getTransactionData = async (txId: string): Promise<Tx> => {
    try {
      const txResult = await this.getSDKClient().txsHashGet(txId)
      const txs = getTxsFromHistory([txResult], this.getMainAsset())

      if (txs.length === 0) {
        throw new Error('transaction not found')
      }

      return txs[0]
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * Transfer balances.
   *
   * @param {TxParams} params The transfer options.
   * @returns {TxHash} The transaction hash.
   */
  transfer = async ({ walletIndex, asset, amount, recipient, memo }: TxParams): Promise<TxHash> => {
    try {
      const fromAddressIndex = walletIndex || 0
      this.registerCodecs()

      const mainAsset = this.getMainAsset()
      const transferResult = await this.getSDKClient().transfer({
        privkey: this.getPrivateKey(fromAddressIndex),
        from: this.getAddress(fromAddressIndex),
        to: recipient,
        amount: amount.amount().toString(),
        asset: getDenom(asset || mainAsset),
        memo,
      })

      return transferResult?.txhash || ''
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * Get the current fee.
   *
   * @returns {Fees} The current fee.
   */
  getFees = async (): Promise<Fees> => {
    // there is no fixed fee, we set fee amount when creating a transaction.
    return Promise.resolve({
      type: 'base',
      fast: baseAmount(750, DECIMAL),
      fastest: baseAmount(2500, DECIMAL),
      average: baseAmount(0, DECIMAL),
    })
  }
}

export { Client }
