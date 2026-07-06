# ZK Report Panel

A React/MUI panel demonstrating LogiSheets blockchain ZK integration.

## Features

- Displays committed financial formulas
- Accepts quarterly input values
- Builds a Sparse Merkle Tree and computes the formula root
- Runs a local `mockProve` to compute outputs (ROI, net gain, etc.)

## Usage

Import and render inside the main app:

```tsx
import {ZkReportPanel} from '@/components/zk-report-panel'

function App() {
  return (
    <div>
      <SpreadsheetRoot />
      <ZkReportPanel />
    </div>
  )
}
```

## Notes

- This is a v1 skeleton. Real ZK proving requires the Rust host prover in `zk/logisheets-zk-host`.
- The panel uses `logisheets-zk-web` for browser-side SMT and formula evaluation.
