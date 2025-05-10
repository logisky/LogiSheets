use crate::{connectors::CellAttachmentsConnector, exclusive::ctx::ExclusiveManagerExecCtx};

pub type ExclusiveConnector<'a> = CellAttachmentsConnector<'a>;

impl<'a> ExclusiveManagerExecCtx for ExclusiveConnector<'a> {}
