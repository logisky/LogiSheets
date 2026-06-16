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
import {blockEditBus} from '@/components/block-interface/edit-bus'
import {globalStore} from '@/store'
import {toast} from 'react-toastify'

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
    const [iframeSrc, setIframeSrc] = useState(
        '/factory-simulator-en/index.html'
    )
    const tools = [
        {
            label: 'Factory Simulator (中文)',
            value: '/factory-simulator-zh/index.html',
        },
        {
            label: 'Factory Simulator (English)',
            value: '/factory-simulator-en/index.html',
        },
        {
            label: 'What-if Calculator',
            value: '/what-if-calculator/index.html',
        },
        {
            label: 'Markdown Table Extractor',
            value: '/markdown-table-extractor/index.html',
        },
        {
            label: 'Watson',
            value: '/watson/index.html',
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
        // Manually pin the viewport. Either axis can be omitted to keep
        // its current value. Useful when a craft wants to jump-to-block
        // but suppress the auto-scroll's horizontal offset (e.g. keep
        // anchorX=0 after a setSelection on a deep-down block whose
        // colStart is already 0).
        win.setAnchor = (anchorX?: number, anchorY?: number) => {
            void engine.render(anchorX, anchorY)
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
        // Subscribe to user-driven edits committed through the
        // block-interface widgets (bool/enum/datetime/fieldRef/
        // multiSelectRef). Returns a disposer the craft can call to stop
        // listening. Crafts may register multiple callbacks.
        win.onBlockCellEdit = (cb: (e: unknown) => void) =>
            blockEditBus.on(cb as Parameters<typeof blockEditBus.on>[0])
        // Craft → host message channel. Crafts call this to surface
        // setup errors, validation hits, or completion notes to the
        // user via the existing toast system. Levels match react-
        // toastify's API; unknown levels fall back to `info`.
        //
        // Contract:
        //   notifyCraft(level: 'error'|'warn'|'info'|'success', msg: string)
        //
        // Returns void, fire-and-forget. The craft shouldn't depend on
        // the host being available; calls are wrapped in try/catch on
        // the craft side (see `notifyHost` in the factory simulator).
        type NotifyLevel = 'error' | 'warn' | 'info' | 'success'
        win.notifyCraft = (level: NotifyLevel, message: string) => {
            const text = String(message ?? '')
            if (!text) return
            switch (level) {
                case 'error':
                    toast.error(text)
                    break
                case 'warn':
                    toast.warn(text)
                    break
                case 'success':
                    toast.success(text)
                    break
                case 'info':
                default:
                    toast.info(text)
            }
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
