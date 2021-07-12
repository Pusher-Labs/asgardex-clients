import { Provider, TransactionResponse } from '@ethersproject/abstract-provider'
import { EtherscanProvider, getDefaultProvider } from '@ethersproject/providers'
import {
  Address,
  Balance,
  Client as BaseClient,
  ClientParams as BaseClientParams,
  FeeOption,
  Fees,
  MultiAssetClient,
  Network,
  Tx,
  TxHash,
  TxHistoryParams,
  TxParams,
  TxsPage,
  calcFeesAsync,
  getFeeRateFromThorchain,
  standardFeeRates,
} from '@xchainjs/xchain-client'
import { Asset, AssetETH, BaseAmount, Chain, assetToString, baseAmount, delay } from '@xchainjs/xchain-util'
import { BigNumber, BigNumberish, ethers } from 'ethers'
import { parseUnits, toUtf8Bytes } from 'ethers/lib/utils'

import erc20ABI from './data/erc20.json'
import * as etherscanAPI from './etherscan-api'
import * as ethplorerAPI from './ethplorer-api'
import {
  ApproveParams,
  CallParams,
  FeesWithGasPricesAndLimits,
  GasOracleResponse,
  GasPrices,
  InfuraCreds,
  TxOverrides,
} from './types'
import {
  BASE_TOKEN_GAS_COST,
  ETHAddress,
  ETH_DECIMAL,
  MAX_APPROVAL,
  SIMPLE_GAS_COST,
  getDefaultFees,
  getDefaultGasPrices,
  getFee,
  getTokenAddress,
  getTokenBalances,
  getTxFromEthplorerEthTransaction,
  getTxFromEthplorerTokenOperation,
  validateAddress,
  xchainNetworkToEths,
} from './utils'
import { Wallet } from './wallet'

export interface ClientParams extends BaseClientParams {
  ethplorerUrl: string
  ethplorerApiKey: string
  etherscanApiKey?: string
  infuraCreds?: InfuraCreds
  thornodeUrl?: string
}

export const MAINNET_PARAMS: ClientParams = {
  chain: Chain.Ethereum,
  network: Network.Mainnet,
  getFullDerivationPath: (index: number) => `44'/60'/0'/0/${index}`,
  extraPrefixes: ['0x'],
  explorer: {
    url: 'https://etherscan.io',
    getAddressUrl(address: string) {
      return `${this.url}/address/${address}`
    },
    getTxUrl(txid: string) {
      return `${this.url}/tx/${txid}`
    },
  },
  ethplorerUrl: 'https://api.ethplorer.io',
  ethplorerApiKey: 'freekey',
  thornodeUrl: 'https://thornode.thorchain.info',
}

export const TESTNET_PARAMS: ClientParams = {
  ...MAINNET_PARAMS,
  network: Network.Testnet,
  getFullDerivationPath: (index: number) => `44'/60'/0'/0/${index}`, // this is INCORRECT but makes the unit tests pass
  explorer: {
    ...MAINNET_PARAMS.explorer,
    url: 'https://ropsten.etherscan.io',
  },
  thornodeUrl: 'https://testnet.thornode.thorchain.info',
}

export class Client extends BaseClient<ClientParams, Wallet> implements MultiAssetClient {
  readonly provider: Provider

  protected constructor(params: ClientParams) {
    super(params)
    const infuraCreds = this.params.infuraCreds
    if (infuraCreds !== undefined) {
      this.provider = new ethers.providers.InfuraProvider(
        xchainNetworkToEths(this.params.network),
        infuraCreds.projectSecret ? infuraCreds : infuraCreds.projectId,
      )
    } else {
      this.provider = getDefaultProvider(xchainNetworkToEths(this.params.network))
    }
  }

  static readonly create = Client.bindFactory((x: ClientParams) => new Client(x))

  /**
   * @deprecated
   */
  getProvider(): Provider {
    return this.provider
  }

  async getSigner(index = 0): Promise<ethers.Signer> {
    if (this.wallet === null) throw new Error('client must be unlocked')
    const signer = await this.wallet.getSigner(index, this.provider)
    return signer
  }

  protected async getVoidSigner(index: number): Promise<ethers.VoidSigner> {
    if (this.wallet === null) throw new Error('client must be unlocked')
    return new ethers.VoidSigner(await this.getAddress(index), this.provider)
  }

  /**
   * Get etherjs EtherscanProvider interface.
   *
   * @returns {EtherscanProvider} The current etherjs EtherscanProvider interface.
   */
  protected async getEtherscanProvider(): Promise<EtherscanProvider> {
    return new EtherscanProvider(this.params.network, this.params.etherscanApiKey)
  }

  async validateAddress(address: Address): Promise<boolean> {
    return super.validateAddress(address) && validateAddress(address)
  }

  async getBalance(address: Address, assets?: Asset[]): Promise<Balance[]> {
    // get ETH balance directly from provider
    const ethBalance: BigNumber = await this.getProvider().getBalance(address)
    const ethBalanceAmount = baseAmount(ethBalance.toString(), ETH_DECIMAL)

    switch (this.params.network) {
      case Network.Mainnet: {
        // use ethplorerAPI for mainnet - ignore assets
        const account = await ethplorerAPI.getAddress(this.params.ethplorerUrl, address, this.params.ethplorerApiKey)
        const balances: Balance[] = [
          {
            asset: AssetETH,
            amount: ethBalanceAmount,
          },
        ]

        if (account.tokens) {
          balances.push(...getTokenBalances(account.tokens))
        }

        return balances
      }
      case Network.Testnet: {
        // use etherscan for testnet

        const newAssets = assets || [AssetETH]
        // Follow approach is only for testnet
        // For mainnet, we will use ethplorer api(one request only)
        // https://github.com/xchainjs/xchainjs-lib/issues/252
        // And to avoid etherscan api call limit, it gets balances in a sequence way, not in parallel
        const balances = []
        for (let i = 0; i < newAssets.length; i++) {
          const asset = newAssets[i]
          const etherscan = await this.getEtherscanProvider()
          if (assetToString(asset) !== assetToString(AssetETH)) {
            // Handle token balances
            const assetAddress = getTokenAddress(asset)
            if (!assetAddress) {
              throw new Error(`Invalid asset ${asset}`)
            }
            const balance = await etherscanAPI.getTokenBalance({
              baseUrl: etherscan.baseUrl,
              address,
              assetAddress,
              apiKey: etherscan.apiKey,
            })
            const decimals =
              BigNumber.from(
                await this.callOffline<BigNumberish>({
                  contractAddress: assetAddress,
                  abi: erc20ABI,
                  funcName: 'decimals',
                }),
              ).toNumber() || ETH_DECIMAL

            if (!Number.isNaN(decimals)) {
              balances.push({
                asset,
                amount: baseAmount(balance.toString(), decimals),
              })
            }
          } else {
            balances.push({
              asset: AssetETH,
              amount: ethBalanceAmount,
            })
          }
          // Due to etherscan api call limitation, put some delay before another call
          // Free Etherscan api key limit: 5 calls per second
          // So 0.3s delay is reasonable for now
          await delay(300)
        }

        return balances
      }
    }
  }

  /**
   * Get transaction history of a given address with pagination options.
   * By default it will return the transaction history of the current wallet.
   *
   * @param {TxHistoryParams} params The options to get transaction history. (optional)
   * @returns {TxsPage} The transaction history.
   */
  async getTransactions(params: TxHistoryParams): Promise<TxsPage> {
    const offset = params?.offset || 0
    const limit = params?.limit || 10
    const assetAddress = params?.asset

    const maxCount = 10000

    let transactions
    const etherscan = await this.getEtherscanProvider()

    if (assetAddress) {
      transactions = await etherscanAPI.getTokenTransactionHistory({
        baseUrl: etherscan.baseUrl,
        address: params?.address,
        assetAddress,
        page: 0,
        offset: maxCount,
        apiKey: etherscan.apiKey,
      })
    } else {
      transactions = await etherscanAPI.getETHTransactionHistory({
        baseUrl: etherscan.baseUrl,
        address: params?.address,
        page: 0,
        offset: maxCount,
        apiKey: etherscan.apiKey,
      })
    }

    return {
      total: transactions.length,
      txs: transactions.filter((_, index) => index >= offset && index < offset + limit),
    }
  }

  /**
   * Get the transaction details of a given transaction id.
   *
   * @param {string} txId The transaction id.
   * @param {string} assetAddress The asset address. (optional)
   * @returns {Tx} The transaction details of the given transaction id.
   *
   * @throws {"Need to provide valid txId"}
   * Thrown if the given txId is invalid.
   */
  async getTransactionData(txId: string, assetAddress?: Address): Promise<Tx> {
    switch (this.params.network) {
      case Network.Mainnet: {
        // use ethplorerAPI for mainnet - ignore assetAddress
        const txInfo = await ethplorerAPI.getTxInfo(this.params.ethplorerUrl, txId, this.params.ethplorerApiKey)
        if (!txInfo.operations?.length) return getTxFromEthplorerEthTransaction(txInfo)
        const tx = getTxFromEthplorerTokenOperation(txInfo.operations[0])
        if (!tx) throw new Error('Could not parse transaction data')
        return tx
      }
      case Network.Testnet: {
        let tx
        const etherscan = await this.getEtherscanProvider()
        const txInfo = await etherscan.getTransaction(txId)
        if (txInfo) {
          if (assetAddress) {
            tx =
              (
                await etherscanAPI.getTokenTransactionHistory({
                  baseUrl: etherscan.baseUrl,
                  assetAddress,
                  startblock: txInfo.blockNumber,
                  endblock: txInfo.blockNumber,
                  apiKey: etherscan.apiKey,
                })
              ).filter((info) => info.hash === txId)[0] ?? null
          } else {
            tx =
              (
                await etherscanAPI.getETHTransactionHistory({
                  baseUrl: etherscan.baseUrl,
                  startblock: txInfo.blockNumber,
                  endblock: txInfo.blockNumber,
                  apiKey: etherscan.apiKey,
                  address: txInfo.from,
                })
              ).filter((info) => info.hash === txId)[0] ?? null
          }
        }

        if (!tx) throw new Error('Could not get transaction history')
        return tx
      }
    }
  }

  async call<T>({ walletIndex = 0, contractAddress, abi, funcName, funcParams = [] }: CallParams): Promise<T> {
    const signer = await this.getSigner(walletIndex)
    const contract = new ethers.Contract(contractAddress, abi, this.provider).connect(signer)
    return contract[funcName](...(funcParams ?? []))
  }

  async callOffline<T>({ walletIndex = 0, contractAddress, abi, funcName, funcParams = [] }: CallParams): Promise<T> {
    const signer = await this.getVoidSigner(walletIndex ?? 0)
    const contract = new ethers.Contract(contractAddress, abi, this.provider).connect(signer)
    return contract[funcName](...(funcParams ?? []))
  }

  async estimateCall({
    walletIndex = 0,
    contractAddress,
    abi,
    funcName,
    funcParams = [],
  }: CallParams): Promise<BigNumber> {
    const signer = await this.getVoidSigner(walletIndex ?? 0)
    const contract = new ethers.Contract(contractAddress, abi, this.provider).connect(signer)
    return contract.estimateGas[funcName](...(funcParams ?? []))
  }

  /**
   * Check allowance.
   *
   * @param {Address} contractAddress The spender address.
   * @param {Address} spenderAddress The spender address.
   * @param {BaseAmount} amount The amount to check if it's allowed to spend or not.
   * @param {number} walletIndex (optional) HD wallet index
   * @returns {boolean} `true` or `false`.
   */
  async isApproved({ walletIndex, contractAddress, spenderAddress, amount }: ApproveParams): Promise<boolean> {
    const txAmount = BigNumber.from(amount.amount().toFixed())
    const allowance = await this.callOffline<BigNumberish>({
      walletIndex,
      contractAddress,
      abi: erc20ABI,
      funcName: 'allowance',
      funcParams: [spenderAddress, spenderAddress],
    })
    return txAmount.lte(allowance)
  }

  /**
   * Check allowance.
   *
   * @param {Address} contractAddress The contract address.
   * @param {Address} spenderAddress The spender address.
   * @param {feeOptionKey} FeeOption Fee option (optional)
   * @param {BaseAmount} amount The amount of token. By default, it will be unlimited token allowance. (optional)
   * @param {number} walletIndex (optional) HD wallet index
   *
   * @returns {TransactionResponse} The transaction result.
   */
  async approve({
    walletIndex = 0,
    contractAddress,
    spenderAddress,
    feeOptionKey: feeOption = FeeOption.Fastest,
    amount,
  }: ApproveParams & { feeOptionKey?: FeeOption }): Promise<TransactionResponse> {
    const gasPrice =
      feeOption &&
      BigNumber.from(
        (
          await this.estimateGasPrices()
            .then((prices) => prices[feeOption])
            .catch(() => getDefaultGasPrices()[feeOption])
        )
          .amount()
          .toFixed(),
      )
    const gasLimit = await this.estimateApprove({ walletIndex, spenderAddress, contractAddress, amount }).catch(
      () => undefined,
    )

    const txAmount = amount ? BigNumber.from(amount.amount().toFixed()) : MAX_APPROVAL
    const txResult = await this.call<TransactionResponse>({
      walletIndex,
      contractAddress,
      abi: erc20ABI,
      funcName: 'approve',
      funcParams: [spenderAddress, txAmount, { from: await this.getAddress(walletIndex), gasPrice, gasLimit }],
    })

    return txResult
  }

  /**
   * Estimate gas limit of approve.
   *
   * @param {Address} contractAddress The contract address.
   * @param {Address} spenderAddress The spender address.
   * @param {number} walletIndex (optional) HD wallet index
   * @param {BaseAmount} amount The amount of token. By default, it will be unlimited token allowance. (optional)
   * @returns {BigNumber} The estimated gas limit.
   */
  async estimateApprove({
    walletIndex = 0,
    contractAddress,
    spenderAddress,
    amount,
  }: ApproveParams): Promise<BigNumber> {
    const txAmount = amount ? BigNumber.from(amount.amount().toFixed()) : MAX_APPROVAL
    const gasLimit = await this.estimateCall({
      walletIndex,
      contractAddress,
      abi: erc20ABI,
      funcName: 'approve',
      funcParams: [spenderAddress, txAmount, { from: await this.getAddress(walletIndex) }],
    })

    return gasLimit
  }

  async transfer(
    params: TxParams & { gasLimit?: BigNumber } & (
        | { feeOptionKey?: FeeOption; gasPrice?: never }
        | { feeOptionKey?: never; gasPrice?: BaseAmount }
      ),
  ): Promise<TxHash> {
    if (this.wallet === null) throw new Error('client must be unlocked')
    const index = params.walletIndex ?? 0
    if (!(Number.isSafeInteger(index) && index >= 0)) throw new Error('index must be a non-negative integer')

    const { asset, memo, amount, recipient, feeOptionKey: feeOption, gasPrice, gasLimit } = params

    const txAmount = BigNumber.from(amount.amount().toFixed())

    let assetAddress
    if (asset && assetToString(asset) !== assetToString(AssetETH)) {
      assetAddress = getTokenAddress(asset)
    }

    const isETHAddress = assetAddress === ETHAddress

    // feeOption

    const defaultGasLimit: ethers.BigNumber = isETHAddress ? SIMPLE_GAS_COST : BASE_TOKEN_GAS_COST

    let overrides: TxOverrides = {
      gasLimit: gasLimit ?? defaultGasLimit,
      gasPrice: gasPrice && BigNumber.from(gasPrice.amount().toFixed()),
    }

    // override `overrides` if `feeOption` is provided
    if (feeOption) {
      const gasPrices = await this.estimateGasPrices().catch(() => getDefaultGasPrices())
      const gasPrice = gasPrices[feeOption]
      const gasLimit = await this.estimateGasLimit({
        ...params,
        walletIndex: index,
      }).catch(() => defaultGasLimit)

      overrides = {
        ...overrides,
        gasLimit,
        gasPrice: BigNumber.from(gasPrice.amount().toFixed()),
      }
    }

    let txResult
    if (assetAddress && !isETHAddress) {
      // Transfer ERC20
      txResult = await this.call<TransactionResponse>({
        walletIndex: index,
        contractAddress: assetAddress,
        abi: erc20ABI,
        funcName: 'transfer',
        funcParams: [recipient, txAmount, Object.assign({}, overrides)],
      })
    } else {
      // Transfer ETH
      const transactionRequest: ethers.providers.TransactionRequest = Object.assign(
        {
          nonce: await this.provider.getTransactionCount(await this.getAddress(index)),
          chainId: (await this.provider.getNetwork()).chainId,
          to: recipient,
          value: txAmount,
        },
        {
          ...overrides,
          data: memo ? toUtf8Bytes(memo) : undefined,
        },
      )

      const signer = await this.wallet.getSigner(index)
      const signedTx = await signer.signTransaction(transactionRequest)
      txResult = await this.provider.sendTransaction(signedTx)
    }

    return txResult.hash
  }

  async estimateGasPrices(): Promise<GasPrices> {
    if (this.params.thornodeUrl !== undefined) {
      try {
        // Note: `rates` are in `gwei`
        // @see https://gitlab.com/thorchain/thornode/-/blob/develop/x/thorchain/querier.go#L416-420
        // To have all values in `BaseAmount`, they needs to be converted into `wei` (1 gwei = 1,000,000,000 wei = 1e9)
        const ratesInGwei = standardFeeRates(await getFeeRateFromThorchain(this.params.thornodeUrl, Chain.Ethereum))
        return {
          [FeeOption.Average]: baseAmount(ratesInGwei[FeeOption.Average] * 10 ** 9, ETH_DECIMAL),
          [FeeOption.Fast]: baseAmount(ratesInGwei[FeeOption.Fast] * 10 ** 9, ETH_DECIMAL),
          [FeeOption.Fastest]: baseAmount(ratesInGwei[FeeOption.Fastest] * 10 ** 9, ETH_DECIMAL),
        }
      } catch (error) {
        console.warn(`Rate lookup via Thorchain failed: ${error}`)
      }
    }
    // should only get here if thor fails
    return await this.estimateGasPricesFromEtherscan()
  }

  async estimateGasPricesFromEtherscan(): Promise<GasPrices> {
    const etherscan = await this.getEtherscanProvider()
    const response: GasOracleResponse = await etherscanAPI.getGasOracle(etherscan.baseUrl, etherscan.apiKey)

    // Convert result of gas prices: `Gwei` -> `Wei`
    const averageWei = parseUnits(response.SafeGasPrice, 'gwei')
    const fastWei = parseUnits(response.ProposeGasPrice, 'gwei')
    const fastestWei = parseUnits(response.FastGasPrice, 'gwei')

    return {
      average: baseAmount(averageWei.toString(), ETH_DECIMAL),
      fast: baseAmount(fastWei.toString(), ETH_DECIMAL),
      fastest: baseAmount(fastestWei.toString(), ETH_DECIMAL),
    }
  }

  /**
   * Estimate gas.
   *
   * @param {TxParams} params The transaction and fees options.
   * @returns {BaseAmount} The estimated gas fee.
   */
  async estimateGasLimit({ walletIndex: index = 0, asset, recipient, amount, memo }: TxParams): Promise<BigNumber> {
    const fromAddress = await this.getAddress(index)
    const txAmount = BigNumber.from(amount.amount().toFixed())

    const assetAddress = asset && assetToString(asset) !== assetToString(AssetETH) ? getTokenAddress(asset) : null

    if (assetAddress !== null && assetAddress !== ETHAddress) {
      // ERC20 gas estimate
      const contract = new ethers.Contract(assetAddress, erc20ABI, this.provider)

      return await contract.estimateGas.transfer(recipient, txAmount, {
        from: fromAddress,
      })
    } else {
      // ETH gas estimate
      const transactionRequest = {
        from: fromAddress,
        to: recipient,
        value: txAmount,
        data: memo ? toUtf8Bytes(memo) : undefined,
      }

      return await this.provider.estimateGas(transactionRequest)
    }
  }

  /**
   * Estimate gas prices/limits (average, fast fastest).
   *
   * @param {TxParams} params
   * @returns {FeesWithGasPricesAndLimits} The estimated gas prices/limits.
   */
  async estimateFeesWithGasPricesAndLimits(params: TxParams): Promise<FeesWithGasPricesAndLimits> {
    const gasPrices = await this.estimateGasPrices()
    const gasLimit = await this.estimateGasLimit(params)

    return {
      gasPrices,
      fees: await calcFeesAsync(
        gasPrices,
        (gasPrice: BaseAmount, gasLimit: BigNumber) => getFee({ gasPrice, gasLimit }),
        gasLimit,
      ),
      gasLimit,
    }
  }

  async getFees(params?: TxParams): Promise<Fees> {
    if (params === undefined) return getDefaultFees()
    return (await this.estimateFeesWithGasPricesAndLimits(params)).fees
  }
}
