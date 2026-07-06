// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FormulaRegistry
/// @notice On-chain registry for formula commitments using Sparse Merkle Tree roots.
contract FormulaRegistry {
    /// @notice fundId => current SMT root
    mapping(uint256 => bytes32) public formulaRoots;

    /// @notice fundId => formulaId => formula metadata
    mapping(uint256 => mapping(bytes32 => FormulaData)) public formulas;

    /// @notice fundId => list of registered formula IDs (for enumeration)
    mapping(uint256 => bytes32[]) public formulaIdList;

    struct FormulaData {
        bytes32 commitment;
        uint64 version;
        uint64 updatedAt;
        bool exists;
    }

    event FormulaRegistered(
        uint256 indexed fundId,
        bytes32 indexed formulaId,
        bytes32 commitment,
        uint64 version,
        bytes32 newRoot
    );

    event FormulaUpdated(
        uint256 indexed fundId,
        bytes32 indexed formulaId,
        bytes32 newCommitment,
        uint64 newVersion,
        bytes32 newRoot
    );

    event FormulaDeleted(
        uint256 indexed fundId,
        bytes32 indexed formulaId,
        bytes32 newRoot
    );

    /// @notice Register a new formula for a fund. Only callable by the fund owner (access control omitted for skeleton).
    function registerFormula(
        uint256 fundId,
        bytes32 formulaId,
        bytes32 commitment,
        bytes32 newRoot
    ) external {
        require(!formulas[fundId][formulaId].exists, "Formula already exists");

        formulas[fundId][formulaId] = FormulaData({
            commitment: commitment,
            version: 1,
            updatedAt: uint64(block.timestamp),
            exists: true
        });
        formulaIdList[fundId].push(formulaId);
        formulaRoots[fundId] = newRoot;

        emit FormulaRegistered(fundId, formulaId, commitment, 1, newRoot);
    }

    /// @notice Update an existing formula. Version is incremented.
    function updateFormula(
        uint256 fundId,
        bytes32 formulaId,
        bytes32 newCommitment,
        bytes32 newRoot
    ) external {
        FormulaData storage f = formulas[fundId][formulaId];
        require(f.exists, "Formula not found");

        f.commitment = newCommitment;
        f.version++;
        f.updatedAt = uint64(block.timestamp);
        formulaRoots[fundId] = newRoot;

        emit FormulaUpdated(fundId, formulaId, newCommitment, f.version, newRoot);
    }

    /// @notice Delete a formula (sets its leaf to empty in the SMT).
    function deleteFormula(
        uint256 fundId,
        bytes32 formulaId,
        bytes32 newRoot
    ) external {
        require(formulas[fundId][formulaId].exists, "Formula not found");

        delete formulas[fundId][formulaId];
        formulaRoots[fundId] = newRoot;

        emit FormulaDeleted(fundId, formulaId, newRoot);
    }

    /// @notice Get the current formula root for a fund.
    function getFormulaRoot(uint256 fundId) external view returns (bytes32) {
        return formulaRoots[fundId];
    }
}
