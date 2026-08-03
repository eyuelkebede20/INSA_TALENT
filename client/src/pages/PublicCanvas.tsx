import { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';

export default function PublicCanvas() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchApi('/canvas').then((data) => {
      setTeams(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-10">
      <div className="text-center mt-6">
        <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">INSA TALENT CANVAS</h1>
        <p className="text-base-content/60 max-w-2xl mx-auto text-lg">Live view of all assembled teams and their current rosters.</p>
      </div>
      
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card bg-base-100 shadow-xl border border-base-300">
              <div className="card-body">
                <div className="flex justify-between items-center mb-4">
                  <div className="skeleton h-8 w-28"></div>
                  <div className="skeleton h-6 w-20 rounded-full"></div>
                </div>
                <div className="space-y-3">
                  <div className="skeleton h-12 w-full"></div>
                  <div className="skeleton h-12 w-full"></div>
                  <div className="skeleton h-12 w-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {teams.map((t: any) => (
            <div key={t.id} className={`card bg-base-100 shadow-xl border-t-4 transition-transform hover:-translate-y-1 ${t.is_locked ? 'border-t-success' : 'border-t-primary'}`}>
              <div className="card-body p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="card-title text-2xl font-bold">Team {t.team_number}</h3>
                  {t.is_locked ? (
                    <div className="badge badge-success badge-outline font-bold uppercase text-xs p-3">Locked (Ready)</div>
                  ) : (
                    <div className="badge badge-primary badge-outline font-bold uppercase text-xs p-3">Recruiting</div>
                  )}
                </div>
                
                <div className="space-y-3">
                  {t.members?.filter((m: any) => m).map((m: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-base-200 border border-base-300">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full shadow-sm ${m.tier === 'ADVANCED' ? 'bg-secondary' : m.tier === 'MID' ? 'bg-accent' : 'bg-primary'}`}></div>
                        <div>
                          <p className="text-sm font-bold">{m.name}</p>
                          <p className="text-xs text-base-content/60">{m.tier}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">{m.rating}</p>
                      </div>
                    </div>
                  ))}
                  
                  {!t.members || t.members.filter((m: any) => m).length === 0 ? (
                    <div className="text-center py-6 text-base-content/40 text-sm font-medium">No members yet.</div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {teams.length === 0 && (
            <div className="col-span-full text-center py-20 text-base-content/50 text-xl">
              No teams have been formed yet. The Canvas is blank.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
