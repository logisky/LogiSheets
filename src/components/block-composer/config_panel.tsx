import {useState} from 'react'
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
    Stack,
    Checkbox,
    FormControlLabel,
    Grid,
    Popover,
} from '@mui/material'
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    DragIndicator as DragIndicatorIcon,
    Circle as CircleIcon,
} from '@mui/icons-material'
import {FieldSetting, EnumValue, FieldTypeEnum, COLORS} from './types'

interface FieldConfigPanelProps {
    field: FieldSetting
    onUpdate: (field: FieldSetting) => void
    onDelete: () => void
    onCancel: () => void
    onSave: () => void
}

export const FieldConfigPanel = ({
    field,
    onUpdate,
    onDelete,
    onCancel,
    onSave,
}: FieldConfigPanelProps) => {
    const [colorAnchorEl, setColorAnchorEl] = useState<{
        element: HTMLElement
        enumId: string
    } | null>(null)
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

    const handleOpenColorPicker = (
        event: React.MouseEvent<HTMLElement>,
        enumId: string
    ) => {
        setColorAnchorEl({element: event.currentTarget, enumId})
    }

    const handleCloseColorPicker = () => {
        setColorAnchorEl(null)
    }

    const handleSelectColor = (color: string) => {
        if (colorAnchorEl) {
            handleUpdateEnumValue(colorAnchorEl.enumId, {color})
        }
        handleCloseColorPicker()
    }

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
                                <Box sx={{display: 'flex', gap: 2}}>
                                    <TextField
                                        label="Field Name"
                                        value={field.name}
                                        onChange={(e) =>
                                            onUpdate({
                                                ...field,
                                                name: e.target.value,
                                            })
                                        }
                                        size="small"
                                        sx={{flex: 1}}
                                    />
                                    <FormControl size="small" sx={{flex: 1}}>
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
                                                        e.target.value ===
                                                            'enum' ||
                                                        e.target.value ===
                                                            'multiSelect'
                                                            ? field.enumValues
                                                            : [],
                                                })
                                            }
                                        >
                                            <MenuItem value="enum">
                                                Enum
                                            </MenuItem>
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
                                </Box>
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
                                <Grid container spacing={2}>
                                    {field.enumValues.map((enumValue) => (
                                        <Grid item xs={6} key={enumValue.id}>
                                            <Box
                                                sx={{
                                                    p: 2,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    borderRadius: 1,
                                                    bgcolor: 'grey.50',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: 1.5,
                                                    height: '100%',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                    }}
                                                >
                                                    <DragIndicatorIcon
                                                        sx={{
                                                            color: 'text.disabled',
                                                            cursor: 'grab',
                                                            fontSize: 20,
                                                        }}
                                                    />
                                                    {/* Color Picker Circle */}
                                                    <Box
                                                        onClick={(e) =>
                                                            handleOpenColorPicker(
                                                                e,
                                                                enumValue.id
                                                            )
                                                        }
                                                        sx={{
                                                            width: 18,
                                                            height: 18,
                                                            borderRadius: '50%',
                                                            bgcolor:
                                                                enumValue.color,
                                                            cursor: 'pointer',
                                                            border: '2px solid',
                                                            borderColor:
                                                                'grey.300',
                                                            transition:
                                                                'all 0.2s',
                                                            flexShrink: 0,
                                                            '&:hover': {
                                                                transform:
                                                                    'scale(1.2)',
                                                                boxShadow: 2,
                                                                borderColor:
                                                                    'primary.main',
                                                            },
                                                        }}
                                                    />
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        value={enumValue.label}
                                                        onChange={(e) =>
                                                            handleUpdateEnumValue(
                                                                enumValue.id,
                                                                {
                                                                    label: e
                                                                        .target
                                                                        .value,
                                                                }
                                                            )
                                                        }
                                                        placeholder="Label"
                                                    />
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
                                            </Box>
                                        </Grid>
                                    ))}
                                </Grid>
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

            {/* Color Picker Popover */}
            <Popover
                open={Boolean(colorAnchorEl)}
                anchorEl={colorAnchorEl?.element}
                onClose={handleCloseColorPicker}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                <Box
                    sx={{
                        p: 2,
                        display: 'flex',
                        gap: 1.5,
                        flexWrap: 'wrap',
                        maxWidth: 200,
                    }}
                >
                    {COLORS.map((color) => {
                        const currentEnumValue = field.enumValues.find(
                            (v) => v.id === colorAnchorEl?.enumId
                        )
                        const isSelected = currentEnumValue?.color === color

                        return (
                            <Box
                                key={color}
                                onClick={() => handleSelectColor(color)}
                                sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    bgcolor: color,
                                    cursor: 'pointer',
                                    border: isSelected
                                        ? '3px solid'
                                        : '2px solid',
                                    borderColor: isSelected
                                        ? 'primary.main'
                                        : 'grey.300',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        transform: 'scale(1.15)',
                                        boxShadow: 3,
                                    },
                                }}
                            />
                        )
                    })}
                </Box>
            </Popover>
        </>
    )
}
