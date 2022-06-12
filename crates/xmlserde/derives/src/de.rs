use syn::DeriveInput;

use crate::container::{self, Container, EleType, FieldsSummary, Generic, StructField};

pub fn get_de_impl_block(input: DeriveInput) -> proc_macro2::TokenStream {
    let container = Container::from_ast(&input, container::Derive::Deserialize);
    if container.is_enum() {
        get_de_enum_impl_block(container)
    } else {
        get_de_struct_impl_block(container)
    }
}

pub fn get_de_enum_impl_block(container: Container) -> proc_macro2::TokenStream {
    let ident = &container.original.ident;
    let event_start_branches = container.enum_variants.iter().map(|v| {
        let name = &v.name;
        let ty = v.ty;
        let ident = v.ident;
        quote! {
            #name => {
                let _r = #ty::deserialize(
                    #name,
                    reader,
                    _s.attributes(),
                    false,
                );
                result = Some(Self::#ident(_r));
            }
        }
    });
    let event_empty_branches = container.enum_variants.iter().map(|v| {
        let name = &v.name;
        let ty = v.ty;
        let ident = v.ident;
        quote! {
            #name => {
                let _r = #ty::deserialize(
                    #name,
                    reader,
                    _s.attributes(),
                    true,
                );
                result = Some(Self::#ident(_r));
            }
        }
    });
    quote! {
        #[allow(unused_assignments)]
        impl crate::XmlDeserialize for #ident {
            fn deserialize<B: std::io::BufRead>(
                tag: &[u8],
                reader: &mut quick_xml::Reader<B>,
                attrs: quick_xml::events::attributes::Attributes,
                is_empty: bool,
            ) -> Self {
                use quick_xml::events::*;
                let mut buf = Vec::<u8>::new();
                let mut result = Option::<Self>::None;
                loop {
                    match reader.read_event(&mut buf) {
                        Ok(Event::End(e)) if e.name() == tag => {
                            break
                        },
                        Ok(Event::Start(_s)) => match _s.name() {
                            #(#event_start_branches)*
                            _ => {},
                        },
                        Ok(Event::Empty(_s)) => match _s.name() {
                            #(#event_empty_branches)*
                            _ => {},
                        }
                        Ok(Event::Eof) => break,
                        Err(_) => break,
                        _ => {},
                    }
                }
                result.unwrap()
            }
        }
    }
}

pub fn get_de_struct_impl_block(container: Container) -> proc_macro2::TokenStream {
    let result = get_result(&container.struct_fields);
    let summary = FieldsSummary::from_fields(container.struct_fields);
    let fields_init = get_fields_init(&summary);
    let FieldsSummary {
        children,
        text,
        attrs,
        self_closed_children,
    } = summary;
    let vec_init = get_vec_init(&children);
    let attr_branches = attrs.into_iter().map(|a| attr_match_branch(a));
    let child_branches = children_match_branch(children);
    let sfc_branch = sfc_match_branch(self_closed_children);
    let ident = &container.original.ident;
    let text_branch = {
        if let Some(t) = text {
            Some(text_match_branch(t))
        } else {
            None
        }
    };
    let get_root = if let Some(r) = &container.root {
        quote! {
            fn de_root() -> Option<&'static [u8]> {
                Some(#r)
            }
        }
    } else {
        quote! {}
    };
    quote! {
        #[allow(unused_assignments)]
        impl crate::XmlDeserialize for #ident {
            fn deserialize<B: std::io::BufRead>(
                tag: &[u8],
                reader: &mut quick_xml::Reader<B>,
                attrs: quick_xml::events::attributes::Attributes,
                is_empty: bool,
            ) -> Self {
                #fields_init
                attrs.into_iter().for_each(|attr| {
                    if let Ok(attr) = attr {
                        match attr.key {
                            #(#attr_branches)*
                            _ => {},
                        }
                    }
                });
                let mut buf = Vec::<u8>::new();
                use quick_xml::events::Event;
                #vec_init
                if is_empty {} else {
                    loop {
                        match reader.read_event(&mut buf) {
                            Ok(Event::End(e)) if e.name() == tag => {
                                break
                            },
                            #sfc_branch
                            #child_branches
                            #text_branch
                            Ok(Event::Eof) => break,
                            Err(_) => break,
                            _ => {},
                        }
                    }
                }
                Self {
                    #result
                }
            }
            #get_root
        }

    }
}

fn get_result(fields: &[StructField]) -> proc_macro2::TokenStream {
    let branch = fields.iter().map(|f| {
        let ident = f.original.ident.as_ref().unwrap();
        if f.is_required() {
            quote! {
                #ident: #ident.unwrap(),
            }
        } else {
            quote! {
                #ident,
            }
        }
    });
    quote! {#(#branch)*}
}

fn get_fields_init(fields: &FieldsSummary) -> proc_macro2::TokenStream {
    let attrs_inits = fields.attrs.iter().map(|f| {
        let ident = f.original.ident.as_ref().unwrap();
        let ty = &f.original.ty;
        match &f.default {
            Some(p) => {
                quote! {let mut #ident = #p();}
            }
            None => {
                if let Some(opt) = f.generic.get_opt() {
                    quote! {
                        let mut #ident = Option::<#opt>::None;
                    }
                } else {
                    quote! {let mut #ident = Option::<#ty>::None;}
                }
            }
        }
    });
    let children_inits = fields.children.iter().map(|f| {
        let ident = f.original.ident.as_ref().unwrap();
        let ty = &f.original.ty;
        match &f.default {
            Some(p) => {
                quote! {let mut #ident = #p;}
            }
            None => match f.generic {
                Generic::Vec(v) => quote! {
                    let mut #ident = Vec::<#v>::new();
                },
                Generic::Opt(opt) => quote! {
                    let mut #ident = Option::<#opt>::None;
                },
                Generic::None => quote! {
                    let mut #ident = Option::<#ty>::None;
                },
            },
        }
    });
    let text_init = match &fields.text {
        Some(f) => {
            let ident = f.original.ident.as_ref().unwrap();
            let ty = match f.generic {
                Generic::Vec(_) => panic!("text element should not be Vec<T>"),
                Generic::Opt(t) => t,
                Generic::None => &f.original.ty,
            };
            // let ty = &f.original.ty;
            match &f.default {
                Some(e) => quote! {
                        let mut #ident = #e();
                },
                None => quote! {
                    let mut #ident = Option::<#ty>::None;
                },
            }
        }
        None => quote! {},
    };
    let sfc_init = fields.self_closed_children.iter().map(|f| {
        let ident = f.original.ident.as_ref().unwrap();
        quote! {
            let mut #ident = false;
        }
    });
    quote! {
        #(#attrs_inits)*
        #(#sfc_init)*
        #(#children_inits)*
        #text_init
    }
}

fn get_vec_init(children: &[StructField]) -> proc_macro2::TokenStream {
    let vec_inits = children
        .iter()
        .filter(|c| c.generic.is_vec())
        .map(|c| match &c.vec_size {
            Some(lit) => {
                let vec_ty = &c.generic.get_vec().unwrap();
                let ident = c.original.ident.as_ref().unwrap();
                match lit {
                    syn::Lit::Str(_) => {
                        let path = container::parse_lit_into_expr_path(lit).unwrap();
                        quote! {
                            #ident = Vec::<#vec_ty>::with_capacity(#path as usize);
                        }
                    }
                    syn::Lit::Int(i) => {
                        quote! {
                            #ident = Vec::<#vec_ty>::with_capacity(#i);
                        }
                    }
                    _ => panic!(""),
                }
            }
            None => {
                quote! {}
            }
        });
    quote! {
        #(#vec_inits)*
    }
}

fn sfc_match_branch(fields: Vec<StructField>) -> proc_macro2::TokenStream {
    if fields.len() == 0 {
        return quote! {};
    }
    let mut idents = vec![];
    let mut tags = vec![];
    fields.iter().for_each(|f| {
        if !matches!(f.ty, EleType::SelfClosedChild) {
            panic!("")
        }
        let tag = f.name.as_ref().unwrap();
        tags.push(tag);
        let ident = f.original.ident.as_ref().unwrap();
        idents.push(ident);
    });
    quote! {
        #(Ok(Event::Empty(__s)) if __s.name() == #tags => {
            #idents = true;
        })*
    }
    // quote! {
    //     Ok(Event::Empty(s)) => {
    //         match s.name() {
    //             #(#tags => {#idents = true;})*
    //             _ => {},
    //         }
    //     },
    // }
}

fn attr_match_branch(field: StructField) -> proc_macro2::TokenStream {
    if !matches!(field.ty, EleType::Attr) {
        panic!("")
    }
    let t = &field.original.ty;
    let tag = field.name.as_ref().unwrap();
    let ident = field.original.ident.as_ref().unwrap();
    if field.generic.is_opt() {
        let opt_ty = field.generic.get_opt().unwrap();
        quote! {
            #tag => {
                use crate::{XmlValue, XmlDeserialize};
                let s = String::from_utf8(attr.value.into_iter().map(|c| *c).collect()).unwrap();
                match #opt_ty::deserialize(&s) {
                    Ok(__v) => {
                        #ident = Some(__v);
                    },
                    Err(_) => {
                        // If we used format! here. It would panic!.
                        // let err_msg = format!("xml value deserialize error: {:?} to {:?}", s, #t);
                        panic!("deserialize failed in attr opt")
                    },
                }
            }
        }
    } else {
        let tt = if field.is_required() {
            quote! {#ident = Some(__v);}
        } else {
            quote! {#ident = __v;}
        };
        quote! {
            #tag => {
                use crate::{XmlValue, XmlDeserialize};
                let __s = String::from_utf8(attr.value.into_iter().map(|c| *c).collect()).unwrap();
                match #t::deserialize(&__s) {
                    Ok(__v) => {
                        #tt
                    },
                    Err(_) => {
                        // If we used format! here. It would panic!.
                        // let err_msg = format!("xml value deserialize error: {:?} to {:?}", s, #t);
                        panic!("deserialize failed in attr")
                    },
                }
            },
        }
    }
}

fn text_match_branch(field: StructField) -> proc_macro2::TokenStream {
    if !matches!(field.ty, EleType::Text) {
        panic!("")
    }
    let ident = field.original.ident.as_ref().unwrap();
    // let t = &field.original.ty;
    let (t, is_opt) = match field.generic {
        Generic::Vec(_) => panic!("text element should not be Vec<T>"),
        Generic::Opt(ty) => (ty, true),
        Generic::None => (&field.original.ty, false),
    };
    let tt = if field.is_required() || is_opt {
        quote! {#ident = Some(__v);}
    } else {
        quote! {#ident = __v;}
    };
    quote! {
        Ok(Event::Text(__s)) => {
            use crate::{XmlValue, XmlDeserialize};
            let __r = __s.unescape_and_decode(reader).unwrap();
            match #t::deserialize(&__r) {
                Ok(__v) => {
                    // #ident = v;
                    #tt
                },
                Err(_) => {
                    panic!("deserialize failed in text element")
                }
            }
        },
    }
}

fn children_match_branch(fields: Vec<StructField>) -> proc_macro2::TokenStream {
    if fields.len() == 0 {
        return quote! {};
    }
    let mut branches = vec![];
    fields.iter().for_each(|f| {
        if !matches!(f.ty, EleType::Child) {
            panic!("")
        }
        let tag = f.name.as_ref().unwrap();
        let ident = f.original.ident.as_ref().unwrap();
        let t = &f.original.ty;
        let branch = match f.generic {
            Generic::Vec(vec_ty) => {
                quote! {
                    #tag => {
                        let __ele = #vec_ty::deserialize(#tag, reader, s.attributes(), is_empty);
                        #ident.push(__ele);
                    }
                }
            }
            Generic::Opt(opt_ty) => {
                quote! {
                    #tag => {
                        let __f = #opt_ty::deserialize(#tag, reader, s.attributes(), is_empty);
                        #ident = Some(__f);
                    },
                }
            }
            Generic::None => {
                let tt = if f.is_required() {
                    quote! {
                        #ident = Some(__f);
                    }
                } else {
                    quote! {
                        #ident = __f;
                    }
                };
                quote! {
                    #tag => {
                        let __f = #t::deserialize(#tag, reader, s.attributes(), is_empty);
                        #tt
                    },
                }
            }
        };
        branches.push(branch);
    });
    quote! {
        Ok(Event::Empty(s)) => {
            let is_empty = true;
            match s.name() {
                #(#branches)*
                _ => {},
            }
        }
        Ok(Event::Start(s)) => {
            let is_empty = false;
            match s.name() {
                #(#branches)*
                _ => {},
            }
        }
    }
}
