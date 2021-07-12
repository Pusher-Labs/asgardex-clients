import { AssetBTC, baseAmount } from '@xchainjs/xchain-util'

import mockSochainApi from '../__mocks__/sochain'
import { Client, MAINNET_PARAMS, TESTNET_PARAMS } from '../src/client'
import { MIN_TX_FEE } from '../src/const'
import { Wallet } from '../src/wallet'

mockSochainApi.init()

describe('BitcoinClient Test', () => {
  const MEMO = 'SWAP:THOR.RUNE'
  // please don't touch the tBTC in these
  const phraseOne = 'atom green various power must another rent imitate gadget creek fat then'
  // https://iancoleman.io/bip39/
  // Select BTC - Bitcoin Testnet; BIP84
  // m/84'/1'/0'/0/0
  const addyOnePath0 = 'tb1q2pkall6rf6v6j0cvpady05xhy37erndvku08wp'
  // m/84'/1'/0'/0/1
  const addyOnePath1 = 'tb1qut59ufcscqnkp8fgac68pj2ps5dzjjg4qq2hsy'
  const addyTwo = 'tb1qz8q2lwfmp965cszdd5raq9m7gljs57hkzpw56d'

  const phraseOneMainnet_path0 = 'bc1qvdux5606j2zh5f4724wvnywe6gcj2tcrzz7wdl'
  const phraseOneMainnet_path1 = 'bc1qnnkssp3sgfjjk2m0z9thjay0psp6ehlt6dzd97'

  // Third ones is used only for balance verification
  const phraseTwo = 'quantum vehicle print stairs canvas kid erode grass baby orbit lake remove'
  // m/84'/1'/0'/0/0
  const addyThreePath0 = 'tb1q04y2lnt0ausy07vq9dg5w2rnn9yjl3rzgjhra4'
  // m/84'/1'/0'/0/1
  const addyThreePath1 = 'tb1q99peqcxyhu4f2fehxxn6k5v704qe84y0nkcl5t'

  const phraseTwoMainnet_path0 = 'bc1qsn4ujsja3ukdlzjmc9tcgpeaxeauq0ga83xmds'
  const phraseTwoMainnet_path1 = 'bc1q7c58pf87g73pk07ryq996jfa5nqkx2ppzjz8kq'

  it('set phrase should return correct address', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const result = await btcClient.getAddress()
    expect(result).toEqual(addyOnePath0)
  })

  it('should throw an error for setting a bad phrase', async () => {
    await expect(Client.create(MAINNET_PARAMS, Wallet.create('cat'))).rejects.toThrow()
  })

  it('should not throw an error for setting a good phrase', async () => {
    await expect(Client.create(MAINNET_PARAMS, Wallet.create(phraseOne))).resolves.not.toThrow()
  })

  it('should validate the right address', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const address = await btcClient.getAddress()
    const valid = await btcClient.validateAddress(address)
    expect(address).toEqual(addyOnePath0)
    expect(valid).toBeTruthy()
  })

  it('should get the right balance', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseTwo))
    const expectedBalance = 15446
    const balance = await btcClient.getBalance(await btcClient.getAddress())
    expect(balance.length).toEqual(1)
    expect(balance[0].amount.amount().toNumber()).toEqual(expectedBalance)
  })

  it('should broadcast a normal transfer', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const amount = baseAmount(2223)
    const txid = await btcClient.transfer({ walletIndex: 0, asset: AssetBTC, recipient: addyTwo, amount, feeRate: 1 })
    expect(txid).toEqual(expect.any(String))
  })

  it('should broadcast a normal transfer without feeRate option', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const amount = baseAmount(2223)
    const txid = await btcClient.transfer({ walletIndex: 0, asset: AssetBTC, recipient: addyTwo, amount })
    expect(txid).toEqual(expect.any(String))
  })

  it('should do broadcast a vault transfer with a memo', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))

    /**
     * All UTXO values: 8800 + 495777 + 15073
     * Confirmed UTXO values: 8800 + 15073 = 23873
     * Spend amount: 2223
     * Expected: Successful
     */

    const amount = baseAmount(2223)
    const txid = await btcClient.transfer({
      walletIndex: 0,
      asset: AssetBTC,
      recipient: addyThreePath0,
      amount,
      memo: MEMO,
      feeRate: 1,
    })
    expect(txid).toEqual(expect.any(String))
  })
  it('should prevent spending unconfirmed utxo if memo exists', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))

    /**
     * All UTXO values: 8800 + 495777 + 15073
     * Confirmed UTXO values: 8800 + 15073 = 23873
     * Spend amount: 25000
     * Expected: Insufficient Balance
     */

    const amount = baseAmount(25000)
    await expect(
      btcClient.transfer({
        walletIndex: 0,
        asset: AssetBTC,
        recipient: addyThreePath0,
        amount,
        memo: MEMO,
        feeRate: 1,
      }),
    ).rejects.toThrow('Insufficient Balance for transaction')
  })

  it('should prevent a tx when fees and valueOut exceed balance', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))

    const asset = AssetBTC
    const amount = baseAmount(9999999999)
    return expect(
      btcClient.transfer({ walletIndex: 0, asset, recipient: addyTwo, amount, feeRate: 1 }),
    ).rejects.toThrow('Insufficient Balance for transaction')
  })

  it('returns fees and rates of a normal tx', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const { fees, rates } = await btcClient.getFeesWithRates()
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
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const { fees, rates } = await btcClient.getFeesWithRates(MEMO)
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
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const estimates = await btcClient.getFees()
    expect(estimates.fast).toBeDefined()
    expect(estimates.fastest).toBeDefined()
    expect(estimates.average).toBeDefined()
  })

  it('should return estimated fees of a vault tx that are more expensive than a normal tx (in case of > MIN_TX_FEE only)', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const normalTx = await btcClient.getFees()
    const vaultTx = await btcClient.getFeesWithMemo(MEMO)

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
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const { fast, fastest, average } = await btcClient.getFeeRates()
    expect(fast > average)
    expect(fastest > fast)
  })

  it('should error when an invalid address is used in getting balance', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const invalidIndex = -1
    const expectedError = 'index must be a non-negative integer'
    await expect(btcClient.getAddress(invalidIndex)).rejects.toThrow(expectedError)
  })

  it('should error when an invalid address is used in transfer', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const invalidAddress = 'error_address'

    const amount = baseAmount(99000)
    const expectedError = 'Invalid address'

    return expect(
      btcClient.transfer({ walletIndex: 0, asset: AssetBTC, recipient: invalidAddress, amount, feeRate: 1 }),
    ).rejects.toThrow(expectedError)
  })

  it('should get address transactions', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))

    const txPages = await btcClient.getTransactions({ address: addyThreePath0, limit: 4 })

    expect(txPages.total).toEqual(1) //there is 1 tx in addyThreePath0
    expect(txPages.txs[0].asset).toEqual(AssetBTC)
    expect(txPages.txs[0].date).toEqual(new Date('2020-12-13T11:39:55.000Z'))
    expect(txPages.txs[0].hash).toEqual('6e7071a09e82d72c6c84d253047c38dbd7fea531b93155adfe10acfba41bca63')
    expect(txPages.txs[0].type).toEqual('transfer')
    expect(txPages.txs[0].to.length).toEqual(2)
    expect(txPages.txs[0].from.length).toEqual(1)
  })

  it('should get address transactions with limit', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))

    // Limit should work
    const txPages = await btcClient.getTransactions({ address: addyThreePath0, limit: 1 })
    return expect(txPages.total).toEqual(1) //there 1 tx in addyThreePath0
  })

  it('should get transaction with hash', async () => {
    const btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    const txData = await btcClient.getTransactionData(
      'b660ee07167cfa32681e2623f3a29dc64a089cabd9a3a07dd17f9028ac956eb8',
    )

    expect(txData.hash).toEqual('b660ee07167cfa32681e2623f3a29dc64a089cabd9a3a07dd17f9028ac956eb8')
    expect(txData.from.length).toEqual(1)
    expect(txData.from[0].from).toEqual('2N4nhhJpjauDekVUVgA1T51M5gVg4vzLzNC')
    expect(txData.from[0].amount.amount().isEqualTo(baseAmount(8898697, 8).amount())).toBeTruthy()

    expect(txData.to.length).toEqual(2)
    expect(txData.to[0].to).toEqual('tb1q3a00snh7erczk94k48fe9q5z0fldgnh4twsh29')
    expect(txData.to[0].amount.amount().isEqualTo(baseAmount(100000, 8).amount())).toBeTruthy()
    expect(txData.to[1].to).toEqual('tb1qxx4azx0lw4tc6ylurc55ak5hl7u2ws0w9kw9h3')
    expect(txData.to[1].amount.amount().isEqualTo(baseAmount(8798533, 8).amount())).toBeTruthy()
  })

  it('should return valid explorer url', async () => {
    let btcClient = await Client.create(MAINNET_PARAMS, Wallet.create(phraseOne))
    expect(btcClient.getExplorerUrl()).toEqual('https://blockstream.info')

    btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    expect(btcClient.getExplorerUrl()).toEqual('https://blockstream.info/testnet')
  })

  it('should retrun valid explorer address url', async () => {
    let btcClient = await Client.create(MAINNET_PARAMS, Wallet.create(phraseOne))
    expect(btcClient.getExplorerAddressUrl('testAddressHere')).toEqual(
      'https://blockstream.info/address/testAddressHere',
    )
    btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    expect(btcClient.getExplorerAddressUrl('anotherTestAddressHere')).toEqual(
      'https://blockstream.info/testnet/address/anotherTestAddressHere',
    )
  })

  it('should retrun valid explorer tx url', async () => {
    let btcClient = await Client.create(MAINNET_PARAMS, Wallet.create(phraseOne))
    expect(btcClient.getExplorerTxUrl('testTxHere')).toEqual('https://blockstream.info/tx/testTxHere')
    btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    expect(btcClient.getExplorerTxUrl('anotherTestTxHere')).toEqual(
      'https://blockstream.info/testnet/tx/anotherTestTxHere',
    )
  })

  it('should derivate the address correctly', async () => {
    let btcClient = await Client.create(MAINNET_PARAMS, Wallet.create(phraseOne))
    expect(await btcClient.getAddress(0)).toEqual(phraseOneMainnet_path0)
    expect(await btcClient.getAddress(1)).toEqual(phraseOneMainnet_path1)

    btcClient = await Client.create(MAINNET_PARAMS, Wallet.create(phraseTwo))
    expect(await btcClient.getAddress(0)).toEqual(phraseTwoMainnet_path0)
    expect(await btcClient.getAddress(1)).toEqual(phraseTwoMainnet_path1)

    btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseOne))
    expect(await btcClient.getAddress(0)).toEqual(addyOnePath0)
    expect(await btcClient.getAddress(1)).toEqual(addyOnePath1)

    btcClient = await Client.create(TESTNET_PARAMS, Wallet.create(phraseTwo))
    expect(await btcClient.getAddress(0)).toEqual(addyThreePath0)
    expect(await btcClient.getAddress(1)).toEqual(addyThreePath1)
  })
})
