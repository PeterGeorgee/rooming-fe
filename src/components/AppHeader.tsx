import { useEffect, useRef, useState } from "react";
import { LogOut, Search, Upload, UserPlus, X } from "lucide-react";
import type { Camper } from "../api";
import type { View } from "./Navigation";
import { Avatar } from "./Avatar";

type Props={campName?:string;view:View;query:string;setQuery:(value:string)=>void;results:Camper[];selectCamper:(camper:Camper)=>void;importFile:()=>void;canImport:boolean;userName:string;joinCamp:()=>void;logout:()=>void};

export function AppHeader({campName,view,query,setQuery,results,selectCamper,importFile,canImport,userName,joinCamp,logout}:Props){
  const searchRef=useRef<HTMLDivElement>(null);
  const [resultsOpen,setResultsOpen]=useState(false);
  useEffect(()=>{
    const closeResults=(event:PointerEvent)=>{if(!searchRef.current?.contains(event.target as Node))setResultsOpen(false)};
    document.addEventListener("pointerdown",closeResults);
    return()=>document.removeEventListener("pointerdown",closeResults);
  },[]);
  const clearSearch=()=>{setQuery("");setResultsOpen(false)};
  const chooseCamper=(camper:Camper)=>{selectCamper(camper);setResultsOpen(false)};
  return <header>
    <div><img className="mobile-header-logo" src="/vault-hq-logo.png" alt="Vault HQ"/><small className="header-camp-name">{campName||"VAULT HQ"}</small><h1>{view}</h1></div>
    <div className="mobile-header-account"><b>{userName}</b><button onClick={joinCamp} aria-label="Join camp"><UserPlus size={17}/></button><button onClick={logout} aria-label="Sign out"><LogOut size={17}/></button></div>
    <div className="search" ref={searchRef}><Search className="searchicon" size={16}/><input aria-label="Search campers" placeholder="Search campers" value={query} onFocus={()=>query.length>1&&setResultsOpen(true)} onChange={e=>{setQuery(e.target.value);setResultsOpen(true)}}/>{query&&<button type="button" className="searchclear" aria-label="Clear camper search" onClick={clearSearch}><X size={15}/></button>}{resultsOpen&&results.length>0&&<div className="results">{results.map(camper=><button key={camper.id} onClick={()=>chooseCamper(camper)}><Avatar c={camper}/><span><b>{camper.name}</b><small>{camper.room||"Unassigned"} | {camper.group||"No group"}{camper.caringGroup?` | ${camper.caringGroup}`:""}</small></span></button>)}</div>}</div>
    <button className="primary header-import" onClick={importFile} disabled={!canImport}><Upload size={16}/>Import campers</button>
  </header>;
}
