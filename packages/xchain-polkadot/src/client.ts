import { ApiPromise, Keyring, WsProvider } from '@polkadot/api'
import { hexToU8a, isHex } from '@polkadot/util'
import {
  Address,
  Balance,
  Client as BaseClient,
  ClientParams as BaseClientParams,
  FeeType,
  Fees,
  Network,
  Tx,
  TxHash,
  TxHistoryParams,
  TxParams,
  TxType,
  TxsPage,
  singleFee,
} from '@xchainjs/xchain-client'
import { Asset, Chain, assetAmount, assetToBase, assetToString, baseAmount } from '@xchainjs/xchain-util'
import axios from 'axios'

import { Account, AssetDOT, Extrinsic, SubscanResponse, Transfer, TransfersResult } from './types'
import { getDecimal, isSuccess } from './util'
import { Wallet } from './wallet'

export interface ClientParams extends BaseClientParams {
  clientUrl: string
  wsEndpoint: string
  ss58Format: number
}

export const MAINNET_PARAMS: ClientParams = {
  chain: Chain.Polkadot,
  network: Network.Mainnet,
  getFullDerivationPath: (index: number) => `44//354//0//0//0'${index === 0 ? '' : `//${index}`}`, //TODO IS the root path we want to use?
  extraPrefixes: ['1'],
  explorer: {
    url: 'https://polkadot.subscan.io',
    getAddressUrl(address: string) {
      return `${this.url}/account/${address}`
    },
    getTxUrl(txid: string) {
      return `${this.url}/extrinsic/${txid}`
    },
  },
  clientUrl: 'https://polkadot.subscan.io',
  wsEndpoint: 'wss://rpc.polkadot.io',
  ss58Format: 0,
}

export const TESTNET_PARAMS: ClientParams = {
  ...MAINNET_PARAMS,
  network: Network.Testnet,
  extraPrefixes: ['5'],
  explorer: {
    ...MAINNET_PARAMS.explorer,
    url: 'https://westend.subscan.io',
  },
  clientUrl: 'https://westend.subscan.io',
  wsEndpoint: 'wss://westend-rpc.polkadot.io',
  ss58Format: 42,
}

export class Client extends BaseClient<ClientParams, Wallet> {
  static readonly create = Client.bindFactory((x: ClientParams) => new Client(x))

  getClientUrl(): string {
    return this.params.clientUrl
  }
  getWsEndpoint(): string {
    return this.params.wsEndpoint
  }
  getSS58Format(): number {
    return this.params.ss58Format
  }

  /**
   * @private
   * Private function to get the polkadotjs API provider.
   *
   * @see https://polkadot.js.org/docs/api/start/create#api-instance
   *
   * @returns {ApiPromise} The polkadotjs API provider based on the network.
   * */
  private async getAPI(): Promise<ApiPromise> {
    const api = new ApiPromise({ provider: new WsProvider(this.getWsEndpoint()) })
    await api.isReady
    if (!api.isConnected) await api.connect()
    return api
  }

  async validateAddress(address: string): Promise<boolean> {
    if (!super.validateAddress(address)) return false
    try {
      const key = new Keyring({ ss58Format: this.params.ss58Format, type: 'ed25519' })
      return key.encodeAddress(isHex(address) ? hexToU8a(address) : key.decodeAddress(address)) === address
    } catch (error) {
      return false
    }
  }

  async getBalance(address: Address, assets?: Asset[]): Promise<Balance[]> {
    const response: SubscanResponse<Account> = (
      await axios.post(`${this.getClientUrl()}/api/open/account`, { address: address || this.getAddress() })
    ).data

    if (!isSuccess(response)) throw new Error('Invalid address')

    const account = response.data

    return account && (!assets || assets.filter((asset) => assetToString(AssetDOT) === assetToString(asset)).length)
      ? [
          {
            asset: AssetDOT,
            amount: assetToBase(assetAmount(account.balance, getDecimal(this.params.network))),
          },
        ]
      : []
  }

  async getTransactions(params: TxHistoryParams): Promise<TxsPage> {
    const limit = params.limit ?? 10
    const offset = params.offset ?? 0

    const response: SubscanResponse<TransfersResult> = (
      await axios.post(`${this.getClientUrl()}/api/scan/transfers`, {
        address: params?.address,
        row: limit,
        page: offset,
      })
    ).data
    if (!isSuccess(response) || !response.data) throw new Error('Failed to get transactions')

    const transferResult: TransfersResult = response.data

    return {
      total: transferResult.count,
      txs: (transferResult.transfers || []).map((transfer) => ({
        asset: AssetDOT,
        from: [
          {
            from: transfer.from,
            amount: assetToBase(assetAmount(transfer.amount, getDecimal(this.params.network))),
          },
        ],
        to: [
          {
            to: transfer.to,
            amount: assetToBase(assetAmount(transfer.amount, getDecimal(this.params.network))),
          },
        ],
        date: new Date(transfer.block_timestamp * 1000),
        type: TxType.Transfer,
        hash: transfer.hash,
      })),
    }
  }

  async getTransactionData(txId: string): Promise<Tx> {
    const response: SubscanResponse<Extrinsic> = (
      await axios.post(`${this.getClientUrl()}/api/scan/extrinsic`, { hash: txId })
    ).data
    if (!isSuccess(response) || !response.data) throw new Error('Failed to get transactions')

    const extrinsic: Extrinsic = response.data
    const transfer: Transfer = extrinsic.transfer

    return {
      asset: AssetDOT,
      from: [
        {
          from: transfer.from,
          amount: assetToBase(assetAmount(transfer.amount, getDecimal(this.params.network))),
        },
      ],
      to: [
        {
          to: transfer.to,
          amount: assetToBase(assetAmount(transfer.amount, getDecimal(this.params.network))),
        },
      ],
      date: new Date(extrinsic.block_timestamp * 1000),
      type: TxType.Transfer,
      hash: extrinsic.extrinsic_hash,
    }
  }

  async transfer(params: TxParams): Promise<TxHash> {
    if (this.wallet === null) throw new Error('client must be unlocked')
    const index = params.walletIndex ?? 0
    if (!(Number.isSafeInteger(index) && index >= 0)) throw new Error('index must be a non-negative integer')

    const keyringPair = await this.wallet.getKeyringPair(index)
    const address = await this.getAddress(index)

    const api = await this.getAPI()
    let transaction = null
    // Createing a transfer
    const transfer = api.tx.balances.transfer(params.recipient, params.amount.amount().toString())
    if (!params.memo) {
      // Send a simple transfer
      transaction = transfer
    } else {
      // Send a `utility.batch` with two Calls: i) Balance.Transfer ii) System.Remark

      // Creating a remark
      const remark = api.tx.system.remark(params.memo)

      // Send the Batch Transaction
      transaction = api.tx.utility.batch([transfer, remark])
    }

    // Check balances
    const paymentInfo = await transaction.paymentInfo(address)
    const fee = baseAmount(paymentInfo.partialFee.toString(), getDecimal(this.params.network))
    const balances = await this.getBalance(address, [AssetDOT])

    if (!balances || params.amount.amount().plus(fee.amount()).isGreaterThan(balances[0].amount.amount())) {
      throw new Error('insufficient balance')
    }

    const txHash = await transaction.signAndSend(keyringPair)
    await api.disconnect()

    return txHash.toString()
  }

  async estimateFees(params: TxParams): Promise<Fees> {
    if (this.wallet === null) throw new Error('client must be unlocked')
    const index = params.walletIndex ?? 0
    if (!(Number.isSafeInteger(index) && index >= 0)) throw new Error('index must be a non-negative integer')

    const api = await this.getAPI()
    const info = await api.tx.balances
      .transfer(params.recipient, params.amount.amount().toNumber())
      .paymentInfo(await this.getAddress(index))

    const fee = baseAmount(info.partialFee.toString(), getDecimal(this.params.network))
    await api.disconnect()

    return singleFee(FeeType.PerByte, fee)
  }

  async getFees(index?: number): Promise<Fees> {
    return await this.estimateFees({
      walletIndex: index,
      recipient: await this.getAddress(index),
      amount: baseAmount(0, getDecimal(this.params.network)),
    })
  }
}
