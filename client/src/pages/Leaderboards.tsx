import { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import html2canvas from 'html2canvas';

export default function Leaderboards() {
  const [students, setStudents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    Promise.all([
      fetchApi('/leaderboard/students').then(setStudents),
      fetchApi('/leaderboard/teams/rating').then(setTeams)
    ]).finally(() => setLoading(false));
  }, []);

  const exportAsImage = async (id: string, name: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    
    const theme = document.documentElement.getAttribute('data-theme');
    const bgColor = theme === 'light' ? '#ffffff' : '#1d232a';

    const canvas = await html2canvas(el, { backgroundColor: bgColor, scale: 2 });
    const link = document.createElement('a');
    link.download = `${name}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="space-y-12">
      
      {/* Students */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Top Students</h2>
          <button onClick={() => exportAsImage('student-board', 'insa-top-students')} className="btn btn-primary btn-sm">Export PNG</button>
        </div>
        
        {loading ? (
          <div className="card bg-base-100 shadow-xl border border-base-300 p-8">
            <div className="skeleton h-8 w-64 mb-8"></div>
            <div className="space-y-4">
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-12 w-full"></div>)}
            </div>
          </div>
        ) : (
          <div id="student-board" className="card bg-base-100 shadow-xl border-t-4 border-t-primary p-8 rounded-2xl">
            <h3 className="text-2xl font-bold mb-6 tracking-tighter">INSA<span className="text-primary">TALENT</span> Leaderboard</h3>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="text-base-content/60 text-sm uppercase tracking-wider border-b-2 border-base-300">
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Tier</th>
                    <th className="text-right">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s: any, i) => (
                    <tr key={i} className="hover">
                      <td className="font-bold text-lg">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </td>
                      <td className="font-medium text-base">
                        {s.real_name} <span className="text-base-content/50 text-xs ml-2">({s.lichess_username})</span>
                      </td>
                      <td>
                        <div className={`badge badge-sm font-semibold p-2 ${s.tier === 'ADVANCED' ? 'badge-secondary' : s.tier === 'MID' ? 'badge-accent' : 'badge-primary'}`}>
                          {s.tier}
                        </div>
                      </td>
                      <td className="text-right font-bold text-secondary text-lg">{s.current_rating}</td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-base-content/50">No students found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
      {/* Teams */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Top Teams</h2>
          <button onClick={() => exportAsImage('team-board', 'insa-top-teams')} className="btn btn-secondary btn-sm">Export PNG</button>
        </div>
        
        {loading ? (
          <div className="card bg-base-100 shadow-xl border border-base-300 p-8">
            <div className="skeleton h-8 w-64 mb-8"></div>
            <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="skeleton h-12 w-full"></div>)}
            </div>
          </div>
        ) : (
          <div id="team-board" className="card bg-base-100 shadow-xl border-t-4 border-t-secondary p-8 rounded-2xl">
            <h3 className="text-2xl font-bold mb-6 tracking-tighter">INSA<span className="text-secondary">TALENT</span> Team Rankings</h3>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="text-base-content/60 text-sm uppercase tracking-wider border-b-2 border-base-300">
                    <th>Rank</th>
                    <th>Team</th>
                    <th className="text-right">Total Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t: any, i) => (
                    <tr key={i} className="hover">
                      <td className="font-bold text-lg">
                        {i === 0 ? '👑' : `#${i + 1}`}
                      </td>
                      <td className="font-medium text-base">Team {t.team_number}</td>
                      <td className="text-right font-bold text-primary text-lg">{t.total_rating}</td>
                    </tr>
                  ))}
                  {teams.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-base-content/50">No teams found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
