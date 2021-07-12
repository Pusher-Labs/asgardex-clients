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
import { AssetLTC, BaseAmount, assetAmount, assetToBase, baseAmount } from '@xchainjs/xchain-util'
import * as Litecoin from 'bitcoinjs-lib'
import coininfo from 'coininfo'
import accumulative from 'coinselect/accumulative'

import { MIN_TX_FEE } from './const'
import * as nodeApi from './node-api'
import * as sochain from './sochain-api'
import { BroadcastTxParams, UTXO } from './types/common'
import { AddressParams, LtcAddressUTXO } from './types/sochain-api-types'

export const LTC_DECIMAL = 8

const TX_EMPTY_SIZE = 4 + 1 + 1 + 4 //10
const TX_INPUT_BASE = 32 + 4 + 1 + 4 // 41
const TX_INPUT_PUBKEYHASH = 107
const TX_OUTPUT_BASE = 8 + 1 //9
const TX_OUTPUT_PUBKEYHASH = 25

function inputBytes(input: UTXO): number {
  return TX_INPUT_BASE + (input.witnessUtxo.script ? input.witnessUtxo.script.length : TX_INPUT_PUBKEYHASH)
}

/**
 * Compile memo.
 *
 * @param {string} memo The memo to be compiled.
 * @returns {Buffer} The compiled memo.
 */
export const compileMemo = (memo: string): Buffer => {
  const data = Buffer.from(memo, 'utf8') // converts MEMO to buffer
  return Litecoin.script.compile([Litecoin.opcodes.OP_RETURN, data]) // Compile OP_RETURN script
}

/**
 * Get the transaction fee.
 *
 * @param {UTXO[]} inputs The UTXOs.
 * @param {FeeRate} feeRate The fee rate.
 * @param {Buffer} data The compiled memo (Optional).
 * @returns {number} The fee amount.
 */
export function getFee(inputs: UTXO[], feeRate: FeeRate, data: Buffer | null = null): number {
  let sum =
    TX_EMPTY_SIZE +
    inputs.reduce(function (a, x) {
      return a + inputBytes(x)
    }, 0) +
    inputs.length + // +1 byte for each input signature
    TX_OUTPUT_BASE +
    TX_OUTPUT_PUBKEYHASH +
    TX_OUTPUT_BASE +
    TX_OUTPUT_PUBKEYHASH

  if (data) {
    sum += TX_OUTPUT_BASE + data.length
  }
  const fee = sum * feeRate
  return fee > MIN_TX_FEE ? fee : MIN_TX_FEE
}

/**
 * Get the average value of an array.
 *
 * @param {number[]} array
 * @returns {number} The average value.
 */
export function arrayAverage(array: number[]): number {
  let sum = 0
  array.forEach((value) => (sum += value))
  return sum / array.length
}

/**
 * Get Litecoin network to be used with bitcoinjs.
 *
 * @param {Network} network
 * @returns {Litecoin.Network} The LTC network.
 */
export const ltcNetwork = (network: Network): Litecoin.Network => {
  switch (network) {
    case Network.Mainnet:
      return coininfo.litecoin.main.toBitcoinJS()
    case Network.Testnet:
      return coininfo.litecoin.test.toBitcoinJS()
  }
}

/**
 * Get the balances of an address.
 *
 * @param {AddressParams} params
 * @returns {Balance[]} The balances of the given address.
 */
export const getBalance = async (params: AddressParams): Promise<Balance[]> => {
  try {
    const balance = await sochain.getBalance(params)
    return [
      {
        asset: AssetLTC,
        amount: balance,
      },
    ]
  } catch (error) {
    throw new Error(`Could not get balances for address ${params.address}`)
  }
}

/**
 * Validate the LTC address.
 *
 * @param {string} address
 * @param {Network} network
 * @returns {boolean} `true` or `false`.
 */
export const validateAddress = (address: Address, network: Network): boolean => {
  try {
    Litecoin.address.toOutputScript(address, ltcNetwork(network))
    return true
  } catch (error) {
    return false
  }
}

/**
 * Scan UTXOs from sochain.
 *
 * @param {AddressParams} params
 * @returns {UTXO[]} The UTXOs of the given address.
 */
export const scanUTXOs = async (params: AddressParams): Promise<UTXO[]> => {
  const utxos: LtcAddressUTXO[] = await sochain.getUnspentTxs(params)

  return utxos.map(
    (utxo) =>
      ({
        hash: utxo.txid,
        index: utxo.output_no,
        value: assetToBase(assetAmount(utxo.value, LTC_DECIMAL)).amount().toNumber(),
        witnessUtxo: {
          value: assetToBase(assetAmount(utxo.value, LTC_DECIMAL)).amount().toNumber(),
          script: Buffer.from(utxo.script_hex, 'hex'),
        },
      } as UTXO),
  )
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
}: TxParams & {
  feeRate: FeeRate
  sender: Address
  network: Network
  sochainUrl: string
}): Promise<{ psbt: Litecoin.Psbt; utxos: UTXO[] }> => {
  if (!validateAddress(recipient, network)) throw new Error('Invalid address')

  const utxos = await scanUTXOs({ sochainUrl, network, address: sender })
  if (utxos.length === 0) throw new Error('No utxos to send')

  const feeRateWhole = Number(feeRate.toFixed(0))
  const compiledMemo = memo ? compileMemo(memo) : null

  const targetOutputs = []
  //1. output to recipient
  targetOutputs.push({
    address: recipient,
    value: amount.amount().toNumber(),
  })
  //2. add output memo to targets (optional)
  if (compiledMemo) {
    targetOutputs.push({ script: compiledMemo, value: 0 })
  }
  const { inputs, outputs } = accumulative(utxos, targetOutputs, feeRateWhole)

  // .inputs and .outputs will be undefined if no solution was found
  if (!inputs || !outputs) throw new Error('Balance insufficient for transaction')

  const psbt = new Litecoin.Psbt({ network: ltcNetwork(network) }) // Network-specific
  //Inputs
  inputs.forEach((utxo: UTXO) =>
    psbt.addInput({
      hash: utxo.hash,
      index: utxo.index,
      witnessUtxo: utxo.witnessUtxo,
    }),
  )

  // Outputs
  outputs.forEach((output: Litecoin.PsbtTxOutput) => {
    if (!output.address) {
      //an empty address means this is the  change ddress
      output.address = sender
    }
    if (!output.script) {
      psbt.addOutput(output)
    } else {
      //we need to add the compiled memo this way to
      //avoid dust error tx when accumulating memo output with 0 value
      if (compiledMemo) {
        psbt.addOutput({ script: compiledMemo, value: 0 })
      }
    }
  })

  return { psbt, utxos }
}

/**
 * Broadcast the transaction.
 *
 * @param {BroadcastTxParams} params The transaction broadcast options.
 * @returns {TxHash} The transaction hash.
 */
export const broadcastTx = async (params: BroadcastTxParams): Promise<TxHash> => {
  return await nodeApi.broadcastTx(params)
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
