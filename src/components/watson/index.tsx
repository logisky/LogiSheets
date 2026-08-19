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
import StopIcon from '@mui/icons-material/Stop'
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
} from 'logisheets-logician'
import {getCraftState, setCraftState} from 'logisheets-core'
import {injectCraftInteractionAPIs} from '@/components/craft-interaction'
import {useWorkbook} from '@/core/engine/provider'
import {IdbConversationStore} from './lib/storage-idb'
import {AnthropicBrowserClient} from './lib/llm-anthropic'
import {getFetch, isTauri} from './lib/net'
import {WebCraftStore} from './lib/craft-store-web'
import {makeCraftInteractionsApi} from './lib/craft-interactions-adapter'
import {Markdown} from './lib/markdown'
import {
    PROVIDERS,
    DEFAULT_PROVIDER,
    isProviderId,
    loadStoredKey,
    loadStoredBaseUrl,
    keyStorageKey,
    baseUrlStorageKey,
    type ProviderId,
} from './lib/providers'
import styles from './watson.module.scss'

const KEY_MODEL = 'watson.model'
const KEY_PROVIDER = 'watson.provider'

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

// Turn a raw tool id (`cell__set_cells`) into something readable in the UI.
const prettyTool = (name: string) =>
    name.replace(/__/g, ' · ').replace(/_/g, ' ')

// Map a caught turn error to a message worth showing the user. Duck-types on the
// `code` the Anthropic client's LlmError carries; falls back to the message.
function friendlyError(err: unknown): string {
    const e = err as {code?: string; message?: string}
    switch (e?.code) {
        case 'missing_api_key':
            return 'No API key set. Open Settings and paste your key.'
        case 'unauthorized':
            return 'The API key was rejected. Check it in Settings.'
        case 'rate_limited':
            return 'Rate limited by the provider — wait a moment and retry.'
        case 'network':
            return 'Network error reaching the model provider. On the web, Kimi needs a CORS proxy; the desktop app calls it natively.'
        case 'server_error':
            return 'The model provider had a server error. Try again.'
        case 'bad_request':
            return e.message || 'The provider rejected the request.'
        default:
            return e?.message || 'Something went wrong. See the console for details.'
    }
}

export const Watson = ({open, onClose, workbookId}: WatsonProps) => {
    const workbook = useWorkbook()

    const [bubbles, setBubbles] = useState<ChatBubble[]>([])
    const [input, setInput] = useState('')
    const [running, setRunning] = useState(false)
    const [status, setStatus] = useState('idle')
    const [provider, setProvider] = useState<ProviderId>(() => {
        const p = localStorage.getItem(KEY_PROVIDER)
        return isProviderId(p) ? p : DEFAULT_PROVIDER
    })
    const [apiKey, setApiKey] = useState(() => loadStoredKey(provider))
    const [baseUrl, setBaseUrl] = useState(() => loadStoredBaseUrl(provider))
    const [model, setModel] = useState(
        () => localStorage.getItem(KEY_MODEL) || PROVIDERS[provider].defaultModel
    )
    const [showSettings, setShowSettings] = useState(false)
    const [turnError, setTurnError] = useState<string | null>(null)
    const [confirmState, setConfirmState] = useState<PendingConfirm | null>(
        null
    )

    // Fresh-read refs so callbacks never capture stale values.
    const apiKeyRef = useRef(apiKey)
    apiKeyRef.current = apiKey
    // Whether the transcript is pinned to the bottom. Turns false when the user
    // scrolls up to read history, so new content doesn't yank them back down.
    const stickToBottomRef = useRef(true)

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

    // (Re)build the agent when the provider/model changes (llm/model captured
    // at build). All providers speak the Anthropic wire format; they differ
    // only in base URL, auth header, and the browser-access header.
    useEffect(() => {
        const p = PROVIDERS[provider]
        const llm = new AnthropicBrowserClient({
            apiKey: () => apiKeyRef.current || null,
            baseUrl: baseUrl || p.baseUrl,
            authHeader: p.auth,
            directBrowserAccess: p.directBrowserAccess,
            // Desktop routes through native HTTP (no CORS); web uses browser fetch.
            fetchImpl: getFetch(),
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
    }, [
        store,
        registry,
        workbook,
        model,
        provider,
        baseUrl,
        confirm,
        craftInteractions,
    ])

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

    // Keep the transcript pinned to the bottom on new content — but only while
    // the user hasn't scrolled up to read history.
    useEffect(() => {
        const el = transcriptRef.current
        if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight
    }, [bubbles, open, running, turnError])

    const onTranscriptScroll = useCallback(() => {
        const el = transcriptRef.current
        if (!el) return
        stickToBottomRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 60
    }, [])

    const newChat = useCallback(async () => {
        unsubRef.current?.()
        setTurnError(null)
        setStatus('idle')
        stickToBottomRef.current = true
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
            setTurnError('Add an API key in Settings to start.')
            setShowSettings(true)
            return
        }
        const agent = agentRef.current
        const convId = convIdRef.current
        if (!agent || !convId) return
        setInput('')
        setTurnError(null)
        setRunning(true)
        setStatus('thinking…')
        stickToBottomRef.current = true
        const ctrl = new AbortController()
        abortRef.current = ctrl
        try {
            await agent.runTurn(convId, text, ctrl.signal)
            setStatus('idle')
        } catch (err) {
            if (ctrl.signal.aborted) {
                setStatus('stopped')
            } else {
                console.error('[watson] runTurn error', err)
                setStatus('error')
                setTurnError(friendlyError(err))
            }
        } finally {
            setRunning(false)
            abortRef.current = null
        }
    }, [input, running])

    // Cancel the in-flight turn. The runTurn promise rejects/aborts; `send`'s
    // catch treats an aborted signal as a clean stop, not an error.
    const stop = useCallback(() => {
        abortRef.current?.abort()
    }, [])

    const saveSettings = useCallback((next: SettingsDraft) => {
        const p = isProviderId(next.provider) ? next.provider : DEFAULT_PROVIDER
        const k = next.apiKey.trim()
        const b = next.baseUrl.trim()
        const m = next.model.trim() || PROVIDERS[p].defaultModel
        if (k) localStorage.setItem(keyStorageKey(p), k)
        else localStorage.removeItem(keyStorageKey(p))
        // Only persist a base URL when it diverges from the provider default,
        // so shipping a new default later still reaches existing users.
        if (b && b !== PROVIDERS[p].baseUrl)
            localStorage.setItem(baseUrlStorageKey(p), b)
        else localStorage.removeItem(baseUrlStorageKey(p))
        localStorage.setItem(KEY_PROVIDER, p)
        localStorage.setItem(KEY_MODEL, m)
        setProvider(p)
        setApiKey(k)
        setBaseUrl(b || PROVIDERS[p].baseUrl)
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
                {status !== 'idle' && (
                    <span className={styles.status}>{status}</span>
                )}
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

            <div
                className={styles.transcript}
                ref={transcriptRef}
                onScroll={onTranscriptScroll}
            >
                {bubbles.length === 0 && !running && !turnError ? (
                    <div className={styles.empty}>
                        Ask Watson to build, inspect, or edit your sheet.
                    </div>
                ) : (
                    bubbles.map((b) => <Bubble key={b.id} bubble={b} />)
                )}
                {running && (
                    <div className={`${styles.bubble} ${styles.thinking}`}>
                        Watson is working…
                    </div>
                )}
                {turnError && (
                    <div className={`${styles.bubble} ${styles.errorBubble}`}>
                        {turnError}
                    </div>
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
                        // Guard against IME composition: pressing Enter to pick a
                        // candidate (e.g. Chinese input) must not send.
                        if (
                            e.key === 'Enter' &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing
                        ) {
                            e.preventDefault()
                            void send()
                        }
                    }}
                />
                {running ? (
                    <Tooltip title="Stop">
                        <IconButton
                            className={styles.sendBtn}
                            onClick={stop}
                            color="error"
                        >
                            <StopIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                ) : (
                    <IconButton
                        className={styles.sendBtn}
                        disabled={!input.trim()}
                        onClick={() => void send()}
                        color="primary"
                    >
                        <SendIcon fontSize="small" />
                    </IconButton>
                )}
            </div>

            {showSettings && (
                <SettingsModal
                    provider={provider}
                    apiKey={apiKey}
                    baseUrl={baseUrl}
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
                <Markdown text={b.text} />
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
                <span className={styles.toolName}>{prettyTool(b.name)}</span>
                <span className={styles.toolStatus}>{statusLabel}</span>
            </summary>
            <pre>{JSON.stringify(body, null, 2)}</pre>
        </details>
    )
}

interface SettingsDraft {
    provider: ProviderId
    apiKey: string
    baseUrl: string
    model: string
}

const SettingsModal = ({
    provider,
    apiKey,
    baseUrl,
    model,
    onSave,
    onClose,
}: {
    provider: ProviderId
    apiKey: string
    baseUrl: string
    model: string
    onSave: (draft: SettingsDraft) => void
    onClose: () => void
}) => {
    const [p, setP] = useState<ProviderId>(provider)
    const [k, setK] = useState(apiKey)
    const [b, setB] = useState(baseUrl)
    const [m, setM] = useState(model)
    const def = PROVIDERS[p]

    useEscapeKey(onClose)

    // Switching provider loads that provider's stored key / base URL and
    // resets the model to its default — the fields always reflect one provider.
    const onProviderChange = (next: ProviderId) => {
        setP(next)
        setK(loadStoredKey(next))
        setB(loadStoredBaseUrl(next))
        setM(PROVIDERS[next].defaultModel)
    }

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3>Settings</h3>

                <label>Provider</label>
                <select
                    value={p}
                    onChange={(e) =>
                        onProviderChange(e.target.value as ProviderId)
                    }
                >
                    {Object.values(PROVIDERS).map((prov) => (
                        <option key={prov.id} value={prov.id}>
                            {prov.label}
                        </option>
                    ))}
                </select>

                <label>{def.keyLabel} (stored on this device)</label>
                <input
                    type="password"
                    value={k}
                    onChange={(e) => setK(e.target.value)}
                    placeholder={def.keyPlaceholder}
                />
                {def.note && <p className={styles.settingsNote}>{def.note}</p>}
                {/* Providers without browser-CORS support can't be reached from
                    a web browser directly — but the desktop app calls them
                    natively, so only warn on the web. */}
                {!def.directBrowserAccess && !isTauri() && (
                    <p className={styles.settingsWarn}>
                        Browsers block direct calls to this provider (CORS). Set
                        the base URL to a CORS-enabled proxy, or use the desktop
                        app, which calls it natively — no proxy needed.
                    </p>
                )}

                <label>Model</label>
                <input
                    list="watson-models"
                    value={m}
                    onChange={(e) => setM(e.target.value)}
                    placeholder={def.defaultModel}
                />
                <datalist id="watson-models">
                    {def.models.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                            {opt.label}
                        </option>
                    ))}
                </datalist>

                <label>API base URL</label>
                <input
                    value={b}
                    onChange={(e) => setB(e.target.value)}
                    placeholder={def.baseUrl}
                />

                <div className={styles.modalRow}>
                    <button className={styles.btn} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() =>
                            onSave({provider: p, apiKey: k, baseUrl: b, model: m})
                        }
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
}) => {
    // Esc denies, matching the overlay-click-to-cancel convention.
    useEscapeKey(() => onDecide(false))
    return (
    <div className={styles.modalOverlay}>
        <div className={styles.modal}>
            <h3>Approve tool call?</h3>
            <p className={styles.confirmName}>{prettyTool(pending.name)}</p>
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
}

// Call `onKey` when Escape is pressed while mounted. Shared by the modals.
function useEscapeKey(onKey: () => void) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onKey()
        }
        window.addEventListener('keydown', h)
        return () => window.removeEventListener('keydown', h)
    }, [onKey])
}
