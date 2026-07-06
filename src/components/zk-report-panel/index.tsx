import {useState} from 'react'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import {
    buildProverInputAsync,
    mockProve,
    SparseMerkleTree,
    bytesToHex,
    type Formula,
} from 'logisheets-zk-web'

const INITIAL_FORMULAS: Formula[] = [
    {
        id: new Uint8Array(32).fill(1),
        name: 'Quarterly_ROI',
        expression: '=(EndValue - StartValue) / StartValue',
        version: 1,
    },
    {
        id: new Uint8Array(32).fill(2),
        name: 'Net_Gain',
        expression: '=EndValue - StartValue',
        version: 1,
    },
]

export function ZkReportPanel() {
    const [formulas] = useState<Formula[]>(INITIAL_FORMULAS)
    const [inputs, setInputs] = useState<Record<string, number>>({
        StartValue: 1_000_000,
        EndValue: 1_150_000,
    })
    const [root, setRoot] = useState<string>('')
    const [outputs, setOutputs] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(false)

    const handleInputChange = (key: string, value: string) => {
        setInputs((prev) => ({...prev, [key]: Number(value)}))
    }

    const runMockReport = async () => {
        setLoading(true)
        try {
            const tree = new SparseMerkleTree()
            for (const f of formulas) {
                await tree.insert(f)
            }
            const computedRoot = await tree.root()
            setRoot(`0x${bytesToHex(computedRoot)}`)

            const proverInput = await buildProverInputAsync(
                formulas,
                inputs,
                {},
                formulas.map((f) => f.name)
            )
            const report = await mockProve(proverInput)
            setOutputs(report.outputs)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Paper elevation={2} sx={{p: 3, maxWidth: 600, m: 2}}>
            <Typography variant="h6" gutterBottom>
                ZK Quarterly Report
            </Typography>

            <Box sx={{mb: 2}}>
                <Typography variant="subtitle2">Committed Formulas</Typography>
                {formulas.map((f) => (
                    <Typography key={f.name} variant="body2" sx={{fontFamily: 'monospace'}}>
                        {f.name} = {f.expression}
                    </Typography>
                ))}
            </Box>

            <Box sx={{display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap'}}>
                {Object.keys(inputs).map((key) => (
                    <TextField
                        key={key}
                        label={key}
                        type="number"
                        value={inputs[key]}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        size="small"
                    />
                ))}
            </Box>

            <Button
                variant="contained"
                onClick={runMockReport}
                disabled={loading}
                sx={{mb: 2}}
            >
                {loading ? 'Computing...' : 'Run Mock Report'}
            </Button>

            {root && (
                <Box sx={{mb: 2}}>
                    <Typography variant="subtitle2">Formula Root</Typography>
                    <Typography variant="body2" sx={{wordBreak: 'break-all', fontFamily: 'monospace'}}>
                        {root}
                    </Typography>
                </Box>
            )}

            {Object.keys(outputs).length > 0 && (
                <Box>
                    <Typography variant="subtitle2">Outputs</Typography>
                    {Object.entries(outputs).map(([name, value]) => (
                        <Typography key={name} variant="body2">
                            {name}: {value.toFixed(6)}
                        </Typography>
                    ))}
                </Box>
            )}
        </Paper>
    )
}
