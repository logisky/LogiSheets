//! Stores the workbook's differential formats (`<dxfs>` in `styles.xml`).
//!
//! Unlike the sibling style managers this one deliberately does NOT dedupe or
//! re-mint ids: a `dxfId` is a *position* in the `<dxfs>` array, and the parts
//! that reference one — conditional formatting rules and table styles, both
//! currently preserved verbatim — carry those positions unchanged through
//! open→save. Renumbering would dangle every reference, so the list is kept in
//! load order and re-emitted as-is.

use imbl::Vector;
use logisheets_workbook::prelude::{CtDxf, CtDxfs, StDxfId};

use super::RawStyle;

#[derive(Debug, Clone, Default)]
pub struct DxfManager {
    dxfs: Vector<CtDxf>,
}

impl DxfManager {
    /// Capture `<dxfs>` as loaded. `None` (no `<dxfs>` element) yields an empty
    /// manager, which saves back as `None` rather than an empty element.
    pub fn from_ct_dxfs(part: Option<&CtDxfs>) -> Self {
        let dxfs = match part {
            Some(p) => p.dxfs.iter().cloned().collect(),
            None => Vector::new(),
        };
        DxfManager { dxfs }
    }

    /// The differential format a `dxfId` refers to, or `None` when the id is
    /// out of range (a dangling reference in the source file).
    pub fn get(&self, id: StDxfId) -> Option<&CtDxf> {
        self.dxfs.get(id as usize)
    }

    pub fn len(&self) -> usize {
        self.dxfs.len()
    }

    pub fn is_empty(&self) -> bool {
        self.dxfs.is_empty()
    }

    /// Append a differential format and return its `dxfId`.
    ///
    /// Append-only, and deliberately not deduplicated: a `dxfId` is a position,
    /// so reusing a slot for a "matching" format would silently repoint every
    /// other rule that shares it. Two rules with identical formats therefore get
    /// two dxfs, which costs a few bytes and keeps edits independent.
    pub fn intern(&mut self, dxf: CtDxf) -> StDxfId {
        self.dxfs.push_back(dxf);
        (self.dxfs.len() - 1) as StDxfId
    }

    /// Overwrite the format at `id`, for a rule whose appearance changed. Keeps
    /// the id stable so nothing else has to be rewritten, and avoids growing the
    /// list every time a rule is edited. No-op (returns `false`) if `id` is out
    /// of range.
    pub fn replace(&mut self, id: StDxfId, dxf: CtDxf) -> bool {
        let idx = id as usize;
        if idx >= self.dxfs.len() {
            return false;
        }
        self.dxfs.set(idx, dxf);
        true
    }

    /// Re-emit the list for `styles.xml`, preserving order so every retained
    /// `dxfId` still resolves. Empty ⇒ `None` (omit the element entirely).
    pub fn to_ct_dxfs(&self) -> Option<CtDxfs> {
        if self.dxfs.is_empty() {
            return None;
        }
        Some(CtDxfs {
            count: self.dxfs.len() as u32,
            dxfs: self.dxfs.iter().cloned().collect(),
        })
    }
}

/// Merge a differential format onto a base style — what Excel does when a
/// conditional-formatting rule matches a cell.
///
/// A dxf is a *partial* style: it carries only the properties the rule
/// overrides, and everything else shows through from the cell's own style. So
/// this merges per property, not per element — a dxf that sets only a font
/// colour must not reset the cell's font size.
///
/// Known deviation: `CtFont`'s boolean properties (bold, italic, strike, ...)
/// are modeled as plain `bool` (xmlserde `sfc`), so "absent" and "explicitly
/// off" are indistinguishable. They are therefore OR-ed in: a rule can turn
/// bold *on* but cannot turn it off. Real-world dxfs add emphasis rather than
/// removing it, so this is the safe reading; the proper fix is `Option<bool>`
/// on `CtFont`, which ripples through the whole style path.
pub fn apply_dxf(mut base: RawStyle, dxf: &CtDxf) -> RawStyle {
    if let Some(f) = &dxf.font {
        let b = &mut base.font;
        // Booleans: additive only — see the deviation note above.
        b.bold |= f.bold;
        b.italic |= f.italic;
        b.strike |= f.strike;
        b.outline |= f.outline;
        b.shadow |= f.shadow;
        b.condense |= f.condense;
        b.extend |= f.extend;
        // Everything optional overrides only when the dxf specifies it.
        if f.underline.is_some() {
            b.underline = f.underline.clone();
        }
        if f.color.is_some() {
            b.color = f.color.clone();
        }
        if f.sz.is_some() {
            b.sz = f.sz.clone();
        }
        if f.name.is_some() {
            b.name = f.name.clone();
        }
        if f.charset.is_some() {
            b.charset = f.charset.clone();
        }
        if f.family.is_some() {
            b.family = f.family.clone();
        }
        if f.vert_align.is_some() {
            b.vert_align = f.vert_align.clone();
        }
        if f.scheme.is_some() {
            b.scheme = f.scheme.clone();
        }
    }
    // A dxf fill is authored as a complete fill (CF highlight fills always are),
    // so it replaces rather than merges.
    if let Some(fill) = &dxf.fill {
        base.fill = fill.clone();
    }
    // Borders merge per side: a rule adding a bottom border keeps the others.
    if let Some(bd) = &dxf.border {
        let b = &mut base.border;
        if bd.left.is_some() {
            b.left = bd.left.clone();
        }
        if bd.right.is_some() {
            b.right = bd.right.clone();
        }
        if bd.top.is_some() {
            b.top = bd.top.clone();
        }
        if bd.bottom.is_some() {
            b.bottom = bd.bottom.clone();
        }
        if bd.diagonal.is_some() {
            b.diagonal = bd.diagonal.clone();
        }
        if bd.vertical.is_some() {
            b.vertical = bd.vertical.clone();
        }
        if bd.horizontal.is_some() {
            b.horizontal = bd.horizontal.clone();
        }
    }
    if let Some(a) = &dxf.alignment {
        base.alignment = Some(a.clone());
    }
    if let Some(p) = &dxf.protection {
        base.protection = Some(p.clone());
    }
    if let Some(nf) = &dxf.num_fmt {
        base.formatter = nf.format_code.clone();
    }
    base
}
