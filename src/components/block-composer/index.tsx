import {getSelectedCellRange, SelectedData} from '../canvas'
import React, {useState} from 'react'
import Collapse from '@mui/material/Collapse'
import {DeleteOutline} from '@mui/icons-material'
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    IconButton,
    Grid2,
    TextField,
    Divider,
    Tooltip,
    ToggleButton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import {useToast} from '@/ui/notification/useToast'
import {TYPES} from '@/core/ioc/types'
import {useInjection} from '@/core/ioc/provider'
import {CraftManager, DataService} from '@/core/data'
import {CraftDescriptor, DataArea, DataPort} from 'logisheets-craft-forge'
import {
    Payload,
    CreateBlockBuilder,
    isErrorMessage,
    CellInputBuilder,
    CreateAppendixBuilder,
    Transaction,
} from 'logisheets-web'

export interface BlockComposerProps {
    selectedData?: SelectedData
    close: () => void
}

export const BlockComposerComponent = (props: BlockComposerProps) => {
    const {selectedData, close} = props
    const {toast} = useToast()
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const CRAFT_MANAGER = useInjection<CraftManager>(TYPES.CraftManager)

    if (!selectedData) {
        toast('Please select a cell range first', {type: 'error'})
        return null
    }
    const range = getSelectedCellRange(selectedData)
    if (!range) {
        toast('Please select a cell range first', {type: 'error'})
        return null
    }
    const [fields, setFields] = useState<FieldSetting[]>([])
    const [start, setDataAreaStartRow] = useState(0)
    const [end, setDataAreaStartCol] = useState(0)
    const [showDataPortSettings, setShowDataPortSettings] = useState(false)
    const [dataPort, setDataPort] = useState<{
        baseUrl: string
        identifier: string
    }>({
        baseUrl: '',
        identifier: '',
    })

    const handleAdd = () => {
        setFields([...fields, {validation: '', name: ''}])
    }

    const handleSubmit = async () => {
        const dataArea: DataArea = {
            startRow: start,
            startCol: end,
            direction: 'vertical',
        }
        const masterRow = range.startRow
        const masterCol = range.startCol

        const payloads: Payload[] = []
        const sheetIdx = DATA_SERVICE.getCurrentSheetIdx()
        const sheetId = await DATA_SERVICE.getSheetId(sheetIdx)
        if (isErrorMessage(sheetId)) {
            toast('Failed to get sheet ID', {type: 'error'})
            return
        }
        const blockId = await DATA_SERVICE.getAvailableBlockId(sheetIdx)
        if (isErrorMessage(blockId)) {
            toast('Failed to get available block ID', {type: 'error'})
            return
        }

        const createBlock: Payload = {
            type: 'createBlock',
            value: new CreateBlockBuilder()
                .id(blockId)
                .sheetIdx(sheetIdx)
                .masterRow(masterRow)
                .rowCnt(range.endRow - range.startRow + 1)
                .masterCol(masterCol)
                .colCnt(range.endCol - range.startCol + 1)
                .build(),
        }

        payloads.push(createBlock)

        fields.forEach((field, idx) => {
            const createField: Payload = {
                type: 'cellInput',
                value: new CellInputBuilder()
                    .sheetIdx(sheetIdx)
                    .row(masterRow)
                    .col(masterCol + idx)
                    .content(field.name)
                    .build(),
            }
            payloads.push(createField)
            const createAppendix: Payload = {
                type: 'createAppendix',
                value: new CreateAppendixBuilder()
                    .sheetIdx(sheetIdx)
                    .blockId(blockId)
                    .rowIdx(masterRow)
                    .colIdx(masterCol + idx)
                    .craftId('CRAFT_FIELD')
                    .tag(0)
                    .content(field.validation)
                    .build(),
            }
            payloads.push(createAppendix)
        })
        const result = await DATA_SERVICE.handleTransaction(
            new Transaction(payloads, true)
        )
        if (isErrorMessage(result)) {
            toast('Failed to create block', {type: 'error'})
            return
        }

        const dp: DataPort = {
            baseUrl: dataPort.baseUrl,
            identifier: dataPort.identifier,
        }

        const descriptor: CraftDescriptor = {
            dataArea,
            dataPort: dp,
        }

        CRAFT_MANAGER.addCraftDescriptor([sheetId, blockId], descriptor)
        close()
    }

    const textNumberInput = (
        value: number,
        setValue: (value: number) => void,
        label: string,
        min?: number,
        max?: number
    ) => (
        <Box display="flex" alignItems="center" gap={1}>
            <TextField
                type="number"
                size="small"
                value={value}
                label={label}
                slotProps={{
                    input: {
                        inputMode: 'numeric',
                        style: {textAlign: 'center', width: 160},
                    },
                }}
                onChange={(e) => {
                    let v = Number(e.target.value)
                    if (min !== undefined && v < min) {
                        v = min
                    } else if (max !== undefined && v > max) {
                        v = max
                    }
                    setValue(v)
                }}
            />
        </Box>
    )

    return (
        <Box p={3} width={380} bgcolor="Menu" borderRadius={3} boxShadow={4}>
            <Typography
                variant="h5"
                mb={2}
                fontWeight={700}
                color="primary.main"
            >
                Block Composer
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
                Data Area
            </Typography>

            <Box display="flex" gap={2} alignItems="center" mb={3}>
                {textNumberInput(
                    start,
                    setDataAreaStartRow,
                    'Start Row (relative)',
                    1,
                    range.endRow - range.startRow + 1
                )}
                {textNumberInput(
                    end,
                    setDataAreaStartCol,
                    'Start Column (relative)',
                    1,
                    range.endCol - range.startCol + 1
                )}
            </Box>

            <Typography variant="body2" color="text.secondary" mb={3}>
                Fields
            </Typography>
            <Grid2 direction="column" spacing={3}>
                {fields.map((el, idx) => (
                    <FieldSettingComponent
                        key={idx}
                        field={el}
                        idx={idx}
                        elements={fields}
                        setElements={setFields}
                    />
                ))}
            </Grid2>
            <Box display="flex" justifyContent="center">
                <ToggleButton
                    value="add"
                    size="small"
                    onClick={handleAdd}
                    sx={{
                        border: 'none',
                        '&.Mui-selected': {border: 'none'},
                    }}
                >
                    <AddIcon />
                </ToggleButton>
            </Box>
            <Divider sx={{my: 3}} />

            <Box mb={2}>
                <Button
                    variant="text"
                    size="small"
                    onClick={() => setShowDataPortSettings((v) => !v)}
                    sx={{textTransform: 'none'}}
                >
                    {showDataPortSettings
                        ? 'hide data port settings'
                        : 'show data port settings'}
                </Button>
                <Collapse in={showDataPortSettings}>
                    <Box mt={2} display="flex" flexDirection="column" gap={2}>
                        <TextField
                            label="URL"
                            size="small"
                            value={dataPort.baseUrl}
                            onChange={(e) =>
                                setDataPort((dp) => ({
                                    ...dp,
                                    baseUrl: e.target.value,
                                }))
                            }
                            placeholder="e.g. https://api.example.com"
                            fullWidth
                        />
                        <TextField
                            label="identifier"
                            size="small"
                            value={dataPort.identifier}
                            onChange={(e) =>
                                setDataPort((dp) => ({
                                    ...dp,
                                    identifier: e.target.value,
                                }))
                            }
                            fullWidth
                        />
                    </Box>
                </Collapse>
            </Box>

            <Box display="flex" justifyContent="flex-end" mt={4} gap={2}>
                <Button variant="outlined" color="inherit" onClick={close}>
                    Close
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit}
                >
                    Submit
                </Button>
            </Box>
        </Box>
    )
}

export interface FieldSetting {
    validation: string
    name: string
}

export const FieldSettingComponent = ({
    field,
    idx,
    elements,
    setElements,
}: {
    field: FieldSetting
    idx: number
    elements: FieldSetting[]
    setElements: (elements: FieldSetting[]) => void
}) => {
    const handleRemove = (idx: number) => {
        setElements(elements.filter((_, i) => i !== idx))
    }

    const handleChange = (
        idx: number,
        field: 'validation' | 'name',
        value: string
    ) => {
        setElements(
            elements.map((el, i) => (i === idx ? {...el, [field]: value} : el))
        )
    }

    return (
        <Grid2 key={idx}>
            <Card
                elevation={2}
                sx={{
                    borderRadius: 2,
                    background: '#f9fafb',
                    position: 'relative',
                }}
            >
                <CardContent>
                    <Grid2 direction="row" spacing={2} alignItems="center">
                        <Grid2 sx={{flexBasis: '41.666%'}}>
                            <TextField
                                label="name"
                                variant="outlined"
                                size="small"
                                fullWidth
                                value={field.name}
                                onChange={(e) =>
                                    handleChange(idx, 'name', e.target.value)
                                }
                                placeholder="e.g. Username"
                            />
                        </Grid2>
                        <Grid2 sx={{flexBasis: '41.666%'}}>
                            <TextField
                                label="validation"
                                variant="outlined"
                                size="small"
                                fullWidth
                                value={field.validation}
                                onChange={(e) =>
                                    handleChange(
                                        idx,
                                        'validation',
                                        e.target.value
                                    )
                                }
                                placeholder="e.g. ${value}<100"
                            />
                        </Grid2>
                        <Grid2 sx={{flexBasis: '16.666%'}}>
                            <Tooltip title="Remove Element">
                                <IconButton
                                    onClick={() => handleRemove(idx)}
                                    color="error"
                                    size="small"
                                >
                                    <DeleteOutline />
                                </IconButton>
                            </Tooltip>
                        </Grid2>
                    </Grid2>
                </CardContent>
            </Card>
        </Grid2>
    )
}
