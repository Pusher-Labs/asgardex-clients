import { Chain } from '@xchainjs/xchain-util'
import axios from 'axios'

import { FeeOption, FeeRate, FeeRates } from './types'

export function singleFeeRate(rate: FeeRate): FeeRates {
  return Object.values(FeeOption).reduce<Partial<FeeRates>>((a, x) => ((a[x] = rate), a), {}) as FeeRates
}

export function standardFeeRates(rate: FeeRate): FeeRates {
  return {
    ...singleFeeRate(rate),
    [FeeOption.Average]: rate * 0.5,
    [FeeOption.Fastest]: rate * 5.0,
  }
}

export async function thornodeAPIGet(thornodeUrl: string, endpoint: string): Promise<unknown> {
  return (await axios.get(`${thornodeUrl}/thorchain/${endpoint}`)).data
}

export async function getFeeRateFromThorchain(thornodeUrl: string, chain: Chain): Promise<FeeRate> {
  const respData = await thornodeAPIGet(thornodeUrl, 'inbound_addresses')
  if (!Array.isArray(respData)) throw new Error('bad response from Thornode API')

  const chainData: { chain: Chain; gas_rate: string } = respData.find(
    (elem) => elem.chain === chain && typeof elem.gas_rate === 'string',
  )
  if (!chainData) throw new Error(`Thornode API /inbound_addresses does not contain fees for ${chain}`)

  return Number(chainData.gas_rate)
}
