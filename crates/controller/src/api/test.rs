use super::Workbook;

#[test]
fn new_workbook() {
    let wb = Workbook::default();
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let empty_display_window = ws.get_display_window(0, 0, 100, 100).unwrap();
    let row_cnt = empty_display_window.rows.len();
    let col_cnt = empty_display_window.cols.len();
    let cell_cnt = empty_display_window.cells.len();
    assert!(row_cnt >= 100);
    assert!(col_cnt >= 100);
    assert_eq!(row_cnt * col_cnt, cell_cnt);
    assert_eq!(empty_display_window.rows[0].idx, 0);
    assert_eq!(empty_display_window.cols[0].idx, 0);

    let empty_display_resp = ws.get_display_window_response(0., 0., 100., 100.).unwrap();
    assert!(empty_display_resp.window.cells.len() > 0);
    assert!(empty_display_resp.window.rows.len() > 0);
    assert!(empty_display_resp.window.cols.len() > 0);

    assert_eq!(empty_display_resp.window.rows.get(0).unwrap().idx, 0);
    assert_eq!(empty_display_resp.window.cols.get(0).unwrap().idx, 0);
    let v = empty_display_resp
        .window
        .cols
        .into_iter()
        .fold(0., |p, c| return p + c.width);
    assert!(v > 100.);
}
