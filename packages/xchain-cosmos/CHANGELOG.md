# v.0.13.4 (2021-06-30)

- update getBalance such that it always returns at least the mainAsset

# v.0.13.3 (2021-06-29)

### Fix

- Stick with `cosmos-client@0.39.2`

# v.0.13.1 (2021-06-01)

- updated peer deps

# v.0.13.0 (2021-05-17)

### Breaking change

- added support for HD wallets

# v.0.12.0 (2021-05-05)

### Breaking change

- Latest @xchainjs/xchain-client@0.8.0
- Latest @xchainjs/xchain-util@0.2.7

# v.0.11.0 (2021-03-02)

### Breaking change

- replace `find`, `findIndex`
- Update @xchainjs/xchain-client package to 0.7.0

# v.0.10.0 (2021-02-24)

### Breaking change

- Update @xchainjs/xchain-client package to 0.6.0
- Update `getBalance`

# v.0.9.0 (2021-02-19)

### Breaking change

- Update @xchainjs/xchain-client package to 0.5.0

### Update

- Update @xchainjs/xchain-client package to 0.5.0
- Add `Service Providers` section in README.md

### Fix

- Fix `peerDependencies`

# v.0.8.1 (2021-02-05)

### Update

- Add transfer.sender, transfer.recipient option for transaction search.

### Breaking change

- Update @xchainjs/xchain-client package to 0.4.0
- Update @xchainjs/xchain-crypto package to 0.2.3
- Update @xchainjs/xchain-util package to 0.2.2

# v.0.8.0 (2021-02-03)

### Update

- Add `searchTxFromRPC` : search transactions using tendermint rpc.

# v.0.7.1 (2021-01-30)

- Clear lib folder on build

# v.0.7.0 (2021-01-15)

### Update

- Update comments for documentation
- Add `getPrefix`

### Breaking change

- Remove `deposit`

# v.0.6.0 (2020-12-28)

### Breaking change

- Extract `getDefaultFees` from `Client` to `utils` #157
- Remove `validateAddress` from `CosmosClient`

# v.0.5.1 (2020-12-16)

### Update

- Extract `signAndBroadcast` from `transfer`

# v.0.5.0 (2020-12-11)

### Update

- Update dependencies
- Move `cosmos-client` to `dependencies`
- Add `getDefaultFees`

# v.0.4.2 (2020-11-23)

### Fix imports

- Fix imports of `cosmos/codec`

# v.0.4.1 (2020-11-23)

### Update

- Update to latest `@xchainjs/*` packages and other dependencies

# v.0.4.0 (2020-11-20)

### Breaking change

- Update @xchainjs/xchain-crypto package to 0.2.0, deprecating old keystores
