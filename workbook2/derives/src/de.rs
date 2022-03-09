use syn::DeriveInput;

use crate::container::{self, Field, EleType, Container, FieldsSummary, Generic};

pub fn get_de_impl_block(input: DeriveInput) -> proc_macro2::TokenStream {
    let container = Container::from_ast(&input, container::Derive::Deserialize);
    let result = get_result(&container.fields);
    let summary = FieldsSummary::from_fields(container.fields);
    let fields_init = get_fields_init(&summary);
    let FieldsSummary {
        children,
        text,
        attrs,
        self_closed_children,
    }= summary;
    let vec_init = get_vec_init(&children);
    let attr_branches = attrs
        .into_iter()
        .map(|a| attr_match_branch(a));
    let child_branches = children_match_branch(children);
    let sfc_branch = sfc_match_branch(self_closed_children);
    let ident = &input.ident;
    let text_branch = {
        if let Some(t) = text {
            Some(text_match_branch(t))
        } else {
            None
        }
    };
    quote!{
        #[allow(unused_assignments)]
        impl crate::XmlDeserialize for #ident {
            fn deserialize<B: std::io::BufRead>(
                tag: &[u8],
                reader: &mut quick_xml::Reader<B>,
                attrs: quick_xml::events::attributes::Attributes,
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
                loop {
                    match reader.read_event(&mut buf) {
                        Ok(Event::End(e)) => {
                            if e.name() == tag {
                                break
                            }
                        },
                        #child_branches
                        #text_branch
                        #sfc_branch
                        Ok(Event::Eof) => break,
                        Err(_) => break,
                        _ => {},
                    }
                }
                Self {
                    #result
                }
            }
        }
    }
}

fn get_result(fields: &[Field]) -> proc_macro2::TokenStream {
    let branch = fields.iter().map(|f| {
        let ident = f.original.ident.as_ref().unwrap();
        if f.is_required() {
            quote!{
                #ident: #ident.unwrap(),
            }
        } else {
            quote! {
                #ident,
            }
        }
    });
    quote!{#(#branch)*}
}

fn get_fields_init(fields: &FieldsSummary) -> proc_macro2::TokenStream {
    let attrs_inits = fields.attrs.iter().map(|f| {
        let ident = f.original.ident.as_ref().unwrap();
        let ty = &f.original.ty;
        match &f.default {
            Some(p) => {
                quote! {let mut #ident = #p();}
            },
            None => {
                if let Some(opt) = f.generic.get_opt() {
                    quote! {
                        let mut #ident = Option::<#opt>::None;
                    }
                } else {
                    quote! {let mut #ident = Option::<#ty>::None;}
                }
            },
        }
    });
    let children_inits = fields.children.iter().map(|f| {
        let ident = f.original.ident.as_ref().unwrap();
        let ty = &f.original.ty;
        match &f.default {
            Some(p) => {
                quote! {let mut #ident = #p;}
            },
            None => {
                match f.generic {
                    Generic::Vec(v) => quote!{
                        let mut #ident = Vec::<#v>::new();
                    },
                    Generic::Opt(opt) => quote!{
                        let mut #ident = Option::<#opt>::None;
                    },
                    Generic::None => quote!{
                        let mut #ident = Option::<#ty>::None;
                    },
                }
            },
        }
    });
    let text_init = match &fields.text {
        Some(f) => {
            let ident = f.original.ident.as_ref().unwrap();
            let ty = &f.original.ty;
            match &f.default {
                Some(_) => {
                    panic!("text element should not have default")
                },
                None => quote! {
                    let mut #ident = Option::<#ty>::None;
                },
            }
        },
        None => quote!{},
    };
    let sfc_init = fields
        .self_closed_children
        .iter()
        .map(|f| {
            let ident = f.original.ident.as_ref().unwrap();
            quote!{
                let mut #ident = false;
            }
    });
    quote! {
        #(#attrs_inits)*
        #(#children_inits)*
        #(#sfc_init)*
        #text_init
    }
}

fn get_vec_init(children: &[Field]) -> proc_macro2::TokenStream {
    let vec_inits= children
        .iter()
        .filter(|c| c.generic.is_vec())
        .map(|c| {
            match &c.vec_size {
            Some(lit) => {
                let vec_ty = &c.generic.get_vec().unwrap();
                let ident = c.original.ident.as_ref().unwrap();
                match lit {
                    syn::Lit::Str(_) => {
                        let path = container::parse_lit_into_expr_path(lit).unwrap();
                        quote!{
                            #ident = Vec::<#vec_ty>::with_capacity(#path as usize);
                        }
                    },
                    syn::Lit::Int(i) => {
                        quote!{
                            #ident = Vec::<#vec_ty>::with_capacity(#i);
                        }
                    },
                    _ => panic!(""),
                }
            },
            None => {
                quote!{}
            },
        }
    });
    quote! {
        #(#vec_inits)*
    }
}

fn sfc_match_branch(fields: Vec<Field>) -> proc_macro2::TokenStream {
    if fields.len() == 0 {
        return quote!{}
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
        Ok(Event::Empty(s)) => {
            match s.name() {
                #(#tags => {#idents = true;})*
                _ => {},
            }
        },
    }
}


fn attr_match_branch(field: Field) -> proc_macro2::TokenStream {
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
                    Ok(v) => {
                        #ident = Some(v);
                    },
                    Err(_) => {
                        // If we used format! here. It would panic!.
                        // let err_msg = format!("xml value deserialize error: {:?} to {:?}", s, #t);
                        panic!("deserialize failed")
                    },
                }
            }
        }
    } else {
        let tt = if field.is_required() {
            quote!{#ident = Some(v);}
        } else {
            quote!{#ident = v;}
        };
        quote! {
            #tag => {
                use crate::{XmlValue, XmlDeserialize};
                let s = String::from_utf8(attr.value.into_iter().map(|c| *c).collect()).unwrap();
                match #t::deserialize(&s) {
                    Ok(v) => {
                        #tt
                    },
                    Err(_) => {
                        // If we used format! here. It would panic!.
                        // let err_msg = format!("xml value deserialize error: {:?} to {:?}", s, #t);
                        panic!("deserialize failed")
                    },
                }
            },
        }
    }
}

fn text_match_branch(field: Field) -> proc_macro2::TokenStream {
    if !matches!(field.ty, EleType::Text) {
        panic!("")
    }
    let ident = field.original.ident.as_ref().unwrap();
    let t = &field.original.ty;
    let tt = if field.is_required() {
        quote!{#ident = Some(v);}
    } else {
        quote!{#ident = v;}
    };
    quote! {
        Ok(Event::Text(s)) => {
            use crate::{XmlValue, XmlDeserialize};
            let r = s.unescape_and_decode(reader).unwrap();
            match #t::deserialize(&r) {
                Ok(v) => {
                    // #ident = v;
                    #tt
                },
                Err(_) => {
                    panic!("deserialize failed")
                }
            }
        },
    }
}

fn children_match_branch(fields: Vec<Field>) -> proc_macro2::TokenStream {
    if fields.len() == 0 {
        return quote!{}
    }
    let mut branches= vec![];
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
                        let ele = #vec_ty::deserialize(#tag, reader, s.attributes());
                        #ident.push(ele);
                    }
                }
            },
            Generic::Opt(opt_ty) => {
                quote! {
                    #tag => {
                        let f = #opt_ty::deserialize(#tag, reader, s.attributes());
                        #ident = Some(f);
                    },
                }
            },
            Generic::None => {
                let tt = if f.is_required() {
                    quote!{
                        #ident = Some(f);
                    }
                } else {
                    quote!{
                        #ident = f;
                    }
                };
                quote! {
                    #tag => {
                        let f = #t::deserialize(#tag, reader, s.attributes());
                        #tt
                    },
                }
            },
        };
        branches.push(branch);
    });
    quote!{
        Ok(Event::Start(s)) => {
            match s.name() {
                #(#branches)*
                _ => {},
            }
        }
    }
}
