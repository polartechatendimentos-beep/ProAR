"use client";

import {useState} from "react";
import {productIllustration,type ProductImageDetails} from "@/lib/product-illustrations";

export function ProductCatalogImage({record,preview=false}:{record:ProductImageDetails;preview?:boolean}){
  const [failed,setFailed]=useState("");
  const original=record.catalogImage?.trim()||"";
  const real=Boolean(original&&original!==failed);
  const illustration=productIllustration(record);
  return <span className={`product-catalog-media ${preview?"product-catalog-preview":""}`} data-illustration={!real} title={real?"Foto do produto":`Imagem ilustrativa • ${illustration.label}`}>
    <img src={real?original:illustration.url} alt={preview?(real?`Foto de ${record.name||"produto"}`:`Imagem ilustrativa: ${illustration.label}`):""} loading={preview?"eager":"lazy"} onError={real?()=>setFailed(original):undefined}/>
    {preview&&!real&&<small aria-live="polite">Ilustrativa · {illustration.label}</small>}
  </span>;
}
