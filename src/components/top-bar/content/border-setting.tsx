import {SelectedData} from '@/components/canvas'
import {DataService} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {useState} from 'react'
import {
    Box,
    Button,
    Typography,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Select,
    MenuItem,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material'
import BorderAllIcon from '@mui/icons-material/BorderAll'
import BorderBottomIcon from '@mui/icons-material/BorderBottom'
import BorderClearIcon from '@mui/icons-material/BorderClear'
import BorderHorizontalIcon from '@mui/icons-material/BorderHorizontal'
import BorderInnerIcon from '@mui/icons-material/BorderInner'
import BorderOuterIcon from '@mui/icons-material/BorderOuter'
import BorderRightIcon from '@mui/icons-material/BorderRight'
import BorderTopIcon from '@mui/icons-material/BorderTop'
import BorderVerticalIcon from '@mui/icons-material/BorderVertical'
import BorderLeftIcon from '@mui/icons-material/BorderLeft'
import {ColorResult, SketchPicker} from 'react-color'

export interface BorderSettingProps {
    readonly selectedData?: SelectedData
    readonly close: () => void
}

export const BorderSettingComponent = ({
    selectedData,
    close,
}: BorderSettingProps) => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)

    const [color, setColor] = useState('#000000')
    const [lineWidth, setLineWidth] = useState(1)
    const [borderStyle, setBorderStyle] = useState('solid')
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [selectedRange, setSelectedRange] = useState('all')

    const applySettings = () => {
        if (!selectedData) return

        // DATA_SERVICE.setBorder({
        //     range: selectedData.range,
        //     color,
        //     lineWidth,
        //     style: borderStyle,
        // })

        close()
    }

    return (
        <Box p={3} width={400} bgcolor="Menu">
            <Typography variant="h6" mb={2}>
                Border Settings
            </Typography>

            <Box
                mb={3}
                display="flex"
                alignItems="top"
                justifyContent="space-between"
            >
                <FormControl>
                    <FormLabel>Color</FormLabel>
                    <Box
                        sx={{
                            width: 36,
                            height: 36,
                            backgroundColor: color,
                            border: '1px solid #ccc',
                            borderRadius: '50%',
                            cursor: 'pointer',
                        }}
                        onClick={() => setShowColorPicker(!showColorPicker)}
                    />
                    {showColorPicker && (
                        <Box mt={2}>
                            <SketchPicker
                                color={color}
                                onChangeComplete={(colorResult: ColorResult) =>
                                    setColor(colorResult.hex)
                                }
                            />
                        </Box>
                    )}
                </FormControl>

                <FormControl>
                    <FormLabel>Line Width</FormLabel>
                    <Select
                        value={lineWidth}
                        onChange={(e) => setLineWidth(Number(e.target.value))}
                        renderValue={(value) => (
                            <Box display="flex" alignItems="center">
                                <Box
                                    sx={{
                                        width: 100,
                                        height: value * 1.2,
                                        backgroundColor: '#000',
                                        marginRight: 1,
                                    }}
                                />
                                {`${value}px`}
                            </Box>
                        )}
                    >
                        {[1, 2, 3, 4, 5].map((width) => (
                            <MenuItem key={width} value={width}>
                                <Box display="flex" alignItems="center">
                                    <Box
                                        sx={{
                                            width: 120,
                                            height: width * 1.2,
                                            backgroundColor: '#000',
                                            marginRight: 1,
                                        }}
                                    />
                                    {`${width}px`}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            <Box mb={3}>
                <FormControl fullWidth>
                    <FormLabel>Style</FormLabel>
                    <RadioGroup
                        row
                        value={borderStyle}
                        onChange={(e) => setBorderStyle(e.target.value)}
                    >
                        <FormControlLabel
                            value="solid"
                            control={<Radio />}
                            label="Solid"
                        />
                        <FormControlLabel
                            value="dashed"
                            control={<Radio />}
                            label="Dashed"
                        />
                        <FormControlLabel
                            value="dotted"
                            control={<Radio />}
                            label="Dotted"
                        />
                    </RadioGroup>
                </FormControl>
            </Box>

            <Box mb={3}>
                <FormControl fullWidth>
                    <FormLabel>Border Range</FormLabel>
                    <ToggleButtonGroup
                        exclusive
                        value={selectedRange}
                        onChange={(event, newRange) => {
                            if (newRange !== null) setSelectedRange(newRange)
                        }}
                        sx={{flexWrap: 'wrap'}}
                    >
                        <ToggleButton value="all">
                            <BorderAllIcon />
                        </ToggleButton>
                        <ToggleButton value="top">
                            <BorderTopIcon />
                        </ToggleButton>
                        <ToggleButton value="bottom">
                            <BorderBottomIcon />
                        </ToggleButton>
                        <ToggleButton value="left">
                            <BorderLeftIcon />
                        </ToggleButton>
                        <ToggleButton value="right">
                            <BorderRightIcon />
                        </ToggleButton>
                        <ToggleButton value="horizontal">
                            <BorderHorizontalIcon />
                        </ToggleButton>
                        <ToggleButton value="vertical">
                            <BorderVerticalIcon />
                        </ToggleButton>
                        <ToggleButton value="outer">
                            <BorderOuterIcon />
                        </ToggleButton>
                        <ToggleButton value="inner">
                            <BorderInnerIcon />
                        </ToggleButton>
                        <ToggleButton value="clear">
                            <BorderClearIcon />
                        </ToggleButton>
                    </ToggleButtonGroup>
                </FormControl>
            </Box>

            {/* Preview Section */}
            <Box
                mb={3}
                p={2}
                border="1px solid #ccc"
                borderRadius={2}
                justifyItems="center"
            >
                <Box
                    sx={{
                        width: 75,
                        height: 75,
                        display: 'grid',
                        gridTemplateRows: '1fr 1fr',
                        gridTemplateColumns: '1fr 1fr',
                        position: 'relative',
                    }}
                >
                    <Box
                        sx={{
                            gridRow: '1 / 3',
                            gridColumn: '1 / 3',
                            border:
                                selectedRange === 'outer' ||
                                selectedRange === 'all'
                                    ? `${lineWidth}px ${borderStyle} ${color}`
                                    : 'none',
                        }}
                    />
                    <Box
                        sx={{
                            gridRow: '1',
                            gridColumn: '1 / 3',
                            borderTop:
                                selectedRange === 'top' ||
                                selectedRange === 'all'
                                    ? `${lineWidth}px ${borderStyle} ${color}`
                                    : 'none',
                            borderRight:
                                selectedRange === 'right' ||
                                selectedRange === 'all'
                                    ? `${lineWidth}px ${borderStyle} ${color}`
                                    : 'none',
                        }}
                    />
                    <Box
                        sx={{
                            gridRow: '2',
                            gridColumn: '1 / 3',
                            borderBottom:
                                selectedRange === 'bottom' ||
                                selectedRange === 'all'
                                    ? `${lineWidth}px ${borderStyle} ${color}`
                                    : 'none',
                            borderTop:
                                selectedRange === 'inner' ||
                                selectedRange === 'all' ||
                                selectedRange === 'horizontal'
                                    ? `${lineWidth}px ${borderStyle} ${color}`
                                    : 'none',
                            borderRight:
                                selectedRange === 'right' ||
                                selectedRange === 'all'
                                    ? `${lineWidth}px ${borderStyle} ${color}`
                                    : 'none',
                        }}
                    />
                    <Box
                        sx={{
                            gridRow: '1 / 3',
                            gridColumn: '1',
                            borderLeft:
                                selectedRange === 'left' ||
                                selectedRange === 'all'
                                    ? `${lineWidth}px ${borderStyle} ${color}`
                                    : 'none',
                            borderRight:
                                selectedRange === 'inner' ||
                                selectedRange === 'all' ||
                                selectedRange === 'vertical'
                                    ? `${lineWidth}px ${borderStyle} ${color}`
                                    : 'none',
                        }}
                    />
                </Box>
            </Box>
            <Box justifyContent="space-between">
                <Button
                    variant="contained"
                    color="primary"
                    // fullWidth
                    onClick={applySettings}
                    sx={{marginRight: 1}}
                >
                    Apply
                </Button>
                <Button
                    variant="outlined"
                    color="secondary"
                    // fullWidth
                    onClick={close}
                    sx={{marginLeft: 1}}
                >
                    Cancel
                </Button>
            </Box>
        </Box>
    )
}
