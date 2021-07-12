import {
  Address,
  Balance,
  FeeOption,
  FeeRate,
  Fees,
  FeesWithRates,
  Network,
  TxHash,
  TxParams,
  calcFees,
  standardFeeRates,
} from '@xchainjs/xchain-client'
import { AssetBTC, BaseAmount, assetAmount, assetToBase, baseAmount } from '@xchainjs/xchain-util'
import * as Bitcoin from 'bitcoinjs-lib'
import accumulative from 'coinselect/accumulative'

import * as blockStream from './blockstream-api'
import { BTC_DECIMAL, MIN_TX_FEE } from './const'
import * as haskoinApi from './haskoin-api'
import * as sochain from './sochain-api'
import { BroadcastTxParams, UTXO } from './types/common'
import { AddressParams, BtcAddressUTXO, ScanUTXOParam } from './types/sochain-api-types'

const TX_EMPTY_SIZE = 4 + 1 + 1 + 4 //10
const TX_INPUT_BASE = 32 + 4 + 1 + 4 // 41
const TX_INPUT_PUBKEYHASH = 107
const TX_OUTPUT_BASE = 8 + 1 //9
const TX_OUTPUT_PUBKEYHASH = 25

const inputBytes = (input: UTXO): number => {
  return TX_INPUT_BASE + (input.witnessUtxo.script?.length ?? TX_INPUT_PUBKEYHASH)
}

/**
 * Compile memo.
 *
 * @param {string} memo The memo to be compiled.
 * @returns {Buffer} The compiled memo.
 */
export const compileMemo = (memo: string): Buffer => {
  const data = Buffer.from(memo, 'utf8') // converts MEMO to buffer
  return Bitcoin.script.compile([Bitcoin.opcodes.OP_RETURN, data]) // Compile OP_RETURN script
}

/**
 * Get the transaction fee.
 *
 * @param {UTXO[]} inputs The UTXOs.
 * @param {FeeRate} feeRate The fee rate.
 * @param {Buffer} data The compiled memo (Optional).
 * @returns {number} The fee amount.
 */
export const getFee = (inputs: UTXO[], feeRate: FeeRate, data: Buffer | null = null): number => {
  let sum =
    TX_EMPTY_SIZE +
    inputs.reduce((a, x) => a + inputBytes(x), 0) +
    inputs.length + // +1 byte for each input signature
    TX_OUTPUT_BASE +
    TX_OUTPUT_PUBKEYHASH +
    TX_OUTPUT_BASE +
    TX_OUTPUT_PUBKEYHASH

  if (data) sum += TX_OUTPUT_BASE + data.length

  const fee = sum * feeRate
  return fee > MIN_TX_FEE ? fee : MIN_TX_FEE
}

/**
 * Get the average value of an array.
 *
 * @param {number[]} array
 * @returns {number} The average value.
 */
export const arrayAverage = (array: number[]): number => {
  let sum = 0
  array.forEach((value) => (sum += value))
  return sum / array.length
}

/**
 * Get Bitcoin network to be used with bitcoinjs.
 *
 * @param {Network} network
 * @returns {Bitcoin.Network} The BTC network.
 */
export const btcNetwork = (network: Network): Bitcoin.Network => {
  switch (network) {
    case Network.Mainnet:
      return Bitcoin.networks.bitcoin
    case Network.Testnet:
      return Bitcoin.networks.testnet
  }
}

/**
 * Get the balances of an address.
 *
 * @param {string} sochainUrl sochain Node URL.
 * @param {Network} network
 * @param {Address} address
 * @returns {Balance[]} The balances of the given address.
 */
export const getBalance = async (params: AddressParams): Promise<Balance[]> => {
  switch (params.network) {
    case Network.Mainnet:
      return [
        {
          asset: AssetBTC,
          amount: await haskoinApi.getBalance(params.address),
        },
      ]
    case Network.Testnet:
      return [
        {
          asset: AssetBTC,
          amount: await sochain.getBalance(params),
        },
      ]
  }
}

/**
 * Validate the BTC address.
 *
 * @param {Address} address
 * @param {Network} network
 * @returns {boolean} `true` or `false`.
 */
export const validateAddress = (address: Address, network: Bitcoin.Network): boolean => {
  try {
    Bitcoin.address.toOutputScript(address, network)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Scan UTXOs from sochain.
 *
 * @param {string} sochainUrl sochain Node URL.
 * @param {Network} network
 * @param {Address} address
 * @returns {UTXO[]} The UTXOs of the given address.
 */
export const scanUTXOs = async ({
  sochainUrl,
  network,
  address,
  confirmedOnly = true, // default: scan only confirmed UTXOs
}: ScanUTXOParam): Promise<UTXO[]> => {
  switch (network) {
    case Network.Testnet: {
      let utxos: BtcAddressUTXO[] = []

      const addressParam: AddressParams = {
        sochainUrl,
        network,
        address,
      }

      if (confirmedOnly) {
        utxos = await sochain.getConfirmedUnspentTxs(addressParam)
      } else {
        utxos = await sochain.getUnspentTxs(addressParam)
      }

      return utxos.map(
        (utxo) =>
          ({
            hash: utxo.txid,
            index: utxo.output_no,
            value: assetToBase(assetAmount(utxo.value, BTC_DECIMAL)).amount().toNumber(),
            witnessUtxo: {
              value: assetToBase(assetAmount(utxo.value, BTC_DECIMAL)).amount().toNumber(),
              script: Buffer.from(utxo.script_hex, 'hex'),
            },
          } as UTXO),
      )
    }
    case Network.Mainnet: {
      let utxos: haskoinApi.UtxoData[] = []

      if (confirmedOnly) {
        utxos = await haskoinApi.getConfirmedUnspentTxs(address)
      } else {
        utxos = await haskoinApi.getUnspentTxs(address)
      }

      return utxos.map(
        (utxo) =>
          ({
            hash: utxo.txid,
            index: utxo.index,
            value: baseAmount(utxo.value, BTC_DECIMAL).amount().toNumber(),
            witnessUtxo: {
              value: baseAmount(utxo.value, BTC_DECIMAL).amount().toNumber(),
              script: Buffer.from(utxo.pkscript, 'hex'),
            },
          } as UTXO),
      )
    }
  }
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
  sochainUrl,
  spendPendingUTXO = false, // default: prevent spending uncomfirmed UTXOs
}: TxParams & {
  feeRate: FeeRate
  sender: Address
  network: Network
  sochainUrl: string
  spendPendingUTXO?: boolean
}): Promise<{ psbt: Bitcoin.Psbt; utxos: UTXO[] }> => {
  // search only confirmed UTXOs if pending UTXO is not allowed
  const confirmedOnly = !spendPendingUTXO
  const utxos = await scanUTXOs({ sochainUrl, network, address: sender, confirmedOnly })

  if (utxos.length === 0) throw new Error('No utxos to send')
  if (!validateAddress(recipient, btcNetwork(network))) throw new Error('Invalid address')

  const feeRateWhole = Number(feeRate.toFixed(0))
  const compiledMemo = memo && compileMemo(memo)

  const targetOutputs = []

  // 1. add output amount and recipient to targets
  targetOutputs.push({
    address: recipient,
    value: amount.amount().toNumber(),
  })

  // 2. add output memo to targets (optional)
  if (compiledMemo) targetOutputs.push({ script: compiledMemo, value: 0 })
  const { inputs, outputs } = accumulative(utxos, targetOutputs, feeRateWhole) as {
    inputs?: UTXO[]
    outputs?: Bitcoin.PsbtTxOutput[]
  }

  // .inputs and .outputs will be undefined if no solution was found
  if (!inputs || !outputs) throw new Error('Insufficient Balance for transaction')

  const psbt = new Bitcoin.Psbt({ network: btcNetwork(network) }) // Network-specific

  // psbt add input from accumulative inputs
  for (const utxo of inputs) {
    psbt.addInput({
      hash: utxo.hash,
      index: utxo.index,
      witnessUtxo: utxo.witnessUtxo,
    })
  }

  // psbt add outputs from accumulative outputs
  for (const output of outputs) {
    // an empty address means this is the  change ddress
    if (!output.address) output.address = sender
    if (!output.script) {
      psbt.addOutput(output)
    } else {
      // we need to add the compiled memo this way to
      // avoid dust error tx when accumulating memo output with 0 value
      if (compiledMemo) psbt.addOutput({ script: compiledMemo, value: 0 })
    }
  }

  return { psbt, utxos }
}

/**
 * Broadcast the transaction.
 *
 * @param {BroadcastTxParams} params The transaction broadcast options.
 * @returns {TxHash} The transaction hash.
 */
export const broadcastTx = async ({ network, txHex, blockstreamUrl }: BroadcastTxParams): Promise<TxHash> => {
  return await blockStream.broadcastTx({ network, txHex, blockstreamUrl })
}

/**
 * Calculate fees based on fee rate and memo.
 *
 * @param {FeeRate} feeRate
 * @param {string} memo
 * @returns {BaseAmount} The calculated fees based on fee rate and the memo.
 */
export const calcFee = (feeRate: FeeRate, memo?: string): BaseAmount => {
  const compiledMemo = memo ? compileMemo(memo) : null
  const fee = getFee([], feeRate, compiledMemo)
  return baseAmount(fee)
}

/**
 * Get the default fees with rates.
 *
 * @returns {FeesWithRates} The default fees and rates.
 */
export const getDefaultFeesWithRates = (): FeesWithRates => {
  const rates = {
    ...standardFeeRates(20),
    [FeeOption.Fastest]: 50,
  }

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
