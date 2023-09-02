import { TextContainerComponent } from './container'
import { TextContainerProps } from './types'
import { Provider } from 'mobx-react'
import { internalTextareaStore } from './managers'
export default <T,> (props: TextContainerProps<T>) => {
    return <Provider store={internalTextareaStore}>
        <TextContainerComponent<T> {...props}></TextContainerComponent>
    </Provider>
}