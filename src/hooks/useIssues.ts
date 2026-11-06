import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Issue {
  id: string; title: string; description: string; category: string; status: string;
  location: string; area: string; coordinates: [number, number] | null; votes: number;
  image_url?: string | null; media_url?: string | null; user_id: string;
  created_at: string; time_uploaded: string; severity: number;
  resolved_at?: string | null; resolved_by?: string | null; blockchain_hash?: string | null;
}
export interface CreateIssueInput {
  title: string; description: string; category: string; location: string;
  area?: string; coordinates?: [number, number] | null; image_url?: string;
  media_url?: string; severity?: number;
}
interface UseIssuesOptions { autoFetch?: boolean; }

const parsePoint = (value: unknown): [number, number] | null => {
  if (typeof value === 'string') {
    const match = value.match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?$/);
    return match ? [Number(match[1]), Number(match[2])] : null;
  }
  if (value && typeof value === 'object' && 'x' in value && 'y' in value) {
    const point = value as { x: number; y: number };
    return [Number(point.x), Number(point.y)];
  }
  return null;
};

export const useIssues = ({ autoFetch = true }: UseIssuesOptions = {}) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const { toast } = useToast();

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('issues').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const formatted: Issue[] = (data ?? []).map(issue => ({
        id: issue.id, title: issue.title, description: issue.description, category: issue.category,
        status: issue.status, location: issue.location, area: issue.area || '',
        coordinates: parsePoint(issue.coordinates), votes: issue.votes,
        image_url: issue.image_url, media_url: issue.media_url, user_id: issue.user_id,
        created_at: issue.created_at, time_uploaded: issue.time_uploaded, severity: issue.severity,
        resolved_at: issue.resolved_at, resolved_by: issue.resolved_by, blockchain_hash: issue.blockchain_hash,
      }));
      setIssues(formatted);
      return { data: formatted, error: null };
    } catch (error) {
      console.error('Error fetching issues:', error);
      toast({ title: 'Could not load reports', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
      return { data: null, error };
    } finally { setLoading(false); }
  }, [toast]);

  const createIssue = async (input: CreateIssueInput) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Please sign in before submitting a report.');
      const { data, error } = await supabase.from('issues').insert({
        title: input.title, description: input.description, category: input.category,
        location: input.location, area: input.area ?? '',
        coordinates: input.coordinates ? `(${input.coordinates[0]}, ${input.coordinates[1]})` : null,
        image_url: input.image_url ?? null, media_url: input.media_url ?? null,
        severity: input.severity ?? 3, status: 'reported', votes: 0, user_id: authData.user.id,
      }).select().single();
      if (error) throw error;
      await fetchIssues();
      toast({ title: 'Report saved', description: 'Your civic issue was added to the database.' });
      return { data, error: null };
    } catch (error) {
      console.error('Error creating issue:', error);
      toast({ title: 'Report not submitted', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
      return { data: null, error };
    }
  };

  const voteOnIssue = async (issueId: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Please sign in before voting.');
      const { data: existingVote, error: lookupError } = await supabase.from('votes')
        .select('id').eq('issue_id', issueId).eq('user_id', authData.user.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (existingVote) {
        toast({ title: 'Already voted', description: 'You have already voted on this issue.' });
        return;
      }
      // The database trigger increments issues.votes atomically after this insert.
      // Do not call a second increment RPC, or each citizen vote would count twice.
      const { error: voteError } = await supabase.from('votes').insert({ issue_id: issueId, user_id: authData.user.id });
      if (voteError) {
        if (voteError.code === '23505') {
          toast({ title: 'Already voted', description: 'You have already confirmed this report.' });
          return;
        }
        throw voteError;
      }
      await fetchIssues();
      toast({ title: 'Vote recorded', description: 'Thank you for supporting this report.' });
    } catch (error) {
      console.error('Error voting on issue:', error);
      toast({ title: 'Could not record vote', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!autoFetch) return;
    void fetchIssues();
    const channel = supabase.channel('issues_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, () => { void fetchIssues(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [autoFetch, fetchIssues]);

  return { issues, loading, fetchIssues, createIssue, voteOnIssue };
};
