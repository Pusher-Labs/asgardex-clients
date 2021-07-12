import {
  Address,
  Balance,
  Client as BaseClient,
  ClientFactory,
  ClientParams as BaseClientParams,
  FeeOption,
  FeeType,
  Fees,
  MultiAssetClient,
  Network,
  Tx,
  TxFrom,
  TxHash,
  TxHistoryParams,
  TxParams,
  TxTo,
  TxType,
  TxsPage,
  singleFee,
} from '@xchainjs/xchain-client'
import { CosmosSDKClient, RPCTxResult, parseTxResponse } from '@xchainjs/xchain-cosmos'
import { Asset, Chain, assetFromString, assetToString, baseAmount } from '@xchainjs/xchain-util'
import axios from 'axios'
import { AccAddress } from 'cosmos-client'
import { StdTx } from 'cosmos-client/x/auth'

import { AssetRune, DepositParam, TxData } from './types'
import { MsgNativeTx, ThorchainDepositResponse, TxResult, msgNativeTxFromJson } from './types/messages'
import {
  DECIMAL,
  DEFAULT_GAS_VALUE,
  MAX_TX_COUNT,
  getAsset,
  getDenom,
  getDenomWithChain,
  getDepositTxDataFromLogs,
  isBroadcastSuccess,
  registerCodecs,
} from './util'
import { Wallet } from './wallet'

export interface ClientParams extends BaseClientParams {
  chainId: string
  bech32Prefix: string
  nodeUrl: string
  rpcUrl: string
}

export const MAINNET_PARAMS: ClientParams = {
  chain: Chain.THORChain,
  network: Network.Mainnet,
  getFullDerivationPath: (index: number) => `44'/931'/0'/0/${index}`,
  bech32Prefix: 'thor',
  explorer: {
    url: 'https://viewblock.io/thorchain',
    getAddressUrl(address: string) {
      return `https://viewblock.io/thorchain/address/${address}`
    },
    getTxUrl(txid: string) {
      return `https://viewblock.io/thorchain/tx/${txid}`
    },
  },
  chainId: 'thorchain',
  nodeUrl: 'https://thornode.thorchain.info',
  rpcUrl: 'https://rpc.thorchain.info',
}

export const TESTNET_PARAMS: ClientParams = {
  ...MAINNET_PARAMS,
  network: Network.Testnet,
  bech32Prefix: 'tthor',
  explorer: {
    url: 'https://viewblock.io/thorchain?network=testnet',
    getAddressUrl(address: string) {
      return `https://viewblock.io/thorchain/address/${address}?network=testnet`
    },
    getTxUrl(txid: string) {
      return `https://viewblock.io/thorchain/tx/${txid}?network=testnet`
    },
  },
  nodeUrl: 'https://testnet.thornode.thorchain.info',
  rpcUrl: 'https://testnet.rpc.thorchain.info',
}

export class Client extends BaseClient<ClientParams, Wallet> implements MultiAssetClient {
  protected readonly cosmosClient: CosmosSDKClient

  constructor(params: ClientParams) {
    super(params)
    this.cosmosClient = new CosmosSDKClient({
      server: this.params.nodeUrl,
      chainId: this.params.chainId,
      prefix: this.params.bech32Prefix,
    })
    registerCodecs(this.params.bech32Prefix)
  }

  static readonly create: ClientFactory<Client> = Client.bindFactory((x: ClientParams) => new Client(x))

  /**
   * @deprecated
   */
  getClientUrl(): { node: string; rpc: string } {
    return {
      node: this.params.nodeUrl,
      rpc: this.params.rpcUrl,
    }
  }

  getCosmosClient(): CosmosSDKClient {
    return this.cosmosClient
  }

  getChainId() {
    return this.params.chainId
  }

  async validateAddress(address: Address): Promise<boolean> {
    return super.validateAddress(address) && this.cosmosClient.checkAddress(address)
  }

  async getBalance(address: Address, assets?: Asset[]): Promise<Balance[]> {
    const balances = await this.cosmosClient.getBalance(address)
    return balances
      .map((balance) => ({
        asset: (balance.denom && getAsset(balance.denom)) || AssetRune,
        amount: baseAmount(balance.amount, DECIMAL),
      }))
      .filter(
        (balance) => !assets || assets.filter((asset) => assetToString(balance.asset) === assetToString(asset)).length,
      )
  }

  async getTransactions(params: TxHistoryParams & { filterFn?: (tx: RPCTxResult) => boolean }): Promise<TxsPage> {
    const messageAction = undefined
    const offset = params?.offset ?? 0
    const limit = params?.limit ?? 10
    const address = params?.address ?? this.getAddress()
    const txMinHeight = undefined
    const txMaxHeight = undefined

    const txIncomingHistory = (
      await this.cosmosClient.searchTxFromRPC({
        rpcEndpoint: this.params.rpcUrl,
        messageAction,
        transferRecipient: address,
        limit: MAX_TX_COUNT,
        txMinHeight,
        txMaxHeight,
      })
    ).txs
    const txOutgoingHistory = (
      await this.cosmosClient.searchTxFromRPC({
        rpcEndpoint: this.params.rpcUrl,
        messageAction,
        transferSender: address,
        limit: MAX_TX_COUNT,
        txMinHeight,
        txMaxHeight,
      })
    ).txs

    const history: RPCTxResult[] = [...txIncomingHistory, ...txOutgoingHistory]
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

    const historyPage = history.filter((_, index) => index >= offset && index < offset + limit)

    const txs = await Promise.all(historyPage.map(({ hash }) => this.getTransactionData(hash)))

    return {
      total: history.length,
      txs,
    }
  }

  async getTransactionData(txId: string): Promise<Tx> {
    const txResult = await this.cosmosClient.txsHashGet(txId)
    const tx = parseTxResponse(txResult, AssetRune)
    const address =
      tx.from[0]?.from ??
      (() => {
        for (const msg of tx.msgs) {
          if (msg.type === 'thorchain/MsgDeposit') {
            return (msg.value as { signer: string }).signer
          }
        }
        return undefined
      })()
    if (!txResult.logs || !address) throw new Error(`Failed to get transaction data (tx-hash: ${txId})`)
    const txData: TxData = getDepositTxDataFromLogs(txResult.logs, address)

    return {
      hash: txId,
      asset: AssetRune,
      from: txData.from,
      to: txData.to,
      date: new Date(txResult.timestamp),
      type: txData.type,
    }
  }

  async getFees(): Promise<Fees> {
    return singleFee(FeeType.FlatFee, baseAmount(DEFAULT_GAS_VALUE, DECIMAL))
  }

  /**
   * Get the transaction details of a given transaction id. (from /thorchain/txs/hash)
   *
   * Node: /thorchain/txs/hash response doesn't have timestamp field.
   *
   * @param {string} txId The transaction id.
   * @returns {Tx} The transaction details of the given transaction id.
   */
  async getDepositTransaction(txId: string): Promise<Omit<Tx, 'date'>> {
    const result: TxResult = (await axios.get(`${this.getClientUrl().node}/thorchain/tx/${txId}`)).data

    if (!result || !result.observed_tx) throw new Error('transaction not found')

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
      type: TxType.Transfer,
      hash: txId,
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
  private async buildDepositTx(msgNativeTx: MsgNativeTx): Promise<StdTx> {
    const response: ThorchainDepositResponse = (
      await axios.post(`${this.getClientUrl().node}/thorchain/deposit`, {
        coins: msgNativeTx.coins,
        memo: msgNativeTx.memo,
        base_req: {
          chain_id: 'thorchain',
          from: msgNativeTx.signer,
        },
      })
    ).data

    if (!response || !response.value) throw new Error('Invalid client url')

    const unsignedStdTx = StdTx.fromJSON({
      msg: response.value.msg,
      fee: response.value.fee,
      signatures: [],
      memo: '',
    })

    return unsignedStdTx
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
  async deposit({ walletIndex: index, asset = AssetRune, amount, memo }: DepositParam): Promise<TxHash> {
    if (this.wallet === null) throw new Error('client must be unlocked')
    index ??= 0
    if (!(Number.isSafeInteger(index) && index >= 0)) throw new Error('index must be a non-negative integer')

    const privateKey = await this.wallet.getPrivateKey(index)
    const address = await this.getAddress(index)
    const assetBalance = await this.getBalance(address, [asset])

    if (assetBalance.length === 0 || assetBalance[0].amount.amount().lt(amount.amount().plus(DEFAULT_GAS_VALUE))) {
      throw new Error('insufficient funds')
    }

    const msgNativeTx = msgNativeTxFromJson({
      coins: [
        {
          asset: getDenomWithChain(asset),
          amount: amount.amount().toString(),
        },
      ],
      memo,
      signer: address,
    })

    const unsignedStdTx = await this.buildDepositTx(msgNativeTx)
    const accAddress = AccAddress.fromBech32(address)
    const fee = unsignedStdTx.fee
    // max. gas
    fee.gas = '20000000'

    return this.cosmosClient
      .signAndBroadcast(unsignedStdTx, privateKey, accAddress)
      .then((result) => result?.txhash ?? '')
  }

  /**
   * Transfer balances with MsgSend
   *
   * @param {TxParams} params The transfer options.
   * @returns {TxHash} The transaction hash.
   */
  async transfer({ walletIndex: index, asset = AssetRune, amount, recipient, memo }: TxParams): Promise<TxHash> {
    if (this.wallet === null) throw new Error('client must be unlocked')
    index ??= 0
    if (!(Number.isSafeInteger(index) && index >= 0)) throw new Error('index must be a non-negative integer')

    const privateKey = await this.wallet.getPrivateKey(index)
    const address = await this.getAddress(index)

    const assetBalance = await this.getBalance(address, [asset])
    const fee = await this.getFees()
    if (
      assetBalance.length === 0 ||
      assetBalance[0].amount.amount().lt(amount.amount().plus(fee[FeeOption.Average].amount()))
    ) {
      throw new Error('insufficient funds')
    }

    const transferResult = await this.cosmosClient.transfer({
      privkey: privateKey,
      from: address,
      to: recipient,
      amount: amount.amount().toString(),
      asset: getDenom(asset),
      memo,
      fee: {
        amount: [],
        gas: DEFAULT_GAS_VALUE,
      },
    })

    if (!isBroadcastSuccess(transferResult as { logs?: unknown }))
      throw new Error(`failed to broadcast transaction: ${transferResult.txhash}`)

    return transferResult?.txhash ?? ''
  }
}
