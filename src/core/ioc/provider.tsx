import {createContext, FC, useContext} from 'react'
import {Container, interfaces} from 'inversify'
import {CONTAINER} from './config'

const InversifyContainer = createContext<{container: Container}>({
    container: CONTAINER,
})

interface IIocProvider {
    readonly container: Container
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly children: any
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
