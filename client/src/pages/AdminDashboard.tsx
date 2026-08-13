import { useEffect, useState } from 'react';
import { fetchApi, API_BASE_URL } from '../lib/api';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { TransformWrapper, TransformComponent, useTransformContext } from 'react-zoom-pan-pinch';

const DraggablePlayer = ({ m, index, handleDelete }: any) => {
  const transformCtx: any = useTransformContext();
  const scale = transformCtx?.transformState?.scale || 1;
  
  return (
    <Draggable draggableId={m.id} index={index}>
      {(provided, snapshot) => {
        let style: any = { ...provided.draggableProps.style };
        // Fix for drag offset inside scaled container
        if (snapshot.isDragging && style.transform) {
          const match = style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
          if (match) {
            const x = parseFloat(match[1]) / scale;
            const y = parseFloat(match[2]) / scale;
            style.transform = `translate(${x}px, ${y}px)`;
          }
        }
        
        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`p-3 rounded-xl border flex justify-between items-center gap-2 transition-all ${snapshot.isDragging ? 'bg-primary/20 border-primary shadow-2xl z-50 rotate-2 scale-105' : 'bg-base-200 border-base-300 hover:border-primary/40'}`}
            style={style}
          >
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full shadow-sm ${m.tier === 'ADVANCED' ? 'bg-secondary' : m.tier === 'MID' ? 'bg-accent' : 'bg-primary'}`}></div>
              <div>
                <p className="font-bold text-sm truncate max-w-[140px]">{m.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold text-primary">{m.rating}</span>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(m.id); }} className="btn btn-xs btn-square btn-ghost text-error hover:bg-error/20" title="Delete Player">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        );
      }}
    </Draggable>
  );
};

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [teams, setTeams] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [settings, setSettings] = useState({ advanced: 1200, mid: 600, registrationOpen: true });
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [canvasLocked, setCanvasLocked] = useState(false);
  
  // Panel toggles
  const [controlsOpen, setControlsOpen] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const fetchTeams = () => fetchApi('/adminme/teams').then(setTeams);

  useEffect(() => {
    Promise.all([
      fetchTeams(),
      fetchApi('/adminme/feedbacks').then(setFeedbacks),
      fetchApi('/adminme/settings').then(s => setSettings({ advanced: s.advancedThreshold, mid: s.midThreshold, registrationOpen: s.registrationOpen }))
    ]).then(() => setLoading(false));
  }, []);

  const handleDragEnd = async (result: any) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceTeamId = parseInt(source.droppableId.split('-')[1]);
    const targetTeamId = parseInt(destination.droppableId.split('-')[1]);
    const playerId = draggableId;

    // Optimistic Update
    const newTeams = JSON.parse(JSON.stringify(teams));
    const sourceTeam = newTeams.find((t: any) => t.id === sourceTeamId);
    const targetTeam = newTeams.find((t: any) => t.id === targetTeamId);
    
    // Fallback member filtering just in case there are nulls
    sourceTeam.members = sourceTeam.members?.filter((m: any) => m) || [];
    targetTeam.members = targetTeam.members?.filter((m: any) => m) || [];

    const memberIndex = sourceTeam.members.findIndex((m: any) => m.id === playerId);
    const [movedMember] = sourceTeam.members.splice(memberIndex, 1);
    targetTeam.members.splice(destination.index, 0, movedMember);
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
    if(!confirm("NUCLEAR REGROUP: Are you absolutely sure? This will wipe ALL current team assignments and re-sort EVERYONE automatically using the EOS algorithm to hit the 8-2-1 targets. This cannot be undone.")) return;
    
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

  return (
    <div className="absolute inset-0 z-40 bg-base-200 overflow-hidden">
      {/* Floating Left Panel: Options */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-4 pointer-events-auto max-w-[90vw]">
        {controlsOpen ? (
          <div className="card bg-base-100/90 shadow-2xl border border-base-300 backdrop-blur-md w-72 max-w-full relative">
            <button onClick={() => setControlsOpen(false)} className="btn btn-xs btn-circle btn-ghost absolute top-3 right-3 text-base-content/50 hover:text-base-content">✕</button>
            <div className="card-body p-4 space-y-3 pt-5">
              <h2 className="card-title text-error text-xl font-bold border-b border-base-200 pb-2">Admin Controls</h2>
              
              <div className="flex flex-col gap-2">
              <button onClick={handleExportCSV} className="btn btn-sm btn-info w-full text-info-content shadow-lg shadow-info/20">📥 Export CSV</button>
              <button onClick={handleRegroup} className="btn btn-sm btn-warning w-full shadow-lg shadow-warning/20">☢️ Nuclear Regroup</button>
              <button onClick={handleLogout} className="btn btn-sm btn-outline btn-error w-full">Logout</button>
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

      {/* Floating Bottom-Right Panel: Student Feedbacks like Chat */}
      <div className="absolute bottom-4 right-4 z-50 pointer-events-auto flex flex-col items-end max-w-[90vw]">
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

      {/* Infinite Canvas */}
      <div className="absolute inset-0 w-full h-full bg-base-200" style={{ backgroundImage: 'radial-gradient(#base-300 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        {loading ? (
          <div className="w-full h-full flex justify-center items-center">
            <span className="loading loading-dots loading-lg text-primary"></span>
          </div>
        ) : (
          <DragDropContext 
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(result) => {
              setIsDragging(false);
              handleDragEnd(result);
            }}
          >
            <TransformWrapper 
              initialScale={0.8} 
              minScale={0.1} 
              maxScale={4} 
              centerOnInit 
              limitToBounds={false} 
              centerZoomedOut={false}
              panning={{ disabled: canvasLocked || isDragging }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 bg-base-100/90 p-2 rounded-xl shadow-lg border border-base-300 backdrop-blur-md pointer-events-auto hidden md:flex">
                    <button className="btn btn-sm btn-square btn-ghost" onClick={() => zoomIn()} title="Zoom In">+</button>
                    <button className="btn btn-sm btn-square btn-ghost" onClick={() => zoomOut()} title="Zoom Out">-</button>
                    <button className="btn btn-sm btn-square btn-ghost" onClick={() => resetTransform()} title="Reset">⟲</button>
                    <button className={`btn btn-sm btn-square ${canvasLocked ? 'btn-error bg-error/20 text-error' : 'btn-ghost'}`} onClick={() => setCanvasLocked(!canvasLocked)} title={canvasLocked ? "Unlock Canvas" : "Lock Canvas"}>
                      {canvasLocked ? '🔒' : '🔓'}
                    </button>
                  </div>
                  
                  <TransformComponent wrapperClass="!w-full !h-full !absolute !inset-0 cursor-grab active:cursor-grabbing" contentClass="p-[1000px] w-full h-full flex items-center justify-center">
                    <div className="flex flex-wrap gap-8 justify-center min-w-[3000px]">
                      {teams.map((t: any) => {
                        const validMembers = (t.members?.filter((m: any) => m) || []).sort((a: any, b: any) => {
                          const tierWeight: any = { ADVANCED: 3, MID: 2, BEGINNER: 1 };
                          if (tierWeight[a.tier] !== tierWeight[b.tier]) {
                            return tierWeight[b.tier] - tierWeight[a.tier];
                          }
                          return b.rating - a.rating;
                        });

                        return (
                          <div key={t.id} className="card bg-base-100 shadow-2xl border-t-8 border-t-primary w-[350px] shrink-0 self-start h-[500px] flex flex-col hover:shadow-[0_0_20px_rgba(var(--primary),0.2)] transition-shadow cursor-auto">
                            <div className="p-5 border-b border-base-200 flex justify-between items-center bg-base-100 shrink-0">
                              <h3 className="font-bold text-xl">Team {t.team_number}</h3>
                              <span className="badge badge-primary badge-outline font-bold">{validMembers.length} / 11</span>
                            </div>
                            
                            <Droppable droppableId={`team-${t.id}`}>
                              {(provided, snapshot) => (
                                <div 
                                  {...provided.droppableProps}
                                  ref={provided.innerRef}
                                  className={`p-4 flex-1 overflow-y-auto space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : 'bg-base-100'}`}
                                >
                                  {validMembers.map((m: any, index: number) => (
                                    <DraggablePlayer key={m.id} m={m} index={index} handleDelete={handleDelete} />
                                  ))}
                                  {provided.placeholder}
                                  {validMembers.length === 0 && !snapshot.isDraggingOver && (
                                    <div className="text-center p-8 border-2 border-dashed border-base-300 rounded-xl text-base-content/40 text-sm font-medium mt-4">
                                      Drag players here
                                    </div>
                                  )}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        );
                      })}
                      
                      {teams.length === 0 && (
                        <div className="w-full text-center py-20 text-base-content/50 text-xl font-bold bg-base-100/50 rounded-2xl backdrop-blur-sm">No teams found.</div>
                      )}
                    </div>
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}
