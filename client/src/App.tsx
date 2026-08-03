import { Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { signIn, useSession, fetchApi } from './lib/api';

import Leaderboards from './pages/Leaderboards';
import PublicCanvas from './pages/PublicCanvas';
import AdminDashboardView from './pages/AdminDashboard';

function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetchApi("/admin/login", {
        method: "POST",
        body: JSON.stringify({ password })
      });
      setLoggedIn(true);
    } catch (err: any) {
      setStatus("Invalid admin password");
    } finally {
      setLoading(false);
    }
  };

  if (!loggedIn) {
    return (
      <div className="flex justify-center items-center mt-20">
        <div className="card w-96 bg-base-100 shadow-xl border border-base-300">
          <div className="card-body items-center text-center">
            <h2 className="card-title text-3xl font-bold text-error mb-4">Superadmin</h2>
            <p className="text-base-content/70 mb-4">Sign in to manage the event.</p>
            <form onSubmit={handleLogin} className="w-full space-y-4">
              <input 
                type="password" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="input input-bordered input-error w-full" 
                placeholder="Admin Password" 
              />
              <button type="submit" className="btn btn-error w-full" disabled={loading}>
                {loading ? <span className="loading loading-spinner"></span> : "Login"}
              </button>
            </form>
            {status && <p className="text-sm text-error mt-2">{status}</p>}
          </div>
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
  const [loading, setLoading] = useState(false);

  if (isPending) return (
    <div className="flex justify-center mt-20 flex-col items-center gap-4">
      <span className="loading loading-dots loading-lg text-primary"></span>
      <p className="text-base-content/60 text-sm">Waking up the server (this can take up to 45 seconds on Render free tier)...</p>
    </div>
  );

  if (!session) {
    return (
      <div className="flex justify-center mt-20">
        <div className="card w-96 bg-base-100 shadow-xl border border-base-300">
          <div className="card-body items-center text-center">
            <h2 className="card-title text-3xl font-bold mb-4">Student Login</h2>
            <p className="text-base-content/70 mb-6">Sign in with your Google account to join a team.</p>
            <button 
              onClick={() => signIn.social({ provider: 'google', callbackURL: '/student' })}
              className="btn btn-primary w-full"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("Submitting...");
    try {
      await fetchApi("/students/complete-profile", {
        method: "POST",
        body: JSON.stringify({ lichess_username: lichess, insa_code: insa })
      });
      setStatus("Success! You've been assigned to a team.");
    } catch (err: any) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center mt-10">
      <div className="card w-full max-w-md bg-base-100 shadow-xl border border-base-300">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold">Welcome, {session.user.name}</h2>
          <p className="text-base-content/70 mb-4">Please complete your profile to be grouped.</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control w-full">
              <label className="label"><span className="label-text">Lichess Username</span></label>
              <input type="text" required value={lichess} onChange={e => setLichess(e.target.value)} className="input input-bordered w-full" placeholder="MagnusCarlsen" />
            </div>
            <div className="form-control w-full">
              <label className="label"><span className="label-text">INSA Code</span></label>
              <input type="text" required value={insa} onChange={e => setInsa(e.target.value)} className="input input-bordered w-full" placeholder="e.g. INSA-1234" />
            </div>
            <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
              {loading ? <span className="loading loading-spinner"></span> : "Complete Profile"}
            </button>
          </form>
          {status && <p className="mt-4 text-center text-sm font-bold text-success">{status}</p>}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-base-200 font-sans pb-20">
      <div className="navbar bg-base-100 shadow-sm sticky top-0 z-50 border-b border-base-300 px-6">
        <div className="flex-1">
          <Link to="/" className="text-xl font-bold tracking-tighter">INSA<span className="text-primary">TALENT</span></Link>
        </div>
        <div className="flex-none gap-4">
          <ul className="menu menu-horizontal px-1 font-semibold gap-2 hidden md:flex">
            <li><Link to="/">Canvas</Link></li>
            <li><Link to="/leaderboards">Leaderboards</Link></li>
            <li><Link to="/student" className="text-primary">Student Login</Link></li>
          </ul>
          
          <label className="swap swap-rotate btn btn-ghost btn-circle">
            <input type="checkbox" onChange={toggleTheme} checked={theme === 'light'} />
            {/* sun icon */}
            <svg className="swap-on fill-current w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/></svg>
            {/* moon icon */}
            <svg className="swap-off fill-current w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/></svg>
          </label>
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-4 mt-8">
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
