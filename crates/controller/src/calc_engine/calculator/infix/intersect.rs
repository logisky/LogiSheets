use super::super::calc_vertex::{CalcReference, CalcVertex, ColRange, Reference, RowRange};
use logisheets_base::Addr as Address;
use logisheets_parser::ast;

pub fn intersect(lhs: CalcVertex, rhs: CalcVertex) -> CalcVertex {
    match (lhs, rhs) {
        (CalcVertex::Reference(lhs_ref), CalcVertex::Reference(rhs_ref)) => {
            let lhs_prefix = lhs_ref.sheet;
            let rhs_prefix = rhs_ref.sheet;
            if lhs_prefix != rhs_prefix {
                return CalcVertex::from_error(ast::Error::Null);
            }
            let result = intersect_without_prefix(lhs_ref.reference, rhs_ref.reference);
            match result {
                Some(r) => CalcVertex::Reference(CalcReference {
                    from_sheet: None,
                    sheet: lhs_prefix,
                    reference: r,
                }),
                None => CalcVertex::from_error(ast::Error::Null),
            }
        }
        _ => CalcVertex::from_error(ast::Error::Null),
    }
}

fn intersect_without_prefix(l_ref: Reference, r_ref: Reference) -> Option<Reference> {
    match (l_ref, r_ref) {
        (Reference::Addr(la), Reference::Addr(ra)) => intersect_addresses(la, ra),
        (Reference::Addr(addr), Reference::ColumnRange(cr)) => {
            intersect_addr_and_col_range(addr, cr)
        }
        (Reference::Addr(addr), Reference::RowRange(rr)) => intersect_addr_and_row_range(addr, rr),
        (Reference::Addr(addr), Reference::Range(start, end)) => {
            intersect_addr_and_range(addr, start, end)
        }
        (Reference::ColumnRange(cr), Reference::Addr(addr)) => {
            intersect_addr_and_col_range(addr, cr)
        }
        (Reference::ColumnRange(lcr), Reference::ColumnRange(rcr)) => {
            intersect_col_ranges(lcr, rcr)
        }
        (Reference::ColumnRange(cr), Reference::RowRange(rr)) => {
            intersect_col_range_and_row_range(cr, rr)
        }
        (Reference::ColumnRange(cr), Reference::Range(start, end)) => {
            intersect_range_and_col_range(start, end, cr)
        }
        (Reference::RowRange(rr), Reference::Addr(addr)) => intersect_addr_and_row_range(addr, rr),
        (Reference::RowRange(rr), Reference::ColumnRange(cr)) => {
            intersect_col_range_and_row_range(cr, rr)
        }
        (Reference::RowRange(lrr), Reference::RowRange(rrr)) => intersect_row_ranges(lrr, rrr),
        (Reference::RowRange(rr), Reference::Range(start, end)) => {
            intersect_range_and_row_range(start, end, rr)
        }
        (Reference::Range(start, end), Reference::Addr(addr)) => {
            intersect_addr_and_range(addr, start, end)
        }
        (Reference::Range(start, end), Reference::ColumnRange(cr)) => {
            intersect_range_and_col_range(start, end, cr)
        }
        (Reference::Range(start, end), Reference::RowRange(rr)) => {
            intersect_range_and_row_range(start, end, rr)
        }
        (Reference::Range(left_start, left_end), Reference::Range(right_start, right_end)) => {
            intersect_ranges(left_start, left_end, right_start, right_end)
        }
    }
}

fn intersect_addresses(la: Address, ra: Address) -> Option<Reference> {
    if la.row == ra.row && la.col == ra.col {
        Some(Reference::Addr(la))
    } else {
        None
    }
}

fn intersect_ranges(
    lr_start: Address,
    lr_end: Address,
    rr_start: Address,
    rr_end: Address,
) -> Option<Reference> {
    let (row_start, row_end) =
        intersect_intervals((lr_start.row, lr_end.row), (rr_start.row, rr_end.row))?;
    let (col_start, col_end) =
        intersect_intervals((lr_start.col, lr_end.col), (rr_start.col, rr_end.col))?;
    Some(Reference::Range(
        Address {
            row: row_start,
            col: col_start,
        },
        Address {
            row: row_end,
            col: col_end,
        },
    ))
}

fn intersect_col_ranges(lcr: ColRange, rcr: ColRange) -> Option<Reference> {
    let (start, end) = intersect_intervals((lcr.start, lcr.end), (rcr.start, rcr.end))?;
    Some(Reference::ColumnRange(ColRange { start, end }))
}

fn intersect_row_ranges(lrr: RowRange, rrr: RowRange) -> Option<Reference> {
    let (start, end) = intersect_intervals((lrr.start, lrr.end), (rrr.start, rrr.end))?;
    Some(Reference::RowRange(RowRange { start, end }))
}

fn intersect_addr_and_range(
    addr: Address,
    range_start: Address,
    range_end: Address,
) -> Option<Reference> {
    if point_in_interval(addr.row, (range_start.row, range_end.row))
        && point_in_interval(addr.col, (range_start.col, range_end.col))
    {
        Some(Reference::Addr(addr))
    } else {
        None
    }
}

fn intersect_addr_and_col_range(addr: Address, cr: ColRange) -> Option<Reference> {
    if point_in_interval(addr.col, (cr.start, cr.end)) {
        Some(Reference::Addr(addr))
    } else {
        None
    }
}

fn intersect_addr_and_row_range(addr: Address, rr: RowRange) -> Option<Reference> {
    if point_in_interval(addr.row, (rr.start, rr.end)) {
        Some(Reference::Addr(addr))
    } else {
        None
    }
}

fn intersect_range_and_col_range(
    range_start: Address,
    range_end: Address,
    cr: ColRange,
) -> Option<Reference> {
    let (col_start, col_end) =
        intersect_intervals((range_start.col, range_end.col), (cr.start, cr.end))?;
    Some(Reference::Range(
        Address {
            row: range_start.row,
            col: col_start,
        },
        Address {
            row: range_end.row,
            col: col_end,
        },
    ))
}

fn intersect_range_and_row_range(
    range_start: Address,
    range_end: Address,
    rr: RowRange,
) -> Option<Reference> {
    let (row_start, row_end) =
        intersect_intervals((range_start.row, range_end.row), (rr.start, rr.end))?;
    Some(Reference::Range(
        Address {
            row: row_start,
            col: range_start.col,
        },
        Address {
            col: range_end.col,
            row: row_end,
        },
    ))
}

fn intersect_col_range_and_row_range(cr: ColRange, rr: RowRange) -> Option<Reference> {
    Some(Reference::Range(
        Address {
            row: rr.start,
            col: cr.start,
        },
        Address {
            row: rr.end,
            col: cr.end,
        },
    ))
}

fn intersect_intervals(
    l_interval: (usize, usize),
    r_interval: (usize, usize),
) -> Option<(usize, usize)> {
    let ordered_l = order(l_interval);
    let ordered_r = order(r_interval);
    if ordered_l.0 >= ordered_r.0 && ordered_l.1 <= ordered_r.1 {
        Some(ordered_l)
    } else if ordered_r.0 >= ordered_l.0 && ordered_r.1 <= ordered_l.1 {
        Some(ordered_r)
    } else if ordered_l.0 <= ordered_r.0 && ordered_r.0 <= ordered_l.1 {
        Some((ordered_r.0, ordered_l.1))
    } else if ordered_l.0 <= ordered_r.1 && ordered_r.1 <= ordered_l.1 {
        Some((ordered_l.0, ordered_r.1))
    } else {
        None
    }
}

#[inline]
fn order(interval: (usize, usize)) -> (usize, usize) {
    if interval.0 < interval.1 {
        interval
    } else {
        (interval.1, interval.0)
    }
}

fn point_in_interval(p: usize, interval: (usize, usize)) -> bool {
    (interval.0 <= p && p <= interval.1) || (interval.1 <= p && p <= interval.0)
}

#[cfg(test)]
mod tests {
    use super::super::super::calc_vertex::{
        CalcReference, CalcValue, CalcVertex, ColRange, Reference, RowRange, Value,
    };
    use super::{intersect, intersect_without_prefix};
    use logisheets_base::Addr as Address;
    use logisheets_parser::ast;

    #[test]
    fn addr_test() {
        let addr = Reference::Addr(Address { row: 1, col: 1 });
        let r = intersect_without_prefix(addr.clone(), addr.clone());
        assert!(matches!(
            r,
            Some(Reference::Addr(Address { row: 1, col: 1 })),
        ));
        let r = intersect_without_prefix(
            Reference::Addr(Address { row: 1, col: 1 }),
            Reference::Addr(Address { row: 1, col: 2 }),
        );
        assert!(matches!(r, None));

        let addr = Reference::Addr(Address { row: 3, col: 3 });
        let r = intersect_without_prefix(
            addr.clone(),
            Reference::ColumnRange(ColRange { start: 2, end: 3 }),
        );
        assert!(matches!(
            r,
            Some(Reference::Addr(Address { row: 3, col: 3 })),
        ));

        let addr = Reference::Addr(Address { row: 3, col: 3 });
        let r = intersect_without_prefix(
            Reference::ColumnRange(ColRange { start: 5, end: 4 }),
            addr.clone(),
        );
        assert!(matches!(r, None));

        let r = intersect_without_prefix(
            addr.clone(),
            Reference::RowRange(RowRange { start: 2, end: 4 }),
        );
        assert!(matches!(
            r,
            Some(Reference::Addr(Address { row: 3, col: 3 })),
        ));

        let addr = Reference::Addr(Address { row: 3, col: 3 });
        let r = intersect_without_prefix(
            Reference::RowRange(RowRange { start: 1, end: 2 }),
            addr.clone(),
        );
        assert!(matches!(r, None));

        let r = intersect_without_prefix(
            addr.clone(),
            Reference::Range(Address { row: 4, col: 3 }, Address { row: 2, col: 5 }),
        );
        assert!(matches!(
            r,
            Some(Reference::Addr(Address { row: 3, col: 3 })),
        ));
        let r = intersect_without_prefix(
            Reference::Range(Address { row: 4, col: 4 }, Address { row: 2, col: 5 }),
            addr.clone(),
        );
        assert!(matches!(r, None));
    }

    #[test]
    fn range_test() {
        let range = Reference::Range(Address { row: 2, col: 5 }, Address { row: 4, col: 7 });

        let r = intersect_without_prefix(
            range.clone(),
            Reference::Range(Address { row: 3, col: 4 }, Address { row: 5, col: 6 }),
        );
        assert!(matches!(
            r,
            Some(Reference::Range(
                Address { row: 3, col: 5 },
                Address { row: 4, col: 6 },
            )),
        ));
        let r = intersect_without_prefix(
            Reference::Range(Address { row: 5, col: 6 }, Address { row: 2, col: 6 }),
            range.clone(),
        );
        assert!(matches!(
            r,
            Some(Reference::Range(
                Address { row: 2, col: 6 },
                Address { row: 4, col: 6 },
            )),
        ));
        let r = intersect_without_prefix(
            range.clone(),
            Reference::Range(Address { row: 3, col: 2 }, Address { row: 5, col: 4 }),
        );
        assert!(matches!(r, None));

        let r = intersect_without_prefix(
            range.clone(),
            Reference::ColumnRange(ColRange { start: 7, end: 9 }),
        );
        assert!(matches!(
            r,
            Some(Reference::Range(
                Address { row: 2, col: 7 },
                Address { row: 4, col: 7 },
            )),
        ));
        let r = intersect_without_prefix(
            range.clone(),
            Reference::ColumnRange(ColRange { start: 8, end: 9 }),
        );
        assert!(matches!(r, None));

        let r = intersect_without_prefix(
            range.clone(),
            Reference::RowRange(RowRange { start: 1, end: 4 }),
        );
        assert!(matches!(
            r,
            Some(Reference::Range(
                Address { row: 2, col: 5 },
                Address { row: 4, col: 7 },
            )),
        ));
        let r = intersect_without_prefix(
            range.clone(),
            Reference::RowRange(RowRange { start: 7, end: 5 }),
        );
        assert!(matches!(r, None));
    }

    #[test]
    fn col_range_test() {
        let cr = Reference::ColumnRange(ColRange { start: 2, end: 4 });
        let r = intersect_without_prefix(
            cr.clone(),
            Reference::ColumnRange(ColRange { start: 3, end: 1 }),
        );
        assert!(matches!(
            r,
            Some(Reference::ColumnRange(ColRange { start: 2, end: 3 })),
        ));
        let r = intersect_without_prefix(
            cr.clone(),
            Reference::ColumnRange(ColRange { start: 8, end: 9 }),
        );
        assert!(matches!(r, None));

        let r = intersect_without_prefix(
            cr.clone(),
            Reference::RowRange(RowRange { start: 3, end: 1 }),
        );
        assert!(matches!(
            r,
            Some(Reference::Range(
                Address { row: 3, col: 2 },
                Address { row: 1, col: 4 },
            )),
        ));
    }

    #[test]
    fn row_range_test() {
        let rr = Reference::RowRange(RowRange { start: 2, end: 4 });
        let r = intersect_without_prefix(
            rr.clone(),
            Reference::RowRange(RowRange { start: 5, end: 1 }),
        );
        assert!(matches!(
            r,
            Some(Reference::RowRange(RowRange { start: 2, end: 4 })),
        ));
        let r = intersect_without_prefix(
            rr.clone(),
            Reference::RowRange(RowRange { start: 8, end: 9 }),
        );
        assert!(matches!(r, None));
    }

    #[test]
    fn prefix() {
        let cv1 = CalcVertex::Reference(CalcReference {
            from_sheet: None,
            sheet: 1,
            reference: Reference::Addr(Address { row: 1, col: 1 }),
        });
        let cv2 = CalcVertex::Reference(CalcReference {
            from_sheet: None,
            sheet: 1,
            reference: Reference::Addr(Address { row: 1, col: 1 }),
        });
        let r = intersect(cv1, cv2);
        assert!(matches!(
            r,
            CalcVertex::Reference(CalcReference {
                from_sheet: None,
                sheet: 1,
                reference: Reference::Addr(Address { row: 1, col: 1 }),
            })
        ));

        let cv1 = CalcVertex::Reference(CalcReference {
            from_sheet: None,
            sheet: 1,
            reference: Reference::Addr(Address { row: 1, col: 1 }),
        });
        let cv2 = CalcVertex::Reference(CalcReference {
            from_sheet: None,
            sheet: 2,
            reference: Reference::Addr(Address { row: 1, col: 1 }),
        });
        let r = intersect(cv1, cv2);
        assert!(matches!(
            r,
            CalcVertex::Value(CalcValue::Scalar(Value::Error(ast::Error::Null))),
        ))
    }
}
