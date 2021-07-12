import {
  AssetBNB,
  AssetBTC,
  AssetETH,
  AssetRune67C,
  AssetRuneB1A,
  AssetRuneNative,
  assetAmount,
  assetFromString,
  assetToBase,
  assetToString,
  baseAmount,
  baseToAsset,
  currencySymbolByAsset,
  formatAssetAmount,
  formatAssetAmountCurrency,
  formatBaseAmount,
  formatBaseAsAssetAmount,
  isAssetAmount,
  isBaseAmount,
  isBigNumberValue,
  isValidAsset,
} from './asset'
import { bn } from './index'
import { Asset, Chain, Denomination } from './types'

describe('asset', () => {
  describe('isBigNumberValue', () => {
    it('return true for BigNumber.Value', () => {
      expect(isBigNumberValue(1)).toBeTruthy()
      expect(isBigNumberValue('1')).toBeTruthy()
      expect(isBigNumberValue(bn(1))).toBeTruthy()
    })
    it('return false for others', () => {
      expect(isBigNumberValue(baseAmount(10))).toBeFalsy()
      expect(isBigNumberValue(assetAmount(10))).toBeFalsy()
    })
  })
  describe('assetAmount', () => {
    it('should create asset amount by given value', () => {
      const amount = assetAmount(10)
      expect(amount.type).toEqual(Denomination.Asset)
      expect(amount.amount()).toEqual(bn('10'))
      // default decimal == 8
      expect(amount.decimal).toEqual(8)
    })
    it('should creates asset amount by given value and decimal', () => {
      const amount = assetAmount(10, 18)
      expect(amount.type).toEqual(Denomination.Asset)
      expect(amount.amount()).toEqual(bn('10'))
      expect(amount.decimal).toEqual(18)
    })
    it('should be able to add a value', () => {
      const amount = assetAmount(10, 18).plus(100)
      expect(amount.type).toEqual(Denomination.Asset)
      expect(amount.amount()).toEqual(bn('110'))
    })
    it('should be able to sub a value', () => {
      const amount = assetAmount(10, 18).minus(5)
      expect(amount.type).toEqual(Denomination.Asset)
      expect(amount.amount()).toEqual(bn('5'))
    })
    it('should be able to mul a value', () => {
      const amount = assetAmount(10, 18).times(1e10)
      expect(amount.type).toEqual(Denomination.Asset)
      expect(amount.amount()).toEqual(bn('100000000000'))
    })
    it('should be able to div a value', () => {
      const amount = assetAmount(10, 18).div(5)
      expect(amount.type).toEqual(Denomination.Asset)
      expect(amount.amount()).toEqual(bn('2'))
    })
    it('should be able to add AssetAmount', () => {
      const amount = assetAmount(10, 18).plus(assetAmount(10, 10))
      expect(amount.type).toEqual(Denomination.Asset)
      expect(amount.amount()).toEqual(bn('20'))
      expect(amount.decimal).toEqual(18)
    })
    it('should be able to set decimal', () => {
      const amount = assetAmount(10, 18).plus(assetAmount(10, 10), 12)
      expect(amount.type).toEqual(Denomination.Asset)
      expect(amount.amount()).toEqual(bn('20'))
      expect(amount.decimal).toEqual(12)
    })
    it('should be able to check lt', () => {
      expect(assetAmount(10).lt(assetAmount(11))).toBeTruthy()
      expect(assetAmount(10).lt(11)).toBeTruthy()
      expect(assetAmount(11).lt(10)).toBeFalsy()
      expect(assetAmount(11, 10).lt(assetAmount(10, 8))).toBeFalsy()
    })
    it('should be able to check lte', () => {
      expect(assetAmount(10).lte(10)).toBeTruthy()
      expect(assetAmount(11).lte(10)).toBeFalsy()
      expect(assetAmount(10).lte(assetAmount(10))).toBeTruthy()
      expect(assetAmount(11, 10).lte(assetAmount(10, 8))).toBeFalsy()
    })
    it('should be able to check gt', () => {
      expect(assetAmount(10).gt(9)).toBeTruthy()
      expect(assetAmount(9).gt(10)).toBeFalsy()
      expect(assetAmount(10).gt(assetAmount(9))).toBeTruthy()
      expect(assetAmount(9, 10).gt(assetAmount(10, 8))).toBeFalsy()
    })
    it('should be able to check gte', () => {
      expect(assetAmount(10).gte(10)).toBeTruthy()
      expect(assetAmount(9).gte(10)).toBeFalsy()
      expect(assetAmount(10).gte(assetAmount(10))).toBeTruthy()
      expect(assetAmount(9, 10).gte(assetAmount(10, 8))).toBeFalsy()
    })
    it('should be able to check eq', () => {
      expect(assetAmount(10).eq(10)).toBeTruthy()
      expect(assetAmount(9).eq(10)).toBeFalsy()
      expect(assetAmount(10).eq(assetAmount(10))).toBeTruthy()
      expect(assetAmount(9, 10).eq(assetAmount(10, 8))).toBeFalsy()
    })
  })

  describe('baseAmount', () => {
    it('should create base amounts by given value', () => {
      const amount = baseAmount(10)
      expect(amount.type).toEqual(Denomination.Base)
      expect(amount.amount()).toEqual(bn('10'))
    })
    it('should be able to add a value', () => {
      const amount = baseAmount(10).plus(100)
      expect(amount.type).toEqual(Denomination.Base)
      expect(amount.amount()).toEqual(bn('110'))
    })
    it('should be able to sub a value', () => {
      const amount = baseAmount(10).minus(5)
      expect(amount.type).toEqual(Denomination.Base)
      expect(amount.amount()).toEqual(bn('5'))
    })
    it('should be able to mul a value', () => {
      const amount = baseAmount(10).times(5)
      expect(amount.type).toEqual(Denomination.Base)
      expect(amount.amount()).toEqual(bn('50'))
    })
    it('should be able to div a value', () => {
      const amount = baseAmount(10).div(5)
      expect(amount.type).toEqual(Denomination.Base)
      expect(amount.amount()).toEqual(bn('2'))
    })
    it('should be able to add BaseAmount', () => {
      const amount = baseAmount(10, 18).plus(baseAmount(10, 10))
      expect(amount.type).toEqual(Denomination.Base)
      expect(amount.amount()).toEqual(bn('20'))
      expect(amount.decimal).toEqual(18)
    })
    it('should be able to set decimal', () => {
      const amount = baseAmount(10, 18).plus(baseAmount(10, 10), 12)
      expect(amount.type).toEqual(Denomination.Base)
      expect(amount.amount()).toEqual(bn('20'))
      expect(amount.decimal).toEqual(12)
    })
    it('should be able to check lt', () => {
      expect(baseAmount(10).lt(11)).toBeTruthy()
      expect(baseAmount(10).lt(9)).toBeFalsy()
      expect(baseAmount(10).lt(baseAmount(11))).toBeTruthy()
      expect(baseAmount(10, 10).lt(baseAmount(9, 8))).toBeFalsy()
    })
    it('should be able to check lte', () => {
      expect(baseAmount(10).lte(10)).toBeTruthy()
      expect(baseAmount(10).lte(9)).toBeFalsy()
      expect(baseAmount(10).lte(baseAmount(10))).toBeTruthy()
      expect(baseAmount(10, 10).lte(baseAmount(9, 8))).toBeFalsy()
    })
    it('should be able to check gt', () => {
      expect(baseAmount(10).gt(9)).toBeTruthy()
      expect(baseAmount(9).gt(10)).toBeFalsy()
      expect(baseAmount(10).gt(baseAmount(9))).toBeTruthy()
      expect(baseAmount(9, 10).gt(baseAmount(10, 8))).toBeFalsy()
    })
    it('should be able to check gte', () => {
      expect(baseAmount(10).gte(10)).toBeTruthy()
      expect(baseAmount(9).gte(10)).toBeFalsy()
      expect(baseAmount(10).gte(baseAmount(10))).toBeTruthy()
      expect(baseAmount(9, 10).gte(baseAmount(10, 8))).toBeFalsy()
    })
    it('should be able to check eq', () => {
      expect(baseAmount(10).eq(10)).toBeTruthy()
      expect(baseAmount(9).eq(10)).toBeFalsy()
      expect(baseAmount(10).eq(baseAmount(10))).toBeTruthy()
      expect(baseAmount(9, 10).eq(baseAmount(10, 8))).toBeFalsy()
    })
  })

  describe('baseToAsset', () => {
    it('should return asset by given base amounts', () => {
      const amount = baseToAsset(baseAmount(123))
      expect(amount.type).toEqual(Denomination.Asset)
      expect(amount.amount()).toEqual(bn('0.00000123'))
      // 8 decimal by default
      expect(amount.decimal).toEqual(8)
    })
    it('should return asset by given base amounts and decimal', () => {
      const amount = baseToAsset(baseAmount(123, 18))
      expect(amount.type).toEqual(Denomination.Asset)
      expect(amount.amount()).toEqual(bn('0.000000000000000123'))
      expect(amount.decimal).toEqual(18)
    })
  })

  describe('assetToBase', () => {
    it('should return base amounts by given asset amounts', () => {
      const amount = assetToBase(assetAmount(22))
      expect(amount.type).toEqual(Denomination.Base)
      expect(amount.decimal).toEqual(8)
      expect(amount.amount()).toEqual(bn('2200000000'))
    })
    it('should return base amounts by given asset amounts', () => {
      const amount = assetToBase(assetAmount(22, 18))
      expect(amount.type).toEqual(Denomination.Base)
      expect(amount.decimal).toEqual(18)
      expect(amount.amount()).toEqual(bn('22000000000000000000'))
    })
  })

  describe('isAssetAmount', () => {
    it('should return `true`', () => {
      const amount = assetAmount(10)
      expect(isAssetAmount(amount)).toBeTruthy()
    })
    it('should return `false` for any other then AssetAmount', () => {
      const amount = baseAmount(0)
      expect(isAssetAmount(amount)).toBeFalsy()
    })
  })

  describe('isBaseAmount', () => {
    it('should return `true`', () => {
      const amount = baseAmount(10)
      expect(isBaseAmount(amount)).toBeTruthy()
    })
    it('should return `false` for any other then BaseAmount', () => {
      const amount = assetAmount(0)
      expect(isBaseAmount(amount)).toBeFalsy()
    })
  })

  describe('formatAssetAmount', () => {
    it('formats an `AssetAmount` with decimal of `AssetAmount` by default', () => {
      const amount = assetAmount(11.0001, 8)
      expect(formatAssetAmount({ amount })).toEqual('11.00010000')
    })
    it('formats a `AssetAmount` with 5 decimal', () => {
      const amount = assetAmount(11.001, 8)
      expect(formatAssetAmount({ amount, decimal: 5 })).toEqual('11.00100')
    })

    it('formats an `AssetAmount` with 5 decimal, but trims zeros', () => {
      const amount = assetAmount(11.001, 8)
      expect(formatAssetAmount({ amount, decimal: 5, trimZeros: true })).toEqual('11.001')
    })

    it('formats an `AssetAmount` with 0 decimal', () => {
      const amount = assetAmount(11.001, 5)
      expect(formatAssetAmount({ amount, decimal: 0 })).toEqual('11')
    })

    it('formats an `AssetAmount` with 5 decimal for formatAssetAmount', () => {
      const amount = assetAmount(11.001, 0)
      expect(formatAssetAmount({ amount, decimal: 5 })).toEqual('11.00000')
    })
  })

  describe('formatBaseAmount', () => {
    it('formats base amount', () => {
      const amount = baseAmount(100001)
      expect(formatBaseAmount(amount)).toEqual('100,001')
    })
  })

  describe('assetFromString', () => {
    it('returns RUNE asset with all values', () => {
      const result = assetFromString('BNB.RUNE-B1A')
      expect(result).toEqual({
        chain: 'BNB' as Chain,
        symbol: 'RUNE-B1A',
        ticker: 'RUNE',
      })
    })
    it('returns RUNE with all values, even if chain and symbol are provided only', () => {
      const result = assetFromString('BNB.RUNE')
      expect(result).toEqual({ chain: 'BNB' as Chain, symbol: 'RUNE', ticker: 'RUNE' })
    })
    it('returns a BTCB asset with all values, even if chain and symbol are provided only', () => {
      const result = assetFromString('BNB.BTCB-123')
      expect(result).toEqual({ chain: 'BNB' as Chain, symbol: 'BTCB-123', ticker: 'BTCB' })
    })
    it('returns a WBTC asset with all values, even if chain and symbol are provided only', () => {
      const result = assetFromString('ETH.WBTC')
      expect(result).toEqual({ chain: 'ETH' as Chain, symbol: 'WBTC', ticker: 'WBTC' })
    })
    it('returns a ETH asset with all values, even if chain and symbol are provided only', () => {
      const result = assetFromString('ETH.ETH')
      expect(result).toEqual({ chain: 'ETH' as Chain, symbol: 'ETH', ticker: 'ETH' })
    })
    it('returns null if the string includes a value for a chain only', () => {
      const result = assetFromString('BNB')
      expect(result).toBeNull()
    })
    it('returns null by passing a value for a chain and a `.`', () => {
      const result = assetFromString('BNB.')
      expect(result).toBeNull()
    })
    it('returns null by passing an empty string', () => {
      const result = assetFromString('')
      expect(result).toBeNull()
    })
    it('returns null by passing `.` ', () => {
      const result = assetFromString('.')
      expect(result).toBeNull()
    })
    it('returns null by passing an undefined chain', () => {
      const result = assetFromString('.BNB.BNB')
      expect(result).toBeNull()
    })
    it('returns null by passing invalid chain', () => {
      const result = assetFromString('invalid.BNB.BNB')
      expect(result).toBeNull()
    })
  })

  describe('assetToString', () => {
    it('returns a string for RUNE asset', () => {
      const asset: Asset = { chain: 'BNB' as Chain, symbol: 'RUNE-B1A', ticker: 'RUNE' }
      expect(assetToString(asset)).toEqual('BNB.RUNE-B1A')
    })
    it('returns a string for ETH asset', () => {
      const asset: Asset = { chain: 'ETH' as Chain, symbol: 'ETH', ticker: 'ETH' }
      expect(assetToString(asset)).toEqual('ETH.ETH')
    })
  })

  describe('isValidAsset', () => {
    it('returns false invalid asset data', () => {
      expect(isValidAsset({ chain: 'BNB' as Chain, symbol: '', ticker: 'RUNE' })).toBeFalsy()
      expect(isValidAsset({ chain: 'BNB' as Chain, symbol: 'RUNE-B1A', ticker: '' })).toBeFalsy()
    })
    it('returns true for valid `Asset` data', () => {
      const asset: Asset = { chain: 'BNB' as Chain, symbol: 'RUNE-B1A', ticker: 'RUNE' }
      expect(isValidAsset(asset)).toBeTruthy()
    })
  })

  describe('currencySymbolByAsset', () => {
    it('returns currency symbol for RUNE (mainnet)', () => {
      expect(currencySymbolByAsset(AssetRuneB1A)).toEqual('ᚱ')
    })
    it('returns currency symbol for RUNE (testnet)', () => {
      expect(currencySymbolByAsset(AssetRune67C)).toEqual('ᚱ')
    })
    it('returns currency symbol for RUNE (native)', () => {
      expect(currencySymbolByAsset(AssetRuneNative)).toEqual('ᚱ')
    })
    it('returns currency symbol for BTC', () => {
      expect(currencySymbolByAsset(AssetBTC)).toEqual('₿')
    })

    it('returns currency symbol for ETH', () => {
      expect(currencySymbolByAsset(AssetETH)).toEqual('Ξ')
    })

    it('returns currency symbol for USD', () => {
      expect(currencySymbolByAsset({ chain: 'BNB' as Chain, symbol: 'BUSD-BAF', ticker: 'BUSD' })).toEqual('$')
    })
    it('returns ticker as currency symbol for other assets', () => {
      expect(currencySymbolByAsset(AssetBNB)).toEqual('BNB')
    })
  })

  describe('formatAssetAmountCurrency', () => {
    it('formats an `AssetAmount` as USD by default ', () => {
      const amount = assetAmount(11.01, 2)
      expect(formatAssetAmountCurrency({ amount })).toEqual('$ 11.01')
    })
    it('formats a zero `AssetAmount` as USD by default ', () => {
      const amount = assetAmount(0, 2)
      expect(formatAssetAmountCurrency({ amount })).toEqual('$ 0.00')
    })

    it('formats amount of RUNE (mainnet)', () => {
      const amount = assetAmount(10, 8)
      expect(formatAssetAmountCurrency({ amount, asset: AssetRuneB1A })).toEqual('ᚱ 10.00000000')
    })
    it('formats amount of native RUNE', () => {
      const amount = assetAmount(10, 8)
      expect(formatAssetAmountCurrency({ amount, asset: AssetRuneNative })).toEqual('ᚱ 10.00000000')
    })
    it('formats amount of RUNE (testnet', () => {
      const amount = assetAmount(10, 8)
      expect(formatAssetAmountCurrency({ amount, asset: AssetRune67C })).toEqual('ᚱ 10.00000000')
    })
    it('formats amount of ETH', () => {
      const amount = assetAmount(10, 18)
      expect(formatAssetAmountCurrency({ amount, asset: AssetETH, decimal: 2 })).toEqual('Ξ 10.00')
    })
    it('formats amount of WBTC', () => {
      const amount = assetAmount(10, 18)
      const asset = assetFromString('ETH.WBTC') || AssetRune67C
      expect(formatAssetAmountCurrency({ amount, asset, decimal: 2 })).toEqual('₿ 10.00')
    })
    it('formats amount of BTC', () => {
      const amount = assetAmount(10, 8)
      expect(formatAssetAmountCurrency({ amount, asset: AssetBTC, decimal: 2 })).toEqual('₿ 10.00')
    })
    it('formats amount of BTC in satoshi', () => {
      const amount = assetAmount(0.01)
      expect(formatAssetAmountCurrency({ amount, asset: AssetBTC })).toEqual('⚡ 1,000,000')
    })
    it('formats amount of BTCB-123', () => {
      const amount = assetAmount(10, 8)
      const asset = assetFromString('BNB.BTCB-123') || AssetRune67C
      expect(formatAssetAmountCurrency({ amount, asset, decimal: 2 })).toEqual('₿ 10.00')
    })
    it('formats amount of BTCB-123 in satoshi', () => {
      const amount = assetAmount(0.01, 8)
      const asset = assetFromString('BNB.BTCB-123') || AssetRune67C
      assetFromString('BNB.BTCB-123') || expect(formatAssetAmountCurrency({ amount, asset })).toEqual('⚡ 1,000,000')
    })
    it('formats amount of TUSD', () => {
      const amount = assetAmount(10, 8)
      const asset = assetFromString('BNB.TUSD') || AssetRune67C
      expect(formatAssetAmountCurrency({ amount, asset, decimal: 2 })).toEqual('$ 10.00')
    })
    it('formats amount of BNB', () => {
      const amount = assetAmount(10, 8)
      expect(formatAssetAmountCurrency({ amount, asset: AssetBNB, decimal: 2 })).toEqual('10.00 BNB')
    })
    it('formats amount by given decimal', () => {
      const amount = assetAmount(10, 8)
      expect(formatAssetAmountCurrency({ amount, asset: AssetBNB, decimal: 4 })).toEqual('10.0000 BNB')
    })
    it('formats amount by given decimal, but it trims zeros', () => {
      const amount = assetAmount(10, 8)
      expect(formatAssetAmountCurrency({ amount, asset: AssetBNB, decimal: 4, trimZeros: true })).toEqual('10 BNB')
    })
    it('formats amount by using decimal of asset (if decimal is not given)', () => {
      const amount = assetAmount(10, 8)
      expect(formatAssetAmountCurrency({ amount, asset: AssetBNB })).toEqual('10.00000000 BNB')
    })
    it('formats amount by using decimal of asset, but it trims zeros', () => {
      const amount = assetAmount(10.01, 8)
      expect(formatAssetAmountCurrency({ amount, asset: AssetBNB, trimZeros: true })).toEqual('10.01 BNB')
    })

    it('formats amount by using 0 decimal of asset', () => {
      const amount = assetAmount(10.01, 5)
      expect(formatAssetAmountCurrency({ amount, asset: AssetBNB, decimal: 0 })).toEqual('10 BNB')
    })

    it('formats an amount with 5 decimal for formatAssetAmountCurrency', () => {
      const amount = assetAmount(10.001, 0)
      expect(formatAssetAmountCurrency({ amount, decimal: 5, asset: AssetBNB })).toEqual('10.00000 BNB')
    })
  })

  describe('formatBaseAsAssetAmount', () => {
    it('formats with all decimal', () => {
      const amount = baseAmount(12345, 8)
      const result = formatBaseAsAssetAmount({ amount })
      expect(result).toEqual('0.00012345')
    })
    it('formats with 6 decimal', () => {
      const amount = baseAmount(1234, 8)
      const result = formatBaseAsAssetAmount({ amount, decimal: 6 })
      expect(result).toEqual('0.000012')
    })
    it('formats with 6 decimal, but trims all zeros', () => {
      const amount = baseAmount(123400, 8)
      const result = formatBaseAsAssetAmount({ amount, decimal: 6, trimZeros: true })
      expect(result).toEqual('0.001234')
    })
  })
})
