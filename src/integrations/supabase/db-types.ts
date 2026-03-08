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
export type SequenceStatus = "draft" | "active" | "paused" | "archived";
export type EnrollmentStatus = "active" | "paused" | "completed" | "bounced" | "replied" | "opted_out" | "failed";
export type EmailStatus = "draft" | "queued" | "processing" | "sent_mock" | "sent" | "failed" | "bounced";
export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped" | "cancelled";
export type CallOutcome = "no_answer" | "voicemail" | "connected" | "interested" | "not_interested" | "callback" | "wrong_number";
export type QueueItemStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";
export type DomainStatus = "pending" | "verified" | "failed";
export type DnsRecordStatus = "pending" | "pass" | "fail";
export type MailboxProviderType = "google" | "microsoft" | "smtp" | "other";
export type ConnectionStatus = "active" | "disconnected" | "warming" | "error";
export type WarmupStatus = "off" | "active" | "paused" | "complete";
export type SendingHealth = "unknown" | "good" | "warning" | "poor";

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
      sequences: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          status: SequenceStatus;
          owner_id: string | null;
          schedule_config: Json | null;
          max_enrollments: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          status?: SequenceStatus;
          owner_id?: string | null;
          schedule_config?: Json | null;
          max_enrollments?: number | null;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: SequenceStatus;
          owner_id?: string | null;
          schedule_config?: Json | null;
          max_enrollments?: number | null;
          updated_at?: string;
        };
      };
      sequence_steps: {
        Row: {
          id: string;
          sequence_id: string;
          step_order: number;
          step_type: string;
          label: string;
          delay_days: number;
          delay_hours: number;
          email_subject: string | null;
          email_body: string | null;
          task_instructions: string | null;
          call_instructions: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sequence_id: string;
          step_order: number;
          step_type: string;
          label?: string;
          delay_days?: number;
          delay_hours?: number;
          email_subject?: string | null;
          email_body?: string | null;
          task_instructions?: string | null;
          call_instructions?: string | null;
          is_active?: boolean;
        };
        Update: {
          step_order?: number;
          step_type?: string;
          label?: string;
          delay_days?: number;
          delay_hours?: number;
          email_subject?: string | null;
          email_body?: string | null;
          task_instructions?: string | null;
          call_instructions?: string | null;
          is_active?: boolean;
        };
      };
      sequence_enrollments: {
        Row: {
          id: string;
          sequence_id: string;
          contact_id: string;
          status: EnrollmentStatus;
          current_step_order: number;
          next_step_at: string | null;
          enrolled_by: string | null;
          enrolled_at: string;
          completed_at: string | null;
          paused_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sequence_id: string;
          contact_id: string;
          status?: EnrollmentStatus;
          current_step_order?: number;
          next_step_at?: string | null;
          enrolled_by?: string | null;
        };
        Update: {
          status?: EnrollmentStatus;
          current_step_order?: number;
          next_step_at?: string | null;
          completed_at?: string | null;
          paused_at?: string | null;
          updated_at?: string;
        };
      };
      emails: {
        Row: {
          id: string;
          subject: string;
          body_html: string | null;
          body_text: string | null;
          from_address: string | null;
          to_address: string;
          cc: string | null;
          bcc: string | null;
          status: EmailStatus;
          contact_id: string | null;
          company_id: string | null;
          sequence_id: string | null;
          sequence_step_id: string | null;
          enrollment_id: string | null;
          owner_id: string | null;
          scheduled_at: string | null;
          sent_at: string | null;
          opened_at: string | null;
          clicked_at: string | null;
          replied_at: string | null;
          bounced_at: string | null;
          error_message: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subject?: string;
          body_html?: string | null;
          body_text?: string | null;
          from_address?: string | null;
          to_address: string;
          cc?: string | null;
          bcc?: string | null;
          status?: EmailStatus;
          contact_id?: string | null;
          company_id?: string | null;
          sequence_id?: string | null;
          sequence_step_id?: string | null;
          enrollment_id?: string | null;
          owner_id?: string | null;
          scheduled_at?: string | null;
        };
        Update: {
          subject?: string;
          body_html?: string | null;
          status?: EmailStatus;
          sent_at?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          replied_at?: string | null;
          bounced_at?: string | null;
          error_message?: string | null;
          updated_at?: string;
        };
      };
      email_events: {
        Row: {
          id: string;
          email_id: string;
          event_type: string;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email_id: string;
          event_type: string;
          details?: Json | null;
        };
        Update: {};
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          task_type: string;
          status: TaskStatus;
          priority: string;
          due_date: string | null;
          completed_at: string | null;
          contact_id: string | null;
          company_id: string | null;
          sequence_id: string | null;
          sequence_step_id: string | null;
          enrollment_id: string | null;
          owner_id: string | null;
          assigned_to: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          task_type?: string;
          status?: TaskStatus;
          priority?: string;
          due_date?: string | null;
          contact_id?: string | null;
          company_id?: string | null;
          sequence_id?: string | null;
          sequence_step_id?: string | null;
          enrollment_id?: string | null;
          owner_id?: string | null;
          assigned_to?: string | null;
          created_by?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          task_type?: string;
          status?: TaskStatus;
          priority?: string;
          due_date?: string | null;
          completed_at?: string | null;
          assigned_to?: string | null;
          updated_at?: string;
        };
      };
      calls: {
        Row: {
          id: string;
          direction: string;
          outcome: CallOutcome | null;
          duration_seconds: number | null;
          notes: string | null;
          phone_number: string | null;
          scheduled_at: string | null;
          started_at: string | null;
          ended_at: string | null;
          contact_id: string | null;
          company_id: string | null;
          sequence_id: string | null;
          sequence_step_id: string | null;
          enrollment_id: string | null;
          owner_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          direction?: string;
          outcome?: CallOutcome | null;
          duration_seconds?: number | null;
          notes?: string | null;
          phone_number?: string | null;
          scheduled_at?: string | null;
          contact_id?: string | null;
          company_id?: string | null;
          sequence_id?: string | null;
          sequence_step_id?: string | null;
          enrollment_id?: string | null;
          owner_id?: string | null;
          created_by?: string | null;
        };
        Update: {
          direction?: string;
          outcome?: CallOutcome | null;
          duration_seconds?: number | null;
          notes?: string | null;
          ended_at?: string | null;
          updated_at?: string;
        };
      };
      message_queue: {
        Row: {
          id: string;
          queue_type: string;
          status: QueueItemStatus;
          priority: number;
          payload: Json;
          reference_id: string | null;
          reference_type: string | null;
          sequence_id: string | null;
          enrollment_id: string | null;
          scheduled_for: string;
          started_at: string | null;
          completed_at: string | null;
          attempts: number;
          max_attempts: number;
          last_error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          queue_type: string;
          status?: QueueItemStatus;
          priority?: number;
          payload: Json;
          reference_id?: string | null;
          reference_type?: string | null;
          sequence_id?: string | null;
          enrollment_id?: string | null;
          scheduled_for?: string;
        };
        Update: {
          status?: QueueItemStatus;
          started_at?: string | null;
          completed_at?: string | null;
          attempts?: number;
          last_error?: string | null;
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
      sequence_status: SequenceStatus;
      enrollment_status: EnrollmentStatus;
      email_status: EmailStatus;
      task_status: TaskStatus;
      call_outcome: CallOutcome;
      queue_item_status: QueueItemStatus;
      domain_status: DomainStatus;
      dns_record_status: DnsRecordStatus;
      mailbox_provider_type: MailboxProviderType;
      connection_status: ConnectionStatus;
      warmup_status: WarmupStatus;
      sending_health: SendingHealth;
    };
  };
};
