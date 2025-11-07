import {useState} from 'react'
import {Box, Popover} from '@mui/material'
import {StaticDatePicker} from '@mui/x-date-pickers/StaticDatePicker'
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider'
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, {Dayjs} from 'dayjs'
import {CellInputBuilder, Payload, Transaction} from 'logisheets-web'
import {DataServiceImpl} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {BlockCellProps, valueToNumber} from './cell'

/**
 * Convert Excel serial number to Date
 * Excel uses 1899-12-31 as the base date (serial number 0)
 * Serial number 60 represents 1900-02-29 (a date that doesn't exist,
 * but is kept for Excel compatibility)
 */
function getDateBySerialNum1900(n: number): Date | null {
    if (n < 1) {
        return null
    }

    // Base date: 1899-12-31
    const baseDate = new Date(1899, 11, 31)

    if (n === 60) {
        // Special case: 1900/2/29 (doesn't exist, Excel bug)
        // Return 1900-02-29 for compatibility
        return new Date(1900, 1, 29)
    } else if (n <= 60) {
        // For n <= 60, add n days directly
        const result = new Date(baseDate)
        result.setDate(result.getDate() + n)
        return result
    } else {
        // For n > 60, add (n - 1) days to compensate for the non-existent day
        const result = new Date(baseDate)
        result.setDate(result.getDate() + (n - 1))
        return result
    }
}

export const DatetimeCell = (props: BlockCellProps) => {
    const {x, y, width, height, value, fieldInfo, sheetIdx, rowIdx, colIdx} =
        props

    const DATA_SERVICE = useInjection<DataServiceImpl>(TYPES.Data)
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
    const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)

    if (fieldInfo.type.type !== 'datetime') {
        return null
    }

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        // Try to parse the current value
        const numValue = valueToNumber(value)
        if (numValue !== null) {
            const date = getDateBySerialNum1900(numValue)
            if (date) {
                setSelectedDate(dayjs(date))
            } else {
                setSelectedDate(null)
            }
        } else {
            setSelectedDate(null)
        }
        setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
        setAnchorEl(null)
    }

    const handleDateChange = async (newDate: Dayjs | null) => {
        setAnchorEl(null)
        if (!newDate) {
            return
        }
        const year = newDate.year()
        const month = newDate.month() + 1
        const day = newDate.date()

        const p = new CellInputBuilder()
            .sheetIdx(sheetIdx)
            .row(rowIdx)
            .col(colIdx)
            .content(`=DATE(${year}, ${month}, ${day})`)
            .build()
        const payload: Payload = {
            type: 'cellInput',
            value: p,
        }
        await DATA_SERVICE.handleTransaction(new Transaction([payload], true))
    }

    const open = Boolean(anchorEl)

    return (
        <>
            <Box
                sx={{
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    zIndex: 1,
                    '&:hover': {
                        bgcolor: 'action.hover',
                    },
                }}
                onClick={handleClick}
            />
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                <Box sx={{p: 1}}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <StaticDatePicker
                            value={selectedDate}
                            onChange={handleDateChange}
                            displayStaticWrapperAs="desktop"
                        />
                    </LocalizationProvider>
                </Box>
            </Popover>
        </>
    )
}
