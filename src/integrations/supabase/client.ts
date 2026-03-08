import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://cblpmhzjyqdpytizksmx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNibHBtaHpqeXFkcHl0aXprc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzI4OTMsImV4cCI6MjA4ODU0ODg5M30.ormMeATnWRQSGSSZH4sQT3Hu4UzOfgjGZWr038a7z0M";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
