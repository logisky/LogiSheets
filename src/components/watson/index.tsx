/**
 * Watson — the builtin AI assistant panel.
 *
 * This is the promotion of the former `watson` craft (an iframe) to a
 * first-class LogiSheets feature. It reuses the platform-agnostic `logician`
 * agent engine and the browser adapters (Anthropic client, IndexedDB store,
 * web craft store) directly, and talks to the SAME engine workbook `Client`
 * the app uses — no iframe, no host-injection Proxy.
 *
 * Craft skills still work: Watson browses installed crafts' manifests via the
 * WebCraftStore + the skills__discover / skills__use meta-tools.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {IconButton, Tooltip} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import SettingsIcon from '@mui/icons-material/SettingsOutlined'
import AddIcon from '@mui/icons-material/AddCommentOutlined'
import {
    Agent,
    ToolRegistry,
    BUILDER_TOOLS,
    INSPECT_TOOLS,
    EDIT_TOOLS,
    CELL_TOOLS,
    FORMAT_TOOLS,
    STRUCTURE_TOOLS,
    HISTORY_TOOLS,
    COMMENT_TOOLS,
    BLOCK_OPS_TOOLS,
    LINK_TOOLS,
    CRAFT_INTERACTION_TOOLS,
    toUiBubbles,
    installCraftSkillTools,
    type ChatBubble,
} from 'logician'
import {getCraftState, setCraftState} from 'logisheets-core'
import {injectCraftInteractionAPIs} from '@/components/craft-interaction'
import {useWorkbook} from '@/core/engine/provider'
import {IdbConversationStore} from './lib/storage-idb'
import {AnthropicBrowserClient} from './lib/llm-anthropic'
import {WebCraftStore} from './lib/craft-store-web'
import {makeCraftInteractionsApi} from './lib/craft-interactions-adapter'
import styles from './watson.module.scss'

const KEY_API = 'watson.apiKey'
const KEY_MODEL = 'watson.model'
const DEFAULT_MODEL = 'claude-opus-4-7'

const SYSTEM_PROMPT =
    'You are Watson, an AI assistant inside LogiSheets. ' +
    'You help users read, write, and edit spreadsheets using the available ' +
    'tools. For ordinary cells use cell get_cells / set_cells / clear_cells ' +
    '(zero-based row/col); format with format_cells / merge_cells; change shape ' +
    'with sheet insert_rows / delete_rows / insert_cols / delete_cols / ' +
    'delete_sheet / rename_sheet; and reverse mistakes with history undo / redo. ' +
    'For block-shaped apps use the build/edit tools. Prefer formulas ' +
    '(eval_formula) over reading large data. Confirm before destructive edits. ' +
    'Keep responses short and direct.\n\n' +
    'Some capabilities come from installed crafts (plugins). When a task might ' +
    'be served by one, call skills__discover to see what crafts are available ' +
    'and what each is for, then skills__use with the chosen craftId to load its ' +
    'tools before calling them.'

interface WatsonProps {
    open: boolean
    onClose: () => void
    /** Scopes conversations to the open workbook; undefined = unscoped. */
    workbookId?: string
}

interface PendingConfirm {
    name: string
    input: unknown
    policy: 'once' | 'always' | 'destructive'
    resolve: (d: {approved: boolean; reason?: string}) => void
}

export const Watson = ({open, onClose, workbookId}: WatsonProps) => {
    const workbook = useWorkbook()

    const [bubbles, setBubbles] = useState<ChatBubble[]>([])
    const [input, setInput] = useState('')
    const [running, setRunning] = useState(false)
    const [status, setStatus] = useState('idle')
    const [apiKey, setApiKey] = useState(
        () => localStorage.getItem(KEY_API) || ''
    )
    const [model, setModel] = useState(
        () => localStorage.getItem(KEY_MODEL) || DEFAULT_MODEL
    )
    const [showSettings, setShowSettings] = useState(false)
    const [confirmState, setConfirmState] = useState<PendingConfirm | null>(
        null
    )

    // Fresh-read refs so callbacks never capture stale values.
    const apiKeyRef = useRef(apiKey)
    apiKeyRef.current = apiKey

    // Long-lived singletons (store, registry, conversation, agent).
    const store = useMemo(() => new IdbConversationStore(), [])
    const registry = useMemo(() => {
        const r = new ToolRegistry()
        r.registerMany([
            ...BUILDER_TOOLS,
            ...INSPECT_TOOLS,
            ...EDIT_TOOLS,
            ...CELL_TOOLS,
            ...FORMAT_TOOLS,
            ...STRUCTURE_TOOLS,
            ...HISTORY_TOOLS,
            ...COMMENT_TOOLS,
            ...BLOCK_OPS_TOOLS,
            ...LINK_TOOLS,
            ...CRAFT_INTERACTION_TOOLS,
        ])
        const installedIds = (
            typeof __CRAFT_TOOLS__ !== 'undefined' ? __CRAFT_TOOLS__ : []
        )
            .map((t) => t.value)
            .filter((id) => id !== 'watson')
        // Give craft-skill tools scoped read/write to their own craftState, so
        // they can operate a craft's stateful feature (e.g. a game board) and
        // stay consistent with the craft's own persistence.
        installCraftSkillTools(new WebCraftStore({installedIds}), r, {
            craftState: (craftId) => ({
                get: () => getCraftState(craftId),
                set: (json) => setCraftState(craftId, json),
            }),
        })
        return r
    }, [])
    // Overlay-widget capability (radio / slider / allocator, operated by the
    // user). Inject the host register* fns onto window, then adapt them to
    // logician's CraftInteractionsApi. Same in-process registry the craft panel
    // uses, so widgets render on the canvas overlay layer.
    const craftInteractions = useMemo(() => {
        injectCraftInteractionAPIs(window)
        return makeCraftInteractionsApi(window)
    }, [])
    const agentRef = useRef<Agent | null>(null)
    const convIdRef = useRef<string | null>(null)
    const abortRef = useRef<AbortController | null>(null)
    const unsubRef = useRef<(() => void) | null>(null)
    const transcriptRef = useRef<HTMLDivElement | null>(null)

    const confirm = useCallback(
        (
            name: string,
            toolInput: unknown,
            policy: 'once' | 'always' | 'destructive'
        ) =>
            new Promise<{approved: boolean; reason?: string}>((resolve) => {
                setConfirmState({name, input: toolInput, policy, resolve})
            }),
        []
    )

    // (Re)build the agent when the model changes (llm/model captured at build).
    useEffect(() => {
        const llm = new AnthropicBrowserClient({
            apiKey: () => apiKeyRef.current || null,
        })
        agentRef.current = new Agent({
            store,
            registry,
            llm,
            workbook,
            model,
            systemPrompt: SYSTEM_PROMPT,
            confirm,
            craftInteractions,
            log: (msg) => console.log('[watson]', msg),
        })
    }, [store, registry, workbook, model, confirm, craftInteractions])

    // Boot: load or create a conversation for this workbook, subscribe to it.
    useEffect(() => {
        let disposed = false
        ;(async () => {
            const list = await store.listConversations({
                workbook_id: workbookId,
                limit: 1,
            })
            const conv =
                list.length > 0
                    ? list[0]
                    : await store.createConversation({
                          title: 'New chat',
                          workbook_id: workbookId,
                          model,
                      })
            if (disposed) return
            convIdRef.current = conv.id
            unsubRef.current = store.subscribeEvents(conv.id, (events) =>
                setBubbles(toUiBubbles(events))
            )
        })()
        return () => {
            disposed = true
            unsubRef.current?.()
            unsubRef.current = null
        }
        // Re-scope if the workbook changes.
    }, [store, workbookId]) // eslint-disable-line react-hooks/exhaustive-deps

    // Keep the transcript pinned to the bottom on new content.
    useEffect(() => {
        const el = transcriptRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [bubbles, open])

    const newChat = useCallback(async () => {
        unsubRef.current?.()
        const conv = await store.createConversation({
            title: 'New chat',
            workbook_id: workbookId,
            model,
        })
        convIdRef.current = conv.id
        setBubbles([])
        unsubRef.current = store.subscribeEvents(conv.id, (events) =>
            setBubbles(toUiBubbles(events))
        )
    }, [store, workbookId, model])

    const send = useCallback(async () => {
        const text = input.trim()
        if (!text || running) return
        if (!apiKeyRef.current) {
            setShowSettings(true)
            return
        }
        const agent = agentRef.current
        const convId = convIdRef.current
        if (!agent || !convId) return
        setInput('')
        setRunning(true)
        setStatus('thinking…')
        const ctrl = new AbortController()
        abortRef.current = ctrl
        try {
            await agent.runTurn(convId, text, ctrl.signal)
            setStatus('idle')
        } catch (err) {
            console.error('[watson] runTurn error', err)
            setStatus('error')
        } finally {
            setRunning(false)
            abortRef.current = null
        }
    }, [input, running])

    const saveSettings = useCallback((key: string, mdl: string) => {
        const k = key.trim()
        const m = mdl.trim() || DEFAULT_MODEL
        if (k) localStorage.setItem(KEY_API, k)
        else localStorage.removeItem(KEY_API)
        localStorage.setItem(KEY_MODEL, m)
        setApiKey(k)
        setModel(m)
        setShowSettings(false)
    }, [])

    // Nudge first-time users to set their key when opened without one.
    useEffect(() => {
        if (open && !apiKeyRef.current) setShowSettings(true)
    }, [open])

    return (
        <div className={styles.panel} aria-hidden={!open}>
            <header className={styles.header}>
                <span className={styles.title}>Watson</span>
                <span className={styles.status}>{status}</span>
                <span className={styles.spacer} />
                <Tooltip title="New chat">
                    <IconButton size="small" onClick={newChat}>
                        <AddIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Settings">
                    <IconButton
                        size="small"
                        onClick={() => setShowSettings(true)}
                    >
                        <SettingsIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Close">
                    <IconButton size="small" onClick={onClose}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </header>

            <div className={styles.transcript} ref={transcriptRef}>
                {bubbles.length === 0 ? (
                    <div className={styles.empty}>
                        Ask Watson to build, inspect, or edit your sheet.
                    </div>
                ) : (
                    bubbles.map((b) => <Bubble key={b.id} bubble={b} />)
                )}
            </div>

            <div className={styles.composer}>
                <textarea
                    className={styles.input}
                    value={input}
                    placeholder="Message Watson…"
                    rows={1}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            void send()
                        }
                    }}
                />
                <IconButton
                    className={styles.sendBtn}
                    disabled={running || !input.trim()}
                    onClick={() => void send()}
                    color="primary"
                >
                    <SendIcon fontSize="small" />
                </IconButton>
            </div>

            {showSettings && (
                <SettingsModal
                    apiKey={apiKey}
                    model={model}
                    onSave={saveSettings}
                    onClose={() => setShowSettings(false)}
                />
            )}

            {confirmState && (
                <ConfirmModal
                    pending={confirmState}
                    onDecide={(approved) => {
                        confirmState.resolve({approved})
                        setConfirmState(null)
                    }}
                />
            )}
        </div>
    )
}

const Bubble = ({bubble: b}: {bubble: ChatBubble}) => {
    if (b.kind === 'user')
        return <div className={`${styles.bubble} ${styles.user}`}>{b.text}</div>
    if (b.kind === 'assistant_text')
        return (
            <div className={`${styles.bubble} ${styles.assistant}`}>
                {b.text}
            </div>
        )
    if (b.kind === 'note')
        return (
            <div className={`${styles.bubble} ${styles.note}`}>{b.text}</div>
        )
    // tool
    const statusLabel = b.user_confirm && !b.user_confirm.approved
        ? 'declined'
        : b.pending
          ? '…running'
          : b.error
            ? 'error'
            : `${b.duration_ms ?? 0}ms`
    const body = {
        input: b.input,
        ...(b.output !== undefined ? {output: b.output} : {}),
        ...(b.error ? {error: b.error} : {}),
    }
    return (
        <details className={styles.tool}>
            <summary>
                <span className={styles.toolName}>{b.name}</span>
                <span className={styles.toolStatus}>{statusLabel}</span>
            </summary>
            <pre>{JSON.stringify(body, null, 2)}</pre>
        </details>
    )
}

const SettingsModal = ({
    apiKey,
    model,
    onSave,
    onClose,
}: {
    apiKey: string
    model: string
    onSave: (key: string, model: string) => void
    onClose: () => void
}) => {
    const [k, setK] = useState(apiKey)
    const [m, setM] = useState(model)
    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3>Settings</h3>
                <label>Anthropic API key (stored on this device)</label>
                <input
                    type="password"
                    value={k}
                    onChange={(e) => setK(e.target.value)}
                    placeholder="sk-ant-…"
                />
                <label>Model</label>
                <input
                    value={m}
                    onChange={(e) => setM(e.target.value)}
                    placeholder={DEFAULT_MODEL}
                />
                <div className={styles.modalRow}>
                    <button className={styles.btn} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() => onSave(k, m)}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    )
}

const ConfirmModal = ({
    pending,
    onDecide,
}: {
    pending: PendingConfirm
    onDecide: (approved: boolean) => void
}) => (
    <div className={styles.modalOverlay}>
        <div className={styles.modal}>
            <h3>Approve tool call?</h3>
            <p className={styles.confirmName}>{pending.name}</p>
            <pre>{JSON.stringify(pending.input, null, 2)}</pre>
            <div className={styles.modalRow}>
                <button className={styles.btn} onClick={() => onDecide(false)}>
                    Deny
                </button>
                <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => onDecide(true)}
                >
                    Approve
                </button>
            </div>
        </div>
    </div>
)
