import {useState, MouseEvent} from 'react'
import {
    Box,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Stack,
} from '@mui/material'
import {
    CellInputBuilder,
    Payload,
    SetColWidthBuilder,
    SetRowHeightBuilder,
    Transaction,
} from 'logisheets-web'
import {DataServiceImpl} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {BlockCellProps, valueToString} from './cell'
import {pxToPt, pxToWidth} from '@/core'

type ImageSize = '50%' | '100%'

export const ImageCell = (props: BlockCellProps) => {
    const {x, y, width, height, value, sheetIdx, rowIdx, colIdx} = props

    const DATA_SERVICE = useInjection<DataServiceImpl>(TYPES.Data)

    const [imageSize, setImageSize] = useState<ImageSize>('100%')
    const [contextMenu, setContextMenu] = useState<{
        mouseX: number
        mouseY: number
    } | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [tempUrl, setTempUrl] = useState('')
    const [imageDimensions, setImageDimensions] = useState<{
        width: number
        height: number
    } | null>(null)

    // Extract image URL from value
    // User will provide imageUrl in the value
    const imageUrl = valueToString(value)

    const handleContextMenu = (event: MouseEvent) => {
        event.preventDefault()
        setContextMenu(
            contextMenu === null
                ? {
                      mouseX: event.clientX + 2,
                      mouseY: event.clientY - 6,
                  }
                : null
        )
    }

    const handleClose = () => {
        setContextMenu(null)
    }

    const handleSizeChange = (size: ImageSize) => {
        setImageSize(size)
        handleClose()
    }

    const handleClick = () => {
        setTempUrl(imageUrl)
        setImageDimensions(null)
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogCancel = () => {
        setDialogOpen(false)
        setImageDimensions(null)
    }

    const handleDialogOk = async () => {
        if (!imageDimensions) return
        const payloads: Payload[] = []
        // Save the URL to the cell
        const p = new CellInputBuilder()
            .sheetIdx(sheetIdx)
            .row(rowIdx)
            .col(colIdx)
            .content(tempUrl)
            .build()
        const payload: Payload = {
            type: 'cellInput',
            value: p,
        }
        payloads.push(payload)
        const imageWidth = imageDimensions.width * getSizeMultiplier()
        console.log(imageWidth, getSizeMultiplier())
        if (width < imageWidth) {
            const columnAdjust = new SetColWidthBuilder()
                .sheetIdx(sheetIdx)
                .col(colIdx)
                .width(pxToWidth(imageWidth))
                .build()
            const payload: Payload = {
                type: 'setColWidth',
                value: columnAdjust,
            }
            payloads.push(payload)
        }
        const imageHeight = imageDimensions.height * getSizeMultiplier()
        if (height < imageHeight) {
            const rowAdjust = new SetRowHeightBuilder()
                .sheetIdx(sheetIdx)
                .row(rowIdx)
                .height(pxToPt(imageHeight))
                .build()
            const payload: Payload = {
                type: 'setRowHeight',
                value: rowAdjust,
            }
            payloads.push(payload)
        }

        await DATA_SERVICE.handleTransaction(
            new Transaction(payloads, true)
        ).then(() => {
            // Update the display size
            setDialogOpen(false)
            setImageDimensions(null)
        })
    }

    const getSizeMultiplier = () => {
        switch (imageSize) {
            case '50%':
                return 0.5
            case '100%':
                return 1
            default:
                return 1
        }
    }

    return (
        <>
            <Box
                sx={{
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    border: '1px solid',
                    borderColor: 'divider',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                        borderColor: 'primary.light',
                        bgcolor: 'action.hover',
                    },
                    pointerEvents: 'auto',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.paper',
                }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
            >
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt="Cell content"
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            userSelect: 'none',
                        }}
                    />
                ) : (
                    <Box
                        sx={{
                            color: 'text.disabled',
                            fontSize: '2rem',
                            textAlign: 'center',
                        }}
                    >
                        🖼️
                    </Box>
                )}
            </Box>

            <Menu
                open={contextMenu !== null}
                onClose={handleClose}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? {top: contextMenu.mouseY, left: contextMenu.mouseX}
                        : undefined
                }
                slotProps={{
                    paper: {
                        sx: {
                            minWidth: 160,
                        },
                    },
                }}
            >
                <MenuItem
                    onClick={() => handleSizeChange('50%')}
                    selected={imageSize === '50%'}
                >
                    <ListItemIcon>
                        {imageSize === '50%' ? '✓' : ''}
                    </ListItemIcon>
                    <ListItemText>50% Display</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => handleSizeChange('100%')}
                    selected={imageSize === '100%'}
                >
                    <ListItemIcon>
                        {imageSize === '100%' ? '✓' : ''}
                    </ListItemIcon>
                    <ListItemText>100% Display</ListItemText>
                </MenuItem>
            </Menu>

            <Dialog
                open={dialogOpen}
                onClose={handleDialogClose}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Image Settings</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{mt: 1}}>
                        {/* URL Input */}
                        <TextField
                            fullWidth
                            label="Image URL"
                            value={tempUrl}
                            onChange={(e) => setTempUrl(e.target.value)}
                            placeholder="Enter image URL"
                            size="small"
                        />

                        {/* Size Selection */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">
                                Display Size
                            </FormLabel>
                            <RadioGroup
                                row
                                value={imageSize}
                                onChange={(e) =>
                                    setImageSize(e.target.value as ImageSize)
                                }
                            >
                                <FormControlLabel
                                    value="50%"
                                    control={<Radio />}
                                    label="50%"
                                />
                                <FormControlLabel
                                    value="100%"
                                    control={<Radio />}
                                    label="100%"
                                />
                            </RadioGroup>
                        </FormControl>

                        {/* Preview Area */}
                        <Box>
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: 1,
                                }}
                            >
                                <FormLabel component="legend">
                                    Preview
                                </FormLabel>
                                {imageDimensions && (
                                    <Box
                                        sx={{
                                            fontSize: '0.875rem',
                                            color: 'text.secondary',
                                        }}
                                    >
                                        {imageDimensions.width} {'×'}{' '}
                                        {imageDimensions.height} px
                                    </Box>
                                )}
                            </Box>
                            <Box
                                sx={{
                                    width: '100%',
                                    height: 300,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: 'background.default',
                                    overflow: 'hidden',
                                }}
                            >
                                {tempUrl ? (
                                    <img
                                        src={tempUrl}
                                        alt="Preview"
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: '100%',
                                            objectFit: 'contain',
                                        }}
                                        onLoad={(e) => {
                                            const img = e.currentTarget
                                            setImageDimensions({
                                                width: img.naturalWidth,
                                                height: img.naturalHeight,
                                            })
                                        }}
                                        onError={(e) => {
                                            e.currentTarget.style.display =
                                                'none'
                                            setImageDimensions(null)
                                        }}
                                    />
                                ) : (
                                    <Box
                                        sx={{
                                            color: 'text.disabled',
                                            textAlign: 'center',
                                        }}
                                    >
                                        Enter image URL to preview
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogCancel}>Cancel</Button>
                    <Button
                        onClick={handleDialogOk}
                        variant="contained"
                        disabled={!tempUrl}
                    >
                        OK
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
