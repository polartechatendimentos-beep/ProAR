"use client";
import {MobileRouteControls} from "./MobileRouteControls";
import {MobileToday} from "./MobileToday";
import Home from "@/app/page";
import {useEffect} from "react";

// /mobile is only another interface over the same ProAR domain data.
// It never owns a second OS, stock, finance or customer database.
export function ProARMobile(){
 useEffect(()=>{document.documentElement.dataset.proarExperience="mobile";return()=>{delete document.documentElement.dataset.proarExperience}},[]);
 return <div className="proar-mobile-entry"><MobileRouteControls/><Home/></div>;
}
