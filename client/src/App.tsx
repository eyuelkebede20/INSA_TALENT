import { Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import { signIn, useSession, fetchApi } from './lib/api';

import Leaderboards from './pages/Leaderboards';
import PublicCanvas from './pages/PublicCanvas';
import AdminDashboardView from './pages/AdminDashboard';

function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [status, setStatus] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi("/admin/login", {
        method: "POST",
        body: JSON.stringify({ password })
      });
      setLoggedIn(true);
    } catch (err: any) {
      setStatus("Invalid admin password");
    }
  };

  if (!loggedIn) {
    return (
      <div className="p-10 max-w-md mx-auto mt-20">
        <div className="glass-card rounded-2xl p-10 text-center">
          <h1 className="text-3xl font-bold mb-6 text-red-400">Superadmin Access</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              required 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" 
              placeholder="Enter Admin Password" 
            />
            <button type="submit" className="w-full bg-red-600/80 text-white font-bold py-3 rounded-lg hover:bg-red-600 transition-colors">
              Login
            </button>
          </form>
          {status && <p className="mt-4 text-center text-sm text-pink-400">{status}</p>}
        </div>
      </div>
    );
  }

  return <AdminDashboardView />;
}
function StudentFlow() {
  const { data: session, isPending } = useSession();
  const [lichess, setLichess] = useState("");
  const [insa, setInsa] = useState("");
  const [status, setStatus] = useState("");

  if (isPending) return <div className="p-10 text-white text-center mt-20">Loading...</div>;

  if (!session) {
    return (
      <div className="p-10 max-w-md mx-auto mt-20">
        <div className="glass-card rounded-2xl p-10 text-center">
          <h1 className="text-3xl font-bold mb-6 text-white">Student Login</h1>
          <p className="text-gray-400 mb-8 text-sm">Sign in with your Google account to join a team.</p>
          <button 
            onClick={() => signIn.social({ provider: 'google', callbackURL: '/student' })}
            className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Submitting...");
    try {
      await fetchApi("/students/complete-profile", {
        method: "POST",
        body: JSON.stringify({ lichess_username: lichess, insa_code: insa })
      });
      setStatus("Success! You've been assigned to a team.");
    } catch (err: any) {
      setStatus(err.message);
    }
  };

  return (
    <div className="p-10 max-w-md mx-auto mt-10">
      <div className="glass-card rounded-2xl p-8">
        <h2 className="text-2xl font-bold mb-2 text-white">Welcome, {session.user.name}</h2>
        <p className="text-gray-400 mb-6 text-sm">Please complete your profile to be grouped.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Lichess Username</label>
            <input type="text" required value={lichess} onChange={e => setLichess(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="MagnusCarlsen" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">INSA Code</label>
            <input type="text" required value={insa} onChange={e => setInsa(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="e.g. INSA-1234" />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors mt-4">
            Complete Profile
          </button>
        </form>
        {status && <p className="mt-4 text-center text-sm text-pink-400 font-medium">{status}</p>}
      </div>
    </div>
  );
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
