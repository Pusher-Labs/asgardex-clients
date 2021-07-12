import { TxsPage } from '@xchainjs/xchain-client'
import { CosmosSDKClient, RPCResponse, RPCTxSearchResult, TxResponse } from '@xchainjs/xchain-cosmos'
import { BaseAmount, assetAmount, assetToBase, baseAmount } from '@xchainjs/xchain-util'
import { BaseAccount, BroadcastTxCommitResult, Coin } from 'cosmos-client/api'
import nock from 'nock'

import { Client, MAINNET_PARAMS, TESTNET_PARAMS } from '../src/client'
import { AssetRune, ThorchainDepositResponse } from '../src/types'
import { Wallet } from '../src/wallet'

const mockAccountsAddress = (
  url: string,
  address: string,
  result: {
    height: number
    result: BaseAccount
  },
) => {
  nock(url).get(`/auth/accounts/${address}`).reply(200, result)
}

const mockAccountsBalance = (
  url: string,
  address: string,
  result: {
    height: number
    result: Coin[]
  },
) => {
  nock(url).get(`/bank/balances/${address}`).reply(200, result)
}

const mockThorchainDeposit = (url: string, result: ThorchainDepositResponse) => {
  nock(url).post('/thorchain/deposit').reply(200, result)
}

const assertTxsPost = (url: string, memo: undefined | string, result: BroadcastTxCommitResult): void => {
  nock(url)
    .post(`/txs`, (body) => {
      expect(body.tx.msg.length).toEqual(1)
      expect(body.tx.memo).toEqual(memo)
      return true
    })
    .reply(200, result)
}

const mockTxHistory = (url: string, result: RPCResponse<RPCTxSearchResult>): void => {
  nock(url)
    .get(`/tx_search`)
    .twice()
    .query((_) => true)
    .reply(200, result)
}

const assertTxHashGet = (url: string, hash: string, result: TxResponse): void => {
  nock(url).get(`/txs/${hash}`).reply(200, result)
}

describe('Client Test', () => {
  let thorClient: Client
  let thorMainClient: Client
  const phrase = 'rural bright ball negative already grass good grant nation screen model pizza'
  const mainnet_address_path0 = 'thor19kacmmyuf2ysyvq3t9nrl9495l5cvktjs0yfws'
  const mainnet_address_path1 = 'thor1hrf34g3lxwvpk7gjte0xvahf3txnq8ecgaf4nc'
  const testnet_address_path0 = 'tthor19kacmmyuf2ysyvq3t9nrl9495l5cvktj5c4eh4'
  const testnet_address_path1 = 'tthor1hrf34g3lxwvpk7gjte0xvahf3txnq8ecv2c92a'

  beforeEach(async () => {
    thorClient = await Client.create(TESTNET_PARAMS)
    thorMainClient = await Client.create(MAINNET_PARAMS)
  })

  afterEach(async () => {
    await thorClient.purgeClient()
    await thorMainClient.purgeClient()
  })

  it('should start with empty wallet', async () => {
    const thorClientEmptyMain = await Client.create(MAINNET_PARAMS, Wallet.create(phrase))
    const addressMain = await thorClientEmptyMain.getAddress()
    expect(addressMain).toEqual(mainnet_address_path0)

    const thorClientEmptyTest = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    const addressTest = await thorClientEmptyTest.getAddress()
    expect(addressTest).toEqual(testnet_address_path0)
  })

  it('should derive address accordingly to the user param', async () => {
    const thorClientEmptyMain = await Client.create(MAINNET_PARAMS, Wallet.create(phrase))
    const addressMain = await thorClientEmptyMain.getAddress()
    expect(addressMain).toEqual(mainnet_address_path0)

    const viaSetPhraseAddr1 = await thorClientEmptyMain.getAddress(1)
    expect(viaSetPhraseAddr1).toEqual(mainnet_address_path1)

    const thorClientEmptyTest = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    const addressTest = await thorClientEmptyTest.getAddress()
    expect(addressTest).toEqual(testnet_address_path0)

    const viaSetPhraseAddr1Test = await thorClientEmptyTest.getAddress(1)
    expect(viaSetPhraseAddr1Test).toEqual(testnet_address_path1)

    const thorClientEmptyMain1 = await Client.create(MAINNET_PARAMS, Wallet.create(phrase))
    const addressMain1 = await thorClientEmptyMain1.getAddress(1)
    expect(addressMain1).toEqual(mainnet_address_path1)

    const thorClientEmptyTest1 = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    const addressTest1 = await thorClientEmptyTest1.getAddress(1)
    expect(addressTest1).toEqual(testnet_address_path1)
  })

  it('throws an error passing an invalid phrase', async () => {
    await expect(Client.create(MAINNET_PARAMS, Wallet.create('invalid phrase'))).rejects.toThrow()
    await expect(Client.create(TESTNET_PARAMS, Wallet.create('invalid phrase'))).rejects.toThrow()
  })

  it('should have right address', async () => {
    await thorClient.unlock(Wallet.create(phrase))
    expect(await thorClient.getAddress()).toEqual(testnet_address_path0)

    await thorMainClient.unlock(Wallet.create(phrase))
    expect(await thorMainClient.getAddress()).toEqual(mainnet_address_path0)
  })

  it('should allow to get the CosmosSDKClient', async () => {
    expect(thorClient.getCosmosClient()).toBeInstanceOf(CosmosSDKClient)
  })

  it('should update net', async () => {
    thorMainClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    expect(thorMainClient.getNetwork()).toEqual('testnet')

    const address = await thorMainClient.getAddress()
    expect(address).toEqual(testnet_address_path0)
  })

  it('should init, should have right prefix', async () => {
    await thorClient.unlock(Wallet.create(phrase))
    expect(await thorClient.validateAddress(await thorClient.getAddress())).toEqual(true)

    thorClient = await Client.create(MAINNET_PARAMS, Wallet.create(phrase))
    expect(await thorClient.validateAddress(await thorClient.getAddress())).toEqual(true)
  })

  it('should have right client url', async () => {
    thorClient = await Client.create({
      ...MAINNET_PARAMS,
      nodeUrl: 'new mainnet client',
      rpcUrl: 'new mainnet client',
    })
    expect(thorClient.getClientUrl().node).toEqual('new mainnet client')

    thorClient = await Client.create({
      ...TESTNET_PARAMS,
      nodeUrl: 'new testnet client',
      rpcUrl: 'new testnet client',
    })
    expect(thorClient.getClientUrl().node).toEqual('new testnet client')
  })

  it('has no balances', async () => {
    mockAccountsBalance(thorClient.getClientUrl().node, testnet_address_path0, {
      height: 0,
      result: [],
    })
    await thorClient.unlock(Wallet.create(phrase))
    const result = await thorClient.getBalance(await thorClient.getAddress(0))
    expect(result).toEqual([])
  })

  it('has balances', async () => {
    thorMainClient = await Client.create(MAINNET_PARAMS)
    // mainnet - has balance: thor147jegk6e9sum7w3svy3hy4qme4h6dqdkgxhda5
    // mainnet - 0: thor19kacmmyuf2ysyvq3t9nrl9495l5cvktjs0yfws
    mockAccountsBalance(thorMainClient.getClientUrl().node, 'thor147jegk6e9sum7w3svy3hy4qme4h6dqdkgxhda5', {
      height: 0,
      result: [
        {
          denom: 'rune',
          amount: '100',
        },
      ],
    })

    const balances = await thorMainClient.getBalance('thor147jegk6e9sum7w3svy3hy4qme4h6dqdkgxhda5')
    expect(balances.length).toEqual(1)
    expect(balances[0].asset).toEqual(AssetRune)
    expect(balances[0].amount.amount().isEqualTo(baseAmount(100).amount())).toBeTruthy()
  })

  it('has an empty tx history', async () => {
    const expected: TxsPage = {
      total: 0,
      txs: [],
    }

    mockTxHistory(thorClient.getClientUrl().rpc, {
      jsonrpc: '2.0',
      id: -1,
      result: {
        txs: [],
        total_count: '0',
      },
    })

    const transactions = await thorClient.getTransactions({
      address: 'tthor13gym97tmw3axj3hpewdggy2cr288d3qffr8skg',
      limit: 1,
    })
    expect(transactions).toEqual(expected)
  })

  it('has tx history', async () => {
    const historyData = require('../__mocks__/responses/tx_search/sender-tthor137kees65jmhjm3gxyune0km5ea0zkpnj4lw29f.json')
    const bondTxData = require('../__mocks__/responses/txs/bond-tn-9C175AF7ACE9FCDC930B78909FFF598C18CBEAF9F39D7AA2C4D9A27BB7E55A5C.json')
    const address = 'tthor137kees65jmhjm3gxyune0km5ea0zkpnj4lw29f'
    const txHash = '9C175AF7ACE9FCDC930B78909FFF598C18CBEAF9F39D7AA2C4D9A27BB7E55A5C'
    mockTxHistory(thorClient.getClientUrl().rpc, historyData)

    assertTxHashGet(thorClient.getClientUrl().node, txHash, bondTxData)

    const txs = await thorClient.getTransactions({
      address: 'tthor137kees65jmhjm3gxyune0km5ea0zkpnj4lw29f',
    })

    expect(txs.total).toEqual(1)

    const { type, hash, asset, from, to } = txs.txs[0]

    expect(type).toEqual('transfer')
    expect(hash).toEqual(txHash)
    expect(asset).toEqual(AssetRune)
    expect(from[0].from).toEqual(address)
    expect(from[0].amount.amount().toString()).toEqual(assetToBase(assetAmount(0.02)).amount().toString())
    expect(from[1].from).toEqual(address)
    expect(from[1].amount.amount().toString()).toEqual(assetToBase(assetAmount(1700)).amount().toString())
    expect(to[0].to).toEqual('tthor1dheycdevq39qlkxs2a6wuuzyn4aqxhve3hhmlw')
    expect(to[0].amount.amount().toString()).toEqual(assetToBase(assetAmount(0.02)).amount().toString())
    expect(to[1].to).toEqual('tthor17gw75axcnr8747pkanye45pnrwk7p9c3uhzgff')
    expect(to[1].amount.amount().toString()).toEqual(assetToBase(assetAmount(1700)).amount().toString())
  })

  it('transfer', async () => {
    const to_address = 'tthor19kacmmyuf2ysyvq3t9nrl9495l5cvktj5c4eh4'
    const send_amount: BaseAmount = baseAmount(10000, 6)
    const memo = 'transfer'

    const expected_txsPost_result = {
      check_tx: {},
      deliver_tx: {},
      txhash: 'EA2FAC9E82290DCB9B1374B4C95D7C4DD8B9614A96FACD38031865EB1DBAE24D',
      height: 0,
      logs: [],
    }

    mockAccountsAddress(thorClient.getClientUrl().node, testnet_address_path0, {
      height: 0,
      result: {
        coins: [
          {
            denom: 'rune',
            amount: '210000000',
          },
        ],
        account_number: '0',
        sequence: '0',
      },
    })
    mockAccountsBalance(thorClient.getClientUrl().node, testnet_address_path0, {
      height: 0,
      result: [
        {
          denom: 'rune',
          amount: '210000000',
        },
      ],
    })
    assertTxsPost(thorClient.getClientUrl().node, memo, expected_txsPost_result)

    await thorClient.unlock(Wallet.create(phrase))
    const result = await thorClient.transfer({
      asset: AssetRune,
      recipient: to_address,
      amount: send_amount,
      memo,
    })

    expect(result).toEqual('EA2FAC9E82290DCB9B1374B4C95D7C4DD8B9614A96FACD38031865EB1DBAE24D')
  })

  it('deposit', async () => {
    const send_amount: BaseAmount = baseAmount(10000, 6)
    const memo = 'swap:BNB.BNB:tbnb1ftzhmpzr4t8ta3etu4x7nwujf9jqckp3th2lh0'

    const expected_txsPost_result = {
      check_tx: {},
      deliver_tx: {},
      txhash: 'EA2FAC9E82290DCB9B1374B4C95D7C4DD8B9614A96FACD38031865EB1DBAE24D',
      height: 0,
      logs: [],
    }

    mockAccountsAddress(thorClient.getClientUrl().node, testnet_address_path0, {
      height: 0,
      result: {
        coins: [
          {
            denom: 'rune',
            amount: '210000000',
          },
        ],
        account_number: '0',
        sequence: '0',
      },
    })
    mockAccountsBalance(thorClient.getClientUrl().node, testnet_address_path0, {
      height: 0,
      result: [
        {
          denom: 'rune',
          amount: '210000000',
        },
      ],
    })
    mockThorchainDeposit(thorClient.getClientUrl().node, {
      type: 'cosmos-sdk/StdTx',
      value: {
        msg: [
          {
            type: 'thorchain/MsgDeposit',
            value: {
              coins: [
                {
                  asset: 'THOR.RUNE',
                  amount: '10000',
                },
              ],
              memo: 'swap:BNB.BNB:tbnb1ftzhmpzr4t8ta3etu4x7nwujf9jqckp3th2lh0',
              signer: 'tthor19kacmmyuf2ysyvq3t9nrl9495l5cvktj5c4eh4',
            },
          },
        ],
        fee: {
          amount: [],
          gas: '100000000',
        },
        signatures: [],
        memo: '',
        timeout_height: '0',
      },
    })
    assertTxsPost(thorClient.getClientUrl().node, '', expected_txsPost_result)

    await thorClient.unlock(Wallet.create(phrase))
    const result = await thorClient.deposit({
      asset: AssetRune,
      amount: send_amount,
      memo,
    })

    expect(result).toEqual('EA2FAC9E82290DCB9B1374B4C95D7C4DD8B9614A96FACD38031865EB1DBAE24D')
  })

  it('get transaction data for BOND tx', async () => {
    const txData = require('../__mocks__/responses/txs/bond-tn-9C175AF7ACE9FCDC930B78909FFF598C18CBEAF9F39D7AA2C4D9A27BB7E55A5C.json')
    const txHash = '9C175AF7ACE9FCDC930B78909FFF598C18CBEAF9F39D7AA2C4D9A27BB7E55A5C'
    const address = 'tthor137kees65jmhjm3gxyune0km5ea0zkpnj4lw29f'
    assertTxHashGet(thorClient.getClientUrl().node, txHash, txData)
    const { type, hash, asset, from, to } = await thorClient.getTransactionData(txHash)

    expect(type).toEqual('transfer')
    expect(hash).toEqual(txHash)
    expect(asset).toEqual(AssetRune)
    expect(from[0].from).toEqual(address)
    expect(from[0].amount.amount().toString()).toEqual(assetToBase(assetAmount(0.02)).amount().toString())
    expect(from[1].from).toEqual(address)
    expect(from[1].amount.amount().toString()).toEqual(assetToBase(assetAmount(1700)).amount().toString())
    expect(to[0].to).toEqual('tthor1dheycdevq39qlkxs2a6wuuzyn4aqxhve3hhmlw')
    expect(to[0].amount.amount().toString()).toEqual(assetToBase(assetAmount(0.02)).amount().toString())
    expect(to[1].to).toEqual('tthor17gw75axcnr8747pkanye45pnrwk7p9c3uhzgff')
    expect(to[1].amount.amount().toString()).toEqual(assetToBase(assetAmount(1700)).amount().toString())
  })

  it('should return valid explorer url', async () => {
    expect(thorClient.getExplorerUrl()).toEqual('https://viewblock.io/thorchain?network=testnet')

    thorClient = await Client.create(MAINNET_PARAMS)
    expect(thorClient.getExplorerUrl()).toEqual('https://viewblock.io/thorchain')
  })

  it('should retrun valid explorer address url', async () => {
    expect(thorClient.getExplorerAddressUrl('tthorabc')).toEqual(
      'https://viewblock.io/thorchain/address/tthorabc?network=testnet',
    )

    thorClient = await Client.create(MAINNET_PARAMS)
    expect(thorClient.getExplorerAddressUrl('thorabc')).toEqual('https://viewblock.io/thorchain/address/thorabc')
  })

  it('should retrun valid explorer tx url', async () => {
    expect(thorClient.getExplorerTxUrl('txhash')).toEqual('https://viewblock.io/thorchain/tx/txhash?network=testnet')

    thorClient = await Client.create(MAINNET_PARAMS)
    expect(thorClient.getExplorerTxUrl('txhash')).toEqual('https://viewblock.io/thorchain/tx/txhash')
  })
})
