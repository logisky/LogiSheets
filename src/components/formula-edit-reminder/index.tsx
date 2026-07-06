/**
 * FormulaEditReminder — a floating banner shown while a formula is being edited
 * but the user has navigated AWAY from the edited cell (a different sheet or a
 * different view), so the in-cell editor isn't in front of them. It names the
 * target cell, mirrors the live formula, and offers confirm/cancel (Enter/Esc
 * still work since the hidden editor keeps focus).
 */
import {observer} from 'mobx-react-lite'
import {formulaEditCoordinator} from '@/core/formula-edit-coordinator'
import {globalStore} from '@/store'

export const FormulaEditReminder = observer(function FormulaEditReminder() {
    const snap = formulaEditCoordinator.snapshot
    if (!snap) return null

    // Hide while the user is looking at the edited cell itself — the in-cell
    // editor is the indicator there.
    const onEditSpot =
        globalStore.activeViewId === snap.viewId &&
        globalStore.activeViewContext?.sheetIdx === snap.editSheetIdx
    if (onEditSpot) return null

    // Keep focus on the (hidden) formula editor so clicking a button doesn't
    // blur-commit before onClick runs.
    const keepFocus = (e: React.MouseEvent) => e.preventDefault()

    return (
        <div
            style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1300,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                maxWidth: '90%',
                padding: '6px 12px',
                background: '#fffbe6',
                border: '1px solid #f0c36d',
                borderRadius: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                fontSize: 13,
                color: '#5c4813',
            }}
        >
            <span style={{whiteSpace: 'nowrap'}}>
                Editing formula for <b>{snap.cellRef}</b>
            </span>
            <code
                style={{
                    flex: 1,
                    minWidth: 80,
                    maxWidth: 360,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    background: '#fff',
                    border: '1px solid #e6d8a8',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                }}
            >
                {snap.text || '='}
            </code>
            <button
                type="button"
                onMouseDown={keepFocus}
                onClick={() => formulaEditCoordinator.commitActive()}
                style={btnStyle('#2e7d32')}
            >
                Confirm (Enter)
            </button>
            <button
                type="button"
                onMouseDown={keepFocus}
                onClick={() => formulaEditCoordinator.cancelActive()}
                style={btnStyle('#b0680f')}
            >
                Cancel (Esc)
            </button>
        </div>
    )
})

function btnStyle(color: string): React.CSSProperties {
    return {
        cursor: 'pointer',
        border: `1px solid ${color}`,
        color,
        background: '#fff',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 12,
        whiteSpace: 'nowrap',
    }
}

export default FormulaEditReminder
