import {createContext, useContext} from 'react'
import {AuthorService, DefaultAuthorService} from 'logisheets-web'

/**
 * The comment {@link AuthorService} for the running app. In the open-source
 * `src` build this is a {@link DefaultAuthorService} (the author types their
 * own name, no directory search). Enterprise builds wrap the app in a provider
 * carrying a directory-backed implementation instead — that is the single seam
 * they override to wire comments into their corporate user system.
 */
export const AuthorServiceContext = createContext<AuthorService>(
    new DefaultAuthorService()
)

export function useAuthorService(): AuthorService {
    return useContext(AuthorServiceContext)
}
