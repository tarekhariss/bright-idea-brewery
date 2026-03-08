export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: "admin" | "moderator" | "user";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: "admin" | "moderator" | "user";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: "admin" | "moderator" | "user";
          created_at?: string;
        };
      };
      companies: {
        Row: {
          id: string;
          name: string;
          domain: string | null;
          industry: string | null;
          employee_count: number | null;
          country: string | null;
          city: string | null;
          state: string | null;
          linkedin_url: string | null;
          website: string | null;
          description: string | null;
          logo_url: string | null;
          enrichment_data: Json | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          domain?: string | null;
          industry?: string | null;
          employee_count?: number | null;
          country?: string | null;
          city?: string | null;
          state?: string | null;
          linkedin_url?: string | null;
          website?: string | null;
          description?: string | null;
          logo_url?: string | null;
          enrichment_data?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          domain?: string | null;
          industry?: string | null;
          employee_count?: number | null;
          country?: string | null;
          city?: string | null;
          state?: string | null;
          linkedin_url?: string | null;
          website?: string | null;
          description?: string | null;
          logo_url?: string | null;
          enrichment_data?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      contacts: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          job_title: string | null;
          seniority_level: string | null;
          department: string | null;
          linkedin_url: string | null;
          country: string | null;
          city: string | null;
          state: string | null;
          company_id: string | null;
          company_name: string | null;
          source: string | null;
          status: string;
          enrichment_data: Json | null;
          custom_fields: Json | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          job_title?: string | null;
          seniority_level?: string | null;
          department?: string | null;
          linkedin_url?: string | null;
          country?: string | null;
          city?: string | null;
          state?: string | null;
          company_id?: string | null;
          company_name?: string | null;
          source?: string | null;
          status?: string;
          enrichment_data?: Json | null;
          custom_fields?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          job_title?: string | null;
          seniority_level?: string | null;
          department?: string | null;
          linkedin_url?: string | null;
          country?: string | null;
          city?: string | null;
          state?: string | null;
          company_id?: string | null;
          company_name?: string | null;
          source?: string | null;
          status?: string;
          enrichment_data?: Json | null;
          custom_fields?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tags: {
        Row: {
          id: string;
          name: string;
          color: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      contact_tags: {
        Row: { contact_id: string; tag_id: string; created_at: string };
        Insert: { contact_id: string; tag_id: string; created_at?: string };
        Update: { contact_id?: string; tag_id?: string; created_at?: string };
      };
      company_tags: {
        Row: { company_id: string; tag_id: string; created_at: string };
        Insert: { company_id: string; tag_id: string; created_at?: string };
        Update: { company_id?: string; tag_id?: string; created_at?: string };
      };
      lists: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_dynamic: boolean;
          filter_criteria: Json | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_dynamic?: boolean;
          filter_criteria?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          is_dynamic?: boolean;
          filter_criteria?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      list_contacts: {
        Row: { list_id: string; contact_id: string; added_at: string; added_by: string | null };
        Insert: { list_id: string; contact_id: string; added_at?: string; added_by?: string | null };
        Update: { list_id?: string; contact_id?: string; added_at?: string; added_by?: string | null };
      };
      import_jobs: {
        Row: {
          id: string;
          file_name: string;
          file_url: string | null;
          status: string;
          total_rows: number;
          processed_rows: number;
          success_rows: number;
          error_rows: number;
          column_mapping: Json | null;
          settings: Json | null;
          error_summary: Json | null;
          started_at: string | null;
          completed_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_name: string;
          file_url?: string | null;
          status?: string;
          total_rows?: number;
          processed_rows?: number;
          success_rows?: number;
          error_rows?: number;
          column_mapping?: Json | null;
          settings?: Json | null;
          error_summary?: Json | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_name?: string;
          file_url?: string | null;
          status?: string;
          total_rows?: number;
          processed_rows?: number;
          success_rows?: number;
          error_rows?: number;
          column_mapping?: Json | null;
          settings?: Json | null;
          error_summary?: Json | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_by?: string;
          created_at?: string;
        };
      };
      import_job_rows: {
        Row: {
          id: string;
          import_job_id: string;
          row_number: number;
          raw_data: Json;
          status: string;
          error_message: string | null;
          contact_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          import_job_id: string;
          row_number: number;
          raw_data: Json;
          status?: string;
          error_message?: string | null;
          contact_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          import_job_id?: string;
          row_number?: number;
          raw_data?: Json;
          status?: string;
          error_message?: string | null;
          contact_id?: string | null;
          created_at?: string;
        };
      };
      saved_views: {
        Row: {
          id: string;
          name: string;
          entity_type: string;
          filters: Json;
          columns: Json | null;
          sort_by: string | null;
          sort_direction: string;
          is_default: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          entity_type: string;
          filters?: Json;
          columns?: Json | null;
          sort_by?: string | null;
          sort_direction?: string;
          is_default?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          entity_type?: string;
          filters?: Json;
          columns?: Json | null;
          sort_by?: string | null;
          sort_direction?: string;
          is_default?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      contact_activity_log: {
        Row: {
          id: string;
          contact_id: string;
          action: string;
          details: Json | null;
          performed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          action: string;
          details?: Json | null;
          performed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          action?: string;
          details?: Json | null;
          performed_by?: string | null;
          created_at?: string;
        };
      };
      company_activity_log: {
        Row: {
          id: string;
          company_id: string;
          action: string;
          details: Json | null;
          performed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          action: string;
          details?: Json | null;
          performed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          action?: string;
          details?: Json | null;
          performed_by?: string | null;
          created_at?: string;
        };
      };
      platform_settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: {};
    Functions: {
      has_role: {
        Args: { _user_id: string; _role: "admin" | "moderator" | "user" };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user";
    };
  };
};
