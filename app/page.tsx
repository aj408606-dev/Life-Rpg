'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type UserStats = {
  id?: string;
  email?: string;
  level: number;
  xp: number;
  gold: number;
  streak: number;
  last_active?: string;
};

type Attributes = {
  strength: number;
  intellect: number;
  discipline: number;
};

type Task = {
  id: number;
  user_id: string;
  title: string;
  category: 'Strength' | 'Intellect' | 'Discipline';
  xp_reward: number;
  completed: boolean;
};

export default function LifeRPG() {
  const [session, setSession] = useState<any>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [userStats, setUserStats] = useState<UserStats>({
    level: 1,
    xp: 0,
    gold: 0,
    streak: 1,
  });

  const [attributes, setAttributes] = useState<Attributes>({
    strength: 0,
    intellect: 0,
    discipline: 0,
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'Strength' | 'Intellect' | 'Discipline'>('Strength');
  const [loading, setLoading] = useState(true);

  // 1. Session Setup
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(session);
      setCheckingSession(false);

      if (session) {
        await fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setSession(session);
      setCheckingSession(false);

      if (session) {
        await fetchUserData(session.user.id);
      } else {
        setTasks([]);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch User Data
  async function fetchUserData(userId: string) {
    setLoading(true);

    try {
      // Profile
      const { data: profile } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      if (profile) {
        setUserStats(profile);
      } else {
        const defaultProfile: UserStats = {
          id: userId,
          email: session?.user?.email ?? '',
          level: 1,
          xp: 0,
          gold: 0,
          streak: 1,
        };
        await supabase.from('users').insert([defaultProfile]);
        setUserStats(defaultProfile);
      }

      // Attributes
      const { data: attributeData } = await supabase.from('attributes').select('*').eq('user_id', userId).maybeSingle();
      if (attributeData) {
        setAttributes({
          strength: attributeData.strength ?? 0,
          intellect: attributeData.intellect ?? 0,
          discipline: attributeData.discipline ?? 0,
        });
      } else {
        const defaultAttributes = { user_id: userId, strength: 0, intellect: 0, discipline: 0 };
        await supabase.from('attributes').insert([defaultAttributes]);
        setAttributes({ strength: 0, intellect: 0, discipline: 0 });
      }

      // Tasks
      const { data: userTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: false });

      if (userTasks) setTasks(userTasks);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  // 3. Handle Auth
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setAuthError(error.message);
        } else {
          setAuthMessage('Account created! Logging you in...');
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) setAuthError(signInErr.message);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setAuthError(error.message);
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
      title: title.trim(),
      category,
      xp_reward: category === 'Intellect' ? 60 : 50,
      completed: false,
    };

    const { data } = await supabase.from('tasks').insert([newTask]).select().single();
    if (data) {
      setTasks((prev) => [data, ...prev]);
      setTitle('');
    }
  }

  // 5. Complete Task & Progressive Level Up
  async function handleCompleteTask(task: Task) {
    if (task.completed || !session) return;

    await supabase.from('tasks').update({ completed: true }).eq('id', task.id).eq('user_id', session.user.id);

    const xpGained = task.xp_reward;
    const goldGained = 20;

    let newXp = userStats.xp + xpGained;
    let newLevel = userStats.level;

    while (newXp >= newLevel * 100) {
      newXp -= newLevel * 100;
      newLevel += 1;
    }

    const updatedStats: UserStats = {
      ...userStats,
      xp: newXp,
      level: newLevel,
      gold: userStats.gold + goldGained,
    };

    const attrKey = task.category.toLowerCase() as keyof Attributes;
    const updatedAttributes: Attributes = {
      ...attributes,
      [attrKey]: attributes[attrKey] + 1,
    };

    setUserStats(updatedStats);
    setAttributes(updatedAttributes);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: true } : t)));

    // Save to Database
    await supabase.from('users').update({
      level: updatedStats.level,
      xp: updatedStats.xp,
      gold: updatedStats.gold,
    }).eq('id', session.user.id);

    await supabase.from('attributes').update(updatedAttributes).eq('user_id', session.user.id);
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-400 font-mono">
        Summoning Adventurer...
      </div>
    );
  }

  // Login View
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100 font-sans">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl shadow-cyan-950/40">
          <div className="text-center mb-6">
            <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">Gamified Productivity</span>
            <h1 className="text-3xl font-black text-white mt-1">LIFE RPG</h1>
            <p className="text-slate-400 text-sm mt-1">Turn mundane tasks into epic rewards</p>
          </div>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 p-3 rounded-lg text-xs mb-4">
              {authError}
            </div>
          )}

          {authMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 p-3 rounded-lg text-xs mb-4">
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
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition"
                placeholder="hero@realm.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold p-3 rounded-lg transition active:scale-95"
            >
              {authLoading ? 'Consulting the Oracle...' : authMode === 'signup' ? 'Create Hero Account' : 'Enter the Realm'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-5">
            {authMode === 'signup' ? 'Already an adventurer? ' : "Don't have an account? "}
            <button
              onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
              className="text-cyan-400 underline font-semibold ml-1"
            >
              {authMode === 'signup' ? 'Login' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Dashboard View
  const xpThreshold = userStats.level * 100;
  const xpPercent = Math.min(100, Math.round((userStats.xp / xpThreshold) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Top bar */}
        <div className="flex justify-between items-center bg-slate-900/50 border border-slate-800/80 px-4 py-2.5 rounded-xl">
          <span className="text-xs text-slate-400">
            Adventurer: <b className="text-cyan-400">{session.user.email}</b>
          </span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition"
          >
            Leave Realm
          </button>
        </div>

        {/* Hero Card */}
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-5">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Character Level</span>
              <h1 className="text-3xl font-black text-white">Level {userStats.level} Adventurer</h1>
            </div>
            <div className="flex gap-3">
              <div className="bg-amber-950/40 border border-amber-500/30 px-3.5 py-2 rounded-xl text-center">
                <span className="text-[10px] text-amber-400 block font-bold">GOLD</span>
                <span className="text-base font-black text-amber-300">🪙 {userStats.gold}</span>
              </div>
              <div className="bg-red-950/40 border border-red-500/30 px-3.5 py-2 rounded-xl text-center">
                <span className="text-[10px] text-red-400 block font-bold">STREAK</span>
                <span className="text-base font-black text-red-300">🔥 {userStats.streak}d</span>
              </div>
            </div>
          </div>

          {/* XP Bar */}
          <div className="space-y-1.5 mb-5">
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>EXP Progress</span>
              <span>{userStats.xp} / {xpThreshold} XP ({xpPercent}%)</span>
            </div>
            <div className="w-full bg-slate-800/80 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/50">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${xpPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Attributes */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800">
            <div className="bg-slate-950/60 p-2.5 rounded-xl text-center border border-slate-800/80">
              <span className="text-[10px] uppercase font-bold text-red-400 block">Strength</span>
              <span className="text-lg font-black text-slate-200">⚔️ {attributes.strength}</span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl text-center border border-slate-800/80">
              <span className="text-[10px] uppercase font-bold text-blue-400 block">Intellect</span>
              <span className="text-lg font-black text-slate-200">🧠 {attributes.intellect}</span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl text-center border border-slate-800/80">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Discipline</span>
              <span className="text-lg font-black text-slate-200">🛡️ {attributes.discipline}</span>
            </div>
          </div>
        </header>

        {/* Quest Input */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-base font-bold mb-3 text-slate-200">Embark on a Quest</h2>
          <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="e.g. 1 hour study, 30 min workout, read 15 pages..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500 transition"
            >
              <option value="Strength">Strength (Fitness)</option>
              <option value="Intellect">Intellect (Study/Code)</option>
              <option value="Discipline">Discipline (Habits)</option>
            </select>
            <button
              type="submit"
              className="bg-cyan-600 hover:bg-cyan-500 active:scale-95 transition text-white font-bold px-5 py-2.5 rounded-xl text-sm"
            >
              Add Quest
            </button>
          </form>
        </section>

        {/* Quest List */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-200">Quest Log</h2>
          {loading ? (
            <p className="text-slate-500 text-sm">Consulting quest records...</p>
          ) : tasks.length === 0 ? (
            <p className="text-slate-500 text-sm">No active quests. Add one above to begin your journey!</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition ${
                  task.completed
                    ? 'bg-slate-900/40 border-slate-800/60 opacity-50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-md'
                }`}
              >
                <div>
                  <h3 className={`font-semibold text-sm sm:text-base ${task.completed ? 'line-through text-slate-400' : 'text-white'}`}>
                    {task.title}
                  </h3>
                  <div className="flex gap-2 text-xs text-slate-400 mt-1">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-cyan-400 font-medium">{task.category}</span>
                    <span>+{task.xp_reward} XP</span>
                    <span>+20 Gold</span>
                  </div>
                </div>

                <button
                  onClick={() => handleCompleteTask(task)}
                  disabled={task.completed}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition ${
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