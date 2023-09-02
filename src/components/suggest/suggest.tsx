import { Styles } from './styles'
import { observer, useLocalStore } from 'mobx-react'
import { MouseEvent, useState } from 'react'
import { SuggestDetailsComponent } from './details'
import styles from './suggest.module.scss'
import { suggestStore } from './store'
export interface SuggestProps {
    readonly sugggestStyles: Styles
}
export const SuggestComponent = observer((props: SuggestProps) => {
    const { sugggestStyles } = props
    const store = useLocalStore(() => suggestStore)
    const [showDetails, setShowDetails] = useState(false)

    const mouseDown = (e: MouseEvent, i: number) => {
        e.preventDefault()
        e.stopPropagation()
        const candidate = store.candidates[i]
        if (candidate.textOnly) return
        store.show = false
        store.selectedCandidate = i
    }
    return (
        <div
            className={styles.host}
            style={{
                left: `${sugggestStyles.x}px`,
                top: `${sugggestStyles.y}px`,
                visibility: `${store.show ? 'visible' : 'hidden'}`,
            }}
        >
            {store.candidates.map((candidate, i) => {
                return (
                    <div
                        key={i}
                        className={`${styles.suggest}
					${candidate.disable ? styles.disabled : ''}
					${candidate.textOnly ? styles['text-only'] : ''}
					${i === store.acitveCandidate ? styles['active'] : ''}`}
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
})
