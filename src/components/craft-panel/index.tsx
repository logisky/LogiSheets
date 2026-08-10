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
import {
    callerRegistry,
    getCraftState,
    setCraftState,
    makeCraftStorage,
    registerCraftInputHandler,
    setActiveCraft,
    type CraftInputHandler,
} from 'logisheets-core'
import {SETTINGS} from '@/core/settings'
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
    // Lets the active craft suppress the cell selection entirely (see
    // `win.setSelectionSuppressed`). Reset whenever the active craft changes.
    setSelectionSuppressed: (suppressed: boolean) => void
    onClose: () => void
    // Deep-link entry: craft to show initially (see core/craft-deeplink.ts).
    initialCraftSrc?: string
}

export const CraftPanel = ({
    open,
    onClose,
    selectedData,
    setSelectedData,
    setActiveSheet,
    setCellLayouts,
    setSelectionSuppressed,
    initialCraftSrc,
}: CraftPanelProps) => {
    const [iframeSrc, setIframeSrc] = useState(
        initialCraftSrc ?? '/factory-simulator-en/index.html'
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
        {
            label: '电子拼豆 (Fuse Beads)',
            value: '/fuse-beads/index.html',
        },
        {
            label: '记忆挑战 (Memory Grid)',
            value: '/memory-grid/index.html',
        },
        {
            label: '关灯 (Lights Out)',
            value: '/lights-out/index.html',
        },
        {
            label: '数独 (Sudoku)',
            value: '/sudoku/index.html',
        },
        {
            label: '扫雷 (Minesweeper)',
            value: '/minesweeper/index.html',
        },
    ] as const
    const iframeRef = useRef<HTMLIFrameElement | null>(null)
    // Crafts that need to react to the sheet selection subscribe here instead
    // of polling `window.selection`. The set persists across `inject()` re-runs
    // (which happen on every selection change); it's cleared only when the
    // iframe navigates to a fresh page, since a reloaded craft's callbacks
    // belong to a now-dead realm.
    const selectionListeners = useRef(new Set<(s: Selection) => void>())
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
        // Craft state persistence. A craft pushes its own opaque JSON state
        // here; the host folds it into the saved workbook's AppData and hands
        // it back on the next load. The host never parses the string — the
        // craft owns its schema. Keyed by craftId (this iframe's src), which
        // is stable across sessions, so state round-trips to the right craft.
        win.setCraftState = (json: string) => setCraftState(craftId, json)
        win.getCraftState = (): string | undefined => getCraftState(craftId)
        // Device-scoped, per-craft key/value storage (localStorage on the web,
        // the app-data dir on desktop). Unlike craft state above, this does NOT
        // ride the workbook — it persists across documents on this machine.
        // Bound to craftId so a craft only ever sees its own namespace.
        win.craftStorage = makeCraftStorage(craftId)
        // Canvas input capability: the craft registers a handler that runs —
        // synchronously — before the engine handles a mouse/keyboard event on
        // any spreadsheet canvas, and decides whether the engine should still
        // handle it. Only fires while this craft is active (panel open + this
        // craft selected); see the setActiveCraft effect below.
        win.onCanvasInput = (handler: CraftInputHandler) =>
            registerCraftInputHandler(craftId, handler)
        // Global canvas zoom (1 = 100%, clamped to [0.5, 3]). Applies to every
        // view — the engine shares one worker/workbook — which is why it's a
        // global control. A craft typically pairs this with onCanvasInput:
        // consume Ctrl+wheel and call setCanvasZoom to drive zoom itself.
        win.setCanvasZoom = (factor: number) => engine.setZoom(factor)
        win.getCanvasZoom = (): number => engine.getZoom()
        // Let a craft that doesn't use the cell selection (e.g. a painting
        // craft like fuse-beads) hide it while active. While suppressed the
        // host forces the selection to the empty "none" state, so no highlight
        // box shows and the craft's own setSelection jumps sheets without
        // selecting a cell. Reset when the active craft changes (below).
        win.setSelectionSuppressed = (suppressed: boolean) =>
            setSelectionSuppressed(!!suppressed)
        // Subscribe to sheet-selection changes. The craft passes a callback;
        // the host invokes it with the current Selection whenever the selection
        // moves (see the effect below) and returns a disposer. Registration
        // survives inject() re-runs because the listener set lives in a ref.
        win.onSelectionChange = (cb: (s: Selection) => void): (() => void) => {
            selectionListeners.current.add(cb)
            return () => {
                selectionListeners.current.delete(cb)
            }
        }
        injectCraftInteractionAPIs(win)
    }

    // Mark this craft active for canvas-input routing only while the panel is
    // open AND this craft is the selected one. When closed or switched away,
    // the active craft is cleared so canvas events flow straight to the engine.
    useEffect(() => {
        setActiveCraft(open ? iframeSrc : null)
        // Selection suppression belongs to whichever craft is active now; clear
        // it on every craft switch / panel close so it never leaks to the next
        // craft (or to normal spreadsheet use). A craft that wants it re-opts in
        // via win.setSelectionSuppressed after it loads.
        setSelectionSuppressed(false)
        return () => setActiveCraft(null)
    }, [open, iframeSrc, setSelectionSuppressed])

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

    // Push selection changes to subscribed crafts. Declared after the inject()
    // effect so it runs second — window.selection is already refreshed by the
    // time listeners fire — and it also hands each callback the fresh Selection.
    useEffect(() => {
        const selection: Selection = {
            sheetIdx: DATA_SERVICE.getCurrentSheetIdx(),
            data: selectedData,
        } as Selection
        selectionListeners.current.forEach((l) => {
            try {
                l(selection)
            } catch {
                /* a craft listener throwing must not break the others */
            }
        })
    }, [selectedData, DATA_SERVICE])

    return (
        <Box>
            <Drawer
                variant="persistent"
                anchor="right"
                open={open}
                sx={{
                    // Drawer paper is position: fixed, so the docked root
                    // doesn't need to reserve space in the flex flow. Offset it
                    // below the toolbar so the panel starts at the toolbar's
                    // bottom edge instead of covering it (keeps the top-right
                    // GitHub badge and other toolbar controls clickable).
                    '& .MuiDrawer-paper': {
                        width: '360px',
                        top: SETTINGS.topBar,
                        height: `calc(100% - ${SETTINGS.topBar})`,
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
                    <IconButton
                        size="small"
                        color="default"
                        aria-label="Close craft panel"
                        onClick={onClose}
                    >
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
                            onLoad={() => {
                                // A fresh page: the old craft's listener
                                // closures belong to a now-dead realm — drop
                                // them before the new page re-subscribes.
                                selectionListeners.current.clear()
                                inject()
                            }}
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
