import { Search, Upload } from "lucide-react";
import type { Camper } from "../api";
import type { View } from "./Navigation";
import { Avatar } from "./Avatar";

type Props={campName?:string;view:View;query:string;setQuery:(value:string)=>void;results:Camper[];selectCamper:(camper:Camper)=>void;importFile:()=>void;canImport:boolean};
export function AppHeader({campName,view,query,setQuery,results,selectCamper,importFile,canImport}:Props){return <header><div><img className="mobile-header-logo" src="/vault-hq-logo.png" alt="Vault HQ"/><small className="header-camp-name">{campName||"VAULT HQ"}</small><h1>{view}</h1></div><div className="search"><Search size={16}/><input aria-label="Search campers" placeholder="Search campers" value={query} onChange={e=>setQuery(e.target.value)}/>{results.length>0&&<div className="results">{results.map(camper=><button key={camper.id} onClick={()=>selectCamper(camper)}><Avatar c={camper}/><span><b>{camper.name}</b><small>{camper.room||"Unassigned"} | {camper.group||"No group"}</small></span></button>)}</div>}</div><button className="primary" onClick={importFile} disabled={!canImport}><Upload size={16}/>Import file</button></header>}
