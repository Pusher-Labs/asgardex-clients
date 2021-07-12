import { Network } from '@xchainjs/xchain-client'
import { AssetETH, ETHChain, assetToString, baseAmount } from '@xchainjs/xchain-util'
import { ethers } from 'ethers'
import nock from 'nock'

import { mock_etherscan_api } from '../__mocks__/etherscan-api'
import { EthNetwork } from '../src/types'
import {
  ETH_DECIMAL,
  ethNetworkToXchains,
  filterSelfTxs,
  getDecimal,
  getDefaultFees,
  getTokenAddress,
  getTokenBalances,
  getTxFromEthTransaction,
  getTxFromEthplorerEthTransaction,
  getTxFromEthplorerTokenOperation,
  getTxFromTokenTransaction,
  validateAddress,
  validateSymbol,
  xchainNetworkToEths,
} from '../src/utils'

describe('ethereum/util', () => {
  describe('xchainNetworkToEths', () => {
    it('should return mainnet ', () => {
      expect(xchainNetworkToEths('mainnet' as Network)).toEqual(EthNetwork.Main)
    })
    it('should return testnet ', () => {
      expect(xchainNetworkToEths('testnet' as Network)).toEqual(EthNetwork.Test)
    })
  })

  describe('ethNetworkToXchains', () => {
    it('should return mainnet ', () => {
      expect(ethNetworkToXchains(EthNetwork.Main)).toEqual('mainnet' as Network)
    })
    it('should return testnet ', () => {
      expect(ethNetworkToXchains(EthNetwork.Test)).toEqual('testnet' as Network)
    })
  })

  describe('validateAddress', () => {
    it('should return true for valid address ', () => {
      expect(validateAddress('0x8d8ac01b3508ca869cb631bb2977202fbb574a0d')).toEqual(true)
    })
    it('should return false for invalid address ', () => {
      expect(validateAddress('invalid')).toEqual(false)
    })
  })

  describe('getTokenAddress', () => {
    it('should return the token address ', () => {
      const tokenAddress1 = getTokenAddress({
        chain: ETHChain,
        symbol: 'USDT-0X4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa',
        ticker: 'USDT',
      })
      expect(tokenAddress1).toEqual('0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa')

      const tokenAddress2 = getTokenAddress({
        chain: ETHChain,
        symbol: 'USDT-0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa',
        ticker: 'USDT',
      })
      expect(tokenAddress2).toEqual('0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa')
    })
    it('should return null ', () => {
      const tokenAddress = getTokenAddress({
        chain: ETHChain,
        symbol: 'ETH',
        ticker: 'ETH',
      })
      expect(tokenAddress).toBeNull()
    })
  })

  describe('validateSymbol', () => {
    it('should return true for valid symbol ', () => {
      expect(validateSymbol('USDT')).toEqual(true)
    })
    it('should return false for invalid symbol ', () => {
      expect(validateSymbol('')).toEqual(false)
    })
  })

  describe('getDefaultFees', () => {
    it('should return the default fee ', () => {
      const defaultFee = getDefaultFees()
      expect(defaultFee.type).toEqual('byte')
      expect(defaultFee.average.amount().isEqualTo(baseAmount('1050000000000000', ETH_DECIMAL).amount())).toBeTruthy()
      expect(defaultFee.fast.amount().isEqualTo(baseAmount('2100000000000000', ETH_DECIMAL).amount())).toBeTruthy()
      expect(defaultFee.fastest.amount().isEqualTo(baseAmount('3150000000000000', ETH_DECIMAL).amount())).toBeTruthy()
    })
  })

  describe('getTxFromTokenTransaction', () => {
    it('should return the parsed transaction ', () => {
      const tx = getTxFromTokenTransaction({
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
      })

      expect(tx).toBeTruthy()

      if (tx) {
        expect(tx.hash).toEqual('0x84f28d86da01417a35e448f62248b9dee40261be82496275495bb0f0de6c8a1e')
        expect(tx.asset.symbol).toEqual('LINK-0x01be23585060835e02b77ef475b0cc51aa1e0709')
        expect(tx.from[0].from).toEqual('0xb8c0c226d6fe17e5d9132741836c3ae82a5b6c4e')
        expect(tx.from[0].amount.amount().isEqualTo(baseAmount('200000000000000000000', 18).amount())).toBeTruthy()
        expect(tx.to[0].to).toEqual('0x0d1e5112b7bf0595837f6e19a8233e8b918ef3aa')
        expect(tx.to[0].amount.amount().isEqualTo(baseAmount('200000000000000000000', 18).amount())).toBeTruthy()
        expect(tx.type).toEqual('transfer')
      }
    })
    it('should return null for invalid symbol/address ', () => {
      const tx = getTxFromTokenTransaction({
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
        tokenSymbol: '',
        tokenDecimal: '18',
        transactionIndex: '3',
        gas: '219318',
        gasPrice: '1000000000',
        gasUsed: '188808',
        cumulativeGasUsed: '680846',
        input: 'deprecated',
        confirmations: '11597',
      })

      expect(tx).toBeNull()
    })
  })

  describe('getTxFromEthTransaction', () => {
    it('should return the parsed transaction ', () => {
      const tx = getTxFromEthTransaction({
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
      })

      expect(tx.hash).toEqual('0x40565f6d4cbe1c339decce9769fc94fcc868be98faba4429b79aa4ad2bb26ab4')
      expect(assetToString(tx.asset)).toEqual(assetToString(AssetETH))
      expect(tx.from[0].from).toEqual('0x7a250d5630b4cf539739df2c5dacb4c659f2488d')
      expect(tx.from[0].amount.amount().isEqualTo(baseAmount('150023345036431545', ETH_DECIMAL).amount())).toBeTruthy()
      expect(tx.to[0].to).toEqual('0xb8c0c226d6fe17e5d9132741836c3ae82a5b6c4e')
      expect(tx.to[0].amount.amount().isEqualTo(baseAmount('150023345036431545', ETH_DECIMAL).amount())).toBeTruthy()
      expect(tx.type).toEqual('transfer')
    })
  })

  describe('getTxFromEthplorerEthTransaction', () => {
    it('should return the parsed transaction ', () => {
      const tx = getTxFromEthplorerEthTransaction({
        hash: '0x9a5a33ba8d305d1374a6bc1a6f8f0d177302adc83670a046637ece987ac4eae2',
        timestamp: 1600708720,
        blockNumber: 10907123,
        confirmations: 1272745,
        success: true,
        from: '0xd551234ae421e3bcba99a0da6d736074f22192ff',
        to: '0x5cb8245d6543d234d3ca146880366f4fd46801e7',
        value: 0.5,
        input: '0x',
        gasLimit: 21000,
        gasUsed: 21000,
        logs: [],
      })

      expect(tx.hash).toEqual('0x9a5a33ba8d305d1374a6bc1a6f8f0d177302adc83670a046637ece987ac4eae2')
      expect(assetToString(tx.asset)).toEqual(assetToString(AssetETH))
      expect(tx.from[0].from).toEqual('0xd551234ae421e3bcba99a0da6d736074f22192ff')
      expect(tx.from[0].amount.amount().isEqualTo(baseAmount('500000000000000000', ETH_DECIMAL).amount())).toBeTruthy()
      expect(tx.to[0].to).toEqual('0x5cb8245d6543d234d3ca146880366f4fd46801e7')
      expect(tx.to[0].amount.amount().isEqualTo(baseAmount('500000000000000000', ETH_DECIMAL).amount())).toBeTruthy()
      expect(tx.type).toEqual('transfer')
    })
  })

  describe('getTxFromEthplorerTokenOperation', () => {
    it('should return the parsed transaction ', () => {
      const tx = getTxFromEthplorerTokenOperation({
        timestamp: 1481694781,
        transactionHash: '0x6aa670c983425eba23314459c48ae89b3b8d0e1089397c56400ce2da5ece9d26',
        value: '50000',
        intValue: 50000,
        type: 'transfer',
        priority: 3,
        from: '0x0347c7fe704384c7e32073d35b7661788e7071ff',
        to: '0x06758b9a8a7970e59f7e6487f80f4cb1069df878',
        addresses: ['0x0347c7fe704384c7e32073d35b7661788e7071ff', '0x06758b9a8a7970e59f7e6487f80f4cb1069df878'],
        isEth: false,
        usdPrice: 0.028043505572805424,
        tokenInfo: {
          address: '0xff71cb760666ab06aa73f34995b42dd4b85ea07b',
          name: 'THBEX',
          decimals: '4',
          symbol: 'THBEX',
          totalSupply: '9020000000',
          owner: '0x2cfc4e293e82d48a2c04bf89baaa98572c01c172',
          lastUpdated: 1575974898,
          issuancesCount: 4,
          holdersCount: 208,
          image: '/images/everex.png',
          description:
            "THBEX is the original test version of electronic digital currency (eTHB) that represents one unit of the Thailand national currency, Baht (THB). THBEX is issued on Ethereum blockchain in the form of ERC20 digital token and governed by secured smart contract.\r\n\r\nTHBEX has indefinite pegged exchange rate of 1:1 to THB.\r\n\r\nTHBEX is underwritten by licensed financial institutions in Thailand and is guaranteed 100% by physical currency reserves, surety bonds, or the underwriters' own capital.\r\n\r\nFinancial guarantee and proof of funds documentation is available in specific issuance records.",
          website: 'https://everex.io',
          ethTransfersCount: 0,
          price: {
            rate: 0.03185727938834024,
            diff: -0.0001018129734366921,
            ts: 1617627907,
            onlyPrice: 1,
            currency: 'USD',
          },
          publicTags: ['Stablecoins'],
        },
      })

      expect(tx).toBeTruthy()

      if (tx) {
        expect(tx.hash).toEqual('0x6aa670c983425eba23314459c48ae89b3b8d0e1089397c56400ce2da5ece9d26')
        expect(tx.asset.symbol).toEqual('THBEX-0xff71cb760666ab06aa73f34995b42dd4b85ea07b')
        expect(tx.from[0].from).toEqual('0x0347c7fe704384c7e32073d35b7661788e7071ff')
        expect(tx.from[0].amount.amount().isEqualTo(baseAmount('50000', 18).amount())).toBeTruthy()
        expect(tx.to[0].to).toEqual('0x06758b9a8a7970e59f7e6487f80f4cb1069df878')
        expect(tx.to[0].amount.amount().isEqualTo(baseAmount('50000', 18).amount())).toBeTruthy()
        expect(tx.type).toEqual('transfer')
      }
    })
    it('should return null for invalid symbol/address ', () => {
      const tx = getTxFromEthplorerTokenOperation({
        timestamp: 1481694781,
        transactionHash: '0x6aa670c983425eba23314459c48ae89b3b8d0e1089397c56400ce2da5ece9d26',
        value: '50000',
        intValue: 50000,
        type: 'transfer',
        priority: 3,
        from: '0x0347c7fe704384c7e32073d35b7661788e7071ff',
        to: '0x06758b9a8a7970e59f7e6487f80f4cb1069df878',
        addresses: ['0x0347c7fe704384c7e32073d35b7661788e7071ff', '0x06758b9a8a7970e59f7e6487f80f4cb1069df878'],
        isEth: false,
        usdPrice: 0.028043505572805424,
        tokenInfo: {
          address: '0xff71cb760666ab06aa73f34995b42dd4b85ea07b',
          name: 'THBEX',
          decimals: '4',
          symbol: '',
          totalSupply: '9020000000',
          owner: '0x2cfc4e293e82d48a2c04bf89baaa98572c01c172',
          lastUpdated: 1575974898,
          issuancesCount: 4,
          holdersCount: 208,
          image: '/images/everex.png',
          description:
            "THBEX is the original test version of electronic digital currency (eTHB) that represents one unit of the Thailand national currency, Baht (THB). THBEX is issued on Ethereum blockchain in the form of ERC20 digital token and governed by secured smart contract.\r\n\r\nTHBEX has indefinite pegged exchange rate of 1:1 to THB.\r\n\r\nTHBEX is underwritten by licensed financial institutions in Thailand and is guaranteed 100% by physical currency reserves, surety bonds, or the underwriters' own capital.\r\n\r\nFinancial guarantee and proof of funds documentation is available in specific issuance records.",
          website: 'https://everex.io',
          ethTransfersCount: 0,
          price: {
            rate: 0.03185727938834024,
            diff: -0.0001018129734366921,
            ts: 1617627907,
            onlyPrice: 1,
            currency: 'USD',
          },
          publicTags: ['Stablecoins'],
        },
      })

      expect(tx).toBeNull()
    })
  })

  describe('getTokenBalances', () => {
    it('Should parst token balances', () => {
      const balances = getTokenBalances([
        {
          tokenInfo: {
            address: '0x98976a6dfaaf97b16a4bb06035cc84be12e79110',
            name: 'MYOUToken',
            decimals: '18',
            symbol: 'MYOU',
            totalSupply: '999999999000000000000000000',
            owner: '0x',
            lastUpdated: 1602678250,
            issuancesCount: 0,
            holdersCount: 8717,
            ethTransfersCount: 0,
            price: false,
          },
          balance: 100000000000000000,
          totalIn: 0,
          totalOut: 0,
        },
      ])

      expect(balances.length).toEqual(1)
      expect(balances[0].asset.chain).toEqual(ETHChain)
      expect(balances[0].asset.symbol).toEqual('MYOU-0x98976A6dFaAf97B16a4Bb06035cC84be12e79110')
      expect(balances[0].asset.ticker).toEqual('MYOU')
      expect(balances[0].amount.amount().eq('100000000000000000')).toBeTruthy()
    })
  })

  describe('filterSelfTxs', () => {
    it('should return filtered transactions', () => {
      const txs = filterSelfTxs([
        {
          blockNumber: '7937085',
          timeStamp: '1611284369',
          hash: '0x40565f6d4cbe1c339decce9769fc94fcc868be98faba4429b79aa4ad2bb26ab4',
          from: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
          to: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
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
        {
          blockNumber: '7937085',
          timeStamp: '1611284369',
          hash: '0x40565f6d4cbe1c339decce9769fc94fcc868be98faba4429b79aa4ad2bb26ab4',
          from: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
          to: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
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
        {
          blockNumber: '7937085',
          timeStamp: '1611284369',
          hash: '0x84f28d86da01417a35e448f62248b9dee40261be82496275495bb0f0de6c8a1e',
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

      expect(txs.length).toEqual(2)
      expect(txs[0].hash).toEqual('0x84f28d86da01417a35e448f62248b9dee40261be82496275495bb0f0de6c8a1e')
      expect(txs[1].hash).toEqual('0x40565f6d4cbe1c339decce9769fc94fcc868be98faba4429b79aa4ad2bb26ab4')
    })
  })

  describe('getDecimal', () => {
    it('getDecimal', async () => {
      nock.disableNetConnect()
      mock_etherscan_api(
        'https://api-ropsten.etherscan.io',
        'eth_call',
        '0x0000000000000000000000000000000000000000000000000000000000000006',
      )

      const provider = new ethers.providers.EtherscanProvider(xchainNetworkToEths('testnet' as Network))

      const eth_decimal = await getDecimal(AssetETH, provider)
      expect(eth_decimal).toEqual(ETH_DECIMAL)

      const usdt_decimal = await getDecimal(
        {
          chain: ETHChain,
          ticker: 'USDT',
          symbol: 'USDT-0x62e273709da575835c7f6aef4a31140ca5b1d190',
        },
        provider,
      )
      expect(usdt_decimal).toEqual(6)
    })
  })
})
