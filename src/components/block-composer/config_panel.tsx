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
    Stack,
    Checkbox,
    FormControlLabel,
    Popover,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material'
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Circle as CircleIcon,
    Edit as EditIcon,
} from '@mui/icons-material'
import {FieldSetting, EnumValue, FieldTypeEnum, COLORS} from './types'
import {EnumSetManager} from '@/core/data/block/enum_set_manager'
import {useToast} from '@/ui/notification/useToast'

interface FieldConfigPanelProps {
    field: FieldSetting
    onUpdate: (field: FieldSetting) => void
    onDelete: () => void
    onCancel: () => void
    onSave: () => void
    enumSetManager: EnumSetManager
}

export const FieldConfigPanel = ({
    field,
    onUpdate,
    onDelete,
    onCancel,
    onSave,
    enumSetManager,
}: FieldConfigPanelProps) => {
    const {toast} = useToast()
    const [colorAnchorEl, setColorAnchorEl] = useState<{
        element: HTMLElement
        enumId: string
    } | null>(null)
    const [selectedEnumSetId, setSelectedEnumSetId] = useState<string>('')
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [newEnumSetName, setNewEnumSetName] = useState('')
    const [newEnumSetId, setNewEnumSetId] = useState('')
    const [newEnumSetDescription, setNewEnumSetDescription] = useState('')
    const [editingEnumVariants, setEditingEnumVariants] = useState<EnumValue[]>(
        []
    )

    const availableEnumSets = enumSetManager.getAll()
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
            // Only update in dialogs (main page is read-only)
            if (createDialogOpen || editDialogOpen) {
                handleUpdateEditingVariant(colorAnchorEl.enumId, {color})
            }
        }
        handleCloseColorPicker()
    }

    const handleSelectEnumSet = (enumSetId: string) => {
        if (enumSetId === 'CREATE_NEW') {
            // Open create dialog
            setCreateDialogOpen(true)
            return
        }

        setSelectedEnumSetId(enumSetId)
        // Only store the enum ID, not the values
        onUpdate({...field, enumId: enumSetId})
    }

    const handleCreateEnumSet = () => {
        if (!newEnumSetName.trim() || !newEnumSetId.trim()) {
            return
        }

        // Check if ID already exists
        if (enumSetManager.has(newEnumSetId)) {
            toast('An Enum Set with this ID already exists!', {type: 'error'})
            return
        }

        // Convert EnumValue to EnumVariant
        const variants = editingEnumVariants.map((v) => ({
            id: v.id,
            value: v.label,
            color: v.color,
        }))

        // Create new enum set with variants
        try {
            enumSetManager.set(
                newEnumSetId,
                newEnumSetName,
                variants,
                newEnumSetDescription || undefined
            )

            // Select the newly created enum set
            setSelectedEnumSetId(newEnumSetId)
            // Only store the enum ID
            onUpdate({...field, enumId: newEnumSetId})

            // Show success message
            toast(`"${newEnumSetName}" has been created successfully!`, {
                type: 'success',
            })

            // Close dialog and reset form
            setCreateDialogOpen(false)
            setNewEnumSetName('')
            setNewEnumSetId('')
            setNewEnumSetDescription('')
            setEditingEnumVariants([])
        } catch (error) {
            toast(String(error), {type: 'error'})
        }
    }

    const handleCancelCreate = () => {
        setCreateDialogOpen(false)
        setNewEnumSetName('')
        setNewEnumSetId('')
        setNewEnumSetDescription('')
        setEditingEnumVariants([])
    }

    const handleOpenEditDialog = () => {
        const enumSet = enumSetManager.get(selectedEnumSetId)
        if (enumSet) {
            setNewEnumSetName(enumSet.name)
            setNewEnumSetId(enumSet.id)
            setNewEnumSetDescription(enumSet.description || '')
            // Convert EnumVariant to EnumValue
            const enumValues: EnumValue[] = enumSet.variants.map((v) => ({
                id: v.id,
                label: v.value,
                description: '',
                color: v.color,
            }))
            setEditingEnumVariants(enumValues)
            setEditDialogOpen(true)
        }
    }

    const handleSaveEditEnumSet = () => {
        if (!newEnumSetName.trim()) {
            return
        }

        // Convert EnumValue to EnumVariant
        const variants = editingEnumVariants.map((v) => ({
            id: v.id,
            value: v.label,
            color: v.color,
        }))

        try {
            enumSetManager.set(
                newEnumSetId,
                newEnumSetName,
                variants,
                newEnumSetDescription || undefined
            )

            toast(`"${newEnumSetName}" has been updated successfully!`, {
                type: 'success',
            })

            // Close dialog and reset form
            setEditDialogOpen(false)
            setNewEnumSetName('')
            setNewEnumSetId('')
            setNewEnumSetDescription('')
            setEditingEnumVariants([])
        } catch (error) {
            toast(String(error), {type: 'error'})
        }
    }

    const handleCancelEdit = () => {
        setEditDialogOpen(false)
        setNewEnumSetName('')
        setNewEnumSetId('')
        setNewEnumSetDescription('')
        setEditingEnumVariants([])
    }

    // Handlers for editing variants in dialogs
    const handleAddEditingVariant = () => {
        const newValue: EnumValue = {
            id: 'a' + Date.now().toString(),
            label: '',
            description: '',
            color: COLORS[editingEnumVariants.length % COLORS.length],
        }
        setEditingEnumVariants([...editingEnumVariants, newValue])
    }

    const handleUpdateEditingVariant = (
        id: string,
        updated: Partial<EnumValue>
    ) => {
        setEditingEnumVariants(
            editingEnumVariants.map((v) =>
                v.id === id ? {...v, ...updated} : v
            )
        )
    }

    const handleDeleteEditingVariant = (id: string) => {
        setEditingEnumVariants(editingEnumVariants.filter((v) => v.id !== id))
    }

    // Sync selectedEnumSetId with field.enumId
    useEffect(() => {
        if (field.enumId) {
            setSelectedEnumSetId(field.enumId)
        }
    }, [field.enumId])

    // Auto-select first enum set on mount if field has no enum values
    useEffect(() => {
        if (
            showEnumSection &&
            !field.enumId &&
            availableEnumSets.length > 0 &&
            !selectedEnumSetId // Only auto-select if nothing is selected
        ) {
            const firstEnumSet = availableEnumSets[0]
            setSelectedEnumSetId(firstEnumSet.id)
            handleSelectEnumSet(firstEnumSet.id)
        }
    }, [])

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
            <Box sx={{flex: 1, p: 3, overflowY: 'auto'}}>
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
                                            onChange={(e) => {
                                                const newType = e.target
                                                    .value as FieldTypeEnum
                                                // Clear format when switching between datetime and number
                                                const shouldClearFormat =
                                                    (field.type ===
                                                        'datetime' &&
                                                        newType === 'number') ||
                                                    (field.type === 'number' &&
                                                        newType === 'datetime')

                                                // Set default format for datetime
                                                let format = field.format
                                                if (shouldClearFormat) {
                                                    format = ''
                                                } else if (
                                                    newType === 'datetime' &&
                                                    !field.format
                                                ) {
                                                    format = 'yyyy-mm-dd'
                                                }

                                                onUpdate({
                                                    ...field,
                                                    type: newType,
                                                    enumId:
                                                        newType === 'enum' ||
                                                        newType ===
                                                            'multiSelect'
                                                            ? field.enumId
                                                            : undefined,
                                                    format,
                                                })
                                            }}
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
                                            <MenuItem value="image">
                                                Image
                                            </MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>

                                {/* Enum Set Selector */}
                                {showEnumSection && (
                                    <Box sx={{display: 'flex', gap: 1}}>
                                        <FormControl
                                            fullWidth
                                            size="small"
                                            sx={{flex: 1}}
                                        >
                                            <InputLabel>
                                                Load from Enum Set
                                            </InputLabel>
                                            <Select
                                                value={selectedEnumSetId}
                                                label="Load from Enum Set"
                                                onChange={(e) =>
                                                    handleSelectEnumSet(
                                                        e.target.value
                                                    )
                                                }
                                            >
                                                <MenuItem value="CREATE_NEW">
                                                    <em>
                                                        + Create New Enum Set
                                                    </em>
                                                </MenuItem>
                                                {availableEnumSets.map(
                                                    (enumSet) => (
                                                        <MenuItem
                                                            key={enumSet.id}
                                                            value={enumSet.id}
                                                        >
                                                            {enumSet.name}
                                                            {enumSet.description && (
                                                                <Typography
                                                                    component="span"
                                                                    variant="caption"
                                                                    color="text.secondary"
                                                                    sx={{ml: 1}}
                                                                >
                                                                    -{' '}
                                                                    {
                                                                        enumSet.description
                                                                    }
                                                                </Typography>
                                                            )}
                                                        </MenuItem>
                                                    )
                                                )}
                                            </Select>
                                        </FormControl>
                                        <IconButton
                                            size="small"
                                            onClick={handleOpenEditDialog}
                                            disabled={!selectedEnumSetId}
                                            color="primary"
                                            sx={{
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                            }}
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                )}

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
                                    rows={1}
                                    size="small"
                                    placeholder="Optional field description"
                                />
                                <Box>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                size="small"
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
                                        label={
                                            <Typography variant="body2">
                                                Required field
                                            </Typography>
                                        }
                                    />
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* Enum Values Section - Read Only */}
                    {showEnumSection &&
                        field.enumId &&
                        (() => {
                            const enumSet = enumSetManager.get(field.enumId)
                            return enumSet && enumSet.variants.length > 0
                        })() && (
                            <Card variant="outlined">
                                <CardContent>
                                    <Typography
                                        variant="subtitle1"
                                        fontWeight={600}
                                        mb={2}
                                    >
                                        Enum Values
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 1.5,
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            pr: 1,
                                        }}
                                    >
                                        {(() => {
                                            const enumSet = enumSetManager.get(
                                                field.enumId!
                                            )
                                            return enumSet?.variants.map(
                                                (variant) => (
                                                    <Box
                                                        key={variant.id}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems:
                                                                'center',
                                                            gap: 1,
                                                            px: 1.5,
                                                            py: 1,
                                                            border: '1px solid',
                                                            borderColor:
                                                                'divider',
                                                            borderRadius: 1,
                                                            bgcolor: 'grey.50',
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                width: 12,
                                                                height: 12,
                                                                borderRadius:
                                                                    '50%',
                                                                bgcolor:
                                                                    variant.color,
                                                                border: '2px solid',
                                                                borderColor:
                                                                    'grey.300',
                                                                flexShrink: 0,
                                                            }}
                                                        />
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                fontSize:
                                                                    '0.875rem',
                                                            }}
                                                        >
                                                            {variant.value}
                                                        </Typography>
                                                    </Box>
                                                )
                                            )
                                        })()}
                                    </Box>
                                </CardContent>
                            </Card>
                        )}

                    {/* Default Value Section */}
                    {showEnumSection && field.enumId && (
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
                                        {(() => {
                                            const enumSet = enumSetManager.get(
                                                field.enumId!
                                            )
                                            return enumSet?.variants.map(
                                                (v) => (
                                                    <MenuItem
                                                        key={v.id}
                                                        value={v.id}
                                                    >
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
                                                            {v.value}
                                                        </Box>
                                                    </MenuItem>
                                                )
                                            )
                                        })()}
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
                                    value={field.format || ''}
                                    onChange={(e) => {
                                        onUpdate({
                                            ...field,
                                            format: e.target.value,
                                        })
                                    }}
                                    onBlur={(e) => {
                                        // Set default if empty
                                        if (!e.target.value.trim()) {
                                            onUpdate({
                                                ...field,
                                                format: 'yyyy-mm-dd',
                                            })
                                        }
                                    }}
                                    placeholder="yyyy-mm-dd"
                                    helperText="Use Excel-style date format. Default: yyyy-mm-dd"
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Number Format */}
                    {field.type === 'number' && (
                        <Card variant="outlined">
                            <CardContent>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    mb={2}
                                >
                                    Number Format
                                </Typography>
                                <Stack spacing={2}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Format</InputLabel>
                                        <Select
                                            value={field.format || ''}
                                            label="Format"
                                            onChange={(e) =>
                                                onUpdate({
                                                    ...field,
                                                    format: e.target.value,
                                                })
                                            }
                                        >
                                            <MenuItem value="">
                                                <em>No format</em>
                                            </MenuItem>
                                            <MenuItem value="0">
                                                Integer (0)
                                            </MenuItem>
                                            <MenuItem value="0.0">
                                                1 decimal (0.0)
                                            </MenuItem>
                                            <MenuItem value="0.00">
                                                2 decimals (0.00)
                                            </MenuItem>
                                            <MenuItem value="#,##0">
                                                Thousands (1,000)
                                            </MenuItem>
                                            <MenuItem value="#,##0.00">
                                                Thousands + 2 decimals
                                                (1,000.00)
                                            </MenuItem>
                                            <MenuItem value="0%">
                                                Percentage (0%)
                                            </MenuItem>
                                            <MenuItem value="0.0%">
                                                Percentage + 1 decimal (0.0%)
                                            </MenuItem>
                                            <MenuItem value="0.00%">
                                                Percentage + 2 decimals (0.00%)
                                            </MenuItem>
                                        </Select>
                                    </FormControl>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Custom Format"
                                        value={field.format || ''}
                                        onChange={(e) =>
                                            onUpdate({
                                                ...field,
                                                format: e.target.value,
                                            })
                                        }
                                        placeholder="e.g., #,##0.00"
                                        helperText="Or enter a custom Excel-style format"
                                    />
                                </Stack>
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
                                    placeholder="e.g., #PLACEHOLDER > 0 && #PLACEHOLDER < 100"
                                    helperText="Use #PLACEHOLDER to reference the input value"
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
                        // Find in editingEnumVariants if dialog is open, otherwise from enumSet
                        const currentEnumValue =
                            createDialogOpen || editDialogOpen
                                ? editingEnumVariants.find(
                                      (v) => v.id === colorAnchorEl?.enumId
                                  )
                                : (() => {
                                      const enumSet = field.enumId
                                          ? enumSetManager.get(field.enumId)
                                          : null
                                      return enumSet?.variants.find(
                                          (v) => v.id === colorAnchorEl?.enumId
                                      )
                                  })()
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

            {/* Create Enum Set Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={handleCancelCreate}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Create New Enum Set</DialogTitle>
                <DialogContent>
                    <Stack spacing={2.5} sx={{pt: 1}}>
                        <Box sx={{display: 'flex', gap: 2}}>
                            <TextField
                                label="Name"
                                value={newEnumSetName}
                                onChange={(e) =>
                                    setNewEnumSetName(e.target.value)
                                }
                                placeholder="e.g., Customer Status"
                                autoFocus
                                required
                                sx={{flex: 1}}
                            />
                            <TextField
                                label="ID"
                                value={newEnumSetId}
                                onChange={(e) =>
                                    setNewEnumSetId(
                                        e.target.value
                                            .toLowerCase()
                                            .replace(/\s+/g, '-')
                                    )
                                }
                                placeholder="e.g., customer-status"
                                helperText="Unique identifier (lowercase, hyphen-separated)"
                                required
                                sx={{flex: 1}}
                            />
                        </Box>
                        <TextField
                            fullWidth
                            label="Description"
                            value={newEnumSetDescription}
                            onChange={(e) =>
                                setNewEnumSetDescription(e.target.value)
                            }
                            placeholder="Optional description"
                            multiline
                            rows={2}
                        />

                        {/* Enum Variants */}
                        <Box>
                            <Box
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                mb={1.5}
                            >
                                <Typography
                                    variant="subtitle2"
                                    fontWeight={600}
                                >
                                    Enum Variants
                                </Typography>
                                <Button
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddEditingVariant}
                                    sx={{textTransform: 'none'}}
                                >
                                    Add Variant
                                </Button>
                            </Box>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 1.5,
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    pr: 1,
                                }}
                            >
                                {editingEnumVariants.map((variant) => (
                                    <Box
                                        key={variant.id}
                                        sx={{width: 'calc(50% - 12px)'}}
                                    >
                                        <Box
                                            sx={{
                                                p: 1.5,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                                bgcolor: 'grey.50',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                            }}
                                        >
                                            <Box
                                                onClick={(e) =>
                                                    handleOpenColorPicker(
                                                        e,
                                                        variant.id
                                                    )
                                                }
                                                sx={{
                                                    width: 16,
                                                    height: 16,
                                                    borderRadius: '50%',
                                                    bgcolor: variant.color,
                                                    cursor: 'pointer',
                                                    border: '2px solid',
                                                    borderColor: 'grey.300',
                                                    transition: 'all 0.2s',
                                                    flexShrink: 0,
                                                    '&:hover': {
                                                        transform: 'scale(1.2)',
                                                        boxShadow: 2,
                                                        borderColor:
                                                            'primary.main',
                                                    },
                                                }}
                                            />
                                            <TextField
                                                fullWidth
                                                size="small"
                                                value={variant.label}
                                                onChange={(e) =>
                                                    handleUpdateEditingVariant(
                                                        variant.id,
                                                        {
                                                            label: e.target
                                                                .value,
                                                        }
                                                    )
                                                }
                                                placeholder="Label"
                                                InputProps={{
                                                    sx: {
                                                        fontSize: '0.875rem',
                                                        py: 0.5,
                                                    },
                                                }}
                                            />
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    handleDeleteEditingVariant(
                                                        variant.id
                                                    )
                                                }
                                                color="error"
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{p: 2.5}}>
                    <Button onClick={handleCancelCreate}>Cancel</Button>
                    <Button
                        onClick={handleCreateEnumSet}
                        variant="contained"
                        disabled={
                            !newEnumSetName.trim() || !newEnumSetId.trim()
                        }
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Enum Set Dialog */}
            <Dialog
                open={editDialogOpen}
                onClose={handleCancelEdit}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Edit Enum Set</DialogTitle>
                <DialogContent>
                    <Stack spacing={2.5} sx={{pt: 1}}>
                        <Box sx={{display: 'flex', gap: 2}}>
                            <TextField
                                label="Name"
                                value={newEnumSetName}
                                onChange={(e) =>
                                    setNewEnumSetName(e.target.value)
                                }
                                placeholder="e.g., Customer Status"
                                autoFocus
                                required
                                sx={{flex: 1}}
                            />
                            <TextField
                                label="ID"
                                value={newEnumSetId}
                                placeholder="e.g., customer-status"
                                helperText="ID cannot be changed"
                                required
                                disabled
                                slotProps={{
                                    input: {
                                        readOnly: true,
                                    },
                                }}
                                sx={{flex: 1}}
                            />
                        </Box>
                        <TextField
                            fullWidth
                            label="Description"
                            value={newEnumSetDescription}
                            onChange={(e) =>
                                setNewEnumSetDescription(e.target.value)
                            }
                            placeholder="Optional description"
                            multiline
                            rows={2}
                        />

                        {/* Enum Variants */}
                        <Box>
                            <Box
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                mb={1.5}
                            >
                                <Typography
                                    variant="subtitle2"
                                    fontWeight={600}
                                >
                                    Enum Variants
                                </Typography>
                                <Button
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddEditingVariant}
                                    sx={{textTransform: 'none'}}
                                >
                                    Add Variant
                                </Button>
                            </Box>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 1.5,
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    pr: 1,
                                }}
                            >
                                {editingEnumVariants.map((variant) => (
                                    <Box
                                        key={variant.id}
                                        sx={{width: 'calc(50% - 12px)'}}
                                    >
                                        <Box
                                            sx={{
                                                p: 1.5,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                                bgcolor: 'grey.50',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                            }}
                                        >
                                            <Box
                                                onClick={(e) =>
                                                    handleOpenColorPicker(
                                                        e,
                                                        variant.id
                                                    )
                                                }
                                                sx={{
                                                    width: 16,
                                                    height: 16,
                                                    borderRadius: '50%',
                                                    bgcolor: variant.color,
                                                    cursor: 'pointer',
                                                    border: '2px solid',
                                                    borderColor: 'grey.300',
                                                    transition: 'all 0.2s',
                                                    flexShrink: 0,
                                                    '&:hover': {
                                                        transform: 'scale(1.2)',
                                                        boxShadow: 2,
                                                        borderColor:
                                                            'primary.main',
                                                    },
                                                }}
                                            />
                                            <TextField
                                                fullWidth
                                                size="small"
                                                value={variant.label}
                                                onChange={(e) =>
                                                    handleUpdateEditingVariant(
                                                        variant.id,
                                                        {
                                                            label: e.target
                                                                .value,
                                                        }
                                                    )
                                                }
                                                placeholder="Label"
                                                InputProps={{
                                                    sx: {
                                                        fontSize: '0.875rem',
                                                        py: 0.5,
                                                    },
                                                }}
                                            />
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    handleDeleteEditingVariant(
                                                        variant.id
                                                    )
                                                }
                                                color="error"
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{p: 2.5}}>
                    <Button onClick={handleCancelEdit}>Cancel</Button>
                    <Button
                        onClick={handleSaveEditEnumSet}
                        variant="contained"
                        disabled={!newEnumSetName.trim()}
                    >
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
