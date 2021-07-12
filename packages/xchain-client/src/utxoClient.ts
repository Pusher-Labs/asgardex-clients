import { Client, ClientParams, Wallet } from './client'
import { getFeeRateFromThorchain, standardFeeRates } from './feeRates'
import { calcFeesAsync } from './fees'
import { Fee, FeeRate, FeeRates, Fees, FeesWithRates, TxHash, TxParams } from './types'

export interface UTXOClientParams extends ClientParams {
  thornodeUrl?: string
}

export abstract class UTXOClient<ClientParamsType extends UTXOClientParams, WalletType extends Wallet> extends Client<
  ClientParamsType,
  WalletType
> {
  protected abstract getSuggestedFeeRate(): Promise<FeeRate>
  protected abstract calcFee(feeRate: FeeRate, memo?: string): Promise<Fee>

  async getFeesWithRates(memo?: string): Promise<FeesWithRates> {
    const rates = await this.getFeeRates()
    return {
      fees: await calcFeesAsync(rates, this.calcFee.bind(this), memo),
      rates,
    }
  }

  async getFees(memo?: string): Promise<Fees> {
    const { fees } = await this.getFeesWithRates(memo)
    return fees
  }

  /**
   * @deprecated Use getFees(memo) instead
   */
  async getFeesWithMemo(memo: string): Promise<Fees> {
    const { fees } = await this.getFeesWithRates(memo)
    return fees
  }

  async getFeeRates(): Promise<FeeRates> {
    const feeRate: FeeRate = await (async () => {
      try {
        if (this.params.thornodeUrl) return await getFeeRateFromThorchain(this.params.thornodeUrl, this.params.chain)
      } catch (error) {
        console.warn(`Rate lookup via Thorchain failed: ${error}`)
      }
      return await this.getSuggestedFeeRate()
    })()

    return standardFeeRates(feeRate)
  }

  abstract transfer(params: TxParams & { walletIndex?: number; feeRate?: FeeRate }): Promise<TxHash>
}
