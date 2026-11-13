/** Shared save-state transition guard. Server success must be explicit. */
export type EditSaveState="idle"|"dirty"|"validating"|"saving"|"saved"|"error";
export function editSaveTransition(current:EditSaveState,event:"change"|"validate"|"submit"|"confirmed"|"failed"):EditSaveState{
 if(event==="change")return "dirty";
 if(event==="validate")return current==="dirty"?"validating":current;
 if(event==="submit")return current==="validating"?"saving":current;
 if(event==="confirmed")return current==="saving"?"saved":current;
 if(event==="failed")return current==="saving"||current==="validating"?"error":current;
 return current;
}
export function tenantEditAllowed(sessionCompanyId:string,recordCompanyId:string,canEdit:boolean){
 return Boolean(sessionCompanyId&&recordCompanyId&&sessionCompanyId===recordCompanyId&&canEdit);
}
