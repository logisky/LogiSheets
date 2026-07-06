/**
 * Contract ABIs for LogiSheets ZK on-chain integration.
 *
 * These ABIs can be used with viem, ethers, or any EVM-compatible library.
 */

export const FORMULA_REGISTRY_ABI = [
    {
        type: 'function',
        name: 'registerFormula',
        inputs: [
            {name: 'fundId', type: 'uint256'},
            {name: 'formulaId', type: 'bytes32'},
            {name: 'commitment', type: 'bytes32'},
            {name: 'newRoot', type: 'bytes32'},
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'updateFormula',
        inputs: [
            {name: 'fundId', type: 'uint256'},
            {name: 'formulaId', type: 'bytes32'},
            {name: 'newCommitment', type: 'bytes32'},
            {name: 'newRoot', type: 'bytes32'},
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'deleteFormula',
        inputs: [
            {name: 'fundId', type: 'uint256'},
            {name: 'formulaId', type: 'bytes32'},
            {name: 'newRoot', type: 'bytes32'},
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'getFormulaRoot',
        inputs: [{name: 'fundId', type: 'uint256'}],
        outputs: [{name: '', type: 'bytes32'}],
        stateMutability: 'view',
    },
    {
        type: 'event',
        name: 'FormulaRegistered',
        inputs: [
            {name: 'fundId', type: 'uint256', indexed: true},
            {name: 'formulaId', type: 'bytes32', indexed: true},
            {name: 'commitment', type: 'bytes32'},
            {name: 'version', type: 'uint64'},
            {name: 'newRoot', type: 'bytes32'},
        ],
    },
] as const

export const QUARTERLY_REPORT_ABI = [
    {
        type: 'function',
        name: 'submitReport',
        inputs: [
            {name: 'fundId', type: 'uint256'},
            {name: 'quarterId', type: 'uint256'},
            {name: 'seal', type: 'bytes'},
            {name: 'postStateDigest', type: 'bytes32'},
            {name: 'journal', type: 'bytes'},
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'getOutput',
        inputs: [
            {name: 'fundId', type: 'uint256'},
            {name: 'quarterId', type: 'uint256'},
            {name: 'key', type: 'string'},
        ],
        outputs: [{name: '', type: 'int256'}],
        stateMutability: 'view',
    },
    {
        type: 'event',
        name: 'ReportSubmitted',
        inputs: [
            {name: 'fundId', type: 'uint256', indexed: true},
            {name: 'quarterId', type: 'uint256', indexed: true},
            {name: 'formulaRoot', type: 'bytes32'},
            {name: 'outputKeys', type: 'string[]'},
            {name: 'outputValues', type: 'int256[]'},
        ],
    },
] as const
