// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {FormulaRegistry} from "../src/FormulaRegistry.sol";
import {QuarterlyReport} from "../src/QuarterlyReport.sol";

/// @notice Deployment script for LogiSheets ZK contracts.
/// Set RISCZERO_VERIFIER and RISCZERO_IMAGE_ID environment variables before running.
contract Deploy is Script {
    function run() external {
        address verifier = vm.envAddress("RISCZERO_VERIFIER");
        bytes32 imageId = vm.envBytes32("RISCZERO_IMAGE_ID");

        vm.startBroadcast();

        FormulaRegistry formulaRegistry = new FormulaRegistry();
        QuarterlyReport quarterlyReport = new QuarterlyReport(verifier, imageId, address(formulaRegistry));

        vm.stopBroadcast();

        console.log("FormulaRegistry deployed at:", address(formulaRegistry));
        console.log("QuarterlyReport deployed at:", address(quarterlyReport));
    }
}
