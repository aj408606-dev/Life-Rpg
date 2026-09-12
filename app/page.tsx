'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function LifeRPG() {
  const [user, setUser] = useState({ level: 1, xp: 0, gold: 0, streak: 1 });
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Strength');
  const [loading, setLoading] = useState(true);

  // Fetch tasks and user stats on load
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    // Fetch tasks
    const { data: taskData } = await supabase.from('tasks').select('*').order('id', { ascending: false });
    if (taskData) setTasks(taskData);

    // Fetch or initialize user stats
    const { data: userData } = await supabase.from('users').select('*').limit(1);
    if (userData && userData.length > 0) {
      setUser(userData[0]);
    }
    setLoading(false);
  }

  // Add a new Quest (Task)
  async function handleAddTask(e) {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask = {
      title,
      category,
      xp_reward: category === 'Intellect' ? 60 : 50,
      completed: false
    };

    const { data, error } = await supabase.from('tasks').insert([newTask]).select();
    if (data) {
      setTasks([data[0], ...tasks]);
      setTitle('');
    }
  }

  // Complete a Quest & Level Up Logic
  async function handleCompleteTask(task) {
    if (task.completed) return;

    // Update task in database
    await supabase.from('tasks').update({ completed: true }).eq('id', task.id);

    // Calculate progression
    const xpGained = task.xp_reward;
    const goldGained = 20;
    let newXp = user.xp + xpGained;
    let newLevel = user.level;
    const xpNeeded = user.level * 100; // Non-linear progression

    if (newXp >= xpNeeded) {
      newLevel += 1;
      newXp = newXp - xpNeeded; // Carry over XP
    }

    const updatedUser = {
      ...user,
      xp: newXp,
      level: newLevel,
      gold: user.gold + goldGained
    };

    setUser(updatedUser);
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, completed: true } : t)));

    // Save user stats to database
    if (user.id) {
      await supabase.from('users').update(updatedUser).eq('id', user.id);
    } else {
      const { data } = await supabase.from('users').insert([updatedUser]).select();
      if (data) setUser(data[0]);
    }
  }

  const xpPercent = Math.min(100, Math.round((user.xp / (user.level * 100)) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Character Dashboard Header */}
        <header className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg shadow-cyan-950/20">
          <div className="flex justify-between items-center mb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Hero Status</span>
              <h1 className="text-3xl font-black tracking-tight text-white">Level {user.level} Adventurer</h1>
            </div>
            <div className="flex gap-4">
              <div className="bg-amber-950/40 border border-amber-500/30 px-4 py-2 rounded-lg text-center">
                <span className="text-xs text-amber-400 block font-bold">GOLD</span>
                <span className="text-lg font-black text-amber-300">🪙 {user.gold}</span>
              </div>
              <div className="bg-red-950/40 border border-red-500/30 px-4 py-2 rounded-lg text-center">
                <span className="text-xs text-red-400 block font-bold">STREAK</span>
                <span className="text-lg font-black text-red-300">🔥 {user.streak}d</span>
              </div>
            </div>
          </div>

          {/* XP Bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1 font-medium">
              <span>EXP Progress</span>
              <span>{user.xp} / {user.level * 100} XP ({xpPercent}%)</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-cyan-500 h-full transition-all duration-500 ease-out" 
                style={{ width: `${xpPercent}%` }}
              ></div>
            </div>
          </div>
        </header>

        {/* Quest Creation Form */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4 text-slate-200">Embark on a New Quest</h2>
          <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="E.g., Complete 30 min workout, Read 10 pages..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="Strength">Strength (Gym/Fitness)</option>
              <option value="Intellect">Intellect (Coding/Study)</option>
              <option value="Discipline">Discipline (Habit)</option>
            </select>
            <button
              type="submit"
              className="bg-cyan-600 hover:bg-cyan-500 active:scale-95 transition text-white font-bold px-6 py-2 rounded-lg"
            >
              Add Quest
            </button>
          </form>
        </section>

        {/* Active Quests List */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-200">Active Quests</h2>
          {loading ? (
            <p className="text-slate-500">Loading your adventure...</p>
          ) : tasks.length === 0 ? (
            <p className="text-slate-500">No active quests. Add one above to begin earning rewards!</p>
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
                  <h3 className={`font-semibold text-base ${task.completed ? 'line-through text-slate-400' : 'text-white'}`}>
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