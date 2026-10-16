"use client";
import {useEffect,useRef,type ReactNode} from "react";
/** Native dialog provides focus containment, Escape and focus restoration without a new runtime. */
export function SideDrawer({title,children,onClose,busy=false}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean}){
  const ref=useRef<HTMLDialogElement|null>(null),close=useRef(onClose);
  useEffect(()=>{close.current=onClose;},[onClose]);
  useEffect(()=>{const dialog=ref.current,previous=document.activeElement as HTMLElement|null;dialog?.showModal();return()=>{dialog?.close();previous?.focus();};},[]);
  return <dialog ref={ref} className="proar-side-drawer" aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)close.current();}}>
    {children}
  </dialog>;
}
