import { Global } from '@polkadot/rpc-provider/mock/types'
import { Constructor } from '@polkadot/types/types'
import { baseAmount } from '@xchainjs/xchain-util'

import { assertAccountsBalance, assertTxData, assertTxHistory } from '../__mocks__/subscan'
import { Scope, mockWs } from '../__mocks__/ws'
import { Client, MAINNET_PARAMS, TESTNET_PARAMS } from '../src/client'
import { Wallet } from '../src/wallet'

declare const global: Global

describe('Client Test', () => {
  let mock: Scope
  let globalWs: Constructor<WebSocket>
  let polkadotClient: Client

  const phrase = 'wing divide pear industry silver concert chest cloud torch merit fatigue silk'
  const mainnet_address = '15gn1stGWNFPrErAUmEfKEaG6eSpGqdAZg8E7yRKSNdozbZn'
  const testnet_address = '5GkUsYdCeayvQhqeX8BfB5k7F2TAaY52VBPjxgRxtHcHp2sd'

  beforeEach(async () => {
    polkadotClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    globalWs = global.WebSocket
    mock = mockWs(polkadotClient.getWsEndpoint())
  })

  afterEach(async () => {
    await polkadotClient.purgeClient()

    global.WebSocket = globalWs
    mock.done()
  })

  it('throws an error passing an invalid phrase', async () => {
    await expect(Client.create(MAINNET_PARAMS, Wallet.create('invalid phrase'))).rejects.toThrow()
    await expect(Client.create(TESTNET_PARAMS, Wallet.create('invalid phrase'))).rejects.toThrow()
  })

  it('should have right address', async () => {
    expect(await polkadotClient.getAddress()).toEqual(testnet_address)

    polkadotClient = await Client.create(MAINNET_PARAMS, Wallet.create(phrase))
    expect(await polkadotClient.getAddress()).toEqual(mainnet_address)
  })

  it('should update net', async () => {
    polkadotClient = await Client.create(MAINNET_PARAMS, Wallet.create(phrase))
    expect(polkadotClient.getNetwork()).toEqual('mainnet')

    const address = await polkadotClient.getAddress()
    expect(address).toEqual(mainnet_address)
  })

  it('should validate address', async () => {
    polkadotClient = await Client.create(MAINNET_PARAMS, Wallet.create(phrase))
    expect(await polkadotClient.validateAddress(testnet_address)).toEqual(false)
    expect(await polkadotClient.validateAddress(mainnet_address)).toEqual(true)

    polkadotClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    expect(await polkadotClient.validateAddress(mainnet_address)).toEqual(false)
    expect(await polkadotClient.validateAddress(testnet_address)).toEqual(true)
  })

  it('no balances', async () => {
    polkadotClient = await Client.create(MAINNET_PARAMS, Wallet.create(phrase))

    assertAccountsBalance(polkadotClient.getClientUrl(), mainnet_address, {
      code: 0,
      message: 'Success',
      ttl: 1,
      data: null,
    })

    const balances = await polkadotClient.getBalance(await polkadotClient.getAddress())
    expect(balances.length).toEqual(0)
  })

  it('has balances', async () => {
    assertAccountsBalance(polkadotClient.getClientUrl(), testnet_address, {
      code: 0,
      message: 'Success',
      ttl: 1,
      data: {
        address: testnet_address,
        balance: '0.5',
        lock: '0',
      },
    })

    const balances = await polkadotClient.getBalance(await polkadotClient.getAddress())
    expect(balances.length).toEqual(1)
    expect(balances[0].amount.amount().isEqualTo(baseAmount('500000000000', 12).amount())).toBeTruthy()
  })

  it('no txHistory', async () => {
    polkadotClient = await Client.create(MAINNET_PARAMS, Wallet.create(phrase))

    assertTxHistory(polkadotClient.getClientUrl(), mainnet_address, {
      code: 0,
      message: 'Success',
      ttl: 1,
      data: {
        count: 0,
        transfers: null,
      },
    })

    const txHistory = await polkadotClient.getTransactions({ address: await polkadotClient.getAddress() })
    expect(txHistory.total).toEqual(0)
    expect(txHistory.txs.length).toEqual(0)
  })

  it('has txHistory', async () => {
    assertTxHistory(polkadotClient.getClientUrl(), '5HpLdCTNBQDjFomqpG2XWadgB4zHTuqQqNHhUyYbett7k1RR', {
      code: 0,
      message: 'Success',
      ttl: 1,
      data: {
        count: 6389,
        transfers: [
          {
            from: '5HpLdCTNBQDjFomqpG2XWadgB4zHTuqQqNHhUyYbett7k1RR',
            to: '5DGcavWpcNWUZga6dwG8dSsfUs5LqQ19hMcLeNo3JExF7EFN',
            extrinsic_index: '3058817-2',
            success: true,
            hash: '0x6b328ca6d1f72413dfb831980e601305e84ecb867cfc12dc41c2d813349a6ee5',
            block_num: 3058817,
            block_timestamp: 1605246588,
            module: 'balances',
            amount: '0.5',
            fee: '15500000001',
            nonce: 6302,
            from_account_display: {
              address: '5HpLdCTNBQDjFomqpG2XWadgB4zHTuqQqNHhUyYbett7k1RR',
              display: '',
              judgements: null,
              parent_display: '',
              parent: '',
              account_index: '',
              identity: false,
            },
            to_account_display: {
              address: '5DGcavWpcNWUZga6dwG8dSsfUs5LqQ19hMcLeNo3JExF7EFN',
              display: '',
              judgements: null,
              parent_display: '',
              parent: '',
              account_index: '',
              identity: false,
            },
          },
        ],
      },
    })

    const txHistory = await polkadotClient.getTransactions({
      address: '5HpLdCTNBQDjFomqpG2XWadgB4zHTuqQqNHhUyYbett7k1RR',
    })

    expect(txHistory.total).toEqual(6389)
    expect(txHistory.txs.length).toEqual(1)
    expect(txHistory.txs[0].hash).toEqual('0x6b328ca6d1f72413dfb831980e601305e84ecb867cfc12dc41c2d813349a6ee5')
    expect(txHistory.txs[0].from[0].from).toEqual('5HpLdCTNBQDjFomqpG2XWadgB4zHTuqQqNHhUyYbett7k1RR')
    expect(txHistory.txs[0].from[0].amount.amount().isEqualTo(baseAmount('500000000000', 12).amount())).toBeTruthy()
    expect(txHistory.txs[0].to[0].to).toEqual('5DGcavWpcNWUZga6dwG8dSsfUs5LqQ19hMcLeNo3JExF7EFN')
    expect(txHistory.txs[0].to[0].amount.amount().isEqualTo(baseAmount('500000000000', 12).amount())).toBeTruthy()
  })

  it('get transaction data', async () => {
    assertTxData(polkadotClient.getClientUrl(), '0x6b328ca6d1f72413dfb831980e601305e84ecb867cfc12dc41c2d813349a6ee5', {
      code: 0,
      message: 'Success',
      ttl: 1,
      data: {
        block_timestamp: 1605246588,
        block_num: 3058817,
        extrinsic_index: '3058817-2',
        call_module_function: 'transfer',
        call_module: 'balances',
        account_id: '5HpLdCTNBQDjFomqpG2XWadgB4zHTuqQqNHhUyYbett7k1RR',
        signature:
          '2e1e80cc21a18b3cc6697a458cf6a7f12af03debca9f89fa72a082658466f54bcdc8c4821431ea3d9b28781edc268ce55d23725f75c413d3aae26d3f024c288a',
        nonce: 6302,
        extrinsic_hash: '0x6b328ca6d1f72413dfb831980e601305e84ecb867cfc12dc41c2d813349a6ee5',
        success: true,
        params: [
          {
            name: 'dest',
            type: 'Address',
            value: '64c0969debbb33e9d82bdd338325ef087cb253be7f80baddc3b94523c4b83833',
            valueRaw: '',
          },
          {
            name: 'value',
            type: 'Compact<Balance>',
            value: '500000000000',
            valueRaw: '',
          },
        ],
        transfer: {
          from: '5HpLdCTNBQDjFomqpG2XWadgB4zHTuqQqNHhUyYbett7k1RR',
          to: '5ELorcuxqBNbAgC72F1PLW55hHf9jdeFkAcqCsQ4mLDCVLxb',
          module: 'balances',
          amount: '0.5',
          hash: '0x6b328ca6d1f72413dfb831980e601305e84ecb867cfc12dc41c2d813349a6ee5',
          block_timestamp: 0,
          block_num: 0,
          extrinsic_index: '',
          success: true,
          fee: '0',
          to_account_display: {
            address: '5ELorcuxqBNbAgC72F1PLW55hHf9jdeFkAcqCsQ4mLDCVLxb',
            display: '',
            judgements: null,
            parent_display: '',
            parent: '',
            account_index: '',
            identity: false,
          },
        },
        event: [
          {
            event_index: '3058817-2',
            block_num: 3058817,
            extrinsic_idx: 2,
            module_id: 'balances',
            event_id: 'Transfer',
            params:
              '[{"type:"AccountId","value:"fe747dadf0f62c7d1bac6988a156fdd41cf2d14ccfdc15e289512a7073bbf266","value_raw:""},{"type:"AccountId","value:"64c0969debbb33e9d82bdd338325ef087cb253be7f80baddc3b94523c4b83833","value_raw:""},{"type:"Balance","value:"500000000000","value_raw:""}]',
            extrinsic_hash: '0x6b328ca6d1f72413dfb831980e601305e84ecb867cfc12dc41c2d813349a6ee5',
            event_idx: 2,
            finalized: true,
          },
          {
            event_index: '3058817-2',
            block_num: 3058817,
            extrinsic_idx: 2,
            module_id: 'balances',
            event_id: 'Deposit',
            params:
              '[{"type:"AccountId","value:"0cbd53bcfbf3ff968f1ef4ade1c9fe18bed688a0ea77eb51e4cccd2e4c26af03","value_raw:""},{"type:"Balance","value:"15500000001","value_raw:""}]',
            extrinsic_hash: '0x6b328ca6d1f72413dfb831980e601305e84ecb867cfc12dc41c2d813349a6ee5',
            event_idx: 3,
            finalized: true,
          },
        ],
        fee: '15500000001',
        error: null,
        finalized: true,
        lifetime: {
          birth: 3058814,
          death: 3058878,
        },
        tip: '0',
        account_display: {
          address: '5HpLdCTNBQDjFomqpG2XWadgB4zHTuqQqNHhUyYbett7k1RR',
          display: '',
          judgements: null,
          parent_display: '',
          parent: '',
          account_index: '',
          identity: false,
        },
        crosschain_op: null,
      },
    })

    const txResult = await polkadotClient.getTransactionData(
      '0x6b328ca6d1f72413dfb831980e601305e84ecb867cfc12dc41c2d813349a6ee5',
    )

    expect(txResult.hash).toEqual('0x6b328ca6d1f72413dfb831980e601305e84ecb867cfc12dc41c2d813349a6ee5')
    expect(txResult.from[0].from).toEqual('5HpLdCTNBQDjFomqpG2XWadgB4zHTuqQqNHhUyYbett7k1RR')
    expect(txResult.from[0].amount.amount().isEqualTo(baseAmount('500000000000', 12).amount())).toBeTruthy()
    expect(txResult.to[0].to).toEqual('5ELorcuxqBNbAgC72F1PLW55hHf9jdeFkAcqCsQ4mLDCVLxb')
    expect(txResult.to[0].amount.amount().isEqualTo(baseAmount('500000000000', 12).amount())).toBeTruthy()
  })

  it('transferWithoutMemo', async () => {
    assertAccountsBalance(polkadotClient.getClientUrl(), testnet_address, {
      code: 0,
      message: 'Success',
      ttl: 1,
      data: {
        address: testnet_address,
        balance: '0.5',
        lock: '0',
      },
    })

    const txHash = await polkadotClient.transfer({
      amount: baseAmount('1000000000', 12),
      recipient: '5CwPxumBRDLkP7VQEYzhwoYw6AP4FNmRM7G1pj7Atj6dEzgY',
    })

    expect(txHash).toEqual('0xdd227d44f1ed2e5b82e38daf699f66fc5ea28f1e104167b19d587a2363190ee9')
  })

  it('transferWithoutMemoWithInsufficientFunds', async () => {
    assertAccountsBalance(polkadotClient.getClientUrl(), testnet_address, {
      code: 0,
      message: 'Success',
      ttl: 1,
      data: {
        address: testnet_address,
        balance: '0.5',
        lock: '0',
      },
    })

    return expect(
      polkadotClient.transfer({
        amount: baseAmount('100000000000000000', 12),
        recipient: '5CwPxumBRDLkP7VQEYzhwoYw6AP4FNmRM7G1pj7Atj6dEzgY',
      }),
    ).rejects.toThrow('insufficient balance')
  })

  it('transferWithMemo', async () => {
    assertAccountsBalance(polkadotClient.getClientUrl(), testnet_address, {
      code: 0,
      message: 'Success',
      ttl: 1,
      data: {
        address: testnet_address,
        balance: '0.5',
        lock: '0',
      },
    })

    const txHash = await polkadotClient.transfer({
      amount: baseAmount('1000000000', 12),
      recipient: '5CwPxumBRDLkP7VQEYzhwoYw6AP4FNmRM7G1pj7Atj6dEzgY',
      memo: 'ABC',
    })

    expect(txHash).toEqual('0xdd227d44f1ed2e5b82e38daf699f66fc5ea28f1e104167b19d587a2363190ee9')
  })

  it('transferWithMemoWithInsufficientFunds', async () => {
    assertAccountsBalance(polkadotClient.getClientUrl(), testnet_address, {
      code: 0,
      message: 'Success',
      ttl: 1,
      data: {
        address: testnet_address,
        balance: '0.5',
        lock: '0',
      },
    })

    return expect(
      polkadotClient.transfer({
        amount: baseAmount('100000000000000000', 12),
        recipient: '5CwPxumBRDLkP7VQEYzhwoYw6AP4FNmRM7G1pj7Atj6dEzgY',
        memo: 'ABC',
      }),
    ).rejects.toThrow('insufficient balance')
  })

  it('get fees', async () => {
    const fees = await polkadotClient.getFees()

    expect(fees.type).toEqual('byte')
    expect(fees.average.amount().isEqualTo(baseAmount('15000000001', 12).amount())).toBeTruthy()
    expect(fees.fast.amount().isEqualTo(baseAmount('15000000001', 12).amount())).toBeTruthy()
    expect(fees.fastest.amount().isEqualTo(baseAmount('15000000001', 12).amount())).toBeTruthy()
  })
})
