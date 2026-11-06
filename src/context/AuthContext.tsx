
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type UserRole = 'citizen' | 'admin' | 'official';

type UserProfile = {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  is_admin: boolean; // Keep for backward compatibility
  is_official: boolean;
  issues_reported: number;
  issues_voted: number;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ error?: unknown }>;
  signUp: (email: string, password: string, userData: { username: string; full_name: string; role: UserRole }) => Promise<{ error?: any }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  userRole: UserRole | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    try {
      // First, try to get profile from profiles table
      let profileData = null;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(); // Use maybeSingle to avoid errors if profile doesn't exist
        
        profileData = data;
        
        // Only treat as error if it's not a "not found" error
        if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
          console.warn('Error fetching profile:', error.message);
        }
      } catch (err: unknown) {
        // Don't log if it's just a table not found error.
        const errorCode = typeof err === 'object' && err !== null && 'code' in err
          ? err.code
          : undefined;
        if (errorCode !== 'PGRST205' && errorCode !== 'PGRST116') {
          console.warn('Exception fetching profile:', err instanceof Error ? err.message : String(err));
        }
      }

      // Authorization roles come only from the trusted profiles table.
      // Never trust user-editable user_metadata or a client-controlled users table.
      let role: UserRole = 'citizen';
      let isAdmin = false;
      let isOfficial = false;
      const fullName = profileData?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
      const username = profileData?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || 'user';

      if (profileData?.is_admin === true) {
        role = 'admin';
        isAdmin = true;
      } else if (profileData?.is_official === true) {
        role = 'official';
        isOfficial = true;
      }

      return {
        id: userId,
        email: user?.email || '',
        username: username,
        full_name: fullName,
        avatar_url: profileData?.avatar_url || null,
        role: role,
        is_admin: isAdmin,
        is_official: isOfficial,
        issues_reported: profileData?.issues_reported || 0,
        issues_voted: profileData?.issues_voted || 0,
      };
    } catch {
      // Silently handle all errors and return default profile
      // Don't log errors to console to prevent spam
      const role: UserRole = 'citizen';
      return {
        id: userId,
        email: user?.email || '',
        username: user?.email?.split('@')[0] || 'user',
        full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
        avatar_url: null,
        role: role,
        is_admin: false,
        is_official: false,
        issues_reported: 0,
        issues_voted: 0,
      };
    }
  };

  // Initialize auth state
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetch with setTimeout to prevent deadlock
          setTimeout(async () => {
            try {
              const userProfile = await fetchProfile(session.user.id);
              setProfile(userProfile);
              
              // Auto-redirect based on role after login
              if (event === 'SIGNED_IN' && userProfile) {
                const role = userProfile.role;
                // Small delay to ensure navigation happens after state is set
                setTimeout(() => {
                  if (role === 'admin') {
                    navigate('/admin', { replace: true });
                  } else if (role === 'official') {
                    navigate('/official', { replace: true });
                  }
                }, 200);
              }
            } catch (error) {
              console.error('Error fetching profile after auth change:', error);
            } finally {
              setLoading(false);
            }
          }, 100);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(async () => {
          try {
            const userProfile = await fetchProfile(session.user.id);
            setProfile(userProfile);
            
            // Check current path and redirect if needed
            const currentPath = window.location.pathname;
            if (userProfile) {
              const role = userProfile.role;
              if (role === 'admin' && currentPath !== '/admin' && !currentPath.startsWith('/admin')) {
                navigate('/admin');
              } else if (role === 'official' && currentPath !== '/official' && !currentPath.startsWith('/official')) {
                navigate('/official');
              }
            }
          } catch (error) {
            console.error('Error fetching profile on session check:', error);
          } finally {
            setLoading(false);
          }
        }, 100);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      if (data.user) {
        const userProfile = await fetchProfile(data.user.id);
        setProfile(userProfile);
        
        // Determine role-based navigation
        const role = userProfile?.role || 'citizen';
        let redirectPath = '/';
        let welcomeMessage = "Welcome back to CivicPulse AI.";
        
        if (role === 'admin') {
          redirectPath = '/admin';
          welcomeMessage = "Welcome to the admin dashboard.";
        } else if (role === 'official') {
          redirectPath = '/official';
          welcomeMessage = "Welcome to the official dashboard.";
        }
        
        toast({
          title: role === 'admin' ? "Admin Login Successful" : role === 'official' ? "Official Login Successful" : "Login Successful",
          description: welcomeMessage,
        });
        
        navigate(redirectPath);
      }

      return { error: null };
    } catch (error: unknown) {
      toast({
        title: "Login Failed",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, userData: { username: string; full_name: string; role: UserRole }) => {
    try {
      setLoading(true);
      const redirectUrl = `${window.location.origin}/`;
      // Every self-service signup is a citizen account. Staff roles are assigned
      // later by an existing administrator through the protected role RPC.
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: userData.username,
            full_name: userData.full_name,
          }
        }
      });

      if (error) {
        toast({
          title: "Registration Failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      if (data.user) {

        toast({
          title: "Registration Successful",
          description: "Please check your email for verification link.",
        });
      }

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Logout Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setUser(null);
      setProfile(null);
      setSession(null);
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      login,
      signUp,
      logout,
      isAuthenticated: !!user,
      loading,
      userRole: profile?.role || null
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
