import {useState, useEffect} from 'react'
import {
    Box,
    Button,
    Chip,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
} from '@mui/material'
import {
    Add as AddIcon,
    DragIndicator as DragIndicatorIcon,
} from '@mui/icons-material'
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from 'react-beautiful-dnd'
import {FieldSetting} from './types'

interface FieldListProps {
    fields: FieldSetting[]
    selectedFieldId: string | null
    onFieldSelect: (id: string) => void
    onFieldsReorder: (fields: FieldSetting[]) => void
    onAddField: () => void
    embedded?: boolean
}

export const FieldList = ({
    fields,
    selectedFieldId,
    onFieldSelect,
    onFieldsReorder,
    onAddField,
    embedded = false,
}: FieldListProps) => {
    const [isDragEnabled, setIsDragEnabled] = useState(false)

    // Enable drag after component mounts to avoid timing issues with react-beautiful-dnd
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsDragEnabled(true)
        }, 100)
        return () => clearTimeout(timer)
    }, [])

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) {
            return
        }

        const items = Array.from(fields)
        const [reorderedItem] = items.splice(result.source.index, 1)
        items.splice(result.destination.index, 0, reorderedItem)

        onFieldsReorder(items)
    }

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Box
                sx={
                    embedded
                        ? {
                              flex: 1,
                              minHeight: 0,
                              display: 'flex',
                              flexDirection: 'column',
                          }
                        : {
                              width: 280,
                              borderRight: '1px solid',
                              borderColor: 'divider',
                              display: 'flex',
                              flexDirection: 'column',
                              bgcolor: 'grey.50',
                          }
                }
            >
                {/* Header with Add Button */}
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
                        onClick={onAddField}
                        sx={{textTransform: 'none'}}
                    >
                        Add New Field
                    </Button>
                </Box>

                {/* Field List */}
                {isDragEnabled ? (
                    <Droppable
                        droppableId="fields-list"
                        isDropDisabled={false}
                        isCombineEnabled={false}
                        ignoreContainerClipping={true}
                    >
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
                                                    bgcolor: snapshot.isDragging
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
                                                        onFieldSelect(field.id)
                                                    }
                                                    sx={{
                                                        py: 1.5,
                                                        borderLeft:
                                                            '3px solid transparent',
                                                        '&.Mui-selected': {
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
                                                            display: 'flex',
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
                                                            <Box
                                                                sx={{
                                                                    display:
                                                                        'flex',
                                                                    alignItems:
                                                                        'center',
                                                                    gap: 1,
                                                                }}
                                                            >
                                                                <Box
                                                                    component="span"
                                                                    sx={{
                                                                        overflow:
                                                                            'hidden',
                                                                        textOverflow:
                                                                            'ellipsis',
                                                                        whiteSpace:
                                                                            'nowrap',
                                                                        flex: 1,
                                                                    }}
                                                                >
                                                                    {field.name}
                                                                </Box>
                                                                {field.primary && (
                                                                    <Chip
                                                                        label="Primary"
                                                                        size="small"
                                                                        color="primary"
                                                                        variant="outlined"
                                                                        sx={{
                                                                            height: 20,
                                                                            '& .MuiChip-label':
                                                                                {
                                                                                    px: 0.75,
                                                                                    fontSize:
                                                                                        '0.7rem',
                                                                                    lineHeight: 1,
                                                                                },
                                                                        }}
                                                                    />
                                                                )}
                                                            </Box>
                                                        }
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
                                    selected={selectedFieldId === field.id}
                                    onClick={() => onFieldSelect(field.id)}
                                    sx={{
                                        py: 1.5,
                                        borderLeft: '3px solid transparent',
                                        '&.Mui-selected': {
                                            borderLeftColor: 'primary.main',
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
                                        primary={
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                }}
                                            >
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        overflow: 'hidden',
                                                        textOverflow:
                                                            'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        flex: 1,
                                                    }}
                                                >
                                                    {field.name}
                                                </Box>
                                                {field.primary && (
                                                    <Chip
                                                        label="Primary"
                                                        size="small"
                                                        color="primary"
                                                        variant="outlined"
                                                        sx={{
                                                            height: 20,
                                                            '& .MuiChip-label':
                                                                {
                                                                    px: 0.75,
                                                                    fontSize:
                                                                        '0.7rem',
                                                                    lineHeight: 1,
                                                                },
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            field.type.charAt(0).toUpperCase() +
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
        </DragDropContext>
    )
}
