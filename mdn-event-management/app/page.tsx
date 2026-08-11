'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface User {
  member_id: number;
  name: string;
  email: string;
  role: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-slate-800/80 backdrop-blur-md border border-slate-700 p-8 rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20 mb-3">
            Milestone 1 Demo
          </span>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            MDN Event Management
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Authentication Test Dashboard (Roy's Deliverable)
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading session state...</div>
        ) : user ? (
          <div className="bg-slate-950/60 border border-slate-700/80 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-100">Authenticated Member</h2>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {user.role}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500 block mb-1">
                  Member ID
                </span>
                <span className="font-mono text-slate-200">#{user.member_id}</span>
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500 block mb-1">
                  Name
                </span>
                <span className="font-medium text-slate-100">{user.name}</span>
              </div>
              <div className="col-span-2">
                <span className="text-xs uppercase font-semibold text-slate-500 block mb-1">
                  Email Address
                </span>
                <span className="font-medium text-slate-100">{user.email}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800 flex justify-end">
              <button
                onClick={handleLogout}
                className="px-5 py-2.5 bg-red-600/80 hover:bg-red-600 text-white font-medium text-sm rounded-xl transition duration-200 shadow-md"
              >
                Log Out
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl mb-8">
              <p className="text-slate-300 text-sm">
                No active session found. Test the authentication system below:
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg transition"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-6 py-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-semibold text-sm rounded-xl transition"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
