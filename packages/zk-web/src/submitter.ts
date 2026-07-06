/**
 * On-chain submission helpers for LogiSheets ZK quarterly reports.
 *
 * The exported functions are library-agnostic and accept a `WriteClient`
 * abstraction. To use with viem, wrap your wallet client to implement the
 * `WriteClient` interface.
 */

import {FORMULA_REGISTRY_ABI, QUARTERLY_REPORT_ABI} from './contracts'
import {bytesToHex} from './bytes'
import type {Formula, ZkProof} from './types'
import {formulaCommitment} from './smt'

export interface WriteClient {
    writeContract(args: {
        address: `0x${string}`
        abi: readonly unknown[]
        functionName: string
        args: unknown[]
        account?: `0x${string}`
        value?: bigint
    }): Promise<`0x${string}`>
}

export interface ReadClient {
    readContract(args: {
        address: `0x${string}`
        abi: readonly unknown[]
        functionName: string
        args: unknown[]
    }): Promise<unknown>
}

export function bytes32ToHex(bytes: Uint8Array): `0x${string}` {
    return `0x${bytesToHex(bytes)}` as `0x${string}`
}

export function encodeJournal(
    formulaRoot: Uint8Array,
    outputs: Record<string, number>,
    decimals = 18
): Uint8Array {
    // Journal encoding matches Solidity `abi.decode(journal, (bytes32, string[], int256[]))`.
    // For browser/Node without ethers/viem, this is a placeholder. Use viem's `encodeAbiParameters`
    // in production.
    const keys = Object.keys(outputs)
    const values = Object.values(outputs).map((v) => BigInt(Math.round(v * 10 ** decimals)))

    // Minimal ABI encoding: 32-byte root, count of keys, count of values, keys data, values data.
    // This is intentionally simplified; replace with a proper ABI encoder before production use.
    const buf = new Uint8Array(32 + 32 + 32 + keys.length * 32 + values.length * 32)
    buf.set(formulaRoot, 0)
    writeUint32BE(buf, keys.length, 32)
    writeUint32BE(buf, values.length, 64)
    keys.forEach((k, i) => {
        const encoded = new TextEncoder().encode(k.padEnd(32, '\0'))
        buf.set(encoded.slice(0, 32), 96 + i * 32)
    })
    values.forEach((v, i) => {
        writeBigIntBE(buf, v, 96 + keys.length * 32 + i * 32, 32)
    })
    return buf
}

function writeUint32BE(buf: Uint8Array, value: number, offset: number): void {
    const view = new DataView(buf.buffer, buf.byteOffset)
    view.setUint32(offset, value, false)
}

function writeBigIntBE(buf: Uint8Array, value: bigint, offset: number, byteLength: number): void {
    const view = new DataView(buf.buffer, buf.byteOffset)
    const mask = (1n << BigInt(byteLength * 8)) - 1n
    const v = value & mask
    for (let i = 0; i < byteLength; i++) {
        view.setUint8(offset + byteLength - 1 - i, Number((v >> BigInt(i * 8)) & 0xffn))
    }
}

export async function registerFormulaOnChain(
    client: WriteClient,
    registryAddress: `0x${string}`,
    fundId: number,
    formula: Formula,
    newRoot: Uint8Array
): Promise<`0x${string}`> {
    return client.writeContract({
        address: registryAddress,
        abi: FORMULA_REGISTRY_ABI,
        functionName: 'registerFormula',
        args: [
            BigInt(fundId),
            bytes32ToHex(formula.id),
            bytes32ToHex(formulaCommitment(formula)),
            bytes32ToHex(newRoot),
        ],
    })
}

export async function submitReportOnChain(
    client: WriteClient,
    reportAddress: `0x${string}`,
    fundId: number,
    quarterId: number,
    formulaRoot: Uint8Array,
    outputs: Record<string, number>,
    proof: ZkProof
): Promise<`0x${string}`> {
    const journal = proof.journal.length > 0
        ? proof.journal
        : encodeJournal(formulaRoot, outputs)

    return client.writeContract({
        address: reportAddress,
        abi: QUARTERLY_REPORT_ABI,
        functionName: 'submitReport',
        args: [
            BigInt(fundId),
            BigInt(quarterId),
            bytes32ToHex(proof.seal),
            bytes32ToHex(proof.postStateDigest),
            bytes32ToHex(journal),
        ],
    })
}

export async function getFormulaRootOnChain(
    client: ReadClient,
    registryAddress: `0x${string}`,
    fundId: number
): Promise<Uint8Array> {
    const result = await client.readContract({
        address: registryAddress,
        abi: FORMULA_REGISTRY_ABI,
        functionName: 'getFormulaRoot',
        args: [BigInt(fundId)],
    })
    const hex = result as `0x${string}`
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex
    const bytes = new Uint8Array(clean.length / 2)
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
}
