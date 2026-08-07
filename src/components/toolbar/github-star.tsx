import {useEffect, useState} from 'react'
import Tooltip from '@mui/material/Tooltip'
import {GitHub as GitHubIcon, Star as StarIcon} from '@mui/icons-material'
import styles from './toolbar.module.scss'

const REPO_URL = 'https://github.com/logisky/LogiSheets'
const API_URL = 'https://api.github.com/repos/logisky/LogiSheets'

// Compact star counts the way GitHub does: 1234 -> "1.2k".
function formatStars(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
}

// GitHub badge shown at the right end of the toolbar: the logo links to the
// repo, with the live stargazer count next to it. The count comes from the
// public, unauthenticated GitHub API; if that fails (offline or rate-limited),
// we silently fall back to just the logo.
export const GithubStar = () => {
    const [stars, setStars] = useState<number | null>(null)

    useEffect(() => {
        let cancelled = false
        fetch(API_URL)
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((d: {stargazers_count?: number}) => {
                if (!cancelled && typeof d.stargazers_count === 'number')
                    setStars(d.stargazers_count)
            })
            .catch(() => {
                /* offline or rate-limited: show the logo without a count */
            })
        return () => {
            cancelled = true
        }
    }, [])

    return (
        <Tooltip title="Star LogiSheets on GitHub">
            <a
                className={styles.github}
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
            >
                <GitHubIcon fontSize="small" />
                {stars !== null && (
                    <span className={styles.githubStars}>
                        <StarIcon className={styles.githubStarIcon} />
                        {formatStars(stars)}
                    </span>
                )}
            </a>
        </Tooltip>
    )
}
