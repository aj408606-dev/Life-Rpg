"use client";
import React, { useState, useEffect, FormEvent } from 'react';

// ==========================================
// TYPES & DATA
// ==========================================

type Attribute = 'strength' | 'intellect' | 'discipline' | 'social';

interface Task {
  id: string;
  title: string;
  attr: Attribute;
  mins: number;
  done: boolean;
  created: number;
  xpAwarded?: number;
  goldAwarded?: number;
}

interface User {
  name: string;
  email: string;
  pass: string;
  xp: number;
  gold: number;
  streak: number;
  lastLogin: string;
  attrs: Record<Attribute, number>;
  completedCount: number;
  tasks: Task[];
  inventory: string[];
  equipped: { head: string | null; armor: string | null; shoes: string | null; pet: string | null };
  badges: string[];
  lastComplete: number;
}

interface Database {
  users: Record<string, User>;
  session: string | null;
}

const STORE_KEY = "liferpg.react.v1";

const SHOP = [
  { id: "h1", cat: "head", name: "Iron Helm", price: 40, icon: "🪖" },
  { id: "h2", cat: "head", name: "Mage Crown", price: 90, icon: "👑" },
  { id: "h3", cat: "head", name: "Ninja Band", price: 150, icon: "🥷" },
  { id: "h4", cat: "head", name: "Diamond Helm", price: 250, icon: "💎" },
  { id: "h5", cat: "head", name: "Cyber Visor", price: 400, icon: "🕶️" },
  { id: "a1", cat: "armor", name: "Travel Cloak", price: 50, icon: "🧥" },
  { id: "a2", cat: "armor", name: "Rune Plate", price: 120, icon: "🛡️" },
  { id: "a3", cat: "armor", name: "Mage Robes", price: 140, icon: "🥋" },
  { id: "a4", cat: "armor", name: "Diamond Chest", price: 300, icon: "💠" },
  { id: "a5", cat: "armor", name: "Royal Tuxedo", price: 500, icon: "👔" },
  { id: "s1", cat: "shoes", name: "Trail Boots", price: 35, icon: "🥾" },
  { id: "s2", cat: "shoes", name: "Shadow Treads", price: 80, icon: "👟" },
  { id: "s3", cat: "shoes", name: "Winged Sandals", price: 130, icon: "🪽" },
  { id: "s4", cat: "shoes", name: "Diamond Boots", price: 220, icon: "🧊" },
  { id: "s5", cat: "shoes", name: "Rocket Sneakers", price: 350, icon: "🚀" },
  { id: "p1", cat: "pet", name: "Pixel Fox", price: 70, icon: "🦊" },
  { id: "p2", cat: "pet", name: "Tiny Dragon", price: 150, icon: "🐉" },
  { id: "p3", cat: "pet", name: "Spirit Owl", price: 200, icon: "🦉" },
  { id: "p4", cat: "pet", name: "Direwolf", price: 350, icon: "🐺" },
  { id: "p5", cat: "pet", name: "Mini Golem", price: 500, icon: "🗿" },
];

const BADGE_DEFS = [
  { id: "first", name: "First Blood", test: (s: User) => s.completedCount >= 1 },
  { id: "centurion", name: "Centurion: 1000 XP", test: (s: User) => s.xp >= 1000 },
  { id: "iron", name: "Iron Will: 7 Days", test: (s: User) => s.streak >= 7 },
  { id: "socialite", name: "Social Butterfly", test: (s: User) => s.attrs.social >= 10 },
  { id: "wealth", name: "Merchant Lord: 500G", test: (s: User) => s.gold >= 500 },
];

const ATTR_LABELS: Record<Attribute, string> = { strength: "Strength", intellect: "Intellect", discipline: "Discipline", social: "Social" };

const today = () => new Date().toISOString().slice(0, 10);

const calculateXP = (mins: number, attr: Attribute, currentStreak: number) => {
  const attrMult = { strength: 1.1, intellect: 1.25, discipline: 1.0, social: 1.3 }[attr] || 1;
  const streakMult = Math.min(2.0, 1 + (currentStreak * 0.05));
  let xp = Math.round(mins * 1.5 * attrMult * streakMult);
  if (mins >= 60) xp += 30;
  return Math.max(5, xp);
};

const levelOf = (xp: number) => {
  let l = 1, used = 0;
  while (used + l * 120 <= xp) { used += l * 120; l += 1; }
  return { level: l, into: xp - used, need: l * 120 };
};

// ==========================================
// GLOBAL STYLES (Injected for portability)
// ==========================================

const GlobalCSS = () => (
  <style>{`
    :root { color-scheme: dark; }
    html, body { font-family: 'Outfit', sans-serif; scroll-behavior: smooth; }
    body { background: radial-gradient(circle at top, #1e293b, #0f172a); min-height: 100vh; margin: 0; }
    
    .glass-panel { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.3); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05); }
    .dark .glass-panel { background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05); }
    
    .glow-gold { box-shadow: 0 0 0 1px rgba(232,197,71,.5), 0 0 22px rgba(232,197,71,.2); }
    .bar { transition: width 0.8s cubic-bezier(.34,1.56,.64,1); }
    .card-hover { transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease; }
    .card-hover:hover { transform: translateY(-4px) scale(1.02); }
    
    .shake { animation: shake .4s ease; }
    @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
    .pop { animation: pop .5s cubic-bezier(.34,1.56,.64,1); }
    @keyframes pop { 0% { transform: scale(.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    
    .particle { position: absolute; width: 10px; height: 10px; border-radius: 50%; pointer-events: none; animation: burst 1s cubic-bezier(.1,1,.3,1) forwards; }
    @keyframes burst { to { transform: translate(var(--x), var(--y)) scale(0); opacity: 0; } }

    .scene { width: 160px; height: 220px; margin: 0 auto; perspective: 800px; display: flex; align-items: center; justify-content: center; }
    .character { width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transform: rotateX(-15deg) rotateY(-25deg); animation: float-idle 4s infinite ease-in-out; }
    @keyframes float-idle { 0%, 100% { transform: rotateX(-15deg) rotateY(-25deg) translateY(0); } 50% { transform: rotateX(-15deg) rotateY(-25deg) translateY(-6px); } }
    
    .cube { position: absolute; transform-style: preserve-3d; transition: all 0.3s; }
    .face { position: absolute; display: flex; align-items: center; justify-content: center; background-color: var(--c); font-size: 1.8rem; border: 1px solid rgba(0,0,0,0.15); box-shadow: inset 0 0 10px rgba(0,0,0,0.1); }
    .dark .face { border: 1px solid rgba(255,255,255,0.05); }
    
    .front { width: var(--w); height: var(--h); transform: translateZ(calc(var(--d) / 2)); }
    .right { width: var(--d); height: var(--h); transform: rotateY(90deg) translateZ(calc(var(--w) / 2)); filter: brightness(0.85); }
    .top   { width: var(--w); height: var(--d); transform: rotateX(90deg) translateZ(calc(var(--h) / 2)); filter: brightness(1.2); }

    /* Avatar mapping */
    /* Remove z-index to allow native preserve-3d depth sorting */
    .c-head  { --w: 44px; --h: 44px; --d: 44px; --c: #e0ac69; top: 20px; left: 58px; }
    .c-head .front { 
      background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><rect x="8" y="16" width="6" height="6" fill="%232d3748"/><rect x="30" y="16" width="6" height="6" fill="%232d3748"/><rect x="18" y="28" width="8" height="4" fill="%23718096"/></svg>'); 
      background-size: cover; 
      align-items: flex-start; /* Push content to the top */
    }
    /* Style the head equipment to sit like a hat */
    .head-equip { transform: translateY(-14px) scale(1.4); filter: drop-shadow(0 4px 2px rgba(0,0,0,0.4)); }
    
    .c-body  { --w: 44px; --h: 66px; --d: 22px; --c: #0ea5e9; top: 64px; left: 58px; }
    .c-arm-l { --w: 18px; --h: 60px; --d: 22px; --c: #e0ac69; top: 64px; left: 40px; }
    .c-arm-r { --w: 18px; --h: 60px; --d: 22px; --c: #e0ac69; top: 64px; left: 102px; }
    .c-leg-l { --w: 21px; --h: 60px; --d: 22px; --c: #312e81; top: 130px; left: 58px; }
    .c-leg-r { --w: 21px; --h: 60px; --d: 22px; --c: #312e81; top: 130px; left: 81px; }
    
    .c-pet { --w: 28px; --h: 28px; --d: 28px; --c: rgba(255,255,255,0.1); top: 140px; left: 5px; transform: translateZ(30px); animation: pet-bob 2.5s infinite ease-in-out; border: none !important; }
    .c-pet .face { background: transparent; border: none; font-size: 2.2rem; filter: drop-shadow(0 10px 10px rgba(0,0,0,0.3)); }
    @keyframes pet-bob { 0%, 100% { transform: translateZ(30px) translateY(0); } 50% { transform: translateZ(30px) translateY(-12px); } }
  `}</style>
);

// ==========================================
// MAIN APP COMPONENT
// ==========================================

export default function LifeRPGApp() {
  const [db, setDb] = useState<Database>(() => {
    if (typeof window === 'undefined') return { users: {}, session: null };
    try {
      const stored = localStorage.getItem(STORE_KEY);
      return stored ? JSON.parse(stored) : { users: {}, session: null };
    } catch {
      return { users: {}, session: null };
    }
  });

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [modal, setModal] = useState<{ open: boolean; title: React.ReactNode; body: React.ReactNode }>({ open: false, title: '', body: '' });
  const [nav, setNav] = useState<'dashboard' | 'shop' | 'leaderboard'>('dashboard');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem("liferpg.theme") as 'dark' | 'light';
      if (savedTheme) setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
    }
  }, [db]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    if (typeof window !== 'undefined') localStorage.setItem("liferpg.theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const sessionUser = db.session ? db.users[db.session] : null;

  const patchUser = (updater: (u: User) => void) => {
    if (!db.session) return;
    setDb(prev => {
      const userClone: User = JSON.parse(JSON.stringify(prev.users[prev.session!]));
      updater(userClone);
      return { ...prev, users: { ...prev.users, [prev.session!]: userClone } };
    });
  };

  const triggerBurst = () => {
    const fx = document.getElementById('fx-container');
    if (!fx) return;
    for (let i = 0; i < 40; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      p.style.left = "50%"; p.style.top = "50%";
      p.style.background = ["#e8c547", "#8b5cf6", "#f43f5e", "#10b981", "#3b82f6"][Math.floor(Math.random() * 5)];
      p.style.setProperty("--x", (Math.random() * 400 - 200) + "px");
      p.style.setProperty("--y", (Math.random() * 400 - 200) + "px");
      fx.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  };

  useEffect(() => {
    if (sessionUser) {
      const t = today();
      if (sessionUser.lastLogin !== t) {
        const y = new Date(); y.setDate(y.getDate() - 1);
        const ys = y.toISOString().slice(0, 10);
        patchUser(u => {
          u.streak = u.lastLogin === ys ? u.streak + 1 : 1;
          u.lastLogin = t;
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.session]);

  const handleLogout = () => setDb(prev => ({ ...prev, session: null }));

  return (
    <>
      <GlobalCSS />
      <div id="fx-container" className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" />
      
      {!sessionUser ? (
        <AuthScreen db={db} setDb={setDb} />
      ) : (
        <div className="text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-24 md:pb-8">
          <Header user={sessionUser} theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout} nav={nav} setNav={setNav} />
          
          <main className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
            {nav === 'dashboard' && <Dashboard user={sessionUser} patchUser={patchUser} triggerBurst={triggerBurst} openModal={setModal} />}
            {nav === 'shop' && <Shop user={sessionUser} patchUser={patchUser} openModal={setModal} />}
            {nav === 'leaderboard' && <Leaderboard db={db} />}
          </main>

          <MobileNav nav={nav} setNav={setNav} />
        </div>
      )}

      {/* Modal Overlay */}
      {modal.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 z-50">
          <div className="glass-panel rounded-[2rem] p-8 w-full max-w-sm pop relative overflow-hidden text-center shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#8b5cf6] to-[#e8c547]"></div>
            <h3 className="font-display text-2xl mb-4 font-bold">{modal.title}</h3>
            <div className="mt-2 text-lg text-slate-700 dark:text-slate-300">{modal.body}</div>
            <button 
              onClick={() => setModal({ ...modal, open: false })} 
              className="mt-8 w-full py-3 rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-[#0f172a] font-bold hover:scale-105 transition-transform shadow-lg">
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// AUTH SCREEN
// ==========================================

function AuthScreen({ db, setDb }: { db: Database, setDb: any }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = (data.get('email') as string).trim().toLowerCase();
    const pass = data.get('pass') as string;
    const name = (data.get('name') as string)?.trim();

    setError('');
    
    if (mode === 'signup') {
      if (!name) return showError("Choose a legendary name.");
      if (db.users[email]) return showError("Email already bound to a hero.");
      
      const newUser: User = {
        name, email, pass,
        xp: 0, gold: 100, streak: 0, lastLogin: today(),
        attrs: { strength: 1, intellect: 1, discipline: 1, social: 1 },
        completedCount: 0, tasks: [], inventory: [],
        equipped: { head: null, armor: null, shoes: null, pet: null },
        badges: [], lastComplete: 0,
      };
      
      setDb((prev: Database) => ({
        users: { ...prev.users, [email]: newUser },
        session: email
      }));
    } else {
      const u = db.users[email];
      if (!u || u.pass !== pass) return showError("Invalid credentials.");
      setDb((prev: Database) => ({ ...prev, session: email }));
    }
  };

  const showError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleOAuth = (provider: string) => {
    alert(`Sign in with ${provider} clicked! Connect a backend like Supabase or Firebase to enable this.`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#8b5cf6] via-[#e8c547] to-[#10b981]"></div>
        
        <div className="text-center mb-8 mt-2">
          <h1 className="font-display text-5xl tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-[#8b5cf6] to-[#e8c547]">LIFE RPG</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 font-medium">Build habits. Gain XP. Forge your 3D legend.</p>
        </div>

        <div className="flex gap-2 mb-6 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <button onClick={() => setMode('login')} className={`flex-1 py-2.5 rounded-lg font-bold transition-all ${mode === 'login' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#8b5cf6] dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Login</button>
          <button onClick={() => setMode('signup')} className={`flex-1 py-2.5 rounded-lg font-bold transition-all ${mode === 'signup' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#8b5cf6] dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Sign up</button>
        </div>

        <form onSubmit={handleSubmit} className={`space-y-4 ${shake ? 'shake' : ''}`}>
          {mode === 'signup' && (
            <input name="name" type="text" placeholder="Adventurer Name" required className="w-full px-4 py-3.5 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#8b5cf6] transition-all" />
          )}
          <input name="email" type="email" required placeholder="Email Address" className="w-full px-4 py-3.5 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#8b5cf6] transition-all" />
          <input name="pass" type="password" required minLength={6} placeholder="Password" className="w-full px-4 py-3.5 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#8b5cf6] transition-all" />
          
          {error && <p className="text-[#f43f5e] text-sm font-bold text-center">{error}</p>}
          
          <button type="submit" className="w-full py-4 mt-2 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-purple-600 text-white font-bold text-lg shadow-[0_10px_20px_rgba(139,92,246,0.3)] hover:shadow-[0_10px_25px_rgba(139,92,246,0.5)] transition-all card-hover">
            Enter the Realm
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700/50">
          <p className="text-xs text-center text-slate-400 mb-4 font-bold tracking-widest uppercase">Or connect with</p>
          <div className="grid grid-cols-3 gap-3">
            <button type="button" onClick={() => handleOAuth('Google')} className="flex justify-center py-3 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform shadow-sm">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.58c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </button>
            <button type="button" onClick={() => handleOAuth('Apple')} className="flex justify-center py-3 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform shadow-sm">
              <svg className="w-6 h-6 dark:fill-white fill-black" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.74 3.58-.79 2.12-.04 3.65.88 4.52 2.11-3.97 2.37-3.32 7.7.46 9.21-1.01 2.28-2.2 4.19-3.64 5.64zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
            </button>
            <button type="button" onClick={() => handleOAuth('Facebook')} className="flex justify-center py-3 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform shadow-sm">
              <svg className="w-6 h-6" fill="#1877F2" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// NAVIGATION
// ==========================================

function Header({ user, theme, toggleTheme, onLogout, nav, setNav }: any) {
  return (
    <header className="sticky top-0 z-30 glass-panel border-b-0 border-slate-200/50 dark:border-slate-700/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
        <span className="font-display text-2xl text-[#e8c547] font-bold tracking-widest hidden sm:block">LRPG</span>
        
        <nav className="hidden md:flex gap-8 ml-12 items-center">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'shop', label: 'Equipment Shop' },
            { id: 'leaderboard', label: 'Hall of Heroes' }
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setNav(item.id)}
              className={`text-base font-bold pb-1 transition-all border-b-2 ${nav === item.id ? 'text-[#8b5cf6] dark:text-white border-[#8b5cf6] transform scale-105' : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border-transparent'}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <span className="glow-gold px-4 py-2 rounded-full font-bold bg-white dark:bg-[#0f172a] text-[#e8c547] text-sm shadow-md">
            {user.gold} G
          </span>
          <button onClick={toggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:scale-110 transition-transform text-xl">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={onLogout} className="w-10 h-10 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-[#f43f5e] hover:text-white transition-colors">
            🚪
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileNav({ nav, setNav }: { nav: string, setNav: (s: any) => void }) {
  const items = [
    { id: 'dashboard', icon: '🏠', label: 'Home' },
    { id: 'shop', icon: '🛍️', label: 'Shop' },
    { id: 'leaderboard', icon: '🏆', label: 'Ranks' }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 w-full glass-panel border-t border-slate-200 dark:border-slate-800 flex justify-around p-4 z-40 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
      {items.map(item => {
        const active = nav === item.id;
        return (
          <button 
            key={item.id} 
            onClick={() => setNav(item.id)} 
            className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-[#8b5cf6] dark:text-white transform scale-110' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-[10px] font-bold uppercase">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ==========================================
// DASHBOARD
// ==========================================

function Dashboard({ user, patchUser, triggerBurst, openModal }: any) {
  const lv = levelOf(user.xp);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Form State
  const [qTitle, setQTitle] = useState('');
  const [qAttr, setQAttr] = useState<Attribute>('strength');
  const [qMins, setQMins] = useState(25);
  const [qTab, setQTab] = useState<'active' | 'done'>('active');

  const getIcon = (id: string | null) => SHOP.find(s => s.id === id)?.icon || "";

  const handleAddQuest = (e: FormEvent) => {
    e.preventDefault();
    if (!qTitle.trim()) return;
    patchUser((u: User) => {
      u.tasks.push({
        id: crypto.randomUUID(),
        title: qTitle.trim(),
        attr: qAttr,
        mins: qMins,
        done: false,
        created: Date.now()
      });
    });
    setQTitle('');
  };

  const handleComplete = (id: string) => {
    const now = Date.now();
    if (now - user.lastComplete < 1000) {
      return openModal({ open: true, title: "Magic Restored", body: "Slow down! Let the magical energies settle before completing another quest." });
    }

    const t = user.tasks.find((x: Task) => x.id === id);
    if (!t || t.done) return;
    
    const beforeLevel = levelOf(user.xp).level;
    const gainXP = calculateXP(t.mins, t.attr, user.streak);
    const gainGold = Math.max(1, Math.floor(t.mins / 8));
    
    patchUser((u: User) => {
      const task = u.tasks.find(x => x.id === id)!;
      task.done = true;
      task.xpAwarded = gainXP;
      task.goldAwarded = gainGold;
      
      u.xp += gainXP;
      u.gold += gainGold;
      u.attrs[task.attr] += 1;
      u.completedCount += 1;
      u.lastComplete = Date.now();
      
      BADGE_DEFS.forEach(b => {
        if (!u.badges.includes(b.id) && b.test(u)) u.badges.push(b.id);
      });
    });
    
    const afterLevel = levelOf(user.xp + gainXP).level;
    if (afterLevel > beforeLevel) {
      triggerBurst();
      openModal({ 
        open: true, 
        title: "LEVEL UP!", 
        body: <><div className="text-6xl mb-4 animate-bounce">🌟</div><p>You ascended to <b className="text-[#e8c547]">Level {afterLevel}</b>!</p></> 
      });
    }
  };

  const handleSuggest = () => {
    const lowest = (Object.entries(user.attrs) as [Attribute, number][]).sort((a, b) => a[1] - b[1])[0][0];
    const titles = {
      strength: "Train 20 minutes (Cardio or Lifting)",
      intellect: "Deep work: Code, Read, or Study",
      discipline: "Complete an overdue chore immediately",
      social: "Reach out to a friend or network",
    };
    patchUser((u: User) => {
      u.tasks.push({ id: crypto.randomUUID(), title: titles[lowest], attr: lowest, mins: 25, done: false, created: Date.now() });
    });
  };

  const lowestAttr = (Object.entries(user.attrs) as [Attribute, number][]).sort((a, b) => a[1] - b[1])[0][0];
  const maxA = Math.max(1, ...Object.values(user.attrs) as number[]);

  let taskList = [...user.tasks].sort((a, b) => b.created - a.created);
  taskList = taskList.filter(t => qTab === 'done' ? t.done : !t.done);

  return (
    <div className="grid lg:grid-cols-12 gap-8">
      {/* LEFT: CHARACTER */}
      <aside className="lg:col-span-4 space-y-6">
        <div className="glass-panel rounded-[2rem] p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#8b5cf6]/5 pointer-events-none"></div>
          <h3 className="font-display text-xl mb-8 font-bold">Your Adventurer</h3>
          
          {/* 3D AVATAR */}
          <div className="scene">
            <div className="character">
              <div className="cube c-head">
                <div className="face front">{getIcon(user.equipped.head)}</div><div className="face right" /><div className="face top" />
              </div>
              <div className="cube c-body">
                <div className="face front">{getIcon(user.equipped.armor)}</div><div className="face right" /><div className="face top" />
              </div>
              <div className="cube c-arm-l"><div className="face front" /><div className="face right" /><div className="face top" /></div>
              <div className="cube c-arm-r"><div className="face front" /><div className="face right" /><div className="face top" /></div>
              <div className="cube c-leg-l">
                <div className="face front">{getIcon(user.equipped.shoes)}</div><div className="face right" /><div className="face top" />
              </div>
              <div className="cube c-leg-r">
                <div className="face front">{getIcon(user.equipped.shoes)}</div><div className="face right" /><div className="face top" />
              </div>
              {user.equipped.pet && (
                <div className="cube c-pet">
                  <div className="face front">{getIcon(user.equipped.pet)}</div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-around items-center border-t border-slate-200 dark:border-slate-700/50 pt-6 mt-6">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Active Streak</p>
              <p className="font-display text-3xl text-[#f43f5e] mt-1 drop-shadow-md">{user.streak} 🔥</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Quests Done</p>
              <p className="font-display text-3xl text-[#8b5cf6] mt-1 drop-shadow-md">{user.completedCount} ⚔️</p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[2rem] p-8">
          <h3 className="font-display text-lg mb-4 font-bold flex items-center gap-2">🏅 Earned Badges</h3>
          <ul className="mt-2 text-sm space-y-3">
            {BADGE_DEFS.map(b => {
              const earned = user.badges.includes(b.id);
              return (
                <li key={b.id} className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${earned ? 'border-[#e8c547]/50 bg-[#e8c547]/10 shadow-[0_0_15px_rgba(232,197,71,0.2)]' : 'border-slate-200 dark:border-slate-700/50 opacity-50 grayscale'}`}>
                  <span className="text-3xl filter drop-shadow-md">{earned ? "🏅" : "🔒"}</span>
                  <span className="font-bold text-base">{b.name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* RIGHT: QUESTS & STATS */}
      <section className="lg:col-span-8 space-y-6">
        <div className="glass-panel rounded-[2rem] p-8 relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 w-full">
            <h2 className="font-display text-2xl font-bold mb-1">{greeting}, {user.name}.</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Your journey to greatness continues.</p>
            
            <div className="flex items-center gap-4">
              <div className="bg-slate-100 dark:bg-[#0f172a] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Level</p>
                <p className="text-xl font-bold text-[#8b5cf6] dark:text-[#e8c547]">{lv.level}</p>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span><span className="text-lg">{user.xp}</span> XP</span>
                  <span className="text-slate-500">/ {lv.need}</span>
                </div>
                <div className="h-4 rounded-full bg-slate-200 dark:bg-[#0f172a] overflow-hidden border border-slate-300 dark:border-slate-700 relative">
                  <div className="bar h-full bg-gradient-to-r from-[#8b5cf6] to-[#e8c547] relative" style={{ width: `${Math.min(100, (lv.into / 120) * 100)}%` }}>
                    <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/40 blur-sm"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[2rem] p-8">
          <div className="flex justify-between items-end mb-6 border-b border-slate-200 dark:border-slate-700/50 pb-4">
            <div className="flex gap-4">
              <button onClick={() => setQTab('active')} className={`text-lg font-bold pb-1 transition-all border-b-2 ${qTab === 'active' ? 'text-[#8b5cf6] dark:text-white border-[#8b5cf6]' : 'text-slate-400 hover:text-slate-600 border-transparent'}`}>Active Board</button>
              <button onClick={() => setQTab('done')} className={`text-lg font-bold pb-1 transition-all border-b-2 ${qTab === 'done' ? 'text-[#8b5cf6] dark:text-white border-[#8b5cf6]' : 'text-slate-400 hover:text-slate-600 border-transparent'}`}>History</button>
            </div>
          </div>
          
          <form onSubmit={handleAddQuest} className="bg-slate-50 dark:bg-[#0f172a]/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 mb-6 card-hover">
            <div className="grid sm:grid-cols-12 gap-3">
              <input value={qTitle} onChange={e => setQTitle(e.target.value)} required placeholder="What grand task awaits?" className="sm:col-span-12 md:col-span-5 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-[#e8c547] shadow-sm" />
              <select value={qAttr} onChange={e => setQAttr(e.target.value as Attribute)} className="sm:col-span-6 md:col-span-3 px-3 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-[#e8c547] font-medium shadow-sm">
                <option value="strength">💪 Strength</option>
                <option value="intellect">🧠 Intellect</option>
                <option value="discipline">🛡️ Discipline</option>
                <option value="social">💬 Social</option>
              </select>
              <div className="sm:col-span-6 md:col-span-2 flex items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 px-3 shadow-sm focus-within:ring-2 focus-within:ring-[#e8c547]">
                <span className="text-xs text-slate-400 font-bold">MIN</span>
                <input type="number" min="1" max="300" value={qMins} onChange={e => setQMins(parseInt(e.target.value)||25)} className="w-full bg-transparent border-none outline-none py-3 text-center font-bold" />
              </div>
              <button className="sm:col-span-12 md:col-span-2 py-3 rounded-xl bg-[#e8c547] text-[#0f172a] font-bold hover:scale-105 active:scale-95 transition-transform shadow-[0_4px_15px_rgba(232,197,71,0.4)]">Accept</button>
            </div>
            <div className="mt-3 text-right">
              <span className="text-xs font-bold text-[#8b5cf6] bg-[#8b5cf6]/10 px-3 py-1 rounded-full border border-[#8b5cf6]/20">
                Expected Gain: ~{calculateXP(qMins, qAttr, user.streak)} XP & {Math.max(1, Math.floor(qMins / 8))} G
              </span>
            </div>
          </form>
          
          <ul className="space-y-3">
            {taskList.length === 0 ? (
              <li className="text-sm font-bold text-slate-400 text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20">The quest board is empty. Await new orders.</li>
            ) : taskList.map(t => {
              const attrColor = { strength: "text-[#f43f5e]", intellect: "text-[#8b5cf6]", discipline: "text-[#e8c547]", social: "text-[#10b981]" }[t.attr];
              const attrIcon = { strength: "💪", intellect: "🧠", discipline: "🛡️", social: "💬" }[t.attr];
              
              return (
                <li key={t.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700/50 hover:border-[#8b5cf6]/50 transition-all card-hover group shadow-sm">
                  {qTab === 'active' ? (
                    <input type="checkbox" checked={t.done} onChange={(e) => { if (e.target.checked) setTimeout(() => handleComplete(t.id), 300); }} className="w-6 h-6 rounded border-slate-300 accent-[#8b5cf6] cursor-pointer hover:scale-110 transition-transform" />
                  ) : (
                    <span className="text-2xl filter drop-shadow-sm">✅</span>
                  )}
                  <div className="flex-1">
                    <p className={`font-bold text-lg ${t.done ? 'line-through opacity-50' : ''}`}>{t.title}</p>
                    <p className="text-xs font-bold mt-1 uppercase tracking-wider text-slate-500">
                      <span className={attrColor}>{attrIcon} {t.attr}</span> 
                      <span className="mx-2 opacity-30">|</span> {t.mins} MIN 
                      {t.xpAwarded && <><span className="mx-2 opacity-30">|</span> <span className="text-[#e8c547]">+{t.xpAwarded} XP</span></>}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { const val = prompt("Rename quest:", t.title); if(val) patchUser((u:User) => { u.tasks.find(x=>x.id===t.id)!.title = val; }); }} className="text-[10px] uppercase font-bold px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-[#8b5cf6] hover:text-white transition-colors">Edit</button>
                    <button onClick={() => patchUser((u:User) => { u.tasks = u.tasks.filter(x=>x.id!==t.id); })} className="text-[10px] uppercase font-bold px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-[#f43f5e] hover:text-white transition-colors">Drop</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="glass-panel rounded-[2rem] p-6 text-center flex flex-col justify-center">
            <h3 className="font-display text-sm text-slate-500 mb-2 uppercase tracking-widest font-bold">Oracle's Advice</h3>
            <p className="text-base font-medium leading-relaxed my-4">
              The realm senses weakness in your {ATTR_LABELS[lowestAttr]}. Fortify it to achieve balance.
            </p>
            <button onClick={handleSuggest} className="w-full py-3 rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-[#0f172a] font-bold hover:scale-105 transition-transform">Add to Board</button>
          </div>

          <div className="glass-panel rounded-[2rem] p-6">
            <h3 className="font-display text-sm text-slate-500 mb-4 uppercase tracking-widest font-bold text-center">Skill Mastery</h3>
            <div className="space-y-4">
              {[
                { k: 'strength' as Attribute, c: 'text-[#f43f5e]', bg: 'bg-[#f43f5e]', s: 'shadow-[0_0_10px_rgba(244,63,94,0.8)]' },
                { k: 'intellect' as Attribute, c: 'text-[#8b5cf6]', bg: 'bg-[#8b5cf6]', s: 'shadow-[0_0_10px_rgba(139,92,246,0.8)]' },
                { k: 'discipline' as Attribute, c: 'text-[#e8c547]', bg: 'bg-[#e8c547]', s: 'shadow-[0_0_10px_rgba(232,197,71,0.8)]' },
                { k: 'social' as Attribute, c: 'text-[#10b981]', bg: 'bg-[#10b981]', s: 'shadow-[0_0_10px_rgba(16,185,129,0.8)]' }
              ].map(attr => (
                <div key={attr.k}>
                  <div className="flex justify-between text-xs font-bold mb-1"><span className={attr.c}>{ATTR_LABELS[attr.k]}</span><span>{user.attrs[attr.k]}</span></div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-[#0f172a]"><div className={`bar h-full rounded-full ${attr.bg} ${attr.s}`} style={{ width: `${(user.attrs[attr.k] / maxA) * 100}%` }}></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ==========================================
// SHOP
// ==========================================

function Shop({ user, patchUser, openModal }: any) {
  const [shopCat, setShopCat] = useState('head');

  const cats = [
    { id: "head", label: "Headgear", icon: "🪖" }, 
    { id: "armor", label: "Outfits", icon: "👕" },
    { id: "shoes", label: "Boots", icon: "🥾" }, 
    { id: "pet", label: "Companions", icon: "🦊" },
  ];

  return (
    <div className="glass-panel rounded-[2rem] p-8 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="font-display text-4xl text-[#e8c547] mb-3 drop-shadow-md">The Grand Bazaar</h2>
        <p className="text-base text-slate-500 font-medium">Equip your 3D avatar with legendary artifacts.</p>
      </div>
      
      <div className="flex flex-wrap justify-center gap-4 mb-10">
        {cats.map(c => (
          <button 
            key={c.id} 
            onClick={() => setShopCat(c.id)}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${shopCat === c.id ? "bg-gradient-to-r from-[#e8c547] to-yellow-500 text-[#0f172a] shadow-[0_4px_20px_rgba(232,197,71,0.4)] transform scale-105" : "bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {SHOP.filter(i => i.cat === shopCat).map(i => {
          const owned = user.inventory.includes(i.id);
          const eq = user.equipped[i.cat as keyof typeof user.equipped] === i.id;
          
          return (
            <div key={i.id} className="flex flex-col items-center gap-4 p-6 rounded-[2rem] bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700/50 card-hover text-center relative shadow-sm">
              {owned && <div className="absolute top-0 right-0 bg-[#8b5cf6] text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-[1.5rem] rounded-tr-[2rem] tracking-widest uppercase">Owned</div>}
              <span className="text-7xl my-4 filter drop-shadow-xl hover:scale-110 transition-transform">{i.icon}</span>
              <div className="flex-1 w-full mt-2">
                <p className="text-xl font-display font-bold">{i.name}</p>
                <p className="text-sm font-bold text-[#e8c547] mb-6 mt-1">{i.price} G</p>
                {owned ? (
                  <button onClick={() => patchUser((u:User) => { u.equipped[i.cat as keyof typeof u.equipped] = i.id; })} className={`w-full py-3 rounded-xl font-bold transition-all uppercase tracking-wide ${eq ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default" : "bg-[#e8c547] text-[#0f172a] hover:scale-105 shadow-md shadow-[#e8c547]/20"}`}>
                    {eq ? "Equipped" : "Equip"}
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      if (user.gold < i.price) return openModal({ open: true, title: "Insufficient Gold", body: `You need ${i.price - user.gold} more gold.` });
                      patchUser((u:User) => { u.gold -= i.price; u.inventory.push(i.id); u.equipped[i.cat as keyof typeof u.equipped] = i.id; });
                    }} 
                    className="w-full py-3 rounded-xl bg-[#8b5cf6] text-white font-bold hover:scale-105 transition-all shadow-[0_4px_15px_rgba(139,92,246,0.3)] uppercase tracking-wide">
                    Purchase
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// LEADERBOARD
// ==========================================

function Leaderboard({ db }: { db: Database }) {
  const users = Object.values(db.users).map(u => ({ name: u.name, level: levelOf(u.xp).level, badges: u.badges.length, xp: u.xp }));
  const npcs = [
    { name: "Steve", level: 15, badges: 5, xp: 3500 },
    { name: "Nyx Shadow", level: 12, badges: 4, xp: 2500 },
    { name: "Kael Ironfist", level: 8, badges: 2, xp: 1100 },
    { name: "Aria Light", level: 5, badges: 1, xp: 600 },
  ];
  
  const allPlayers = [...users, ...npcs].sort((a, b) => b.level - a.level || b.xp - a.xp).slice(0, 10);

  return (
    <div className="glass-panel rounded-[2rem] p-8 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="font-display text-4xl text-[#8b5cf6] mb-3 drop-shadow-md">Hall of Heroes</h2>
        <p className="text-base text-slate-500 font-medium">The most dedicated adventurers in the realm.</p>
      </div>
      <div className="bg-white/50 dark:bg-[#0f172a]/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-2 space-y-2">
        {allPlayers.map((r, i) => {
          let style = "bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700/50";
          let rank = `#${i + 1}`;
          if (i === 0) { style = "bg-gradient-to-r from-[#e8c547]/20 to-transparent border-[#e8c547]/50 text-[#e8c547]"; rank = "👑"; }
          if (i === 1) { style = "bg-slate-200/50 dark:bg-slate-600/30 border-slate-400 dark:border-slate-500 text-slate-700 dark:text-slate-300"; rank = "🥈"; }
          if (i === 2) { style = "bg-[#CD7F32]/10 border-[#CD7F32]/50 text-[#CD7F32]"; rank = "🥉"; }

          return (
            <div key={i} className={`flex items-center gap-6 p-5 rounded-xl border ${style} shadow-sm`}>
              <div className="w-10 text-center font-display text-3xl font-bold drop-shadow-md">{rank}</div>
              <div className="flex-1">
                <p className={`font-bold text-xl ${i === 0 ? 'text-[#e8c547]' : 'text-slate-800 dark:text-white'}`}>{r.name}</p>
                <p className="text-xs font-bold uppercase tracking-widest opacity-70 mt-1">Lv {r.level} • {r.xp} XP</p>
              </div>
              <div className="text-right">
                <p className="text-3xl filter drop-shadow-sm">{r.badges > 0 ? "🏅" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}