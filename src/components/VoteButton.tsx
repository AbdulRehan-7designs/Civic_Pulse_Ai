import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIssues } from "@/hooks/useIssues";

interface VoteButtonProps {
  issueId: string;
  initialVotes: number;
  onVoteChange?: (newVotes: number) => void;
}

const VoteButton = ({ issueId, initialVotes, onVoteChange }: VoteButtonProps) => {
  const [votes, setVotes] = useState(initialVotes);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { voteOnIssue } = useIssues({ autoFetch: false });

  useEffect(() => setVotes(initialVotes), [initialVotes]);

  useEffect(() => {
    let cancelled = false;
    const checkVote = async () => {
      if (!user?.id) { setHasVoted(false); return; }
      const { data, error } = await supabase.from('votes').select('id')
        .eq('issue_id', issueId).eq('user_id', user.id).maybeSingle();
      if (!cancelled && !error) setHasVoted(Boolean(data));
    };
    void checkVote();
    return () => { cancelled = true; };
  }, [issueId, user?.id]);

  const handleVote = async () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in to confirm this report", description: "Only signed-in citizens can confirm a report.", variant: "destructive" });
      navigate("/login");
      return;
    }
    if (hasVoted || isLoading) return;
    setIsLoading(true);
    try {
      const result = await voteOnIssue(issueId);
      if (!result || result.error || !result.data) return;
      const next = votes + 1;
      setVotes(next);
      setHasVoted(true);
      onVoteChange?.(next);
    } finally {
      setIsLoading(false);
    }
  };

  return <div className="flex flex-col items-center">
    <Button type="button" variant="ghost" size="sm" disabled={isLoading || hasVoted}
      aria-label={hasVoted ? "You have confirmed this report" : "Confirm this report"}
      className={cn("flex flex-col h-auto py-2 hover:bg-blue-50 transition-colors", hasVoted ? "text-civic-blue bg-blue-50" : "")}
      onClick={() => void handleVote()}>
      <ArrowUp className={cn("h-5 w-5", hasVoted && "fill-civic-blue")} />
      <span className="text-xs font-bold mt-1">{votes}</span>
      <span className="text-[10px]">{hasVoted ? "Confirmed" : "Confirm"}</span>
    </Button>
  </div>;
};
export default VoteButton;
