import { useEffect, useState } from 'react';
import { fetchApi, API_BASE_URL } from '../lib/api';
import { toast } from 'sonner';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay, closestCenter } from '@dnd-kit/core';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { DroppableTeam } from '../components/DroppableTeam';

const AutoScroller = ({ filteredTeams }: { filteredTeams: any[] }) => {
  useEffect(() => {
    if (filteredTeams.length === 1) {
      const el = document.getElementById(`team-card-${filteredTeams[0].id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' });
      }
    }
  }, [filteredTeams]);
  return null;
};

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [teams, setTeams] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [settings, setSettings] = useState({ advanced: 1200, mid: 600, registrationOpen: true });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cronHealth, setCronHealth] = useState({ status: "Unknown", lastSync: null as string | null, message: "", invalidAccounts: [] as string[] });
  
  // Dnd-kit state
  const [activePlayer, setActivePlayer] = useState<any>(null);

  // Zoom state
  const [isPanning, setIsPanning] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );
  
  // Panel toggles
  const [controlsOpen, setControlsOpen] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [webinarsOpen, setWebinarsOpen] = useState(false);
  const [webinars, setWebinars] = useState<any[]>([]);
  const [selectedWebinar, setSelectedWebinar] = useState<any>(null);

  const fetchTeams = () => fetchApi('/adminme/teams').then(setTeams);

  const handleUpdateWebinarStatus = async (id: number, status: string) => {
    try {
      await fetchApi(`/adminme/webinar-registrations/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
      setWebinars(prev => prev.map(w => w.id === id ? { ...w, status } : w));
      if (selectedWebinar && selectedWebinar.id === id) {
          if (status === 'REJECTED') {
              setSelectedWebinar(null);
          } else {
              setSelectedWebinar({ ...selectedWebinar, status });
          }
      }
      toast.success("Registration " + status);
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    }
  };

  useEffect(() => {
    Promise.all([
      fetchTeams(),
      fetchApi('/adminme/feedbacks').then(setFeedbacks),
      fetchApi('/adminme/settings').then(s => setSettings({ advanced: s.advancedThreshold, mid: s.midThreshold, registrationOpen: s.registrationOpen })),
      fetchApi('/adminme/cron-health').then(setCronHealth).catch(() => {}),
      fetchApi('/adminme/webinar-registrations').then(setWebinars).catch(() => {})
    ]).then(() => setLoading(false));
  }, []);

  const handleDragStart = (event: any) => {
    setIsPanning(false);
    const { active } = event;
    setActivePlayer(active.data.current?.player);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActivePlayer(null);

    if (!over) return;
    
    // Find source team and target team
    let sourceTeamId = -1;
    for (const t of teams) {
      if (t.members?.some((m: any) => m && m.id === active.id)) {
        sourceTeamId = t.id;
        break;
      }
    }
    
    const targetTeamId = over.id;
    if (sourceTeamId === -1 || sourceTeamId === targetTeamId) return;

    const playerId = active.id;

    // Optimistic Update
    const newTeams = JSON.parse(JSON.stringify(teams));
    const sourceTeam = newTeams.find((t: any) => t.id === sourceTeamId);
    const targetTeam = newTeams.find((t: any) => t.id === targetTeamId);
    
    sourceTeam.members = sourceTeam.members?.filter((m: any) => m) || [];
    targetTeam.members = targetTeam.members?.filter((m: any) => m) || [];

    const memberIndex = sourceTeam.members.findIndex((m: any) => m.id === playerId);
    const [movedMember] = sourceTeam.members.splice(memberIndex, 1);
    targetTeam.members.push(movedMember); // Just push to the end, it auto-sorts on re-render/fetch
    setTeams(newTeams);

    try {
      await fetchApi('/adminme/reassign', { method: 'POST', body: JSON.stringify({ player_id: playerId, target_team_id: targetTeamId }) });
      toast.success("Player moved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to reassign player");
      fetchTeams(); // Revert on failure
    }
  };

  const handleDelete = async (playerId: string) => {
    if(!confirm("Delete player? They will be removed from the system completely.")) return;
    try {
      await fetchApi(`/adminme/players/${playerId}`, { method: 'DELETE' });
      toast.success("Player deleted");
      fetchTeams();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete player");
    }
  };

  const updateSettings = async (e: any) => {
    e.preventDefault();
    try {
      await fetchApi('/adminme/settings', { method: 'POST', body: JSON.stringify({ advanced_threshold: settings.advanced, mid_threshold: settings.mid, registration_open: settings.registrationOpen }) });
      toast.success("Settings Updated!");
      fetchTeams();
    } catch (err: any) {
      toast.error(err.message || "Failed to update settings");
    }
  };

  const toggleRegistration = async () => {
    const newState = !settings.registrationOpen;
    setSettings({ ...settings, registrationOpen: newState });
    try {
      await fetchApi('/adminme/settings', { method: 'POST', body: JSON.stringify({ advanced_threshold: settings.advanced, mid_threshold: settings.mid, registration_open: newState }) });
      toast.success(`Registration ${newState ? 'Opened' : 'Closed'}!`);
    } catch (err: any) {
      setSettings({ ...settings, registrationOpen: !newState }); // Revert
      toast.error(err.message || "Failed to update settings");
    }
  };

  const handleRegroup = async () => {
    if(!confirm("NUCLEAR REGROUP: Are you absolutely sure? This will wipe ALL current team assignments and re-sort EVERYONE automatically into teams of 11. This cannot be undone.")) return;
    
    setLoading(true);
    try {
      await fetchApi('/adminme/regroup', { method: 'POST' });
      toast.success("Everyone has been regrouped!");
      fetchTeams();
    } catch (err: any) {
      toast.error(err.message || "Failed to regroup");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetchApi('/adminme/logout', { method: 'POST' });
    onLogout();
  };

  const filteredTeams = teams.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    const qNoSpaces = q.replace(/\s+/g, '');
    
    // match team number
    if (t.team_number.toString() === q || 
        t.team_number.toString().includes(q.replace('team', '').trim()) || 
        `team${t.team_number}`.includes(qNoSpaces)) return true;
        
    // match member name or insa code
    return t.members?.some((m: any) => 
      m && (
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.insa_code && m.insa_code.toLowerCase().includes(q)) ||
        (m.insa_code && m.insa_code.toLowerCase().replace(/-/g, '').includes(qNoSpaces))
      )
    );
  });

  const handleExportCSV = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/adminme/export-csv`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to export CSV");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "players.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("CSV Downloaded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to download CSV");
    }
  };

  const handleForceSync = async () => {
    try {
      setCronHealth(prev => ({...prev, status: "Syncing..."}));
      await fetchApi('/adminme/force-sync', { method: 'POST' });
      toast.info("Sync started in background! This may take up to a minute...");
      
      const poll = setInterval(async () => {
        const res = await fetchApi('/adminme/cron-health');
        setCronHealth(res);
        if (res.status === 'Success' || res.status === 'Failed') {
          clearInterval(poll);
          if (res.status === 'Success') toast.success("Sync finished successfully!");
          else toast.error("Sync failed: " + res.message);
        }
      }, 3000);
      
    } catch (e: any) {
      toast.error(e.message || "Failed to start sync");
      fetchApi('/adminme/cron-health').then(setCronHealth);
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-base-200 overflow-hidden">
      {/* Floating Bottom-Right Panels */}
      <div className="absolute bottom-4 right-4 z-50 flex flex-col-reverse md:flex-row items-end gap-4 pointer-events-none">
        
        {/* Controls Container */}
        <div className="pointer-events-auto max-w-[90vw]">
          {controlsOpen ? (
            <div className="card bg-base-100/90 shadow-2xl border border-base-300 backdrop-blur-md w-72 max-w-full relative">
              <button onClick={() => setControlsOpen(false)} className="btn btn-xs btn-circle btn-ghost absolute top-3 right-3 text-base-content/50 hover:text-base-content">✕</button>
              <div className="card-body p-4 space-y-3 pt-5">
                <h2 className="card-title text-error text-xl font-bold border-b border-base-200 pb-2">Admin Controls</h2>
                
                <div className="flex flex-col gap-1 bg-base-200 p-2 rounded-lg text-xs font-medium">
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Lichess Sync Status:</span>
                    <span className={`badge badge-xs ${cronHealth.status === 'Success' ? 'badge-success' : cronHealth.status === 'Failed' ? 'badge-error' : cronHealth.status === 'Syncing...' ? 'badge-info animate-pulse' : 'badge-warning'}`}>{cronHealth.status}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="opacity-70">Last Sync:</span>
                    <span className="font-bold opacity-90">{cronHealth.lastSync ? new Date(cronHealth.lastSync).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Never'}</span>
                  </div>
                  {cronHealth.invalidAccounts && cronHealth.invalidAccounts.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-base-300">
                      <span className="text-error font-bold text-[10px] uppercase block mb-1">Invalid Lichess Accounts ({cronHealth.invalidAccounts.length}):</span>
                      <div className="text-[10px] opacity-80 max-h-24 overflow-y-auto space-y-1">
                        {cronHealth.invalidAccounts.map((acc, i) => <div key={i} className="bg-error/10 px-1.5 py-0.5 rounded border border-error/20">{acc}</div>)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between text-sm font-bold px-1 opacity-80 bg-base-200 p-2 rounded-lg">
                  <span>Teams: <span className="text-primary">{teams.length}</span></span>
                  <span>Students: <span className="text-secondary">{teams.reduce((acc, t) => acc + (t.members?.filter((m:any) => m).length || 0), 0)}</span></span>
                </div>
                
                <div className="flex flex-col gap-2">
                <button onClick={handleExportCSV} className="btn btn-sm btn-info w-full text-info-content shadow-lg shadow-info/20">📥 Export CSV</button>
                <button onClick={handleRegroup} className="btn btn-sm btn-warning w-full shadow-lg shadow-warning/20">☢️ Nuclear Regroup</button>
                <div className="flex gap-2 w-full">
                  <button onClick={handleForceSync} disabled={cronHealth.status === 'Syncing...'} className="btn btn-sm btn-primary flex-1 shadow-lg shadow-primary/20">
                    {cronHealth.status === 'Syncing...' ? <span className="loading loading-spinner loading-xs"></span> : '🔄 Sync Lichess'}
                  </button>
                  <button onClick={handleLogout} className="btn btn-sm btn-outline btn-error flex-1">Logout</button>
                </div>
              </div>
                
                <div className="form-control bg-base-200 rounded-lg p-2 mt-2">
                  <label className="label cursor-pointer gap-2 p-1">
                    <span className="label-text font-bold text-xs">{settings.registrationOpen ? "Registration Open" : "Registration Closed"}</span> 
                    <input type="checkbox" className="toggle toggle-sm toggle-success" checked={settings.registrationOpen} onChange={toggleRegistration} />
                  </label>
                </div>
                
                <div className="divider my-0 opacity-50"></div>
                
                <form onSubmit={updateSettings} className="space-y-3">
                  <div className="form-control">
                    <label className="label px-0 pb-1"><span className="label-text text-xs font-bold">Adv Threshold: <span className="text-secondary">{settings.advanced}</span></span></label>
                    <input type="range" min="800" max="3000" step="50" value={settings.advanced} onChange={e => setSettings({...settings, advanced: +e.target.value})} className="range range-secondary range-xs" />
                  </div>
                  <div className="form-control">
                    <label className="label px-0 pb-1"><span className="label-text text-xs font-bold">Mid Threshold: <span className="text-accent">{settings.mid}</span></span></label>
                    <input type="range" min="400" max="2500" step="50" value={settings.mid} onChange={e => setSettings({...settings, mid: +e.target.value})} className="range range-accent range-xs" />
                  </div>
                  <button type="submit" className="btn btn-xs btn-primary w-full mt-2">Apply Settings</button>
                </form>
              </div>
            </div>
          ) : (
            <button onClick={() => setControlsOpen(true)} className="btn btn-primary shadow-xl rounded-full px-6 flex items-center gap-2">
              ⚙️ Controls
            </button>
          )}
        </div>

        {/* Feedback Container */}
        <div className="pointer-events-auto max-w-[90vw]">
          {feedbackOpen ? (
            <div className="card bg-base-100/90 shadow-2xl border border-base-300 backdrop-blur-md w-80 h-96 max-w-full flex flex-col relative">
              <button onClick={() => setFeedbackOpen(false)} className="btn btn-xs btn-circle btn-ghost absolute top-3 right-3 z-10 text-base-content/50 hover:text-base-content">✕</button>
              <div className="p-3 border-b border-base-200 bg-base-100/50 rounded-t-2xl shrink-0 flex items-center gap-3 pt-3 pl-4">
                <h3 className="font-bold text-sm">Student Feedback</h3>
                <div className="badge badge-primary badge-sm">{feedbacks.length}</div>
              </div>
              <div className="p-4 overflow-y-auto space-y-4 flex-1 flex flex-col">
                {loading ? (
                  <div className="flex justify-center items-center h-full"><span className="loading loading-spinner text-primary"></span></div>
                ) : feedbacks.length === 0 ? (
                  <div className="text-center text-xs opacity-50 my-auto">No feedback yet.</div>
                ) : (
                  feedbacks.slice().reverse().map((f: any) => (
                    <div key={f.id} className="chat chat-start w-full">
                      <div className="chat-header text-[10px] opacity-60 mb-1 flex gap-1">
                        {f.real_name} <span className="font-bold text-primary">(T{f.team_number || '?'})</span>
                      </div>
                      <div className="chat-bubble chat-bubble-primary text-xs shadow-sm bg-primary/20 text-base-content border border-primary/30 w-full max-w-full break-words">
                        {f.message}
                      </div>
                      <div className="chat-footer opacity-50 text-[9px] mt-1">
                        {new Date(f.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <button onClick={() => setFeedbackOpen(true)} className="btn btn-primary shadow-xl rounded-full px-6 flex items-center gap-2">
              💬 Feedback <span className="badge badge-sm badge-base-100 font-bold">{feedbacks.length}</span>
            </button>
          )}
        </div>

        {/* Webinar Registrations Container */}
        <div className="pointer-events-auto max-w-[90vw]">
          {webinarsOpen ? (
            <div className="card bg-base-100/90 shadow-2xl border border-base-300 backdrop-blur-md w-80 h-96 max-w-full flex flex-col relative">
              <button onClick={() => setWebinarsOpen(false)} className="btn btn-xs btn-circle btn-ghost absolute top-3 right-3 z-10 text-base-content/50 hover:text-base-content">✕</button>
              <div className="p-3 border-b border-base-200 bg-base-100/50 rounded-t-2xl shrink-0 flex items-center justify-between pt-3 pl-4 pr-10">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">Webinars</h3>
                  <div className="badge badge-secondary badge-sm">{webinars.filter(w => w.status !== 'REJECTED').length}</div>
                </div>
                <button onClick={() => window.open(`${API_BASE_URL}/adminme/export-webinar-csv`, '_blank')} className="btn btn-xs btn-outline btn-secondary">
                  📥 CSV
                </button>
              </div>
              <div className="p-4 overflow-y-auto space-y-4 flex-1 flex flex-col">
                {loading ? (
                  <div className="flex justify-center items-center h-full"><span className="loading loading-spinner text-secondary"></span></div>
                ) : webinars.filter(w => w.status !== 'REJECTED').length === 0 ? (
                  <div className="text-center text-xs opacity-50 my-auto">No registrations yet.</div>
                ) : (
                  webinars.filter(w => w.status !== 'REJECTED').map((w: any) => (
                    <div 
                      key={w.id} 
                      onClick={() => setSelectedWebinar(w)}
                      className={`card border cursor-pointer hover:bg-base-300 shadow-sm p-3 gap-2 transition-colors ${w.status === 'ACCEPTED' ? 'bg-success/10 border-success/30' : 'bg-base-200 border-base-300'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-sm truncate pr-2">{w.userName}</div>
                        <div className="text-[10px] opacity-60 whitespace-nowrap">{new Date(w.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div className="text-xs opacity-80 break-all">{w.userEmail}</div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="text-[10px] font-mono">Ref: <span className="font-bold">{w.bankRefNumber}</span></div>
                        {w.status === 'ACCEPTED' && <div className="badge badge-success badge-xs">Accepted</div>}
                        {w.status === 'PENDING' && <div className="badge badge-warning badge-xs">Pending</div>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <button onClick={() => setWebinarsOpen(true)} className="btn btn-secondary shadow-xl rounded-full px-6 flex items-center gap-2">
              🎫 Webinars <span className="badge badge-sm badge-base-100 font-bold">{webinars.filter(w => w.status !== 'REJECTED').length}</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 z-50 absolute top-0 left-0 right-0 flex justify-center pointer-events-none">
        <div className="w-full max-w-lg relative pointer-events-auto shadow-2xl rounded-lg">
          <input 
            type="text" 
            placeholder="Search for a team number, player name, or INSA ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input input-bordered w-full pl-10 bg-base-100/90 backdrop-blur"
          />
          <svg className="w-5 h-5 absolute left-3 top-3.5 text-base-content/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
      </div>

      <div className="absolute inset-0 w-full h-full pt-20 pb-10 overflow-hidden bg-base-300 pattern-grid-lg text-base-content/10">
        {loading ? (
          <div className="w-full h-full flex justify-center items-center">
            <span className="loading loading-dots loading-lg text-primary"></span>
          </div>
        ) : (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
             <AutoScroller filteredTeams={filteredTeams} />
             
             <TransformWrapper
               initialScale={1}
               minScale={0.1}
               maxScale={2}
               centerOnInit={false}
               panning={{ disabled: !!activePlayer, velocityDisabled: true }}
               wheel={{ step: 0.1 }}
               onPanningStart={() => setIsPanning(true)}
               onPanningStop={() => setIsPanning(false)}
             >
               <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                 <div className={`p-20 w-[5000px] h-[5000px] flex flex-wrap content-start gap-10 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}>
                        {filteredTeams.map((t: any) => {
                          const validMembers = (t.members?.filter((m: any) => m) || []).sort((a: any, b: any) => {
                            const tierWeight: any = { ADVANCED: 3, MID: 2, BEGINNER: 1 };
                            if (tierWeight[a.tier] !== tierWeight[b.tier]) {
                              return tierWeight[b.tier] - tierWeight[a.tier];
                            }
                            return b.rating - a.rating;
                          });

                          return (
                            <DroppableTeam 
                              key={t.id} 
                              t={t} 
                              validMembers={validMembers} 
                              handleDelete={handleDelete} 
                            />
                          );
                        })}
                        
                        {filteredTeams.length === 0 && (
                          <div className="text-center text-base-content/40 w-full py-20 text-xl font-medium">
                            No teams match your search
                          </div>
                        )}
                 </div>
               </TransformComponent>
             </TransformWrapper>
             
             <DragOverlay modifiers={[]}>
               {activePlayer ? (
                 <div className="p-3 rounded-xl border flex justify-between items-center gap-2 bg-primary/20 border-primary shadow-2xl z-50 rotate-2 scale-105 w-[316px]">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full shadow-sm ${activePlayer.tier === 'ADVANCED' ? 'bg-secondary' : activePlayer.tier === 'MID' ? 'bg-accent' : 'bg-primary'}`}></div>
                      <div>
                        <p className="font-bold text-sm truncate max-w-[140px]">{activePlayer.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-primary">{activePlayer.rating}</span>
                    </div>
                 </div>
               ) : null}
             </DragOverlay>
          </DndContext>
        )}
      </div>
      {selectedWebinar && (
        <div className="fixed inset-0 z-[100] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-2xl bg-base-100 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-base-200 flex justify-between items-center bg-base-200">
              <h2 className="text-lg font-bold">Webinar Registration Details</h2>
              <button onClick={() => setSelectedWebinar(null)} className="btn btn-sm btn-circle btn-ghost">✕</button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold opacity-60">Full Name</label>
                  <p className="font-bold">{selectedWebinar.userName}</p>
                </div>
                <div>
                  <label className="text-xs font-bold opacity-60">Email</label>
                  <p className="font-mono text-sm">{selectedWebinar.userEmail}</p>
                </div>
                <div>
                  <label className="text-xs font-bold opacity-60">Bank Reference</label>
                  <p className="font-mono font-bold text-primary">{selectedWebinar.bankRefNumber}</p>
                </div>
                <div>
                  <label className="text-xs font-bold opacity-60">Date Registered</label>
                  <p className="text-sm">{new Date(selectedWebinar.createdAt).toLocaleString()}</p>
                </div>
              </div>
              
              <div className="divider my-1"></div>
              
              <div>
                <label className="text-xs font-bold opacity-60 mb-2 block">Payment Screenshot</label>
                <div className="bg-base-200 rounded-lg p-2 border border-base-300 flex justify-center">
                  <img src={selectedWebinar.screenshotData} alt="Payment" className="max-h-[40vh] object-contain rounded shadow-sm" />
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-base-200 bg-base-200/50 flex justify-end gap-3 shrink-0">
              {selectedWebinar.status === 'PENDING' && (
                <>
                  <button onClick={() => handleUpdateWebinarStatus(selectedWebinar.id, 'REJECTED')} className="btn btn-error btn-outline shadow-lg shadow-error/20">❌ Reject & Cancel</button>
                  <button onClick={() => handleUpdateWebinarStatus(selectedWebinar.id, 'ACCEPTED')} className="btn btn-success shadow-lg shadow-success/20">✅ Accept Payment</button>
                </>
              )}
              {selectedWebinar.status === 'ACCEPTED' && (
                 <button onClick={() => handleUpdateWebinarStatus(selectedWebinar.id, 'REJECTED')} className="btn btn-error btn-outline btn-sm">Revoke Acceptance</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
