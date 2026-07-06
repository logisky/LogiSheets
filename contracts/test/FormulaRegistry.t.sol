// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {FormulaRegistry} from "../src/FormulaRegistry.sol";

contract FormulaRegistryTest is Test {
    FormulaRegistry registry;
    uint256 constant FUND = 1;
    bytes32 constant FORMULA_ID = keccak256("Quarterly_ROI");
    bytes32 constant COMMITMENT = keccak256("expression");
    bytes32 constant ROOT = keccak256("root");

    function setUp() public {
        registry = new FormulaRegistry();
    }

    function testRegisterFormula() public {
        registry.registerFormula(FUND, FORMULA_ID, COMMITMENT, ROOT);
        assertEq(registry.formulaRoots(FUND), ROOT);
        assertTrue(registry.formulas(FUND, FORMULA_ID).exists);
    }

    function testCannotRegisterDuplicate() public {
        registry.registerFormula(FUND, FORMULA_ID, COMMITMENT, ROOT);
        vm.expectRevert("Formula already exists");
        registry.registerFormula(FUND, FORMULA_ID, COMMITMENT, ROOT);
    }

    function testUpdateFormula() public {
        registry.registerFormula(FUND, FORMULA_ID, COMMITMENT, ROOT);
        bytes32 newRoot = keccak256("new_root");
        bytes32 newCommitment = keccak256("new_expression");
        registry.updateFormula(FUND, FORMULA_ID, newCommitment, newRoot);
        assertEq(registry.formulas(FUND, FORMULA_ID).version, 2);
        assertEq(registry.formulaRoots(FUND), newRoot);
    }

    function testDeleteFormula() public {
        registry.registerFormula(FUND, FORMULA_ID, COMMITMENT, ROOT);
        bytes32 newRoot = keccak256("deleted_root");
        registry.deleteFormula(FUND, FORMULA_ID, newRoot);
        assertFalse(registry.formulas(FUND, FORMULA_ID).exists);
        assertEq(registry.formulaRoots(FUND), newRoot);
    }
}
