"use client";
import {useEffect,useState} from "react";

export function useOnlineState(){
 const[online,setOnline]=useState(true);
 useEffect(()=>{const sync=()=>setOnline(navigator.onLine);sync();addEventListener("online",sync);addEventListener("offline",sync);return()=>{removeEventListener("online",sync);removeEventListener("offline",sync)}},[]);
 return online;
}
export function useViewportMode(){
 const[mode,setMode]=useState<"phone"|"tablet"|"desktop">("desktop");
 useEffect(()=>{const sync=()=>setMode(innerWidth<768?"phone":innerWidth<1200?"tablet":"desktop");sync();addEventListener("resize",sync);return()=>removeEventListener("resize",sync)},[]);
 return mode;
}
export function saveLocalDraft(key:string,value:unknown){try{localStorage.setItem("proar:draft:"+key,JSON.stringify({savedAt:new Date().toISOString(),value}));return true}catch{return false}}
export function readLocalDraft<T>(key:string):{savedAt:string;value:T}|null{try{const raw=localStorage.getItem("proar:draft:"+key);return raw?JSON.parse(raw):null}catch{return null}}
export function clearLocalDraft(key:string){try{localStorage.removeItem("proar:draft:"+key)}catch{}}
