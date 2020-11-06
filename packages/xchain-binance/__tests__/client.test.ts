require('dotenv').config()
import { Client as BinanceClient } from '../src/client'
import { AssetBNB, baseAmount, delay } from '@xchainjs/xchain-util'

describe('BinanceClient Test', () => {
  let bnbClient: BinanceClient

  // Note: This phrase is created by https://iancoleman.io/bip39/ and will never been used in a real-world
  const phrase = 'rural bright ball negative already grass good grant nation screen model pizza'
  const mainnetaddress = 'bnb1zd87q9dywg3nu7z38mxdcxpw8hssrfp9e738vr'
  const testnetaddress = 'tbnb1zd87q9dywg3nu7z38mxdcxpw8hssrfp9htcrvj'

  // This needs to be updated once `Fees` type in `asgardex-client` changes
  const singleTxFee = baseAmount(37500)
  const transferFee = { type: 'base', average: singleTxFee, fast: singleTxFee, fastest: singleTxFee }
  const multiTxFee = baseAmount(30000)
  const multiSendFee = { type: 'base', average: multiTxFee, fast: multiTxFee, fastest: multiTxFee }
  const freezeTxFee = baseAmount(500000)
  const freezeFee = { type: 'base', average: freezeTxFee, fast: freezeTxFee, fastest: freezeTxFee }

  const transferAmount = baseAmount(1000000)
  const freezeAmount = baseAmount(500000)

  // tbnb1t95kjgmjc045l2a728z02textadd98yt339jk7 is used for testing transaction.
  // it needs to have balances.
  const phraseForTX = 'wheel leg dune emerge sudden badge rough shine convince poet doll kiwi sleep labor hello'
  const testnetaddressForTx = 'tbnb1t95kjgmjc045l2a728z02textadd98yt339jk7'

  beforeEach(async () => {
    bnbClient = new BinanceClient({ phrase, network: 'mainnet' })
  })

  afterEach(async () => {
    bnbClient.purgeClient()

    await delay(1000)
  })

  it('should start with empty wallet', async () => {
    const bnbClientEmptyMain = new BinanceClient({ phrase, network: 'mainnet' })
    const addressMain = bnbClientEmptyMain.getAddress()
    expect(addressMain).toEqual(mainnetaddress)

    const bnbClientEmptyTest = new BinanceClient({ phrase, network: 'testnet' })
    const addressTest = bnbClientEmptyTest.getAddress()
    expect(addressTest).toEqual(testnetaddress)
  })

  it('throws an error passing an invalid phrase', async () => {
    expect(() => {
      new BinanceClient({ phrase: 'invalid phrase', network: 'mainnet' })
    }).toThrow()
  })

  it('should have right address', async () => {
    expect(bnbClient.getAddress()).toEqual(mainnetaddress)
  })

  it('should update net', () => {
    const client = new BinanceClient({ phrase, network: 'mainnet' })
    client.setNetwork('testnet')
    expect(client.getNetwork()).toEqual('testnet')
    expect(client.getAddress()).toEqual(testnetaddress)
  })

  it('setPhrase should return addres', () => {
    expect(bnbClient.setPhrase(phrase)).toEqual(mainnetaddress)

    bnbClient.setNetwork('testnet')
    expect(bnbClient.setPhrase(phrase)).toEqual(testnetaddress)
  })

  it('should generate phrase', () => {
    const client = new BinanceClient({ phrase, network: 'mainnet' })
    expect(client.getAddress()).toEqual(mainnetaddress)

    client.setPhrase(BinanceClient.generatePhrase())
    expect(client.getAddress()).toBeTruthy()
    expect(client.getAddress()).not.toEqual(mainnetaddress)
  })

  it('should validate address', () => {
    expect(bnbClient.validateAddress(mainnetaddress)).toBeTruthy()

    bnbClient.setNetwork('testnet')
    expect(bnbClient.validateAddress(testnetaddress)).toBeTruthy()
  })

  it('has no balances', async () => {
    let balances = await bnbClient.getBalance('bnb1v8cprldc948y7mge4yjept48xfqpa46mmcrpku')
    expect(balances).toEqual([])

    // no balances for `account not found`
    balances = await bnbClient.getBalance('bnb1ja07feunxx6z9kue3fn05dazt0gpn4y9e5t8rn')
    expect(balances).toEqual([])
  })

  it('has balances', async () => {
    bnbClient.setNetwork('testnet')

    const balances = await bnbClient.getBalance('tbnb1zd87q9dywg3nu7z38mxdcxpw8hssrfp9htcrvj', AssetBNB)
    expect(balances.length).toEqual(1)

    const amount = balances[0].amount
    const frozenAmount = balances[0].frozenAmount

    expect(amount.amount().isEqualTo(1289087500)).toBeTruthy()
    expect(balances[0].frozenAmount).toBeTruthy()
    if (frozenAmount) {
      expect(frozenAmount.amount().isEqualTo(10000000)).toBeTruthy()
    }
  })

  it('fetches the transfer fees', async () => {
    const fees = await bnbClient.getFees()
    expect(fees.type).toEqual(transferFee.type)
    expect(fees.average.amount().isEqualTo(singleTxFee.amount())).toBeTruthy()
    expect(fees.fast.amount().isEqualTo(singleTxFee.amount())).toBeTruthy()
    expect(fees.fastest.amount().isEqualTo(singleTxFee.amount())).toBeTruthy()
  })

  it('fetches the multisend fees', async () => {
    const fees = await bnbClient.getMultiSendFees()
    expect(fees.type).toEqual(multiSendFee.type)
    expect(fees.average.amount().isEqualTo(multiTxFee.amount())).toBeTruthy()
    expect(fees.fast.amount().isEqualTo(multiTxFee.amount())).toBeTruthy()
    expect(fees.fastest.amount().isEqualTo(multiTxFee.amount())).toBeTruthy()
  })

  it('fetches the freeze fees', async () => {
    const fees = await bnbClient.getFreezeFees()
    expect(fees.type).toEqual(freezeFee.type)
    expect(fees.average.amount().isEqualTo(freezeTxFee.amount())).toBeTruthy()
    expect(fees.fast.amount().isEqualTo(freezeTxFee.amount())).toBeTruthy()
    expect(fees.fastest.amount().isEqualTo(freezeTxFee.amount())).toBeTruthy()
  })

  it('should broadcast a transfer', async () => {
    const client = new BinanceClient({ phrase: phraseForTX, network: 'testnet' })
    expect(client.getAddress()).toEqual(testnetaddressForTx)

    const beforeTransfer = await client.getBalance()
    expect(beforeTransfer.length).toEqual(1)

    // feeRate should be optional
    const txHash = await client.transfer({ asset: AssetBNB, recipient: testnetaddressForTx, amount: transferAmount })
    expect(txHash).toEqual(expect.any(String))
    await delay(2000) //delay after transaction

    const afterTransfer = await client.getBalance()
    expect(afterTransfer.length).toEqual(1)

    const expected = beforeTransfer[0].amount
      .amount()
      .minus(transferFee.average.amount())
      .isEqualTo(afterTransfer[0].amount.amount())
    expect(expected).toBeTruthy()
  })

  it('should freeze token', async () => {
    const client = new BinanceClient({ phrase: phraseForTX, network: 'testnet' })
    expect(client.getAddress()).toEqual(testnetaddressForTx)

    const beforeFreeze = await client.getBalance()
    expect(beforeFreeze.length).toEqual(1)

    const txHash = await client.freeze({ asset: AssetBNB, amount: freezeAmount })
    expect(txHash).toEqual(expect.any(String))
    await delay(2000) //delay after transaction

    const afterFreeze = await client.getBalance()
    expect(afterFreeze.length).toEqual(1)

    let expected = beforeFreeze[0].amount
      .amount()
      .minus(freezeAmount.amount())
      .minus(freezeFee.average.amount())
      .isEqualTo(afterFreeze[0].amount.amount())
    expect(expected).toBeTruthy()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expected = beforeFreeze[0]
      .frozenAmount!.amount()
      .plus(freezeAmount.amount())
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .isEqualTo(afterFreeze[0].frozenAmount!.amount())
    expect(expected).toBeTruthy()
  })

  it('should unfreeze token', async () => {
    const client = new BinanceClient({ phrase: phraseForTX, network: 'testnet' })
    expect(client.getAddress()).toEqual(testnetaddressForTx)

    const beforeUnFreeze = await client.getBalance()
    expect(beforeUnFreeze.length).toEqual(1)

    const txHash = await client.unfreeze({ asset: AssetBNB, amount: freezeAmount })
    expect(txHash).toEqual(expect.any(String))
    await delay(2000) //delay after transaction

    const afterUnFreeze = await client.getBalance()
    expect(afterUnFreeze.length).toEqual(1)

    let expected = beforeUnFreeze[0].amount
      .amount()
      .plus(freezeAmount.amount())
      .minus(freezeFee.average.amount())
      .isEqualTo(afterUnFreeze[0].amount.amount())
    expect(expected).toBeTruthy()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expected = beforeUnFreeze[0]
      .frozenAmount!.amount()
      .minus(freezeAmount.amount())
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .isEqualTo(afterUnFreeze[0].frozenAmount!.amount())
    expect(expected).toBeTruthy()
  })

  it('should broadcast a multi transfer', async () => {
    const client = new BinanceClient({ phrase: phraseForTX, network: 'testnet' })
    expect(client.getAddress()).toEqual(testnetaddressForTx)

    const beforeTransfer = await client.getBalance()
    expect(beforeTransfer.length).toEqual(1)

    const transactions = [
      {
        to: testnetaddressForTx,
        coins: [
          {
            asset: AssetBNB,
            amount: freezeAmount,
          },
        ],
      },
      {
        to: testnetaddressForTx,
        coins: [
          {
            asset: AssetBNB,
            amount: freezeAmount,
          },
        ],
      },
      {
        to: testnetaddressForTx,
        coins: [
          {
            asset: AssetBNB,
            amount: freezeAmount,
          },
        ],
      },
    ]
    const txHash = await client.multiSend({ transactions })
    expect(txHash).toEqual(expect.any(String))
    await delay(2000) //delay after transaction

    const afterTransfer = await client.getBalance()
    expect(afterTransfer.length).toEqual(1)

    const expected = beforeTransfer[0].amount
      .amount()
      .minus(multiSendFee.average.amount().multipliedBy(transactions.length))
      .isEqualTo(afterTransfer[0].amount.amount())
    expect(expected).toBeTruthy()
  })

  it('has an empty tx history', async () => {
    const bnbClientEmptyMain = new BinanceClient({
      phrase: 'nose link choose blossom social craft they better render provide escape talk',
      network: 'mainnet',
    })
    const txArray = await bnbClientEmptyMain.getTransactions()
    expect(txArray).toEqual({ total: 0, txs: [] })
  })

  it('has tx history', async () => {
    bnbClient.setNetwork('testnet')

    const txArray = await bnbClient.getTransactions({ address: testnetaddressForTx })
    expect(txArray.total).toBeTruthy()
    expect(txArray.txs.length).toBeTruthy()
  })

  it.only('get transaction data', async () => {
    const tx = await bnbClient.getTransactionData('A9E8E05603658BF3A295F04C856FE69E79EDA7375A307369F37411939BC321BB')
    expect(tx.hash).toEqual('A9E8E05603658BF3A295F04C856FE69E79EDA7375A307369F37411939BC321BB')
    expect(tx.from[0].from).toEqual('bnb1jxfh2g85q3v0tdq56fnevx6xcxtcnhtsmcu64m')
    expect(tx.from[0].amount.amount().isEqualTo(baseAmount(107167590000000, 8).amount())).toBeTruthy()
    expect(tx.to[0].to).toEqual('bnb1fm4gqjxkrdfk8f23xjv6yfx3k7vhrdck8qp6a6')
    expect(tx.to[0].amount.amount().isEqualTo(baseAmount(107167590000000, 8).amount())).toBeTruthy()
  })

  it('should return valid explorer url', () => {
    // Client created with network === 'mainnet'
    expect(bnbClient.getExplorerUrl()).toEqual('https://explorer.binance.org')

    bnbClient.setNetwork('testnet')
    expect(bnbClient.getExplorerUrl()).toEqual('https://testnet-explorer.binance.org')
  })

  it('should retrun valid explorer address url', () => {
    expect(bnbClient.getExplorerAddressUrl('anotherTestAddressHere')).toEqual(
      'https://explorer.binance.org/address/anotherTestAddressHere',
    )

    bnbClient.setNetwork('testnet')
    expect(bnbClient.getExplorerAddressUrl('testAddressHere')).toEqual(
      'https://testnet-explorer.binance.org/address/testAddressHere',
    )
  })

  it('should retrun valid explorer tx url', () => {
    expect(bnbClient.getExplorerTxUrl('anotherTestTxHere')).toEqual('https://explorer.binance.org/tx/anotherTestTxHere')

    bnbClient.setNetwork('testnet')
    expect(bnbClient.getExplorerTxUrl('testTxHere')).toEqual('https://testnet-explorer.binance.org/tx/testTxHere')
  })
})
