
import { useMemo, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { IssueReport } from "@/utils/mockData";
import { useIssues, Issue } from "@/hooks/useIssues";
import AdminSidebar from "@/components/admin/AdminSidebar";
import IssueFilters from "@/components/admin/IssueFilters";
import IssueTable from "@/components/admin/IssueTable";
import TabContent from "@/components/admin/TabContent";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import SettingsPanel from "@/components/admin/SettingsPanel";
import { AIInsightsDashboard } from "@/components/admin/AIInsightsDashboard";
import AdminAIAssistant from "@/components/admin/AdminAIAssistant";
import InteractiveDataVisualizer from "@/components/admin/InteractiveDataVisualizer";
import AutomatedPrioritizationSystem from "@/components/admin/AutomatedPrioritizationSystem";
import RouteOptimization from "@/components/admin/RouteOptimization";
import VideoAnalyticsInsights from "@/components/admin/VideoAnalyticsInsights";
import OfficialUserManagement from "@/components/admin/OfficialUserManagement";
import AdminUserManagement from "@/components/admin/AdminUserManagement";

// Enhanced Admin component with interactive and AI features
const toReport = (issue: Issue): IssueReport => ({
  id: issue.id, title: issue.title, description: issue.description, category: issue.category,
  status: issue.status.replace('_', '-') as IssueReport['status'],
  reportedAt: issue.created_at, reportedBy: issue.user_id, votes: issue.votes,
  location: issue.coordinates ? { address: issue.location, lng: issue.coordinates[0], lat: issue.coordinates[1] } : issue.location,
  images: issue.image_url ? [issue.image_url] : [], videos: issue.media_url ? [issue.media_url] : [],
});

const Admin = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedArea, setSelectedArea] = useState("all");
  const { issues, loading, fetchIssues } = useIssues();
  const reports = useMemo(() => issues.map(toReport), [issues]);
  const filteredIssues = reports.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || issue.status === statusFilter;
    const locationText = typeof issue.location === "string" ? issue.location : issue.location.address;
    const matchesArea = selectedArea === "all" || locationText.toLowerCase().includes(selectedArea);
    return matchesSearch && matchesStatus && matchesArea;
  });

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="container py-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">CivicPulse Admin Dashboard</h1>
            <Link to="/">
              <Button variant="outline" size="sm" className="md:hidden">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Site
              </Button>
            </Link>
          </div>
          
          {/* AI Assistant (always visible) */}
          <AdminAIAssistant className="mb-6" />
          
          <Tabs defaultValue="reports">
            <TabsList className="mb-4">
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="officials">Officials</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
              <TabsTrigger value="automation">Automation</TabsTrigger>
              <TabsTrigger value="video">Video Analytics</TabsTrigger>
              <TabsTrigger value="routes">Route Optimization</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="reports" className="space-y-4 pt-4">
              <TabContent 
                title="Issue Reports" 
                description="Review citizen reports, community confirmations and official status updates."
              >
                <IssueFilters 
                  searchTerm={searchTerm}
                  statusFilter={statusFilter}
                  selectedArea={selectedArea}
                  onSearchChange={setSearchTerm}
                  onStatusFilterChange={setStatusFilter}
                  onAreaFilterChange={setSelectedArea}
                />
                {loading ? <div className="py-10 text-center text-muted-foreground">Loading live reports…</div> : <IssueTable issues={filteredIssues} onIssueUpdated={fetchIssues} />}
              </TabContent>
            </TabsContent>
            
            <TabsContent value="officials" className="pt-4">
              <TabContent 
                title="Official User Management" 
                description="Create and manage official user accounts for government personnel."
              >
                <OfficialUserManagement />
              </TabContent>
            </TabsContent>
            
            <TabsContent value="analytics" className="pt-4">
              <TabContent 
                title="Analytics Dashboard" 
                description="View statistics and insights about reported issues."
              >
                <InteractiveDataVisualizer />
                <div className="mt-6">
                  <AnalyticsDashboard />
                </div>
              </TabContent>
            </TabsContent>
            
            <TabsContent value="ai-insights" className="pt-4">
              <TabContent 
                title="AI-Powered Insights" 
                description="Advanced data analysis and intelligent insights for civic issues."
              >
                <AIInsightsDashboard />
              </TabContent>
            </TabsContent>
            
            <TabsContent value="automation" className="pt-4">
              <TabContent 
                title="Automation Systems" 
                description="Configure AI-driven workflow automation rules and systems."
              >
                <AutomatedPrioritizationSystem />
              </TabContent>
            </TabsContent>
            
            <TabsContent value="video" className="pt-4">
              <TabContent 
                title="Video Analytics" 
                description="Analyze video reports using computer vision technology."
              >
                <VideoAnalyticsInsights />
              </TabContent>
            </TabsContent>
            
            <TabsContent value="settings" className="pt-4">
              <TabContent 
                title="Admin Settings" 
                description="Configure system settings and permissions."
              >
                <div className="space-y-6">
                  <AdminUserManagement />
                  <div className="mt-6">
                    <SettingsPanel />
                  </div>
                </div>
              </TabContent>
            </TabsContent>
            
            <TabsContent value="routes" className="pt-4">
              <TabContent 
                title="Route Optimization" 
                description="Find alternate routes and report blocked roads to Google Maps."
              >
                <RouteOptimization issues={filteredIssues} />
              </TabContent>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Admin;
