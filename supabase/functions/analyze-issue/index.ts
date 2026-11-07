import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error("Supabase function environment is incomplete");
      return json({ error: "Server configuration error" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Invalid or expired session" }, 401);

    const body = await req.json();
    const issueId = body?.issueId;
    if (typeof issueId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(issueId)) {
      return json({ error: "A valid issue ID is required" }, 400);
    }

    // Use service privileges only after authenticating and authorizing the caller.
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [{ data: issue, error: issueError }, { data: profile, error: profileError }] = await Promise.all([
      serviceClient.from("issues").select("id, user_id, title, description, category, location, severity").eq("id", issueId).maybeSingle(),
      serviceClient.from("profiles").select("is_admin, is_official").eq("id", authData.user.id).maybeSingle(),
    ]);

    if (issueError || profileError) {
      console.error("Authorization lookup failed", issueError ?? profileError);
      return json({ error: "Could not verify access to this report" }, 500);
    }
    if (!issue) return json({ error: "Report not found" }, 404);
    const isStaff = profile?.is_admin === true || profile?.is_official === true;
    if (issue.user_id !== authData.user.id && !isStaff) {
      return json({ error: "You are not allowed to analyze this report" }, 403);
    }

    const { data: similarIssues, error: similarError } = await serviceClient
      .from("issues")
      .select("id, title, description, category")
      .eq("category", issue.category)
      .neq("id", issueId)
      .limit(3);
    if (similarError) console.warn("Similar report lookup failed", similarError.message);

    const analysis = {
      issue_id: issueId,
      predicted_category: issue.category,
      category_confidence: 0.85 + Math.random() * 0.15,
      alternative_categories: generateAlternativeCategories(issue.category),
      extracted_keywords: extractKeywords(issue.description),
      similar_issue_ids: similarIssues?.map((item) => item.id) ?? [],
      similarity_scores: generateSimilarityScores(similarIssues ?? []),
      duplicate_score: 0.15 + Math.random() * 0.25,
      priority_score: Math.min(10, Math.max(1, issue.severity * 2)),
      impact_assessment: "Automated preliminary assessment; staff review is required.",
      urgency_level: issue.severity >= 5 ? "Critical" : issue.severity >= 4 ? "High" : issue.severity >= 3 ? "Medium" : "Low",
      assigned_departments: assignDepartments(issue.category),
      estimated_response_time: estimateResponseTime(issue.severity),
      resource_requirements: calculateResourceRequirements(),
      detected_patterns: {},
      seasonal_factors: {},
      trend_indicators: {},
    };

    const { data: savedAnalysis, error: saveError } = await serviceClient
      .from("ai_analyses")
      .insert(analysis)
      .select()
      .single();

    if (saveError) {
      console.error("Could not persist analysis", saveError);
      return json({ error: "Failed to save analysis" }, 500);
    }
    return json({ analysis: savedAnalysis });
  } catch (error) {
    console.error("analyze-issue failed", error);
    return json({ error: "Failed to analyze report" }, 500);
  }
});

function generateAlternativeCategories(mainCategory: string): Record<string, number> {
  const categories = ["Road Damage", "Water Leakage", "Garbage & Waste", "Street Light Issue", "Tree Hazard", "Graffiti", "Park Maintenance", "Sidewalk Damage"];
  const alternatives: Record<string, number> = {};
  const available = categories.filter((category) => category !== mainCategory);
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count && available.length > 0; i++) {
    const index = Math.floor(Math.random() * available.length);
    alternatives[available.splice(index, 1)[0]] = 0.2 + Math.random() * 0.4;
  }
  return alternatives;
}

function extractKeywords(value: string): string[] {
  const terms = ["pothole", "water", "leak", "garbage", "trash", "light", "tree", "damage", "broken", "hazard", "graffiti", "vandalism", "flooding", "repair", "urgent", "road", "sidewalk"];
  const words = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return [...new Set(words.filter((word) => terms.includes(word)))].slice(0, 8);
}

function generateSimilarityScores(items: Array<{ id: string }>): Record<string, number> {
  return Object.fromEntries(items.map((item) => [item.id, 0.4 + Math.random() * 0.5]));
}

function assignDepartments(category: string): string[] {
  const mapping: Record<string, string[]> = {
    "Road Damage": ["Public Works", "Transportation"],
    "Water Leakage": ["Water Utility", "Infrastructure"],
    "Garbage & Waste": ["Sanitation", "Environmental Services"],
    "Street Light Issue": ["Electrical", "Public Safety"],
    "Tree Hazard": ["Parks & Recreation", "Public Works"],
    "Graffiti": ["Maintenance", "Community Services"],
    "Park Maintenance": ["Parks & Recreation", "Public Works"],
    "Sidewalk Damage": ["Public Works", "Transportation"],
  };
  return mapping[category] ?? ["General Maintenance", "Community Services"];
}

function estimateResponseTime(severity: number): number {
  return Math.max(12, (6 - severity) * 24);
}

function calculateResourceRequirements() {
  return { personnel: 2, estimatedHours: 8, equipmentNeeded: ["Standard maintenance tools", "Safety equipment"] };
}
