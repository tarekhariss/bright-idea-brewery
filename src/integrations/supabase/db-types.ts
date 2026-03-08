export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = "admin" | "manager" | "operator" | "viewer";
export type ImportStatus = "pending" | "mapping" | "validating" | "processing" | "completed" | "failed" | "cancelled";
export type ImportRowStatus = "pending" | "success" | "error" | "skipped" | "duplicate" | "review";
export type LifecycleStatus = "new" | "researching" | "qualified" | "nurturing" | "engaged" | "converted" | "churned" | "archived";
export type OutreachStatus = "not_contacted" | "queued" | "contacted" | "replied" | "bounced" | "opted_out" | "unresponsive";
export type EmailValidity = "unknown" | "valid" | "invalid" | "catch_all" | "disposable" | "role_based";

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
          role: AppRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: AppRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: AppRole;
          created_at?: string;
        };
      };
      companies: {
        Row: {
          id: string;
          name: string;
          normalized_name: string;
          domain: string | null;
          industry: string | null;
          employee_count: number | null;
          employee_range: string | null;
          revenue_range: string | null;
          country: string | null;
          city: string | null;
          state: string | null;
          linkedin_url: string | null;
          website: string | null;
          description: string | null;
          logo_url: string | null;
          company_name_for_emails: string | null;
          company_phone: string | null;
          company_linkedin_url: string | null;
          facebook_url: string | null;
          twitter_url: string | null;
          company_address: string | null;
          company_city: string | null;
          company_state: string | null;
          company_country: string | null;
          annual_revenue: number | null;
          total_funding: number | null;
          latest_funding: string | null;
          latest_funding_amount: number | null;
          last_raised_at: string | null;
          technologies: string[] | null;
          keywords: string[] | null;
          external_account_id: string | null;
          enrichment_data: Json | null;
          notes: string | null;
          data_quality_score: number | null;
          last_verified_at: string | null;
          owner_id: string | null;
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
          employee_range?: string | null;
          revenue_range?: string | null;
          country?: string | null;
          city?: string | null;
          state?: string | null;
          linkedin_url?: string | null;
          website?: string | null;
          description?: string | null;
          logo_url?: string | null;
          company_name_for_emails?: string | null;
          company_phone?: string | null;
          company_linkedin_url?: string | null;
          facebook_url?: string | null;
          twitter_url?: string | null;
          company_address?: string | null;
          company_city?: string | null;
          company_state?: string | null;
          company_country?: string | null;
          annual_revenue?: number | null;
          total_funding?: number | null;
          latest_funding?: string | null;
          latest_funding_amount?: number | null;
          last_raised_at?: string | null;
          technologies?: string[] | null;
          keywords?: string[] | null;
          external_account_id?: string | null;
          enrichment_data?: Json | null;
          notes?: string | null;
          data_quality_score?: number | null;
          last_verified_at?: string | null;
          owner_id?: string | null;
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
          employee_range?: string | null;
          revenue_range?: string | null;
          country?: string | null;
          city?: string | null;
          state?: string | null;
          linkedin_url?: string | null;
          website?: string | null;
          description?: string | null;
          logo_url?: string | null;
          company_name_for_emails?: string | null;
          company_phone?: string | null;
          company_linkedin_url?: string | null;
          facebook_url?: string | null;
          twitter_url?: string | null;
          company_address?: string | null;
          company_city?: string | null;
          company_state?: string | null;
          company_country?: string | null;
          annual_revenue?: number | null;
          total_funding?: number | null;
          latest_funding?: string | null;
          latest_funding_amount?: number | null;
          last_raised_at?: string | null;
          technologies?: string[] | null;
          keywords?: string[] | null;
          external_account_id?: string | null;
          enrichment_data?: Json | null;
          notes?: string | null;
          data_quality_score?: number | null;
          last_verified_at?: string | null;
          owner_id?: string | null;
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
          secondary_email: string | null;
          tertiary_email: string | null;
          email_confidence: number | null;
          primary_email_source: string | null;
          secondary_email_source: string | null;
          tertiary_email_source: string | null;
          phone: string | null;
          work_direct_phone: string | null;
          mobile_phone: string | null;
          corporate_phone: string | null;
          home_phone: string | null;
          other_phone: string | null;
          job_title: string | null;
          seniority_level: string | null;
          department: string | null;
          linkedin_url: string | null;
          country: string | null;
          city: string | null;
          state: string | null;
          company_id: string | null;
          company_name_raw: string | null;
          lifecycle_status: LifecycleStatus;
          outreach_status: OutreachStatus;
          do_not_contact: boolean;
          email_validity_status: EmailValidity;
          owner_id: string | null;
          data_quality_score: number | null;
          last_verified_at: string | null;
          last_contacted_at: string | null;
          source: string | null;
          source_file: string | null;
          external_source: string | null;
          external_contact_id: string | null;
          notes: string | null;
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
          secondary_email?: string | null;
          tertiary_email?: string | null;
          email_confidence?: number | null;
          primary_email_source?: string | null;
          secondary_email_source?: string | null;
          tertiary_email_source?: string | null;
          phone?: string | null;
          work_direct_phone?: string | null;
          mobile_phone?: string | null;
          corporate_phone?: string | null;
          home_phone?: string | null;
          other_phone?: string | null;
          job_title?: string | null;
          seniority_level?: string | null;
          department?: string | null;
          linkedin_url?: string | null;
          country?: string | null;
          city?: string | null;
          state?: string | null;
          company_id?: string | null;
          company_name_raw?: string | null;
          lifecycle_status?: LifecycleStatus;
          outreach_status?: OutreachStatus;
          do_not_contact?: boolean;
          email_validity_status?: EmailValidity;
          owner_id?: string | null;
          data_quality_score?: number | null;
          last_verified_at?: string | null;
          last_contacted_at?: string | null;
          source?: string | null;
          source_file?: string | null;
          external_source?: string | null;
          external_contact_id?: string | null;
          notes?: string | null;
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
          secondary_email?: string | null;
          tertiary_email?: string | null;
          email_confidence?: number | null;
          primary_email_source?: string | null;
          secondary_email_source?: string | null;
          tertiary_email_source?: string | null;
          phone?: string | null;
          work_direct_phone?: string | null;
          mobile_phone?: string | null;
          corporate_phone?: string | null;
          home_phone?: string | null;
          other_phone?: string | null;
          job_title?: string | null;
          seniority_level?: string | null;
          department?: string | null;
          linkedin_url?: string | null;
          country?: string | null;
          city?: string | null;
          state?: string | null;
          company_id?: string | null;
          company_name_raw?: string | null;
          lifecycle_status?: LifecycleStatus;
          outreach_status?: OutreachStatus;
          do_not_contact?: boolean;
          email_validity_status?: EmailValidity;
          owner_id?: string | null;
          data_quality_score?: number | null;
          last_verified_at?: string | null;
          last_contacted_at?: string | null;
          source?: string | null;
          source_file?: string | null;
          external_source?: string | null;
          external_contact_id?: string | null;
          notes?: string | null;
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
          status: ImportStatus;
          total_rows: number;
          processed_rows: number;
          success_rows: number;
          error_rows: number;
          duplicate_rows: number;
          review_rows: number;
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
          status?: ImportStatus;
          total_rows?: number;
          processed_rows?: number;
          success_rows?: number;
          error_rows?: number;
          duplicate_rows?: number;
          review_rows?: number;
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
          status?: ImportStatus;
          total_rows?: number;
          processed_rows?: number;
          success_rows?: number;
          error_rows?: number;
          duplicate_rows?: number;
          review_rows?: number;
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
          normalized_data: Json | null;
          status: ImportRowStatus;
          error_message: string | null;
          duplicate_match_reason: string | null;
          action_taken: string | null;
          review_required: boolean;
          contact_id: string | null;
          company_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          import_job_id: string;
          row_number: number;
          raw_data: Json;
          normalized_data?: Json | null;
          status?: ImportRowStatus;
          error_message?: string | null;
          duplicate_match_reason?: string | null;
          action_taken?: string | null;
          review_required?: boolean;
          contact_id?: string | null;
          company_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          import_job_id?: string;
          row_number?: number;
          raw_data?: Json;
          normalized_data?: Json | null;
          status?: ImportRowStatus;
          error_message?: string | null;
          duplicate_match_reason?: string | null;
          action_taken?: string | null;
          review_required?: boolean;
          contact_id?: string | null;
          company_id?: string | null;
          created_at?: string;
        };
      };
      saved_views: {
        Row: {
          id: string;
          name: string;
          entity_type: "contact" | "company";
          filters: Json;
          columns: Json | null;
          sort_by: string | null;
          sort_direction: "asc" | "desc";
          is_default: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          entity_type: "contact" | "company";
          filters?: Json;
          columns?: Json | null;
          sort_by?: string | null;
          sort_direction?: "asc" | "desc";
          is_default?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          entity_type?: "contact" | "company";
          filters?: Json;
          columns?: Json | null;
          sort_by?: string | null;
          sort_direction?: "asc" | "desc";
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
      custom_fields: {
        Row: {
          id: string;
          entity_type: "contact" | "company" | "deal";
          field_name: string;
          field_label: string;
          field_type: "text" | "number" | "date" | "boolean" | "picklist" | "multi_picklist" | "url" | "email" | "phone" | "textarea" | "currency";
          picklist_id: string | null;
          is_required: boolean;
          is_active: boolean;
          default_value: string | null;
          display_order: number;
          description: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_type: "contact" | "company" | "deal";
          field_name: string;
          field_label: string;
          field_type: "text" | "number" | "date" | "boolean" | "picklist" | "multi_picklist" | "url" | "email" | "phone" | "textarea" | "currency";
          picklist_id?: string | null;
          is_required?: boolean;
          is_active?: boolean;
          default_value?: string | null;
          display_order?: number;
          description?: string | null;
          created_by?: string | null;
        };
        Update: {
          field_label?: string;
          field_type?: "text" | "number" | "date" | "boolean" | "picklist" | "multi_picklist" | "url" | "email" | "phone" | "textarea" | "currency";
          picklist_id?: string | null;
          is_required?: boolean;
          is_active?: boolean;
          default_value?: string | null;
          display_order?: number;
          description?: string | null;
        };
      };
      pipeline_stages: {
        Row: {
          id: string;
          entity_type: "contact" | "company" | "deal";
          pipeline_name: string;
          stage_name: string;
          stage_key: string;
          display_order: number;
          color: string | null;
          description: string | null;
          is_active: boolean;
          is_closed: boolean;
          is_won: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_type: "contact" | "company" | "deal";
          pipeline_name?: string;
          stage_name: string;
          stage_key: string;
          display_order?: number;
          color?: string | null;
          description?: string | null;
          is_active?: boolean;
          is_closed?: boolean;
          is_won?: boolean;
          created_by?: string | null;
        };
        Update: {
          stage_name?: string;
          display_order?: number;
          color?: string | null;
          description?: string | null;
          is_active?: boolean;
          is_closed?: boolean;
          is_won?: boolean;
        };
      };
      global_picklists: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_active?: boolean;
        };
      };
      global_picklist_options: {
        Row: {
          id: string;
          picklist_id: string;
          label: string;
          value: string;
          display_order: number;
          is_active: boolean;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          picklist_id: string;
          label: string;
          value: string;
          display_order?: number;
          is_active?: boolean;
          color?: string | null;
        };
        Update: {
          label?: string;
          value?: string;
          display_order?: number;
          is_active?: boolean;
          color?: string | null;
        };
      };
      goals: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          goal_type: "contacts_created" | "emails_sent" | "calls_made" | "meetings_booked" | "deals_won" | "revenue" | "custom";
          target_value: number;
          current_value: number;
          period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
          start_date: string;
          end_date: string;
          assigned_to: string | null;
          team_goal: boolean;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          goal_type: "contacts_created" | "emails_sent" | "calls_made" | "meetings_booked" | "deals_won" | "revenue" | "custom";
          target_value: number;
          current_value?: number;
          period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
          start_date: string;
          end_date: string;
          assigned_to?: string | null;
          team_goal?: boolean;
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          target_value?: number;
          current_value?: number;
          period?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
          start_date?: string;
          end_date?: string;
          assigned_to?: string | null;
          team_goal?: boolean;
          is_active?: boolean;
        };
      };
      system_activity_log: {
        Row: {
          id: string;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          details: Json | null;
          performed_by: string | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          details?: Json | null;
          performed_by?: string | null;
          ip_address?: string | null;
        };
        Update: {};
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
        Args: { _user_id: string; _role: AppRole };
        Returns: boolean;
      };
      has_any_role: {
        Args: { _user_id: string; _roles: AppRole[] };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: AppRole;
      import_status: ImportStatus;
      import_row_status: ImportRowStatus;
      lifecycle_status: LifecycleStatus;
      outreach_status: OutreachStatus;
      email_validity: EmailValidity;
    };
  };
};
