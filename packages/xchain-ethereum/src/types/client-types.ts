import { FeeOption, Fees } from '@xchainjs/xchain-client'
import { BaseAmount } from '@xchainjs/xchain-util'
import { BigNumber, ethers } from 'ethers'

export type Address = string

export enum EthNetwork {
  Test = 'ropsten',
  Main = 'homestead',
}

export type TxOverrides = {
  nonce?: ethers.BigNumberish

  // mandatory: https://github.com/ethers-io/ethers.js/issues/469#issuecomment-475926538
  gasLimit: ethers.BigNumberish
  gasPrice?: ethers.BigNumberish
}

export type InfuraCreds = {
  projectId: string
  projectSecret?: string
}

export type GasPrices = Record<FeeOption, BaseAmount>

export type FeesWithGasPricesAndLimits = { fees: Fees; gasPrices: GasPrices; gasLimit: BigNumber }

export type ApproveParams = {
  walletIndex?: number
  contractAddress: Address
  spenderAddress: Address
  amount: BaseAmount
}

export type CallParams = {
  walletIndex?: number
  contractAddress: Address
  abi: ethers.ContractInterface
  funcName: string
  funcParams?: unknown[]
}
