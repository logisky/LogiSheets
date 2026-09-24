//! The three defined-name payloads: `DefineName`, `RenameName`, `RemoveName`.
//!
//! A name is workbook-scoped and lives in two places: its id in the
//! `NameIdManager` (which formulas hold, so a rename reaches them for free) and
//! its parsed definition in `FormulaManager::names` (which the calc engine
//! evaluates wherever the name is used). Each handler returns the vertex to
//! dirty, so the formulas using the name recalculate in the same transaction.

use logisheets_base::{ExtBookId, NameId, errors::BasicError, id_fetcher::IdFetcherTrait};
use logisheets_parser::Parser;

use crate::{
    Error,
    connectors::FormulaConnector,
    edit_action::{DefineName, RemoveName, RenameName},
    formula_manager::Vertex,
    sid_assigner::ShadowIdAssigner,
};

use super::status::Status;

/// Local names only; a name from an external book is never defined here.
const LOCAL_BOOK: ExtBookId = 0;

pub(super) fn define_name(
    status: &mut Status,
    book_name: &str,
    sid_assigner: &mut ShadowIdAssigner,
    p: DefineName,
) -> Result<Vertex, Error> {
    let name = p.name.trim();
    if !is_valid_name(name) {
        return Err(BasicError::InvalidDefinedName(name.to_string()).into());
    }
    let formula = p.formula.trim();
    let formula = formula.strip_prefix('=').unwrap_or(formula).trim();
    if formula.is_empty() {
        return Err(BasicError::InvalidFormula(p.formula.clone()).into());
    }
    let sheet_id = status
        .sheet_info_manager
        .get_sheet_id(p.sheet_idx)
        .ok_or(BasicError::SheetIdxExceed(p.sheet_idx))?;

    let navigator = status.navigator.clone();
    let mut ctx = FormulaConnector {
        book_name,
        sheet_pos_manager: &mut status.sheet_info_manager,
        sheet_id_manager: &mut status.sheet_id_manager,
        text_id_manager: &mut status.text_id_manager,
        func_id_manager: &mut status.func_id_manager,
        range_manager: &mut status.range_manager,
        cube_manager: &mut status.cube_manager,
        ext_ref_manager: &mut status.ext_ref_manager,
        name_id_manager: &mut status.name_id_manager,
        id_navigator: &mut status.navigator,
        idx_navigator: &navigator,
        external_links_manager: &mut status.external_links_manager,
        block_schema_manager: &status.block_schema_manager,
        enum_set_manager: &status.enum_set_manager,
        container: &status.container,
        sid_assigner,
    };
    let ast = Parser {}
        .parse(formula, sheet_id, &mut ctx)
        .ok_or_else(|| BasicError::InvalidFormula(formula.to_string()))?;
    let id = ctx.fetch_name_id(&None, name);
    if status.formula_manager.name_reaches(&ast, id) {
        return Err(BasicError::DefinedNameCycle(name.to_string()).into());
    }
    ctx.name_id_manager.set_display(id, name);
    status.formula_manager.set_name(id, ast, &ctx);
    Ok(Vertex::Name(id))
}

pub(super) fn rename_name(status: &mut Status, p: RenameName) -> Result<Vertex, Error> {
    let old_name = p.old_name.trim();
    let new_name = p.new_name.trim();
    let id = defined_id(status, old_name)?;
    if !is_valid_name(new_name) {
        return Err(BasicError::InvalidDefinedName(new_name.to_string()).into());
    }
    match status.name_id_manager.find_id(LOCAL_BOOK, new_name) {
        // Same name up to case: only the spelling changes.
        Some(existing) if existing == id => status.name_id_manager.set_display(id, new_name),
        Some(existing) if status.formula_manager.names.contains_key(&existing) => {
            return Err(BasicError::DefinedNameAlreadyExists(new_name.to_string()).into());
        }
        _ => status
            .name_id_manager
            .rename(id, LOCAL_BOOK, old_name, new_name),
    }
    Ok(Vertex::Name(id))
}

pub(super) fn remove_name(status: &mut Status, p: RemoveName) -> Result<Vertex, Error> {
    let id = defined_id(status, p.name.trim())?;
    status.formula_manager.remove_name(id);
    Ok(Vertex::Name(id))
}

fn defined_id(status: &Status, name: &str) -> Result<NameId, Error> {
    status
        .name_id_manager
        .find_id(LOCAL_BOOK, name)
        .filter(|id| status.formula_manager.names.contains_key(id))
        .ok_or_else(|| BasicError::DefinedNameNotFound(name.to_string()).into())
}

/// What the formula grammar reads as a name and nothing else: a letter, `_`
/// or `\` first, then letters, digits, `_` and `.` — and not something that
/// would lex as a cell reference or a boolean first (`A1`, `XFD100`, `R1C1`,
/// `R`, `C`, `TRUE`).
pub(crate) fn is_valid_name(name: &str) -> bool {
    let mut chars = name.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !(first.is_alphabetic() || first == '_' || first == '\\') {
        return false;
    }
    if !chars.all(|c| c.is_alphabetic() || c.is_ascii_digit() || c == '_' || c == '.') {
        return false;
    }
    let upper = name.to_uppercase();
    if upper == "TRUE" || upper == "FALSE" || upper == "R" || upper == "C" {
        return false;
    }
    !(looks_like_a1(&upper) || looks_like_r1c1(&upper))
}

fn looks_like_a1(s: &str) -> bool {
    let letters = s.chars().take_while(|c| c.is_ascii_uppercase()).count();
    let rest = &s[letters..];
    (1..=3).contains(&letters) && !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit())
}

fn looks_like_r1c1(s: &str) -> bool {
    let Some(rest) = s.strip_prefix('R') else {
        return false;
    };
    let digits = rest.chars().take_while(|c| c.is_ascii_digit()).count();
    let Some(col) = rest[digits..].strip_prefix('C') else {
        return false;
    };
    col.chars().all(|c| c.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::is_valid_name;

    #[test]
    fn valid_names() {
        for n in [
            "TaxRate",
            "_x",
            "\\costs",
            "Sales.2024",
            "ABCD1",
            "A1B",
            "Café",
        ] {
            assert!(is_valid_name(n), "{n}");
        }
        for n in [
            "", "1abc", "A1", "xfd100", "R1C1", "RC", "R", "c", "TRUE", "a b", "a-b",
        ] {
            assert!(!is_valid_name(n), "{n}");
        }
    }
}
