import { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';

export default function AdminDashboard() {
  const [teams, setTeams] = useState([]);
  const [settings, setSettings] = useState({ advanced: 1200, mid: 600 });
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchApi('/admin/teams').then(setTeams);
  }, []);

  const handleReassign = async (playerId: string, teamId: number) => {
    await fetchApi('/admin/reassign', { method: 'POST', body: JSON.stringify({ player_id: playerId, target_team_id: teamId }) });
    fetchApi('/admin/teams').then(setTeams);
  };

  const handleDelete = async (playerId: string) => {
    if(!confirm("Delete player? This will trigger an automatic cascade backfill.")) return;
    await fetchApi(`/admin/players/${playerId}`, { method: 'DELETE' });
    fetchApi('/admin/teams').then(setTeams);
  };

  const updateSettings = async (e: any) => {
    e.preventDefault();
    setStatus("Updating...");
    await fetchApi('/admin/settings', { method: 'POST', body: JSON.stringify({ advanced_threshold: settings.advanced, mid_threshold: settings.mid }) });
    setStatus("Updated & Recalculated!");
    fetchApi('/admin/teams').then(setTeams);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-12">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-red-400">Admin Controls</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-1 glass-card rounded-2xl p-8 h-fit sticky top-24">
          <h2 className="text-xl font-bold text-white mb-6">Event Settings</h2>
          <form onSubmit={updateSettings} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Advanced Threshold</label>
              <input type="number" value={settings.advanced} onChange={e => setSettings({...settings, advanced: +e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Mid Threshold</label>
              <input type="number" value={settings.mid} onChange={e => setSettings({...settings, mid: +e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none" />
            </div>
            <button type="submit" className="w-full bg-red-600/80 text-white font-bold py-3 rounded-lg hover:bg-red-600 transition-colors mt-4">Update & Recalculate</button>
          </form>
          {status && <p className="mt-4 text-center text-sm text-pink-400 font-bold">{status}</p>}
        </div>

        <div className="col-span-2 space-y-6">
          <h2 className="text-2xl font-bold text-white">Live Teams Roster</h2>
          {teams.map((t: any) => (
             <div key={t.id} className={`glass-card rounded-2xl p-6 border-l-4 transition-all ${t.is_locked ? 'border-l-red-500/50' : 'border-l-red-500'}`}>
               <h3 className="text-xl font-bold text-white mb-4 flex justify-between items-center">
                 <span>Team {t.team_number}</span>
                 {t.is_locked && <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full uppercase tracking-widest">Locked</span>}
               </h3>
               <div className="space-y-2">
                 {t.members?.filter((m: any) => m).map((m: any) => (
                   <div key={m.id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5">
                     <div>
                       <span className="font-bold text-gray-200">{m.name}</span>
                       <span className="ml-2 text-xs bg-black/30 px-2 py-1 rounded text-gray-400">{m.tier} ({m.rating})</span>
                     </div>
                     <div className="flex gap-3">
                       <select className="bg-black/80 text-xs text-white p-2 rounded border border-white/10 cursor-pointer outline-none" onChange={(e) => handleReassign(m.id, +e.target.value)} value={t.id}>
                         {teams.map((tOpt: any) => <option key={tOpt.id} value={tOpt.id}>Move to Team {tOpt.team_number}</option>)}
                       </select>
                       <button onClick={() => handleDelete(m.id)} className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1 rounded text-xs font-bold transition-colors">Kick</button>
                     </div>
                   </div>
                 ))}
                 {!t.members || t.members.filter((m: any) => m).length === 0 ? <p className="text-gray-500 text-sm py-4 text-center">Empty</p> : null}
               </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}
