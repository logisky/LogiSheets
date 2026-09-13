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
    if (!globalStore.isTempMode) return null

    return (
        <div className={styles.bar} data-testid="temp-mode-bar">
            <ScienceIcon fontSize="small" className={styles.icon} />
            <span className={styles.label}>
                <b>Temp mode</b> — edits are on a scratch branch
                {changeCount > 0 ? (
                    <>
                        {' · '}
                        {changeCount} cell{changeCount === 1 ? '' : 's'} changed
                    </>
                ) : null}
            </span>
            <button
                type="button"
                className={`${styles.btn} ${styles.commit}`}
                onClick={onCommit}
                title="Keep these edits, as a single undo step"
            >
                Commit
            </button>
            <button
                type="button"
                className={`${styles.btn} ${styles.discard}`}
                onClick={onDiscard}
                title="Throw these edits away and go back to the committed values"
            >
                Discard
            </button>
        </div>
    )
})
