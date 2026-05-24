// Parse a CSV/XLSX/TXT file, extract original headers (in order),
// extract emails, and upload the raw file to the `verification-uploads`
// storage bucket so exports can later preserve the user's original layout.

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export interface ParsedUpload {
  headers: string[];          // original header order, exactly as uploaded
  emails: string[];           // de-duplicated lowercased emails
  rowCount: number;
  fileType: "csv" | "xlsx" | "txt";
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function uniqueLower(emails: string[]): string[] {
  return Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
}

function findEmailHeader(headers: string[]): string | null {
  const lc = headers.map((h) => (h ?? "").toLowerCase().trim());
  const exact = lc.findIndex((h) => h === "email" || h === "email_address" || h === "e-mail");
  if (exact >= 0) return headers[exact];
  const partial = lc.findIndex((h) => h.includes("email") || h.includes("e-mail"));
  return partial >= 0 ? headers[partial] : null;
}

export async function parseUploadFile(file: File): Promise<ParsedUpload> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false }) as any[][];
    const headers = (aoa.shift() ?? []).map((h) => String(h ?? ""));
    const emailHeader = findEmailHeader(headers);
    const idx = emailHeader ? headers.indexOf(emailHeader) : -1;
    const emails: string[] = [];
    for (const row of aoa) {
      if (idx >= 0) {
        const v = String(row[idx] ?? "");
        if (v) emails.push(v);
      } else {
        const all = row.map((v) => String(v ?? "")).join(" ");
        const found = all.match(EMAIL_RE);
        if (found) emails.push(...found);
      }
    }
    return {
      headers,
      emails: uniqueLower(emails),
      rowCount: aoa.length,
      fileType: "xlsx",
    };
  }

  if (name.endsWith(".csv")) {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    const headers = (rows.shift() ?? []).map((h) => String(h ?? ""));
    const emailHeader = findEmailHeader(headers);
    const idx = emailHeader ? headers.indexOf(emailHeader) : -1;
    const emails: string[] = [];
    for (const row of rows) {
      if (idx >= 0) {
        const v = String(row[idx] ?? "");
        if (v) emails.push(v);
      } else {
        const all = row.join(" ");
        const found = all.match(EMAIL_RE);
        if (found) emails.push(...found);
      }
    }
    return {
      headers,
      emails: uniqueLower(emails),
      rowCount: rows.length,
      fileType: "csv",
    };
  }

  // TXT / fallback: one email per line, no original columns
  const text = await file.text();
  const emails = (text.match(EMAIL_RE) ?? []);
  return {
    headers: [],
    emails: uniqueLower(emails),
    rowCount: emails.length,
    fileType: "txt",
  };
}

export async function uploadRawVerificationFile(
  file: File,
  workspaceId: string,
  jobId: string,
): Promise<string> {
  const safe = file.name.replace(/[^a-z0-9_\-\.]+/gi, "_");
  const path = `${workspaceId}/${jobId}/${safe}`;
  const { error } = await supabase.storage
    .from("verification-uploads")
    .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
  if (error) throw error;
  return path;
}

/** Pasted-text fallback used when no file is uploaded. */
export function extractEmailsFromText(text: string): string[] {
  return uniqueLower(text.match(EMAIL_RE) ?? []);
}
