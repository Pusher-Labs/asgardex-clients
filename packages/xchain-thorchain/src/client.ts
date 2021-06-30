import axios from 'axios'
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
  TxFrom,
  TxTo,
} from '@xchainjs/xchain-client'
import { CosmosSDKClient, RPCTxResult } from '@xchainjs/xchain-cosmos'
import { Asset, baseAmount, assetToString, assetFromString } from '@xchainjs/xchain-util'
import * as xchainCrypto from '@xchainjs/xchain-crypto'

import { PrivKey, AccAddress } from 'cosmos-client'
import { StdTx } from 'cosmos-client/x/auth'

import { AssetRune, DepositParam, ClientUrl, ThorchainClientParams, NodeUrl, ExplorerUrls, TxData } from './types'
import { MsgNativeTx, msgNativeTxFromJson, ThorchainDepositResponse, TxResult } from './types/messages'
import {
  getDenom,
  getAsset,
  getDefaultFees,
  DECIMAL,
  DEFAULT_GAS_VALUE,
  getDenomWithChain,
  isBroadcastSuccess,
  getPrefix,
  registerCodecs,
  MAX_TX_COUNT,
  getDefaultClientUrl,
  getDefaultExplorerUrls,
  getExplorerAddressUrl,
  getExplorerTxUrl,
  getDepositTxDataFromLogs,
} from './util'

/**
 * Interface for custom Thorchain client
 */
export interface ThorchainClient {
  setClientUrl(clientUrl: ClientUrl): void
  getClientUrl(): NodeUrl
  setExplorerUrls(explorerUrls: ExplorerUrls): void
  getCosmosClient(): CosmosSDKClient

  deposit(params: DepositParam): Promise<TxHash>
}

/**
 * Custom Thorchain Client
 */
class Client implements ThorchainClient, XChainClient {
  private network: Network
  private clientUrl: ClientUrl
  private explorerUrls: ExplorerUrls
  private phrase = ''
  private rootDerivationPaths: RootDerivationPaths
  private cosmosClient: CosmosSDKClient

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
    clientUrl,
    explorerUrls,
    rootDerivationPaths = {
      mainnet: "44'/931'/0'/0/",
      testnet: "44'/931'/0'/0/",
    },
  }: XChainClientParams & ThorchainClientParams) {
    this.network = network
    this.clientUrl = clientUrl || getDefaultClientUrl()
    this.explorerUrls = explorerUrls || getDefaultExplorerUrls()
    this.rootDerivationPaths = rootDerivationPaths

    this.cosmosClient = new CosmosSDKClient({
      server: this.getClientUrl().node,
      chainId: this.getChainId(),
      prefix: getPrefix(this.network),
    })

    if (phrase) this.setPhrase(phrase)
  }

  /**
   * Purge client.
   *
   * @returns {void}
   */
  purgeClient = (): void => {
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
    }

    this.network = network
    this.cosmosClient.updatePrefix(getPrefix(this.network))
  }

  /**
   * Get the current network.
   *
   * @returns {Network} The current network. (`mainnet` or `testnet`)
   */
  getNetwork = (): Network => {
    return this.network
  }

  /**
   * Set/update the client URL.
   *
   * @param {ClientUrl} clientUrl The client url to be set.
   * @returns {void}
   */
  setClientUrl = (clientUrl: ClientUrl): void => {
    this.clientUrl = clientUrl
  }

  /**
   * Get the client url.
   *
   * @returns {NodeUrl} The client url for thorchain based on the current network.
   */
  getClientUrl = (): NodeUrl => this.clientUrl[this.network]

  /**
   * Set/update the explorer URLs.
   *
   * @param {ExplorerUrls} urls The explorer urls to be set.
   * @returns {void}
   */
  setExplorerUrls = (urls: ExplorerUrls): void => {
    this.explorerUrls = urls
  }

  /**
   * Get the explorer url.
   *
   * @returns {string} The explorer url for thorchain based on the current network.
   */
  getExplorerUrl = (): string => {
    return this.explorerUrls.root[this.network]
  }

  /**
   * Get cosmos client
   * @returns {CosmosSDKClient} current cosmos client
   */
  getCosmosClient = (): CosmosSDKClient => this.cosmosClient

  /**
   * Get the chain id.
   *
   * @returns {string} The chain id based on the network.
   */
  getChainId = (): string => {
    return 'thorchain'
  }

  /**
   * Get the explorer url for the given address.
   *
   * @param {Address} address
   * @returns {string} The explorer url for the given address.
   */
  getExplorerAddressUrl = (address: Address): string =>
    getExplorerAddressUrl({ urls: this.explorerUrls, network: this.network, address })

  /**
   * Get the explorer url for the given transaction id.
   *
   * @param {string} txID
   * @returns {string} The explorer url for the given transaction id.
   */
  getExplorerTxUrl = (txID: string): string =>
    getExplorerTxUrl({ urls: this.explorerUrls, network: this.network, txID })

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
   * Get getFullDerivationPath
   *
   * @param {number} index the HD wallet index
   * @returns {string} The bitcoin derivation path based on the network.
   */
  getFullDerivationPath(index: number): string {
    return this.rootDerivationPaths[this.network] + `${index}`
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
  private getPrivateKey = (index = 0): PrivKey =>
    this.cosmosClient.getPrivKeyFromMnemonic(this.phrase, this.getFullDerivationPath(index))

  /**
   * Get the current address.
   *
   * @returns {Address} The current address.
   *
   * @throws {Error} Thrown if phrase has not been set before. A phrase is needed to create a wallet and to derive an address from it.
   */
  getAddress = (index = 0): string => {
    const address = this.cosmosClient.getAddressFromMnemonic(this.phrase, this.getFullDerivationPath(index))
    if (!address) {
      throw new Error('address not defined')
    }

    return address
  }

  /**
   * Validate the given address.
   *
   * @param {Address} address
   * @returns {boolean} `true` or `false`
   */
  validateAddress = (address: Address): boolean => {
    return this.cosmosClient.checkAddress(address)
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
      const balances = await this.cosmosClient.getBalance(address)

      let assetBalances = balances.map((balance) => ({
        asset: (balance.denom && getAsset(balance.denom)) || AssetRune,
        amount: baseAmount(balance.amount, DECIMAL),
      }))

      if (assetBalances.length === 0) {
        assetBalances = [
          {
            asset: AssetRune,
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
  getTransactions = async (
    params?: TxHistoryParams & { filterFn?: (tx: RPCTxResult) => boolean },
  ): Promise<TxsPage> => {
    const messageAction = undefined
    const offset = params?.offset || 0
    const limit = params?.limit || 10
    const address = params?.address || this.getAddress()
    const txMinHeight = undefined
    const txMaxHeight = undefined

    try {
      registerCodecs(this.network)

      const txIncomingHistory = (
        await this.cosmosClient.searchTxFromRPC({
          rpcEndpoint: this.getClientUrl().rpc,
          messageAction,
          transferRecipient: address,
          limit: MAX_TX_COUNT,
          txMinHeight,
          txMaxHeight,
        })
      ).txs
      const txOutgoingHistory = (
        await this.cosmosClient.searchTxFromRPC({
          rpcEndpoint: this.getClientUrl().rpc,
          messageAction,
          transferSender: address,
          limit: MAX_TX_COUNT,
          txMinHeight,
          txMaxHeight,
        })
      ).txs

      let history: RPCTxResult[] = [...txIncomingHistory, ...txOutgoingHistory]
        .sort((a, b) => {
          if (a.height !== b.height) return parseInt(b.height) > parseInt(a.height) ? 1 : -1
          if (a.hash !== b.hash) return a.hash > b.hash ? 1 : -1
          return 0
        })
        .reduce(
          (acc, tx) => [...acc, ...(acc.length === 0 || acc[acc.length - 1].hash !== tx.hash ? [tx] : [])],
          [] as RPCTxResult[],
        )
        .filter(params?.filterFn ? params.filterFn : (tx) => tx)
        .filter((_, index) => index < MAX_TX_COUNT)

      // get `total` before filtering txs out for pagination
      const total = history.length

      history = history.filter((_, index) => index >= offset && index < offset + limit)

      const txs = await Promise.all(history.map(({ hash }) => this.getTransactionData(hash, address)))

      return {
        total,
        txs,
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
  getTransactionData = async (txId: string, address: Address): Promise<Tx> => {
    try {
      const txResult = await this.cosmosClient.txsHashGet(txId)
      const txData: TxData | null = txResult.logs ? getDepositTxDataFromLogs(txResult.logs, address) : null

      if (!txData) {
        throw new Error(`Failed to get transaction data (tx-hash: ${txId})`)
      }

      const { from, to, type } = txData

      return {
        hash: txId,
        asset: AssetRune,
        from,
        to,
        date: new Date(txResult.timestamp),
        type,
      }
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * Get the transaction details of a given transaction id. (from /thorchain/txs/hash)
   *
   * Node: /thorchain/txs/hash response doesn't have timestamp field.
   *
   * @param {string} txId The transaction id.
   * @returns {Tx} The transaction details of the given transaction id.
   */
  getDepositTransaction = async (txId: string): Promise<Omit<Tx, 'date'>> => {
    try {
      const result: TxResult = await axios
        .get(`${this.getClientUrl().node}/thorchain/tx/${txId}`)
        .then((response) => response.data)

      if (!result || !result.observed_tx) {
        throw new Error('transaction not found')
      }

      const from: TxFrom[] = []
      const to: TxTo[] = []
      let asset
      result.observed_tx.tx.coins.forEach((coin) => {
        from.push({
          from: result.observed_tx.tx.from_address,
          amount: baseAmount(coin.amount, DECIMAL),
        })
        to.push({
          to: result.observed_tx.tx.to_address,
          amount: baseAmount(coin.amount, DECIMAL),
        })
        asset = assetFromString(coin.asset)
      })

      return {
        asset: asset || AssetRune,
        from,
        to,
        type: 'transfer',
        hash: txId,
      }
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * Structure StdTx from MsgNativeTx.
   *
   * @param {string} txId The transaction id.
   * @returns {Tx} The transaction details of the given transaction id.
   *
   * @throws {"Invalid client url"} Thrown if the client url is an invalid one.
   */
  private buildDepositTx = async (msgNativeTx: MsgNativeTx): Promise<StdTx> => {
    try {
      const response: ThorchainDepositResponse = await axios
        .post(`${this.getClientUrl().node}/thorchain/deposit`, {
          coins: msgNativeTx.coins,
          memo: msgNativeTx.memo,
          base_req: {
            chain_id: 'thorchain',
            from: msgNativeTx.signer,
          },
        })
        .then((response) => response.data)

      if (!response || !response.value) {
        throw new Error('Invalid client url')
      }

      const unsignedStdTx = StdTx.fromJSON({
        msg: response.value.msg,
        fee: response.value.fee,
        signatures: [],
        memo: '',
      })

      return unsignedStdTx
    } catch (error) {
      return Promise.reject(new Error('Invalid client url'))
    }
  }

  /**
   * Transaction with MsgNativeTx.
   *
   * @param {DepositParam} params The transaction options.
   * @returns {TxHash} The transaction hash.
   *
   * @throws {"insufficient funds"} Thrown if the wallet has insufficient funds.
   * @throws {"failed to broadcast transaction"} Thrown if failed to broadcast transaction.
   */
  deposit = async ({ walletIndex = 0, asset = AssetRune, amount, memo }: DepositParam): Promise<TxHash> => {
    try {
      const assetBalance = await this.getBalance(this.getAddress(walletIndex), [asset])

      if (assetBalance.length === 0 || assetBalance[0].amount.amount().lt(amount.amount().plus(DEFAULT_GAS_VALUE))) {
        throw new Error('insufficient funds')
      }

      const signer = this.getAddress(walletIndex)
      const msgNativeTx = msgNativeTxFromJson({
        coins: [
          {
            asset: getDenomWithChain(asset),
            amount: amount.amount().toString(),
          },
        ],
        memo,
        signer,
      })

      const unsignedStdTx = await this.buildDepositTx(msgNativeTx)
      const privateKey = this.getPrivateKey(walletIndex)
      const accAddress = AccAddress.fromBech32(signer)
      const fee = unsignedStdTx.fee
      // max. gas
      fee.gas = '20000000'

      return this.cosmosClient
        .signAndBroadcast(unsignedStdTx, privateKey, accAddress)
        .then((result) => result?.txhash ?? '')
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * Transfer balances with MsgSend
   *
   * @param {TxParams} params The transfer options.
   * @returns {TxHash} The transaction hash.
   */
  transfer = async ({ walletIndex = 0, asset = AssetRune, amount, recipient, memo }: TxParams): Promise<TxHash> => {
    try {
      registerCodecs(this.network)

      const assetBalance = await this.getBalance(this.getAddress(walletIndex), [asset])
      const fee = await this.getFees()
      if (assetBalance.length === 0 || assetBalance[0].amount.amount().lt(amount.amount().plus(fee.average.amount()))) {
        throw new Error('insufficient funds')
      }

      const transferResult = await this.cosmosClient.transfer({
        privkey: this.getPrivateKey(walletIndex),
        from: this.getAddress(walletIndex),
        to: recipient,
        amount: amount.amount().toString(),
        asset: getDenom(asset),
        memo,
        fee: {
          amount: [],
          gas: DEFAULT_GAS_VALUE,
        },
      })

      if (!isBroadcastSuccess(transferResult)) {
        throw new Error(`failed to broadcast transaction: ${transferResult.txhash}`)
      }

      return transferResult?.txhash || ''
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * Get the fees.
   *
   * @returns {Fees}
   */
  getFees = async (): Promise<Fees> => {
    return Promise.resolve(getDefaultFees())
  }
}

export { Client }
