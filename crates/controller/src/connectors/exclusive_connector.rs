use crate::{connectors::ContainerConnector, exclusive::ctx::ExclusiveManagerExecCtx};

pub type ExclusiveConnector<'a> = ContainerConnector<'a>;

impl<'a> ExclusiveManagerExecCtx for ExclusiveConnector<'a> {}
