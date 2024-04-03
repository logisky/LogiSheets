import { Styles } from './styles'
import { FC, MouseEvent, useState } from 'react'
import { Candidate } from './item'
import { SuggestDetailsComponent } from './details'
import styles from './suggest.module.scss'
export * from './item'
export * from './styles'
export interface SuggestProps {
    readonly show$: boolean
    readonly close$: () => void
    readonly select$: (candidate: number) => void
    readonly sugggestStyles: Styles
    readonly acitveCandidate?: number
    readonly candidates?: Candidate[]
}
export const SuggestComponent: FC<SuggestProps> = ({
    show$ = false,
    close$,
    select$,
    sugggestStyles,
    acitveCandidate,
    candidates = [],
}) => {
    const [showDetails, setShowDetails] = useState(false)

    const mouseDown = (e: MouseEvent, candidate: number) => {
        const _active = candidates[candidate]
        e.preventDefault()
        e.stopPropagation()
        if (_active.textOnly) return
        select$(candidate)
        close$()
    }
    return (
        <div
            className={styles.host}
            style={{
                left: `${sugggestStyles.x}px`,
                top: `${sugggestStyles.y}px`,
                visibility: `${show$ ? 'visible' : 'hidden'}`,
            }}
        >
            {candidates.map((candidate, i) => {
                return (
                    <div
                        key={i}
                        className={`${styles.suggest}
					${candidate.disable ? styles.disabled : ''}
					${candidate.textOnly ? styles['text-only'] : ''}
					${i === acitveCandidate ? styles['active'] : ''}`}
                        onMouseDown={(e) => mouseDown(e, i)}
                    >
                        {candidate.spans.map((s, j) => {
                            return (
                                <span
                                    key={j}
                                    className={`${styles['suggest-span']} ${s.highlight ? styles['highlight'] : ''
                                        }`}
                                >
                                    {s.text}
                                </span>
                            )
                        })}
                    </div>
                )
            })}
            {showDetails ? (
                <SuggestDetailsComponent
                    close$={() => setShowDetails(false)}
                ></SuggestDetailsComponent>
            ) : null}
        </div>
    )
}
