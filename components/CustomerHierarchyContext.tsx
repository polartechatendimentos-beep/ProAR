"use client";
import {createContext,useContext,useMemo,type ReactNode} from "react";
import type {HierarchyCustomer,HierarchyRecord} from "@/lib/customer-hierarchy";
const EMPTY:HierarchyRecord[]=[];
const ENTITIES:Record<string,unknown>[]=[];
const Context=createContext<{customers:HierarchyCustomer[];records:HierarchyRecord[];equipment:Record<string,unknown>[];orders:Record<string,unknown>[]}>({customers:[],records:EMPTY,equipment:ENTITIES,orders:ENTITIES});
export function CustomerHierarchyProvider({customers,records,equipment=ENTITIES,orders=ENTITIES,children}:{customers:HierarchyCustomer[];records:HierarchyRecord[];equipment?:Record<string,unknown>[];orders?:Record<string,unknown>[];children:ReactNode}) {
  const value=useMemo(()=>({customers,records,equipment,orders}),[customers,records,equipment,orders]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useCustomerHierarchy=()=>useContext(Context);
