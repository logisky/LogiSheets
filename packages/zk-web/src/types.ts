/**
 * Shared TypeScript types for LogiSheets ZK quarterly reports.
 */

export interface Formula {
    id: Uint8Array // 32 bytes
    name: string
    expression: string
    version: number
}

export interface FormulaWithProof {
    formula: Formula
    proof: MerkleProof
}

export interface MerkleProof {
    siblings: Uint8Array[] // 256 siblings
}

export interface OutputDef {
    name: string
}

export interface PublicInputs {
    formulaRoot: Uint8Array
    values: Record<string, number>
    expectedOutputs: OutputDef[]
}

export interface PrivateInputs {
    formulasWithProofs: FormulaWithProof[]
    values: Record<string, number>
}

export interface ProverInput {
    public: PublicInputs
    private: PrivateInputs
}

export interface QuarterlyReport {
    fundId: number
    quarterId: number
    formulaRoot: Uint8Array
    outputs: Record<string, number>
}

export interface ZkProof {
    seal: Uint8Array
    postStateDigest: Uint8Array
    journal: Uint8Array
    publicOutputs: Record<string, number>
}
