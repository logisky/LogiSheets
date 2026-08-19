//! Models Excel conditional formatting (`<conditionalFormatting>`).
//!
//! The point of modeling it rather than keeping the raw XML (which is what
//! `PreservedWorksheetParts` did) is the `sqref`: stored as an A1 string it goes
//! stale the moment a row is inserted, while Excel shifts the covered range.
//! So each `sqref` rectangle is resolved at load into the engine's stable ids
//! ([`CfRange`]) and rendered back to A1 at save — positions are derived from
//! the navigator on demand, which is what makes insert/delete track for free.
//!
//! Rule *bodies* are still the parsed OOXML type ([`CtCfRule`]), so every
//! attribute (dxfId, priority, stopIfTrue, colorScale stops, ...) round-trips
//! untouched. Their formula operands are plain strings for now: they are
//! anchored on the `sqref` top-left and shifted per cell at evaluation time,
//! which no consumer does yet.
//!
//! Nothing here evaluates or renders anything — this is the rule store.

pub(crate) mod a1_shift;
pub(crate) mod executor;
pub(crate) mod query;
pub(crate) mod spec;
pub(crate) mod translate;
// Navigator-dependent conversions; crate-internal (Navigator is not public).
pub(crate) mod resolve;

use imbl::{HashMap, Vector};
use logisheets_base::{CellId, ColId, RowId, SheetId};
use logisheets_workbook::prelude::CtCfRule;

/// One `sqref` rectangle, anchored on stable ids so it tracks row/column
/// insertion and deletion the way Excel does.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CfRange {
    /// A bounded rectangle, anchored on its two corner cells. Either corner may
    /// be a *block* cell — a rule can perfectly well cover a form block — so
    /// the corners are `CellId`, not `NormalCellId`, and the two corners need
    /// not be of the same kind (a rectangle can start on the sheet and end
    /// inside a block).
    Rect(CellId, CellId),
    /// Whole rows (`1:3`). Spans the full sheet width, blocks included.
    RowRange(RowId, RowId),
    /// Whole columns (`A:B`). Spans the full sheet height, blocks included.
    ColRange(ColId, ColId),
}

/// One rule, with a handle callers can name it by.
#[derive(Debug, Clone)]
pub struct CfRule {
    /// Stable within a session: minted on load and on create, and preserved by
    /// an update. NOT persisted — OOXML has no rule identity, so ids are
    /// re-minted on the next load and must not be stored by callers across a
    /// save/reload cycle.
    pub id: u32,
    pub rule: CtCfRule,
}

/// One `<conditionalFormatting>` element: the ranges it covers plus the rules
/// that apply to them.
#[derive(Debug, Clone)]
pub struct CfBlock {
    pub ranges: Vector<CfRange>,
    pub rules: Vector<CfRule>,
    pub pivot: bool,
}

#[derive(Debug, Clone, Default)]
pub struct ConditionalFormattingManager {
    /// Per-sheet `<conditionalFormatting>` elements, in file order. Order is
    /// not significant to Excel (rules carry an explicit `priority`) but it is
    /// preserved anyway to keep save output stable.
    pub data: HashMap<SheetId, Vector<CfBlock>>,
    /// Source of [`CfRule::id`]. Workbook-scoped so an id names a rule
    /// unambiguously without also carrying its sheet.
    next_rule_id: u32,
}

impl ConditionalFormattingManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_sheet(&mut self, sheet_id: SheetId, blocks: Vector<CfBlock>) {
        if blocks.is_empty() {
            self.data.remove(&sheet_id);
        } else {
            self.data.insert(sheet_id, blocks);
        }
    }

    pub fn get_sheet(&self, sheet_id: SheetId) -> Option<&Vector<CfBlock>> {
        self.data.get(&sheet_id)
    }

    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// Mint a fresh rule id.
    pub fn mint_rule_id(&mut self) -> u32 {
        let id = self.next_rule_id;
        self.next_rule_id += 1;
        id
    }

    /// The highest `priority` in use on a sheet. New rules go one past it, so
    /// they apply last — matching what Excel does when you add a rule.
    pub fn max_priority(&self, sheet_id: SheetId) -> i32 {
        self.data
            .get(&sheet_id)
            .map(|blocks| {
                blocks
                    .iter()
                    .flat_map(|b| b.rules.iter())
                    .map(|r| r.rule.priority)
                    .max()
                    .unwrap_or(0)
            })
            .unwrap_or(0)
    }

    /// Add a rule as its own `<conditionalFormatting>` element covering
    /// `ranges`. Returns the new rule's id.
    ///
    /// A separate element per rule rather than merging into an existing one with
    /// the same ranges: Excel accepts either, and keeping them separate means a
    /// later delete never has to split an element apart.
    pub fn add_rule(&mut self, sheet_id: SheetId, ranges: Vector<CfRange>, rule: CtCfRule) -> u32 {
        let id = self.mint_rule_id();
        let block = CfBlock {
            ranges,
            rules: Vector::from_iter([CfRule { id, rule }]),
            pivot: false,
        };
        let mut blocks = self.data.get(&sheet_id).cloned().unwrap_or_default();
        blocks.push_back(block);
        self.data.insert(sheet_id, blocks);
        id
    }

    /// Drop the rule with `id`. Elements left with no rules are removed, and a
    /// sheet left with no elements drops out of the map entirely so `is_empty`
    /// stays meaningful. Returns whether anything changed.
    pub fn remove_rule(&mut self, id: u32) -> bool {
        let mut touched = None;
        for (sheet_id, blocks) in self.data.iter() {
            if blocks.iter().any(|b| b.rules.iter().any(|r| r.id == id)) {
                touched = Some(*sheet_id);
                break;
            }
        }
        let Some(sheet_id) = touched else {
            return false;
        };
        let blocks = self.data.get(&sheet_id).cloned().unwrap_or_default();
        let kept: Vector<CfBlock> = blocks
            .into_iter()
            .filter_map(|mut b| {
                b.rules = b.rules.into_iter().filter(|r| r.id != id).collect();
                if b.rules.is_empty() { None } else { Some(b) }
            })
            .collect();
        self.set_sheet(sheet_id, kept);
        true
    }

    /// Swap in a new body for the rule with `id`, keeping its id and the ranges
    /// of the element it lives in. Returns whether the rule was found.
    pub fn replace_rule(&mut self, id: u32, rule: CtCfRule) -> bool {
        for (sheet_id, blocks) in self.data.clone().iter() {
            if !blocks.iter().any(|b| b.rules.iter().any(|r| r.id == id)) {
                continue;
            }
            let updated: Vector<CfBlock> = blocks
                .iter()
                .cloned()
                .map(|mut b| {
                    b.rules = b
                        .rules
                        .into_iter()
                        .map(|r| {
                            if r.id == id {
                                CfRule {
                                    id,
                                    rule: rule.clone(),
                                }
                            } else {
                                r
                            }
                        })
                        .collect();
                    b
                })
                .collect();
            self.data.insert(*sheet_id, updated);
            return true;
        }
        false
    }

    /// Replace the ranges of the element owning `id`. Returns whether found.
    pub fn set_rule_ranges(&mut self, id: u32, ranges: Vector<CfRange>) -> bool {
        for (sheet_id, blocks) in self.data.clone().iter() {
            if !blocks.iter().any(|b| b.rules.iter().any(|r| r.id == id)) {
                continue;
            }
            let updated: Vector<CfBlock> = blocks
                .iter()
                .cloned()
                .map(|mut b| {
                    if b.rules.iter().any(|r| r.id == id) {
                        b.ranges = ranges.clone();
                    }
                    b
                })
                .collect();
            self.data.insert(*sheet_id, updated);
            return true;
        }
        false
    }
}
