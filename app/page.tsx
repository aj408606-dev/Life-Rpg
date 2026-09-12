'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function LifeRPG() {
  const [session, setSession] = useState<any>(null);
  const [checkingSession, setCheckingSession] = useState(true); // avoids login-page flash

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState(''); // e.g. "check your email"
  const [authLoading, setAuthLoading] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0); // seconds left before "Forgot password?" can be clicked again

  const [userStats, setUserStats] = useState({ level: 1, xp: 0, gold: 0, streak: 1 });
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Strength');
  const [loading, setLoading] = useState(true);

  // 1. Check user session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingSession(false);
      if (session) {
        fetchUserData(session.user.id, session.user.email);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setCheckingSession(false);
      if (session) {
        fetchUserData(session.user.id, session.user.email);
      } else {
        setTasks([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Countdown timer for the reset-password cooldown
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const t = setInterval(() => setResetCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resetCooldown]);

  // 2. Fetch User Stats and Tasks
  // email is passed in explicitly instead of reading the `session` state
  // variable, which is stale here due to React's async state updates.
  async function fetchUserData(userId: string, userEmail?: string) {
    setLoading(true);

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      setUserStats(profile);
    } else {
      // upsert instead of insert avoids a race condition where two
      // near-simultaneous calls (e.g. React Strict Mode double-invoking
      // effects in dev) both try to insert the same row.
      const defaultProfile = {
        id: userId,
        email: userEmail ?? null,
        level: 1,
        xp: 0,
        gold: 0,
        streak: 1,
      };
      const { error: upsertError } = await supabase
        .from('users')
        .upsert([defaultProfile], { onConflict: 'id' });

      if (upsertError) {
        console.error('Failed to initialize profile:', upsertError.message);
      }
      setUserStats(defaultProfile);
    }

    const { data: userTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('id', { ascending: false });

    if (tasksError) console.error('Failed to load tasks:', tasksError.message);
    if (userTasks) setTasks(userTasks);
    setLoading(false);
  }

  // 3. Handle Signup / Login
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setAuthError(
            error.message.toLowerCase().includes('rate limit')
              ? 'Too many email requests right now — please wait a bit before trying again.'
              : error.message
          );
        } else if (data.user && !data.session) {
          // Email confirmation required on this Supabase project
          setAuthMessage('Account created! Check your email to confirm before logging in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setAuthError(error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  }

  // Forgot password
  async function handleForgotPassword() {
    if (resetCooldown > 0) return;
    setAuthError('');
    setAuthMessage('');
    if (!email.trim()) {
      setAuthError('Enter your email above first, then click "Forgot password?"');
      return;
    }
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      if (error) {
        setAuthError(
          error.message.toLowerCase().includes('rate limit')
            ? 'Too many reset emails requested — please wait before trying again.'
            : error.message
        );
      } else {
        setAuthMessage('Password reset email sent — check your inbox.');
        setResetCooldown(60); // 60s before it can be clicked again
      }
    } finally {
      setAuthLoading(false);
    }
  }

  // 4. Add Task
  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !session) return;

    const newTask = {
      user_id: session.user.id,
      title,
      category,
      xp_reward: category === 'Intellect' ? 60 : 50,
      completed: false,
    };

    const { data, error } = await supabase.from('tasks').insert([newTask]).select();
    if (error) {
      console.error('Failed to add task:', error.message);
      return;
    }
    if (data) {
      setTasks([data[0], ...tasks]);
      setTitle('');
    }
  }

  // 5. Complete Task & Level Up
  async function handleCompleteTask(task: any) {
    if (task.completed || !session) return;

    const { error: taskError } = await supabase
      .from('tasks')
      .update({ completed: true })
      .eq('id', task.id);
    if (taskError) {
      console.error('Failed to mark task complete:', taskError.message);
      return;
    }

    const xpGained = task.xp_reward;
    const goldGained = 20;
    let newXp = userStats.xp + xpGained;
    let newLevel = userStats.level;

    // Loop instead of a single `if`, so an XP reward that crosses more
    // than one level threshold at once is handled correctly.
    let xpNeeded = newLevel * 100;
    while (newXp >= xpNeeded) {
      newLevel += 1;
      newXp -= xpNeeded;
      xpNeeded = newLevel * 100;
    }

    const updated = {
      ...userStats,
      xp: newXp,
      level: newLevel,
      gold: userStats.gold + goldGained,
    };

    const { error: userError } = await supabase.from('users').update(updated).eq('id', session.user.id);
    if (userError) {
      console.error('Failed to save updated stats:', userError.message);
      return; // don't update local state if the write failed
    }

    setUserStats(updated);
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, completed: true } : t)));
  }

  // Avoid flashing the login screen while the initial session check resolves
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading...
      </div>
    );
  }

  // --- Render: Login / Signup Form ---
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
          <h1 className="text-3xl font-black text-center text-cyan-400 mb-2">LIFE RPG</h1>
          <p className="text-center text-slate-400 text-sm mb-6">Gamify your daily quests and level up your life</p>

          {authError && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm mb-4">
              {authError}
            </div>
          )}
          {authMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-400 p-3 rounded-lg text-sm mb-4">
              {authMessage}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500"
                placeholder="hero@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold p-3 rounded-lg transition"
            >
              {authLoading
                ? 'Please wait...'
                : authMode === 'signup'
                ? 'Create Hero Account'
                : 'Enter the Realm (Login)'}
            </button>
          </form>

          {authMode === 'login' && (
            <button
              onClick={handleForgotPassword}
              disabled={authLoading || resetCooldown > 0}
              className="block mx-auto text-xs text-slate-400 underline mt-3 hover:text-slate-300 disabled:opacity-50"
            >
              {resetCooldown > 0 ? `Try again in ${resetCooldown}s` : 'Forgot password?'}
            </button>
          )}

          <p className="text-center text-xs text-slate-400 mt-4">
            {authMode === 'signup' ? 'Already an adventurer? ' : "Don't have an account? "}
            <button
              onClick={() => {
                setAuthMode(authMode === 'signup' ? 'login' : 'signup');
                setAuthError('');
                setAuthMessage('');
              }}
              className="text-cyan-400 underline font-semibold"
            >
              {authMode === 'signup' ? 'Login' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // --- Render: Main Game Dashboard ---
  const xpPercent = Math.min(100, Math.round((userStats.xp / (userStats.level * 100)) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header Bar with Signout */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">Logged in as: <b className="text-cyan-400">{session.user.email}</b></span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-slate-300 transition"
          >
            Sign Out
          </button>
        </div>

        {/* Hero Card */}
        <header className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Character Level</span>
              <h1 className="text-3xl font-black text-white">Level {userStats.level} Adventurer</h1>
            </div>
            <div className="flex gap-4">
              <div className="bg-amber-950/40 border border-amber-500/30 px-4 py-2 rounded-lg text-center">
                <span className="text-xs text-amber-400 block font-bold">GOLD</span>
                <span className="text-lg font-black text-amber-300">🪙 {userStats.gold}</span>
              </div>
              <div className="bg-red-950/40 border border-red-500/30 px-4 py-2 rounded-lg text-center">
                <span className="text-xs text-red-400 block font-bold">STREAK</span>
                <span className="text-lg font-black text-red-300">🔥 {userStats.streak}d</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1 font-medium">
              <span>EXP Progress</span>
              <span>{userStats.xp} / {userStats.level * 100} XP ({xpPercent}%)</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-cyan-500 h-full transition-all duration-500 ease-out"
                style={{ width: `${xpPercent}%` }}
              ></div>
            </div>
          </div>
        </header>

        {/* Add Quest */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4 text-slate-200">Embark on a New Quest</h2>
          <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="e.g. 1 hour study, 30 min workout..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="Strength">Strength (Fitness)</option>
              <option value="Intellect">Intellect (Study/Code)</option>
              <option value="Discipline">Discipline (Habits)</option>
            </select>
            <button
              type="submit"
              className="bg-cyan-600 hover:bg-cyan-500 active:scale-95 transition text-white font-bold px-6 py-2 rounded-lg"
            >
              Add Quest
            </button>
          </form>
        </section>

        {/* Quests List */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-200">Active Quests</h2>
          {loading ? (
            <p className="text-slate-500">Retrieving quest log...</p>
          ) : tasks.length === 0 ? (
            <p className="text-slate-500">No quests logged yet. Add one above to begin!</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition ${
                  task.completed
                    ? 'bg-slate-900/40 border-slate-800 opacity-50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <h3 className={`font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-white'}`}>
                    {task.title}
                  </h3>
                  <div className="flex gap-2 text-xs text-slate-400 mt-1">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-cyan-400">{task.category}</span>
                    <span>+{task.xp_reward} XP</span>
                    <span>+20 Gold</span>
                  </div>
                </div>

                <button
                  onClick={() => handleCompleteTask(task)}
                  disabled={task.completed}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
                    task.completed
                      ? 'bg-emerald-950/40 text-emerald-400 cursor-default'
                      : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white'
                  }`}
                >
                  {task.completed ? '✓ Completed' : 'Complete Quest'}
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}