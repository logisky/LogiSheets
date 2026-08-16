import {
    Box,
    IconButton,
    FormControl,
    Select,
    MenuItem,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
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
        initialCraftSrc ?? __DEFAULT_CRAFT__
    )
    // The craft list is injected at build time from crafts.config.json (webpack
    // DefinePlugin → resolveCraftTools), selected by the CRAFT_DIST
    // distribution. Add crafts / distributions there, not here.
    const tools = __CRAFT_TOOLS__
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
        // The ids of all crafts shipped in this distribution — so a craft (e.g.
        // Watson) can discover its siblings' skills by fetching /<id>/manifest.json.
        win.installedCrafts = tools.map((t) => t.value)
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
        // Show/hide cell VALUES (text) across every view. Worker-global, like
        // zoom/gridlines — fills, borders and gridlines keep rendering; only the
        // cell text is toggled. A craft that writes labels into cells (e.g.
        // fuse-beads writing the bead code) uses this to switch them on/off.
        win.setShowCellValues = (show: boolean) =>
            engine.setShowCellValues(!!show)
        win.getShowCellValues = (): boolean => engine.getShowCellValues()
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

    // Fills its slot in the left dock (the dock owns positioning + the edge
    // border). Compact header: craft selector + close, then the iframe.
    return (
        <Box
            sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#f2f4f7',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                }}
            >
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
                <IconButton
                    size="small"
                    color="default"
                    aria-label="Close craft panel"
                    onClick={onClose}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>
            <Box
                sx={{
                    flex: 1,
                    borderTop: '1px solid #e0e0e0',
                    minHeight: 0,
                }}
            >
                <iframe
                    ref={iframeRef}
                    src={iframeSrc}
                    onLoad={() => {
                        // A fresh page: the old craft's listener closures belong
                        // to a now-dead realm — drop them before the new page
                        // re-subscribes.
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
