use syn::DeriveInput;

use crate::container::{Container, Derive, Field, FieldsSummary, Generic};

pub fn get_ser_impl_block(input: DeriveInput) -> proc_macro2::TokenStream {
    let container = Container::from_ast(&input, Derive::Serialize);
    let write_ns = match container.with_ns {
        Some(ns) => quote! {
            attrs.push(Attribute::from((b"xmlns".as_ref(), #ns.as_ref())));
        },
        None => quote! {},
    };
    let write_custom_ns = if container.custom_ns.len() == 0 {
        quote! {}
    } else {
        let cns = container.custom_ns.into_iter().map(|(ns, value)| {
            quote! {
                let mut __vec = b"xmlns:".to_vec();
                __vec.extend(#ns.to_vec());
                attrs.push(Attribute::from((__vec.as_ref(), #value.as_ref())));
            }
        });
        quote! {#(#cns)*}
    };
    let FieldsSummary {
        children,
        text,
        attrs,
        self_closed_children,
    } = FieldsSummary::from_fields(container.fields);
    if text.is_some() && (children.len() > 0 || self_closed_children.len() > 0) {
        panic!("Cannot owns the text and children at the same time.")
    }
    let init = init_is_empty(&children, &self_closed_children, &text);
    let build_attr_and_push = attrs.into_iter().map(|attr| {
        let name = attr.name.as_ref().unwrap();
        let ident = attr.original.ident.as_ref().unwrap();
        match &attr.generic {
            Generic::Vec(_) => panic!("cannot use a vector in attribute"),
            Generic::Opt(_) => {
                quote! {
                    let mut sr: String;
                    match &self.#ident {
                        Some(v) => {
                            sr = v.serialize();
                            attrs.push(Attribute::from((#name.as_ref(), sr.as_bytes())));
                        },
                        None => {},
                    }
                }
            }
            Generic::None => match &attr.default {
                Some(path) => quote! {
                    let mut ser;
                    if #path() != self.#ident {
                        ser = self.#ident.serialize();
                        attrs.push(Attribute::from((#name.as_ref(), ser.as_bytes())));
                    }
                },
                None => quote! {
                    let ser = self.#ident.serialize();
                    attrs.push(Attribute::from((#name.as_ref(), ser.as_bytes())));
                },
            },
        }
    });
    let write_text_or_children = if let Some(t) = text {
        let ident = t.original.ident.as_ref().unwrap();
        if t.generic.is_opt() {
            quote! {
                match &self.#ident {
                    None => {},
                    Some(__d) => {
                        let r = __d.serialize();
                        let event = BytesText::from_plain_str(&r);
                        writer.write_event(Event::Text(event));
                    }
                }
            }
        } else {
            quote! {
                let r = self.#ident.serialize();
                let event = BytesText::from_plain_str(&r);
                writer.write_event(Event::Text(event));
            }
        }
    } else {
        let write_scf = self_closed_children.into_iter().map(|f| {
            let ident = f.original.ident.as_ref().unwrap();
            let name = f.name.as_ref().unwrap();
            quote! {
                if self.#ident {
                    let event = BytesStart::borrowed_name(#name);
                    writer.write_event(Event::Empty(event));
                }
            }
        });
        let write_children = children.into_iter().map(|f| {
            if f.skip_serializing {
                quote! {}
            } else {
                let ident = f.original.ident.as_ref().unwrap();
                let name = f.name.as_ref().unwrap();
                quote! {
                    self.#ident.serialize(#name, writer);
                }
            }
        });
        quote! {
            #(#write_scf)*
            #(#write_children)*
        }
    };
    let ident = &input.ident;
    // let write_event = if is_empty {
    //     quote! {
    //         writer.write_event(Event::Empty(start));
    //     }
    // } else {
    //     quote! {
    //         writer.write_event(Event::Start(start));
    //         #write_text_or_children
    //         let end = BytesEnd::borrowed(tag);
    //         writer.write_event(Event::End(end));
    //     }
    // };
    let write_event = quote! {
        if is_empty {
            writer.write_event(Event::Empty(start));
        } else {
            writer.write_event(Event::Start(start));
            #write_text_or_children
            let end = BytesEnd::borrowed(tag);
            writer.write_event(Event::End(end));
        }
    };
    quote! {
        #[allow(unused_must_use)]
        impl crate::XmlSerialize for #ident {
            fn serialize<W: std::io::Write>(
                &self,
                tag: &[u8],
                writer: &mut quick_xml::Writer<W>,
            ) {
                use quick_xml::events::*;
                use quick_xml::events::attributes::Attribute;
                use crate::XmlValue;
                let start = BytesStart::borrowed_name(tag);
                let mut attrs = Vec::<Attribute>::new();
                #write_ns
                #write_custom_ns
                #(#build_attr_and_push)*
                let start = start.with_attributes(attrs);
                #init
                #write_event
            }
        }
    }
}

fn init_is_empty(
    children: &Vec<Field>,
    scf: &Vec<Field>,
    text: &Option<Field>,
) -> proc_macro2::TokenStream {
    let children_init = children.iter().map(|c| {
        let ident = c.original.ident.as_ref().unwrap();
        match &c.generic {
            Generic::Vec(_) => quote! {
                let #ident = self.#ident.len() > 0;
            },
            Generic::Opt(_) => quote! {
                let #ident = self.#ident.is_some();
            },
            Generic::None => match &c.default {
                Some(d) => quote! {
                    let #ident = self.#ident != #d();
                },
                None => quote! {let #ident = true;},
            },
        }
    });
    let scf_init = scf.iter().map(|s| {
        let ident = s.original.ident.as_ref().unwrap();
        quote! {
            let #ident = self.#ident;
        }
    });
    let text_init = match text {
        Some(tf) => {
            let ident = tf.original.ident.as_ref().unwrap();
            if tf.generic.is_opt() {
                quote! {
                    let mut has_text = true;
                    if self.#ident.is_none() {
                        has_text = false;
                    }
                }
            } else if tf.default.is_none() {
                quote! {let has_text = true;}
            } else {
                let path = tf.default.as_ref().unwrap();
                quote! {
                    let mut has_text = true;
                    if self.#ident == #path() {
                        has_text = false;
                    }
                }
            }
        }
        None => quote! {let has_text = false;},
    };
    let is_empty = {
        let idents = children.iter().chain(scf.iter()).map(|c| {
            let ident = c.original.ident.as_ref().unwrap();
            quote! {#ident}
        });
        quote! {
            let has_child_to_write = #(#idents ||)* has_text;
            let is_empty = !has_child_to_write;
        }
    };
    quote! {
        #(#children_init)*
        #(#scf_init)*
        #text_init
        #is_empty
    }
}
