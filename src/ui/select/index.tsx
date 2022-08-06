import Select from 'react-select'
import {FC} from 'react'
import { StateManagerProps } from 'react-select/dist/declarations/src/useStateManager'

export const SelectComponent: FC<StateManagerProps> = (props) => {
    return <Select {...props}></Select>
}