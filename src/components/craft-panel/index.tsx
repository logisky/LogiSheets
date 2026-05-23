import {
    Box,
    Drawer,
    IconButton,
    Stack,
    FormControl,
    Select,
    MenuItem,
} from '@mui/material'
import {ChevronRight} from '@mui/icons-material'
import {Selection, SelectedData, CellLayout} from 'logisheets-engine'
import {useEffect, useRef, useState} from 'react'
import {useEngine} from '@/core/engine/provider'
import {buildSelectedDataFromCell} from 'logisheets-engine'
import {callerRegistry} from '@/core/permissions/caller-registry'
import {CALLER_UUID_PARAM_KEY} from '@/core/permissions/patch'
import {injectCraftInteractionAPIs} from '@/components/craft-interaction'
import {globalStore} from '@/store'

type CraftPanelProps = {
    open: boolean
    selectedData?: SelectedData
    setSelectedData: (data: SelectedData) => void
    setActiveSheet: (index: number) => void
    setCellLayouts: (data: CellLayout[]) => void
    onClose: () => void
}

export const CraftPanel = ({
    open,
    onClose,
    selectedData,
    setSelectedData,
    setActiveSheet,
    setCellLayouts,
}: CraftPanelProps) => {
    const [iframeSrc, setIframeSrc] = useState('/what-if-calculator/index.html')
    const tools = [
        {
            label: 'What-if Calculator',
            value: '/what-if-calculator/index.html',
        },
        {
            label: 'Markdown Table Extractor',
            value: '/markdown-table-extractor/index.html',
        },
        {
            label: 'Factory Simulator',
            value: '/factory-simulator/index.html',
        },
    ] as const
    const iframeRef = useRef<HTMLIFrameElement | null>(null)
    const engine = useEngine()
    const DATA_SERVICE = engine.getDataService()
    const BLOCK_MANAGER = engine.getBlockManager()

    const inject = () => {
        const iframe = iframeRef.current
        if (!iframe) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = iframe.contentWindow as any
        if (!win) return

        const craftId = iframeSrc
        const craftUuid = callerRegistry.getCraftUuid(craftId)

        win.selection = {
            sheetIdx: DATA_SERVICE.getCurrentSheetIdx(),
            data: selectedData,
        } as Selection
        win.workbook = wrapWorkbookForCraft(
            DATA_SERVICE.getWorkbook(),
            craftUuid
        )
        win.__craftUuid = craftUuid
        win.blockManager = BLOCK_MANAGER
        win.setCellLayouts = setCellLayouts
        win.setSelection = (sheetIdx: number, row: number, col: number) => {
            setActiveSheet(sheetIdx)
            const data = buildSelectedDataFromCell(row, col, 'none')
            setSelectedData(data)
        }
        // Host UI controls a craft might want to toggle (e.g. switching
        // into temp mode for a series of speculative edits, or pinning
        // block overlays open while the craft sets up tables).
        win.uiSettings = {
            setTempMode: (v: boolean) => globalStore.setTempMode(v),
            getTempMode: () => globalStore.isTempMode,
            setAlwaysShowBlockInfo: (v: boolean) =>
                globalStore.setAlwaysShowBlockInfo(v),
            getAlwaysShowBlockInfo: () => globalStore.alwaysShowBlockInfo,
        }
        injectCraftInteractionAPIs(win)
    }

    useEffect(() => {
        inject()
    }, [
        selectedData,
        DATA_SERVICE,
        BLOCK_MANAGER,
        setCellLayouts,
        setSelectedData,
        setActiveSheet,
        iframeSrc,
    ])

    return (
        <Box>
            <Drawer
                variant="persistent"
                anchor="right"
                open={open}
                sx={{
                    // Drawer paper is position: fixed, so the docked root
                    // doesn't need to reserve space in the flex flow.
                    '& .MuiDrawer-paper': {
                        width: '360px',
                        boxSizing: 'border-box',
                        backgroundColor: '#f2f4f7',
                        display: 'flex',
                        flexDirection: 'column',
                    },
                }}
            >
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="flex-end"
                    sx={{p: 1}}
                >
                    <IconButton size="small" color="default" onClick={onClose}>
                        <ChevronRight />
                    </IconButton>
                </Stack>
                <Box
                    sx={{
                        flex: 1,
                        borderTop: '1px solid #e0e0e0',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                    }}
                >
                    <Stack direction="row" spacing={1} sx={{px: 1, pb: 1}}>
                        <FormControl size="small" fullWidth>
                            <Select
                                value={iframeSrc}
                                onChange={(e) =>
                                    setIframeSrc(e.target.value as string)
                                }
                            >
                                {tools.map((tool) => (
                                    <MenuItem
                                        key={tool.value}
                                        value={tool.value}
                                        sx={{fontSize: '0.85rem'}}
                                    >
                                        {tool.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                    <Box sx={{flex: 1, minHeight: 0}}>
                        <iframe
                            ref={iframeRef}
                            src={iframeSrc}
                            onLoad={inject}
                            style={{
                                border: 'none',
                                width: '100%',
                                height: '100%',
                                display: 'block',
                            }}
                        />
                    </Box>
                </Box>
            </Drawer>
        </Box>
    )
}

const TX_METHODS = new Set([
    'handleTransaction',
    'handleTransactionWithoutEvents',
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapWorkbookForCraft<T extends object>(
    workbook: T,
    craftUuid: string
): T {
    return new Proxy(workbook, {
        get(target, prop, receiver) {
            const original = Reflect.get(target, prop, receiver)
            if (
                typeof original === 'function' &&
                typeof prop === 'string' &&
                TX_METHODS.has(prop)
            ) {
                return (params: Record<string, unknown>) =>
                    (original as (p: unknown) => unknown).call(target, {
                        ...params,
                        [CALLER_UUID_PARAM_KEY]: craftUuid,
                    })
            }
            return typeof original === 'function'
                ? original.bind(target)
                : original
        },
    })
}
