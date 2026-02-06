import {SelectedData} from 'logisheets-engine'
import {useEngine} from '@/core/engine/provider'
import {useState} from 'react'
import {
    Box,
    Button,
    Typography,
    FormControl,
    FormLabel,
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
import {borderStyleNames, PreviewLineComponent} from './preview-line'
import {StBorderStyle, Transaction} from 'logisheets-engine'
import {BatchUpdateType, generateBorderPayloads} from './payload'
import {StandardColor} from '@/core/standable'

export interface BorderSettingProps {
    readonly selectedData?: SelectedData
    readonly close: () => void
}

export const BorderSettingComponent = ({
    selectedData,
    close,
}: BorderSettingProps) => {
    const engine = useEngine()
    const DATA_SERVICE = engine.getDataService()

    const [color, setColor] = useState<StandardColor>(
        StandardColor.from(0, 0, 0)
    )
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [selectedRange, setSelectedRange] = useState('all')
    const [style, setStyle] = useState<StBorderStyle>('none')

    const applySettings = () => {
        if (!selectedData) return

        const payloads = generateBorderPayloads(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {
                batch: selectedRange as BatchUpdateType,
                color: color.argb(),
                borderType: style,
            }
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            (resp) => {
                if (!resp) close()
            }
        )
    }
    /**
     * TODO: Set these values according to borderStyle
     */
    const previewLineWidth = 1
    const borderStyle = 'solid'

    return (
        <Box p={3} width={300} bgcolor="Menu">
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
                            backgroundColor: color.css(),
                            border: '1px solid #ccc',
                            borderRadius: '50%',
                            cursor: 'pointer',
                        }}
                        onClick={() => setShowColorPicker(!showColorPicker)}
                    />
                    {showColorPicker && (
                        <Box mt={2}>
                            <SketchPicker
                                color={color.css()}
                                onChangeComplete={(colorResult: ColorResult) =>
                                    setColor(
                                        StandardColor.from(
                                            colorResult.rgb.r,
                                            colorResult.rgb.g,
                                            colorResult.rgb.b
                                        )
                                    )
                                }
                            />
                        </Box>
                    )}
                </FormControl>
            </Box>
            <Box>
                <FormControl fullWidth>
                    <FormLabel>{style}</FormLabel>
                    <Select
                        value={style}
                        onChange={(e) =>
                            setStyle(e.target.value as StBorderStyle)
                        }
                        renderValue={(value) => (
                            <Box
                                display="flex"
                                alignItems="baseline"
                                mx={1}
                                flexDirection="column"
                            >
                                <PreviewLineComponent style={value} />
                            </Box>
                        )}
                        MenuProps={{disablePortal: true}}
                    >
                        {borderStyleNames.map((v, i) => (
                            <MenuItem key={i} value={v}>
                                <PreviewLineComponent
                                    style={v as StBorderStyle}
                                />
                            </MenuItem>
                        ))}
                    </Select>
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
                                    ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
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
                                    ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                    : 'none',
                            borderRight:
                                selectedRange === 'right' ||
                                selectedRange === 'all'
                                    ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
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
                                    ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                    : 'none',
                            borderTop:
                                selectedRange === 'inner' ||
                                selectedRange === 'all' ||
                                selectedRange === 'horizontal'
                                    ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                    : 'none',
                            borderRight:
                                selectedRange === 'right' ||
                                selectedRange === 'all'
                                    ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
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
                                    ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                    : 'none',
                            borderRight:
                                selectedRange === 'inner' ||
                                selectedRange === 'all' ||
                                selectedRange === 'vertical'
                                    ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                    : 'none',
                        }}
                    />
                </Box>
            </Box>
            <Box justifyContent="space-between">
                <Button
                    variant="contained"
                    color="primary"
                    onClick={applySettings}
                    sx={{marginRight: 1}}
                >
                    Apply
                </Button>
                <Button
                    variant="outlined"
                    color="secondary"
                    onClick={close}
                    sx={{marginLeft: 1}}
                >
                    Cancel
                </Button>
            </Box>
        </Box>
    )
}
