import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

let profileCache: Map<string, Profile> = new Map();
let allProfilesLoaded = false;
let allProfilesPromise: Promise<Profile[]> | null = null;

async function loadAllProfiles(): Promise<Profile[]> {
  if (allProfilesLoaded) return Array.from(profileCache.values());
  if (allProfilesPromise) return allProfilesPromise;
  
  allProfilesPromise = (async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url");
    const profiles = (data ?? []) as Profile[];
    profiles.forEach((p) => profileCache.set(p.id, p));
    allProfilesLoaded = true;
    return profiles;
  })();
  
  return allProfilesPromise;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllProfiles().then((p) => {
      setProfiles(p);
      setLoading(false);
    });
  }, []);

  const getName = useCallback((id: string | null) => {
    if (!id) return "—";
    const p = profileCache.get(id);
    return p?.full_name || p?.email || id.slice(0, 8);
  }, [profiles]);

  return { profiles, loading, getName };
}

export function useOwnerName(id: string | null) {
  const [name, setName] = useState<string>("—");

  useEffect(() => {
    if (!id) { setName("—"); return; }
    const cached = profileCache.get(id);
    if (cached) { setName(cached.full_name || cached.email || id.slice(0, 8)); return; }
    
    loadAllProfiles().then(() => {
      const p = profileCache.get(id);
      setName(p?.full_name || p?.email || id.slice(0, 8));
    });
  }, [id]);

  return name;
}
