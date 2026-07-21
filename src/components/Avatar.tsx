import type { Camper } from "../api";
export function Avatar({c}:{c:Camper}){return <span className={"avatar "+(c.gender==="FEMALE"?"pink":"green")}>{c.name.split(" ").map(x=>x[0]).slice(0,2)}</span>}
