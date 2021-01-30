import { ethers, BigNumber } from 'ethers'
import { BaseAmount } from '@xchainjs/xchain-util'
import { FeeOptionKey, Fees, TxParams } from '@xchainjs/xchain-client'

export type Address = string

export enum Network {
  TEST = 'rinkeby',
  MAIN = 'homestead',
}

export type ClientUrl = {
  testnet: string
  mainnet: string
}

export type ExplorerUrl = {
  testnet: string
  mainnet: string
}

export type TxOverrides = {
  nonce?: ethers.BigNumberish

  // mandatory: https://github.com/ethers-io/ethers.js/issues/469#issuecomment-475926538
  gasLimit: ethers.BigNumberish
  gasPrice?: ethers.BigNumberish
  data?: ethers.BytesLike
  value?: ethers.BigNumberish
}

export type GasPrices = Record<FeeOptionKey, BaseAmount>
export type GasLimits = Record<FeeOptionKey, BigNumber>

export type FeesParams = Omit<TxParams, 'memo'>
export type GasLimitParams = FeesParams & { gasPrice: BaseAmount }
export type GasLimitsParams = FeesParams & { gasPrices: GasPrices }

export type FeesWithGasPricesAndLimits = { fees: Fees; gasPrices: GasPrices; gasLimits: GasLimits }
