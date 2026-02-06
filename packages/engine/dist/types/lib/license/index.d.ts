/**
 * License verification module using WebCrypto API (zero dependencies)
 * Uses ECDSA P-256 for signature verification
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
 * Parse and validate a license key
 */
export declare function validateLicense(apiKey: string): Promise<LicenseStatus>;
/**
 * Check if license is currently valid
 */
export declare function isLicenseValid(): boolean;
/**
 * Clear current license
 */
export declare function clearLicense(): void;
