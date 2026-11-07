import { useNavigate } from "react-router-dom";
import { Shield, Info } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SetupAdmin = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg">
          <CardHeader className="items-center text-center">
            <Shield className="mb-2 h-10 w-10 text-purple-600" />
            <CardTitle>Administrator provisioning</CardTitle>
            <CardDescription>
              Administrator access is assigned by the project owner, not through public sign-up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-3 rounded-md border bg-muted/40 p-4 text-sm">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <p>
                Create or verify the account through Supabase Authentication first. The project owner
                must then assign the initial administrator role using a trusted database session.
                Existing administrators can assign later roles from the admin dashboard.
              </p>
            </div>
            <Button className="w-full" onClick={() => navigate("/login")}>
              Go to login
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SetupAdmin;
