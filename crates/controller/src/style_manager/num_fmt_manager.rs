use super::manager::Manager;

pub type NumFmtId = u32;
pub type NumFmtManager = Manager<String, NumFmtId>;

impl Default for NumFmtManager {
    fn default() -> Self {
        NumFmtManager::new_with_builtin_values(
            50,
            vec![
                (0, "General".to_string()),
                (1, "0".to_string()),
                (2, "0.00".to_string()),
                (3, "#,##0".to_string()),
                (4, "#,##0.00".to_string()),
                (9, "0%".to_string()),
                (10, "0.00%".to_string()),
                (11, "0.00E+00".to_string()),
                (12, "# ?/?".to_string()),
                (13, "# ??/??".to_string()),
                (14, "mm-dd-yy".to_string()),
                (15, "d-mmm-yy".to_string()),
                (16, "d-mmm".to_string()),
                (17, "mmm-yy".to_string()),
                (18, "h:mm AM/PM".to_string()),
                (19, "h:mm:ss AM/PM".to_string()),
                (20, "h:mm".to_string()),
                (21, "h:mm:ss".to_string()),
                (22, "m/d/yy h:mm".to_string()),
                (37, "#,##0 ;(#,##0)".to_string()),
                (38, "#,##0 ;[Red](#,##0)".to_string()),
                (39, "#,##0.00;(#,##0.00)".to_string()),
                (40, "#,##0.00;[Red](#,##0.00)".to_string()),
                (45, "mm:ss".to_string()),
                (46, "[h]:mm:ss".to_string()),
                (47, "mmss.0".to_string()),
                (48, "##0.00E+0".to_string()),
                (49, "@".to_string()),
            ],
        )
    }
}
