import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile, Group, UserRole } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  currentGroup: Group | null;
  userRole: UserRole;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, nickname?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setCurrentGroup: (group: Group) => void;
  ensureGroup: () => Promise<Group | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('visitor');
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfileAndRole = useCallback(async (userId: string, userEmail?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data && !error) {
        setProfile(data as Profile);
      }

      if (userEmail?.toLowerCase() === 'edsonjz@gmail.com') {
        setUserRole('admin');
        return;
      }

      const { data: memberData } = await supabase
        .from('group_members')
        .select('role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (memberData?.role) {
        setUserRole(memberData.role as UserRole);
      } else {
        setUserRole('player');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  }, []);

  const loadOrCreateDefaultGroup = useCallback(async (): Promise<Group | null> => {
    try {
      const { data: groups } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1);

      if (groups && groups.length > 0) {
        const grp = groups[0] as Group;
        setCurrentGroup(grp);
        return grp;
      }

      const { data: newGroup, error: createError } = await supabase
        .from('groups')
        .insert({
          name: 'Pelada dos Amigos',
          description: 'Grupo oficial de futebol entre amigos',
          default_modality: 'society',
          default_players_per_team: 7,
          settings: {
            overall_weight_ratings: 50,
            overall_weight_stats: 30,
            overall_weight_team: 20,
            enable_finances: true,
          },
        })
        .select()
        .single();

      if (newGroup && !createError) {
        const grp = newGroup as Group;
        setCurrentGroup(grp);
        return grp;
      }
    } catch (err) {
      console.error('Error initializing group:', err);
    }
    return null;
  }, []);

  const ensureGroup = useCallback(async (): Promise<Group | null> => {
    if (currentGroup?.id) return currentGroup;
    return await loadOrCreateDefaultGroup();
  }, [currentGroup, loadOrCreateDefaultGroup]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      setIsLoading(true);
      try {
        await loadOrCreateDefaultGroup();
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        if (!initialSession?.user) {
          setUserRole('visitor');
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initAuth();

    // IMPORTANT: Keep onAuthStateChange synchronous to avoid Supabase v2 NavigatorLock deadlock
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (!currentSession?.user) {
        setProfile(null);
        setUserRole('visitor');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadOrCreateDefaultGroup]);

  // Fetch profile and group whenever user changes (outside of auth lock)
  useEffect(() => {
    if (user?.id) {
      fetchProfileAndRole(user.id, user.email);
      if (!currentGroup?.id) {
        loadOrCreateDefaultGroup();
      }
    } else {
      setUserRole('visitor');
    }
  }, [user?.id, user?.email, currentGroup?.id, fetchProfileAndRole, loadOrCreateDefaultGroup]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, nickname?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          nickname: nickname?.trim() || fullName.trim().split(' ')[0],
        },
      },
    });

    if (!error && data.user) {
      setTimeout(() => {
        fetchProfileAndRole(data.user!.id, data.user!.email);
      }, 200);
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRole('visitor');
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileAndRole(user.id, user.email);
    }
  };

  const isAdmin = Boolean(user && (userRole === 'admin' || user.email?.toLowerCase() === 'edsonjz@gmail.com'));

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        currentGroup,
        userRole: isAdmin ? 'admin' : userRole,
        isAdmin,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        setCurrentGroup,
        ensureGroup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
