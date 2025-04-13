import {SelectedData} from '@/components/canvas'
import ToggleButton from '@mui/material/ToggleButton'
import ConstructionIcon from '@mui/icons-material/Construction'
import Divider from '@mui/material/Divider'
import styles from '../content/start.module.scss'
import {freezeCellIcon} from './icons'
import {useState} from 'react'

export interface ViewProps {
    readonly selectedData?: SelectedData
    readonly isBlockViewVisible: boolean
    readonly setBlockViewVisible: (visible: boolean) => void
}

export const ViewComponent = ({
    selectedData,
    isBlockViewVisible,
    setBlockViewVisible,
}: ViewProps) => {
    const [isVisible, setVisible] = useState(isBlockViewVisible)

    const handler = () => {
        setVisible(!isVisible)
        setBlockViewVisible(!isVisible)
    }

    return (
        <div className={styles['host']}>
            <ToggleButton
                value="freeze-cell"
                size="small"
                aria-label="freeze-cell"
                style={{fontSize: '1.5rem'}}
            >
                {freezeCellIcon()}
            </ToggleButton>
            <Divider flexItem orientation="vertical" sx={{mx: 0.5, my: 1}} />
            <ToggleButton
                value="block-view"
                size="small"
                aria-label="block-view"
                selected={isBlockViewVisible}
                onClick={handler}
            >
                <div>Crafts</div>
                <ConstructionIcon />
            </ToggleButton>
        </div>
    )
}
