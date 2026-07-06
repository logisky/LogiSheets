/**
 * Sparse Merkle Tree implementation for browser/Node environments.
 *
 * Uses the Web Crypto API (or Node crypto) for SHA-256. Tree depth is 256.
 */

import type {Formula, MerkleProof} from './types'
import {bytesEqual, bytesToHex} from './bytes'

const TREE_DEPTH = 256

async function sha256(data: Uint8Array): Promise<Uint8Array> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', data)
        return new Uint8Array(buf)
    }
    // Node.js fallback
    const {createHash} = await import('crypto')
    return new Uint8Array(createHash('sha256').update(data).digest())
}

async function emptyLeafHash(): Promise<Uint8Array> {
    return sha256(new Uint8Array(32))
}

async function nodeHash(left: Uint8Array, right: Uint8Array): Promise<Uint8Array> {
    const combined = new Uint8Array(64)
    combined.set(left)
    combined.set(right, 32)
    return sha256(combined)
}

async function leafHash(id: Uint8Array, commitment: Uint8Array): Promise<Uint8Array> {
    const combined = new Uint8Array(64)
    combined.set(id)
    combined.set(commitment, 32)
    return sha256(combined)
}

function bitAt(id: Uint8Array, index: number): boolean {
    const byteIndex = Math.floor(index / 8)
    const bitIndex = index % 8
    return ((id[byteIndex] >> bitIndex) & 1) === 1
}

function bitsToBytes(bits: boolean[]): Uint8Array {
    const bytes = new Uint8Array(Math.ceil(bits.length / 8))
    bits.forEach((bit, i) => {
        if (bit) bytes[Math.floor(i / 8)] |= 1 << (i % 8)
    })
    return bytes
}

function bytesToBits(bytes: Uint8Array): boolean[] {
    const bits: boolean[] = []
    for (const byte of bytes) {
        for (let i = 0; i < 8; i++) {
            bits.push(((byte >> i) & 1) === 1)
        }
    }
    return bits
}

function extendPrefix(prefix: Uint8Array, bit: boolean): Uint8Array {
    const bits = bytesToBits(prefix)
    bits.push(bit)
    return bitsToBytes(bits)
}

function siblingPrefix(id: Uint8Array, level: number): Uint8Array {
    const bits: boolean[] = []
    for (let i = 0; i <= level; i++) {
        bits.push(bitAt(id, i))
    }
    bits[level] = !bits[level]
    return bitsToBytes(bits)
}

export class SparseMerkleTree {
    private leaves: Map<string, Uint8Array> = new Map()
    private cache: Map<string, Uint8Array> = new Map()

    private cacheKey(depth: number, prefix: Uint8Array): string {
        return `${depth}:${bytesToHex(prefix)}`
    }

    private invalidateCache(): void {
        this.cache.clear()
    }

    async insert(formula: Formula): Promise<void> {
        this.leaves.set(bytesToHex(formula.id), formulaCommitment(formula))
        this.invalidateCache()
    }

    async remove(id: Uint8Array): Promise<void> {
        this.leaves.delete(bytesToHex(id))
        this.invalidateCache()
    }

    async root(): Promise<Uint8Array> {
        return this.subtreeRoot(0, new Uint8Array(0))
    }

    async proof(id: Uint8Array): Promise<MerkleProof> {
        const siblings: Uint8Array[] = []
        for (let level = 0; level < TREE_DEPTH; level++) {
            const prefix = siblingPrefix(id, level)
            const siblingRoot = await this.subtreeRoot(level + 1, prefix)
            siblings.push(siblingRoot)
        }
        return {siblings}
    }

    private async subtreeRoot(depth: number, prefix: Uint8Array): Promise<Uint8Array> {
        const key = this.cacheKey(depth, prefix)
        const cached = this.cache.get(key)
        if (cached) return cached

        let root: Uint8Array
        if (depth === TREE_DEPTH) {
            const id = new Uint8Array(32)
            id.set(prefix)
            const commitment = this.leaves.get(bytesToHex(id))
            root = commitment ? await leafHash(id, commitment) : await emptyLeafHash()
        } else {
            const left = await this.subtreeRoot(depth + 1, extendPrefix(prefix, false))
            const right = await this.subtreeRoot(depth + 1, extendPrefix(prefix, true))
            root = await nodeHash(left, right)
        }

        this.cache.set(key, root)
        return root
    }
}

export function formulaCommitment(formula: Formula): Uint8Array {
    const combined = new Uint8Array(32 + formula.expression.length)
    combined.set(formula.id)
    combined.set(stringToBytes(formula.expression), 32)
    // Synchronous hash is acceptable for small commitments. Browser code should prefer async sha256.
    return sha256Sync(combined)
}

function stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str)
}

function sha256Sync(data: Uint8Array): Uint8Array {
    if (typeof require !== 'undefined') {
        const {createHash} = require('crypto')
        return new Uint8Array(createHash('sha256').update(data).digest())
    }
    throw new Error('Synchronous SHA-256 is not available in this environment')
}

export async function verifyMerkleProof(
    root: Uint8Array,
    id: Uint8Array,
    commitment: Uint8Array,
    proof: MerkleProof
): Promise<boolean> {
    if (proof.siblings.length !== TREE_DEPTH) return false

    let current = await leafHash(id, commitment)
    for (let level = 0; level < TREE_DEPTH; level++) {
        const sibling = proof.siblings[level]
        const bit = bitAt(id, level)
        current = bit ? await nodeHash(sibling, current) : await nodeHash(current, sibling)
    }
    return bytesEqual(current, root)
}
