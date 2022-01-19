use regex::Regex;
use xlrs_controller::{AsyncCalcResult, AsyncErr, Task};

use super::AsyncCalcFn;

lazy_static! {
    static ref BAIDU_HOTSEARCH_REGEX: Regex =
        Regex::new(r#"<div class="c-single-text-ellipsis">(.*?)</div>"#).unwrap();
}

pub struct BaiduHotSearchFunc {}

impl AsyncCalcFn for BaiduHotSearchFunc {
    fn call(&self, args: Task) -> futures::future::BoxFuture<'static, AsyncCalcResult> {
        Box::pin(async move {
            let l = args.args.len();
            if l > 0 {
                return Err(AsyncErr::ArgErr);
            }
            let body = reqwest::get("https://top.baidu.com/board").await;
            match body {
                Ok(b) => {
                    let body = b.text().await;
                    match body {
                        Ok(b) => match BAIDU_HOTSEARCH_REGEX.captures(&b) {
                            Some(m) => Ok(m.get(1).unwrap().as_str().trim().to_string()),
                            None => Err(AsyncErr::TimeOut),
                        },
                        Err(_) => Err(AsyncErr::TimeOut),
                    }
                }
                Err(_) => Err(AsyncErr::TimeOut),
            }
        })
    }
}
