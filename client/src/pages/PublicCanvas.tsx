import { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";

const SearchZoomer = ({ filteredTeams }: { filteredTeams: any[] }) => {
  const { zoomToElement } = useControls();
  useEffect(() => {
    if (filteredTeams.length === 1) {
      zoomToElement(`team-card-${filteredTeams[0].id}`, 1.5, 500);
    }
  }, [filteredTeams, zoomToElement]);
  return null;
};

export default function PublicCanvas() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  useEffect(() => {
    fetchApi('/canvas').then((data) => {
      setTeams(data);
      setLoading(false);
    });
  }, []);

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

  return (
    <div className="absolute inset-0 z-40 bg-base-200 flex flex-col overflow-hidden">
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
        <div className="flex-1 w-full relative bg-base-200" style={{ backgroundImage: 'radial-gradient(#base-300 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
          <TransformWrapper initialScale={1} minScale={0.1} maxScale={4} centerOnInit limitToBounds={false} centerZoomedOut={false}>
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <SearchZoomer filteredTeams={filteredTeams} />
                <div className="absolute top-20 right-6 z-50 flex flex-col gap-2 bg-base-100 p-2 rounded-xl shadow-lg border border-base-300">
                  <button className="btn btn-sm btn-square btn-ghost" onClick={() => zoomIn()}>+</button>
                  <button className="btn btn-sm btn-square btn-ghost" onClick={() => zoomOut()}>-</button>
                  <button className="btn btn-sm btn-square btn-ghost" onClick={() => resetTransform()}>⟲</button>
                </div>
                <TransformComponent wrapperClass="!w-full !h-full !absolute !inset-0 cursor-grab active:cursor-grabbing" contentClass="p-[500px] w-full h-full flex items-center justify-center">
                  <div className="flex flex-wrap gap-8 justify-center min-w-[3000px]">
                    {filteredTeams.map((t: any) => (
                      <div id={`team-card-${t.id}`} key={t.id} className={`card bg-base-100 shadow-2xl border-t-8 w-[300px] md:w-[350px] shrink-0 transition-all ${t.is_locked ? 'border-t-success shadow-[0_0_30px_rgba(0,255,100,0.3)] hover:shadow-[0_0_40px_rgba(0,255,100,0.5)]' : 'border-t-primary hover:shadow-[0_0_20px_rgba(var(--primary),0.2)]'}`}>
                        <div className="card-body p-6">
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="card-title text-2xl font-bold">Team {t.team_number}</h3>
                            {t.is_locked ? (
                              <div className="badge badge-success badge-outline font-bold uppercase text-xs p-3">Locked</div>
                            ) : (
                              <div className="badge badge-primary badge-outline font-bold uppercase text-xs p-3">Recruiting</div>
                            )}
                          </div>
                          
                          <div className="space-y-3">
                            {(() => {
                              const validMembers = (t.members?.filter((m: any) => m) || []).sort((a: any, b: any) => {
                                const tierWeight: any = { ADVANCED: 3, MID: 2, BEGINNER: 1 };
                                if (tierWeight[a.tier] !== tierWeight[b.tier]) {
                                  return tierWeight[b.tier] - tierWeight[a.tier];
                                }
                                return b.rating - a.rating;
                              });
                              
                              return validMembers.map((m: any, i: number) => (
                              <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-base-200 border border-base-300">
                                <div className="flex items-center gap-3">
                                  <div className={`w-3 h-3 rounded-full shadow-sm ${m.tier === 'ADVANCED' ? 'bg-secondary' : m.tier === 'MID' ? 'bg-accent' : 'bg-primary'}`}></div>
                                  <div>
                                    <p className="text-sm font-bold flex items-center gap-2">
                                      {m.name}
                                      {!m.lichess_username && (
                                        <div className="tooltip tooltip-right" data-tip="No Lichess Account Linked">
                                          <div className="w-2 h-2 rounded-full bg-error animate-pulse"></div>
                                        </div>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right flex items-center justify-end gap-2">
                                  <p className="text-sm font-bold text-primary">{m.rating}</p>
                                  {m.lichess_username && (
                                    <a 
                                      href={`https://lichess.org/@/${m.lichess_username}`} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      className="btn btn-xs btn-outline btn-accent rounded-sm h-6 min-h-6 px-1.5 transition-transform hover:scale-110" 
                                      title={`Challenge ${m.lichess_username} on Lichess`}
                                      onPointerDown={(e) => e.stopPropagation()}
                                    >
                                      ⚔️
                                    </a>
                                  )}
                                </div>
                              </div>
                              ));
                            })()}
                            
                            {!t.members || t.members.filter((m: any) => m).length === 0 ? (
                              <div className="text-center py-6 text-base-content/40 text-sm font-medium">No members yet.</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredTeams.length === 0 && (
                      <div className="w-full text-center py-20 text-base-content/50 text-xl font-bold bg-base-100/50 rounded-2xl backdrop-blur-sm">
                        No teams or players match your search.
                      </div>
                    )}
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        </div>
      )}
    </div>
  );
}
