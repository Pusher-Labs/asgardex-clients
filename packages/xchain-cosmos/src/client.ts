import {
  Address,
  Balance,
  Client as BaseClient,
  ClientParams as BaseClientParams,
  FeeType,
  Fees,
  MultiAssetClient,
  Network,
  Tx,
  TxHash,
  TxHistoryParams,
  TxParams,
  TxsPage,
} from '@xchainjs/xchain-client'
import { Asset, Chain, assetToString, baseAmount } from '@xchainjs/xchain-util'

import { CosmosSDKClient } from './cosmos'
import { AssetAtom, AssetMuon } from './types'
import { DECIMAL, getAsset, getDenom, parseTxResponse, registerCodecs } from './util'
import { Wallet } from './wallet'

export interface ClientParams extends BaseClientParams {
  mainAsset: Asset
  sdkServer: string
  sdkChainId: string
}

export const MAINNET_PARAMS: ClientParams = {
  chain: Chain.Cosmos,
  network: Network.Mainnet,
  getFullDerivationPath: (index: number) => `44'/118'/0'/0/${index}`,
  bech32Prefix: 'cosmos',
  explorer: {
    url: 'https://cosmos.bigdipper.live',
    getAddressUrl(address: string) {
      return `${this.url}/account/${address}`
    },
    getTxUrl(txid: string) {
      return `${this.url}/transactions/${txid}`
    },
  },
  mainAsset: AssetAtom,
  sdkServer: 'https://api.cosmos.network',
  sdkChainId: 'cosmoshub-3',
}

export const TESTNET_PARAMS: ClientParams = {
  ...MAINNET_PARAMS,
  network: Network.Testnet,
  getFullDerivationPath: (index: number) => `44'/118'/1'/0/${index}`,
  explorer: {
    ...MAINNET_PARAMS.explorer,
    url: 'https://gaia.bigdipper.live',
  },
  mainAsset: AssetMuon,
  sdkServer: 'http://lcd.gaia.bigdipper.live:1317',
  sdkChainId: 'gaia-3a',
}

export class Client extends BaseClient<ClientParams, Wallet> implements MultiAssetClient {
  protected readonly sdkClient: CosmosSDKClient

  protected constructor(params: ClientParams) {
    super(params)
    this.sdkClient = new CosmosSDKClient({
      server: this.params.sdkServer,
      chainId: this.params.sdkChainId,
    })
  }

  protected async init() {
    await registerCodecs()
  }

  static readonly create = Client.bindFactory((x: ClientParams) => new Client(x))

  async validateAddress(address: Address): Promise<boolean> {
    return super.validateAddress(address) && this.sdkClient.checkAddress(address)
  }

  async getBalance(address: Address, assets?: Asset[]): Promise<Balance[]> {
    const balances = await this.sdkClient.getBalance(address)

    return balances
      .map((balance) => {
        return {
          asset: (balance.denom && getAsset(balance.denom)) || this.params.mainAsset,
          amount: baseAmount(balance.amount, DECIMAL),
        }
      })
      .filter(
        (balance) => !assets || assets.filter((asset) => assetToString(balance.asset) === assetToString(asset)).length,
      )
  }

  async getTransactions(params: TxHistoryParams): Promise<TxsPage> {
    const messageAction = undefined
    const page = (params && params.offset) || undefined
    const limit = (params && params.limit) || undefined
    const txMinHeight = undefined
    const txMaxHeight = undefined

    const txHistory = await this.sdkClient.searchTx({
      messageAction,
      messageSender: params.address,
      page,
      limit,
      txMinHeight,
      txMaxHeight,
    })

    return {
      total: parseInt(txHistory.total_count?.toString() || '0'),
      txs: (txHistory.txs ?? []).map((x) => parseTxResponse(x, this.params.mainAsset)),
    }
  }

  async getTransactionData(txId: string): Promise<Tx> {
    const txResult = await this.sdkClient.txsHashGet(txId)
    return parseTxResponse(txResult, this.params.mainAsset)
  }

  async transfer(params: TxParams): Promise<TxHash> {
    if (this.wallet === null) throw new Error('client must be unlocked')
    const index = params.walletIndex ?? 0
    if (!(Number.isSafeInteger(index) && index >= 0)) throw new Error('index must be a non-negative integer')

    const privateKey = await this.wallet.getPrivateKey(index)

    const txResult = await this.sdkClient.transfer({
      privkey: privateKey,
      from: this.sdkClient.getAddressFromPrivKey(privateKey),
      to: params.recipient,
      amount: params.amount.amount().toString(),
      asset: getDenom(params.asset ?? this.params.mainAsset),
      memo: params.memo,
    })
    const out = txResult?.txhash

    if (out === undefined) throw new Error(`unable to complete transaction, result: ${txResult}`)
    return out
  }

  async getFees(): Promise<Fees> {
    // there is no fixed fee, we set fee amount when creating a transaction.
    return {
      type: FeeType.FlatFee,
      fast: baseAmount(750, DECIMAL),
      fastest: baseAmount(2500, DECIMAL),
      average: baseAmount(0, DECIMAL),
    }
  }
}
