/**
 * Demo App for Formula Editor
 *
 * This standalone app lets you test and debug the formula editor independently
 * from the main LogiSheets application.
 */

import React, {useState, useRef, useCallback} from 'react'
import {
    FormulaEditor,
    FormulaEditorRef,
    FormulaDisplayInfo,
    FormulaFunction,
    FormulaEditorConfig,
    TokenType,
} from './lib'

// Mock formula functions for autocomplete demo
const MOCK_FUNCTIONS: FormulaFunction[] = [
    {
        name: 'SUM',
        description: 'Adds all the numbers in a range of cells',
        args: [
            {
                argName: 'number1',
                description: 'The first number or range to add',
            },
            {
                argName: 'number2',
                description: 'Additional numbers or ranges to add',
                startRepeated: true,
            },
        ],
        argCount: {ge: 1},
    },
    {
        name: 'AVERAGE',
        description: 'Returns the average (arithmetic mean) of the arguments',
        args: [
            {argName: 'number1', description: 'The first number or range'},
            {
                argName: 'number2',
                description: 'Additional numbers or ranges',
                startRepeated: true,
            },
        ],
        argCount: {ge: 1},
    },
    {
        name: 'IF',
        description:
            "Returns one value if a condition is true and another value if it's false",
        args: [
            {argName: 'logical_test', description: 'The condition to evaluate'},
            {
                argName: 'value_if_true',
                description: 'Value if condition is TRUE',
            },
            {
                argName: 'value_if_false',
                description: 'Value if condition is FALSE',
            },
        ],
        argCount: {eq: 3},
    },
    {
        name: 'VLOOKUP',
        description: 'Looks for a value in the leftmost column of a table',
        args: [
            {argName: 'lookup_value', description: 'The value to search for'},
            {
                argName: 'table_array',
                description: 'The range of cells that contains the data',
            },
            {
                argName: 'col_index_num',
                description: 'The column number to return a value from',
            },
            {
                argName: 'range_lookup',
                description:
                    'TRUE for approximate match, FALSE for exact match',
            },
        ],
        argCount: {ge: 3, le: 4},
    },
    {
        name: 'COUNT',
        description: 'Counts the number of cells that contain numbers',
        args: [
            {
                argName: 'value1',
                description: 'The first item or range to count',
            },
            {
                argName: 'value2',
                description: 'Additional items or ranges',
                startRepeated: true,
            },
        ],
        argCount: {ge: 1},
    },
    {
        name: 'MAX',
        description: 'Returns the largest value in a set of values',
        args: [
            {argName: 'number1', description: 'The first number'},
            {
                argName: 'number2',
                description: 'Additional numbers',
                startRepeated: true,
            },
        ],
        argCount: {ge: 1},
    },
    {
        name: 'MIN',
        description: 'Returns the smallest value in a set of values',
        args: [
            {argName: 'number1', description: 'The first number'},
            {
                argName: 'number2',
                description: 'Additional numbers',
                startRepeated: true,
            },
        ],
        argCount: {ge: 1},
    },
    {
        name: 'CONCATENATE',
        description: 'Joins two or more text strings into one string',
        args: [
            {argName: 'text1', description: 'The first text string'},
            {
                argName: 'text2',
                description: 'Additional text strings',
                startRepeated: true,
            },
        ],
        argCount: {ge: 1},
    },
    {
        name: 'TODAY',
        description: 'Returns the current date',
        args: [],
        argCount: {eq: 0},
    },
    {
        name: 'NOW',
        description: 'Returns the current date and time',
        args: [],
        argCount: {eq: 0},
    },
]

/**
 * Mock implementation of getDisplayUnits.
 * In a real app, this would call the backend API.
 */
async function mockGetDisplayUnits(
    formula: string
): Promise<FormulaDisplayInfo | undefined> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Simple lexer for demo purposes
    // In production, this would call: workbook.getDisplayUnitsOfFormula(formula)
    const tokenUnits: {tokenType: TokenType; start: number; end: number}[] = []
    const cellRefs: {row1?: number; col1?: number}[] = []

    // Very simple tokenizer for demo
    let i = 0
    while (i < formula.length) {
        // Skip whitespace
        if (/\s/.test(formula[i])) {
            i++
            continue
        }

        // Function name (letters followed by '(')
        const funcMatch = formula
            .slice(i)
            .match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(/)
        if (funcMatch) {
            tokenUnits.push({
                tokenType: 'funcName',
                start: i,
                end: i + funcMatch[1].length,
            })
            i += funcMatch[1].length
            continue
        }

        // Cell reference (like A1, B2, $A$1, etc.)
        const cellMatch = formula.slice(i).match(/^\$?[A-Za-z]+\$?\d+/)
        if (cellMatch) {
            tokenUnits.push({
                tokenType: 'cellReference',
                start: i,
                end: i + cellMatch[0].length,
            })
            // Parse row/col
            const colMatch = cellMatch[0].match(/\$?([A-Za-z]+)/)
            const rowMatch = cellMatch[0].match(/\$?(\d+)/)
            if (colMatch && rowMatch) {
                const col = colMatch[1].toUpperCase()
                let colNum = 0
                for (let j = 0; j < col.length; j++) {
                    colNum = colNum * 26 + (col.charCodeAt(j) - 65)
                }
                cellRefs.push({
                    row1: parseInt(rowMatch[1], 10) - 1,
                    col1: colNum,
                })
            }
            i += cellMatch[0].length
            continue
        }

        // Error constant
        const errorMatch = formula.slice(i).match(/^#[A-Z]+[!?]?/)
        if (errorMatch) {
            tokenUnits.push({
                tokenType: 'errorConstant',
                start: i,
                end: i + errorMatch[0].length,
            })
            i += errorMatch[0].length
            continue
        }

        i++
    }

    return {
        tokenUnits,
        cellRefs,
    }
}

export const App: React.FC = () => {
    const editorRef = useRef<FormulaEditorRef>(null)
    const [value, setValue] = useState('=SUM(A1:B2, C3)')
    const [logs, setLogs] = useState<string[]>([])

    const [config, setConfig] = useState<FormulaEditorConfig>({
        fontSize: 14,
        fontFamily: 'Consolas, Monaco, monospace',
        textAlign: 'left',
        wordWrap: false,
        autoFocus: true,
    })

    const addLog = useCallback((message: string) => {
        setLogs((prev) => [
            ...prev.slice(-9),
            `${new Date().toLocaleTimeString()}: ${message}`,
        ])
    }, [])

    const handleChange = useCallback(
        (newValue: string) => {
            setValue(newValue)
            addLog(`onChange: "${newValue}"`)
        },
        [addLog]
    )

    const handleBlur = useCallback(
        (finalValue: string) => {
            addLog(`onBlur: "${finalValue}"`)
        },
        [addLog]
    )

    const handleSubmit = useCallback(
        (finalValue: string) => {
            addLog(`onSubmit (Enter): "${finalValue}"`)
        },
        [addLog]
    )

    const handleCancel = useCallback(() => {
        addLog('onCancel (Escape)')
    }, [addLog])

    return (
        <div style={{maxWidth: 900, margin: '0 auto'}}>
            <h1 style={{color: '#333'}}>Formula Editor Demo</h1>
            <p style={{color: '#666'}}>
                A standalone demo for debugging the formula editor component.
                <br />
                Type <code>=</code> to start a formula. Try typing{' '}
                <code>=SUM</code> or <code>=IF</code>.
            </p>

            {/* Editor */}
            <div
                style={{
                    backgroundColor: '#fff',
                    border: '2px solid #1976d2',
                    borderRadius: 4,
                    marginBottom: 20,
                }}
            >
                <FormulaEditor
                    ref={editorRef}
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onSubmit={handleSubmit}
                    onCancel={handleCancel}
                    getDisplayUnits={mockGetDisplayUnits}
                    formulaFunctions={MOCK_FUNCTIONS}
                    sheetName="Sheet1"
                    config={config}
                    style={{minHeight: 40}}
                />
            </div>

            {/* Controls */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 16,
                    marginBottom: 20,
                }}
            >
                <div>
                    <label
                        style={{
                            display: 'block',
                            marginBottom: 4,
                            fontWeight: 500,
                        }}
                    >
                        Font Size: {config.fontSize}px
                    </label>
                    <input
                        type="range"
                        min="10"
                        max="24"
                        value={config.fontSize}
                        onChange={(e) =>
                            setConfig((c) => ({
                                ...c,
                                fontSize: parseInt(e.target.value, 10),
                            }))
                        }
                        style={{width: '100%'}}
                    />
                </div>

                <div>
                    <label
                        style={{
                            display: 'block',
                            marginBottom: 4,
                            fontWeight: 500,
                        }}
                    >
                        Text Align
                    </label>
                    <select
                        value={config.textAlign}
                        onChange={(e) =>
                            setConfig((c) => ({
                                ...c,
                                textAlign: e.target.value as
                                    | 'left'
                                    | 'center'
                                    | 'right',
                            }))
                        }
                        style={{width: '100%', padding: 8}}
                    >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                    </select>
                </div>

                <div>
                    <label
                        style={{
                            display: 'block',
                            marginBottom: 4,
                            fontWeight: 500,
                        }}
                    >
                        Word Wrap
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={config.wordWrap}
                            onChange={(e) =>
                                setConfig((c) => ({
                                    ...c,
                                    wordWrap: e.target.checked,
                                }))
                            }
                        />
                        Enable word wrap
                    </label>
                </div>

                <div>
                    <label
                        style={{
                            display: 'block',
                            marginBottom: 4,
                            fontWeight: 500,
                        }}
                    >
                        Actions
                    </label>
                    <button
                        onClick={() => editorRef.current?.focus()}
                        style={{marginRight: 8, padding: '6px 12px'}}
                    >
                        Focus
                    </button>
                    <button
                        onClick={() => setValue('=VLOOKUP(A1, B:C, 2, FALSE)')}
                        style={{padding: '6px 12px'}}
                    >
                        Set Sample
                    </button>
                </div>
            </div>

            {/* Current Value */}
            <div
                style={{
                    backgroundColor: '#f0f0f0',
                    padding: 16,
                    borderRadius: 4,
                    marginBottom: 20,
                }}
            >
                <strong>Current Value:</strong>
                <pre style={{margin: '8px 0 0', whiteSpace: 'pre-wrap'}}>
                    {value || '(empty)'}
                </pre>
            </div>

            {/* Event Logs */}
            <div
                style={{
                    backgroundColor: '#1a1a2e',
                    color: '#eee',
                    padding: 16,
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    fontSize: 12,
                }}
            >
                <strong style={{color: '#4fc3f7'}}>Event Logs:</strong>
                <div style={{marginTop: 8, maxHeight: 200, overflow: 'auto'}}>
                    {logs.length === 0 ? (
                        <div style={{color: '#888'}}>No events yet...</div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} style={{padding: '2px 0'}}>
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Usage Instructions */}
            <div
                style={{
                    marginTop: 20,
                    padding: 16,
                    backgroundColor: '#e3f2fd',
                    borderRadius: 4,
                }}
            >
                <h3 style={{margin: '0 0 8px'}}>Keyboard Shortcuts</h3>
                <ul style={{margin: 0, paddingLeft: 20}}>
                    <li>
                        <strong>Enter</strong>: Submit formula / Select
                        autocomplete item
                    </li>
                    <li>
                        <strong>Escape</strong>: Cancel / Close autocomplete
                    </li>
                    <li>
                        <strong>Alt+Enter</strong>: Insert line break
                    </li>
                    <li>
                        <strong>Arrow Up/Down</strong>: Navigate autocomplete
                    </li>
                    <li>
                        <strong>Tab</strong>: Select autocomplete item
                    </li>
                </ul>
            </div>
        </div>
    )
}
