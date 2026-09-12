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
  const [resetCooldown, setResetCooldown] = useState(0);

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
  const [category, setCategory] = useState<
    'Strength' | 'Intellect' | 'Discipline'
  >('Strength');

  const [loading, setLoading] = useState(true);

  // --------------------------------------------------
  // 1. Check authentication session
  // --------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
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

  // --------------------------------------------------
  // 2. Password reset cooldown
  // --------------------------------------------------

  useEffect(() => {
    if (resetCooldown <= 0) return;

    const timer = setInterval(() => {
      setResetCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resetCooldown]);

  // --------------------------------------------------
  // 3. Fetch user data
  // --------------------------------------------------

  async function fetchUserData(userId: string) {
    setLoading(true);

    const today = new Date().toISOString().slice(0, 10);

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    let currentProfile: UserStats;

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Failed to load profile:', profileError.message);
      setLoading(false);
      return;
    }

    if (profile) {
      currentProfile = profile;

      // Update streak once per day
      if (profile.last_active !== today) {
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .slice(0, 10);

        const newStreak =
          profile.last_active === yesterday
            ? (profile.streak ?? 1) + 1
            : 1;

        const { data: updatedProfile, error: updateError } =
          await supabase
            .from('users')
            .update({
              streak: newStreak,
              last_active: today,
            })
            .eq('id', userId)
            .select()
            .single();

        if (updateError) {
          console.error(
            'Failed to update streak:',
            updateError.message
          );
        }

        currentProfile =
          updatedProfile ?? {
            ...profile,
            streak: newStreak,
            last_active: today,
          };
      }

      setUserStats(currentProfile);
    } else {
      // Create profile for first-time user
      const defaultProfile: UserStats = {
        id: userId,
        email: session?.user?.email ?? '',
        level: 1,
        xp: 0,
        gold: 0,
        streak: 1,
        last_active: today,
      };

      const { data: createdProfile, error: createError } =
        await supabase
          .from('users')
          .insert([defaultProfile])
          .select()
          .single();

      if (createError) {
        console.error(
          'Failed to create profile:',
          createError.message
        );
      }

      currentProfile = createdProfile ?? defaultProfile;
      setUserStats(currentProfile);
    }

    // Fetch attributes
    const { data: attributeData, error: attributeError } =
      await supabase
        .from('attributes')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (attributeError && attributeError.code !== 'PGRST116') {
      console.error(
        'Failed to load attributes:',
        attributeError.message
      );
    }

    if (attributeData) {
      setAttributes({
        strength: attributeData.strength ?? 0,
        intellect: attributeData.intellect ?? 0,
        discipline: attributeData.discipline ?? 0,
      });
    } else {
      // Create default attributes if none exist
      const defaultAttributes = {
        user_id: userId,
        strength: 0,
        intellect: 0,
        discipline: 0,
      };

      const { data: createdAttributes, error: attributesError } =
        await supabase
          .from('attributes')
          .insert([defaultAttributes])
          .select()
          .single();

      if (attributesError) {
        console.error(
          'Failed to create attributes:',
          attributesError.message
        );
      }

      if (createdAttributes) {
        setAttributes({
          strength: createdAttributes.strength ?? 0,
          intellect: createdAttributes.intellect ?? 0,
          discipline: createdAttributes.discipline ?? 0,
        });
      } else {
        setAttributes(defaultAttributes);
      }
    }

    // Fetch tasks
    const {
      data: userTasks,
      error: tasksError,
    } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('id', { ascending: false });

    if (tasksError) {
      console.error(
        'Failed to load tasks:',
        tasksError.message
      );
    } else if (userTasks) {
      setTasks(userTasks);
    }

    setLoading(false);
  }

  // --------------------------------------------------
  // 4. Login / Signup
  // --------------------------------------------------

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();

    setAuthError('');
    setAuthMessage('');
    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setAuthError(
            error.message.toLowerCase().includes('rate limit')
              ? 'Too many email requests right now — please wait a bit before trying again.'
              : error.message
          );
        } else if (data.user && !data.session) {
          setAuthMessage(
            'Account created! Check your email to confirm before logging in.'
          );
        }
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (error) {
          setAuthError(error.message);
        }
      }
    } finally {
      setAuthLoading(false);
    }
  }

  // --------------------------------------------------
  // 5. Forgot password
  // --------------------------------------------------

  async function handleForgotPassword() {
    if (resetCooldown > 0) return;

    setAuthError('');
    setAuthMessage('');

    if (!email.trim()) {
      setAuthError(
        'Enter your email above first, then click "Forgot password?"'
      );
      return;
    }

    setAuthLoading(true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo:
            typeof window !== 'undefined'
              ? window.location.origin
              : undefined,
        });

      if (error) {
        setAuthError(
          error.message.toLowerCase().includes('rate limit')
            ? 'Too many reset emails requested — please wait before trying again.'
            : error.message
        );
      } else {
        setAuthMessage(
          'Password reset email sent — check your inbox.'
        );
        setResetCooldown(60);
      }
    } finally {
      setAuthLoading(false);
    }
  }

  // --------------------------------------------------
  // 6. Add task
  // --------------------------------------------------

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

    const { data, error } = await supabase
      .from('tasks')
      .insert([newTask])
      .select()
      .single();

    if (error) {
      console.error(
        'Failed to add task:',
        error.message
      );
      return;
    }

    if (data) {
      setTasks((currentTasks) => [data, ...currentTasks]);
      setTitle('');
    }
  }

  // --------------------------------------------------
  // 7. Complete task
  // --------------------------------------------------

  async function handleCompleteTask(task: Task) {
    if (task.completed || !session) return;

    // Mark task completed
    const { error: taskError } = await supabase
      .from('tasks')
      .update({ completed: true })
      .eq('id', task.id)
      .eq('user_id', session.user.id);

    if (taskError) {
      console.error(
        'Failed to complete task:',
        taskError.message
      );
      return;
    }

    const xpGained = task.xp_reward;
    const goldGained = 20;

    let newXp = userStats.xp + xpGained;
    let newLevel = userStats.level;

    // Handle multiple level-ups if necessary
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

    // Increase relevant attribute
    const updatedAttributes: Attributes = {
      ...attributes,
      [task.category.toLowerCase()]:
        attributes[
          task.category.toLowerCase() as keyof Attributes
        ] + 1,
    };

    // Save profile
    const { error: userError } = await supabase
      .from('users')
      .update({
        level: updatedStats.level,
        xp: updatedStats.xp,
        gold: updatedStats.gold,
      })
      .eq('id', session.user.id);

    if (userError) {
      console.error(
        'Failed to update user stats:',
        userError.message
      );
      return;
    }

    // Save attributes
    const { error: attributeError } = await supabase
      .from('attributes')