import React, {forwardRef, useImperativeHandle, useState} from 'react'
import {
    Box,
    FormControl,
    FormLabel,
    MenuItem,
    Select,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import {ColorResult, SketchPicker} from 'react-color'
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
import {
    borderStyleNames,
    PreviewLineComponent,
} from '@/components/top-bar/content/preview-line'
import {StBorderStyle} from 'logisheets-web'
import {
    BatchUpdateType,
    generateBorderPayloads,
} from '@/components/top-bar/content/payload'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {DataServiceImpl} from '@/core/data'
import {SelectedData} from '@/components/canvas'
import {Transaction} from 'logisheets-web'
import {StandardColor} from '@/core/standable'

export interface BorderModel {
    color?: string
    borderType?: StBorderStyle
    batch?: BatchUpdateType
}

export interface BorderPanelProps {
    value?: BorderModel
    onChange?: (v: BorderModel) => void
    selectedData: SelectedData
}

export interface BorderPanelHandle {
    confirm: () => void
}

const BorderPanel = forwardRef<BorderPanelHandle, BorderPanelProps>(
    ({value, onChange, selectedData}, ref) => {
        const dataSvc = useInjection<DataServiceImpl>(TYPES.Data)
        const [color, setColor] = useState<StandardColor>(
            StandardColor.from(0, 0, 0)
        )
        const [showColorPicker, setShowColorPicker] = useState(false)
        const [batch, setBatch] = useState<BatchUpdateType>(
            value?.batch || 'all'
        )
        const [style, setStyle] = useState<StBorderStyle>(
            value?.borderType || 'thin'
        )

        const emit = (next: Partial<BorderModel>) => {
            const v: BorderModel = {
                color: color.css(),
                borderType: style,
                batch,
                ...next,
            }
            onChange?.(v)
        }

        const previewLineWidth = 1
        const borderStyle = 'solid'

        useImperativeHandle(
            ref,
            () => ({
                confirm: () => {
                    try {
                        if (!onChange) {
                            // still can apply with current local state
                        }
                        const sd = selectedData
                        if (!sd) return
                        const sheetIdx = dataSvc.getCurrentSheetIdx()
                        const payloads = generateBorderPayloads(sheetIdx, sd, {
                            batch,
                            color: color.argb(),
                            borderType: style,
                        })
                        if (payloads.length) {
                            dataSvc.handleTransaction(
                                new Transaction(payloads, true)
                            )
                        }
                    } catch (e) {
                        // swallow; parent may handle errors/toasts
                    }
                },
            }),
            [batch, color, style, dataSvc, selectedData]
        )

        return (
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: '280px 1fr',
                    gap: 3,
                    p: 2,
                }}
            >
                <Box>
                    <Typography variant="subtitle2" gutterBottom>
                        Color
                    </Typography>
                    <Box
                        sx={{
                            width: 36,
                            height: 36,
                            bgcolor: color.css(),
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
                                onChangeComplete={(cr: ColorResult) => {
                                    setColor(
                                        StandardColor.from(
                                            cr.rgb.r,
                                            cr.rgb.g,
                                            cr.rgb.b
                                        )
                                    )
                                    emit({color: color.css()})
                                }}
                            />
                        </Box>
                    )}

                    <Box mt={3}>
                        <FormControl fullWidth>
                            <FormLabel>Style</FormLabel>
                            <Select
                                value={style}
                                onChange={(e) => {
                                    const s = e.target.value as StBorderStyle
                                    setStyle(s)
                                    emit({borderType: s})
                                }}
                                renderValue={(v) => (
                                    <Box
                                        display="flex"
                                        alignItems="baseline"
                                        mx={1}
                                        flexDirection="column"
                                    >
                                        <PreviewLineComponent
                                            style={v as StBorderStyle}
                                        />
                                    </Box>
                                )}
                            >
                                {borderStyleNames.map((v) => (
                                    <MenuItem key={v} value={v}>
                                        <PreviewLineComponent
                                            style={v as StBorderStyle}
                                        />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </Box>

                <Box>
                    <Typography variant="subtitle2" gutterBottom>
                        Border Range
                    </Typography>
                    <ToggleButtonGroup
                        exclusive
                        value={batch}
                        onChange={(_, newVal) => {
                            if (newVal) {
                                setBatch(newVal)
                                emit({batch: newVal})
                            }
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

                    <Box
                        mt={3}
                        p={2}
                        border="1px solid #ccc"
                        borderRadius={2}
                        justifyItems="center"
                        display="inline-block"
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
                                        batch === 'outer' || batch === 'all'
                                            ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                            : 'none',
                                }}
                            />
                            <Box
                                sx={{
                                    gridRow: '1',
                                    gridColumn: '1 / 3',
                                    borderTop:
                                        batch === 'top' || batch === 'all'
                                            ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                            : 'none',
                                    borderRight:
                                        batch === 'right' || batch === 'all'
                                            ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                            : 'none',
                                }}
                            />
                            <Box
                                sx={{
                                    gridRow: '2',
                                    gridColumn: '1 / 3',
                                    borderBottom:
                                        batch === 'bottom' || batch === 'all'
                                            ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                            : 'none',
                                    borderTop:
                                        batch === 'inner' ||
                                        batch === 'all' ||
                                        batch === 'horizontal'
                                            ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                            : 'none',
                                    borderRight:
                                        batch === 'right' || batch === 'all'
                                            ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                            : 'none',
                                }}
                            />
                            <Box
                                sx={{
                                    gridRow: '1 / 3',
                                    gridColumn: '1',
                                    borderLeft:
                                        batch === 'left' || batch === 'all'
                                            ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                            : 'none',
                                    borderRight:
                                        batch === 'inner' ||
                                        batch === 'all' ||
                                        batch === 'vertical'
                                            ? `${previewLineWidth}px ${borderStyle} ${color.css()}`
                                            : 'none',
                                }}
                            />
                        </Box>
                    </Box>
                </Box>
            </Box>
        )
    }
)

BorderPanel.displayName = 'BorderPanel'

export default BorderPanel
