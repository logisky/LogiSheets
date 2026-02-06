/**
 * License verification module for Worker context
 * Uses WebCrypto API (zero dependencies)
 * Uses ECDSA P-256 for signature verification
 *
 * This module runs INSIDE the worker, so license validation cannot be bypassed
 * by sending direct messages to the worker.
 *
 * PUBLIC KEY OBFUSCATION:
 * The public key is stored as encoded fragments to prevent easy discovery.
 * Run `node scripts/license-cli.mjs generate-keys` to get the fragments.
 */
export interface License {
    domain: string;
    issuedAt: number;
    validDays: number;
    signature: string;
}
export interface LicenseStatus {
    valid: boolean;
    reason?: string;
}
/**
 * Validate a license key and return the status
 * This is called inside the worker - no way to bypass it
 */
export declare function validateLicenseInWorker(apiKey: string, currentDomain: string): Promise<LicenseStatus>;
