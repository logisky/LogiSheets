import {createContext, FC, useContext} from 'react'
import {Container, interfaces} from 'inversify'
import {CONTAINER} from './config'

const InversifyContainer = createContext<{container: Container}>({
    container: CONTAINER,
})

interface IIocProvider {
    readonly container: Container
}

export const IocProvider: FC<IIocProvider> = ({container, children}) => {
    return (
        <InversifyContainer.Provider value={{container}}>
            {children}
        </InversifyContainer.Provider>
    )
}

export function useInjection<T>(identifier: interfaces.ServiceIdentifier<T>) {
    const {container} = useContext(InversifyContainer)
    if (!container) {
        throw new Error()
    }
    return container.get<T>(identifier)
}
