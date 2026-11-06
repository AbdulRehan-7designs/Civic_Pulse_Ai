import { useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, CheckCircle, Clock, AlertTriangle, Filter, ArrowUpDown, Map } from "lucide-react";
import Navbar from "@/components/Navbar";
import { IssueReport, formatTimeAgo } from "@/utils/mockData";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import VoteButton from "@/components/VoteButton";
import { IssueCardDetails } from "@/components/issue/IssueCardDetails";
import LiveIssuesMap from "@/components/LiveIssuesMap";
import { useIssues, Issue } from "@/hooks/useIssues";

const toReport = (issue: Issue): IssueReport => ({
  id: issue.id, title: issue.title, description: issue.description, category: issue.category,
  status: issue.status.replace('_', '-') as IssueReport['status'],
  reportedAt: issue.created_at, reportedBy: 'Community member', votes: issue.votes,
  location: issue.coordinates ? { address: issue.location, lng: issue.coordinates[0], lat: issue.coordinates[1] } : issue.location,
  images: issue.image_url ? [issue.image_url] : [], videos: issue.media_url ? [issue.media_url] : [],
});
const statusColor = (status: string) => status === 'resolved' ? 'bg-green-100 text-green-800 border-green-200'
  : status === 'in-progress' ? 'bg-blue-100 text-blue-800 border-blue-200'
  : status === 'verified' ? 'bg-purple-100 text-purple-800 border-purple-200'
  : status === 'fake' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200';
const statusIcon = (status: string) => status === 'resolved' || status === 'verified'
  ? <CheckCircle className="h-4 w-4" /> : status === 'in-progress'
  ? <Clock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />;

const Reports = () => {
  const { issues, loading } = useIssues();
  const reports = useMemo(() => issues.map(toReport), [issues]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedIssue, setSelectedIssue] = useState<IssueReport | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showMap, setShowMap] = useState(false);
  const processed = [...reports].filter(r => activeFilter === 'all' || r.status === activeFilter).sort((a,b) =>
    (sortOrder === 'asc' ? 1 : -1) * (sortBy === 'date'
      ? new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime()
      : a.votes - b.votes));
  const toggleSort = (next: 'date' | 'priority') => {
    if (sortBy === next) setSortOrder(v => v === 'asc' ? 'desc' : 'asc');
    else { setSortBy(next); setSortOrder('desc'); }
  };
  const viewDetails = (issue: IssueReport) => { setSelectedIssue(issue); setIsDialogOpen(true); };

  return <div className="flex flex-col min-h-screen animate-fade-in">
    <Navbar />
    <main className="flex-1 container py-10"><div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div><h1 className="text-3xl font-bold">Community Reports</h1><p className="text-gray-500 mt-1">Live reports submitted by citizens</p></div>
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          {['all','reported','verified','in-progress','resolved'].map(s => <Button key={s} variant={activeFilter === s ? "default" : "outline"} onClick={() => setActiveFilter(s)}>{s === 'all' ? 'All' : s.replace('-', ' ').replace(/^\\w/, c => c.toUpperCase())}</Button>)}
          <div className="flex items-center gap-2 ml-2 border-l pl-2">
            <Button variant="ghost" size="sm" onClick={() => toggleSort('date')}><Calendar className="h-4 w-4 mr-1"/>Date{sortBy === 'date' && <ArrowUpDown className="h-3 w-3 ml-1"/>}</Button>
            <Button variant="ghost" size="sm" onClick={() => toggleSort('priority')}><Filter className="h-4 w-4 mr-1"/>Citizen confirmations{sortBy === 'priority' && <ArrowUpDown className="h-3 w-3 ml-1"/>}</Button>
            <Button variant={showMap ? "default" : "outline"} size="sm" onClick={() => setShowMap(v => !v)}><Map className="h-4 w-4 mr-1"/>{showMap ? "Hide Map" : "Show Map"}</Button>
          </div>
        </div>
      </div>
      {showMap && <div className="mb-6"><LiveIssuesMap issues={reports} onIssueSelect={viewDetails} height="600px"/></div>}
      {loading ? <div className="text-center py-20 text-gray-500">Loading live community reports…</div> :
        processed.length === 0 ? <div className="text-center py-20"><p className="text-gray-500 mb-4">No reports found.</p><Link to="/report"><Button>Create a Report</Button></Link></div> :
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {processed.map(report => <Card key={report.id} className="overflow-hidden hover:shadow-lg transition-all">
            <div className="aspect-video relative"><img src={report.images?.[0] || "/placeholder.svg"} alt={report.title} className="object-cover w-full h-full"/>
              <Badge className={`absolute top-2 right-2 flex items-center gap-1 ${statusColor(report.status)}`}>{statusIcon(report.status)}<span className="capitalize">{report.status.replace('-', ' ')}</span></Badge>
            </div>
            <CardHeader className="pb-2"><div className="flex justify-between"><Badge variant="outline">{report.category}</Badge><span className="text-sm text-gray-500">{formatTimeAgo(report.reportedAt)}</span></div><CardTitle className="text-xl mt-2">{report.title}</CardTitle></CardHeader>
            <CardContent className="pb-2"><p className="text-gray-600 text-sm line-clamp-2 mb-3">{report.description}</p><div className="flex items-center text-sm text-gray-500"><MapPin className="h-3 w-3 mr-1"/>{typeof report.location === 'object' ? report.location.address : report.location}</div><p className="text-xs text-muted-foreground mt-2">{report.votes} citizen confirmations</p></CardContent>
            <CardFooter className="flex justify-between pt-2"><VoteButton issueId={report.id} initialVotes={report.votes}/><Button variant="outline" size="sm" onClick={() => viewDetails(report)}>View Details</Button></CardFooter>
          </Card>)}
        </div>}
    </div></main>
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Issue Details</DialogTitle><DialogDescription>Community-submitted report and citizen confirmations</DialogDescription></DialogHeader>{selectedIssue && <IssueCardDetails issue={selectedIssue} onClose={() => setIsDialogOpen(false)} getStatusClass={s => `status-${s}`}/>}</DialogContent></Dialog>
    <footer className="border-t py-6"><div className="container text-center text-sm text-muted-foreground">© {new Date().getFullYear()} CivicPulse AI. All rights reserved.</div></footer>
  </div>;
};
export default Reports;
