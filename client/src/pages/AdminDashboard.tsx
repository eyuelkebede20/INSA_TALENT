import { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [teams, setTeams] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [settings, setSettings] = useState({ advanced: 1200, mid: 600 });
  const [loading, setLoading] = useState(true);

  const fetchTeams = () => fetchApi('/admin/teams').then(setTeams);

  useEffect(() => {
    Promise.all([
      fetchTeams(),
      fetchApi('/admin/feedbacks').then(setFeedbacks)
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
      await fetchApi('/admin/reassign', { method: 'POST', body: JSON.stringify({ player_id: playerId, target_team_id: targetTeamId }) });
      toast.success("Player moved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to reassign player");
      fetchTeams(); // Revert on failure
    }
  };

  const handleDelete = async (playerId: string) => {
    if(!confirm("Delete player? They will be removed from the system completely.")) return;
    try {
      await fetchApi(`/admin/players/${playerId}`, { method: 'DELETE' });
      toast.success("Player deleted");
      fetchTeams();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete player");
    }
  };

  const updateSettings = async (e: any) => {
    e.preventDefault();
    try {
      await fetchApi('/admin/settings', { method: 'POST', body: JSON.stringify({ advanced_threshold: settings.advanced, mid_threshold: settings.mid }) });
      toast.success("Tiers Updated!");
      fetchTeams();
    } catch (err: any) {
      toast.error(err.message || "Failed to update settings");
    }
  };

  const handleRegroup = async () => {
    if(!confirm("NUCLEAR REGROUP: Are you absolutely sure? This will wipe ALL current team assignments and re-sort EVERYONE automatically using the EOS algorithm to hit the 8-2-1 targets. This cannot be undone.")) return;
    
    setLoading(true);
    try {
      await fetchApi('/admin/regroup', { method: 'POST' });
      toast.success("Everyone has been regrouped!");
      fetchTeams();
    } catch (err: any) {
      toast.error(err.message || "Failed to regroup");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetchApi('/admin/logout', { method: 'POST' });
    onLogout();
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-4xl font-bold text-error">Admin Controls</h1>
        <div className="flex gap-2">
          <button onClick={handleRegroup} className="btn btn-warning shadow-lg shadow-warning/20">☢️ Nuclear Regroup</button>
          <button onClick={handleLogout} className="btn btn-outline btn-error">Logout</button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-8">
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body flex-row flex-wrap justify-between items-center gap-4">
            <h2 className="card-title text-xl font-bold w-full md:w-auto">Event Settings (Badges)</h2>
            <form onSubmit={updateSettings} className="flex-1 flex flex-col md:flex-row gap-6 w-full md:w-auto items-end">
              <div className="form-control flex-1 w-full">
                <label className="label pb-1"><span className="label-text">Advanced Threshold: <span className="font-bold text-secondary ml-1">{settings.advanced}</span></span></label>
                <input type="range" min="800" max="3000" step="50" value={settings.advanced} onChange={e => setSettings({...settings, advanced: +e.target.value})} className="range range-secondary range-sm" />
              </div>
              <div className="form-control flex-1 w-full">
                <label className="label pb-1"><span className="label-text">Mid Threshold: <span className="font-bold text-accent ml-1">{settings.mid}</span></span></label>
                <input type="range" min="400" max="2500" step="50" value={settings.mid} onChange={e => setSettings({...settings, mid: +e.target.value})} className="range range-accent range-sm" />
              </div>
              <button type="submit" className="btn btn-error w-full md:w-auto mt-4 md:mt-0">Update Tags</button>
            </form>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Finite Canvas Editor</h2>
          <p className="text-base-content/60 text-sm">Drag and drop players between teams to reassign them manually.</p>
          
          <div className="overflow-x-auto pb-4 bg-base-300/30 p-6 rounded-2xl border border-base-300 shadow-inner">
            {loading ? (
              <div className="flex gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="card bg-base-100 shadow-xl border border-base-300 w-80 shrink-0">
                    <div className="card-body">
                      <div className="skeleton h-8 w-40 mb-4"></div>
                      <div className="skeleton h-16 w-full mb-2"></div>
                      <div className="skeleton h-16 w-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex items-start gap-6 min-h-[400px]">
                  {teams.map((t: any) => {
                    const validMembers = (t.members?.filter((m: any) => m) || []).sort((a: any, b: any) => {
                      const tierWeight: any = { ADVANCED: 3, MID: 2, BEGINNER: 1 };
                      if (tierWeight[a.tier] !== tierWeight[b.tier]) {
                        return tierWeight[b.tier] - tierWeight[a.tier];
                      }
                      return b.rating - a.rating;
                    });

                    return (
                      <div key={t.id} className="card bg-base-100 shadow-xl border-t-4 border-t-primary w-80 shrink-0 self-start max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-base-200 flex justify-between items-center bg-base-100 shrink-0 rounded-t-2xl">
                          <h3 className="font-bold text-lg">Team {t.team_number}</h3>
                          <span className="badge badge-neutral">{validMembers.length} / 11</span>
                        </div>
                        
                        <Droppable droppableId={`team-${t.id}`}>
                          {(provided, snapshot) => (
                            <div 
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className={`p-4 flex-1 overflow-y-auto space-y-3 min-h-[150px] transition-colors ${snapshot.isDraggingOver ? 'bg-primary/10' : 'bg-base-100'}`}
                            >
                              {validMembers.map((m: any, index: number) => (
                                <Draggable key={m.id} draggableId={m.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`p-3 rounded-lg border flex flex-col gap-2 transition-all ${snapshot.isDragging ? 'bg-primary/20 border-primary shadow-xl rotate-2 z-50' : 'bg-base-200 border-base-300 hover:border-primary/50'}`}
                                      style={{...provided.draggableProps.style}}
                                    >
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <p className="font-bold text-sm flex items-center gap-2">
                                            {m.name}
                                          </p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <div className={`w-2 h-2 rounded-full ${m.tier === 'ADVANCED' ? 'bg-secondary' : m.tier === 'MID' ? 'bg-accent' : 'bg-primary'}`}></div>
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                          <span className="font-bold text-primary text-sm">{m.rating}</span>
                                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(m.id); }} className="text-[10px] text-error opacity-50 hover:opacity-100 uppercase tracking-widest font-bold">Kick</button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                              {validMembers.length === 0 && !snapshot.isDraggingOver && (
                                <div className="text-center p-4 border-2 border-dashed border-base-300 rounded-xl text-base-content/40 text-sm">
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
                    <div className="w-full text-center py-20 text-base-content/50">No teams found.</div>
                  )}
                </div>
              </DragDropContext>
            )}
          </div>
        </div>
      </div>

      <div className="divider"></div>
      
      <div className="mb-20">
        <h2 className="text-2xl font-bold mb-6">Student Feedbacks</h2>
        {loading ? (
          <div className="skeleton h-32 w-full"></div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-10 text-base-content/50 bg-base-100 rounded-xl border border-base-300">No feedbacks yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feedbacks.map((f: any) => (
              <div key={f.id} className="card bg-base-100 shadow-xl border border-base-300">
                <div className="card-body">
                  <h3 className="card-title text-sm opacity-60 flex justify-between">
                    <span>{f.real_name} (Team {f.team_number || 'None'})</span>
                    <span>{new Date(f.created_at).toLocaleDateString()}</span>
                  </h3>
                  <p className="mt-2 font-medium">{f.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
