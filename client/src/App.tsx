import { Routes, Route } from 'react-router-dom';

function PublicCanvas() {
  return <div className="p-10"><h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-400 to-pink-500 bg-clip-text text-transparent">Public Canvas</h1><div className="glass-card rounded-xl p-8 min-h-[400px]">Teams will appear here.</div></div>;
}
function Leaderboards() {
  return <div className="p-10"><h1 className="text-4xl font-bold mb-4 text-white">Leaderboards</h1><div className="glass-card rounded-xl p-8 min-h-[400px]">Rankings will appear here.</div></div>;
}
function AdminDashboard() {
  return <div className="p-10"><h1 className="text-4xl font-bold mb-4 text-red-400">Superadmin</h1><div className="glass-card rounded-xl p-8 min-h-[400px]">Admin controls will appear here.</div></div>;
}
function StudentFlow() {
  return <div className="p-10"><h1 className="text-4xl font-bold mb-4 text-blue-400">Student Portal</h1><div className="glass-card rounded-xl p-8 min-h-[400px]">Onboarding will appear here.</div></div>;
}

function App() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30">
      <nav className="border-b border-white/10 glass px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="font-bold text-xl tracking-tighter">INSA<span className="text-indigo-400">TALENT</span></div>
        <div className="flex gap-6 text-sm font-medium text-gray-300">
          <a href="/" className="hover:text-white transition-colors">Canvas</a>
          <a href="/leaderboards" className="hover:text-white transition-colors">Leaderboards</a>
          <a href="/student" className="hover:text-white transition-colors">Student Login</a>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto">
        <Routes>
          <Route path="/" element={<PublicCanvas />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/student" element={<StudentFlow />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
