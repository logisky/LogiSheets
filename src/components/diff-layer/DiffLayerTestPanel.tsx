/**
 * DiffLayerTestPanel — Dev-only floating panel to test the DiffLayer.
 *
 * Provides buttons to:
 *   - Apply a temp transaction (writes value into selected cell)
 *   - Insert / delete rows or columns at the selected position
 *   - Commit the temp changes
 *   - Discard the temp changes
 */

import {FC, useState} from 'react'
import type {UseDiffLayerReturn} from '@/components/diff-layer'
import {
    CellInputBuilder,
    InsertRowsBuilder,
    DeleteRowsBuilder,
    InsertColsBuilder,
    DeleteColsBuilder,
    Payload,
} from 'logisheets-engine'
import {useDataService} from '@/core/engine/provider'
import type {SelectedData} from 'logisheets-engine'

export interface DiffLayerTestPanelProps {
    selectedData: SelectedData
    diffLayer: UseDiffLayerReturn
}

/** Extract row/col from the current selection, returns null if nothing selected */
function getSelectedRowCol(sel: SelectedData) {
    if (!sel.data || sel.data.ty !== 'cellRange') return null
    return {row: sel.data.d.startRow, col: sel.data.d.startCol}
}

const btnStyle = {flex: 1, fontSize: 12, padding: '4px 0'}

export const DiffLayerTestPanel: FC<DiffLayerTestPanelProps> = ({
    selectedData,
    diffLayer,
}) => {
    const {diffState, applyTempTransaction, commit, discard} = diffLayer
    const dataSvc = useDataService()
    const [testValue, setTestValue] = useState('DIFF_TEST')
    const [count, setCount] = useState(1)

    const sheetIdx = dataSvc.getCurrentSheetIdx()
    const pos = getSelectedRowCol(selectedData)

    const handleApply = async () => {
        if (!pos) return
        const payload: Payload = {
            type: 'cellInput',
            value: new CellInputBuilder()
                .row(pos.row)
                .col(pos.col)
                .sheetIdx(sheetIdx)
                .content(testValue)
                .build(),
        }
        await applyTempTransaction([payload])
    }

    const handleInsertRows = async () => {
        if (!pos) return
        const payload: Payload = {
            type: 'insertRows',
            value: new InsertRowsBuilder()
                .sheetIdx(sheetIdx)
                .start(pos.row)
                .count(count)
                .build(),
        }
        await applyTempTransaction([payload])
    }

    const handleDeleteRows = async () => {
        if (!pos) return
        const payload: Payload = {
            type: 'deleteRows',
            value: new DeleteRowsBuilder()
                .sheetIdx(sheetIdx)
                .start(pos.row)
                .count(count)
                .build(),
        }
        await applyTempTransaction([payload])
    }

    const handleInsertCols = async () => {
        if (!pos) return
        const payload: Payload = {
            type: 'insertCols',
            value: new InsertColsBuilder()
                .sheetIdx(sheetIdx)
                .start(pos.col)
                .count(count)
                .build(),
        }
        await applyTempTransaction([payload])
    }

    const handleDeleteCols = async () => {
        if (!pos) return
        const payload: Payload = {
            type: 'deleteCols',
            value: new DeleteColsBuilder()
                .sheetIdx(sheetIdx)
                .start(pos.col)
                .count(count)
                .build(),
        }
        await applyTempTransaction([payload])
    }

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 60,
                right: 16,
                zIndex: 9999,
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: 8,
                padding: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 13,
                minWidth: 220,
            }}
        >
            <strong>DiffLayer Test</strong>
            {/* Cell value input */}
            <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
                <span>Value:</span>
                <input
                    type="text"
                    value={testValue}
                    onChange={(e) => setTestValue(e.target.value)}
                    style={{flex: 1, padding: '2px 4px'}}
                />
                <button
                    onClick={handleApply}
                    disabled={diffState.active || !pos}
                    style={{fontSize: 12}}
                >
                    Set
                </button>
            </div>
            {/* Row / Col count */}
            <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
                <span>Count:</span>
                <input
                    type="number"
                    min={1}
                    value={count}
                    onChange={(e) =>
                        setCount(Math.max(1, Number(e.target.value)))
                    }
                    style={{width: 50, padding: '2px 4px'}}
                />
            </div>
            {/* Row operations */}
            <div style={{display: 'flex', gap: 4}}>
                <button
                    onClick={handleInsertRows}
                    disabled={diffState.active || !pos}
                    style={btnStyle}
                >
                    + Row
                </button>
                <button
                    onClick={handleDeleteRows}
                    disabled={diffState.active || !pos}
                    style={btnStyle}
                >
                    - Row
                </button>
                <button
                    onClick={handleInsertCols}
                    disabled={diffState.active || !pos}
                    style={btnStyle}
                >
                    + Col
                </button>
                <button
                    onClick={handleDeleteCols}
                    disabled={diffState.active || !pos}
                    style={btnStyle}
                >
                    - Col
                </button>
            </div>
            {/* Active diff info + commit/discard */}
            {diffState.active && (
                <>
                    <div style={{fontSize: 11, color: '#666'}}>
                        {diffState.cells.length} cell(s),{' '}
                        {diffState.rows.length} row(s), {diffState.cols.length}{' '}
                        col(s) changed
                    </div>
                    <div style={{display: 'flex', gap: 8}}>
                        <button onClick={commit} style={{flex: 1}}>
                            Commit
                        </button>
                        <button onClick={discard} style={{flex: 1}}>
                            Discard
                        </button>
                    </div>
                </>
            )}
            {!pos && (
                <div style={{fontSize: 11, color: '#999'}}>
                    Select a cell first
                </div>
            )}
        </div>
    )
}
