import { Styles } from './styles'
import { FC, MouseEvent, useState } from 'react'
import { Candidate } from './item'
import { SuggestDetailsComponent } from './details'
import styles from './suggest.module.scss'
export * from './item'
export * from './styles'
export interface SuggestProps {
	readonly show$: boolean
	// 关闭suggest
	readonly close$: () => void
	// 选择某个candidate
	readonly select$: (candidate: Candidate) => void
	readonly sugggestStyles: Styles
	readonly acitveCandidate?: Candidate
	// 所有candidates
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

	const mouseDown = (e: MouseEvent, candidate: Candidate) => {
		e.preventDefault()
		e.stopPropagation()
		select$(candidate)
		close$()
	}
	return (<div
		className={styles.host}
		style={{
			left: `${sugggestStyles.x}px`,
			top: `${sugggestStyles.y}px`,
			visibility: `${show$ ? 'visible' : 'hidden'}`,
		}}
	>
		{candidates.map((candidate, i) => {
			return <div
				key={i}
				className={`${styles.suggest}
					${candidate.disable ? styles.disabled : ''}
					${candidate.textOnly ? styles['text-only'] : ''}
					${candidate === acitveCandidate ? styles['active'] : ''}`}
				onMouseDown={e => mouseDown(e, candidate)}
			>
				{candidate.spans.map((s, j) => {
					return <span key={j} className={`${styles['suggest-span']} ${s.highlight ? styles['highlight'] : ''}`}>{s.text}</span>
				})}
			</div>
		})}
		{showDetails ? <SuggestDetailsComponent
			close$={() => setShowDetails(false)}
		></SuggestDetailsComponent> : null}
	</div >
	)
}
