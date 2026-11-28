type StorageRead = Pick<Storage,"getItem">;
type StorageWrite = Pick<Storage,"setItem">;
type DesktopAccess = {username:string;role?:string;permissions?:string[];entitledModules?:string[];companyId?:string};
type Snapshot<T> = {stamp:string;view:T};
function identify(company:string,user:DesktopAccess|null){
  if(!company||!user?.username||(user.companyId&&user.companyId!==company))return null;
  const sorted=(items:string[]|undefined)=>Array.isArray(items)?[...new Set(items)].sort():null;
  return {key:`proar:desktop:authorized-view:v1:${encodeURIComponent(company)}:${encodeURIComponent(user.username.trim().toLowerCase())}`,
    access:JSON.stringify([user.role??null, sorted(user.permissions), sorted(user.entitledModules)])};
}
export function readDesktopAccessCache<T>(store:StorageRead,company:string,user:DesktopAccess|null):Snapshot<T>|null{
  const identity=identify(company,user);
  if(!identity)return null;
  try{
    const value=JSON.parse(store.getItem(identity.key)||"null");
    if(value?.access!==identity.access||!Number.isFinite(Date.parse(value.stamp))||
      !Array.isArray(value.view?.customers)||!Array.isArray(value.view?.serviceOrders)||
      !value.view?.moduleRecords||typeof value.view.moduleRecords!=="object"||Array.isArray(value.view.moduleRecords))return null;
    return {stamp:value.stamp,view:value.view as T};
  }catch{return null;}
}
export function writeDesktopAccessCache<T>(store:StorageWrite,company:string,user:DesktopAccess|null,view:T,stamp=new Date().toISOString()):string{
  const identity=identify(company,user);
  if(!identity)return "";
  try{store.setItem(identity.key,JSON.stringify({access:identity.access,view,stamp}));return stamp;}catch{return "";}
}
