import { Chain } from './types'

export const isChain = (c: string): c is Chain => (Object.values(Chain) as string[]).includes(c)

export const chainToString: ((chainId: Chain) => string) & Record<Chain, string> = Object.assign(
  (chainId: Chain) => {
    if (!(chainId in chainToString)) return 'unknown chain'
    return chainToString[chainId]
  },
  {
    [Chain.THORChain]: 'Thorchain',
    [Chain.Bitcoin]: 'Bitcoin',
    [Chain.BitcoinCash]: 'Bitcoin Cash',
    [Chain.Litecoin]: 'Litecoin',
    [Chain.Ethereum]: 'Ethereum',
    [Chain.Binance]: 'Binance Chain',
    [Chain.Cosmos]: 'Cosmos',
    [Chain.Polkadot]: 'Polkadot',
  },
)
