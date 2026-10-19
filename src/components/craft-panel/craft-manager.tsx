import {useTranslation} from 'react-i18next'
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    List,
    ListItem,
    ListItemText,
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

type Props = {
    open: boolean
    onClose: () => void
}

/**
 * Install / list / uninstall user crafts. Changes apply on reload — the craft
 * list is fixed at startup — so every change ends in a "Reload now" offer.
 */
export const CraftManager = ({open, onClose}: Props) => {
    const {t} = useTranslation()
    const fileInput = useRef<HTMLInputElement | null>(null)
    const [installed, setInstalled] = useState<InstalledCraftRecord[]>([])
    const [preview, setPreview] = useState<CraftInstallPreview | null>(null)
    const [error, setError] = useState<string | null>(null)
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

    useEffect(() => {
        if (open) {
            setError(null)
            void refresh()
        }
    }, [open])

    const errorText = (e: unknown): string => {
        if (e instanceof CraftPackageError)
            return String(t(`ui.craft.manage.error.${e.code}`, e.params))
        return String(
            t('ui.craft.manage.error.unknown', {
                message: e instanceof Error ? e.message : String(e),
            })
        )
    }

    const readFile = async (file: File) => {
        setError(null)
        setBusy(true)
        try {
            const bytes = new Uint8Array(await file.arrayBuffer())
            setPreview(await previewCraftPackage(bytes))
        } catch (e) {
            setError(errorText(e))
        } finally {
            setBusy(false)
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

    const m = preview?.parsed.manifest
    const isDowngrade =
        !!m &&
        !!preview?.installedVersion &&
        compareVersions(m.version, preview.installedVersion) < 0

    return (
        <>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
                <DialogTitle>{t('ui.craft.manage.title')}</DialogTitle>
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
                    {installed.length === 0 ? (
                        <DialogContentText>
                            {t('ui.craft.manage.empty')}
                        </DialogContentText>
                    ) : (
                        <List dense>
                            {installed.map((r) => (
                                <ListItem
                                    key={r.craftId}
                                    secondaryAction={
                                        <Button
                                            size="small"
                                            color="error"
                                            disabled={busy}
                                            onClick={() =>
                                                void remove(r.craftId)
                                            }
                                        >
                                            {t('ui.craft.manage.uninstall')}
                                        </Button>
                                    }
                                >
                                    <ListItemText
                                        primary={`${r.manifest.label} · ${r.version}`}
                                        secondary={r.craftId}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
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
                        {t('ui.craft.manage.confirmTitle', {craft: m.label})}
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
                        <Alert severity="warning" sx={{mt: 2}}>
                            {t('ui.craft.manage.trustWarning')}
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

/** Dotted numeric compare; a non-numeric part compares as text. */
function compareVersions(a: string, b: string): number {
    const pa = a.split(/[.+-]/)
    const pb = b.split(/[.+-]/)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const x = pa[i] ?? '0'
        const y = pb[i] ?? '0'
        const nx = Number(x)
        const ny = Number(y)
        const c =
            Number.isNaN(nx) || Number.isNaN(ny) ? x.localeCompare(y) : nx - ny
        if (c !== 0) return c
    }
    return 0
}
