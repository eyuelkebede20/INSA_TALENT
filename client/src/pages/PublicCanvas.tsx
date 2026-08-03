import { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';

export default function PublicCanvas() {
  const [teams, setTeams] = useState([]);
  
  useEffect(() => {
    fetchApi('/canvas').then(setTeams);
  }, []);

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10">
      <div className="text-center">
        <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">INSA TALENT CANVAS</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">Live view of all assembled teams and their current rosters.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {teams.map((t: any) => (
          <div key={t.id} className={`glass-card rounded-2xl p-6 border-t-4 transition-transform hover:-translate-y-2 ${t.is_locked ? 'border-t-green-500' : 'border-t-indigo-500'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">Team {t.team_number}</h3>
              {t.is_locked ? (
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Locked (Ready)</span>
              ) : (
                <span className="bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Recruiting</span>
              )}
            </div>
            
            <div className="space-y-3">
              {t.members?.filter((m: any) => m).map((m: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shadow-lg ${m.tier === 'ADVANCED' ? 'bg-pink-500 shadow-pink-500/50' : m.tier === 'MID' ? 'bg-purple-500 shadow-purple-500/50' : 'bg-indigo-500 shadow-indigo-500/50'}`}></div>
                    <div>
                      <p className="text-sm font-bold text-gray-200">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.tier}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-indigo-300">{m.rating}</p>
                  </div>
                </div>
              ))}
              
              {!t.members || t.members.filter((m: any) => m).length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">No members yet.</div>
              ) : null}
            </div>
          </div>
        ))}
        {teams.length === 0 && (
          <div className="col-span-full text-center py-20 text-gray-500">
            No teams have been formed yet. The Canvas is blank.
          </div>
        )}
      </div>
    </div>
  );
}
