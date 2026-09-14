/**
 * TempModeBar — the way out of a temp-mode session, over the grid where the
 * session is happening.
 *
 * Temp mode used to announce itself only as a chip in the toolbar header,
 * whose one action was to commit; there was no visible way to throw the branch
 * away, and no sign of how much was on it. That is a bad shape for a mode
 * whose whole point is "try something you might not keep" — the discard is the
 * half people reach for.
 *
 * So: what is happening, how many cells it covers, and both exits, next to the
 * cells themselves.
 */

import {observer} from 'mobx-react-lite'
import {useTranslation} from 'react-i18next'
import ScienceIcon from '@mui/icons-material/ScienceOutlined'
import {globalStore} from '@/store'
import styles from './temp-mode.module.scss'

export interface TempModeBarProps {
    /** How many cells differ from the committed branch. */
    changeCount: number
    onCommit: () => void
    onDiscard: () => void
}

export const TempModeBar = observer(function TempModeBar({
    changeCount,
    onCommit,
    onDiscard,
}: TempModeBarProps) {
    const {t} = useTranslation()
    if (!globalStore.isTempMode) return null

    return (
        <div className={styles.bar} data-testid="temp-mode-bar">
            <ScienceIcon fontSize="small" className={styles.icon} />
            <span className={styles.label}>
                <b>{t('ui.tempMode.label')}</b> — {t('ui.tempMode.body')}
                {changeCount > 0
                    ? ` · ${t('ui.tempMode.changed', {count: changeCount})}`
                    : null}
            </span>
            <button
                type="button"
                className={`${styles.btn} ${styles.commit}`}
                onClick={onCommit}
                title={String(t('ui.tempMode.commitTip'))}
            >
                {t('ui.tempMode.commit')}
            </button>
            <button
                type="button"
                className={`${styles.btn} ${styles.discard}`}
                onClick={onDiscard}
                title={String(t('ui.tempMode.discardTip'))}
            >
                {t('ui.tempMode.discard')}
            </button>
        </div>
    )
})
