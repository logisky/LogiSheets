// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FormulaRegistry} from "./FormulaRegistry.sol";

/// @notice Verifier interface for RiscZero Groth16 receipts.
/// In production this is provided by the RiscZero verifier contract deployment.
interface IRiscZeroVerifier {
    function verify(
        bytes calldata seal,
        bytes32 imageId,
        bytes32 postStateDigest,
        bytes32 journalDigest
    ) external view returns (bool);
}

/// @title QuarterlyReport
/// @notice Accepts ZK proofs of quarterly financial computations and stores verified results.
contract QuarterlyReport {
    struct ReportResult {
        uint256 fundId;
        uint256 quarterId;
        bytes32 formulaRoot;
        uint64 timestamp;
        bool verified;
        mapping(string => int256) outputs;
    }

    /// @notice fundId => quarterId => report
    mapping(uint256 => mapping(uint256 => ReportResult)) public reports;

    /// @notice fundId => quarterId => exists
    mapping(uint256 => mapping(uint256 => bool)) public reportExists;

    IRiscZeroVerifier public verifier;
    bytes32 public imageId;
    FormulaRegistry public formulaRegistry;

    event ReportSubmitted(
        uint256 indexed fundId,
        uint256 indexed quarterId,
        bytes32 formulaRoot,
        string[] outputKeys,
        int256[] outputValues
    );

    constructor(address _verifier, bytes32 _imageId, address _formulaRegistry) {
        verifier = IRiscZeroVerifier(_verifier);
        imageId = _imageId;
        formulaRegistry = FormulaRegistry(_formulaRegistry);
    }

    /// @notice Submit a quarterly report with a ZK proof.
    function submitReport(
        uint256 fundId,
        uint256 quarterId,
        bytes calldata seal,
        bytes32 postStateDigest,
        bytes calldata journal
    ) external {
        require(!reportExists[fundId][quarterId], "Report already submitted");

        // Decode journal: formula_root + output KV pairs.
        (bytes32 reportedRoot, string[] memory keys, int256[] memory values) =
            abi.decode(journal, (bytes32, string[], int256[]));

        require(keys.length == values.length, "Mismatched output arrays");
        require(reportedRoot == formulaRegistry.getFormulaRoot(fundId), "Formula root mismatch");

        // Verify the ZK proof.
        bytes32 journalDigest = sha256(journal);
        require(
            verifier.verify(seal, imageId, postStateDigest, journalDigest),
            "ZK proof verification failed"
        );

        // Store the verified report.
        ReportResult storage report = reports[fundId][quarterId];
        report.fundId = fundId;
        report.quarterId = quarterId;
        report.formulaRoot = reportedRoot;
        report.timestamp = uint64(block.timestamp);
        report.verified = true;

        for (uint256 i = 0; i < keys.length; i++) {
            report.outputs[keys[i]] = values[i];
        }

        reportExists[fundId][quarterId] = true;

        emit ReportSubmitted(fundId, quarterId, reportedRoot, keys, values);
    }

    /// @notice Read a verified output value for a fund/quarter.
    function getOutput(
        uint256 fundId,
        uint256 quarterId,
        string calldata key
    ) external view returns (int256) {
        require(reportExists[fundId][quarterId], "Report does not exist");
        return reports[fundId][quarterId].outputs[key];
    }
}
