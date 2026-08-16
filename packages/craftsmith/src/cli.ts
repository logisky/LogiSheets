#!/usr/bin/env node
import {check, buildCraft, pack, scaffold} from './commands.js'

const USAGE = `craftsmith — LogiSheets craft CLI

Usage:
  craftsmith check [dir]     Validate a craft (conventions + tool contract). No writes.
  craftsmith build [dir]     Validate, compile tools.ts/runtime.ts, emit dist/manifest.json.
  craftsmith pack  [dir]     Tarball dist/ into <craftId>-<version>.tgz.
  craftsmith new   <name>    Scaffold a new craft directory.

[dir] defaults to the current directory.
`

async function main(): Promise<number> {
    const [, , cmd, arg] = process.argv
    switch (cmd) {
        case 'check':
            return check(arg ?? '.')
        case 'build':
            return await buildCraft(arg ?? '.')
        case 'pack':
            return pack(arg ?? '.')
        case 'new':
            if (!arg) {
                console.error('craftsmith new <name>: missing craft name')
                return 1
            }
            return scaffold(arg)
        case undefined:
        case '-h':
        case '--help':
            console.error(USAGE)
            return cmd ? 0 : 1
        default:
            console.error(`unknown command: ${cmd}\n\n${USAGE}`)
            return 1
    }
}

main().then(
    (code) => process.exit(code),
    (err) => {
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
    }
)
