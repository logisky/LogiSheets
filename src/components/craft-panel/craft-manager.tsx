import {useTranslation} from 'react-i18next'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    List,
    ListItem,
    ListItemText,
    Tab,
    Tabs,
    Typography,
} from '@mui/material'
import {useEffect, useRef, useState} from 'react'
import {
    CraftPackageError,
    installCraftPackage,
    listInstalledCrafts,
    previewCraftPackage,
    uninstallCraft,
    type CraftInstallPreview,
    type InstalledCraftRecord,
} from '@/core/craft-packages'
import {
    compareVersions,
    downloadRegistryPackage,
    fetchRegistryIndex,
    pickVersion,
    unavailableReason,
    type RegistryCraft,
    type RegistryIndex,
} from '@/core/craft-packages/remote'
import {getLocale} from '@/core/i18n/i18n'
import {getDataConnectionsBackend} from '@/core/data-connections'
import {DataConnectionsPane} from './data-connections-pane'

export type CraftManagerTab = 'installed' | 'browse' | 'connections'

type Props = {
    open: boolean
    onClose: () => void
    /** The tab shown each time the dialog opens. */
    initialTab?: CraftManagerTab
}

type Preview = CraftInstallPreview & {fromRegistry: boolean}

/**
 * Install / update / uninstall crafts: from the craft registry (Browse) or
 * from a `.craft` file. Changes apply on reload — the craft list is fixed at
 * startup — so every change ends in a "Reload now" offer.
 */
export const CraftManager = ({
    open,
    onClose,
    initialTab = 'installed',
}: Props) => {
    const {t} = useTranslation()
    const fileInput = useRef<HTMLInputElement | null>(null)
    const [tab, setTab] = useState<CraftManagerTab>(initialTab)
    // Only hosts that can run SQL get the Connections tab.
    const hasConnections = getDataConnectionsBackend() !== null
    const [installed, setInstalled] = useState<InstalledCraftRecord[]>([])
    const [index, setIndex] = useState<RegistryIndex | null>(null)
    const [indexError, setIndexError] = useState<string | null>(null)
    const [indexLoading, setIndexLoading] = useState(false)
    const [preview, setPreview] = useState<Preview | null>(null)
    const [error, setError] = useState<string | null>(null)
    // Id of the craft being downloaded, for its row's spinner.
    const [downloading, setDownloading] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    // Something changed since startup; the panel is out of date until reload.
    const [needsReload, setNeedsReload] = useState(false)
    const [dragging, setDragging] = useState(false)

    const refresh = () =>
        listInstalledCrafts()
            .then((rs) =>
                setInstalled(
                    [...rs].sort((a, b) => a.craftId.localeCompare(b.craftId))
                )
            )
            .catch(() => setInstalled([]))

    const loadIndex = () => {
        setIndexLoading(true)
        setIndexError(null)
        fetchRegistryIndex()
            .then(setIndex)
            .catch((e) => setIndexError(errorText(e)))
            .finally(() => setIndexLoading(false))
    }

    useEffect(() => {
        if (!open) return
        setTab(initialTab)
        setError(null)
        void refresh()
        // Both tabs use it: Browse lists it, Installed offers updates from it.
        loadIndex()
    }, [open])

    /** Capability names as the user should read them. */
    const capabilityNames = (caps: readonly string[]) =>
        caps
            .map((c) =>
                String(t(`ui.craft.capability.${c}`, {defaultValue: c}))
            )
            .join(', ')

    function errorText(e: unknown): string {
        if (e instanceof CraftPackageError && e.code === 'unsupported')
            return String(
                t('ui.craft.manage.error.unsupported', {
                    caps: capabilityNames(
                        String(e.params.missing ?? '').split(',')
                    ),
                })
            )
        if (e instanceof CraftPackageError)
            return String(t(`ui.craft.manage.error.${e.code}`, e.params))
        return String(
            t('ui.craft.manage.error.unknown', {
                message: e instanceof Error ? e.message : String(e),
            })
        )
    }

    const labelOf = (c: {label: string; labels?: Record<string, string>}) =>
        c.labels?.[getLocale()] ?? c.labels?.en ?? c.label

    const readFile = async (file: File) => {
        setError(null)
        setBusy(true)
        try {
            const bytes = new Uint8Array(await file.arrayBuffer())
            setPreview({
                ...(await previewCraftPackage(bytes)),
                fromRegistry: false,
            })
        } catch (e) {
            setError(errorText(e))
        } finally {
            setBusy(false)
        }
    }

    const fromRegistry = async (craft: RegistryCraft) => {
        const v = pickVersion(craft)
        if (!v) return
        setError(null)
        setDownloading(craft.craftId)
        try {
            const bytes = await downloadRegistryPackage(v)
            setPreview({
                ...(await previewCraftPackage(bytes)),
                fromRegistry: true,
            })
        } catch (e) {
            setError(errorText(e))
        } finally {
            setDownloading(null)
        }
    }

    const confirmInstall = async () => {
        if (!preview) return
        setError(null)
        setBusy(true)
        try {
            await installCraftPackage(preview.parsed)
            setPreview(null)
            setNeedsReload(true)
            await refresh()
        } catch (e) {
            setPreview(null)
            setError(errorText(e))
        } finally {
            setBusy(false)
        }
    }

    const remove = async (craftId: string) => {
        setError(null)
        setBusy(true)
        try {
            await uninstallCraft(craftId)
            setNeedsReload(true)
            await refresh()
        } catch (e) {
            setError(errorText(e))
        } finally {
            setBusy(false)
        }
    }

    const registryCraft = (craftId: string) =>
        index?.crafts.find((c) => c.craftId === craftId)
    /** A newer version this app can run, if the registry has one. */
    const updateFor = (r: InstalledCraftRecord) => {
        const c = registryCraft(r.craftId)
        const v = c && pickVersion(c)
        return c && v && compareVersions(v.version, r.version) > 0
            ? {craft: c, version: v.version}
            : undefined
    }

    const browsable = (index?.crafts ?? []).filter(
        (c) =>
            !c.unlisted ||
            (typeof __SHOW_UNLISTED_CRAFTS__ !== 'undefined' &&
                __SHOW_UNLISTED_CRAFTS__)
    )

    const rowAction = (c: RegistryCraft) => {
        const mine = installed.find((r) => r.craftId === c.craftId)
        const v = pickVersion(c)
        if (downloading === c.craftId) return <CircularProgress size={20} />
        if (!v) {
            const why = unavailableReason(c)
            return (
                <Typography variant="caption" color="text.secondary">
                    {why && 'missing' in why
                        ? t('ui.craft.manage.needsCapability', {
                              caps: capabilityNames(why.missing),
                          })
                        : t('ui.craft.manage.needsNewerApp')}
                </Typography>
            )
        }
        if (mine && compareVersions(v.version, mine.version) <= 0)
            return (
                <Typography variant="caption" color="text.secondary">
                    {t('ui.craft.manage.installedStatus')}
                </Typography>
            )
        return (
            <Button
                size="small"
                variant={mine ? 'outlined' : 'contained'}
                disabled={busy || !!downloading}
                onClick={() => void fromRegistry(c)}
            >
                {mine
                    ? t('ui.craft.manage.updateTo', {version: v.version})
                    : t('ui.craft.manage.install')}
            </Button>
        )
    }

    const m = preview?.parsed.manifest
    const isDowngrade =
        !!m &&
        !!preview?.installedVersion &&
        compareVersions(m.version, preview.installedVersion) < 0

    return (
        <>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
                <DialogTitle sx={{pb: 0}}>
                    {t('ui.craft.manage.title')}
                </DialogTitle>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    sx={{px: 3, borderBottom: '1px solid #e0e0e0'}}
                >
                    <Tab
                        value="installed"
                        label={t('ui.craft.manage.tabInstalled')}
                    />
                    <Tab
                        value="browse"
                        label={t('ui.craft.manage.tabBrowse')}
                    />
                    {hasConnections && (
                        <Tab
                            value="connections"
                            label={t('ui.craft.manage.tabConnections')}
                        />
                    )}
                </Tabs>
                <DialogContent
                    onDragOver={(e) => {
                        e.preventDefault()
                        setDragging(true)
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault()
                        setDragging(false)
                        const f = e.dataTransfer.files?.[0]
                        if (f) void readFile(f)
                    }}
                    sx={{
                        pt: 2,
                        minHeight: 260,
                        outline: dragging ? '2px dashed #90a4ae' : 'none',
                        outlineOffset: -8,
                    }}
                >
                    {needsReload && (
                        <Alert
                            severity="info"
                            sx={{mb: 2}}
                            action={
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={() => window.location.reload()}
                                >
                                    {t('ui.craft.manage.reloadNow')}
                                </Button>
                            }
                        >
                            {t('ui.craft.manage.reloadHint')}
                        </Alert>
                    )}
                    {error && (
                        <Alert severity="error" sx={{mb: 2}}>
                            {error}
                        </Alert>
                    )}
                    {tab === 'connections' && <DataConnectionsPane />}
                    {tab === 'installed' &&
                        (installed.length === 0 ? (
                            <DialogContentText>
                                {t('ui.craft.manage.empty')}
                            </DialogContentText>
                        ) : (
                            <List dense>
                                {installed.map((r) => {
                                    const up = updateFor(r)
                                    return (
                                        <ListItem
                                            key={r.craftId}
                                            secondaryAction={
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        gap: 1,
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    {downloading ===
                                                    r.craftId ? (
                                                        <CircularProgress
                                                            size={20}
                                                        />
                                                    ) : (
                                                        up && (
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                disabled={
                                                                    busy ||
                                                                    !!downloading
                                                                }
                                                                onClick={() =>
                                                                    void fromRegistry(
                                                                        up.craft
                                                                    )
                                                                }
                                                            >
                                                                {t(
                                                                    'ui.craft.manage.updateTo',
                                                                    {
                                                                        version:
                                                                            up.version,
                                                                    }
                                                                )}
                                                            </Button>
                                                        )
                                                    )}
                                                    <Button
                                                        size="small"
                                                        color="error"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void remove(
                                                                r.craftId
                                                            )
                                                        }
                                                    >
                                                        {t(
                                                            'ui.craft.manage.uninstall'
                                                        )}
                                                    </Button>
                                                </Box>
                                            }
                                        >
                                            <ListItemText
                                                primary={`${labelOf(
                                                    r.manifest
                                                )} · ${r.version}`}
                                                secondary={r.craftId}
                                            />
                                        </ListItem>
                                    )
                                })}
                            </List>
                        ))}
                    {tab === 'browse' &&
                        (indexLoading ? (
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    py: 4,
                                }}
                            >
                                <CircularProgress size={28} />
                            </Box>
                        ) : indexError ? (
                            <Alert
                                severity="warning"
                                action={
                                    <Button
                                        color="inherit"
                                        size="small"
                                        onClick={loadIndex}
                                    >
                                        {t('ui.craft.manage.retry')}
                                    </Button>
                                }
                            >
                                {indexError}
                            </Alert>
                        ) : browsable.length === 0 ? (
                            <DialogContentText>
                                {t('ui.craft.manage.browseEmpty')}
                            </DialogContentText>
                        ) : (
                            <List dense>
                                {browsable.map((c) => (
                                    <ListItem
                                        key={c.craftId}
                                        secondaryAction={rowAction(c)}
                                        sx={{pr: 16}}
                                    >
                                        <ListItemText
                                            primary={`${labelOf(c)} · ${
                                                c.latest
                                            }`}
                                            secondary={
                                                c.description ?? c.craftId
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        ))}
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        component="p"
                        sx={{mt: 1}}
                    >
                        {t('ui.craft.manage.dropHint')}
                    </Typography>
                    <input
                        ref={fileInput}
                        type="file"
                        accept=".craft"
                        hidden
                        onChange={(e) => {
                            const f = e.target.files?.[0]
                            // Clear it, so picking the same file again still
                            // fires `change`.
                            e.target.value = ''
                            if (f) void readFile(f)
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>
                        {t('ui.craft.manage.close')}
                    </Button>
                    <Button
                        variant="contained"
                        disabled={busy}
                        onClick={() => fileInput.current?.click()}
                    >
                        {t('ui.craft.manage.installFromFile')}
                    </Button>
                </DialogActions>
            </Dialog>
            {preview && m && (
                <Dialog open onClose={() => setPreview(null)}>
                    <DialogTitle>
                        {t('ui.craft.manage.confirmTitle', {
                            craft: labelOf(m),
                        })}
                    </DialogTitle>
                    <DialogContent>
                        <Box
                            component="dl"
                            sx={{
                                m: 0,
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr',
                                columnGap: 2,
                                rowGap: 0.5,
                                fontSize: '0.85rem',
                                '& dt': {color: 'text.secondary'},
                                '& dd': {m: 0},
                            }}
                        >
                            <dt>{t('ui.craft.manage.fieldId')}</dt>
                            <dd>{m.craftId}</dd>
                            <dt>{t('ui.craft.manage.fieldVersion')}</dt>
                            <dd>
                                {preview.installedVersion
                                    ? t('ui.craft.manage.versionChange', {
                                          from: preview.installedVersion,
                                          to: m.version,
                                      })
                                    : m.version}
                            </dd>
                            <dt>{t('ui.craft.manage.fieldSource')}</dt>
                            <dd>
                                {preview.fromRegistry
                                    ? t('ui.craft.manage.sourceRegistry')
                                    : t('ui.craft.manage.sourceFile')}
                            </dd>
                            <dt>{t('ui.craft.manage.fieldPublisher')}</dt>
                            <dd>
                                {m.publisher ??
                                    t('ui.craft.manage.publisherUnknown')}
                            </dd>
                            {m.description && (
                                <>
                                    <dt>
                                        {t('ui.craft.manage.fieldDescription')}
                                    </dt>
                                    <dd>{m.description}</dd>
                                </>
                            )}
                            {!!m.requires?.length && (
                                <>
                                    <dt>
                                        {t('ui.craft.manage.fieldRequires')}
                                    </dt>
                                    <dd>{capabilityNames(m.requires)}</dd>
                                </>
                            )}
                            {!!m.tools?.length && (
                                <>
                                    <dt>{t('ui.craft.manage.fieldTools')}</dt>
                                    <dd>
                                        {m.tools.map((x) => x.name).join(', ')}
                                    </dd>
                                </>
                            )}
                        </Box>
                        {isDowngrade && (
                            <Alert severity="warning" sx={{mt: 2}}>
                                {t('ui.craft.manage.downgradeWarning')}
                            </Alert>
                        )}
                        <Alert
                            severity={preview.fromRegistry ? 'info' : 'warning'}
                            sx={{mt: 2}}
                        >
                            {preview.fromRegistry
                                ? t('ui.craft.manage.trustRegistry')
                                : t('ui.craft.manage.trustWarning')}
                        </Alert>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setPreview(null)}>
                            {t('ui.craft.manage.cancel')}
                        </Button>
                        <Button
                            variant="contained"
                            disabled={busy}
                            onClick={() => void confirmInstall()}
                        >
                            {preview.installedVersion
                                ? t('ui.craft.manage.update')
                                : t('ui.craft.manage.install')}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </>
    )
}
