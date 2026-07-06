# logisheets-zk-web

Blockchain and ZK integration layer for LogiSheets.

## Responsibilities

- Build Sparse Merkle Trees for formula commitments in the browser.
- Generate Merkle proofs for each committed formula.
- Evaluate formulas locally (`mockProve`) before real ZK proving.
- Submit formulas and quarterly reports to the `FormulaRegistry` and `QuarterlyReport` smart contracts.

## Usage

```ts
import {SparseMerkleTree, buildProverInputAsync, mockProve} from 'logisheets-zk-web'

const tree = new SparseMerkleTree()
const formula = {
    id: new Uint8Array(32).fill(1),
    name: 'Quarterly_ROI',
    expression: '=(EndValue - StartValue) / StartValue',
    version: 1,
}
await tree.insert(formula)
const root = await tree.root()
const proof = await tree.proof(formula.id)

const input = await buildProverInputAsync(
    [formula],
    {StartValue: 1_000_000, EndValue: 1_150_000},
    {},
    ['Quarterly_ROI']
)

const report = await mockProve(input)
console.log(report.outputs) // {Quarterly_ROI: 0.15}
```

## Real ZK Proving

Real proving is performed by the Rust host prover in `zk/logisheets-zk-host`.
The browser package can delegate to a backend service that runs the host CLI.

## On-Chain Submission

Use `registerFormulaOnChain` and `submitReportOnChain` with a viem wallet client
implementing the `WriteClient` interface.

## Note on Hashing

This package currently uses SHA-256 via the Web Crypto API for SMT operations.
In production, switch to a ZK-friendly hash such as Poseidon to reduce proof cycles.
