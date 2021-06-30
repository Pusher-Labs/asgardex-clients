import nock from 'nock'

import { TxsPage } from '@xchainjs/xchain-client'
import { assetToString, baseAmount, BaseAmount } from '@xchainjs/xchain-util'
import { BroadcastTxCommitResult, Coin, BaseAccount } from 'cosmos-client/api'
import { AssetAtom, AssetMuon } from '../src/types'
import { Client } from '../src/client'
import { getDenom } from '../src/util'
import { TxHistoryResponse, TxResponse } from '../src/cosmos/types'

const getClientUrl = (client: Client): string => {
  return client.getNetwork() === 'testnet' ? 'http://lcd.gaia.bigdipper.live:1317' : 'https://api.cosmos.network'
}

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

const assertTxsPost = (
  url: string,
  from_address: string,
  to_address: string,
  send_amount: Coin[],
  memo: undefined | string,
  result: BroadcastTxCommitResult,
) => {
  nock(url, { allowUnmocked: true })
    .post(`/txs`, (body) => {
      expect(body.tx.msg.length).toEqual(1)
      expect(body.tx.msg[0].type).toEqual('cosmos-sdk/MsgSend')
      expect(body.tx.msg[0].value.from_address).toEqual(from_address)
      expect(body.tx.msg[0].value.to_address).toEqual(to_address)
      expect(body.tx.msg[0].value.amount).toEqual(send_amount)
      expect(body.tx.memo).toEqual(memo)
      return true
    })
    .reply(200, result)
}

const assertTxHstory = (url: string, address: string, result: TxHistoryResponse): void => {
  nock(url).get(`/txs?message.sender=${address}`).reply(200, result)
}

const assertTxHashGet = (url: string, hash: string, result: TxResponse): void => {
  nock(url).get(`/txs/${hash}`).reply(200, result)
}

describe('Client Test', () => {
  let cosmosClient: Client

  const phrase = 'foster blouse cattle fiction deputy social brown toast various sock awkward print'
  const address0_mainnet = 'cosmos16mzuy68a9xzqpsp88dt4f2tl0d49drhepn68fg'
  const address1_mainnet = 'cosmos1924f27fujxqnkt74u4d3ke3sfygugv9qp29hmk'

  const address0_testnet = 'cosmos13hrqe0g38nqnjgnstkfrlm2zd790g5yegntshv'
  const address1_testnet = 'cosmos1re8rf3sv2tkx88xx6825tjqtfntrrfj0h4u94u'

  beforeEach(() => {
    cosmosClient = new Client({ phrase, network: 'testnet' })
  })

  afterEach(() => {
    cosmosClient.purgeClient()
  })

  it('should start with empty wallet', async () => {
    const cosmosClientEmptyMain = new Client({ phrase, network: 'mainnet' })
    expect(cosmosClientEmptyMain.getAddress()).toEqual(address0_mainnet)
    expect(cosmosClientEmptyMain.getAddress(1)).toEqual(address1_mainnet)

    const cosmosClientEmptyTest = new Client({ phrase, network: 'testnet' })
    expect(cosmosClientEmptyTest.getAddress()).toEqual(address0_testnet)
    expect(cosmosClientEmptyTest.getAddress(1)).toEqual(address1_testnet)
  })

  it('throws an error passing an invalid phrase', async () => {
    expect(() => {
      new Client({ phrase: 'invalid phrase', network: 'mainnet' })
    }).toThrow()

    expect(() => {
      new Client({ phrase: 'invalid phrase', network: 'testnet' })
    }).toThrow()
  })

  it('should have right address', async () => {
    expect(cosmosClient.getAddress()).toEqual(address0_testnet)
  })

  it('should update net', async () => {
    const client = new Client({ phrase, network: 'mainnet' })
    client.setNetwork('testnet')
    expect(client.getNetwork()).toEqual('testnet')

    const address = client.getAddress()
    expect(address).toEqual(address)
  })

  it('should init, should have right prefix', async () => {
    expect(cosmosClient.validateAddress(cosmosClient.getAddress())).toEqual(true)

    cosmosClient.setNetwork('mainnet')
    expect(cosmosClient.validateAddress(cosmosClient.getAddress())).toEqual(true)
  })

  it('has no balances', async () => {
    cosmosClient.setNetwork('mainnet')

    mockAccountsBalance(getClientUrl(cosmosClient), address0_mainnet, {
      height: 0,
      result: [],
    })

    const balances = await cosmosClient.getBalance(address0_mainnet)
    const expected = balances[0].amount.amount().isEqualTo(baseAmount(0, 6).amount())
    expect(expected).toBeTruthy()
    expect(assetToString(balances[0].asset)).toEqual(assetToString(AssetAtom))
  })

  it('has balances', async () => {
    mockAccountsBalance(getClientUrl(cosmosClient), 'cosmos1gehrq0pr5d79q8nxnaenvqh09g56jafm82thjv', {
      height: 0,
      result: [
        {
          denom: 'muon',
          amount: '75000000',
        },
      ],
    })
    const balances = await cosmosClient.getBalance('cosmos1gehrq0pr5d79q8nxnaenvqh09g56jafm82thjv')
    const expected = balances[0].amount.amount().isEqualTo(baseAmount(75000000, 6).amount())
    expect(expected).toBeTruthy()
    expect(balances[0].asset).toEqual(AssetMuon)
  })

  it('has an empty tx history', async () => {
    cosmosClient.setNetwork('mainnet')

    const expected: TxsPage = {
      total: 0,
      txs: [],
    }
    assertTxHstory(getClientUrl(cosmosClient), address0_mainnet, {
      count: 0,
      limit: 30,
      page_number: 1,
      page_total: 1,
      total_count: 0,
      txs: [],
    })

    const transactions = await cosmosClient.getTransactions({ address: address0_mainnet })
    expect(transactions).toEqual(expected)
  })

  it('has tx history', async () => {
    assertTxHstory(getClientUrl(cosmosClient), 'cosmos1xvt4e7xd0j9dwv2w83g50tpcltsl90h52003e2', {
      count: 1,
      limit: 30,
      page_number: 1,
      page_total: 1,
      total_count: 1,
      txs: [
        {
          height: 1047,
          txhash: '19BFC1E8EBB10AA1EC6B82E380C6F5FD349D367737EA8D55ADB4A24F0F7D1066',
          data: '0A090A076465706F736974',
          raw_log: 'transaction logs',
          gas_wanted: '5000000000000000',
          gas_used: '148996',
          tx: {
            body: {
              messages: [
                {
                  type: 'cosmos-sdk/MsgSend',
                  value: {
                    from_address: 'cosmos1xvt4e7xd0j9dwv2w83g50tpcltsl90h52003e2',
                    to_address: 'cosmos155svs6sgxe55rnvs6ghprtqu0mh69kehrn0dqr',
                    amount: [
                      {
                        denom: 'umuon',
                        amount: 4318994970,
                      },
                    ],
                  },
                },
              ],
            },
          },
          timestamp: '2020-09-25T06:09:15Z',
        },
      ],
    })

    let transactions = await cosmosClient.getTransactions({ address: 'cosmos1xvt4e7xd0j9dwv2w83g50tpcltsl90h52003e2' })
    expect(transactions.total).toBeGreaterThan(0)

    cosmosClient.setNetwork('mainnet')

    assertTxHstory(getClientUrl(cosmosClient), 'cosmos1pjkpqxmvz47a5aw40l98fyktlg7k6hd9heq95z', {
      count: 1,
      limit: 30,
      page_number: 1,
      page_total: 1,
      total_count: 1,
      txs: [
        {
          height: 1047,
          txhash: '19BFC1E8EBB10AA1EC6B82E380C6F5FD349D367737EA8D55ADB4A24F0F7D1066',
          data: '0A090A076465706F736974',
          raw_log: 'transaction logs',
          gas_wanted: '5000000000000000',
          gas_used: '148996',
          tx: {
            body: {
              messages: [
                {
                  type: 'cosmos-sdk/MsgSend',
                  value: {
                    from_address: 'cosmos1pjkpqxmvz47a5aw40l98fyktlg7k6hd9heq95z',
                    to_address: 'cosmos155svs6sgxe55rnvs6ghprtqu0mh69kehrn0dqr',
                    amount: [
                      {
                        denom: 'uatom',
                        amount: 4318994970,
                      },
                    ],
                  },
                },
              ],
            },
          },
          timestamp: '2020-09-25T06:09:15Z',
        },
      ],
    })

    transactions = await cosmosClient.getTransactions({ address: 'cosmos1pjkpqxmvz47a5aw40l98fyktlg7k6hd9heq95z' })
    expect(transactions.total).toBeGreaterThan(0)
  })

  it('transfer', async () => {
    const to_address = 'cosmos1gehrq0pr5d79q8nxnaenvqh09g56jafm82thjv'
    const send_amount: BaseAmount = baseAmount(10000, 6)
    const memo = 'transfer'

    const expected_txsPost_result: BroadcastTxCommitResult = {
      check_tx: {},
      deliver_tx: {},
      txhash: 'EA2FAC9E82290DCB9B1374B4C95D7C4DD8B9614A96FACD38031865EB1DBAE24D',
      height: 0,
    }

    mockAccountsAddress(getClientUrl(cosmosClient), cosmosClient.getAddress(), {
      height: 0,
      result: {
        coins: [
          {
            denom: 'muon',
            amount: '21000',
          },
        ],
        account_number: '0',
        sequence: '0',
      },
    })
    assertTxsPost(
      getClientUrl(cosmosClient),
      cosmosClient.getAddress(),
      to_address,
      [
        {
          denom: getDenom(AssetMuon),
          amount: send_amount.amount().toString(),
        },
      ],
      memo,
      expected_txsPost_result,
    )

    const result = await cosmosClient.transfer({
      asset: AssetMuon,
      recipient: to_address,
      amount: send_amount,
      memo,
    })

    expect(result).toEqual('EA2FAC9E82290DCB9B1374B4C95D7C4DD8B9614A96FACD38031865EB1DBAE24D')
  })

  it('get transaction data', async () => {
    cosmosClient.setNetwork('mainnet')

    assertTxHashGet(getClientUrl(cosmosClient), '19BFC1E8EBB10AA1EC6B82E380C6F5FD349D367737EA8D55ADB4A24F0F7D1066', {
      height: 1047,
      txhash: '19BFC1E8EBB10AA1EC6B82E380C6F5FD349D367737EA8D55ADB4A24F0F7D1066',
      data: '0A090A076465706F736974',
      raw_log: 'transaction logs',
      gas_wanted: '5000000000000000',
      gas_used: '148996',
      tx: {
        body: {
          messages: [
            {
              type: 'cosmos-sdk/MsgSend',
              value: {
                from_address: 'cosmos1pjkpqxmvz47a5aw40l98fyktlg7k6hd9heq95z',
                to_address: 'cosmos155svs6sgxe55rnvs6ghprtqu0mh69kehrn0dqr',
                amount: [
                  {
                    denom: 'uatom',
                    amount: 4318994970,
                  },
                ],
              },
            },
          ],
        },
      },
      timestamp: '2020-09-25T06:09:15Z',
    })

    const tx = await cosmosClient.getTransactionData('19BFC1E8EBB10AA1EC6B82E380C6F5FD349D367737EA8D55ADB4A24F0F7D1066')
    expect(tx.type).toEqual('transfer')
    expect(tx.hash).toEqual('19BFC1E8EBB10AA1EC6B82E380C6F5FD349D367737EA8D55ADB4A24F0F7D1066')
    expect(tx.from[0].from).toEqual('cosmos1pjkpqxmvz47a5aw40l98fyktlg7k6hd9heq95z')
    expect(tx.from[0].amount.amount().isEqualTo(baseAmount(4318994970, 6).amount())).toBeTruthy()
    expect(tx.to[0].to).toEqual('cosmos155svs6sgxe55rnvs6ghprtqu0mh69kehrn0dqr')
    expect(tx.to[0].amount.amount().isEqualTo(baseAmount(4318994970, 6).amount())).toBeTruthy()
  })

  it('should return valid explorer url', () => {
    // Client created with network === 'testnet'
    expect(cosmosClient.getExplorerUrl()).toEqual('https://gaia.bigdipper.live')

    cosmosClient.setNetwork('mainnet')
    expect(cosmosClient.getExplorerUrl()).toEqual('https://cosmos.bigdipper.live')
  })

  it('should retrun valid explorer address url', () => {
    expect(cosmosClient.getExplorerAddressUrl('anotherTestAddressHere')).toEqual(
      'https://gaia.bigdipper.live/account/anotherTestAddressHere',
    )

    cosmosClient.setNetwork('mainnet')
    expect(cosmosClient.getExplorerAddressUrl('testAddressHere')).toEqual(
      'https://cosmos.bigdipper.live/account/testAddressHere',
    )
  })

  it('should retrun valid explorer tx url', () => {
    expect(cosmosClient.getExplorerTxUrl('anotherTestTxHere')).toEqual(
      'https://gaia.bigdipper.live/transactions/anotherTestTxHere',
    )

    cosmosClient.setNetwork('mainnet')
    expect(cosmosClient.getExplorerTxUrl('testTxHere')).toEqual('https://cosmos.bigdipper.live/transactions/testTxHere')
  })
})
