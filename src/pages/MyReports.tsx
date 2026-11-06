import { useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from '@/context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import VoteButton from "@/components/VoteButton";
import { useIssues, Issue } from "@/hooks/useIssues";
import { IssueReport, formatTimeAgo } from "@/utils/mockData";

const toReport = (issue: Issue): IssueReport => ({
  id: issue.id, title: issue.title, description: issue.description, category: issue.category,
  status: issue.status.replace('_', '-') as IssueReport['status'], reportedAt: issue.created_at,
  reportedBy: 'You', votes: issue.votes,
  location: issue.coordinates ? { address: issue.location, lng: issue.coordinates[0], lat: issue.coordinates[1] } : issue.location,
  images: issue.image_url ? [issue.image_url] : [], videos: issue.media_url ? [issue.media_url] : [],
});
const statusColor = (s: string) => s === 'resolved' ? 'bg-green-100 text-green-800 border-green-200' : s === 'in-progress' ? 'bg-blue-100 text-blue-800 border-blue-200' : s === 'verified' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200';
const statusIcon = (s: string) => s === 'resolved' || s === 'verified' ? <CheckCircle className="h-4 w-4"/> : s === 'in-progress' ? <Clock className="h-4 w-4"/> : <AlertTriangle className="h-4 w-4"/>;

const MyReports = () => {
  const { isAuthenticated, user } = useAuth();
  const { issues, loading } = useIssues();
  const [activeFilter, setActiveFilter] = useState('all');
  const reports = useMemo(() => issues.filter(i => i.user_id === user?.id).map(toReport), [issues, user?.id]);
  const filtered = activeFilter === 'all' ? reports : reports.filter(r => r.status === activeFilter);
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <div className="flex flex-col min-h-screen animate-fade-in"><Navbar/>
    <main className="flex-1 container py-10"><div className="max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8"><div><h1 className="text-3xl font-bold">My Reports</h1><p className="text-gray-500 mt-1">Track your submissions and their community and official progress.</p></div>
        <div className="flex flex-wrap gap-2 mt-4 md:mt-0">{['all','reported','verified','in-progress','resolved'].map(s => <Button key={s} variant={activeFilter === s ? "default" : "outline"} onClick={() => setActiveFilter(s)}>{s === 'all' ? 'All' : s.replace('-', ' ').replace(/^\\w/, c => c.toUpperCase())}</Button>)}</div>
      </div>
      {loading ? <div className="text-center py-20 text-gray-500">Loading your reports…</div> : filtered.length === 0 ? <div className="text-center py-20"><p className="text-gray-500 mb-4">You haven't submitted any reports in this category yet.</p><Link to="/report"><Button>Submit a Report</Button></Link></div> :
      <div className="grid gap-6 md:grid-cols-2">{filtered.map(report => <Card key={report.id} className="overflow-hidden">
        <div className="aspect-video relative"><img src={report.images?.[0] || "/placeholder.svg"} alt={report.title} className="object-cover w-full h-full"/><Badge className={`absolute top-2 right-2 ${statusColor(report.status)}`}>{statusIcon(report.status)}<span className="ml-1 capitalize">{report.status.replace('-', ' ')}</span></Badge></div>
        <CardHeader className="pb-2"><div className="flex justify-between"><Badge variant="outline">{report.category}</Badge><div className="text-sm text-gray-500 flex items-center"><Calendar className="h-3 w-3 mr-1"/>{formatTimeAgo(report.reportedAt)}</div></div><CardTitle className="text-xl mt-2">{report.title}</CardTitle><CardDescription className="line-clamp-2">{report.description}</CardDescription></CardHeader>
        <CardContent className="pb-2"><div className="flex items-center text-sm text-gray-500"><MapPin className="h-3 w-3 mr-1"/>{typeof report.location === 'object' ? report.location.address : report.location}</div><p className="text-sm text-muted-foreground mt-2">{report.votes} citizen confirmations</p></CardContent>
        <CardFooter className="flex justify-between pt-2"><span className="text-xs text-muted-foreground">Submitted {new Date(report.reportedAt).toLocaleDateString()}</span><VoteButton issueId={report.id} initialVotes={report.votes}/></CardFooter>
      </Card>)}</div>}
    </div></main><footer className="border-t py-6"><div className="container text-center text-sm text-muted-foreground">© {new Date().getFullYear()} CivicPulse AI. All rights reserved.</div></footer>
  </div>;
};
export default MyReports;
