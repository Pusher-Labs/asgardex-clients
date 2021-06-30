# v.5.2.2 (2021-06-30)

- update getBalance such that it always returns at least BNB


# v.5.2.1 (2021-06-01)

- update peerDependencies

# v.5.1.0 (2021-05-17)

### Breaking change

- added support for HD wallets

# v.5.0.0 (2021-05-05)

### Breaking change

- Latest @xchainjs/xchain-client@0.8.0
- Latest @xchainjs/xchain-util@0.2.7

# v.4.7.0 (2021-03-02)

### Breaking change

- replace `find`, `findIndex`
- Update @xchainjs/xchain-client package to 0.7.0

# v.4.6.0 (2021-02-24)

### Breaking change

- Update @xchainjs/xchain-client package to 0.6.0
- Update `getBalance`

# v.4.5.0 (2021-02-19)

### Breaking change

- Update @xchainjs/xchain-client package to 0.4.0
- Update @xchainjs/xchain-crypto package to 0.2.3

### Update

- Update @xchainjs/xchain-client package to 0.5.0
- Add `Service Providers` section in README.md
- Update `peerDependencies`

# v.4.4.2 (2021-01-30)

- Clear lib folder on build

# v.4.4.1 (2021-01-15)

### Change

- Export `getPrefix`

# v.4.4.0 (2021-01-15)

### Update

- Update comments for documentation
- Add `getPrefix`

# v.4.3.0 (2020-12-28)

### Breaking change

- Extract `getDefaultFees` from `Client` to `utils` #157
- Remove `validateAddress` from `BinanceClient`

# v.4.2.0 (2020-12-11)

### Update

- Update dependencies
- Add `getDefaultFees`
- Add `getSingleAndMultiFees`
- Add `getDerivePath` helper

# v.4.1.0 (2020-11-20)

### Breaking change

- Update @xchainjs/xchain-crypto package to 0.2.0, deprecating old keystores

# v.4.0.0 (2020-11-11)

### Breaking change

- Remove `freeze` and `unfreeze` related functions: `getFreezeFees()`, `freeze()`, `unfreeze()`, `getFreezeFees()`
- Ignore `freeze` and `unfreeze` txs in `parseTx()`
- Ignore `freeze` and `unfreeze` txs in `getTxType()`

# v.3.1.1 (2020-11-09)

### Change

- updated `xchain-client` package version

# v.3.1.0 (2020-11-06)

### Add

- `getTransactionData(txId: string): Promise<Tx>`

- `asset` parameter to the `getTransactions` method

### Change

- `getExplorerUrl` is public now

### Fix

- Fixed asset parsing for `getBalance` method

# v.3.0.1 (2020-08-26)

- Change type of `amount` to `BigSource` in `normalTx`, `vaultTx`, `freeze`, `unfreeze`

# v.3.0.0 (2020-08-26)

### Breaking changes:

- `Constructor` argument is an object now `{ network: Network; phrase?: string }`
- `getAddress` returns undefined if `phrase` has not been set before
- `getPrivateKey()` throws an error if `phrase` has not been set before
- `setPrivateKey` rejects if a `phase` has not been set before
- `vaultTx`, `normalTx`, `multiSend`, `getMarkets` accept an object as its parameters

### Add:

- `freeze(params: FreezeParams): Promise<TransferResult>`
- `unfreeze(params: FreezeParams): Promise<TransferResult>`
- `getBncClient(): BncClient`

### Fix:

- Fix `Rollup` warnings of `Unresolved dependencies` and `Circular dependencies`

### Update:

- Use latest npm dependencies

# v.2.1.1 (2020-08-14)

- Fix result type of `getFees()`

# v.2.1.0 (2020-08-14)

### Add:

- `getFees()`
- `TxFee`

# v.2.0.0 (2020-07-20)

- BREAKING CHANGE: `getTransactions` expects `GetTxsParams` as its parameter
- Refactored implementation of `getTransactions`
- Use latest `@binance-chain/javascript-sdk@4.0.5"
- Fix `Tx` type

# v.1.0.0 (2020-05-14)

Refactors the client to be constructed with a `net` and optional `phrase`

```
import BinanceClient, { Network } from '../src/client'
...
const net = Network.MAIN
const phrase = process.env.VAULT_PHRASE
const bnbClient = new BinanceClient(net, phrase)
```

### Removal:

- init()
- initClient()
- setPrivateKey()
- removePrivateKey()

### Change:

- getClientUrl(): string -> Class-based
- getExplorerUrl(): string -> Class-based
- getPrefix(): string -> Class-based

### Add:

- setNetwork(net: Network): void
- getNetwork(): Network
- generatePhrase(): string
- setPhrase(phrase?: string): void
- validatePhrase(phrase: string): boolean
- getAddress(): string
- validateAddress(address: string): boolean
- getBalance(address?: Address): Promise<Balance>
- getTransactions(address?: string): Promise<any[]>
- vaultTx(addressTo: Address, amount: number, asset: string, memo: string): Promise<TransferResult>
- normalTx(addressTo: Address, amount: number, asset: string): Promise<TransferResult>

# v.0.1.0 (2020-04-13)

First release
