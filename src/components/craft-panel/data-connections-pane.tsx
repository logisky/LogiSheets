import {useTranslation} from 'react-i18next'
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControlLabel,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material'
import {useEffect, useState} from 'react'
import type {
    DataConnectionInfo,
    DataConnectionKind,
    DataConnectionTestResult,
} from 'logisheets-core'
import {getDataConnectionsBackend} from '@/core/data-connections'
import {DialogContentText} from '@/ui/dialog'

const KINDS: DataConnectionKind[] = ['postgres', 'mysql', 'sqlite']
const DEFAULT_PORT: Record<DataConnectionKind, number> = {
    postgres: 5432,
    mysql: 3306,
    sqlite: 0,
}

function blank(): DataConnectionInfo {
    return {
        id: '',
        name: '',
        kind: 'postgres',
        host: 'localhost',
        port: DEFAULT_PORT.postgres,
        database: '',
        user: '',
        sslMode: 'prefer',
        hasPassword: false,
    }
}

type Draft = {
    conn: DataConnectionInfo
    // Empty = keep the stored one (or none).
    password: string
    clearPassword: boolean
}

/**
 * The host's data-connection manager (the craft manager's Connections tab):
 * add, edit, test and delete the connections crafts query through
 * `window.dataConnections`. The password field is write-only — a stored
 * password is never shown or read back, only replaced or cleared.
 */
export const DataConnectionsPane = () => {
    const {t} = useTranslation()
    const backend = getDataConnectionsBackend()
    const [conns, setConns] = useState<DataConnectionInfo[]>([])
    const [draft, setDraft] = useState<Draft | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [testResult, setTestResult] =
        useState<DataConnectionTestResult | null>(null)
    const [busy, setBusy] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

    const refresh = () =>
        backend
            ?.list()
            .then(setConns)
            .catch((e) => setError(String(e)))

    useEffect(() => {
        void refresh()
    }, [])

    if (!backend)
        return (
            <DialogContentText>
                {t('ui.craft.connections.desktopOnly')}
            </DialogContentText>
        )

    const edit = (conn: DataConnectionInfo) => {
        setError(null)
        setTestResult(null)
        setDraft({conn: {...conn}, password: '', clearPassword: false})
    }

    const patch = (p: Partial<DataConnectionInfo>) =>
        setDraft((d) => (d ? {...d, conn: {...d.conn, ...p}} : d))

    const run = async (f: () => Promise<void>) => {
        setBusy(true)
        setError(null)
        try {
            await f()
        } catch (e) {
            setError(String(e))
        } finally {
            setBusy(false)
        }
    }

    const test = () =>
        run(async () => {
            if (!draft) return
            setTestResult(null)
            setTestResult(
                await backend.test(draft.conn, draft.password || undefined)
            )
        })

    const save = () =>
        run(async () => {
            if (!draft) return
            await backend.save(
                draft.conn,
                draft.password || undefined,
                draft.clearPassword
            )
            setDraft(null)
            await refresh()
        })

    const remove = (id: string) =>
        run(async () => {
            await backend.delete(id)
            setConfirmDelete(null)
            await refresh()
        })

    if (draft) {
        const c = draft.conn
        const isFile = c.kind === 'sqlite'
        return (
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 1.5}}>
                {error && <Alert severity="error">{error}</Alert>}
                <TextField
                    size="small"
                    label={t('ui.craft.connections.name')}
                    value={c.name}
                    onChange={(e) => patch({name: e.target.value})}
                    autoFocus
                />
                <TextField
                    size="small"
                    select
                    label={t('ui.craft.connections.kind')}
                    value={c.kind}
                    onChange={(e) => {
                        const kind = e.target.value as DataConnectionKind
                        patch({kind, port: DEFAULT_PORT[kind]})
                    }}
                >
                    {KINDS.map((k) => (
                        <MenuItem key={k} value={k}>
                            {t(`ui.craft.connections.kinds.${k}`)}
                        </MenuItem>
                    ))}
                </TextField>
                {!isFile && (
                    <Box sx={{display: 'flex', gap: 1}}>
                        <TextField
                            size="small"
                            label={t('ui.craft.connections.host')}
                            value={c.host}
                            onChange={(e) => patch({host: e.target.value})}
                            sx={{flex: 1}}
                        />
                        <TextField
                            size="small"
                            type="number"
                            label={t('ui.craft.connections.port')}
                            value={c.port || ''}
                            onChange={(e) =>
                                patch({port: Number(e.target.value) || 0})
                            }
                            sx={{width: 110}}
                        />
                    </Box>
                )}
                <TextField
                    size="small"
                    label={t(
                        isFile
                            ? 'ui.craft.connections.databaseFile'
                            : 'ui.craft.connections.database'
                    )}
                    value={c.database}
                    onChange={(e) => patch({database: e.target.value})}
                />
                {!isFile && (
                    <>
                        <TextField
                            size="small"
                            label={t('ui.craft.connections.user')}
                            value={c.user}
                            onChange={(e) => patch({user: e.target.value})}
                        />
                        <TextField
                            size="small"
                            type="password"
                            autoComplete="new-password"
                            label={t('ui.craft.connections.password')}
                            // Keep the label up so the "kept" placeholder
                            // shows without focusing the field.
                            slotProps={{
                                inputLabel: {
                                    shrink: c.hasPassword || undefined,
                                },
                            }}
                            placeholder={
                                c.hasPassword
                                    ? String(
                                          t('ui.craft.connections.passwordKeep')
                                      )
                                    : ''
                            }
                            helperText={t('ui.craft.connections.passwordHint')}
                            value={draft.password}
                            disabled={draft.clearPassword}
                            onChange={(e) =>
                                setDraft({...draft, password: e.target.value})
                            }
                        />
                        {c.hasPassword && (
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={draft.clearPassword}
                                        onChange={(e) =>
                                            setDraft({
                                                ...draft,
                                                password: '',
                                                clearPassword: e.target.checked,
                                            })
                                        }
                                    />
                                }
                                label={t('ui.craft.connections.clearPassword')}
                            />
                        )}
                        <TextField
                            size="small"
                            select
                            label={t('ui.craft.connections.ssl')}
                            value={c.sslMode}
                            onChange={(e) =>
                                patch({
                                    sslMode: e.target
                                        .value as DataConnectionInfo['sslMode'],
                                })
                            }
                        >
                            {(['disable', 'prefer', 'require'] as const).map(
                                (m) => (
                                    <MenuItem key={m} value={m}>
                                        {t(
                                            `ui.craft.connections.sslModes.${m}`
                                        )}
                                    </MenuItem>
                                )
                            )}
                        </TextField>
                    </>
                )}
                {testResult && (
                    <Alert severity={testResult.ok ? 'success' : 'error'}>
                        {testResult.ok
                            ? t('ui.craft.connections.testOk')
                            : t('ui.craft.connections.testFailed', {
                                  message: testResult.error ?? '',
                              })}
                    </Alert>
                )}
                <Box sx={{display: 'flex', gap: 1, justifyContent: 'flex-end'}}>
                    {busy && <CircularProgress size={20} sx={{mr: 'auto'}} />}
                    <Button
                        size="small"
                        disabled={busy}
                        onClick={() => setDraft(null)}
                    >
                        {t('ui.craft.connections.cancel')}
                    </Button>
                    <Button
                        size="small"
                        variant="outlined"
                        disabled={busy}
                        onClick={() => void test()}
                    >
                        {t('ui.craft.connections.test')}
                    </Button>
                    <Button
                        size="small"
                        variant="contained"
                        disabled={busy || !c.name.trim()}
                        onClick={() => void save()}
                    >
                        {t('ui.craft.connections.save')}
                    </Button>
                </Box>
            </Box>
        )
    }

    return (
        <Box>
            {error && (
                <Alert severity="error" sx={{mb: 2}}>
                    {error}
                </Alert>
            )}
            {conns.length === 0 ? (
                <DialogContentText>
                    {t('ui.craft.connections.empty')}
                </DialogContentText>
            ) : (
                <List dense>
                    {conns.map((c) => (
                        <ListItem
                            key={c.id}
                            secondaryAction={
                                confirmDelete === c.id ? (
                                    <Box sx={{display: 'flex', gap: 1}}>
                                        <Button
                                            size="small"
                                            onClick={() =>
                                                setConfirmDelete(null)
                                            }
                                        >
                                            {t('ui.craft.connections.cancel')}
                                        </Button>
                                        <Button
                                            size="small"
                                            color="error"
                                            disabled={busy}
                                            onClick={() => void remove(c.id)}
                                        >
                                            {t(
                                                'ui.craft.connections.confirmDelete'
                                            )}
                                        </Button>
                                    </Box>
                                ) : (
                                    <Box sx={{display: 'flex', gap: 1}}>
                                        <Button
                                            size="small"
                                            onClick={() => edit(c)}
                                        >
                                            {t('ui.craft.connections.edit')}
                                        </Button>
                                        <Button
                                            size="small"
                                            color="error"
                                            onClick={() =>
                                                setConfirmDelete(c.id)
                                            }
                                        >
                                            {t('ui.craft.connections.delete')}
                                        </Button>
                                    </Box>
                                )
                            }
                        >
                            <ListItemText
                                primary={c.name}
                                secondary={
                                    c.kind === 'sqlite'
                                        ? c.database
                                        : `${t(
                                              `ui.craft.connections.kinds.${c.kind}`
                                          )} · ${c.user}@${c.host}:${c.port}/${
                                              c.database
                                          }`
                                }
                            />
                        </ListItem>
                    ))}
                </List>
            )}
            <Button
                size="small"
                variant="outlined"
                sx={{mt: 1}}
                onClick={() => edit(blank())}
            >
                {t('ui.craft.connections.add')}
            </Button>
            <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{mt: 2}}
            >
                {t('ui.craft.connections.trustNote')}
            </Typography>
        </Box>
    )
}
