import {AuthorInput} from '../bindings'

/**
 * A person the host knows about — the comment author or an `@mention` target.
 *
 * `displayName` is always present. `userId` + `providerId` are the enterprise
 * directory hooks: enterprise builds fill them from their corporate user
 * system (e.g. `providerId: 'AD'`), while the open-source `src` app leaves them
 * unset and only supplies a typed-in `displayName`.
 *
 * This is structurally the generated {@link AuthorInput} payload shape, re-aliased
 * here so host code can depend on the concept without importing a payload type.
 */
export type Author = AuthorInput

/**
 * The single seam an enterprise deployment overrides to wire LogiSheets
 * comments into its user directory.
 *
 * - `getCurrentAuthor` resolves who is authoring a comment right now.
 * - `searchUsers` backs `@mention` autocomplete.
 *
 * The Rust core stays identity-provider agnostic: it only ever stores the
 * `Author` records this service produces. Nothing in the engine calls a
 * directory — all remote calls live behind an implementation of this interface.
 */
export interface AuthorService {
    getCurrentAuthor(): Promise<Author>
    searchUsers(query: string): Promise<Author[]>
}

/**
 * Default {@link AuthorService} for the open-source `src` app: the author types
 * their own name and there is no directory to search. Enterprise builds inject
 * their own implementation instead of using this.
 */
export class DefaultAuthorService implements AuthorService {
    public constructor(author: Author = {displayName: ''}) {
        this._author = author
    }

    /** Update the manually-entered author (e.g. from a name input field). */
    public setAuthor(author: Author): void {
        this._author = author
    }

    public async getCurrentAuthor(): Promise<Author> {
        return this._author
    }

    // No directory in the open-source build — `@mention` autocomplete is empty.
    public async searchUsers(_query: string): Promise<Author[]> {
        return []
    }

    private _author: Author
}
