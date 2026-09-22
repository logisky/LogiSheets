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
import {observer} from 'mobx-react-lite'
import {useTranslation} from 'react-i18next'
import type {TFunction} from 'i18next'
import {IconButton, Tooltip} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import StopIcon from '@mui/icons-material/Stop'
import SettingsIcon from '@mui/icons-material/SettingsOutlined'
import AddIcon from '@mui/icons-material/AddCommentOutlined'
import ScienceIcon from '@mui/icons-material/ScienceOutlined'
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
    CHART_TOOLS,
    CRAFT_INTERACTION_TOOLS,
    toUiBubbles,
    installCraftSkillTools,
    type ChatBubble,
} from 'logisheets-logician'
import {getCraftState, setCraftState} from 'logisheets-core'
import {injectCraftInteractionAPIs} from '@/components/craft-interaction'
import {craftIdFromSrc} from '@/core/craft-ai'
import {useTempModeControls} from '@/components/temp-mode'
import {getLocale} from '@/core/i18n/i18n'
import {useWorkbook} from '@/core/engine/provider'
import {globalStore} from '@/store'
import {IdbConversationStore} from './lib/storage-idb'
import {makeLlmClient} from './lib/llm-factory'
import {isTauri} from './lib/net'
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
    providerRequiresKey,
    type ProviderDef,
    type ProviderId,
} from './lib/providers'
import styles from './watson.module.scss'

const KEY_MODEL = 'watson.model'
const KEY_PROVIDER = 'watson.provider'

// English on purpose — the model reads this, not the user. The one thing it
// has to learn from the UI's language is which language to answer in.
const systemPrompt = (language: string) =>
    `Reply in the language of the user's interface (${language}), whatever language this instruction is written in.\n\n` +
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
// `code` the LLM clients' LlmError carries; falls back to the message. Takes the
// provider because the useful part of a network failure is provider-specific:
// a local server that isn't running and a remote host a browser won't call are
// both "network", and they need opposite advice.
function friendlyError(
    err: unknown,
    provider: ProviderDef,
    t: TFunction
): string {
    const e = err as {code?: string; message?: string}
    switch (e?.code) {
        case 'missing_api_key':
            return String(t('watson.error.missingKey'))
        case 'unauthorized':
            return String(t('watson.error.unauthorized'))
        case 'rate_limited':
            return String(t('watson.error.rateLimited'))
        case 'network':
            return String(
                t('watson.error.unreachable', {
                    provider: t(provider.label),
                    hint: networkHint(provider, t),
                })
            )
        case 'server_error':
            return String(t('watson.error.serverError'))
        case 'bad_request':
            // The provider's own wording is the useful part here, and it
            // arrives in whatever language the provider speaks.
            return e.message || String(t('watson.error.badRequest'))
        default:
            return e?.message || String(t('watson.error.unknown'))
    }
}

function networkHint(provider: ProviderDef, t: TFunction): string {
    if (provider.requiresKey === false)
        return String(t('watson.error.hintLocal', {url: provider.baseUrl}))
    if (provider.corsBlocked && !isTauri())
        return String(t('watson.error.hintCors'))
    return String(t('watson.error.hintGeneric'))
}

export const Watson = observer(function Watson({
    open,
    onClose,
    workbookId,
}: WatsonProps) {
    const {t, i18n} = useTranslation()
    const workbook = useWorkbook()
    const tempMode = useTempModeControls()

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
        () =>
            localStorage.getItem(KEY_MODEL) || PROVIDERS[provider].defaultModel
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
            ...CHART_TOOLS,
            ...CRAFT_INTERACTION_TOOLS,
        ])
        // `t.value` is the panel's iframe path (`/lights-out/index.html`), not
        // a craft id — the store builds `/<craftId>/manifest.json` from this,
        // so passing the path made every manifest fetch a malformed URL.
        const installedIds = (
            typeof __CRAFT_TOOLS__ !== 'undefined' ? __CRAFT_TOOLS__ : []
        )
            .map((t) => craftIdFromSrc(t.value))
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
    // at build). The provider's `wire` decides which client speaks for it —
    // logician's agent IR is Anthropic-shaped, so an Anthropic-wire provider
    // gets it verbatim and an OpenAI-wire one gets it translated. Everything
    // else about a provider is base URL, auth, and its model list.
    useEffect(() => {
        const llm = makeLlmClient(
            provider,
            baseUrl,
            () => apiKeyRef.current || null
        )
        agentRef.current = new Agent({
            store,
            registry,
            llm,
            workbook,
            model,
            systemPrompt: systemPrompt(
                String(t(`app.languageName.${getLocale()}`))
            ),
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
        // A language switch re-issues the system prompt, so the next turn
        // answers in the new one.
        i18n.language,
        t,
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
                          title: String(t('watson.newChat')),
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
            title: String(t('watson.newChat')),
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
        if (!apiKeyRef.current && providerRequiresKey(provider)) {
            setTurnError(String(t('watson.error.needKey')))
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
                setTurnError(friendlyError(err, PROVIDERS[provider], t))
            }
        } finally {
            setRunning(false)
            abortRef.current = null
        }
    }, [input, running, provider, t])

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

    // Nudge first-time users to set their key when opened without one — but
    // not when the chosen provider is a local server that never wanted one.
    useEffect(() => {
        if (open && !apiKeyRef.current && providerRequiresKey(provider))
            setShowSettings(true)
    }, [open, provider])

    return (
        <div className={styles.panel} aria-hidden={!open}>
            <header className={styles.header}>
                <span className={styles.title}>Watson</span>
                {status !== 'idle' && (
                    <span className={styles.status}>{status}</span>
                )}
                <span className={styles.spacer} />
                <Tooltip title={t('watson.newChat')}>
                    <IconButton size="small" onClick={newChat}>
                        <AddIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title={t('watson.settings')}>
                    <IconButton
                        size="small"
                        onClick={() => setShowSettings(true)}
                    >
                        <SettingsIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title={t('watson.close')}>
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
                    <div className={styles.empty}>{t('watson.empty')}</div>
                ) : (
                    bubbles.map((b) => <Bubble key={b.id} bubble={b} />)
                )}
                {running && (
                    <div className={`${styles.bubble} ${styles.thinking}`}>
                        {t('watson.working')}
                    </div>
                )}
                {turnError && (
                    <div className={`${styles.bubble} ${styles.errorBubble}`}>
                        {turnError}
                    </div>
                )}
            </div>

            {/* Temp mode changes what Watson is allowed to do, so it has to
                say so where you are about to ask — the workbook has one
                scratch branch, and a committed write discards it, so the
                write tools refuse until the session is ended one way or the
                other. Both ways are right here rather than back on the grid. */}
            {globalStore.isTempMode && (
                <div
                    className={styles.tempNotice}
                    data-testid="watson-temp-notice"
                >
                    <ScienceIcon fontSize="small" />
                    <div className={styles.tempNoticeText}>
                        <b>{t('watson.tempModeOn')}</b>{' '}
                        {t('watson.tempModeBody')}
                    </div>
                    <div className={styles.tempNoticeRow}>
                        <button
                            type="button"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => void tempMode.commit()}
                        >
                            {t('watson.commit')}
                        </button>
                        <button
                            type="button"
                            className={styles.btn}
                            onClick={() => void tempMode.discard()}
                        >
                            {t('watson.discard')}
                        </button>
                    </div>
                </div>
            )}

            <div className={styles.composer}>
                <textarea
                    className={styles.input}
                    value={input}
                    placeholder={String(t('watson.composerPlaceholder'))}
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
                    <Tooltip title={t('watson.stop')}>
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
})

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
        return <div className={`${styles.bubble} ${styles.note}`}>{b.text}</div>
    // tool
    const statusLabel =
        b.user_confirm && !b.user_confirm.approved
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
    const {t} = useTranslation()
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
                <h3>{t('watson.settings')}</h3>

                <label>{t('watson.provider')}</label>
                <select
                    value={p}
                    onChange={(e) =>
                        onProviderChange(e.target.value as ProviderId)
                    }
                >
                    {Object.values(PROVIDERS).map((prov) => (
                        <option key={prov.id} value={prov.id}>
                            {t(prov.label)}
                        </option>
                    ))}
                </select>

                <label>
                    {t('watson.keyStoredHint', {label: t(def.keyLabel)})}
                </label>
                <input
                    type="password"
                    value={k}
                    onChange={(e) => setK(e.target.value)}
                    placeholder={def.keyPlaceholder}
                />
                {def.note && (
                    <p className={styles.settingsNote}>{t(def.note)}</p>
                )}
                {/* Providers known to send no CORS headers can't be reached
                    from a web browser directly — but the desktop app calls
                    them natively, so only warn on the web. */}
                {def.corsBlocked && !isTauri() && (
                    <p className={styles.settingsWarn}>
                        {t('watson.corsWarning')}
                    </p>
                )}

                <label>{t('watson.model')}</label>
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

                <label>{t('watson.baseUrl')}</label>
                <input
                    value={b}
                    onChange={(e) => setB(e.target.value)}
                    placeholder={def.baseUrl}
                />

                <div className={styles.modalRow}>
                    <button className={styles.btn} onClick={onClose}>
                        {t('watson.cancel')}
                    </button>
                    <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() =>
                            onSave({
                                provider: p,
                                apiKey: k,
                                baseUrl: b,
                                model: m,
                            })
                        }
                    >
                        {t('watson.save')}
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
    const {t} = useTranslation()
    // Esc denies, matching the overlay-click-to-cancel convention.
    useEscapeKey(() => onDecide(false))
    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <h3>{t('watson.approveTitle')}</h3>
                <p className={styles.confirmName}>{prettyTool(pending.name)}</p>
                <pre>{JSON.stringify(pending.input, null, 2)}</pre>
                <div className={styles.modalRow}>
                    <button
                        className={styles.btn}
                        onClick={() => onDecide(false)}
                    >
                        {t('watson.deny')}
                    </button>
                    <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() => onDecide(true)}
                    >
                        {t('watson.approve')}
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
