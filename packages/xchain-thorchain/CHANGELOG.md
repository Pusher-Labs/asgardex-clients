# v.x.x.x

### Breaking change

- replace `find`, `findIndex`
  
# v.0.12.0 (2021-02-24)

### Breaking change

- Update @xchainjs/xchain-client package to 0.6.0
- Update @xchainjs/xchain-cosmos package to 0.10.0
- Update `getBalance`

# v.0.11.1 (2021-02-24)

### Breaking change

- Update @xchainjs/xchain-cosmos package to 0.9.0

### Fix

- Fix `getTransactions` - sort transactions from latest
- Fix `DECIMAL`

# v.0.11.0 (2021-02-19)

### Breaking change

- Update @xchainjs/xchain-client package to 0.5.0

### Update

- Add `Service Providers` section in README.md

### Fix

- Fix `peerDependencies`

# v.0.10.1 (2021-02-05)

### Update

- Update `getTransactions` to support incoming transactions

### Breaking change

- Update @xchainjs/xchain-client package to 0.4.0
- Update @xchainjs/xchain-crypto package to 0.2.3

# v.0.10.0 (2021-02-03)

### Breaking changes

- Change `getTransactions` to use tendermint rpc. (transaction query from the latest ones.)

# v.0.9.3 (2021-02-02)

### Update

- Add `getExplorerNodeUrl`

# v.0.9.2 (2021-01-30)

- Clear lib folder on build

# v.0.9.1 (2021-01-26)

### Fix

- Fix `deposit`. Use `/thorchain/deposit` to build a deposit transaction.

# v.0.9.0 (2021-01-15)

### Breaking change

- Move `getPrefix` to util

# v.0.8.0 (2021-01-13)

### Breaking change

- change MsgNativeTx.fromJson

# v.0.7.1 (2021-01-06)

### Fix

- Fix getTransactions pagination issue #168

### Update

- Update comments for documentation

# v.0.7.0 (2020-12-28)

### Breaking change

- Extract `getDefaultFees` from `Client` to `utils` #157

# v.0.6.2 (2020-12-23)

### Update

- Use latest xchain-client@0.2.1

### Fix

- Fix invalid assets comparison #151

### Breaking change

- Remove `validateAddress` from `ThorchainClient` #149

# v.0.6.1 (2020-12-18)

### Update

- Add `setClientUrl`
- Add `getDefaultClientUrl`
- Add `getClientUrlByNetwork`

### Fix

- Fix client url for multichain testnet (`https://testnet.thornode.thorchain.info`)

# v.0.6.0 (2020-12-16)

### Update

- Set the latest multi-chain node
- Update `getTransactionData`, `getTransactions`
- Update `transfer` (for `MsgSend`)
- Update `deposit` (for `MsgNativeTx`)

# v.0.5.0 (2020-12-11)

### Update

- Update dependencies
- Add `getDefaultFees`

# v.0.4.2 (2020-11-23)

### Fix

- Fix import of `cosmos/codec`

### Update

- Use latest `@xchainjs/cosmos@0.4.2`

# v.0.4.1 (2020-11-23)

### Update

- Update to latest `@xchainjs/*` packages and other dependencies

# v.0.4.0 (2020-11-20)

### Breaking change

- Update @xchainjs/xchain-crypto package to 0.2.0, deprecating old keystores
