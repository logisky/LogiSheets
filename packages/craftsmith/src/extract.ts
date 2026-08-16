/**
 * The extractor: read a craft directory, statically analyze tools.ts with the
 * TypeScript type checker (no code execution), and produce the capability
 * manifest plus diagnostics.
 *
 * Source of truth is the code. Every field of every tool is derived from the
 * real signature; the JSDoc annotations only add intent (description, mutates,
 * confirm) that the types can't carry.
 */

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type {
    CraftManifest,
    ManifestTool,
    ManifestSkill,
    ConfirmationPolicy,
    MutatesPolicy,
} from './manifest.js'
import type {Diagnostic} from './diagnostics.js'
import {SchemaError} from './diagnostics.js'
import {typeToSchema} from './schema.js'
import {lintPurity} from './purity.js'

export interface CraftPaths {
    root: string
    toolsTs?: string
    runtimeTs?: string
    indexHtml?: string
    packageJson: string
}

export interface ExtractResult {
    manifest: CraftManifest
    diagnostics: Diagnostic[]
}

/** Discover a craft's parts by file convention. */
export function resolveCraft(root: string): CraftPaths {
    const abs = path.resolve(root)
    const pkg = path.join(abs, 'package.json')
    if (!fs.existsSync(pkg))
        throw new Error(`no package.json in ${abs} — not a craft directory`)
    const pick = (f: string) => {
        const p = path.join(abs, f)
        return fs.existsSync(p) ? p : undefined
    }
    return {
        root: abs,
        toolsTs: pick('tools.ts'),
        runtimeTs: pick('runtime.ts'),
        indexHtml: pick('index.html'),
        packageJson: pkg,
    }
}

interface Identity {
    craftId: string
    version: string
    label: string
}

function readIdentity(paths: CraftPaths, diags: Diagnostic[]): Identity {
    const pkg = JSON.parse(fs.readFileSync(paths.packageJson, 'utf8'))
    const craftId: string = pkg.craftId ?? pkg.name
    if (!craftId)
        diags.push({
            level: 'error',
            message: 'package.json needs a "craftId" (or "name")',
            file: paths.packageJson,
        })
    if (pkg.craftId && !/^[a-z0-9][a-z0-9-]*$/.test(pkg.craftId))
        diags.push({
            level: 'error',
            message: `craftId "${pkg.craftId}" must be kebab-case (a-z, 0-9, "-")`,
            file: paths.packageJson,
        })
    return {
        craftId: craftId ?? 'unknown',
        version: pkg.version ?? '0.0.0',
        label: pkg.label ?? pkg.name ?? craftId ?? 'unknown',
    }
}

function createProgram(rootFile: string, craftRoot: string): ts.Program {
    let options: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2021,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        noEmit: true,
        lib: ['lib.es2021.d.ts', 'lib.dom.d.ts'],
    }
    const configPath = ts.findConfigFile(
        craftRoot,
        ts.sys.fileExists,
        'tsconfig.json'
    )
    if (configPath) {
        const parsed = ts.getParsedCommandLineOfConfigFile(
            configPath,
            {},
            {
                ...ts.sys,
                onUnRecoverableConfigFileDiagnostic: () => {},
            } as ts.ParseConfigFileHost
        )
        if (parsed) options = {...parsed.options, noEmit: true}
    }
    return ts.createProgram({rootNames: [rootFile], options})
}

// ---- JSDoc helpers ---------------------------------------------------------

function tagsOf(node: ts.Node): readonly ts.JSDocTag[] {
    return ts.getJSDocTags(node)
}

function tagNamed(
    node: ts.Node,
    name: string
): ts.JSDocTag | undefined {
    return tagsOf(node).find((t) => t.tagName.escapedText === name)
}

function tagText(tag: ts.JSDocTag | undefined): string {
    if (!tag) return ''
    // JSDoc wraps across lines; collapse to a single clean line for the manifest.
    return (ts.getTextOfJSDocComment(tag.comment) ?? '')
        .replace(/\s+/g, ' ')
        .trim()
}

function isExported(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) return false
    return !!ts
        .getModifiers(node)
        ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

function lineOf(node: ts.Node): number {
    const sf = node.getSourceFile()
    return sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
}

// ---- Tool candidates -------------------------------------------------------

interface Candidate {
    /** Node carrying the JSDoc (fn decl or the variable statement). */
    jsdocNode: ts.Node
    name: string | undefined
    exported: boolean
    fn: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression
}

function collectCandidates(sf: ts.SourceFile): Candidate[] {
    const out: Candidate[] = []
    for (const stmt of sf.statements) {
        if (ts.isFunctionDeclaration(stmt)) {
            out.push({
                jsdocNode: stmt,
                name: stmt.name?.text,
                exported: isExported(stmt),
                fn: stmt,
            })
        } else if (ts.isVariableStatement(stmt)) {
            const decls = stmt.declarationList.declarations
            if (decls.length !== 1) continue
            const d = decls[0]
            const init = d.initializer
            if (
                init &&
                (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
            ) {
                out.push({
                    jsdocNode: stmt,
                    name: ts.isIdentifier(d.name) ? d.name.text : undefined,
                    exported: isExported(stmt),
                    fn: init,
                })
            }
        }
    }
    return out
}

// ---- Per-tool extraction ---------------------------------------------------

function looksLikeCtx(param: ts.ParameterDeclaration): boolean {
    if (ts.isIdentifier(param.name) && param.name.text === 'ctx') return true
    const typeText = param.type?.getText() ?? ''
    return /(?:Ctx|Context)$/.test(typeText)
}

function paramOptional(
    param: ts.ParameterDeclaration,
    checker: ts.TypeChecker
): boolean {
    if (param.questionToken || param.initializer) return true
    const t = checker.getTypeAtLocation(param)
    if (t.isUnion())
        return t.types.some((m) => m.flags & ts.TypeFlags.Undefined)
    return false
}

function unwrapPromise(type: ts.Type, checker: ts.TypeChecker): ts.Type {
    const sym = type.getSymbol()
    if (sym && sym.name === 'Promise') {
        const args = checker.getTypeArguments(type as ts.TypeReference)
        if (args.length) return args[0]
    }
    return type
}

function parseMutates(raw: string): MutatesPolicy {
    const v = raw.trim().toLowerCase()
    if (v === 'temp') return 'temp'
    if (v === 'true' || v === 'yes') return true
    return 'none'
}

function parseConfirm(raw: string): ConfirmationPolicy | undefined {
    const v = raw.trim().toLowerCase()
    if (v === 'never' || v === 'once' || v === 'always' || v === 'destructive')
        return v
    return undefined
}

function extractTool(
    cand: Candidate,
    toolTag: ts.JSDocTag,
    checker: ts.TypeChecker,
    entry: string,
    diags: Diagnostic[]
): ManifestTool | undefined {
    const file = cand.jsdocNode.getSourceFile().fileName
    const line = lineOf(cand.jsdocNode)
    const push = (level: 'error' | 'warn', message: string) =>
        diags.push({level, message, file, line})

    if (!cand.exported) {
        push('error', `@tool "${cand.name ?? '?'}" must be an exported binding`)
        return undefined
    }
    if (!cand.name) {
        push('error', '@tool must be a named export (no anonymous default)')
        return undefined
    }

    const description = tagText(toolTag)
    if (!description)
        push(
            'error',
            `@tool ${cand.name}: add a one-line description after the @tool tag`
        )

    const params = cand.fn.parameters
    if (params.length === 0 || !looksLikeCtx(params[0])) {
        push(
            'error',
            `@tool ${cand.name}: first parameter must be the host-injected \`ctx\` ` +
                `(name it \`ctx\` or type it \`*Ctx\`/\`*Context\`)`
        )
        return undefined
    }

    // Collect @param descriptions.
    const paramDocs = new Map<string, string>()
    for (const t of tagsOf(cand.jsdocNode)) {
        if (t.tagName.escapedText === 'param' && ts.isJSDocParameterTag(t)) {
            const n = ts.isIdentifier(t.name) ? t.name.text : undefined
            if (n) paramDocs.set(n, tagText(t))
        }
    }

    const properties: Record<string, ReturnType<typeof typeToSchema>> = {}
    const required: string[] = []
    const paramOrder: string[] = []
    const realParams = params.slice(1)

    for (const p of realParams) {
        if (!ts.isIdentifier(p.name)) {
            push(
                'error',
                `@tool ${cand.name}: destructured parameters are not supported — ` +
                    `use a plain named parameter`
            )
            return undefined
        }
        const pname = p.name.text
        paramOrder.push(pname)
        const ptype = checker.getTypeAtLocation(p)
        try {
            const schema = typeToSchema(ptype, checker, p)
            const doc = paramDocs.get(pname)
            if (doc) schema.description = doc
            properties[pname] = schema
        } catch (e) {
            if (e instanceof SchemaError) {
                push(
                    'error',
                    `@tool ${cand.name}, parameter "${pname}": ${e.message}`
                )
                return undefined
            }
            throw e
        }
        if (!paramOptional(p, checker)) required.push(pname)
    }

    // @param names that don't match any real parameter → typo.
    for (const documented of paramDocs.keys()) {
        if (!paramOrder.includes(documented))
            push(
                'error',
                `@tool ${cand.name}: @param "${documented}" does not match any parameter`
            )
    }
    // Real params missing a @param doc → warn only.
    for (const pname of paramOrder)
        if (!paramDocs.has(pname))
            push('warn', `@tool ${cand.name}: parameter "${pname}" has no @param doc`)

    const inputSchema: ManifestTool['inputSchema'] = {
        type: 'object',
        properties,
    }
    if (required.length) inputSchema.required = required

    // Return type → outputSchema (best-effort, documentation only).
    let outputSchema: ManifestTool['outputSchema']
    try {
        const sig = checker.getSignatureFromDeclaration(cand.fn)
        if (sig) {
            const ret = unwrapPromise(sig.getReturnType(), checker)
            if (!(ret.flags & ts.TypeFlags.Void))
                outputSchema = typeToSchema(ret, checker, cand.fn)
        }
    } catch {
        // output schema is optional; ignore anything not serializable
    }

    const mutates = parseMutates(tagText(tagNamed(cand.jsdocNode, 'mutates')))
    const confirmTag = tagNamed(cand.jsdocNode, 'confirm')
    const confirmation: ConfirmationPolicy =
        parseConfirm(tagText(confirmTag)) ??
        (mutates === 'none' ? 'never' : 'always')

    return {
        name: toSnake(cand.name),
        description,
        inputSchema,
        outputSchema,
        paramOrder,
        entry,
        export: cand.name,
        mutates,
        confirmation,
    }
}

function toSnake(name: string): string {
    return name
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[-\s]+/g, '_')
        .toLowerCase()
}

// ---- Module-level skill ----------------------------------------------------

/**
 * Scan every `/** ... *␟/` block in the file, not just those attached to a
 * declaration. A module-level skill annotation typically floats near the top,
 * separated by a blank line, so TS attaches it to no node — a raw-comment scan
 * finds it regardless of placement.
 */
function scanJsDocBlocks(sf: ts.SourceFile): ts.JSDoc[] {
    const text = sf.getFullText()
    const blocks: ts.JSDoc[] = []
    const re = /\/\*\*[\s\S]*?\*\//g
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
        const parsed = ts.parseIsolatedJSDocComment(m[0], 0, m[0].length)
        if (parsed?.jsDoc) blocks.push(parsed.jsDoc)
    }
    return blocks
}

function jsDocTag(doc: ts.JSDoc, name: string): ts.JSDocTag | undefined {
    return doc.tags?.find((t) => t.tagName.escapedText === name)
}

function extractSkill(sf: ts.SourceFile): ManifestSkill | undefined {
    for (const doc of scanJsDocBlocks(sf)) {
        const skillTag = jsDocTag(doc, 'logicianSkill')
        if (skillTag) {
            const skill: ManifestSkill = {description: tagText(skillTag)}
            const g = tagText(jsDocTag(doc, 'guidance'))
            if (g) skill.guidance = g
            return skill
        }
    }
    return undefined
}

// ---- Entry -----------------------------------------------------------------

export function extract(root: string): ExtractResult {
    const paths = resolveCraft(root)
    const diags: Diagnostic[] = []
    const id = readIdentity(paths, diags)

    if (!paths.toolsTs && !paths.indexHtml)
        diags.push({
            level: 'error',
            message:
                'a craft needs at least one of tools.ts or index.html',
            file: paths.root,
        })

    const manifest: CraftManifest = {
        schemaVersion: 1,
        craftId: id.craftId,
        version: id.version,
        label: id.label,
    }
    if (paths.indexHtml) manifest.url = 'index.html'
    if (paths.runtimeTs) manifest.rtJs = 'runtime.js'

    if (paths.toolsTs) {
        const program = createProgram(paths.toolsTs, paths.root)
        const checker = program.getTypeChecker()
        const sf = program.getSourceFile(paths.toolsTs)
        if (!sf) {
            diags.push({
                level: 'error',
                message: `could not load ${paths.toolsTs}`,
                file: paths.toolsTs,
            })
            return {manifest, diagnostics: diags}
        }

        diags.push(...lintPurity(sf))

        const tools: ManifestTool[] = []
        for (const cand of collectCandidates(sf)) {
            const toolTag = tagNamed(cand.jsdocNode, 'tool')
            if (!toolTag) continue
            const tool = extractTool(cand, toolTag, checker, 'tools.js', diags)
            if (tool) tools.push(tool)
        }

        const skill = extractSkill(sf)
        if (tools.length && !skill)
            diags.push({
                level: 'error',
                message:
                    'tools.ts exposes @tool functions but has no module-level ' +
                    '@logicianSkill describing when to use this craft',
                file: paths.toolsTs,
            })

        if (skill) manifest.skill = skill
        if (tools.length) manifest.tools = tools

        // Duplicate tool names collide in the LLM namespace.
        const seen = new Set<string>()
        for (const t of tools) {
            if (seen.has(t.name))
                diags.push({
                    level: 'error',
                    message: `duplicate tool name "${t.name}"`,
                    file: paths.toolsTs,
                })
            seen.add(t.name)
        }
    }

    return {manifest, diagnostics: diags}
}
