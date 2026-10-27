'use client';
import {useEffect,useState} from 'react';
import {defaultMobilePreferences,parseMobilePreferences,type MobilePreferences} from '@/lib/mobile-workflow-insights';
export function useMobilePreferences(scope:string|undefined){
 const [state,setState]=useState<{scope:string;value:MobilePreferences}>({scope:'',value:{...defaultMobilePreferences}}),[notice,setNotice]=useState('');
 const key=scope?`proar-mobile-preferences-v1:${encodeURIComponent(scope)}`:'';
 useEffect(()=>{if(!scope)return;try{const value=parseMobilePreferences(JSON.parse(localStorage.getItem(key)||'null'));setState({scope,value});}catch{setState({scope,value:{...defaultMobilePreferences}});setNotice('Preferências disponíveis apenas nesta sessão.');}},[scope,key]);
 const value=state.scope===scope?state.value:defaultMobilePreferences;
 function update(patch:Partial<MobilePreferences>){if(!scope)return;const next=parseMobilePreferences({...value,...patch});try{localStorage.setItem(key,JSON.stringify(next));}catch{setNotice('Não foi possível guardar a preferência neste navegador.');}setState({scope,value:next});}
 return {value,update,notice};
}
