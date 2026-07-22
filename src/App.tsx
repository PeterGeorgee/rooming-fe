import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Users,
  Home,
  Upload,
  Shuffle,
  FileDown,
  Plus,
  AlertTriangle,
  Heart,
  HandHeart,
  MessageCircle,
  X,
  Trash2,
} from "lucide-react";
import { download, getAuthToken, setAuthToken, type AuthUser, type Camp, type Camper, type CampLeader, type Dashboard, type ImportResult, request } from "./api";
import { Avatar } from "./components/Avatar";
import { AppHeader } from "./components/AppHeader";
import { AppDialog, NoticePopup, type DialogState } from "./components/Feedback";
import { MobileCampControls, MobileNavigation, Sidebar, type View } from "./components/Navigation";
import { AuthScreen } from "./components/AuthScreen";
import { BrandLoader } from "./components/BrandLoader";
export default function App() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [camps, setCamps] = useState<Camp[]>([]),
    [campId, setCampId] = useState(""),
    [data, setData] = useState<Dashboard | null>(null),
    [view, setView] = useState<View>("Overview"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [modal, setModal] = useState<
      "camp" | "room" | "import" | "leader" | "leaderImport" | "groups" | "groupAuto" | "caring" | "assignRooms" | null
    >(null),
    [q, setQ] = useState("");
  const [leaderEdit, setLeaderEdit] = useState<Dashboard["rooms"][number] | null>(null);
  const [groupLeaderEdit, setGroupLeaderEdit] = useState<Dashboard["groups"][number] | null>(null);
  const [caringLeaderEdit, setCaringLeaderEdit] = useState<Dashboard["caringGroups"][number] | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const confirmPopup = (title: string, message: string, confirmLabel = "Confirm", cancelLabel = "Cancel") => new Promise<boolean>((resolve) => setDialog({ title, message, confirmLabel, cancelLabel, resolve: (value) => resolve(value === true) }));
  const promptPopup = (title: string, message: string, input: string) => new Promise<string | null>((resolve) => setDialog({ title, message, input, confirmLabel: "Save", cancelLabel: "Cancel", resolve: (value) => resolve(typeof value === "string" ? value : null) }));
  const codePopup = () => new Promise<string | null>((resolve) => setDialog({ title: "Join a camp", message: "Enter the 8-character code shared by the camp owner.", input: "", codeLength: 8, confirmLabel: "Join camp", cancelLabel: "Cancel", resolve: (value) => resolve(typeof value === "string" ? value : null) }));
  useEffect(() => {
    const expired = () => setUser(null);
    window.addEventListener("vault-auth-expired", expired);
    if (!getAuthToken()) setUser(null);
    else request<AuthUser>("/auth/me").then(setUser).catch(() => { setAuthToken(null); setUser(null); });
    return () => window.removeEventListener("vault-auth-expired", expired);
  }, []);
  const load = async (id = campId) => {
    if (!id) return;
    setBusy(true);
    try {
      setData(await request(`/camps/${id}/dashboard`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!user) return;
    setCamps([]); setCampId(""); setData(null);
    setBusy(true);
    request<Camp[]>("/camps")
      .then((x) => {
        setCamps(x);
        if (x[0]) setCampId(x[0].id);
        else setBusy(false);
      })
      .catch((e) => { setError(e.message); setBusy(false); });
  }, [user]);
  useEffect(() => {
    if (campId) load(campId);
  }, [campId]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const deleteCamp = async () => {
    const selected = camps.find((c) => c.id === campId);
    if (!selected || !(await confirmPopup("Delete camp", `Delete ${selected.name}? This permanently removes its campers, rooms, groups and assignments.`, "Delete camp"))) return;
    setBusy(true);
    try {
      await request<void>(`/camps/${campId}`, { method: "DELETE" });
      const remaining = camps.filter((c) => c.id !== campId);
      setCamps(remaining);
      setData(null);
      setCampId(remaining[0]?.id || "");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const search = useMemo(
    () =>
      q.length > 1
        ? data?.campers.filter((c) =>
            c.name.toLowerCase().includes(q.toLowerCase()),
          )
        : [],
    [q, data],
  );
  const logout = async () => { try { await request<void>("/auth/logout", {method:"POST"}); } catch {} setAuthToken(null); setUser(null); setCamps([]); setCampId(""); setData(null); };
  const joinCamp = async () => { const code=(await codePopup())?.trim().toUpperCase(); if(!code)return; try { const joined=await request<Camp>("/auth/join-camp",{method:"POST",body:JSON.stringify({code})}); const next=await request<Camp[]>("/camps"); setCamps(next); setCampId(joined.id); } catch(e){setError((e as Error).message)} };
  if (user === undefined) return <BrandLoader fullscreen label="Opening Vault HQ..."/>;
  if (!user) return <AuthScreen onAuth={setUser}/>;
  const navigationProps={view,setView,camps,campId,setCampId,deleteCamp,newCamp:()=>setModal("camp" as const),userName:user.name,joinCode:data?.camp.joinCode,joinCamp,logout,importFile:()=>setModal("import" as const),canImport:!!campId};
  return (
    <div className="app">
      <Sidebar {...navigationProps}/>
      <main>
        <AppHeader campName={data?.camp.name} view={view} query={q} setQuery={setQ} results={search||[]} selectCamper={(camper)=>{setView("Campers");setQ(camper.name)}} importFile={()=>setModal("import")} canImport={!!campId} userName={user.name} joinCamp={joinCamp} logout={logout}/>
        <MobileCampControls {...navigationProps}/>
        <section className="content">
          {!data ? (
            <Empty onCreate={() => setModal("camp")} />
          ) : (
            <>
              {view === "Overview" && (
                <Overview d={data}/>
              )}{" "}
              {view === "Campers" && (
                <Campers
                  d={data}
                  q={q}
                  infer={() =>
                    act(() =>
                      request(`/camps/${campId}/infer-genders`, {
                        method: "POST",
                      }),
                    )
                  }
                  updateGender={(id, gender) =>
                    act(() =>
                      request(`/campers/${id}/gender`, {
                        method: "PATCH",
                        body: JSON.stringify({ gender }),
                      }),
                    )
                  }
                  removeCamper={async (camper) => {
                    if (await confirmPopup("Remove camper", `Remove ${camper.name}? This also removes the camper from their room, discussion group and preference matches.`, "Remove camper"))
                      act(() => request(`/campers/${camper.id}`, { method: "DELETE" }));
                  }}
                />
              )}{" "}
              {view === "Leaders" && <Leaders leaders={data.leaders||[]} add={()=>setModal("leader")} importFile={()=>setModal("leaderImport")} edit={async leader=>{const name=(await promptPopup("Edit leader","Enter the leader's name.",leader.name))?.trim();if(name)act(()=>request(`/leaders/${leader.id}`,{method:"PATCH",body:JSON.stringify({name,gender:leader.gender})}))}} changeGender={(leader,gender)=>act(()=>request(`/leaders/${leader.id}`,{method:"PATCH",body:JSON.stringify({name:leader.name,gender})}))} remove={async leader=>{if(await confirmPopup("Delete leader",`Delete ${leader.name}?`,"Delete leader"))act(()=>request(`/leaders/${leader.id}`,{method:"DELETE"}))}}/>}{" "}
              {view === "Rooms" && (
                <Rooms
                  d={data}
                  add={() => setModal("room")}
                  rename={async (roomId, current) => {
                    const name = (await promptPopup("Rename room", "Enter the new room name.", current))?.trim();
                    if (name && name !== current)
                      act(() =>
                        request(`/rooms/${roomId}`, {
                          method: "PATCH",
                          body: JSON.stringify({ name }),
                        }),
                      );
                  }}
                  remove={async (roomId, name) => {
                    if (await confirmPopup("Delete room", `Delete ${name}? Campers in this room will become unassigned.`, "Delete room"))
                      act(() =>
                        request(`/rooms/${roomId}`, { method: "DELETE" }),
                      );
                  }}
                  move={(camper, roomId) =>
                    act(() =>
                      request(`/campers/${camper}/assignment`, {
                        method: "PATCH",
                        body: JSON.stringify({ roomId }),
                      }),
                    )
                  }
                  leader={setLeaderEdit}
                  busy={busy}
                  generate={() =>
                    act(() =>
                      request(`/camps/${campId}/assign/rooms`, {
                        method: "POST",
                        body: JSON.stringify({ leaders: [] }),
                      }),
                    )
                  }
                  autoLeaders={() => act(()=>request(`/camps/${campId}/rooms/leaders/auto`,{method:"POST"}))}
                />
              )}{" "}
              {view === "Discussion groups" && (
                <Groups d={data} generate={() => setModal("groups")} autoLeaders={()=>setModal("groupAuto")} editLeaders={setGroupLeaderEdit} />
              )}{" "}
              {view === "Caring" && (
                <Caring d={data} generate={() => setModal("caring")} editLeader={setCaringLeaderEdit} move={(camperId,caringGroupId)=>act(()=>request(`/campers/${camperId}/assignment`,{method:"PATCH",body:JSON.stringify({caringGroupId})}))}/>
              )}{" "}
              {view === "Review" && (
                <Review
                  d={data}
                  resolve={(pid, cid) =>
                    act(() =>
                      request(`/preferences/${pid}/resolve`, {
                        method: "PATCH",
                        body: JSON.stringify({ matchedCamperId: cid }),
                      }),
                    )
                  }
                />
              )}{" "}
              {view === "Exports" && <Exports id={campId} campName={data.camp.name} onError={setError}/>}
            </>
          )}
        </section>
      </main>
      <MobileNavigation view={view} setView={setView}/>
      {modal && (
        <Modal
          type={modal}
          rooms={data?.rooms || []}
          leaders={data?.leaders || []}
          close={() => setModal(null)}
          submit={async (body) => {
            let imported: ImportResult | undefined;
            await act(async () => {
              if (modal === "camp") {
                const c = await request<Camp>("/camps", {
                  method: "POST",
                  body: JSON.stringify(body),
                });
                setCamps((x) => [...x, c]);
                setCampId(c.id);
              } else if (modal === "room")
                await request(`/camps/${campId}/rooms/batch`, {
                  method: "POST",
                  body: JSON.stringify(body),
                });
              else if (modal === "assignRooms")
                await request(`/camps/${campId}/assign/rooms`, {
                  method: "POST",
                  body: JSON.stringify(body),
                });
              else if (modal === "groups")
                await request(`/camps/${campId}/assign/groups`, {
                  method: "POST",
                  body: JSON.stringify(body),
                });
              else if (modal === "groupAuto")
                await request(`/camps/${campId}/groups/leaders/auto`, {
                  method: "POST",
                  body: JSON.stringify(body),
                });
              else if (modal === "caring")
                await request(`/camps/${campId}/assign/caring`, {
                  method: "POST",
                  body: JSON.stringify(body),
                });
              else if (modal === "leader")
                await request(`/camps/${campId}/leaders`,{method:"POST",body:JSON.stringify(body)});
              else if (modal === "leaderImport") {const f=new FormData();f.append("file",body as File);await request(`/camps/${campId}/leaders/import`,{method:"POST",body:f});}
              else {
                const f = new FormData();
                f.append("file", body as File);
                imported = await request<ImportResult>(`/camps/${campId}/import`, {
                  method: "POST",
                  body: f,
                });
              }
            });
            setModal(null);
            if (imported && imported.missingCampers.length > 0) {
              const visibleNames = imported.missingCampers.slice(0, 12).map((camper) => camper.name).join(", ");
              const remaining = imported.missingCampers.length - 12;
              const removeMissing = await confirmPopup(
                "Campers missing from this file",
                `${imported.missingCampers.length} existing camper${imported.missingCampers.length === 1 ? " is" : "s are"} not in the newly uploaded sheet:\n\n${visibleNames}${remaining > 0 ? `, and ${remaining} more` : ""}\n\nWould you like to keep them in the camp or remove them?`,
                "Remove missing campers",
                "Keep campers",
              );
              if (removeMissing)
                await act(() => request("/campers", { method: "DELETE", body: JSON.stringify({ camperIds: imported!.missingCampers.map((camper) => camper.id) }) }));
            }
            if (imported && imported.added > 0 && imported.existingAssignments) {
              const regenerate = await confirmPopup(
                "New campers imported",
                `${imported.added} new camper${imported.added === 1 ? " was" : "s were"} added without duplicates. Choose how to handle room assignments.`,
                "Regenerate all rooms",
                "Assign new campers manually",
              );
              if (regenerate)
                await act(() => request(`/camps/${campId}/assign/rooms`, { method: "POST", body: JSON.stringify({ leaders: [] }) }));
              else setView("Rooms");
            }
          }}
        />
      )}
      {leaderEdit && data && (
        <RoomLeaderModal
          room={leaderEdit}
          rooms={data.rooms}
          leaders={data.leaders||[]}
          close={() => setLeaderEdit(null)}
          save={async (leaders) => {
            await act(() =>
              request(`/rooms/${leaderEdit.id}/leaders`, {
                method: "PUT",
                body: JSON.stringify({ leaders }),
              }),
            );
            setLeaderEdit(null);
          }}
        />
      )}
      {groupLeaderEdit && (
        <GroupLeaderModal
          group={groupLeaderEdit}
          leaders={data?.leaders||[]}
          close={() => setGroupLeaderEdit(null)}
          save={async (leaderIds) => {
            await act(() => request(`/groups/${groupLeaderEdit.id}/leaders`, { method: "PUT", body: JSON.stringify({ leaderIds }) }));
            setGroupLeaderEdit(null);
          }}
        />
      )}
      {caringLeaderEdit && (
        <CaringLeaderModal group={caringLeaderEdit} leaders={data?.leaders||[]} close={()=>setCaringLeaderEdit(null)} save={async(leaderId)=>{await act(()=>request(`/caring-groups/${caringLeaderEdit.id}/leader`,{method:"PATCH",body:JSON.stringify({leaderId})}));setCaringLeaderEdit(null)}}/>
      )}
      {error && <NoticePopup message={error} close={() => setError("")} />}
      {dialog && <AppDialog dialog={dialog} close={(value) => { dialog.resolve(value); setDialog(null); }} />}
      {busy && (
        <BrandLoader overlay label="Saving your changes..." />
      )}
    </div>
  );
}
function RoomLeaderModal({
  room,
  rooms,
  leaders: availableLeaders,
  close,
  save,
}: {
  room: Dashboard["rooms"][number];
  rooms: Dashboard["rooms"];
  leaders: CampLeader[];
  close: () => void;
  save: (leaders: { leaderId: string; sleepRoomId: string }[]) => Promise<void>;
}) {
  const matchingLeaders=availableLeaders.filter(leader=>leader.gender===room.gender);
  const [assignments, setAssignments] = useState(
    room.leaders.map((leader) => ({ leaderId: leader.leaderId||matchingLeaders.find(item=>item.name.toLowerCase()===leader.name.toLowerCase())?.id||"", sleepRoomId: leader.sleepRoomId || room.id })),
  );
  const eligible = rooms.filter((candidate) => candidate.gender === room.gender);
  return (
    <div className="backdrop" onMouseDown={close}>
      <form
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          save(assignments);
        }}
      >
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <h2>Room leaders</h2>
        <p className="modalintro">
          Add everyone responsible for {room.name} and choose where each leader sleeps.
        </p>
        {assignments.map((leader, index) => (
          <div className="leaderrow roomleaderrow" key={index}>
            <select required value={leader.leaderId} onChange={(event) => { const next=[...assignments]; next[index]={...leader,leaderId:event.target.value}; setAssignments(next); }}><option value="">Select leader</option>{matchingLeaders.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <select required value={leader.sleepRoomId} onChange={(event) => { const next=[...assignments]; next[index]={...leader,sleepRoomId:event.target.value}; setAssignments(next); }}>
              {eligible.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.occupancy}/{candidate.capacity})
                </option>
              ))}
            </select>
            <button type="button" className="removeroom" onClick={() => setAssignments(assignments.filter((_, i) => i !== index))}><Trash2 size={14}/>Remove</button>
          </div>
        ))}
        {matchingLeaders.length===0&&<p className="autherror">Add a {room.gender==="FEMALE"?"female":"male"} leader in the Leaders tab first.</p>}
        <button type="button" className="secondary" disabled={matchingLeaders.length===0} onClick={() => setAssignments([...assignments,{leaderId:matchingLeaders[0]?.id||"",sleepRoomId:eligible[0]?.id||""}])}><Plus size={14}/>Add leader</button>
        <button className="primary">Save leaders</button>
      </form>
    </div>
  );
}
function GroupLeaderModal({group,leaders:available,close,save}:{group:Dashboard["groups"][number];leaders:CampLeader[];close:()=>void;save:(leaderIds:string[])=>Promise<void>}) {
  const [leaderIds,setLeaderIds]=useState(group.leaders.map(name=>available.find(leader=>leader.name.toLowerCase()===name.toLowerCase())?.id||""));
  return <div className="backdrop" onMouseDown={close}><form className="modal" onMouseDown={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();save(leaderIds)}}><button type="button" className="close" onClick={close}><X/></button><h2>Group leaders</h2><p className="modalintro">Choose one or more people from the Leaders tab for {group.name}.</p>{leaderIds.map((leaderId,index)=><div className="leaderrow" key={index}><select required value={leaderId} onChange={e=>{const next=[...leaderIds];next[index]=e.target.value;setLeaderIds(next)}}><option value="">Select leader</option>{available.map(leader=><option key={leader.id} value={leader.id}>{leader.name} ({leader.gender==="FEMALE"?"Female":leader.gender==="MALE"?"Male":"Review gender"})</option>)}</select><button type="button" className="removeroom" onClick={()=>setLeaderIds(leaderIds.filter((_,i)=>i!==index))}><Trash2 size={14}/>Remove</button></div>)}{available.length===0&&<p className="autherror">Add leaders in the Leaders tab first.</p>}<button type="button" className="secondary" disabled={available.length===0} onClick={()=>setLeaderIds([...leaderIds,available[0]?.id||""])}><Plus size={14}/>Add leader</button><button className="primary">Save leaders</button></form></div>;
}
function CaringLeaderModal({group,leaders,close,save}:{group:Dashboard["caringGroups"][number];leaders:CampLeader[];close:()=>void;save:(leaderId:string)=>Promise<void>}) {
  const eligible=leaders.filter(leader=>leader.gender===group.gender);const [leaderId,setLeaderId]=useState(group.leaderId||eligible.find(leader=>leader.name.toLowerCase()===group.leaderName.toLowerCase())?.id||"");
  return <div className="backdrop" onMouseDown={close}><form className="modal" onMouseDown={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();save(leaderId)}}><button type="button" className="close" onClick={close}><X/></button><h2>Edit Caring leader</h2><p className="modalintro">Choose the leader responsible for {group.name}.</p><label>Leader<select required value={leaderId} onChange={e=>setLeaderId(e.target.value)}><option value="">Select leader</option>{eligible.map(leader=><option key={leader.id} value={leader.id}>{leader.name}</option>)}</select></label><button className="primary">Save leader</button></form></div>;
}
function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty">
      <img className="emptylogo" src="/vault-hq-logo.png" alt="Vault HQ" />
      <h2>Start your first camp</h2>
      <p>Create a camp, configure rooms, then import your Excel camper list.</p>
      <button className="primary" onClick={onCreate}>
        <Plus size={16} />
        Create camp
      </button>
    </div>
  );
}
function Overview({d}: {d: Dashboard}) {
  return (
    <>
      <div className="hero">
        <div>
          <h2>Welcome back.</h2>
          <p>
            {d.stats.ambiguous + d.stats.unresolved
              ? `${d.stats.ambiguous + d.stats.unresolved} preferences need your attention.`
              : "Everything is ready for review."}
          </p>
        </div>
        <div className="score">
          <b>{d.stats.satisfaction}%</b>
          <span>friend satisfaction</span>
        </div>
      </div>
      <div className="stats">
        <Stat
          icon={<Users />}
          n={d.stats.total}
          label="Campers"
          note={`${d.stats.girls} girls  |  ${d.stats.boys} boys`}
        />
        <Stat
          icon={<Home />}
          n={d.rooms.length}
          label="Rooms"
          note={`${d.rooms.reduce((n, r) => n + r.capacity, 0)} total beds`}
        />
        <Stat
          icon={<Heart />}
          n={d.stats.matched}
          label="Matched requests"
          note={`${d.stats.ambiguous} ambiguous`}
        />
        <Stat
          icon={<MessageCircle />}
          n={d.groups.length}
          label="Discussion groups"
          note={`Average age ${d.stats.averageAge}`}
        />
      </div>
      <div className="panel">
        <div className="panelhead">
          <div>
            <h3>Room assignments</h3>
            <p>Current room assignment summary</p>
          </div>
        </div>
        <RoomTable rooms={d.rooms} />
      </div>
    </>
  );
}
function Stat({
  icon,
  n,
  label,
  note,
}: {
  icon: ReactNode;
  n: number;
  label: string;
  note: string;
}) {
  return (
    <article className="stat">
      <i>{icon}</i>
      <b>{n}</b>
      <span>{label}</span>
      <small>{note}</small>
    </article>
  );
}
function RoomTable({ rooms }: { rooms: Dashboard["rooms"] }) {
  return (
    <div className="roomlist">
      {rooms.map((r) => (
        <div className="room" key={r.id}>
          <span className="roomicon">
            <Home size={17} />
          </span>
          <div>
            <b>{r.name}</b>
            <small>
              {r.gender === "FEMALE" ? "Girls" : "Boys"}
              {r.leaders.length ? ` | Leaders: ${r.leaders.map((leader) => leader.name).join(", ")}` : ""}
            </small>
          </div>
          <div>
            <b>
              {r.occupancy} / {r.capacity}
            </b>
            <progress value={r.occupancy} max={r.capacity} />
          </div>
          <div>
            <b>{r.averageAge || "-"}</b>
            <small>average age</small>
          </div>
          <div className="avatars">
            {r.campers.slice(0, 5).map((c) => (
              <Avatar key={c.id} c={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
function Campers({
  d,
  q,
  infer,
  updateGender,
  removeCamper,
}: {
  d: Dashboard;
  q: string;
  infer: () => void;
  updateGender: (id: string, gender: "MALE" | "FEMALE") => void;
  removeCamper: (camper: Camper) => void;
}) {
  const cs =
    q.length > 1
      ? d.campers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
      : d.campers;
  const reviews = d.stats.unknownGender + d.stats.assumedGender;
  return (
    <div className="panel">
      <div className="panelhead">
        <div>
          <h3>All campers</h3>
          <p>
            {cs.length} records{reviews ? ` | ${reviews} gender reviews` : ""}
          </p>
        </div>
        {d.stats.unknownGender > 0 && (
          <button className="primary" onClick={infer}>
            Suggest genders
          </button>
        )}
      </div>
      <table>
        <thead>
          <tr>
            <th>Camper</th>
            <th>Age</th>
            <th>Gender</th>
            <th>Preferences</th>
            <th>Room</th>
            <th>Group</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cs.map((c) => (
            <tr key={c.id}>
              <td>
                <Avatar c={c} />
                <b>{c.name}</b>
              </td>
              <td>{c.age}</td>
              <td>
                <div className="genderedit">
                  <select
                    value={c.gender === "UNKNOWN" ? "" : c.gender}
                    onChange={(e) =>
                      updateGender(c.id, e.target.value as "MALE" | "FEMALE")
                    }
                  >
                    <option value="" disabled>
                      Needs review
                    </option>
                    <option value="FEMALE">Girl</option>
                    <option value="MALE">Boy</option>
                  </select>
                  {c.genderAssumed && (
                    <>
                      <span>Assumed</span>
                      <button
                        onClick={() =>
                          updateGender(c.id, c.gender as "MALE" | "FEMALE")
                        }
                      >
                        Confirm
                      </button>
                    </>
                  )}
                </div>
              </td>
              <td>
                {c.preferences
                  .map((p) => p.matchedName || p.rawName)
                  .join(", ") || "-"}
              </td>
              <td>{c.room || "Unassigned"}</td>
              <td>{c.group || "Unassigned"}</td>
              <td>
                <button className="deletecamper" onClick={() => removeCamper(c)} aria-label={`Remove ${c.name}`}>
                  <Trash2 size={15}/><span>Remove</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Rooms({
  d,
  add,
  rename,
  remove,
  move,
  leader,
  busy,
  generate,
  autoLeaders,
}: {
  d: Dashboard;
  add: () => void;
  rename: (id: string, current: string) => void;
  remove: (id: string, name: string) => void;
  move: (id: string, rid: string) => void;
  leader: (room: Dashboard["rooms"][number]) => void;
  busy: boolean;
  generate: () => void;
  autoLeaders: () => void;
}) {
  const unassigned = d.campers.filter((camper) => !camper.roomId);
  const generated = d.campers.some((camper) => camper.roomId);
  return (
    <>
      <div className="toolbar">
        <button className="primary" disabled={busy} onClick={generate}>
          <Shuffle size={15}/>
          {generated ? "Regenerate rooms" : "Generate rooms"}
        </button>
        <button className="secondary" disabled={busy||d.rooms.every(room=>room.campers.length===0)} onClick={autoLeaders}>
          <Users size={15}/>
          Auto assign leaders
        </button>
        <button className="primary" onClick={add}>
          <Plus size={15} />
          Add rooms
        </button>
      </div>
      <div className="cards">
        {unassigned.length > 0 && (
          <article className="roomcard scrollable unassignedcard">
            <header>
              <div>
                <h3>Unassigned campers</h3>
                <p>{unassigned.length} waiting for manual room assignment</p>
              </div>
              <Users />
            </header>
            <div className="roommembers">
              {unassigned.map((camper) => (
                <div className="person" key={camper.id}>
                  <Avatar c={camper} />
                  <span><b>{camper.name}</b><small>Age {camper.age}</small></span>
                  <select value="" onChange={(event) => move(camper.id, event.target.value)}>
                    <option value="" disabled>Select room</option>
                    {d.rooms.filter((room) => room.gender === camper.gender).map((room) => (
                      <option key={room.id} value={room.id}>{room.name} ({room.occupancy}/{room.capacity})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </article>
        )}
        {d.rooms.map((r) => (
          <article className="roomcard scrollable" key={r.id}>
            <header>
              <div>
                <h3>{r.name}</h3>
                <p>
                  {r.gender === "FEMALE" ? "Girls" : "Boys"} | {r.occupancy}/
                  {r.capacity}
                </p>
                {r.leaders.length > 0 && (
                  <p>
                    <b>Leaders:</b> {r.leaders.map((leader) => leader.sleepRoom?`${leader.name} (sleeps in ${leader.sleepRoom})`:leader.name).join(", ")}
                  </p>
                )}
                <div className="roomactions">
                  <button
                    className="rename"
                    onClick={() => leader(r)}
                  >
                    {r.leaders.length ? "Change leaders" : "Assign leaders"}
                  </button>
                  <button
                    className="rename"
                    onClick={() => rename(r.id, r.name)}
                  >
                    Rename
                  </button>
                  <button
                    className="removeroom"
                    onClick={() => remove(r.id, r.name)}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>
              <Home />
            </header>
            <div className="roommembers">
              {r.campers.map((c) => (
                <div className="person" key={c.id}>
                  <Avatar c={c} />
                  <span>
                    <b>{c.name}</b>
                    <small>Age {c.age}</small>
                  </span>
                  <select
                    value={r.id}
                    onChange={(e) => move(c.id, e.target.value)}
                  >
                    {d.rooms
                      .filter((x) => x.gender === r.gender)
                      .map((x) => (
                        <option value={x.id} key={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
function Leaders({leaders,add,importFile,edit,changeGender,remove}:{leaders:(CampLeader&{genderAssumed?:boolean})[];add:()=>void;importFile:()=>void;edit:(leader:CampLeader)=>void;changeGender:(leader:CampLeader,gender:"MALE"|"FEMALE")=>void;remove:(leader:CampLeader)=>void}) {
  const needsReview=leaders.filter(leader=>leader.genderAssumed).length;
  return <div className="panel"><div className="panelhead"><div><h3>Camp leaders</h3><p>{leaders.length} leaders available for Rooms, Discussion Groups, and Caring{needsReview>0&&` · ${needsReview} assumed gender${needsReview===1?"":"s"} need review`}</p></div><div className="assignmentactions"><button className="secondary leader-import" onClick={importFile}><Upload size={15}/>Import leaders</button><button className="primary" onClick={add}><Plus size={15}/>Add leader</button></div></div>{leaders.length===0?<div className="done">Add leaders individually or import a sheet with a <b>Name</b> column. Gender is optional and will be assumed when missing.</div>:<table className="leaderstable"><thead><tr><th>Leader</th><th>Gender</th><th>Actions</th></tr></thead><tbody>{leaders.map(leader=><tr key={leader.id}><td><span className={`avatar ${leader.gender==="FEMALE"?"pink":"green"}`}>{leader.name.split(/\s+/).map(part=>part[0]).join("").slice(0,2)}</span><b>{leader.name}</b>{leader.genderAssumed&&<span className="assumedgender">Assumed · needs review</span>}</td><td><div className="leadergender"><select value={leader.gender} onChange={e=>changeGender(leader,e.target.value as "MALE"|"FEMALE")}><option value="FEMALE">Female</option><option value="MALE">Male</option></select>{leader.genderAssumed&&<button className="rename" onClick={()=>changeGender(leader,leader.gender as "MALE"|"FEMALE")}>Confirm</button>}</div></td><td><div className="leaderactions"><button className="rename" onClick={()=>edit(leader)}>Rename</button><button className="deletecamper" onClick={()=>remove(leader)}><Trash2 size={14}/>Delete</button></div></td></tr>)}</tbody></table>}</div>;
}
function Groups({ d, generate, autoLeaders, editLeaders }: { d: Dashboard; generate: () => void; autoLeaders:()=>void; editLeaders: (group: Dashboard["groups"][number]) => void }) {
  return (
    <>
      <div className="toolbar">
        <button className="primary" onClick={generate}>
          <Shuffle size={15} />
          Generate groups
        </button>
        <button className="secondary" disabled={d.groups.length===0} onClick={autoLeaders}>
          <Users size={15}/>
          Auto assign leaders
        </button>
      </div>
      <div className="cards">
        {d.groups.map((g) => (
          <article className="roomcard" key={g.id}>
            <header>
              <div>
                <h3>{g.name}</h3>
                <p>
                  {g.occupancy} campers | avg {g.averageAge}
                </p>
                {g.leaders.length > 0 && <p><b>Leaders:</b> {g.leaders.join(", ")}</p>}
                <button className="rename" onClick={() => editLeaders(g)}>{g.leaders.length ? "Change leaders" : "Assign leaders"}</button>
              </div>
              <MessageCircle />
            </header>
            {g.campers.map((c) => (
              <div className="person" key={c.id}>
                <Avatar c={c} />
                <span>
                  <b>{c.name}</b>
                  <small>{c.room}</small>
                </span>
              </div>
            ))}
          </article>
        ))}
      </div>
    </>
  );
}
function Caring({d,generate,editLeader,move}:{d:Dashboard;generate:()=>void;editLeader:(group:Dashboard["caringGroups"][number])=>void;move:(camperId:string,caringGroupId:string)=>void}) {
  const caringGroups=d.caringGroups||[];
  const generated=caringGroups.length>0;
  const unassigned=d.campers.filter(camper=>!camper.caringGroupId);
  const member=(camper:Camper,current="")=><div className="person" key={camper.id}><Avatar c={camper}/><span><b>{camper.name}</b><small>{camper.room||camper.group||`Age ${camper.age}`}</small></span><select value={current} aria-label={`Assign ${camper.name} to a Caring group`} onChange={e=>move(camper.id,e.target.value)}><option value="" disabled>Select group</option>{caringGroups.filter(candidate=>candidate.gender===camper.gender).map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.occupancy})</option>)}</select></div>;
  return <>
    <div className="caringintro"><div><span><HandHeart size={21}/></span><h2>Caring groups</h2><p>Every camper has one gender-matched leader. Groups are balanced and follow room assignments first, then discussion groups.</p></div><button className="primary" onClick={generate}><Shuffle size={15}/>{generated?"Regenerate Caring":"Generate Caring"}</button></div>
    {!generated?<div className="empty caringempty"><HandHeart size={42}/><h2>No Caring groups yet</h2><p>Add the male and female leaders who will care for campers, then generate balanced groups.</p><button className="primary" onClick={generate}><Plus size={16}/>Add Caring leaders</button></div>:
    <div className="cards caringcards">
      {unassigned.length>0&&<article className="roomcard scrollable caringcard unassignedcard"><header><div><small>Needs attention</small><h3>Unassigned campers</h3><p>{unassigned.length} campers need a Caring leader</p></div><Users/></header><div className="roommembers">{unassigned.map(camper=>member(camper))}</div></article>}
      {caringGroups.map(group=><article className="roomcard scrollable caringcard" key={group.id}><header><div><small>{group.gender==="FEMALE"?"Female":"Male"} Caring</small><h3>{group.name}</h3><p>{group.occupancy} campers | Average age {group.averageAge||"-"}</p><p className="caringleader"><b>Leader:</b> {group.leaderName}</p><button className="rename" onClick={()=>editLeader(group)}>Edit leader</button></div><HandHeart/></header><div className="roommembers">{group.campers.map(camper=>member(camper,group.id))}</div></article>)}
    </div>}
  </>;
}
function Review({
  d,
  resolve,
}: {
  d: Dashboard;
  resolve: (p: string, c: string) => void;
}) {
  const issues = d.campers.flatMap((c) =>
    c.preferences.filter((p) => p.status !== "MATCHED").map((p) => ({ c, p })),
  );
  return (
    <div className="panel review">
      <div className="panelhead">
        <div>
          <h3>Preference review</h3>
          <p>{issues.length} items need a decision</p>
        </div>
      </div>
      {issues.length === 0 ? (
        <div className="done">All roommate names are resolved.</div>
      ) : (
        issues.map(({ c, p }) => (
          <div className="issue" key={p.id}>
            <AlertTriangle />
            <div>
              <b>
                {c.name} requested &quot;{p.rawName}&quot;
              </b>
              <p>
                {p.status === "AMBIGUOUS"
                  ? "Choose the intended camper"
                  : "No confident match was found"}
              </p>
            </div>
            {p.alternatives.map((id) => {
              const x = d.campers.find((c) => c.id === id);
              return x ? (
                <button onClick={() => resolve(p.id, id)} key={id}>
                  {x.name}
                </button>
              ) : null;
            })}
          </div>
        ))
      )}
    </div>
  );
}
function Exports({ id, campName, onError }: { id: string; campName:string; onError:(message:string)=>void }) {
  const [downloading,setDownloading]=useState(false);
  const get=async(kind:"rooms"|"groups"|"caring")=>{setDownloading(true);try{await download(`/camps/${id}/exports/${kind}.pdf`,`${campName}-${kind}.pdf`)}catch(e){onError((e as Error).message)}finally{setDownloading(false)}};
  return (
    <><div className="exportgrid">
      <button onClick={()=>get("rooms")}>
        <Home />
        <b>Room assignment PDF</b>
        <span>Members, ages, capacity and page numbers</span>
        <FileDown />
      </button>
      <button onClick={()=>get("groups")}>
        <MessageCircle />
        <b>Discussion group PDF</b>
        <span>Balanced groups and average ages</span>
        <FileDown />
      </button>
      <button onClick={()=>get("caring")}>
        <HandHeart />
        <b>Caring groups PDF</b>
        <span>Leaders, members, genders and average ages</span>
        <FileDown />
      </button>
    </div>{downloading&&<BrandLoader overlay label="Preparing your PDF..."/>}</>
  );
}
function Modal({
  type,
  rooms,
  leaders,
  close,
  submit,
}: {
  type: string;
  rooms: Dashboard["rooms"];
  leaders: CampLeader[];
  close: () => void;
  submit: (x: any) => Promise<void>;
}) {
  const [f, setF] = useState<any>({
      name: "",
      startDate: "",
      endDate: "",
      description: "",
      count: 1,
      capacity: 8,
      gender: "FEMALE",
      numberOfGroups: 6,
      membersPerGroup: null,
      genderSeparated: false,
      girlLeaders: [],
      boyLeaders: [],
      caringLeaderIds: [],
      groupLeaderIds: [],
    }),
    [file, setFile] = useState<File>();
  const setLeaderCount = (gender: "FEMALE" | "MALE", count: number) => {
    const key = gender === "FEMALE" ? "girlLeaders" : "boyLeaders";
    const eligible = rooms.filter((room) => room.gender === gender);
    const current = f[key];
    setF({
      ...f,
      [key]: Array.from(
        { length: count },
        (_, i) => current[i] || { name: "", roomId: eligible[i]?.id || "" },
      ),
    });
  };
  const leaderSection = (gender: "FEMALE" | "MALE", title: string) => {
    const key = gender === "FEMALE" ? "girlLeaders" : "boyLeaders";
    const leaders = f[key];
    const eligible = rooms.filter((room) => room.gender === gender);
    return (
      <section className="leadersection">
        <h3>{title}</h3>
        <label>
          Number of {title.toLowerCase()}
          <input
            min="0"
            max={eligible.length}
            type="number"
            value={leaders.length}
            onChange={(e) => setLeaderCount(gender, +e.target.value)}
          />
        </label>
        {leaders.map((leader: any, i: number) => (
          <div className="leaderrow" key={i}>
            <input
              required
              placeholder={`${title.slice(0, -1)} ${i + 1} name`}
              value={leader.name}
              onChange={(e) => {
                const next = [...leaders];
                next[i] = { ...next[i], name: e.target.value };
                setF({ ...f, [key]: next });
              }}
            />
            <select
              required
              value={leader.roomId}
              onChange={(e) => {
                const next = [...leaders];
                next[i] = { ...next[i], roomId: e.target.value };
                setF({ ...f, [key]: next });
              }}
            >
              <option value="">Select room</option>
              {eligible
                .filter(
                  (room) =>
                    !leaders.some(
                      (other: any, j: number) =>
                        j !== i && other.roomId === room.id,
                    ),
                )
                .map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} ({room.occupancy}/{room.capacity})
                  </option>
                ))}
            </select>
          </div>
        ))}
      </section>
    );
  };
  const caringLeaderSection=(gender:"FEMALE"|"MALE",title:string)=>{
    const eligible=leaders.filter(leader=>leader.gender===gender);
    const eligibleIds=eligible.map(leader=>leader.id);
    const allSelected=eligibleIds.length>0&&eligibleIds.every(id=>f.caringLeaderIds.includes(id));
    const toggleAll=()=>setF({...f,caringLeaderIds:allSelected
      ? f.caringLeaderIds.filter((id:string)=>!eligibleIds.includes(id))
      : Array.from(new Set([...f.caringLeaderIds,...eligibleIds]))});
    return <section className="leadersection"><div className="leadersectionhead"><h3>{title}</h3>{eligible.length>0&&<button type="button" className="selectallleaders" onClick={toggleAll}>{allSelected?"Clear all":"Select all"}</button>}</div>{eligible.length===0?<p className="modalintro">No {title.toLowerCase()} are available. Add them from the Leaders tab.</p>:eligible.map(leader=><label className="leaderchoice" key={leader.id}><input type="checkbox" checked={f.caringLeaderIds.includes(leader.id)} onChange={e=>setF({...f,caringLeaderIds:e.target.checked?[...f.caringLeaderIds,leader.id]:f.caringLeaderIds.filter((id:string)=>id!==leader.id)})}/><span>{leader.name}</span></label>)}</section>;
  };
  const groupLeaderSection=(gender:"FEMALE"|"MALE",title:string)=>{
    const eligible=leaders.filter(leader=>leader.gender===gender);
    const eligibleIds=eligible.map(leader=>leader.id);
    const allSelected=eligibleIds.length>0&&eligibleIds.every(id=>f.groupLeaderIds.includes(id));
    const toggleAll=()=>setF({...f,groupLeaderIds:allSelected
      ? f.groupLeaderIds.filter((id:string)=>!eligibleIds.includes(id))
      : Array.from(new Set([...f.groupLeaderIds,...eligibleIds]))});
    return <section className="leadersection"><div className="leadersectionhead"><h3>{title}</h3>{eligible.length>0&&<button type="button" className="selectallleaders" onClick={toggleAll}>{allSelected?"Clear all":"Select all"}</button>}</div>{eligible.length===0?<p className="modalintro">No {title.toLowerCase()} are available. Add them from the Leaders tab.</p>:eligible.map(leader=><label className="leaderchoice" key={leader.id}><input type="checkbox" checked={f.groupLeaderIds.includes(leader.id)} onChange={e=>setF({...f,groupLeaderIds:e.target.checked?[...f.groupLeaderIds,leader.id]:f.groupLeaderIds.filter((id:string)=>id!==leader.id)})}/><span>{leader.name}</span></label>)}</section>;
  };
  return (
    <div className="backdrop" onMouseDown={close}>
      <form
        className={`modal ${type === "assignRooms" ? "leadermodal" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          submit(
            type === "import"||type==="leaderImport"
              ? file
              : type === "assignRooms"
                ? { leaders: [...f.girlLeaders, ...f.boyLeaders] }
                : type === "groupAuto"
                  ? {leaderIds:f.groupLeaderIds}
                : type === "caring"
                  ? {leaderIds:f.caringLeaderIds}
                : f,
          );
        }}
      >
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <h2>
          {type === "camp"
            ? "Create camp"
            : type === "leader"
              ? "Add leader"
            : type === "leaderImport"
              ? "Import leaders"
            : type === "room"
              ? "Add a room"
              : type === "groups"
                ? "Generate discussion groups"
                : type === "groupAuto"
                  ? "Auto assign group leaders"
                : type === "caring"
                  ? "Generate Caring groups"
                : type === "assignRooms"
                  ? "Assign room leaders"
                  : "Import campers"}
        </h2>
        {type === "camp" && (
          <>
            <input
              required
              placeholder="Camp name"
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
            <div className="two">
              <label>
                Start date
                <input
                  required
                  type="date"
                  onChange={(e) => setF({ ...f, startDate: e.target.value })}
                />
              </label>
              <label>
                End date
                <input
                  required
                  type="date"
                  onChange={(e) => setF({ ...f, endDate: e.target.value })}
                />
              </label>
            </div>
            <textarea
              placeholder="Description (optional)"
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </>
        )}
        {type === "leader"&&<><label>Leader name<input required placeholder="Leader name" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Gender<select value={f.gender} onChange={e=>setF({...f,gender:e.target.value})}><option value="FEMALE">Female</option><option value="MALE">Male</option></select></label></>}
        {type === "room" && (
          <>
            <label>
              Number of rooms
              <input
                required
                min="1"
                max="100"
                type="number"
                value={f.count}
                onChange={(e) => setF({ ...f, count: +e.target.value })}
              />
            </label>
            <label>
              Capacity per room
              <input
                required
                min="1"
                type="number"
                value={f.capacity}
                onChange={(e) => setF({ ...f, capacity: +e.target.value })}
              />
            </label>
            <label>
              Room gender
              <select
                value={f.gender}
                onChange={(e) => setF({ ...f, gender: e.target.value })}
              >
                <option value="FEMALE">Girls</option>
                <option value="MALE">Boys</option>
              </select>
            </label>
            <small>
              Rooms will be named Room 1, Room 2, and so on. You can rename them
              afterward.
            </small>
          </>
        )}
        {type === "assignRooms" && (
          <div className="leaderbody">
            <p className="modalintro">
              Rooms have already been generated. Add leaders below; every leader
              uses one bed in a matching-gender room.
            </p>
            {leaderSection("FEMALE", "Women leaders")}
            {leaderSection("MALE", "Men leaders")}
          </div>
        )}
        {type === "groups" && (
          <>
            <label>
              Number of groups
              <input
                min="1"
                type="number"
                value={f.numberOfGroups}
                onChange={(e) =>
                  setF({
                    ...f,
                    numberOfGroups: +e.target.value,
                    membersPerGroup: null,
                  })
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                onChange={(e) =>
                  setF({ ...f, genderSeparated: e.target.checked })
                }
              />
              Gender-separated groups
            </label>
          </>
        )}
        {type === "caring" && <div className="leaderbody"><p className="modalintro">Select leaders from the Leaders tab. One balanced, gender-matched camper group will be created for each selected leader.</p>{caringLeaderSection("FEMALE","Female leaders")}{caringLeaderSection("MALE","Male leaders")}</div>}
        {type === "groupAuto" && <div className="leaderbody"><p className="modalintro">Choose the available discussion-group leaders. Girls' groups receive only female leaders and boys' groups receive only male leaders. Each selected leader is assigned to one group, and each gender needs at least one leader per matching group.</p>{groupLeaderSection("FEMALE","Female leaders")}{groupLeaderSection("MALE","Male leaders")}</div>}
        {(type === "import"||type==="leaderImport") && (
          <label className="drop">
            <Upload />
            <b>{file?.name || "Choose .csv, .xlsx or .xls file"}</b>
            <span>
              {type==="leaderImport"?"Use a Name column. Gender is optional; missing genders will be assumed and marked for review.":"Airtable Team view exports are supported; missing genders can be reviewed after upload"}
            </span>
            <input
              required
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </label>
        )}
        <button className="primary" disabled={((type === "import"||type==="leaderImport") && !file)||(type === "caring"&&f.caringLeaderIds.length===0)||(type === "groupAuto"&&f.groupLeaderIds.length===0)}>
          Save and continue
        </button>
      </form>
    </div>
  );
}
