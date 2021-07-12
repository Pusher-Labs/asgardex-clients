import {
  Address,
  Balance,
  ClientFactory,
  Fee,
  FeeOption,
  FeeRate,
  Network,
  Tx,
  TxHash,
  TxHistoryParams,
  TxParams,
  TxType,
  TxsPage,
  UTXOClient,
  UTXOClientParams,
} from '@xchainjs/xchain-client'
import { AssetLTC, Chain, assetAmount, assetToBase } from '@xchainjs/xchain-util'

import * as sochain from './sochain-api'
import { NodeAuth } from './types'
import { TxIO } from './types/sochain-api-types'
import * as Utils from './utils'
import { Wallet } from './wallet'

export interface ClientParams extends UTXOClientParams {
  sochainUrl: string
  nodeUrl: string
  nodeAuth: NodeAuth
}

export const MAINNET_PARAMS: ClientParams = {
  chain: Chain.Litecoin,
  network: Network.Mainnet,
  getFullDerivationPath: (index: number) => `84'/2'/0'/0/${index}`,
  bech32Prefix: 'ltc',
  extraPrefixes: ['M', '3', 'L'],
  explorer: {
    url: 'https://ltc.bitaps.com',
    getAddressUrl(address: string) {
      return `${this.url}/${address}`
    },
    getTxUrl(txid: string) {
      return `${this.url}/${txid}`
    },
  },
  sochainUrl: 'https://sochain.com/api/v2',
  nodeUrl: 'https://ltc.thorchain.info',
  nodeAuth: {
    username: 'thorchain',
    password: 'password',
  },
  thornodeUrl: 'https://thornode.thorchain.info',
}

export const TESTNET_PARAMS: ClientParams = {
  ...MAINNET_PARAMS,
  network: Network.Testnet,
  getFullDerivationPath: (index: number) => `84'/1'/0'/0/${index}`,
  bech32Prefix: 'tltc',
  extraPrefixes: ['Q', '2', 'm', 'n'],
  explorer: {
    ...MAINNET_PARAMS.explorer,
    url: 'https://tltc.bitaps.com',
  },
  nodeUrl: 'https://testnet.ltc.thorchain.info',
  thornodeUrl: 'https://testnet.thornode.thorchain.info',
}

export class Client extends UTXOClient<ClientParams, Wallet> {
  static readonly create: ClientFactory<Client> = Client.bindFactory((x: ClientParams) => new Client(x))

  async validateAddress(address: string): Promise<boolean> {
    return super.validateAddress(address) && Utils.validateAddress(address, this.params.network)
  }

  async getBalance(address: Address): Promise<Balance[]> {
    return Utils.getBalance({
      sochainUrl: this.params.sochainUrl,
      network: this.params.network,
      address,
    })
  }

  async getTransactions(params: TxHistoryParams): Promise<TxsPage> {
    // Sochain API doesn't have pagination parameter
    const offset = params.offset ?? 0
    const limit = params.limit ?? 10

    const response = await sochain.getAddress({
      sochainUrl: this.params.sochainUrl,
      network: this.params.network,
      address: `${params.address}`,
    })
    const total = response.txs.length
    const transactions: Tx[] = []

    const txs = response.txs.filter((_, index) => offset <= index && index < offset + limit)
    for (const txItem of txs) {
      const rawTx = await sochain.getTx({
        sochainUrl: this.params.sochainUrl,
        network: this.params.network,
        hash: txItem.txid,
      })
      const tx: Tx = {
        asset: AssetLTC,
        from: rawTx.inputs.map((i: TxIO) => ({
          from: i.address,
          amount: assetToBase(assetAmount(i.value, Utils.LTC_DECIMAL)),
        })),
        to: rawTx.outputs
          // ignore tx with type 'nulldata'
          .filter((i: TxIO) => i.type !== 'nulldata')
          .map((i: TxIO) => ({ to: i.address, amount: assetToBase(assetAmount(i.value, Utils.LTC_DECIMAL)) })),
        date: new Date(rawTx.time * 1000),
        type: TxType.Transfer,
        hash: rawTx.txid,
      }
      transactions.push(tx)
    }

    const result: TxsPage = {
      total,
      txs: transactions,
    }
    return result
  }

  async getTransactionData(txId: string): Promise<Tx> {
    const rawTx = await sochain.getTx({
      sochainUrl: this.params.sochainUrl,
      network: this.params.network,
      hash: txId,
    })
    return {
      asset: AssetLTC,
      from: rawTx.inputs.map((i) => ({
        from: i.address,
        amount: assetToBase(assetAmount(i.value, Utils.LTC_DECIMAL)),
      })),
      to: rawTx.outputs.map((i) => ({ to: i.address, amount: assetToBase(assetAmount(i.value, Utils.LTC_DECIMAL)) })),
      date: new Date(rawTx.time * 1000),
      type: TxType.Transfer,
      hash: rawTx.txid,
    }
  }

  protected async getSuggestedFeeRate(): Promise<FeeRate> {
    return await sochain.getSuggestedTxFee()
  }

  protected async calcFee(feeRate: FeeRate, memo?: string): Promise<Fee> {
    return Utils.calcFee(feeRate, memo)
  }

  async transfer(params: TxParams & { feeRate?: FeeRate }): Promise<TxHash> {
    if (this.wallet === null) throw new Error('client must be unlocked')
    const index = params.walletIndex ?? 0
    if (!(Number.isSafeInteger(index) && index >= 0)) throw new Error('index must be a non-negative integer')

    const ltcKeys = await this.wallet.getLtcKeys(index)
    const feeRate = params.feeRate ?? (await this.getFeeRates())[FeeOption.Fast]
    const { psbt } = await Utils.buildTx({
      ...params,
      feeRate,
      sender: await this.getAddress(index),
      sochainUrl: this.params.sochainUrl,
      network: this.params.network,
    })
    psbt.signAllInputs(ltcKeys) // Sign all inputs
    psbt.finalizeAllInputs() // Finalise inputs
    const txHex = psbt.extractTransaction().toHex() // TX extracted and formatted to hex

    return await Utils.broadcastTx({
      network: this.params.network,
      txHex,
      nodeUrl: this.params.nodeUrl,
      auth: this.params.nodeAuth,
    })
  }
}
