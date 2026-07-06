/**
 * Browser and Node compatible byte utilities (no Buffer dependency).
 */

export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

export function hexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex
    const bytes = new Uint8Array(clean.length / 2)
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
}

export function stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str)
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false
    return a.every((v, i) => v === b[i])
}

export function bytesToBigInt(bytes: Uint8Array): bigint {
    let value = 0n
    for (const byte of bytes) {
        value = (value << 8n) | BigInt(byte)
    }
    return value
}
