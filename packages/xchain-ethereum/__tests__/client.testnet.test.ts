import { TransactionResponse } from '@ethersproject/abstract-provider'
import { FeeOption } from '@xchainjs/xchain-client'
import { AssetETH, Chain, ETHChain, assetFromString, assetToString, baseAmount } from '@xchainjs/xchain-util'
import { BigNumber, Signer, providers } from 'ethers'
import nock from 'nock'

import { mock_all_api } from '../__mocks__'
import {
  mock_etherscan_eth_txs_api,
  mock_etherscan_token_txs_api,
  mock_gastracker_api,
} from '../__mocks__/etherscan-api'
import {
  mock_thornode_inbound_addresses_fail,
  mock_thornode_inbound_addresses_success,
} from '../__mocks__/thornode-api'
import { Client, MAINNET_PARAMS, TESTNET_PARAMS } from '../src/client'
import erc20ABI from '../src/data/erc20.json'
import { ETH_DECIMAL } from '../src/utils'
import { Wallet } from '../src/wallet'

const phrase = 'canyon throw labor waste awful century ugly they found post source draft'
const newPhrase = 'logic neutral rug brain pluck submit earth exit erode august remain ready'
const address = '0xb8c0c226d6fe17e5d9132741836c3ae82a5b6c4e'
const etherscanUrl = 'https://api-ropsten.etherscan.io'
const ropstenInfuraUrl = 'https://ropsten.infura.io/v3'
const ropstenAlchemyUrl = 'https://eth-ropsten.alchemyapi.io/v2'
const thornodeApiUrl = 'https://testnet.thornode.thorchain.info'

/**
 * Wallet Tests
 */
describe('Client Test', () => {
  beforeEach(async () => {
    nock.disableNetConnect()
  })

  afterEach(async () => {
    nock.cleanAll()
  })

  it('should throw error on bad phrase', async () => {
    await expect(Client.create(TESTNET_PARAMS, Wallet.create('bad bad phrase'))).rejects.toThrowError()
  })

  it('should create a wallet from phrase', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    expect(await ethClient.getSigner()).toBeInstanceOf(Signer)
  })

  it('should set new phrase', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    await expect(ethClient.unlock(Wallet.create(newPhrase))).resolves.not.toThrow()
  })

  it('should fail to set new phrase', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    await expect(ethClient.unlock(Wallet.create('bad bad phrase'))).rejects.toThrowError()
  })

  it('should connect to specified network', async () => {
    const ethClient = await Client.create(MAINNET_PARAMS, Wallet.create(phrase))

    expect(await ethClient.getSigner()).toBeInstanceOf(Signer)
    expect((await ethClient.getSigner()).provider).toBeInstanceOf(providers.FallbackProvider)
    const network = await (await ethClient.getSigner()).provider?.getNetwork()
    expect(network?.name).toEqual('homestead')
    expect(network?.chainId).toEqual(1)
  })

  it('should connect to Infura provider', async () => {
    const ethClient = await Client.create(
      {
        ...MAINNET_PARAMS,
        infuraCreds: {
          projectId: '',
          projectSecret: '',
        },
      },
      Wallet.create(phrase),
    )

    expect((await ethClient.getSigner()).provider).toBeInstanceOf(providers.InfuraProvider)
  })

  it('should set network', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    const network = await (await ethClient.getSigner()).provider?.getNetwork()
    expect(network?.name).toEqual('ropsten')
    expect(network?.chainId).toEqual(3)
  })

  it('should get address', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    expect(await ethClient.getAddress()).toEqual(address)
  })

  it('should get network', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    expect(ethClient.getNetwork()).toEqual('testnet')
  })

  it('should fail a bad address', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    expect(await ethClient.validateAddress('0xBADbadBad')).toBeFalsy()
  })

  it('should pass a good address', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    const goodAddress = await ethClient.validateAddress(address)
    expect(goodAddress).toBeTruthy()
  })

  it('throws error on bad index', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))
    await expect(ethClient.getAddress(-1)).rejects.toThrow()
  })

  it('estimateGasPrices', async () => {
    mock_thornode_inbound_addresses_success(
      thornodeApiUrl,
      require('../__mocks__/responses/inbound_addresses_testnet.json'),
    )

    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    const { fast, fastest, average } = await ethClient.estimateGasPrices()

    expect(fast.amount().toString()).toEqual('30000000000')
    expect(fastest.amount().toString()).toEqual('150000000000')
    expect(average.amount().toString()).toEqual('15000000000')
  })

  it('get eth transaction history', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    mock_etherscan_eth_txs_api(etherscanUrl, [
      {
        blockNumber: '7937085',
        timeStamp: '1611284369',
        hash: '0x40565f6d4cbe1c339decce9769fc94fcc868be98faba4429b79aa4ad2bb26ab4',
        from: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
        to: '0xb8c0c226d6fe17e5d9132741836c3ae82a5b6c4e',
        value: '150023345036431545',
        contractAddress: '',
        input: '',
        type: 'call',
        gas: '0',
        gasUsed: '0',
        traceId: '0_1',
        isError: '0',
        errCode: '',
      },
    ])

    const txHistory = await ethClient.getTransactions({
      address,
      limit: 1,
    })

    expect(txHistory.total).toEqual(1)
    expect(txHistory.txs[0].hash).toEqual('0x40565f6d4cbe1c339decce9769fc94fcc868be98faba4429b79aa4ad2bb26ab4')
    expect(assetToString(txHistory.txs[0].asset)).toEqual(assetToString(AssetETH))
    expect(txHistory.txs[0].from[0].from).toEqual('0x7a250d5630b4cf539739df2c5dacb4c659f2488d')
    expect(
      txHistory.txs[0].from[0].amount.amount().isEqualTo(baseAmount('150023345036431545', ETH_DECIMAL).amount()),
    ).toBeTruthy()
    expect(txHistory.txs[0].to[0].to).toEqual('0xb8c0c226d6fe17e5d9132741836c3ae82a5b6c4e')
    expect(
      txHistory.txs[0].to[0].amount.amount().isEqualTo(baseAmount('150023345036431545', ETH_DECIMAL).amount()),
    ).toBeTruthy()
    expect(txHistory.txs[0].type).toEqual('transfer')
  })

  it('get token transaction history', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    mock_etherscan_token_txs_api(etherscanUrl, [
      {
        blockNumber: '7937097',
        timeStamp: '1611284549',
        hash: '0x84f28d86da01417a35e448f62248b9dee40261be82496275495bb0f0de6c8a1e',
        nonce: '11',
        blockHash: '0x460e054d7420823b4d6110045593d33ec82a040df8f1e47371bf3a52ab54910a',
        from: '0xb8c0c226d6fe17e5d9132741836c3ae82a5b6c4e',
        contractAddress: '0x01be23585060835e02b77ef475b0cc51aa1e0709',
        to: '0x0d1e5112b7bf0595837f6e19a8233e8b918ef3aa',
        value: '200000000000000000000',
        tokenName: 'ChainLink Token',
        tokenSymbol: 'LINK',
        tokenDecimal: '18',
        transactionIndex: '3',
        gas: '219318',
        gasPrice: '1000000000',
        gasUsed: '188808',
        cumulativeGasUsed: '680846',
        input: 'deprecated',
        confirmations: '11597',
      },
    ])

    const txHistory = await ethClient.getTransactions({
      address,
      limit: 1,
      asset: '0x01be23585060835e02b77ef475b0cc51aa1e0709',
    })
    expect(txHistory.total).toEqual(1)
    expect(txHistory.txs[0].hash).toEqual('0x84f28d86da01417a35e448f62248b9dee40261be82496275495bb0f0de6c8a1e')
    expect(txHistory.txs[0].asset.symbol).toEqual('LINK-0x01be23585060835e02b77ef475b0cc51aa1e0709')
    expect(txHistory.txs[0].from[0].from).toEqual('0xb8c0c226d6fe17e5d9132741836c3ae82a5b6c4e')
    expect(
      txHistory.txs[0].from[0].amount.amount().isEqualTo(baseAmount('200000000000000000000', 18).amount()),
    ).toBeTruthy()
    expect(txHistory.txs[0].to[0].to).toEqual('0x0d1e5112b7bf0595837f6e19a8233e8b918ef3aa')
    expect(
      txHistory.txs[0].to[0].amount.amount().isEqualTo(baseAmount('200000000000000000000', 18).amount()),
    ).toBeTruthy()
    expect(txHistory.txs[0].type).toEqual('transfer')
  })

  it('get transaction data', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_blockNumber', '0x3c6de5')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_getTransactionCount', '0x10')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_gasPrice', '0xb2d05e00')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_estimateGas', '0x5208')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_getTransactionByHash', {
      blockHash: '0x460e054d7420823b4d6110045593d33ec82a040df8f1e47371bf3a52ab54910a',
      blockNumber: '0x791c49',
      from: '0xb8c0c226d6fe17e5d9132741836c3ae82a5b6c4e',
      gas: '0x358b6',
      gasPrice: '0x3b9aca00',
      hash: '0x84f28d86da01417a35e448f62248b9dee40261be82496275495bb0f0de6c8a1e',
      input:
        '0x38ed173900000000000000000000000000000000000000000000000ad78ebc5ac62000000000000000000000000000000000000000000000000000007abf2a9d39bcfaf800000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000b8c0c226d6fe17e5d9132741836c3ae82a5b6c4e00000000000000000000000000000000000000000000000000000000600a44c8000000000000000000000000000000000000000000000000000000000000000300000000000000000000000001be23585060835e02b77ef475b0cc51aa1e0709000000000000000000000000c778417e063141139fce010982780140aa0cd5ab0000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f984',
      nonce: '0xb',
      to: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
      transactionIndex: '0x3',
      value: '0x0',
      v: '0x2c',
      r: '0x933df8626f5d58ab156fee63948fc4a9caffbcbd583d8e813dacbac6ca016077',
      s: '0x1dd7659476b58823b4d23aca9a4a91e89c5840fe7e34c01c4e9a10c571c9ef44',
    })
    mock_etherscan_token_txs_api(etherscanUrl, [
      {
        blockNumber: '7937097',
        timeStamp: '1611284549',
        hash: '0x84f28d86da01417a35e448f62248b9dee40261be82496275495bb0f0de6c8a1e',
        nonce: '11',
        blockHash: '0x460e054d7420823b4d6110045593d33ec82a040df8f1e47371bf3a52ab54910a',
        from: '0xb8c0c226d6fe17e5d9132741836c3ae82a5b6c4e',
        contractAddress: '0x01be23585060835e02b77ef475b0cc51aa1e0709',
        to: '0x0d1e5112b7bf0595837f6e19a8233e8b918ef3aa',
        value: '200000000000000000000',
        tokenName: 'ChainLink Token',
        tokenSymbol: 'LINK',
        tokenDecimal: '18',
        transactionIndex: '3',
        gas: '219318',
        gasPrice: '1000000000',
        gasUsed: '188808',
        cumulativeGasUsed: '680846',
        input: 'deprecated',
        confirmations: '11597',
      },
    ])

    const txData = await ethClient.getTransactionData(
      '0x84f28d86da01417a35e448f62248b9dee40261be82496275495bb0f0de6c8a1e',
      '0x01be23585060835e02b77ef475b0cc51aa1e0709',
    )

    expect(txData.hash).toEqual('0x84f28d86da01417a35e448f62248b9dee40261be82496275495bb0f0de6c8a1e')
    expect(txData.asset.symbol).toEqual('LINK-0x01be23585060835e02b77ef475b0cc51aa1e0709')
    expect(txData.from[0].from).toEqual('0xb8c0c226d6fe17e5d9132741836c3ae82a5b6c4e')
    expect(txData.from[0].amount.amount().isEqualTo(baseAmount(200000000000000000000, 18).amount())).toBeTruthy()
    expect(txData.to[0].to).toEqual('0x0d1e5112b7bf0595837f6e19a8233e8b918ef3aa')
    expect(txData.to[0].amount.amount().isEqualTo(baseAmount(200000000000000000000, 18).amount())).toBeTruthy()
    expect(txData.type).toEqual('transfer')
  })

  it('ETH transfer', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_blockNumber', '0x3c6de5')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_getTransactionCount', '0x10')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_gasPrice', '0xb2d05e00')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_estimateGas', '0x5208')
    mock_all_api(
      etherscanUrl,
      ropstenInfuraUrl,
      ropstenAlchemyUrl,
      'eth_sendRawTransaction',
      '0x48f098a17fe33032668b3780090752473a9e2d9a432699962e40ffed736803d0',
    )
    mock_thornode_inbound_addresses_fail(thornodeApiUrl)
    mock_gastracker_api(etherscanUrl, 'gasoracle', {
      LastBlock: '11745402',
      SafeGasPrice: '51',
      ProposeGasPrice: '59',
      FastGasPrice: '76',
    })

    const gasFee = await ethClient.estimateFeesWithGasPricesAndLimits({
      recipient: '0x8ced5ad0d8da4ec211c17355ed3dbfec4cf0e5b9',
      amount: baseAmount(1000001, ETH_DECIMAL),
    })
    const txResult = await ethClient.transfer({
      recipient: '0x8ced5ad0d8da4ec211c17355ed3dbfec4cf0e5b9',
      amount: baseAmount(1000001, ETH_DECIMAL),
      gasLimit: gasFee.gasLimit,
      gasPrice: gasFee.gasPrices.fastest,
    })
    expect(txResult).toEqual('0x48f098a17fe33032668b3780090752473a9e2d9a432699962e40ffed736803d0')
  })

  it('ERC20 transfer', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_blockNumber', '0x3c6de5')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_getTransactionCount', '0x10')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_gasPrice', '0xb2d05e00')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_estimateGas', '0x5208')
    mock_all_api(
      etherscanUrl,
      ropstenInfuraUrl,
      ropstenAlchemyUrl,
      'eth_call',
      '0x0000000000000000000000000000000000000000000000000000000000000064',
    )
    mock_all_api(
      etherscanUrl,
      ropstenInfuraUrl,
      ropstenAlchemyUrl,
      'eth_sendRawTransaction',
      '0xc24aafc2d180370610aedecf0c7de939ad9c2a2c0c0a810eae5f3b69362022c3',
    )
    mock_thornode_inbound_addresses_success(thornodeApiUrl, [
      {
        chain: 'ETH' as Chain,
        pub_key: 'tthorpub1addwnpepqfz98sx54jpv3f95qfg39zkx500avc6tr0d8ww0lv283yu3ucgq3g9y9njj',
        address: '0x8d1133a8cf23112fdb21f1efca340d727a98196e',
        router: '0xe0a63488e677151844e70623533c22007dc57c9e',
        halted: false,
        gas_rate: '30',
      },
      {
        chain: 'LTC' as Chain,
        pub_key: 'tthorpub1addwnpepqfz98sx54jpv3f95qfg39zkx500avc6tr0d8ww0lv283yu3ucgq3g9y9njj',
        address: 'tltc1q3x76wl4gmwu4yzx682r30ej0a8e2tttaw6pv7u',
        halted: false,
        gas_rate: '49',
      },
    ])

    const gasFee = await ethClient.estimateFeesWithGasPricesAndLimits({
      recipient: '0x8c2a90d36ec9f745c9b28b588cba5e2a978a1656',
      amount: baseAmount('10000000000000', ETH_DECIMAL),
      asset: assetFromString(`${ETHChain}.DAI-0xc7ad46e0b8a400bb3c915120d284aafba8fc4735`) || undefined,
    })
    const txHash = await ethClient.transfer({
      recipient: '0x8c2a90d36ec9f745c9b28b588cba5e2a978a1656',
      amount: baseAmount('10000000000000', ETH_DECIMAL),
      asset: assetFromString(`${ETHChain}.DAI-0xc7ad46e0b8a400bb3c915120d284aafba8fc4735`) || undefined,
      gasLimit: gasFee.gasLimit,
      gasPrice: gasFee.gasPrices.fastest,
    })
    expect(txHash).toEqual('0xc24aafc2d180370610aedecf0c7de939ad9c2a2c0c0a810eae5f3b69362022c3')
  })

  it('estimate gas for eth transfer', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_blockNumber', '0x3c6de5')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_getTransactionCount', '0x10')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_gasPrice', '0xb2d05e00')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_estimateGas', '0x5208')
    mock_thornode_inbound_addresses_fail(thornodeApiUrl)
    mock_gastracker_api(etherscanUrl, 'gasoracle', {
      LastBlock: '11745402',
      SafeGasPrice: '51',
      ProposeGasPrice: '59',
      FastGasPrice: '76',
    })
    mock_all_api(
      etherscanUrl,
      ropstenInfuraUrl,
      ropstenAlchemyUrl,
      'eth_sendRawTransaction',
      '0xcd0e007a6f81120d45478e3eef07c017ec104d4a2a5f1bff23cf0837ba3aab28',
    )

    const gasEstimate = await ethClient.estimateFeesWithGasPricesAndLimits({
      recipient: '0x2fe25ca708fc485cf356b2f27399247d91c6edbd',
      amount: baseAmount(1, ETH_DECIMAL),
    })

    expect(gasEstimate.fees.average.amount().toString()).toEqual(baseAmount('1071000000000000', 18).amount().toString())
    expect(gasEstimate.fees.fast.amount().toString()).toEqual(baseAmount('1239000000000000', 18).amount().toString())
    expect(gasEstimate.fees.fastest.amount().toString()).toEqual(baseAmount('1596000000000000', 18).amount().toString())
  })

  it('estimate gas for erc20 transfer', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_blockNumber', '0x3c6de5')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_getTransactionCount', '0x10')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_gasPrice', '0xb2d05e00')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_estimateGas', '0x5208')
    mock_thornode_inbound_addresses_fail(thornodeApiUrl)
    mock_gastracker_api(etherscanUrl, 'gasoracle', {
      LastBlock: '11745402',
      SafeGasPrice: '51',
      ProposeGasPrice: '59',
      FastGasPrice: '76',
    })
    mock_all_api(
      etherscanUrl,
      ropstenInfuraUrl,
      ropstenAlchemyUrl,
      'eth_sendRawTransaction',
      '0xea328780f0558b0bbf34baa142703957122678f5a5b9a0696102cff41a5d2682',
    )

    const gasEstimate = await ethClient.estimateFeesWithGasPricesAndLimits({
      asset: assetFromString(`${ETHChain}.DAI-0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa`) || undefined,
      recipient: '0x2fe25ca708fc485cf356b2f27399247d91c6edbd',
      amount: baseAmount(1, ETH_DECIMAL),
    })

    expect(gasEstimate.fees.average.amount().toString()).toEqual(baseAmount('1071000000000000', 18).amount().toString())
    expect(gasEstimate.fees.fast.amount().toString()).toEqual(baseAmount('1239000000000000', 18).amount().toString())
    expect(gasEstimate.fees.fastest.amount().toString()).toEqual(baseAmount('1596000000000000', 18).amount().toString())
  })

  it('isApproved', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_blockNumber', '0x3c6de5')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_getTransactionCount', '0x10')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_gasPrice', '0xb2d05e00')
    mock_all_api(
      etherscanUrl,
      ropstenInfuraUrl,
      ropstenAlchemyUrl,
      'eth_call',
      '0x0000000000000000000000000000000000000000000000000000000000000064',
    )

    let isApproved = await ethClient.isApproved({
      contractAddress: '0x8c2a90d36ec9f745c9b28b588cba5e2a978a1656',
      spenderAddress: '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa',
      amount: baseAmount(100, ETH_DECIMAL),
    })
    expect(isApproved).toEqual(true)

    isApproved = await ethClient.isApproved({
      contractAddress: '0x8c2a90d36ec9f745c9b28b588cba5e2a978a1656',
      spenderAddress: '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa',
      amount: baseAmount(101, ETH_DECIMAL),
    })
    expect(isApproved).toEqual(false)
  })

  it('estimateApprove', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_blockNumber', '0x3c6de5')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_getTransactionCount', '0x10')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_gasPrice', '0xb2d05e00')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_estimateGas', '0x5208')

    const gasLimit = await ethClient.estimateApprove({
      contractAddress: '0x8c2a90d36ec9f745c9b28b588cba5e2a978a1656',
      spenderAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      amount: baseAmount(100, ETH_DECIMAL),
    })
    expect(gasLimit.eq(21000)).toBeTruthy()
  })

  it('approve', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_blockNumber', '0x3c6de5')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_getTransactionCount', '0x10')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_gasPrice', '0xb2d05e00')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_estimateGas', '0x5208')
    mock_all_api(
      etherscanUrl,
      ropstenInfuraUrl,
      ropstenAlchemyUrl,
      'eth_sendRawTransaction',
      '0x168ecebeeca0cd33d7151fa334cf8279ccacb58e855ede8276dfe6f77cafd55c',
    )

    const tx = await ethClient.approve({
      walletIndex: 0,
      contractAddress: '0xd15ffaef3112460bf3bcd81087fcbbce394e2ae7',
      spenderAddress: '0x8c2a90d36ec9f745c9b28b588cba5e2a978a1656',
      feeOptionKey: 'fastest' as FeeOption,
      amount: baseAmount(100, ETH_DECIMAL),
    })
    expect(tx.hash).toEqual('0x168ecebeeca0cd33d7151fa334cf8279ccacb58e855ede8276dfe6f77cafd55c')
  })

  it('estimate call', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_blockNumber', '0x3c6de5')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_getTransactionCount', '0x10')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_gasPrice', '0xb2d05e00')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_estimateGas', '0x5208')

    const gasLimit = await ethClient.estimateCall({
      contractAddress: '0xd15ffaef3112460bf3bcd81087fcbbce394e2ae7',
      abi: erc20ABI,
      funcName: 'transfer',
      funcParams: [
        '0x8c2a90d36ec9f745c9b28b588cba5e2a978a1656',
        BigNumber.from(baseAmount('10000000000000', ETH_DECIMAL).amount().toString()),
        {
          from: ethClient.getAddress(),
        },
      ],
    })

    expect(gasLimit.toString()).toEqual('21000')
  })

  it('call', async () => {
    const ethClient = await Client.create(TESTNET_PARAMS, Wallet.create(phrase))

    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_blockNumber', '0x3c6de5')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_getTransactionCount', '0x10')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_gasPrice', '0xb2d05e00')
    mock_all_api(etherscanUrl, ropstenInfuraUrl, ropstenAlchemyUrl, 'eth_estimateGas', '0x5208')
    mock_all_api(
      etherscanUrl,
      ropstenInfuraUrl,
      ropstenAlchemyUrl,
      'eth_call',
      '0x0000000000000000000000000000000000000000000000000000000000000064',
    )
    mock_all_api(
      etherscanUrl,
      ropstenInfuraUrl,
      ropstenAlchemyUrl,
      'eth_sendRawTransaction',
      '0xdb8fa5020096459950024d4c0635d91754cb6c6623d23d95bdce7e9308c975df',
    )
    mock_thornode_inbound_addresses_success(thornodeApiUrl, [
      {
        chain: 'ETH' as Chain,
        pub_key: 'tthorpub1addwnpepqfz98sx54jpv3f95qfg39zkx500avc6tr0d8ww0lv283yu3ucgq3g9y9njj',
        address: '0x8d1133a8cf23112fdb21f1efca340d727a98196e',
        router: '0xe0a63488e677151844e70623533c22007dc57c9e',
        halted: false,
        gas_rate: '51',
      },
      {
        chain: 'LTC' as Chain,
        pub_key: 'tthorpub1addwnpepqfz98sx54jpv3f95qfg39zkx500avc6tr0d8ww0lv283yu3ucgq3g9y9njj',
        address: 'tltc1q3x76wl4gmwu4yzx682r30ej0a8e2tttaw6pv7u',
        halted: false,
        gas_rate: '49',
      },
    ])

    const prices = await ethClient.estimateGasPrices()

    const txResult = await ethClient.call<TransactionResponse>({
      walletIndex: 0,
      contractAddress: '0xd15ffaef3112460bf3bcd81087fcbbce394e2ae7',
      abi: erc20ABI,
      funcName: 'transfer',
      funcParams: [
        '0x8c2a90d36ec9f745c9b28b588cba5e2a978a1656',
        BigNumber.from(baseAmount('10000000000000', ETH_DECIMAL).amount().toString()),
        // Here the tx overrides
        {
          from: ethClient.getAddress(),
          gasPrice: BigNumber.from(prices.average.amount().toString()),
        },
      ],
    })

    expect(txResult.hash).toEqual('0xdb8fa5020096459950024d4c0635d91754cb6c6623d23d95bdce7e9308c975df')
  })
})
