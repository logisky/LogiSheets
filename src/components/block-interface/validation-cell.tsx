import {Box, Tooltip} from '@mui/material'
import {
    EphemeralCellInputBuilder,
    isErrorMessage,
    TransactionBuilder,
} from 'logisheets-engine'
import {useEngine} from '@/core/engine/provider'
import {BlockCellProps} from './cell'
import {useToast} from '@/ui/notification/useToast'

interface ValidationCellProps extends BlockCellProps {
    fieldType: 'string' | 'number'
}

export const ValidationCell = (props: ValidationCellProps) => {
    const {
        x,
        y,
        width,
        height,
        value,
        shadowValue,
        fieldInfo,
        sheetIdx,
        rowIdx,
        colIdx,
        fieldType,
    } = props

    if (fieldInfo.type.type !== fieldType) {
        return null
    }

    const engine = useEngine()
    const DATA_SERVICE = engine.getDataService()
    const {toast} = useToast()
    const validation = fieldInfo.type.validation

    if (validation !== '' && shadowValue === undefined) {
        // We haven't set a shadow cell for calculating the validation
        DATA_SERVICE.getWorkbook()
            .getShadowCellId({sheetIdx, rowIdx, colIdx})
            .then((shadowCellId) => {
                if (isErrorMessage(shadowCellId)) {
                    toast.error('Failed to get shadow cell id')
                    return shadowCellId
                }
                const p = new EphemeralCellInputBuilder()
                    .id(shadowCellId.cellId.value as number)
                    .sheetIdx(sheetIdx)
                    .content(`=${validation}`)
                    .build()
                const tx = new TransactionBuilder()
                    .payload({type: 'ephemeralCellInput', value: p})
                    .undoable(false)
                    .build()
                DATA_SERVICE.handleTransaction(tx)
            })
        // The last step will trigger re-render. So we can return null here
        return null
    }

    // Determine validation status
    let showWarning = false
    let warningMessage = ''
    let isFormulaError = false

    if (shadowValue !== undefined) {
        if (shadowValue === 'empty') {
            // No warning for empty
        } else if (shadowValue.type === 'bool') {
            if (shadowValue.value === false) {
                showWarning = true
                warningMessage = 'Value does not meet validation criteria'
            }
            // If true, no warning
        } else if (shadowValue.type === 'error') {
            showWarning = true
            isFormulaError = true
            warningMessage = 'Validation formula error: ' + shadowValue.value
        } else {
            // Other types are treated as formula errors
            showWarning = true
            isFormulaError = true
            warningMessage = 'Unexpected validation result'
        }
    }

    if (!showWarning) {
        return null
    }

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
