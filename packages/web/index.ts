import initWasm, {format_number, format_text} from './wasm'

export {initWasm}

/**
 * Format a number with an Excel number-format code (e.g. "0.00%", "yyyy-mm-dd"),
 * natively via the Rust `ssf-rs` renderer compiled into the engine WASM. This
 * replaces the former dependency on the `ssf` npm package. The WASM module must
 * be initialized (via {@link initWasm}) before calling.
 */
export function formatNumber(fmt: string, value: number): string {
    return format_number(fmt, value)
}

/**
 * Format a text value with an Excel number-format code (the `@` text section).
 */
export function formatText(fmt: string, text: string): string {
    return format_text(fmt, text)
}

export * from './src'
