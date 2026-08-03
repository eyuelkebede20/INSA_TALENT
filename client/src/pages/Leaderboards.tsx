import { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import html2canvas from 'html2canvas';

export default function Leaderboards() {
  const [students, setStudents] = useState([]);
  const [teams, setTeams] = useState([]);
  
  useEffect(() => {
    fetchApi('/leaderboard/students').then(setStudents);
    fetchApi('/leaderboard/teams/rating').then(setTeams);
  }, []);

  const exportAsImage = async (id: string, name: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: '#09090b', scale: 2 });
    const link = document.createElement('a');
    link.download = `${name}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-12">
      
      {/* Students */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Top Students</h2>
          <button onClick={() => exportAsImage('student-board', 'insa-top-students')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer">Export PNG</button>
        </div>
        <div id="student-board" className="glass-card rounded-2xl p-8 border-t-4 border-t-indigo-500">
          <h3 className="text-xl font-bold text-white mb-6 tracking-tighter">INSA<span className="text-indigo-400">TALENT</span> Leaderboard</h3>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-sm uppercase tracking-wider">
                <th className="pb-3 pl-4">Rank</th>
                <th className="pb-3">Name</th>
                <th className="pb-3">Tier</th>
                <th className="pb-3 text-right pr-4">Rating</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s: any, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 pl-4 font-bold text-gray-300">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </td>
                  <td className="py-4 text-white font-medium">{s.real_name} <span className="text-gray-500 text-xs ml-2">({s.lichess_username})</span></td>
                  <td className="py-4"><span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full font-semibold">{s.tier}</span></td>
                  <td className="py-4 text-right pr-4 font-bold text-pink-400">{s.current_rating}</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">No students found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Teams */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Top Teams</h2>
          <button onClick={() => exportAsImage('team-board', 'insa-top-teams')} className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer">Export PNG</button>
        </div>
        <div id="team-board" className="glass-card rounded-2xl p-8 border-t-4 border-t-pink-500">
          <h3 className="text-xl font-bold text-white mb-6 tracking-tighter">INSA<span className="text-pink-400">TALENT</span> Team Rankings</h3>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-sm uppercase tracking-wider">
                <th className="pb-3 pl-4">Rank</th>
                <th className="pb-3">Team</th>
                <th className="pb-3 text-right pr-4">Total Rating</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t: any, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 pl-4 font-bold text-gray-300">
                    {i === 0 ? '👑' : `#${i + 1}`}
                  </td>
                  <td className="py-4 text-white font-medium">Team {t.team_number}</td>
                  <td className="py-4 text-right pr-4 font-bold text-indigo-400">{t.total_rating}</td>
                </tr>
              ))}
              {teams.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500">No teams found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
