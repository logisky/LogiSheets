#!/usr/bin/env node

/**
 * LogiSheets License Generator CLI
 *
 * Usage:
 *   # Generate a new key pair (run once, save private key securely!)
 *   node license-cli.mjs generate-keys
 *
 *   # Create a license for a domain
 *   node license-cli.mjs create-license --domain example.com --days 365 --private-key <base64-private-key>
 *
 *   # Verify a license (for testing)
 *   node license-cli.mjs verify --license <api-key>
 */

import { webcrypto } from "crypto";

const crypto = webcrypto;

// ============================================================================
// Key Generation with Obfuscation
// ============================================================================

function obfuscatePublicKey(publicKeyJwk) {
    // Generate a random XOR mask
    const mask = Math.floor(Math.random() * 200) + 10;
    
    // Convert JWK to base64
    const jsonStr = JSON.stringify(publicKeyJwk);
    const base64 = Buffer.from(jsonStr).toString('base64');
    
    // XOR encode and convert to hex (to avoid unprintable characters)
    const encoded = Array.from(base64)
        .map(c => (c.charCodeAt(0) ^ mask).toString(16).padStart(2, '0'))
        .join('');
    
    // Split into fragments (4 parts)
    const numFragments = 4;
    const fragLen = Math.ceil(encoded.length / numFragments);
    const fragments = [];
    for (let i = 0; i < encoded.length; i += fragLen) {
        fragments.push(encoded.slice(i, i + fragLen));
    }
    
    return { fragments, mask };
}

async function generateKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
    );

    const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey(
        "jwk",
        keyPair.privateKey,
    );

    // Generate obfuscated version
    const { fragments, mask } = obfuscatePublicKey({
        kty: publicKeyJwk.kty,
        crv: publicKeyJwk.crv,
        x: publicKeyJwk.x,
        y: publicKeyJwk.y,
    });

    console.log("\n🔑 Key Pair Generated Successfully!\n");
    console.log("=".repeat(70));

    console.log("\n📤 OBFUSCATED PUBLIC KEY (copy to src/lib/worker/license.ts):");
    console.log("-".repeat(70));
    console.log(`
const _f = [
  "${fragments[0]}",
  "${fragments[1]}",
  "${fragments[2]}",
  "${fragments[3]}",
];
const _m = ${mask};
`);

    console.log(
        "\n🔐 PRIVATE KEY (keep this secret! save to .env or secure storage):",
    );
    console.log("-".repeat(70));
    const privateKeyBase64 = Buffer.from(JSON.stringify(privateKeyJwk)).toString(
        "base64",
    );
    console.log(`LOGISHEETS_PRIVATE_KEY=${privateKeyBase64}`);

    console.log("\n" + "=".repeat(70));
    console.log("⚠️  IMPORTANT:");
    console.log("   1. Copy the obfuscated key block to src/lib/worker/license.ts");
    console.log("   2. Never share or commit the private key!");
    console.log("   3. Save private key to a secure location (e.g., .env file)");
    console.log("=".repeat(70) + "\n");
}

// ============================================================================
// License Creation
// ============================================================================

async function createLicense(domain, validDays, privateKeyBase64) {
    // Parse private key
    const privateKeyJwk = JSON.parse(
        Buffer.from(privateKeyBase64, "base64").toString(),
    );

    const privateKey = await crypto.subtle.importKey(
        "jwk",
        privateKeyJwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
    );

    // Create license data
    const issuedAt = Math.floor(Date.now() / 1000);
    const message = `${domain}|${issuedAt}|${validDays}`;

    // Sign the message
    const data = new TextEncoder().encode(message);
    const signatureBuffer = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        privateKey,
        data,
    );

    const signature = Buffer.from(signatureBuffer).toString("base64");

    // Create license object
    const license = {
        domain,
        issuedAt,
        validDays: parseInt(validDays),
        signature,
    };

    // Encode as API key
    const apiKey = Buffer.from(JSON.stringify(license)).toString("base64");

    console.log("\n🎫 License Created Successfully!\n");
    console.log("=".repeat(60));
    console.log(`Domain:      ${domain}`);
    console.log(`Issued:      ${new Date(issuedAt * 1000).toISOString()}`);
    console.log(`Valid Days:  ${validDays}`);
    console.log(
        `Expires:     ${new Date((issuedAt + validDays * 86400) * 1000).toISOString()}`,
    );
    console.log("=".repeat(60));
    console.log("\n📋 API KEY (provide this to your customer):");
    console.log("-".repeat(60));
    console.log(apiKey);
    console.log("-".repeat(60) + "\n");

    return apiKey;
}

// ============================================================================
// License Verification
// ============================================================================

async function verifyLicense(apiKey, publicKeyJwk) {
    try {
        // Decode the API key
        const json = Buffer.from(apiKey, "base64").toString();
        const license = JSON.parse(json);

        console.log("\n🔍 License Details:\n");
        console.log(`Domain:      ${license.domain}`);
        console.log(
            `Issued:      ${new Date(license.issuedAt * 1000).toISOString()}`,
        );
        console.log(`Valid Days:  ${license.validDays}`);
        console.log(
            `Expires:     ${new Date((license.issuedAt + license.validDays * 86400) * 1000).toISOString()}`,
        );

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = license.issuedAt + license.validDays * 86400;
        const isExpired = now > expiresAt;

        console.log(`\nExpiration:  ${isExpired ? "❌ EXPIRED" : "✅ Valid"}`);

        if (publicKeyJwk) {
            // Verify signature
            const publicKey = await crypto.subtle.importKey(
                "jwk",
                publicKeyJwk,
                { name: "ECDSA", namedCurve: "P-256" },
                false,
                ["verify"],
            );

            const message = `${license.domain}|${license.issuedAt}|${license.validDays}`;
            const data = new TextEncoder().encode(message);
            const signature = Buffer.from(license.signature, "base64");

            const isValid = await crypto.subtle.verify(
                { name: "ECDSA", hash: "SHA-256" },
                publicKey,
                signature,
                data,
            );

            console.log(`Signature:   ${isValid ? "✅ Valid" : "❌ Invalid"}`);
        }

        console.log("");
    } catch (e) {
        console.error("❌ Invalid license format:", e.message);
    }
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(args) {
    const result = { command: args[0], options: {} };

    for (let i = 1; i < args.length; i++) {
        if (args[i].startsWith("--")) {
            const key = args[i].slice(2);
            const value = args[i + 1];
            result.options[key] = value;
            i++;
        }
    }

    return result;
}

function printUsage() {
    console.log(`
LogiSheets License Generator CLI

Usage:
  node license-cli.mjs <command> [options]

Commands:
  generate-keys                    Generate a new ECDSA P-256 key pair

  create-license                   Create a license for a domain
    --domain <domain>              Domain to authorize (e.g., example.com, *.example.com)
    --days <number>                Validity period in days
    --private-key <base64>         Base64 encoded private key

  verify                           Verify a license (decode and check expiration)
    --license <api-key>            The API key to verify

Examples:
  # Generate keys (do this once, save private key securely)
  node license-cli.mjs generate-keys

  # Create a license for 1 year
  node license-cli.mjs create-license --domain example.com --days 365 --private-key eyJ...

  # Create a wildcard license
  node license-cli.mjs create-license --domain "*.example.com" --days 365 --private-key eyJ...

  # Verify a license
  node license-cli.mjs verify --license eyJkb21haW4iOi...
`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        printUsage();
        process.exit(0);
    }

    const { command, options } = parseArgs(args);

    switch (command) {
        case "generate-keys":
            await generateKeyPair();
            break;

        case "create-license":
            if (!options.domain || !options.days || !options["private-key"]) {
                console.error(
                    "❌ Missing required options: --domain, --days, --private-key",
                );
                process.exit(1);
            }
            await createLicense(options.domain, options.days, options["private-key"]);
            break;

        case "verify":
            if (!options.license) {
                console.error("❌ Missing required option: --license");
                process.exit(1);
            }
            await verifyLicense(options.license);
            break;

        default:
            console.error(`❌ Unknown command: ${command}`);
            printUsage();
            process.exit(1);
    }
}

main().catch((e) => {
    console.error("Error:", e);
    process.exit(1);
});
