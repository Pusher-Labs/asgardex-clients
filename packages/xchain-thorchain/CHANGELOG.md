# v.0.17.1 (2021-06-22)

### Update

- update `getTransactionHistory`, `transfer`, `deposit` to support synth assets.

# v.0.17.0 (2021-06-21)

### Fix

- Fix `to` / `from` addresses by parsing tx data from event logs

### Breaking change

- Remove deprecated `getTxDataFromResponse` helper

# v.0.16.1 (2021-06-14)

### Fix

- Double `fee.gas to `20000000` (twenty million) to avoid failing withdraw transactions

# v.0.16.0 (2021-06-08)

### Breaking change

- Use `viewblock` as default explorer
- [types] Refactored structure of explorer urls (via `type ExplorerUrls`)
- [types] Refactored `ExplorerUrl`
- [client] Constructor accepts `ExplorerUrls`
- [client] Removed `getExplorerNodeUrl` (use `getExplorerAddressUrl` instead)
- [client] Extract `getDefaultClientUrl` into `utils`
- [utils] Renamed `getDefaultExplorerUrlByNetwork` -> `getDefaultExplorerUrl`
- [utils] Removed `getDefaultExplorerAddressUrl`, `getDefaultExplorerNodeUrl`, `getDefaultExplorerTxUrl`
- [utils] Added `getExplorerTxUrl`, `getExplorerAddressUrl`, `getExplorerUrl` helpers

# v.0.15.2 (2021-06-01)

### Update

- updated peer deps

# v.0.15.0 (2021-05-17)

### Breaking change

- added support for HD wallets

# v.0.14.0 (2021-05-05)

### Breaking change

- Latest @xchainjs/xchain-client@0.8.0
- Latest @xchainjs/xchain-util@0.2.7

# v.0.13.7 (2021-04-21)

### Update

- Export `MSG_SEND` `MSG_DEPOSIT` `MAX_COUNT`
- Added `getCosmosClient()`
- Extend `getTransactions` parameters with an optional `filterFn`

# v.0.13.6 (2021-04-16)

### Update

- Set `fee.gas` to `10000000` (ten million) in `deposit` due to failing withdraw transactions

# v.0.13.5 (2021-04-16)

### Update

- Set `fee.gas` to `1000000` (one million) in `deposit`

# v.0.13.4 (2021-04-16)

### Update

- Set `fee.gas` to `auto` in `deposit`
- Try sending `deposit` tx up to 3x
- Updates `DEFAULT_GAS_VALUE` to `2000000`

# v.0.13.3 (2021-04-12)

### Breaking changes

- Change `/addresses` to `/address` for explorer url.

### Update

- Add util helpers for explorer urls.

# v.0.13.2 (2021-04-01)

### Update

- Updates `getDefaultClientUrl` to use new mainnet endpoints

# v.0.13.1 (2021-03-18)

### Fix

- Changed `getDefaultExplorerUrl` to return valid urls

# v.0.13.0 (2021-03-02)

### Breaking change

- replace `find`, `findIndex`
- Update @xchainjs/xchain-client package to 0.7.0
- Update @xchainjs/xchain-cosmos package to 0.11.0

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
