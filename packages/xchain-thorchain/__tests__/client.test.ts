import nock from 'nock'

import { TxsPage } from '@xchainjs/xchain-client'
import { baseAmount, BaseAmount } from '@xchainjs/xchain-util'
import { TxHistoryResponse, TxResponse } from '@xchainjs/xchain-cosmos'
import { BroadcastTxCommitResult, Coin, BaseAccount } from 'cosmos-client/api'
import { AssetRune } from '../src/types'
import { Client } from '../src/client'
import { getDenom } from '../src/util'

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
): void => {
  nock(url)
    .post(`/txs`, (body) => {
      expect(body.tx.msg.length).toEqual(1)
      expect(body.tx.msg[0].type).toEqual('thorchain/MsgSend')
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
  let thorClient: Client
  const phrase = 'rural bright ball negative already grass good grant nation screen model pizza'
  const mainnet_address = 'thor19kacmmyuf2ysyvq3t9nrl9495l5cvktjs0yfws'
  const testnet_address = 'tthor19kacmmyuf2ysyvq3t9nrl9495l5cvktj5c4eh4'

  beforeEach(() => {
    thorClient = new Client({ phrase, network: 'testnet' })
  })

  afterEach(() => {
    thorClient.purgeClient()
  })

  it('should start with empty wallet', async () => {
    const thorClientEmptyMain = new Client({ phrase, network: 'mainnet' })
    const addressMain = await thorClientEmptyMain.getAddress()
    expect(addressMain).toEqual(mainnet_address)

    const thorClientEmptyTest = new Client({ phrase, network: 'testnet' })
    const addressTest = await thorClientEmptyTest.getAddress()
    expect(addressTest).toEqual(testnet_address)
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
    expect(await thorClient.getAddress()).toEqual(testnet_address)
  })

  it('should update net', async () => {
    const client = new Client({ phrase, network: 'mainnet' })
    client.setNetwork('testnet')
    expect(client.getNetwork()).toEqual('testnet')

    const address = await client.getAddress()
    expect(address).toEqual(testnet_address)
  })

  it('should generate phrase', () => {
    const phrase_ = Client.generatePhrase()
    const valid = Client.validatePhrase(phrase_)
    expect(valid).toBeTruthy()
  })

  it('should validate phrase', () => {
    const valid = Client.validatePhrase(phrase)
    expect(valid).toBeTruthy()
  })

  it('should init, should have right prefix', async () => {
    expect(thorClient.validateAddress(thorClient.getAddress())).toEqual(true)

    thorClient.setNetwork('mainnet')
    expect(thorClient.validateAddress(thorClient.getAddress())).toEqual(true)
  })

  it('has no balances', async () => {
    mockAccountsBalance(thorClient.getClientUrl(), testnet_address, {
      height: 0,
      result: [],
    })
    const result = await thorClient.getBalance()
    expect(result).toEqual([])
  })

  it('has balances', async () => {
    thorClient.setNetwork('mainnet')
    mockAccountsBalance(thorClient.getClientUrl(), 'thor147jegk6e9sum7w3svy3hy4qme4h6dqdkgxhda5', {
      height: 0,
      result: [
        {
          denom: 'thor',
          amount: '100',
        },
      ],
    })
    const balances = await thorClient.getBalance('thor147jegk6e9sum7w3svy3hy4qme4h6dqdkgxhda5')
    expect(balances.length).toEqual(1)
    expect(balances[0].asset).toEqual(AssetRune)
    expect(balances[0].amount.amount().isEqualTo(baseAmount(100).amount())).toBeTruthy()
  })

  it('has an empty tx history', async () => {
    const expected: TxsPage = {
      total: 0,
      txs: [],
    }
    assertTxHstory(thorClient.getClientUrl(), testnet_address, {
      count: 0,
      limit: 30,
      page_number: 1,
      page_total: 1,
      total_count: 0,
      txs: [],
    })

    const transactions = await thorClient.getTransactions()
    expect(transactions).toEqual(expected)
  })

  it('has tx history', async () => {
    assertTxHstory(thorClient.getClientUrl(), testnet_address, {
      count: 1,
      limit: 30,
      page_number: 1,
      page_total: 1,
      total_count: 1,
      txs: [
        {
          height: 1047,
          txhash: '098E70A9529AC8F1A57AA0FE65D1D13040B0E803AB8BE7F3B32098164009DED3',
          raw_log: 'transaction logs',
          gas_wanted: '5000000000000000',
          gas_used: '148996',
          tx: {
            body: {
              messages: [
                {
                  type: 'thorchain/MsgSend',
                  value: {
                    from_address: 'thor19kacmmyuf2ysyvq3t9nrl9495l5cvktjs0yfws',
                    to_address: 'thor19kacmmyuf2ysyvq3t9nrl9495l5cvktjs0yfws',
                    amount: [
                      {
                        denom: 'thor',
                        amount: 1000000,
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

    const transactions = await thorClient.getTransactions()
    expect(transactions.total).toEqual(1)
  })

  it('transfer', async () => {
    const to_address = 'tthor19kacmmyuf2ysyvq3t9nrl9495l5cvktj5c4eh4'
    const send_amount: BaseAmount = baseAmount(10000, 6)
    const memo = 'transfer'

    const expected_txsPost_result: BroadcastTxCommitResult = {
      check_tx: {},
      deliver_tx: {},
      txhash: 'EA2FAC9E82290DCB9B1374B4C95D7C4DD8B9614A96FACD38031865EB1DBAE24D',
      height: 0,
    }

    mockAccountsAddress(thorClient.getClientUrl(), testnet_address, {
      height: 0,
      result: {
        coins: [
          {
            denom: 'thor',
            amount: '21000',
          },
        ],
        account_number: '0',
        sequence: '0',
      },
    })
    assertTxsPost(
      thorClient.getClientUrl(),
      testnet_address,
      to_address,
      [
        {
          denom: getDenom(AssetRune),
          amount: send_amount.amount().toString(),
        },
      ],
      memo,
      expected_txsPost_result,
    )

    const result = await thorClient.transfer({
      asset: AssetRune,
      recipient: to_address,
      amount: send_amount,
      memo,
    })

    expect(result).toEqual('EA2FAC9E82290DCB9B1374B4C95D7C4DD8B9614A96FACD38031865EB1DBAE24D')
  })

  it('deposit', async () => {
    const to_address = 'tthor19kacmmyuf2ysyvq3t9nrl9495l5cvktj5c4eh4'
    const send_amount: BaseAmount = baseAmount(10000, 6)
    const memo = 'deposit'

    const expected_txsPost_result: BroadcastTxCommitResult = {
      check_tx: {},
      deliver_tx: {},
      txhash: 'EA2FAC9E82290DCB9B1374B4C95D7C4DD8B9614A96FACD38031865EB1DBAE24D',
      height: 0,
    }

    mockAccountsAddress(thorClient.getClientUrl(), testnet_address, {
      height: 0,
      result: {
        coins: [
          {
            denom: 'thor',
            amount: '21000',
          },
        ],
        account_number: '0',
        sequence: '0',
      },
    })
    assertTxsPost(
      thorClient.getClientUrl(),
      testnet_address,
      to_address,
      [
        {
          denom: getDenom(AssetRune),
          amount: send_amount.amount().toString(),
        },
      ],
      memo,
      expected_txsPost_result,
    )

    const result = await thorClient.deposit({
      asset: AssetRune,
      recipient: to_address,
      amount: send_amount,
      memo,
    })

    expect(result).toEqual('EA2FAC9E82290DCB9B1374B4C95D7C4DD8B9614A96FACD38031865EB1DBAE24D')
  })

  it('get transaction data', async () => {
    thorClient.setNetwork('mainnet')
    assertTxHashGet(thorClient.getClientUrl(), '19BFC1E8EBB10AA1EC6B82E380C6F5FD349D367737EA8D55ADB4A24F0F7D1066', {
      height: 1047,
      txhash: '19BFC1E8EBB10AA1EC6B82E380C6F5FD349D367737EA8D55ADB4A24F0F7D1066',
      raw_log: 'transaction logs',
      gas_wanted: '5000000000000000',
      gas_used: '148996',
      tx: {
        body: {
          messages: [
            {
              type: 'thorchain/MsgSend',
              value: {
                from_address: 'thor19kacmmyuf2ysyvq3t9nrl9495l5cvktjs0yfws',
                to_address: 'thor19kacmmyuf2ysyvq3t9nrl9495l5cvktjs0yfws',
                amount: [
                  {
                    denom: 'thor',
                    amount: 1000000,
                  },
                ],
              },
            },
          ],
        },
      },
      timestamp: '2020-09-25T06:09:15Z',
    })
    const tx = await thorClient.getTransactionData('19BFC1E8EBB10AA1EC6B82E380C6F5FD349D367737EA8D55ADB4A24F0F7D1066')
    expect(tx.type).toEqual('transfer')
    expect(tx.hash).toEqual('19BFC1E8EBB10AA1EC6B82E380C6F5FD349D367737EA8D55ADB4A24F0F7D1066')
    expect(tx.from[0].from).toEqual('thor19kacmmyuf2ysyvq3t9nrl9495l5cvktjs0yfws')
    expect(tx.from[0].amount.amount().isEqualTo(baseAmount(1000000, 6).amount())).toBeTruthy()
    expect(tx.to[0].to).toEqual('thor19kacmmyuf2ysyvq3t9nrl9495l5cvktjs0yfws')
    expect(tx.to[0].amount.amount().isEqualTo(baseAmount(1000000, 6).amount())).toBeTruthy()
  })

  it('should return valid explorer url', () => {
    // Client created with network === 'testnet'
    expect(thorClient.getExplorerUrl()).toEqual('https://thorchain.net')

    thorClient.setNetwork('mainnet')
    expect(thorClient.getExplorerUrl()).toEqual('https://thorchain.net')
  })

  it('should retrun valid explorer address url', () => {
    expect(thorClient.getExplorerAddressUrl('anotherTestAddressHere')).toEqual(
      'https://thorchain.net/addresses/anotherTestAddressHere',
    )

    thorClient.setNetwork('mainnet')
    expect(thorClient.getExplorerAddressUrl('testAddressHere')).toEqual(
      'https://thorchain.net/addresses/testAddressHere',
    )
  })

  it('should retrun valid explorer tx url', () => {
    expect(thorClient.getExplorerTxUrl('anotherTestTxHere')).toEqual('https://thorchain.net/txs/anotherTestTxHere')

    thorClient.setNetwork('mainnet')
    expect(thorClient.getExplorerTxUrl('testTxHere')).toEqual('https://thorchain.net/txs/testTxHere')
  })
})
