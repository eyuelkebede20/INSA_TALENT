import { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';

export default function Leaderboards() {
  const [students, setStudents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Pagination States
  const [studentSearch, setStudentSearch] = useState('');
  const [studentPage, setStudentPage] = useState(1);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamPage, setTeamPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const ITEMS_PER_PAGE = isExporting ? 10000 : 10;
  
  useEffect(() => {
    Promise.all([
      fetchApi('/leaderboard/students').then(setStudents),
      fetchApi('/leaderboard/teams/rating').then(setTeams)
    ]).finally(() => setLoading(false));
  }, []);

  const exportAsImage = async (id: string, name: string) => {
    setIsExporting(true);
    toast.info("Preparing full leaderboard for export...", { id: 'export' });
    
    // Give DOM time to un-paginate
    setTimeout(async () => {
      const el = document.getElementById(id);
      if (!el) {
        setIsExporting(false);
        return;
      }
      
      try {
        const theme = document.documentElement.getAttribute('data-theme');
        const bgColor = theme === 'light' ? '#ffffff' : '#1d232a';
        
        const dataUrl = await toPng(el, { backgroundColor: bgColor, style: { padding: '20px' } });
        const link = document.createElement('a');
        link.download = `${name}.png`;
        link.href = dataUrl;
        link.click();
        toast.success("Leaderboard exported successfully!", { id: 'export' });
      } catch (err) {
        console.error(err);
        toast.error("Failed to export image.", { id: 'export' });
      } finally {
        setIsExporting(false);
      }
    }, 500); // 500ms for React to render the full list
  };

  // Filtered & Paginated Data
  const sSearch = studentSearch.toLowerCase().trim();
  const sSearchNoSpaces = sSearch.replace(/\s+/g, '');

  const filteredStudents = students.filter(s => 
    s.real_name.toLowerCase().includes(sSearch) || 
    s.lichess_username?.toLowerCase().includes(sSearch) ||
    s.insa_code?.toLowerCase().includes(sSearch) ||
    s.insa_code?.toLowerCase().replace(/-/g, '').includes(sSearchNoSpaces) ||
    s.team_number?.toString().includes(sSearch.replace('team', '').trim()) ||
    `team${s.team_number}`.includes(sSearchNoSpaces)
  );
  const paginatedStudents = filteredStudents.slice((studentPage - 1) * ITEMS_PER_PAGE, studentPage * ITEMS_PER_PAGE);
  const totalStudentPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);

  const tSearch = teamSearch.toLowerCase().trim();
  const tSearchNoSpaces = tSearch.replace(/\s+/g, '');

  const filteredTeams = teams.filter(t => 
    t.team_number.toString() === tSearch ||
    t.team_number.toString().includes(tSearch.replace('team', '').trim()) ||
    `team${t.team_number}`.includes(tSearchNoSpaces)
  );
  const paginatedTeams = filteredTeams.slice((teamPage - 1) * ITEMS_PER_PAGE, teamPage * ITEMS_PER_PAGE);
  const totalTeamPages = Math.ceil(filteredTeams.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-12">
      
      {/* Students */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-3xl font-bold">Top Students</h2>
          <div className="flex gap-2 w-full sm:w-auto">
            <input 
              type="text" 
              placeholder="Search by name, user, or ID..." 
              value={studentSearch} 
              onChange={e => { setStudentSearch(e.target.value); setStudentPage(1); }} 
              className="input input-bordered input-sm flex-1 sm:w-64"
            />
            <button onClick={() => exportAsImage('student-board', 'insa-top-students')} className="btn btn-primary btn-sm whitespace-nowrap">Export PNG</button>
          </div>
        </div>
        
        {loading ? (
          <div className="card bg-base-100 shadow-xl border border-base-300 p-8">
            <div className="skeleton h-8 w-64 mb-8"></div>
            <div className="space-y-4">
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-12 w-full"></div>)}
            </div>
          </div>
        ) : (
          <div id="student-board" className="card bg-base-100 shadow-xl border-t-4 border-t-primary p-8 rounded-2xl overflow-visible">
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
                  {paginatedStudents.map((s: any, i) => {
                    const actualRank = (studentPage - 1) * ITEMS_PER_PAGE + i;
                    return (
                      <tr key={i} className="hover">
                        <td className="font-bold text-lg">
                          {actualRank === 0 ? '🥇' : actualRank === 1 ? '🥈' : actualRank === 2 ? '🥉' : `#${actualRank + 1}`}
                        </td>
                        <td className="font-medium text-base">
                          {s.real_name} 
                          {s.lichess_username ? (
                            <span className="text-base-content/50 text-xs ml-2">({s.lichess_username})</span>
                          ) : (
                            <div className="tooltip tooltip-right ml-2 inline-flex items-center" data-tip="No Lichess Account Linked">
                              <div className="w-2 h-2 rounded-full bg-error animate-pulse"></div>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className={`badge badge-sm font-semibold p-2 ${s.tier === 'ADVANCED' ? 'badge-secondary' : s.tier === 'MID' ? 'badge-accent' : 'badge-primary'}`}>
                            {s.tier}
                          </div>
                        </td>
                        <td className="text-right font-bold text-secondary text-lg">{s.current_rating}</td>
                      </tr>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-base-content/50">No students match your search.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {totalStudentPages > 1 && !isExporting && (
              <div className="flex justify-center mt-6 gap-2" data-html2canvas-ignore>
                <button className="btn btn-sm" disabled={studentPage === 1} onClick={() => setStudentPage(p => p - 1)}>«</button>
                <span className="flex items-center text-sm px-2 font-bold opacity-60">Page {studentPage} of {totalStudentPages}</span>
                <button className="btn btn-sm" disabled={studentPage === totalStudentPages} onClick={() => setStudentPage(p => p + 1)}>»</button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Teams */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-3xl font-bold">Top Teams</h2>
          <div className="flex gap-2 w-full sm:w-auto">
            <input 
              type="text" 
              placeholder="Search team number..." 
              value={teamSearch} 
              onChange={e => { setTeamSearch(e.target.value); setTeamPage(1); }} 
              className="input input-bordered input-sm flex-1 sm:w-48"
            />
            <button onClick={() => exportAsImage('team-board', 'insa-top-teams')} className="btn btn-secondary btn-sm whitespace-nowrap">Export PNG</button>
          </div>
        </div>
        
        {loading ? (
          <div className="card bg-base-100 shadow-xl border border-base-300 p-8">
            <div className="skeleton h-8 w-64 mb-8"></div>
            <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="skeleton h-12 w-full"></div>)}
            </div>
          </div>
        ) : (
          <div id="team-board" className="card bg-base-100 shadow-xl border-t-4 border-t-secondary p-8 rounded-2xl overflow-visible">
            <h3 className="text-2xl font-bold mb-6 tracking-tighter">INSA<span className="text-secondary">TALENT</span> Team Rankings</h3>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="text-base-content/60 text-sm uppercase tracking-wider border-b-2 border-base-300">
                    <th>Rank</th>
                    <th>Team</th>
                    <th className="text-right">Total Wins</th>
                    <th className="text-right">Total Losses</th>
                    <th className="text-right">Net Score</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTeams.map((t: any, i) => {
                    const actualRank = (teamPage - 1) * ITEMS_PER_PAGE + i;
                    return (
                      <tr key={i} className="hover">
                        <td className="font-bold text-lg">
                          {actualRank === 0 ? '👑' : `#${actualRank + 1}`}
                        </td>
                        <td className="font-medium text-base">Team {t.team_number}</td>
                        <td className="text-right font-bold text-success text-lg">+{t.total_wins}</td>
                        <td className="text-right font-bold text-error text-lg">-{t.total_losses}</td>
                        <td className="text-right font-bold text-primary text-lg">{t.total_rating > 0 ? `+${t.total_rating}` : t.total_rating}</td>
                      </tr>
                    );
                  })}
                  {filteredTeams.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-base-content/50">No teams match your search.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {totalTeamPages > 1 && !isExporting && (
              <div className="flex justify-center mt-6 gap-2" data-html2canvas-ignore>
                <button className="btn btn-sm" disabled={teamPage === 1} onClick={() => setTeamPage(p => p - 1)}>«</button>
                <span className="flex items-center text-sm px-2 font-bold opacity-60">Page {teamPage} of {totalTeamPages}</span>
                <button className="btn btn-sm" disabled={teamPage === totalTeamPages} onClick={() => setTeamPage(p => p + 1)}>»</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
