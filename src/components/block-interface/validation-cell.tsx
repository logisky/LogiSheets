import {Box, Tooltip} from '@mui/material'
import {interpretValidation} from 'logisheets-core'
import {useOps} from '@/core/engine/provider'
import {BlockCellProps} from './cell'
import {useToast} from '@/ui/notification/useToast'

export const ValidationCell = (props: BlockCellProps) => {
    const {
        x,
        y,
        width,
        height,
        shadowValue,
        fieldInfo,
        sheetIdx,
        rowIdx,
        colIdx,
    } = props

    // string / number / fieldRef / multiSelectRef are the field types that
    // can carry a validation formula. The dispatcher in index.tsx already
    // routes display cells correctly, but this guard keeps the component
    // independently safe to use.
    const t = fieldInfo.type
    if (
        t.type !== 'string' &&
        t.type !== 'number' &&
        t.type !== 'fieldRef' &&
        t.type !== 'multiSelectRef'
    ) {
        return null
    }

    const ops = useOps()
    const {toast} = useToast()
    const validation = t.validation

    if (validation !== '' && shadowValue === undefined) {
        // We haven't set a shadow cell for calculating the validation.
        // The orchestration lives in logisheets-core's WorkbookOps so the
        // browser and the Node runtime establish validation identically.
        ops.setValidationRule(sheetIdx, rowIdx, colIdx, validation).catch(() =>
            toast.error('Failed to set validation rule')
        )
        // The last step will trigger re-render. So we can return null here
        return null
    }

    // Determine validation status — interpretation lives in logisheets-core
    // so the browser and a Node runtime classify results identically.
    const violation =
        shadowValue === undefined
            ? null
            : interpretValidation(
                  {sheetIdx, row: rowIdx, col: colIdx, formula: validation},
                  shadowValue as never
              )

    if (!violation) {
        return null
    }

    const isFormulaError = violation.kind === 'error'
    const warningMessage = violation.message

    // Build tooltip message
    const tooltipMessage = isFormulaError
        ? warningMessage
        : `Validation: ${validation}\n${warningMessage}`

    return (
        <Box
            sx={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                width: `${width}px`,
                height: `${height}px`,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-end',
                pt: 0.125,
                pr: 0.125,
                zIndex: 2,
            }}
        >
            <Tooltip
                title={
                    <Box sx={{whiteSpace: 'pre-line'}}>{tooltipMessage}</Box>
                }
                arrow
                placement="left"
            >
                <Box
                    component="span"
                    sx={{
                        fontSize: '0.5rem',
                        fontWeight: 600,
                        color: isFormulaError ? '#d32f2f' : '#ed6c02',
                        backgroundColor: isFormulaError
                            ? 'rgba(211, 47, 47, 0.9)'
                            : 'rgba(237, 108, 2, 0.9)',
                        borderRadius: '2px',
                        px: 0.2,
                        py: 0.1,
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        minWidth: '10px',
                        minHeight: '10px',
                        pointerEvents: 'auto',
                        cursor: 'help',
                    }}
                >
                    {isFormulaError ? '⚠️' : '❗'}
                </Box>
            </Tooltip>
        </Box>
    )
}
