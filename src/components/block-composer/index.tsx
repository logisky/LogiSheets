import {getSelectedCellRange, SelectedData} from '../canvas'
import {useState, useEffect} from 'react'
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    IconButton,
    TextField,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Chip,
    Stack,
    Dialog,
    DialogContent,
    Tooltip,
    Divider,
    Checkbox,
    FormControlLabel,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    TextareaAutosize,
} from '@mui/material'
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    DragIndicator as DragIndicatorIcon,
    Circle as CircleIcon,
} from '@mui/icons-material'
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from 'react-beautiful-dnd'
import {useToast} from '@/ui/notification/useToast'
import {TYPES} from '@/core/ioc/types'
import {useInjection} from '@/core/ioc/provider'
import {DataServiceImpl as DataService} from '@/core/data'

// Field Type Definitions
export type FieldTypeEnum =
    | 'enum'
    | 'multiSelect'
    | 'datetime'
    | 'boolean'
    | 'string'
    | 'number'

export interface EnumValue {
    id: string
    label: string
    description: string
    color: string
}

export interface FieldSetting {
    id: string
    name: string
    type: FieldTypeEnum
    description?: string
    required: boolean
    showInSummary: boolean
    enumValues: EnumValue[]
    defaultValue?: string
    format?: string // for datetime
    validation?: string // for string/number
}

export interface BlockComposerProps {
    selectedData?: SelectedData
    close: () => void
}

const COLORS = [
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
]

export const BlockComposerComponent = (props: BlockComposerProps) => {
    const {selectedData, close} = props
    const {toast} = useToast()
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)

    const [fields, setFields] = useState<FieldSetting[]>([
        {
            id: '1',
            name: 'Customer Status',
            type: 'enum',
            description: 'Current status of the customer',
            required: true,
            showInSummary: true,
            enumValues: [
                {
                    id: '1',
                    label: 'Active',
                    description: 'Active customers',
                    color: COLORS[0],
                },
                {
                    id: '2',
                    label: 'Pending',
                    description: 'Pending approval',
                    color: COLORS[1],
                },
                {
                    id: '3',
                    label: 'Inactive',
                    description: 'Inactive accounts',
                    color: COLORS[2],
                },
            ],
            defaultValue: '1',
        },
    ])
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(
        fields[0]?.id || null
    )
    const [isDragEnabled, setIsDragEnabled] = useState(false)

    // Enable drag after component mounts to avoid timing issues
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsDragEnabled(true)
        }, 100)
        return () => clearTimeout(timer)
    }, [])

    if (!selectedData) {
        return null
    }
    const range = getSelectedCellRange(selectedData)
    if (!range) {
        return null
    }

    const selectedField = fields.find((f) => f.id === selectedFieldId)

    const handleAddField = () => {
        const newField: FieldSetting = {
            id: Date.now().toString(),
            name: 'New Field',
            type: 'string',
            required: false,
            showInSummary: false,
            enumValues: [],
        }
        setFields([...fields, newField])
        setSelectedFieldId(newField.id)
    }

    const handleUpdateField = (field: FieldSetting) => {
        setFields(fields.map((f) => (f.id === field.id ? field : f)))
    }

    const handleDeleteField = (id: string) => {
        setFields(fields.filter((f) => f.id !== id))
        if (selectedFieldId === id) {
            setSelectedFieldId(fields[0]?.id || null)
        }
    }

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) {
            return
        }

        const items = Array.from(fields)
        const [reorderedItem] = items.splice(result.source.index, 1)
        items.splice(result.destination.index, 0, reorderedItem)

        setFields(items)
    }

    const handleSave = () => {
        toast('Fields configured successfully!', {type: 'success'})
        close()
    }

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Dialog
                open={true}
                onClose={close}
                maxWidth="lg"
                fullWidth
                PaperProps={{sx: {height: '80vh'}}}
            >
                <DialogContent sx={{p: 0, display: 'flex', height: '100%'}}>
                    {/* Left Sidebar - Field List */}
                    <Box
                        sx={{
                            width: 280,
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            flexDirection: 'column',
                            bgcolor: 'grey.50',
                        }}
                    >
                        <Box
                            sx={{
                                p: 2,
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                            }}
                        >
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                fullWidth
                                onClick={handleAddField}
                                sx={{textTransform: 'none'}}
                            >
                                Add New Field
                            </Button>
                        </Box>
                        {isDragEnabled ? (
                            <Droppable droppableId="fields-list">
                                {(provided) => (
                                    <List
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        sx={{flex: 1, overflow: 'auto', py: 0}}
                                    >
                                        {fields.map((field, index) => (
                                            <Draggable
                                                key={field.id}
                                                draggableId={field.id}
                                                index={index}
                                            >
                                                {(provided, snapshot) => (
                                                    <ListItem
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        disablePadding
                                                        sx={{
                                                            bgcolor:
                                                                snapshot.isDragging
                                                                    ? 'action.hover'
                                                                    : 'transparent',
                                                        }}
                                                    >
                                                        <ListItemButton
                                                            selected={
                                                                selectedFieldId ===
                                                                field.id
                                                            }
                                                            onClick={() =>
                                                                setSelectedFieldId(
                                                                    field.id
                                                                )
                                                            }
                                                            sx={{
                                                                py: 1.5,
                                                                borderLeft:
                                                                    '3px solid transparent',
                                                                '&.Mui-selected':
                                                                    {
                                                                        borderLeftColor:
                                                                            'primary.main',
                                                                        bgcolor:
                                                                            'primary.50',
                                                                    },
                                                            }}
                                                        >
                                                            <Box
                                                                {...provided.dragHandleProps}
                                                                sx={{
                                                                    display:
                                                                        'flex',
                                                                    alignItems:
                                                                        'center',
                                                                    mr: 1,
                                                                    color: 'text.disabled',
                                                                }}
                                                            >
                                                                <DragIndicatorIcon fontSize="small" />
                                                            </Box>
                                                            <ListItemText
                                                                primary={
                                                                    field.name
                                                                }
                                                                secondary={
                                                                    field.type
                                                                        .charAt(
                                                                            0
                                                                        )
                                                                        .toUpperCase() +
                                                                    field.type.slice(
                                                                        1
                                                                    )
                                                                }
                                                                slotProps={{
                                                                    primary: {
                                                                        style: {
                                                                            fontWeight: 500,
                                                                            fontSize:
                                                                                '0.9rem',
                                                                        },
                                                                    },
                                                                    secondary: {
                                                                        style: {
                                                                            fontSize:
                                                                                '0.75rem',
                                                                        },
                                                                    },
                                                                }}
                                                            />
                                                        </ListItemButton>
                                                    </ListItem>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </List>
                                )}
                            </Droppable>
                        ) : (
                            <List sx={{flex: 1, overflow: 'auto', py: 0}}>
                                {fields.map((field) => (
                                    <ListItem key={field.id} disablePadding>
                                        <ListItemButton
                                            selected={
                                                selectedFieldId === field.id
                                            }
                                            onClick={() =>
                                                setSelectedFieldId(field.id)
                                            }
                                            sx={{
                                                py: 1.5,
                                                borderLeft:
                                                    '3px solid transparent',
                                                '&.Mui-selected': {
                                                    borderLeftColor:
                                                        'primary.main',
                                                    bgcolor: 'primary.50',
                                                },
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    mr: 1,
                                                    color: 'text.disabled',
                                                }}
                                            >
                                                <DragIndicatorIcon fontSize="small" />
                                            </Box>
                                            <ListItemText
                                                primary={field.name}
                                                secondary={
                                                    field.type
                                                        .charAt(0)
                                                        .toUpperCase() +
                                                    field.type.slice(1)
                                                }
                                                slotProps={{
                                                    primary: {
                                                        style: {
                                                            fontWeight: 500,
                                                            fontSize: '0.9rem',
                                                        },
                                                    },
                                                    secondary: {
                                                        style: {
                                                            fontSize: '0.75rem',
                                                        },
                                                    },
                                                }}
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Box>

                    {/* Right Panel - Field Editor */}
                    <Box
                        sx={{flex: 1, display: 'flex', flexDirection: 'column'}}
                    >
                        {selectedField ? (
                            <FieldConfigPanel
                                field={selectedField}
                                onUpdate={handleUpdateField}
                                onDelete={() =>
                                    handleDeleteField(selectedField.id)
                                }
                                onCancel={close}
                                onSave={handleSave}
                            />
                        ) : (
                            <Box
                                sx={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Typography color="text.secondary">
                                    Select a field to configure
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </DialogContent>
            </Dialog>
        </DragDropContext>
    )
}

// Field Config Panel Component
interface FieldConfigPanelProps {
    field: FieldSetting
    onUpdate: (field: FieldSetting) => void
    onDelete: () => void
    onCancel: () => void
    onSave: () => void
}

const FieldConfigPanel = ({
    field,
    onUpdate,
    onDelete,
    onCancel,
    onSave,
}: FieldConfigPanelProps) => {
    const handleAddEnumValue = () => {
        const newValue: EnumValue = {
            id: Date.now().toString(),
            label: '',
            description: '',
            color: COLORS[field.enumValues.length % COLORS.length],
        }
        onUpdate({...field, enumValues: [...field.enumValues, newValue]})
    }

    const handleUpdateEnumValue = (id: string, updated: Partial<EnumValue>) => {
        onUpdate({
            ...field,
            enumValues: field.enumValues.map((v) =>
                v.id === id ? {...v, ...updated} : v
            ),
        })
    }

    const handleDeleteEnumValue = (id: string) => {
        onUpdate({
            ...field,
            enumValues: field.enumValues.filter((v) => v.id !== id),
        })
    }

    const showEnumSection =
        field.type === 'enum' || field.type === 'multiSelect'

    return (
        <>
            {/* Header */}
            <Box
                sx={{
                    p: 2.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <Typography variant="h6" fontWeight={600}>
                    {field.name}
                </Typography>
                <Box display="flex" gap={1}>
                    <Button onClick={onCancel} size="small">
                        Cancel
                    </Button>
                    <Button onClick={onSave} variant="contained" size="small">
                        Save Changes
                    </Button>
                </Box>
            </Box>

            {/* Content */}
            <Box sx={{flex: 1, overflow: 'auto', p: 3}}>
                <Stack spacing={3}>
                    {/* Basic Settings */}
                    <Card variant="outlined">
                        <CardContent>
                            <Typography
                                variant="subtitle1"
                                fontWeight={600}
                                mb={2}
                            >
                                Basic Settings
                            </Typography>
                            <Stack spacing={2.5}>
                                <TextField
                                    fullWidth
                                    label="Field Name"
                                    value={field.name}
                                    onChange={(e) =>
                                        onUpdate({
                                            ...field,
                                            name: e.target.value,
                                        })
                                    }
                                    size="small"
                                />
                                <FormControl fullWidth size="small">
                                    <InputLabel>Field Type</InputLabel>
                                    <Select
                                        value={field.type}
                                        label="Field Type"
                                        onChange={(e) =>
                                            onUpdate({
                                                ...field,
                                                type: e.target
                                                    .value as FieldTypeEnum,
                                                enumValues:
                                                    e.target.value === 'enum' ||
                                                    e.target.value ===
                                                        'multiSelect'
                                                        ? field.enumValues
                                                        : [],
                                            })
                                        }
                                    >
                                        <MenuItem value="enum">Enum</MenuItem>
                                        <MenuItem value="multiSelect">
                                            Multiple Selection
                                        </MenuItem>
                                        <MenuItem value="datetime">
                                            DateTime
                                        </MenuItem>
                                        <MenuItem value="boolean">
                                            Boolean
                                        </MenuItem>
                                        <MenuItem value="string">
                                            String
                                        </MenuItem>
                                        <MenuItem value="number">
                                            Number
                                        </MenuItem>
                                    </Select>
                                </FormControl>
                                <TextField
                                    fullWidth
                                    label="Description"
                                    value={field.description || ''}
                                    onChange={(e) =>
                                        onUpdate({
                                            ...field,
                                            description: e.target.value,
                                        })
                                    }
                                    multiline
                                    rows={2}
                                    size="small"
                                    placeholder="Optional field description"
                                />
                                <Box>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={field.required}
                                                onChange={(e) =>
                                                    onUpdate({
                                                        ...field,
                                                        required:
                                                            e.target.checked,
                                                    })
                                                }
                                            />
                                        }
                                        label="Required field"
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={field.showInSummary}
                                                onChange={(e) =>
                                                    onUpdate({
                                                        ...field,
                                                        showInSummary:
                                                            e.target.checked,
                                                    })
                                                }
                                            />
                                        }
                                        label="Show in summary"
                                    />
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* Enum Values Section */}
                    {showEnumSection && (
                        <Card variant="outlined">
                            <CardContent>
                                <Box
                                    display="flex"
                                    justifyContent="space-between"
                                    alignItems="center"
                                    mb={2}
                                >
                                    <Typography
                                        variant="subtitle1"
                                        fontWeight={600}
                                    >
                                        Enum Values
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={handleAddEnumValue}
                                        sx={{textTransform: 'none'}}
                                    >
                                        Add Value
                                    </Button>
                                </Box>
                                <Stack spacing={1.5}>
                                    {field.enumValues.map((enumValue) => (
                                        <Box
                                            key={enumValue.id}
                                            sx={{
                                                display: 'flex',
                                                gap: 1.5,
                                                alignItems: 'flex-start',
                                                p: 1.5,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                                bgcolor: 'grey.50',
                                            }}
                                        >
                                            <DragIndicatorIcon
                                                sx={{
                                                    color: 'text.disabled',
                                                    mt: 1,
                                                    cursor: 'grab',
                                                }}
                                            />
                                            <CircleIcon
                                                sx={{
                                                    color: enumValue.color,
                                                    mt: 1,
                                                    fontSize: 16,
                                                }}
                                            />
                                            <Box sx={{flex: 1}}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    value={enumValue.label}
                                                    onChange={(e) =>
                                                        handleUpdateEnumValue(
                                                            enumValue.id,
                                                            {
                                                                label: e.target
                                                                    .value,
                                                            }
                                                        )
                                                    }
                                                    placeholder="Label (e.g., Active)"
                                                    sx={{mb: 1}}
                                                />
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    value={
                                                        enumValue.description
                                                    }
                                                    onChange={(e) =>
                                                        handleUpdateEnumValue(
                                                            enumValue.id,
                                                            {
                                                                description:
                                                                    e.target
                                                                        .value,
                                                            }
                                                        )
                                                    }
                                                    placeholder="Description (e.g., Active customers)"
                                                />
                                            </Box>
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    handleDeleteEnumValue(
                                                        enumValue.id
                                                    )
                                                }
                                                color="error"
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    ))}
                                </Stack>
                            </CardContent>
                        </Card>
                    )}

                    {/* Default Value Section */}
                    {showEnumSection && field.enumValues.length > 0 && (
                        <Card variant="outlined">
                            <CardContent>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    mb={1}
                                >
                                    Default Value
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    display="block"
                                    mb={2}
                                >
                                    Select which value should be pre-selected
                                    when creating new records.
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Default Value</InputLabel>
                                    <Select
                                        value={field.defaultValue || ''}
                                        label="Default Value"
                                        onChange={(e) =>
                                            onUpdate({
                                                ...field,
                                                defaultValue: e.target.value,
                                            })
                                        }
                                    >
                                        <MenuItem value="">None</MenuItem>
                                        {field.enumValues.map((v) => (
                                            <MenuItem key={v.id} value={v.id}>
                                                <Box
                                                    display="flex"
                                                    alignItems="center"
                                                    gap={1}
                                                >
                                                    <CircleIcon
                                                        sx={{
                                                            color: v.color,
                                                            fontSize: 12,
                                                        }}
                                                    />
                                                    {v.label}
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </CardContent>
                        </Card>
                    )}

                    {/* DateTime Format */}
                    {field.type === 'datetime' && (
                        <Card variant="outlined">
                            <CardContent>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    mb={2}
                                >
                                    Date/Time Format
                                </Typography>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Format"
                                    value={field.format || 'yyyy-mm-dd'}
                                    onChange={(e) =>
                                        onUpdate({
                                            ...field,
                                            format: e.target.value,
                                        })
                                    }
                                    placeholder="e.g., yyyy-mm-dd, mm/dd/yyyy hh:mm"
                                    helperText="Use Excel-style number format"
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Validation for String/Number */}
                    {(field.type === 'string' || field.type === 'number') && (
                        <Card variant="outlined">
                            <CardContent>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    mb={2}
                                >
                                    Validation Rule
                                </Typography>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Validation"
                                    value={field.validation || ''}
                                    onChange={(e) =>
                                        onUpdate({
                                            ...field,
                                            validation: e.target.value,
                                        })
                                    }
                                    placeholder="e.g., ${value} > 0 && ${value} < 100"
                                    helperText="Use ${value} to reference the input value"
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Delete Field */}
                    <Box sx={{pt: 2}}>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={onDelete}
                            sx={{textTransform: 'none'}}
                        >
                            Delete this field
                        </Button>
                    </Box>
                </Stack>
            </Box>
        </>
    )
}
