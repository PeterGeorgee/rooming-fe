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
  MessageCircle,
  RefreshCw,
  X,
  Trash2,
} from "lucide-react";
import { API, type Camp, type Camper, type Dashboard, type ImportResult, request } from "./api";
import { Avatar } from "./components/Avatar";
import { AppHeader } from "./components/AppHeader";
import { AppDialog, NoticePopup, type DialogState } from "./components/Feedback";
import { MobileCampControls, MobileNavigation, Sidebar, type View } from "./components/Navigation";
export default function App() {
  const [camps, setCamps] = useState<Camp[]>([]),
    [campId, setCampId] = useState(""),
    [data, setData] = useState<Dashboard | null>(null),
    [view, setView] = useState<View>("Overview"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [modal, setModal] = useState<
      "camp" | "room" | "import" | "groups" | "assignRooms" | null
    >(null),
    [q, setQ] = useState("");
  const [leaderEdit, setLeaderEdit] = useState<Dashboard["rooms"][number] | null>(null);
  const [groupLeaderEdit, setGroupLeaderEdit] = useState<Dashboard["groups"][number] | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const confirmPopup = (title: string, message: string, confirmLabel = "Confirm", cancelLabel = "Cancel") => new Promise<boolean>((resolve) => setDialog({ title, message, confirmLabel, cancelLabel, resolve: (value) => resolve(value === true) }));
  const promptPopup = (title: string, message: string, input: string) => new Promise<string | null>((resolve) => setDialog({ title, message, input, confirmLabel: "Save", cancelLabel: "Cancel", resolve: (value) => resolve(typeof value === "string" ? value : null) }));
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
    request<Camp[]>("/camps")
      .then((x) => {
        setCamps(x);
        if (x[0]) setCampId(x[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);
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
  return (
    <div className="app">
      <Sidebar view={view} setView={setView} camps={camps} campId={campId} setCampId={setCampId} deleteCamp={deleteCamp} newCamp={()=>setModal("camp")}/>
      <main>
        <AppHeader campName={data?.camp.name} view={view} query={q} setQuery={setQ} results={search||[]} selectCamper={(camper)=>{setView("Campers");setQ(camper.name)}} importFile={()=>setModal("import")} canImport={!!campId}/>
        <MobileCampControls camps={camps} campId={campId} setCampId={setCampId} deleteCamp={deleteCamp} newCamp={()=>setModal("camp")}/>
        <section className="content">
          {!data ? (
            <Empty onCreate={() => setModal("camp")} />
          ) : (
            <>
              {view === "Overview" && (
                <Overview
                  d={data}
                  busy={busy}
                  generate={() =>
                    act(() =>
                      request(`/camps/${campId}/assign/rooms`, {
                        method: "POST",
                        body: JSON.stringify({ leaders: [] }),
                      }),
                    )
                  }
                />
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
                />
              )}{" "}
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
                />
              )}{" "}
              {view === "Discussion groups" && (
                <Groups d={data} generate={() => setModal("groups")} editLeaders={setGroupLeaderEdit} />
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
              {view === "Exports" && <Exports id={campId} />}
            </>
          )}
        </section>
      </main>
      <MobileNavigation view={view} setView={setView}/>
      {modal && (
        <Modal
          type={modal}
          rooms={data?.rooms || []}
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
          close={() => setGroupLeaderEdit(null)}
          save={async (leaders) => {
            await act(() => request(`/groups/${groupLeaderEdit.id}/leaders`, { method: "PUT", body: JSON.stringify({ leaders }) }));
            setGroupLeaderEdit(null);
          }}
        />
      )}
      {error && <NoticePopup message={error} close={() => setError("")} />}
      {dialog && <AppDialog dialog={dialog} close={(value) => { dialog.resolve(value); setDialog(null); }} />}
      {busy && (
        <div className="loading">
          <RefreshCw className="spin" />
          Saving changes...
        </div>
      )}
    </div>
  );
}
function RoomLeaderModal({
  room,
  rooms,
  close,
  save,
}: {
  room: Dashboard["rooms"][number];
  rooms: Dashboard["rooms"];
  close: () => void;
  save: (leaders: { name: string; sleepRoomId: string }[]) => Promise<void>;
}) {
  const [leaders, setLeaders] = useState(
    room.leaders.map((leader) => ({ name: leader.name, sleepRoomId: leader.sleepRoomId || room.id })),
  );
  const eligible = rooms.filter((candidate) => candidate.gender === room.gender);
  return (
    <div className="backdrop" onMouseDown={close}>
      <form
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          save(leaders.map((leader) => ({ ...leader, name: leader.name.trim() })));
        }}
      >
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <h2>Room leaders</h2>
        <p className="modalintro">
          Add everyone responsible for {room.name} and choose where each leader sleeps.
        </p>
        {leaders.map((leader, index) => (
          <div className="leaderrow roomleaderrow" key={index}>
            <input required placeholder={`Leader ${index + 1} name`} value={leader.name} onChange={(event) => { const next=[...leaders]; next[index]={...leader,name:event.target.value}; setLeaders(next); }} />
            <select required value={leader.sleepRoomId} onChange={(event) => { const next=[...leaders]; next[index]={...leader,sleepRoomId:event.target.value}; setLeaders(next); }}>
              {eligible.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.occupancy}/{candidate.capacity})
                </option>
              ))}
            </select>
            <button type="button" className="removeroom" onClick={() => setLeaders(leaders.filter((_, i) => i !== index))}><Trash2 size={14}/>Remove</button>
          </div>
        ))}
        <button type="button" className="secondary" onClick={() => setLeaders([...leaders,{name:"",sleepRoomId:eligible[0]?.id||""}])}><Plus size={14}/>Add leader</button>
        <button className="primary">Save leaders</button>
      </form>
    </div>
  );
}
function GroupLeaderModal({group,close,save}:{group:Dashboard["groups"][number];close:()=>void;save:(leaders:string[])=>Promise<void>}) {
  const [leaders,setLeaders]=useState(group.leaders);
  return <div className="backdrop" onMouseDown={close}><form className="modal" onMouseDown={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();save(leaders.map(x=>x.trim()))}}><button type="button" className="close" onClick={close}><X/></button><h2>Group leaders</h2><p className="modalintro">Add one or more leaders for {group.name}.</p>{leaders.map((leader,index)=><div className="leaderrow" key={index}><input required placeholder={`Leader ${index+1} name`} value={leader} onChange={e=>{const next=[...leaders];next[index]=e.target.value;setLeaders(next)}}/><button type="button" className="removeroom" onClick={()=>setLeaders(leaders.filter((_,i)=>i!==index))}><Trash2 size={14}/>Remove</button></div>)}<button type="button" className="secondary" onClick={()=>setLeaders([...leaders,""])}><Plus size={14}/>Add leader</button><button className="primary">Save leaders</button></form></div>;
}
function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty">
      <span>CK</span>
      <h2>Start your first camp</h2>
      <p>Create a camp, configure rooms, then import your Excel camper list.</p>
      <button className="primary" onClick={onCreate}>
        <Plus size={16} />
        Create camp
      </button>
    </div>
  );
}
function Overview({
  d,
  busy,
  generate,
}: {
  d: Dashboard;
  busy: boolean;
  generate: () => void;
}) {
  const generated = d.campers.some((camper) => camper.roomId);
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
            <p>Generate rooms first, then assign leaders by gender</p>
          </div>
          <div className="assignmentactions">
            <button className="primary" disabled={busy} onClick={generate}>
              <Shuffle size={15} />
              {generated ? "Regenerate rooms" : "Generate rooms"}
            </button>
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
}: {
  d: Dashboard;
  q: string;
  infer: () => void;
  updateGender: (id: string, gender: "MALE" | "FEMALE") => void;
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
}: {
  d: Dashboard;
  add: () => void;
  rename: (id: string, current: string) => void;
  remove: (id: string, name: string) => void;
  move: (id: string, rid: string) => void;
  leader: (room: Dashboard["rooms"][number]) => void;
}) {
  const unassigned = d.campers.filter((camper) => !camper.roomId);
  return (
    <>
      <div className="toolbar">
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
                    <b>Leaders:</b> {r.leaders.map((leader) => `${leader.name} (sleeps in ${leader.sleepRoom})`).join(", ")}
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
function Groups({ d, generate, editLeaders }: { d: Dashboard; generate: () => void; editLeaders: (group: Dashboard["groups"][number]) => void }) {
  return (
    <>
      <div className="toolbar">
        <button className="primary" onClick={generate}>
          <Shuffle size={15} />
          Generate groups
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
function Exports({ id }: { id: string }) {
  return (
    <div className="exportgrid">
      <a href={`${API}/camps/${id}/exports/rooms.pdf`}>
        <Home />
        <b>Room assignment PDF</b>
        <span>Members, ages, capacity and page numbers</span>
        <FileDown />
      </a>
      <a href={`${API}/camps/${id}/exports/groups.pdf`}>
        <MessageCircle />
        <b>Discussion group PDF</b>
        <span>Balanced groups and average ages</span>
        <FileDown />
      </a>
    </div>
  );
}
function Modal({
  type,
  rooms,
  close,
  submit,
}: {
  type: string;
  rooms: Dashboard["rooms"];
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
  return (
    <div className="backdrop" onMouseDown={close}>
      <form
        className={`modal ${type === "assignRooms" ? "leadermodal" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          submit(
            type === "import"
              ? file
              : type === "assignRooms"
                ? { leaders: [...f.girlLeaders, ...f.boyLeaders] }
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
            : type === "room"
              ? "Add a room"
              : type === "groups"
                ? "Generate discussion groups"
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
        {type === "import" && (
          <label className="drop">
            <Upload />
            <b>{file?.name || "Choose .csv, .xlsx or .xls file"}</b>
            <span>
              Airtable Team view exports are supported; missing genders can be
              reviewed after upload
            </span>
            <input
              required
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </label>
        )}
        <button className="primary" disabled={type === "import" && !file}>
          Save and continue
        </button>
      </form>
    </div>
  );
}
