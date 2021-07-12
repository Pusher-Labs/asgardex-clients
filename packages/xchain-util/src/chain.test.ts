import { chainToString, isChain } from './chain'
import { Chain } from './types'

describe('chain', () => {
  it('checks type Chain', () => {
    expect(isChain('BNB')).toBeTruthy()
    expect(isChain('BTC')).toBeTruthy()
    expect(isChain('BCH')).toBeTruthy()
    expect(isChain('ETH')).toBeTruthy()
    expect(isChain('THOR')).toBeTruthy()
    expect(isChain('GAIA')).toBeTruthy()
    expect(isChain('POLKA')).toBeTruthy()
    expect(isChain('LTC')).toBeTruthy()
    expect(isChain('')).toBeFalsy()
    expect(isChain('invalid')).toBeFalsy()
  })
  describe('chainToString', () => {
    it('returns string for Thorchain', () => {
      expect(chainToString('THOR' as Chain)).toEqual('Thorchain')
    })
    it('returns string for BTC', () => {
      expect(chainToString('BTC' as Chain)).toEqual('Bitcoin')
    })
    it('returns string for BCH', () => {
      expect(chainToString('BCH' as Chain)).toEqual('Bitcoin Cash')
    })
    it('returns string for ETH', () => {
      expect(chainToString('ETH' as Chain)).toEqual('Ethereum')
    })
    it('returns string for BNB', () => {
      expect(chainToString('BNB' as Chain)).toEqual('Binance Chain')
    })
    it('returns string for GAIA', () => {
      expect(chainToString('GAIA' as Chain)).toEqual('Cosmos')
    })
    it('returns string for POLKA', () => {
      expect(chainToString('POLKA' as Chain)).toEqual('Polkadot')
    })
    it('returns string for LTC', () => {
      expect(chainToString('LTC' as Chain)).toEqual('Litecoin')
    })
  })
})
