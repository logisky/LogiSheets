pub fn tbilleq(settlement: u32, maturity: u32, discount: f64) -> f64 {
    let dsm = (maturity - settlement) as f64;
    if dsm > 182. {
        let price = (100. - discount * 100. * dsm / 360.) / 100.;
        let days = if dsm == 366. { 366. } else { 365. };
        let temp_term2 = dsm.powf(2.) - (2. * dsm / days - 1.) * (1. - 1. * price);
        let term2 = temp_term2.sqrt();
        let term3 = 2. * dsm / days - 1.;

        2. * (term2 - dsm / days) / term3
    } else {
        365. * discount / (360. - discount * dsm)
    }
}

pub fn tbillyield(settlement: u32, maturity: u32, pr: f64) -> f64 {
    let dsm = (maturity - settlement) as f64;
    (100. - pr) / pr * 360. / dsm
}

pub fn tbillprice(settlement: u32, maturity: u32, discount: f64) -> f64 {
    let dsm = (maturity - settlement) as f64;
    100. * (1. - discount * dsm / 360.)
}
