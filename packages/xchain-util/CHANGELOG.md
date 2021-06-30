# v.0.2.9 (2021-06-30)

- update getBalance such that it always returns at least RUNE


# v.0.2.7 (2021-03-16)

### Breaking changes

- Remove decimal of division result + Round down

# v.0.2.6 (2021-03-16)

### Update

- Extend BaseAmount/AssetAmount to support basic arithmetic operations(add, minus, times, div)
- Extend BaseAmount/AssetAmount to support basic comparison
- Add type guard `isBigNumberValue` for BigNumber.Value

# v.0.2.5 (2021-03-04)

### Breaking change

- Update `formatAssetAmountCurrency` to remove bracket.

# v.0.2.4 (2021-03-01)

### Update

- Update `chainToString` to support Bitcoin cash.

# v.0.2.3 (2021-02-09)

### Fix

- Added strict checks for undefined values at `formatAssetAmountCurrency` and `formatAssetAmount`

### Update

- Add `AssetBCH`

# v.0.2.2 (2021-01-30)

### Fix

- Clear lib folder on build
- Fixes linting from redeclaring Litecoin in chain consts twice

### Update

- add Bitcoin Cash chain const.
- add Litecoin chain const.

# v.0.2.1 (2021-01-08)

### Fix

- `assetToBase` ignores `decimal` #174

### Update

- Update comments for documentation

# v.0.2.0 (2020-12-11)

### Update

- Update dependencies
- Add chain const for `cosmos` and `polkadot`

### Breaking change

- Remove `swap`, `stake`, `memo` modules (to be part of `asgardex-utils` only)
