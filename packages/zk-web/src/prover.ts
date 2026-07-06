/**
 * Prover integration for LogiSheets ZK quarterly reports.
 *
 * Provides:
 *  - `buildProverInput`: construct public/private inputs from formulas and values
 *  - `mockProve`: local execution only (no ZK proof)
 *  - `prove`: call an external host prover service/binary
 */

import type {
    Formula,
    FormulaWithProof,
    OutputDef,
    PrivateInputs,
    ProverInput,
    PublicInputs,
    QuarterlyReport,
    ZkProof,
} from './types'
import {formulaCommitment, SparseMerkleTree, verifyMerkleProof} from './smt'

export function buildProverInput(
    formulas: Formula[],
    publicValues: Record<string, number>,
    privateValues: Record<string, number>,
    expectedOutputs: string[]
): ProverInput {
    // Use a synchronous path for SMT construction in this helper.
    // The actual SMT builder is async, but for JSON serialization we need commitments.
    // Note: the real root/proof must be computed with SparseMerkleTree.
    throw new Error('Use buildProverInputAsync for full SMT proof generation')
}

export async function buildProverInputAsync(
    formulas: Formula[],
    publicValues: Record<string, number>,
    privateValues: Record<string, number>,
    expectedOutputs: string[]
): Promise<ProverInput> {
    const tree = new SparseMerkleTree()
    for (const formula of formulas) {
        await tree.insert(formula)
    }
    const root = await tree.root()

    const formulasWithProofs: FormulaWithProof[] = []
    for (const formula of formulas) {
        const proof = await tree.proof(formula.id)
        const valid = await verifyMerkleProof(root, formula.id, formulaCommitment(formula), proof)
        if (!valid) {
            throw new Error(`Invalid Merkle proof for formula ${formula.name}`)
        }
        formulasWithProofs.push({formula, proof})
    }

    const publicInputs: PublicInputs = {
        formulaRoot: root,
        values: publicValues,
        expectedOutputs: expectedOutputs.map((name) => ({name})),
    }

    const privateInputs: PrivateInputs = {
        formulasWithProofs,
        values: privateValues,
    }

    return {public: publicInputs, private: privateInputs}
}

export function evaluateFormula(expression: string, values: Record<string, number>): number {
    const trimmed = expression.trim()
    if (trimmed.startsWith('=')) {
        return evaluateFormula(trimmed.slice(1), values)
    }
    return evalNode(parseFormula(trimmed), values)
}

export async function mockProve(input: ProverInput): Promise<QuarterlyReport> {
    const values: Record<string, number> = {
        ...input.public.values,
        ...input.private.values,
    }

    const outputs: Record<string, number> = {}
    for (const fp of input.private.formulasWithProofs) {
        outputs[fp.formula.name] = evaluateFormula(fp.formula.expression, values)
    }

    return {
        fundId: 0,
        quarterId: 0,
        formulaRoot: input.public.formulaRoot,
        outputs,
    }
}

export async function prove(_input: ProverInput): Promise<ZkProof> {
    // Real proving requires the Rust host prover. In a browser context this is typically
    // delegated to a backend service or a local native binary via a sidecar.
    throw new Error(
        'Real ZK proving is not implemented in the browser. Use mockProve or call the host prover CLI.'
    )
}

// Minimal formula parser/evaluator for v1 (mirrors guest program logic).

interface Node {
    kind: 'ref' | 'number' | 'call'
    value?: number
    name?: string
    args?: Node[]
}

function parseFormula(expr: string): Node {
    const trimmed = expr.trim()
    const num = Number(trimmed)
    if (!isNaN(num) && trimmed !== '') {
        return {kind: 'number', value: num}
    }

    const paren = trimmed.indexOf('(')
    if (paren >= 0) {
        const name = trimmed.slice(0, paren).trim().toUpperCase()
        const end = trimmed.lastIndexOf(')')
        const argsStr = trimmed.slice(paren + 1, end >= 0 ? end : undefined)
        const args = splitArgs(argsStr).map((a) => parseFormula(a))
        return {kind: 'call', name, args}
    }

    return {kind: 'ref', name: trimmed}
}

function splitArgs(s: string): string[] {
    const result: string[] = []
    let current = ''
    let depth = 0
    for (const c of s) {
        if (c === '(') {
            depth++
            current += c
        } else if (c === ')') {
            depth--
            current += c
        } else if (c === ',' && depth === 0) {
            result.push(current.trim())
            current = ''
        } else {
            current += c
        }
    }
    if (current.trim()) result.push(current.trim())
    return result
}

function evalNode(node: Node, values: Record<string, number>): number {
    switch (node.kind) {
        case 'number':
            return node.value ?? 0
        case 'ref':
            return node.name ? values[node.name] ?? 0 : 0
        case 'call':
            return evalCall(node.name ?? '', node.args ?? [], values)
    }
}

function evalCall(name: string, args: Node[], values: Record<string, number>): number {
    const evalArg = (i: number) => evalNode(args[i], values)
    const evalAll = () => args.map((a) => evalNode(a, values))

    switch (name) {
        case 'SUM':
            return evalAll().reduce((a, b) => a + b, 0)
        case 'NPV': {
            const rate = evalArg(0)
            const flows = args.slice(1).map((a) => evalNode(a, values))
            return calcNpv(rate, flows)
        }
        case 'IRR':
            return calcIrr(evalAll())
        case 'FV': {
            const [rate, nper, pmt, pv] = [0, 1, 2, 3].map(evalArg)
            const beginning = args[4] ? evalArg(4) !== 0 : false
            return calcFv(rate, nper, pmt, pv, beginning)
        }
        case 'PV': {
            const [rate, nper, pmt, fv] = [0, 1, 2, 3].map(evalArg)
            const beginning = args[4] ? evalArg(4) !== 0 : false
            return calcPv(rate, nper, pmt, fv, beginning)
        }
        case 'PMT': {
            const rate = evalArg(0)
            const nper = Math.floor(evalArg(1))
            const pv = evalArg(2)
            const fv = args[3] ? evalArg(3) : 0
            const beginning = args[4] ? evalArg(4) !== 0 : false
            return calcPmt(rate, nper, pv, fv, beginning)
        }
        case 'SLN': {
            const [cost, salvage, life] = [evalArg(0), evalArg(1), Math.floor(evalArg(2))]
            return (cost - salvage) / life
        }
        case 'ABS':
            return Math.abs(evalArg(0))
        case '+':
            return evalAll().reduce((a, b) => a + b, 0)
        case '-':
            return args.length === 1 ? -evalArg(0) : evalArg(0) - evalArg(1)
        case '*':
            return evalAll().reduce((a, b) => a * b, 1)
        case '/':
            return evalArg(0) / evalArg(1)
        default:
            return 0
    }
}

// Pure financial math helpers.

function calcNpv(rate: number, values: number[]): number {
    if (rate === 0) return values.reduce((a, b) => a + b, 0)
    return values.reduce((sum, v, i) => sum + v / Math.pow(1 + rate, i + 1), 0)
}

function calcIrr(values: number[]): number {
    const hasPositive = values.some((v) => v > 0)
    const hasNegative = values.some((v) => v < 0)
    if (values.length < 2 || !hasPositive || !hasNegative) return NaN
    return newton((x) => calcNpv(x, values), 0)
}

function calcFv(rate: number, nper: number, pmt: number, pv: number, beginning: boolean): number {
    if (rate === 0) return -(pv + pmt * nper)
    const f = Math.pow(1 + rate, nper)
    const pmtAtBeginning = beginning ? 1 : 0
    return -pv * f - (pmt * (1 + rate * pmtAtBeginning)) / rate * (f - 1)
}

function calcPv(rate: number, nper: number, pmt: number, fv: number, beginning: boolean): number {
    if (rate === 0) return -(fv + pmt * nper)
    const pmtAtBeginning = beginning ? 1 : 0
    const temp = Math.pow(1 + rate, nper)
    const factor = (1 + rate * pmtAtBeginning) * ((temp - 1) / rate)
    return -(fv + pmt * factor) / temp
}

function calcPmt(rate: number, nper: number, pv: number, fv: number, beginning: boolean): number {
    if (nper === 0) return 0
    if (rate === 0) return -(fv + pv) / nper
    const pvif = Math.pow(1 + rate, nper)
    const pmt = (rate / (pvif - 1)) * -(pv * pvif + fv)
    return beginning ? pmt / (1 + rate) : pmt
}

function newton(f: (x: number) => number, x: number): number {
    const precision = 1e-7
    const maxIter = 1000
    const df = (xv: number) => (f(xv + precision) - f(xv - precision)) / (2 * precision)
    for (let i = 0; i < maxIter; i++) {
        const fx = f(x)
        const dfx = df(x)
        if (dfx === 0) return NaN
        const nx = x - fx / dfx
        if (Math.abs(fx) <= precision || Math.abs(nx - x) <= precision) return nx
        x = nx
    }
    return NaN
}
