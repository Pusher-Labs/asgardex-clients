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
  TxsPage,
  UTXOClient,
  UTXOClientParams,
} from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'

import { getAccount, getSuggestedFee, getTransaction, getTransactions } from './haskoin-api'
import { broadcastTx } from './node-api'
import { NodeAuth } from './types'
import * as utils from './utils'
import { Wallet } from './wallet'

export interface ClientParams extends UTXOClientParams {
  haskoinUrl: string
  nodeUrl: string
  nodeAuth: NodeAuth
  thornodeUrl?: string
}

export const MAINNET_PARAMS: ClientParams = {
  chain: Chain.BitcoinCash,
  network: Network.Mainnet,
  getFullDerivationPath: (index: number) => `44'/145'/0'/0/${index}`,
  extraPrefixes: ['bitcoincash:', '3', '1'],
  explorer: {
    url: 'https://www.blockchain.com/bch',
    getAddressUrl(address: string) {
      return `${this.url}/address/${address}`
    },
    getTxUrl(txid: string) {
      return `${this.url}/tx/${txid}`
    },
  },
  haskoinUrl: 'https://api.haskoin.com/bch',
  nodeUrl: 'https://bch.thorchain.info',
  nodeAuth: {
    username: 'thorchain',
    password: 'password',
  },
  thornodeUrl: 'https://thornode.thorchain.info',
}

export const TESTNET_PARAMS: ClientParams = {
  ...MAINNET_PARAMS,
  network: Network.Testnet,
  getFullDerivationPath: (index: number) => `44'/1'/0'/0/${index}`,
  extraPrefixes: ['bchtest:', '3', '1'],
  explorer: {
    ...MAINNET_PARAMS.explorer,
    url: 'https://www.blockchain.com/bch-testnet',
  },
  haskoinUrl: 'https://api.haskoin.com/bchtest',
  nodeUrl: 'https://testnet.bch.thorchain.info',
  thornodeUrl: 'https://testnet.thornode.thorchain.info',
}

export class Client extends UTXOClient<ClientParams, Wallet> {
  static readonly create: ClientFactory<Client> = Client.bindFactory((x: ClientParams) => new Client(x))

  async validateAddress(address: string): Promise<boolean> {
    return super.validateAddress(address) && utils.validateAddress(address, this.params.network)
  }

  async getBalance(address: Address): Promise<Balance[]> {
    return utils.getBalance({ haskoinUrl: this.params.haskoinUrl, address })
  }

  async getTransactions({ address, offset, limit }: TxHistoryParams): Promise<TxsPage> {
    offset = offset ?? 0
    limit = limit ?? 10

    const account = await getAccount({ haskoinUrl: this.params.haskoinUrl, address })
    const txs = await getTransactions({
      haskoinUrl: this.params.haskoinUrl,
      address,
      params: { offset, limit },
    })

    return {
      total: account.txs,
      txs: txs.map(utils.parseTransaction),
    }
  }

  async getTransactionData(txId: string): Promise<Tx> {
    const tx = await getTransaction({ haskoinUrl: this.params.haskoinUrl, txId })
    return utils.parseTransaction(tx)
  }

  protected async getSuggestedFeeRate(): Promise<FeeRate> {
    return await getSuggestedFee()
  }

  protected async calcFee(feeRate: FeeRate, memo?: string): Promise<Fee> {
    return utils.calcFee(feeRate, memo)
  }

  async transfer(params: TxParams & { feeRate?: FeeRate }): Promise<TxHash> {
    if (this.wallet === null) throw new Error('client must be unlocked')
    const index = params.walletIndex ?? 0
    if (!(Number.isSafeInteger(index) && index >= 0)) throw new Error('index must be a non-negative integer')

    const keyPair = await this.wallet.getBCHKeys(index)

    const feeRate = params.feeRate ?? (await this.getFeeRates())[FeeOption.Fast]
    const { builder, utxos } = await utils.buildTx({
      ...params,
      feeRate,
      sender: await this.getAddress(index),
      haskoinUrl: this.params.haskoinUrl,
      network: this.params.network,
    })

    utxos.forEach((utxo, index) => {
      builder.sign(index, keyPair, undefined, 0x41, utxo.witnessUtxo.value)
    })

    const tx = builder.build()
    const txHex = tx.toHex()

    return await broadcastTx({
      network: this.params.network,
      txHex,
      nodeUrl: this.params.nodeUrl,
      auth: this.params.nodeAuth,
    })
  }
}
