import {Box, Tooltip} from '@mui/material'
import {BlockCellProps} from './cell'

// Display-only overlay that warns when a required field is empty.
// The dispatcher only mounts this component once it has confirmed the
// underlying value is empty, so no value check is needed here.
export const RequiredCell = (props: BlockCellProps) => {
    const {x, y, width, height, fieldInfo} = props

    const fieldName = fieldInfo.name || 'This field'
    const tooltipMessage = `${fieldName} is required`

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
                justifyContent: 'flex-start',
                pt: 0.125,
                pl: 0.125,
                zIndex: 2,
            }}
        >
            <Tooltip
                title={
                    <Box sx={{whiteSpace: 'pre-line'}}>{tooltipMessage}</Box>
                }
                arrow
                placement="right"
            >
                <Box
                    component="span"
                    sx={{
                        fontSize: '0.5rem',
                        fontWeight: 700,
                        color: '#fff',
                        backgroundColor: 'rgba(211, 47, 47, 0.9)',
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
                    *
                </Box>
            </Tooltip>
        </Box>
    )
}
