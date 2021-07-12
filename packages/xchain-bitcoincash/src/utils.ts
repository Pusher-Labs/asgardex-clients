import * as bitcash from '@psf/bitcoincashjs-lib'
import {
  Address,
  Balance,
  FeeRate,
  Fees,
  FeesWithRates,
  Network,
  Tx,
  TxFrom,
  TxParams,
  TxTo,
  TxType,
  calcFees,
  standardFeeRates,
} from '@xchainjs/xchain-client'
import { AssetBCH, BaseAmount, baseAmount } from '@xchainjs/xchain-util'
import * as bchaddr from 'bchaddrjs'
import coininfo from 'coininfo'
import accumulative from 'coinselect/accumulative'

import { getAccount, getRawTransaction, getUnspentTransactions } from './haskoin-api'
import { AddressParams, Transaction, TransactionInput, TransactionOutput, UTXO } from './types'
import { Network as BCHNetwork, TransactionBuilder } from './types/bitcoincashjs-types'

export const BCH_DECIMAL = 8
export const DEFAULT_SUGGESTED_TRANSACTION_FEE = 1

const TX_EMPTY_SIZE = 4 + 1 + 1 + 4 //10
const TX_INPUT_BASE = 32 + 4 + 1 + 4 // 41
const TX_INPUT_PUBKEYHASH = 107
const TX_OUTPUT_BASE = 8 + 1 //9
const TX_OUTPUT_PUBKEYHASH = 25

/**
 * Compile memo.
 *
 * @param {string} memo The memo to be compiled.
 * @returns {Buffer} The compiled memo.
 */
export const compileMemo = (memo: string): Buffer => {
  const data = Buffer.from(memo, 'utf8') // converts MEMO to buffer
  return bitcash.script.compile([bitcash.opcodes.OP_RETURN, data]) // Compile OP_RETURN script
}

/**
 * Get the transaction fee.
 *
 * reference to https://github.com/Permissionless-Software-Foundation/bch-js/blob/acc0300a444059d612daec2564da743c11e27139/src/bitcoincash.js#L408
 *
 * @param {number} inputs The inputs count.
 * @param {number} outputs The outputs count.
 * @param {FeeRate} feeRate The fee rate.
 * @param {Buffer} data The compiled memo (Optional).
 * @returns {number} The fee amount.
 */
export function getFee(inputs: number, feeRate: FeeRate, data: Buffer | null = null): number {
  let totalWeight = TX_EMPTY_SIZE

  totalWeight += (TX_INPUT_PUBKEYHASH + TX_INPUT_BASE) * inputs
  totalWeight += (TX_OUTPUT_BASE + TX_OUTPUT_PUBKEYHASH) * 2
  if (data) {
    totalWeight += 9 + data.length
  }

  return Math.ceil(totalWeight * feeRate)
}

/**
 * Get the balances of an address.
 *
 * @param {AddressParams} params
 * @returns {Balance[]} The balances of the given address.
 */
export const getBalance = async (params: AddressParams): Promise<Balance[]> => {
  const account = await getAccount(params)
  if (!account) throw new Error('BCH balance not found')

  const confirmed = baseAmount(account.confirmed, BCH_DECIMAL)
  const unconfirmed = baseAmount(account.unconfirmed, BCH_DECIMAL)

  account.confirmed
  return [
    {
      asset: AssetBCH,
      amount: baseAmount(confirmed.amount().plus(unconfirmed.amount()), BCH_DECIMAL),
    },
  ]
}

/**
 * Get BCH network to be used with bitcore-lib.
 *
 * @param {Network} network
 * @returns {} The BCH network.
 */
export const bchNetwork = (network: Network): BCHNetwork => {
  switch (network) {
    case Network.Mainnet:
      return coininfo.bitcoincash.main.toBitcoinJS()
    case Network.Testnet:
      return coininfo.bitcoincash.test.toBitcoinJS()
  }
}

/**
 * Strips bchtest or bitcoincash prefix from address
 *
 * @param {Address} address
 * @returns {Address} The address with prefix removed
 *
 */
export const stripPrefix = (address: Address): Address => address.replace(/(bchtest:|bitcoincash:)/, '')

/**
 * Convert to Legacy Address.
 *
 * @param {Address} address
 * @returns {Address} Legacy address.
 */
export const toLegacyAddress = (address: Address): Address => {
  return bchaddr.toLegacyAddress(address)
}

/**
 * Convert to Cash Address.
 *
 * @param {Address} address
 * @returns {Address} Cash address.
 */
export const toCashAddress = (address: Address): Address => {
  return bchaddr.toCashAddress(address)
}

/**
 * Parse transaction.
 *
 * @param {Transaction} tx
 * @returns {Tx} Parsed transaction.
 *
 **/
export const parseTransaction = (tx: Transaction): Tx => {
  return {
    asset: AssetBCH,
    from: tx.inputs
      // For correct type inference `Array.prototype.filter` needs manual type guard to be defined
      .filter((input): input is Omit<TransactionInput, 'address'> & { address: string } => !!input.address)
      .map(
        (input) =>
          ({
            from: stripPrefix(input.address),
            amount: baseAmount(input.value, BCH_DECIMAL),
          } as TxFrom),
      ),
    to: tx.outputs
      // For correct type inference `Array.prototype.filter` needs manual type guard to be defined
      .filter((output): output is Omit<TransactionOutput, 'address'> & { address: string } => !!output.address)
      .map(
        (output) =>
          ({
            to: stripPrefix(output.address),
            amount: baseAmount(output.value, BCH_DECIMAL),
          } as TxTo),
      ),
    date: new Date(tx.time * 1000),
    type: TxType.Transfer,
    hash: tx.txid,
  }
}

/**
 * Converts `Network` to `bchaddr.Network`
 *
 * @param {Network} network
 * @returns {string} bchaddr network
 */
export const toBCHAddressNetwork = (network: Network): string => {
  switch (network) {
    case Network.Mainnet:
      return bchaddr.Network.Mainnet
    case Network.Testnet:
      return bchaddr.Network.Testnet
  }
}

/**
 * Validate the BCH address.
 *
 * @param {string} address
 * @param {Network} network
 * @returns {boolean} `true` or `false`.
 */
export const validateAddress = (address: string, network: Network): boolean => {
  const toAddress = toCashAddress(address)
  return bchaddr.isValidAddress(toAddress) && bchaddr.detectAddressNetwork(toAddress) === toBCHAddressNetwork(network)
}
/**
 * Scan UTXOs from sochain.
 *
 * @param {string} haskoinUrl sochain Node URL.
 * @param {Address} address
 * @returns {UTXO[]} The UTXOs of the given address.
 */
export const scanUTXOs = async (haskoinUrl: string, address: Address): Promise<UTXO[]> => {
  const unspents = await getUnspentTransactions({ haskoinUrl, address })
  const utxos: UTXO[] = []

  for (const utxo of unspents || []) {
    utxos.push({
      hash: utxo.txid,
      value: utxo.value,
      index: utxo.index,
      witnessUtxo: {
        value: utxo.value,
        script: bitcash.script.compile(Buffer.from(utxo.pkscript, 'hex')),
      },
      address: utxo.address,
      txHex: await getRawTransaction({ haskoinUrl, txId: utxo.txid }),
    } as UTXO)
  }

  return utxos
}

/**
 * Build transcation.
 *
 * @param {BuildParams} params The transaction build options.
 * @returns {Transaction}
 */
export const buildTx = async ({
  amount,
  recipient,
  memo,
  feeRate,
  sender,
  network,
  haskoinUrl,
}: TxParams & {
  feeRate: FeeRate
  sender: Address
  network: Network
  haskoinUrl: string
}): Promise<{
  builder: TransactionBuilder
  utxos: UTXO[]
}> => {
  const recipientCashAddress = toCashAddress(recipient)
  if (!validateAddress(recipientCashAddress, network)) throw new Error('Invalid address')

  const utxos = await scanUTXOs(haskoinUrl, sender)
  if (utxos.length === 0) throw new Error('No utxos to send')

  const feeRateWhole = Number(feeRate.toFixed(0))
  const compiledMemo = memo ? compileMemo(memo) : null

  const targetOutputs = []
  // output to recipient
  targetOutputs.push({
    address: recipient,
    value: amount.amount().toNumber(),
  })
  const { inputs, outputs } = accumulative(utxos, targetOutputs, feeRateWhole)

  // .inputs and .outputs will be undefined if no solution was found
  if (!inputs || !outputs) throw new Error('Balance insufficient for transaction')

  const transactionBuilder = new bitcash.TransactionBuilder(bchNetwork(network))

  //Inputs
  inputs.forEach((utxo: UTXO) =>
    transactionBuilder.addInput(bitcash.Transaction.fromBuffer(Buffer.from(utxo.txHex, 'hex')), utxo.index),
  )

  // Outputs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outputs.forEach((output: any) => {
    let out = undefined
    if (!output.address) {
      //an empty address means this is the  change address
      out = bitcash.address.toOutputScript(toLegacyAddress(sender), bchNetwork(network))
    } else if (output.address) {
      out = bitcash.address.toOutputScript(toLegacyAddress(output.address), bchNetwork(network))
    }
    transactionBuilder.addOutput(out, output.value)
  })

  // add output for memo
  if (compiledMemo) {
    transactionBuilder.addOutput(compiledMemo, 0) // Add OP_RETURN {script, value}
  }

  return {
    builder: transactionBuilder,
    utxos,
  }
}

/**
 * Calculate fees based on fee rate and memo.
 *
 * @param {FeeRate} feeRate
 * @param {string} memo (optional)
 * @param {UnspentOutput} utxos (optional)
 * @returns {BaseAmount} The calculated fees based on fee rate and the memo.
 */
export const calcFee = (feeRate: FeeRate, memo?: string, utxos: UTXO[] = []): BaseAmount => {
  const compiledMemo = memo ? compileMemo(memo) : null
  const fee = getFee(utxos.length, feeRate, compiledMemo)
  return baseAmount(fee)
}

/**
 * Get the default fees with rates.
 *
 * @returns {FeesWithRates} The default fees and rates.
 */
export const getDefaultFeesWithRates = (): FeesWithRates => {
  const nextBlockFeeRate = 1
  const rates = standardFeeRates(nextBlockFeeRate)

  return {
    fees: calcFees(rates, calcFee),
    rates,
  }
}

/**
 * Get the default fees.
 *
 * @returns {Fees} The default fees.
 */
export const getDefaultFees = (): Fees => {
  const { fees } = getDefaultFeesWithRates()
  return fees
}
