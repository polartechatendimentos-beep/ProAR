"use client";
import {useState} from "react";
import styles from "./ProARFieldMobile.module.css";
export function FieldPhotoComparison({before,after}:{before:string[];after:string[]}) {
  const [left,setLeft]=useState(0),[right,setRight]=useState(0);
  if(!before.length&&!after.length)return null;
  return <details className={styles.journeyPanel}><summary>Comparar fotos antes e depois</summary><p>Compare o mesmo ângulo. Estas fotos pertencem ao rascunho e só são enviadas ao salvar o atendimento.</p>
    <div className={styles.photoComparison}>{([{label:"Antes",photos:before,index:left,set:setLeft},{label:"Depois",photos:after,index:right,set:setRight}]).map(side=><div key={side.label}>
      <label className={styles.formLabel}>{side.label}<select disabled={!side.photos.length} value={Math.min(side.index,Math.max(0,side.photos.length-1))} onChange={e=>side.set(Number(e.target.value))}>{side.photos.length?side.photos.map((_,i)=><option key={i} value={i}>Foto {i+1}</option>):<option value={0}>Sem foto</option>}</select></label>
      {side.photos.length?<img src={side.photos[Math.min(side.index,side.photos.length-1)]} alt={`Comparação ${side.label.toLowerCase()}`} style={{width:"100%",height:180,objectFit:"contain"}}/>:<p>Adicione uma foto {side.label.toLowerCase()}.</p>}
    </div>)}</div>
  </details>;
}
