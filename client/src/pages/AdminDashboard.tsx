import { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { toast } from 'sonner';

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [teams, setTeams] = useState<any[]>([]);
  const [settings, setSettings] = useState({ advanced: 1200, mid: 600 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/admin/teams').then((data) => {
      setTeams(data);
      setLoading(false);
    });
  }, []);

  const handleReassign = async (playerId: string, teamId: number) => {
    try {
      await fetchApi('/admin/reassign', { method: 'POST', body: JSON.stringify({ player_id: playerId, target_team_id: teamId }) });
      toast.success("Player reassigned");
      fetchApi('/admin/teams').then(setTeams);
    } catch (err: any) {
      toast.error(err.message || "Failed to reassign player");
    }
  };

  const handleDelete = async (playerId: string) => {
    if(!confirm("Delete player? This will trigger an automatic cascade backfill.")) return;
    try {
      await fetchApi(`/admin/players/${playerId}`, { method: 'DELETE' });
      toast.success("Player deleted");
      fetchApi('/admin/teams').then(setTeams);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete player");
    }
  };

  const updateSettings = async (e: any) => {
    e.preventDefault();
    try {
      await fetchApi('/admin/settings', { method: 'POST', body: JSON.stringify({ advanced_threshold: settings.advanced, mid_threshold: settings.mid }) });
      toast.success("Updated & Recalculated!");
      fetchApi('/admin/teams').then(setTeams);
    } catch (err: any) {
      toast.error(err.message || "Failed to update settings");
    }
  };

  const handleLogout = async () => {
    await fetchApi('/admin/logout', { method: 'POST' });
    onLogout();
  };

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-error">Admin Controls</h1>
        <button onClick={handleLogout} className="btn btn-outline btn-error btn-sm">Logout</button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-1">
          <div className="card bg-base-100 shadow-xl border border-base-300 sticky top-24">
            <div className="card-body">
              <h2 className="card-title text-xl font-bold mb-4">Event Settings</h2>
              <form onSubmit={updateSettings} className="space-y-6">
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text">Advanced Threshold: <span className="font-bold text-secondary ml-1">{settings.advanced}</span></span></label>
                  <input type="range" min="800" max="3000" step="50" value={settings.advanced} onChange={e => setSettings({...settings, advanced: +e.target.value})} className="range range-secondary range-sm" />
                  <div className="w-full flex justify-between text-xs px-2 mt-1 opacity-50">
                    <span>800</span>
                    <span>3000</span>
                  </div>
                </div>
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text">Mid Threshold: <span className="font-bold text-accent ml-1">{settings.mid}</span></span></label>
                  <input type="range" min="400" max="2500" step="50" value={settings.mid} onChange={e => setSettings({...settings, mid: +e.target.value})} className="range range-accent range-sm" />
                  <div className="w-full flex justify-between text-xs px-2 mt-1 opacity-50">
                    <span>400</span>
                    <span>2500</span>
                  </div>
                </div>
                <button type="submit" className="btn btn-error w-full mt-2">Update & Recalculate</button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-span-2 space-y-6">
          <h2 className="text-2xl font-bold">Live Teams Roster</h2>
          
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="card bg-base-100 shadow-xl border border-base-300">
                  <div className="card-body">
                    <div className="skeleton h-8 w-40 mb-4"></div>
                    <div className="space-y-2">
                      <div className="skeleton h-12 w-full"></div>
                      <div className="skeleton h-12 w-full"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            teams.map((t: any) => (
               <div key={t.id} className={`card bg-base-100 shadow-xl border-l-4 transition-all ${t.is_locked ? 'border-l-error opacity-70' : 'border-l-error'}`}>
                 <div className="card-body p-6">
                   <h3 className="card-title text-xl font-bold mb-4 flex justify-between items-center">
                     <span>Team {t.team_number}</span>
                     {t.is_locked && <span className="badge badge-error badge-outline uppercase text-xs tracking-widest font-bold p-3">Locked</span>}
                   </h3>
                   <div className="space-y-3">
                     {t.members?.filter((m: any) => m).map((m: any) => (
                       <div key={m.id} className="flex justify-between items-center p-3 rounded-lg bg-base-200 border border-base-300">
                         <div>
                           <span className="font-bold">{m.name}</span>
                           <span className="ml-2 badge badge-ghost badge-sm">{m.tier} ({m.rating})</span>
                         </div>
                         <div className="flex gap-2 items-center">
                           <select className="select select-bordered select-sm max-w-xs" onChange={(e) => handleReassign(m.id, +e.target.value)} value={t.id}>
                             {teams.map((tOpt: any) => <option key={tOpt.id} value={tOpt.id}>Move to Team {tOpt.team_number}</option>)}
                           </select>
                           <button onClick={() => handleDelete(m.id)} className="btn btn-error btn-sm btn-outline">Kick</button>
                         </div>
                       </div>
                     ))}
                     {!t.members || t.members.filter((m: any) => m).length === 0 ? <p className="text-base-content/50 text-sm py-4 text-center">Empty</p> : null}
                   </div>
                 </div>
               </div>
            ))
          )}
          
          {!loading && teams.length === 0 && (
            <div className="text-center py-20 text-base-content/50">No teams found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
