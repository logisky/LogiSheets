# ZK Examples

## q1-report.json

A template input for `logisheets-zk-host`. The `formulaRoot` and `proof.siblings`
fields in the template are placeholders.

To generate a valid input with real SMT roots and Merkle proofs, use the
`buildProverInputAsync` helper from `logisheets-zk-web` or the equivalent Rust
SMT builder in `zk/logisheets-zk-core`.

### Generate valid input with TypeScript

```ts
import {buildProverInputAsync} from 'logisheets-zk-web'

const input = await buildProverInputAsync(
    [
        {
            id: new Uint8Array(32).fill(1),
            name: 'Quarterly_ROI',
            expression: '=(EndValue - StartValue) / StartValue',
            version: 1,
        },
    ],
    {StartValue: 1_000_000, EndValue: 1_150_000},
    {},
    ['Quarterly_ROI']
)

console.log(JSON.stringify(input, null, 2))
```

### Run mock report

```bash
cd zk
cargo run -p logisheets-zk-host -- mock examples/q1-report.json
```

> The mock command verifies the SMT root and evaluates formulas locally. It does not generate a ZK proof.
