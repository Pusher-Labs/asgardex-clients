import { AssetLTC, baseAmount } from '@xchainjs/xchain-util'

import mockSochainApi from '../__mocks__/sochain'
import { Client, MAINNET_PARAMS, TESTNET_PARAMS } from '../src/client'
import { MIN_TX_FEE } from '../src/const'
import { Wallet } from '../src/wallet'
mockSochainApi.init()

describe('LitecoinClient Test', () => {
  const MEMO = 'SWAP:THOR.RUNE'
  const phraseOne = 'atom green various power must another rent imitate gadget creek fat then'
  const addyOne = 'tltc1q2pkall6rf6v6j0cvpady05xhy37erndv05de7g'

  const testnet_address_path0 = 'tltc1q2pkall6rf6v6j0cvpady05xhy37erndv05de7g'
  const testnet_address_path1 = 'tltc1qut59ufcscqnkp8fgac68pj2ps5dzjjg4eggfqd'
  const mainnet_address_path0 = 'ltc1qll0eutk38yy3jms0c85v4ey68z83c78h3fmsh3'
  const mainnet_address_path1 = 'ltc1qsr5wh2sudyc7axh087lg7py6dsagphef63acgq'

  // const phraseTwo = 'green atom various power must another rent imitate gadget creek fat then'
  const addyTwo = 'tltc1ql68zjjdjx37499luueaw09avednqtge4u23q36'

  // Third ones is used only for balance verification
  const phraseThree = 'quantum vehicle print stairs canvas kid erode grass baby orbit lake remove'
  const addyThree = 'tltc1q04y2lnt0ausy07vq9dg5w2rnn9yjl3rz364adu'

  it('set phrase should return correct address', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    expect(await ltcClient.getAddress()).toEqual(addyOne)
  })

  it('should throw an error for setting a bad phrase', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS)
    await expect(ltcClient.unlock(Wallet.create('cat'))).rejects.toThrow()
  })

  it('should not throw an error for setting a good phrase', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS)
    await expect(ltcClient.unlock(Wallet.create(phraseOne))).resolves.not.toThrow()
  })

  it('should validate the right address', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const address = await ltcClient.getAddress()
    const valid = await ltcClient.validateAddress(address)
    expect(address).toEqual(addyOne)
    expect(valid).toBeTruthy()
  })

  it('set phrase should return correct address', async () => {
    let ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    expect(await ltcClient.getAddress(0)).toEqual(testnet_address_path0)
    expect(await ltcClient.getAddress(1)).toEqual(testnet_address_path1)

    ltcClient = await Client.create(MAINNET_PARAMS, Wallet.create(phraseOne))
    expect(await ltcClient.getAddress(0)).toEqual(mainnet_address_path0)
    expect(await ltcClient.getAddress(1)).toEqual(mainnet_address_path1)
  })

  it('should get the right balance', async () => {
    const expectedBalance = 2223
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseThree))
    const balance = await ltcClient.getBalance(await ltcClient.getAddress())
    expect(balance.length).toEqual(1)
    expect(balance[0].amount.amount().toNumber()).toEqual(expectedBalance)
  })

  it('should get the right balance when scanUTXOs is called twice', async () => {
    const expectedBalance = 2223
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseThree))

    const balance = await ltcClient.getBalance(await ltcClient.getAddress())
    expect(balance.length).toEqual(1)
    expect(balance[0].amount.amount().toNumber()).toEqual(expectedBalance)

    const newBalance = await ltcClient.getBalance(await ltcClient.getAddress())
    expect(newBalance.length).toEqual(1)
    expect(newBalance[0].amount.amount().toNumber()).toEqual(expectedBalance)
  })

  it('should broadcast a normal transfer', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const amount = baseAmount(2223)
    const txid = await ltcClient.transfer({ asset: AssetLTC, recipient: addyTwo, amount, feeRate: 1 })
    expect(txid).toEqual(expect.any(String))
  })

  it('should broadcast a normal transfer without feeRate', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const amount = baseAmount(2223)
    const txid = await ltcClient.transfer({ asset: AssetLTC, recipient: addyTwo, amount })
    expect(txid).toEqual(expect.any(String))
  })

  it('should purge phrase and utxos', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    ltcClient.purgeClient()
    await expect(ltcClient.getAddress()).rejects.toThrow('client must be unlocked')
  })

  it('should do broadcast a vault transfer with a memo', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))

    const amount = baseAmount(2223)
    try {
      const txid = await ltcClient.transfer({
        asset: AssetLTC,
        recipient: addyTwo,
        amount,
        memo: MEMO,
        feeRate: 1,
      })
      expect(txid).toEqual(expect.any(String))
    } catch (err) {
      console.log('ERR running test', err)
      throw err
    }
  })

  it('should get the balance of an address without phrase', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS)
    const balance = await ltcClient.getBalance(addyThree)
    expect(balance.length).toEqual(1)
    expect(balance[0].amount.amount().toNumber()).toEqual(2223)
  })

  it('should prevent a tx when fees and valueOut exceed balance', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const asset = AssetLTC
    const amount = baseAmount(9999999999)
    return expect(
      ltcClient.transfer({ walletIndex: 0, asset, recipient: addyTwo, amount, feeRate: 1 }),
    ).rejects.toThrow('Balance insufficient for transaction')
  })

  it('returns fees and rates of a normal tx', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const { fees, rates } = await ltcClient.getFeesWithRates()
    // check fees
    expect(fees.fast).toBeDefined()
    expect(fees.fastest).toBeDefined()
    expect(fees.average).toBeDefined()
    // check rates
    expect(rates.fast).toBeDefined()
    expect(rates.fastest).toBeDefined()
    expect(rates.average).toBeDefined()
  })

  it('returns fees and rates of a tx w/ memo', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const { fees, rates } = await ltcClient.getFeesWithRates(MEMO)
    // check fees
    expect(fees.fast).toBeDefined()
    expect(fees.fastest).toBeDefined()
    expect(fees.average).toBeDefined()
    // check rates
    expect(rates.fast).toBeDefined()
    expect(rates.fastest).toBeDefined()
    expect(rates.average).toBeDefined()
  })

  it('should return estimated fees of a normal tx', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const estimates = await ltcClient.getFees()
    expect(estimates.fast).toBeDefined()
    expect(estimates.fastest).toBeDefined()
    expect(estimates.average).toBeDefined()
  })

  it('should return estimated fees of a vault tx that are more expensive than a normal tx (in case of > MIN_TX_FEE only)', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const normalTx = await ltcClient.getFees()
    const vaultTx = await ltcClient.getFeesWithMemo(MEMO)

    if (vaultTx.average.amount().isGreaterThan(MIN_TX_FEE)) {
      expect(vaultTx.average.amount().isGreaterThan(normalTx.average.amount())).toBeTruthy()
    } else {
      expect(vaultTx.average.amount().isEqualTo(MIN_TX_FEE)).toBeTruthy()
    }

    if (vaultTx.fast.amount().isGreaterThan(MIN_TX_FEE)) {
      expect(vaultTx.fast.amount().isGreaterThan(normalTx.fast.amount())).toBeTruthy()
    } else {
      expect(vaultTx.fast.amount().isEqualTo(MIN_TX_FEE)).toBeTruthy()
    }

    if (vaultTx.fastest.amount().isGreaterThan(MIN_TX_FEE)) {
      expect(vaultTx.fastest.amount().isGreaterThan(normalTx.fastest.amount())).toBeTruthy()
    } else {
      expect(vaultTx.fastest.amount().isEqualTo(MIN_TX_FEE)).toBeTruthy()
    }
  })

  it('returns different fee rates for a normal tx', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const { fast, fastest, average } = await ltcClient.getFeeRates()
    expect(fast > average)
    expect(fastest > fast)
  })

  it('should error when an invalid address is used in getting balance', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const invalidAddress = 'error_address'
    const expectedError = 'Could not get balances for address error_address'
    return expect(ltcClient.getBalance(invalidAddress)).rejects.toThrow(expectedError)
  })

  it('should error when an invalid address is used in transfer', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const invalidAddress = 'error_address'

    const amount = baseAmount(99000)
    const expectedError = 'Invalid address'

    return expect(
      ltcClient.transfer({ asset: AssetLTC, recipient: invalidAddress, amount, feeRate: 1 }),
    ).rejects.toThrow(expectedError)
  })

  it('should get address transactions', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS)

    const txPages = await ltcClient.getTransactions({ address: addyThree, limit: 4 })

    expect(txPages.total).toEqual(1) //there is 1 tx in addyThree
    expect(txPages.txs[0].asset).toEqual(AssetLTC)
    expect(txPages.txs[0].date).toEqual(new Date('2021-01-29T03:36:36.000Z'))
    expect(txPages.txs[0].hash).toEqual('b0422e9a4222f0f2b030088ee5ccd33ac0d3c59e7178bf3f4626de71b0e376d3')
    expect(txPages.txs[0].type).toEqual('transfer')
    expect(txPages.txs[0].to.length).toEqual(2)
    expect(txPages.txs[0].from.length).toEqual(1)
  })

  it('should get address transactions with limit', async () => {
    const ltcClient = await Client.create(TESTNET_PARAMS)
    // Limit should work
    const txPages = await ltcClient.getTransactions({ address: addyThree, limit: 1 })
    return expect(txPages.total).toEqual(1) //there 1 tx in addyThree
  })

  it('should get transaction with hash', async () => {
    const hash = 'b0422e9a4222f0f2b030088ee5ccd33ac0d3c59e7178bf3f4626de71b0e376d3'
    const ltcClient = await Client.create(TESTNET_PARAMS)
    const txData = await ltcClient.getTransactionData(hash)

    expect(txData.hash).toEqual(hash)
    expect(txData.from.length).toEqual(1)
    expect(txData.from[0].from).toEqual(addyOne)
    expect(txData.from[0].amount.amount().isEqualTo(baseAmount(860368562, 8).amount())).toBeTruthy()

    expect(txData.to.length).toEqual(2)
    expect(txData.to[0].to).toEqual(addyThree)
    expect(txData.to[0].amount.amount().isEqualTo(baseAmount(2223, 8).amount())).toBeTruthy()
    expect(txData.to[1].to).toEqual(addyOne)
    expect(txData.to[1].amount.amount().isEqualTo(baseAmount(860365339, 8).amount())).toBeTruthy()
  })

  it('should return valid explorer url', async () => {
    let ltcClient = await Client.create(MAINNET_PARAMS)
    expect(ltcClient.getExplorerUrl()).toEqual('https://ltc.bitaps.com')

    ltcClient = await Client.create(TESTNET_PARAMS)
    expect(ltcClient.getExplorerUrl()).toEqual('https://tltc.bitaps.com')
  })

  it('should retrun valid explorer address url', async () => {
    let ltcClient = await Client.create(MAINNET_PARAMS)
    expect(ltcClient.getExplorerAddressUrl('testAddressHere')).toEqual('https://ltc.bitaps.com/testAddressHere')

    ltcClient = await Client.create(TESTNET_PARAMS)
    expect(ltcClient.getExplorerAddressUrl('anotherTestAddressHere')).toEqual(
      'https://tltc.bitaps.com/anotherTestAddressHere',
    )
  })

  it('should retrun valid explorer tx url', async () => {
    let ltcClient = await Client.create(MAINNET_PARAMS)
    expect(ltcClient.getExplorerTxUrl('testTxHere')).toEqual('https://ltc.bitaps.com/testTxHere')

    ltcClient = await Client.create(TESTNET_PARAMS)
    expect(ltcClient.getExplorerTxUrl('anotherTestTxHere')).toEqual('https://tltc.bitaps.com/anotherTestTxHere')
  })
})
