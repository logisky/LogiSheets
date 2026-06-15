//! `FieldRenderManager` persistence.
//!
//! Like `SchemaManager`, this manager holds runtime state — per-renderId
//! `style` (driving cell formatter, font, fill via the workbook's style
//! manager) and `diy_render` (whether the host renders this field with a
//! custom widget). Without persistence, every save/load wipes the state
//! and the host's `BlockInfo.fieldRenders` arrives empty — cells lose
//! their formatters, DIY widgets revert to default rendering.
//!
//! Persisted shape: one `<fieldRender>` element per (renderId, info)
//! pair, sitting under the top-level `<logisheets>` element. We store
//! the raw `numFmt` string (not the `StyleId`) because the xlsx-side
//! style table renumbers and prunes entries across save/load — a saved
//! StyleId would frequently point at the wrong style or nothing at all.
//! On load we re-execute a `SetNumFmt` style update through
//! `StyleManager` to mint a fresh, valid id and bind it back into
//! `FieldRenderInfo`.

use crate::edit_action::StyleUpdateType;
use crate::style_manager::StyleManager;
use logisheets_workbook::logisheets::FieldRenderXml;

use super::info::FieldRenderInfo;
use super::FieldRenderManager;

pub fn field_renders_to_xml(
    manager: &FieldRenderManager,
    style_manager: &StyleManager,
) -> Vec<FieldRenderXml> {
    manager
        .data
        .iter()
        .map(|(render_id, info)| {
            let num_fmt = info
                .style
                .map(|style_id| style_manager.get_style(style_id).formatter);
            FieldRenderXml {
                render_id: render_id.clone(),
                num_fmt,
                diy_render: info.diy_render,
            }
        })
        .collect()
}

pub fn load_field_renders(
    manager: &mut FieldRenderManager,
    style_manager: &mut StyleManager,
    xs: Vec<FieldRenderXml>,
) {
    for x in xs {
        // Re-mint the style id by replaying a SetNumFmt update against
        // the workbook's freshly-loaded style table. The resulting id
        // is what the host's `BlockInfo.fieldRenders[].style` will point
        // at, so cell rendering picks the right formatter.
        let style = x.num_fmt.and_then(|fmt| {
            let update = StyleUpdateType {
                set_num_fmt: Some(fmt),
                ..Default::default()
            };
            style_manager.execute_style_update(update, 0).ok()
        });
        manager.set_info(
            x.render_id,
            FieldRenderInfo {
                style,
                diy_render: x.diy_render,
            },
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_field_renders() {
        let mut style_manager = StyleManager::default();
        // Mint a percent style for render-a — same way the runtime path
        // would (via SetNumFmt on the default style).
        let update = StyleUpdateType {
            set_num_fmt: Some("0.00%".to_string()),
            ..Default::default()
        };
        let percent_id = style_manager
            .execute_style_update(update, 0)
            .expect("style update");

        let mut original = FieldRenderManager::default();
        original.set_info(
            "render-a".to_string(),
            FieldRenderInfo {
                style: Some(percent_id),
                diy_render: Some(true),
            },
        );
        original.set_info(
            "render-b".to_string(),
            FieldRenderInfo {
                style: None,
                diy_render: Some(false),
            },
        );

        let xml = field_renders_to_xml(&original, &style_manager);
        assert_eq!(xml.len(), 2);
        let a_xml = xml
            .iter()
            .find(|x| x.render_id == "render-a")
            .expect("render-a xml");
        assert_eq!(a_xml.num_fmt.as_deref(), Some("0.00%"));

        // Simulate the load side: fresh StyleManager (different ids),
        // fresh FieldRenderManager, replay numFmt via the styles
        // pipeline. The restored entry must end up with a style id
        // whose formatter matches the original.
        let mut loaded_style_manager = StyleManager::default();
        let mut restored = FieldRenderManager::default();
        load_field_renders(&mut restored, &mut loaded_style_manager, xml);

        let a = restored.get(&"render-a".to_string()).expect("render-a");
        let a_style_id = a.style.expect("render-a should have a style id");
        let formatter = loaded_style_manager.get_style(a_style_id).formatter;
        assert_eq!(formatter, "0.00%");
        assert_eq!(a.diy_render, Some(true));

        let b = restored.get(&"render-b".to_string()).expect("render-b");
        assert_eq!(b.style, None);
        assert_eq!(b.diy_render, Some(false));
    }
}
