/**
 * TS type → JSON Schema, using the real type checker (no code execution).
 *
 * Supported: boolean, number, string, string/number-literal unions (→ enum),
 * arrays, and plain object types whose properties are themselves supported.
 * `X | undefined` is unwrapped (the caller treats it as optional). Anything
 * else throws SchemaError with a message pointing the author at the fix — that
 * error is what makes the tool contract honest.
 */

import ts from 'typescript'
import type {JSONSchema} from './manifest.js'
import {SchemaError} from './diagnostics.js'

/** Strip `undefined` / `null` from a union; returns the remainder + flags. */
function stripNullish(type: ts.Type): {
    type: ts.Type
    optional: boolean
    nullable: boolean
} {
    if (!type.isUnion()) return {type, optional: false, nullable: false}
    let optional = false
    let nullable = false
    const rest = type.types.filter((t) => {
        if (t.flags & ts.TypeFlags.Undefined) {
            optional = true
            return false
        }
        if (t.flags & ts.TypeFlags.Null) {
            nullable = true
            return false
        }
        return true
    })
    if (rest.length === 1) return {type: rest[0], optional, nullable}
    // Reconstruct is not possible via public API; hand back the original union
    // minus the flags — union mapping below re-inspects `type.types` anyway.
    return {type, optional, nullable}
}

function isBooleanType(t: ts.Type): boolean {
    return (
        (t.flags & ts.TypeFlags.Boolean) !== 0 ||
        (t.flags & ts.TypeFlags.BooleanLiteral) !== 0
    )
}

function typeName(checker: ts.TypeChecker, t: ts.Type): string {
    try {
        return checker.typeToString(t)
    } catch {
        return '<type>'
    }
}

export function typeToSchema(
    type: ts.Type,
    checker: ts.TypeChecker,
    node: ts.Node
): JSONSchema {
    const {type: t} = stripNullish(type)

    // Primitives
    if (isBooleanType(t)) return {type: 'boolean'}
    if (t.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral))
        return {type: 'number'}
    if (t.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral))
        return {type: 'string'}

    // Unions → enums (all string literals, or all number literals)
    if (t.isUnion()) {
        const members = t.types.filter(
            (m) => !(m.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null))
        )
        if (members.length && members.every((m) => m.isStringLiteral()))
            return {
                type: 'string',
                enum: members.map((m) => (m as ts.StringLiteralType).value),
            }
        if (members.length && members.every((m) => m.isNumberLiteral()))
            return {
                type: 'number',
                enum: members.map((m) => (m as ts.NumberLiteralType).value),
            }
        if (members.length && members.every(isBooleanType))
            return {type: 'boolean'}
        throw new SchemaError(
            `union type "${typeName(checker, t)}" is not a string- or number-literal enum; ` +
                `simplify it or split it into separate tools`
        )
    }

    // Arrays
    if (checker.isArrayType(t)) {
        const arg = checker.getTypeArguments(t as ts.TypeReference)[0]
        if (!arg)
            throw new SchemaError(`array element type could not be resolved`)
        return {type: 'array', items: typeToSchema(arg, checker, node)}
    }

    // Plain objects / interfaces
    if (t.flags & ts.TypeFlags.Object) {
        const props = checker.getPropertiesOfType(t)
        if (!props.length)
            throw new SchemaError(
                `type "${typeName(checker, t)}" has no readable properties ` +
                    `(function, class, or opaque type?) — not serializable to JSON Schema`
            )
        const properties: Record<string, JSONSchema> = {}
        const required: string[] = []
        for (const prop of props) {
            const propType = checker.getTypeOfSymbolAtLocation(prop, node)
            const {optional} = stripNullish(propType)
            const isOptional =
                optional || (prop.flags & ts.SymbolFlags.Optional) !== 0
            properties[prop.name] = typeToSchema(propType, checker, node)
            if (!isOptional) required.push(prop.name)
        }
        const schema: JSONSchema = {type: 'object', properties}
        if (required.length) schema.required = required
        return schema
    }

    // `any` / `unknown` — allow, but as an untyped value
    if (t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return {}

    throw new SchemaError(
        `type "${typeName(checker, t)}" is not serializable to JSON Schema`
    )
}
