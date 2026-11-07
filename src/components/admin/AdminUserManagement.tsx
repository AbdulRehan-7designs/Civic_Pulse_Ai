import { useCallback, useEffect, useMemo, useState } from "react";
import { Shield, Search, User, UserCheck, UserMinus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ManagedProfile {
  id: string;
  username: string;
  full_name: string;
  created_at: string;
  is_admin: boolean;
  is_official: boolean;
}

const AdminUserManagement = () => {
  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, created_at, is_admin, is_official")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setProfiles((data ?? []) as ManagedProfile[]);
    } catch (error) {
      toast({
        title: "Could not load users",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  const assignAdminRole = async (profile: ManagedProfile) => {
    const makeAdmin = !profile.is_admin;
    const action = makeAdmin ? "grant administrator access to" : "remove administrator access from";
    if (!window.confirm(`Are you sure you want to ${action} ${profile.full_name}?`)) return;

    setUpdatingUserId(profile.id);
    try {
      const { error } = await supabase.rpc("set_user_role", {
        target_user_id: profile.id,
        make_admin: makeAdmin,
        make_official: profile.is_official,
      });
      if (error) throw error;
      toast({
        title: makeAdmin ? "Administrator role assigned" : "Administrator role removed",
        description: `${profile.full_name}'s permissions have been updated.`,
      });
      await fetchProfiles();
    } catch (error) {
      toast({
        title: "Role update failed",
        description: error instanceof Error ? error.message : "Only an existing administrator can change roles.",
        variant: "destructive",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredProfiles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return profiles.filter((profile) =>
      !query || profile.full_name.toLowerCase().includes(query) || profile.username.toLowerCase().includes(query)
    );
  }, [profiles, searchTerm]);

  const administratorCount = profiles.filter((profile) => profile.is_admin).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Shield className="h-6 w-6 text-purple-500" />
            Administrator access
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign roles to existing accounts. New accounts must register through the normal sign-up flow.
          </p>
        </div>
        <Badge variant="outline">{administratorCount} administrator{administratorCount === 1 ? "" : "s"}</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Registered users</CardTitle>
              <CardDescription>Role changes are checked again by the database before they are applied.</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search users"
                placeholder="Search by name or username"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading users...</p>
          ) : filteredProfiles.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No matching users found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Administrator access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {profile.full_name}
                      </span>
                    </TableCell>
                    <TableCell>@{profile.username}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {profile.is_admin && <Badge>Admin</Badge>}
                        {profile.is_official && <Badge variant="secondary">Official</Badge>}
                        {!profile.is_admin && !profile.is_official && <Badge variant="outline">Citizen</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(profile.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={profile.is_admin ? "outline" : "default"}
                        disabled={updatingUserId === profile.id}
                        onClick={() => void assignAdminRole(profile)}
                      >
                        {profile.is_admin ? <UserMinus className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
                        {updatingUserId === profile.id ? "Updating..." : profile.is_admin ? "Remove admin" : "Make admin"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUserManagement;
