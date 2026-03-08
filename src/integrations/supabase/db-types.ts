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
export type DealStatus = "open" | "won" | "lost" | "abandoned";
export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type CampaignContactStatus = "pending" | "sent" | "replied" | "bounced" | "opted_out" | "meeting_booked";
export type InboxThreadStatus = "open" | "snoozed" | "closed" | "archived";
export type MeetingStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type CampaignStepType = "email" | "linkedin_connect" | "linkedin_message" | "task" | "delay";
export type CampaignEnrollmentStatus = "pending" | "active" | "completed" | "stopped";
export type CampaignStepExecutionStatus = "scheduled" | "completed" | "skipped" | "failed";
export type ActivityType =
  | "email_sent" | "email_opened" | "email_clicked" | "email_replied" | "email_bounced"
  | "call_made" | "call_received"
  | "meeting_scheduled" | "meeting_completed" | "meeting_cancelled"
  | "task_created" | "task_completed"
  | "deal_created" | "deal_stage_changed" | "deal_won" | "deal_lost"
  | "note_added"
  | "contact_created" | "contact_updated" | "contact_merged"
  | "company_created" | "company_updated"
  | "sequence_enrolled" | "sequence_completed" | "sequence_replied"
  | "list_added" | "list_removed"
  | "field_changed"
  | "custom";
export type StepType = "email" | "call" | "task" | "linkedin" | "delay" | "sms";
export type LinkedinAction = "connect" | "message" | "view_profile" | "endorse" | "interact";
export type ForecastCategory = "pipeline" | "best_case" | "commit" | "closed" | "omitted";
export type AttributionType = "first_touch" | "last_touch" | "multi_touch";

export type Database = {
  public: {
    Tables: {
      // ============================================================
      // WORKSPACE TABLES
      // ============================================================
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          settings: Json | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          settings?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          logo_url?: string | null;
          settings?: Json | null;
          updated_at?: string;
        };
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: AppRole;
          invited_by: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: AppRole;
          invited_by?: string | null;
          joined_at?: string;
        };
        Update: {
          role?: AppRole;
          invited_by?: string | null;
        };
      };
      // ============================================================
      // CORE CRM
      // ============================================================
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
          workspace_id: string | null;
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
          // Enrichment fields (migration 1)
          founded_year: number | null;
          company_type: string | null;
          headquarters: string | null;
          postal_code: string | null;
          timezone: string | null;
          stock_ticker: string | null;
          parent_company_id: string | null;
          sic_code: string | null;
          naics_code: string | null;
          specialties: string[] | null;
          last_enriched_at: string | null;
          enrichment_source: string | null;
          custom_fields: Json | null;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
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
          founded_year?: number | null;
          company_type?: string | null;
          headquarters?: string | null;
          postal_code?: string | null;
          timezone?: string | null;
          stock_ticker?: string | null;
          parent_company_id?: string | null;
          sic_code?: string | null;
          naics_code?: string | null;
          specialties?: string[] | null;
          last_enriched_at?: string | null;
          enrichment_source?: string | null;
          custom_fields?: Json | null;
        };
        Update: {
          id?: string;
          workspace_id?: string | null;
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
          founded_year?: number | null;
          company_type?: string | null;
          headquarters?: string | null;
          postal_code?: string | null;
          timezone?: string | null;
          stock_ticker?: string | null;
          parent_company_id?: string | null;
          sic_code?: string | null;
          naics_code?: string | null;
          specialties?: string[] | null;
          last_enriched_at?: string | null;
          enrichment_source?: string | null;
          custom_fields?: Json | null;
        };
      };
      contacts: {
        Row: {
          id: string;
          workspace_id: string | null;
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
          // Enrichment fields (migration 1)
          personal_email: string | null;
          twitter_url: string | null;
          facebook_url: string | null;
          github_url: string | null;
          address: string | null;
          postal_code: string | null;
          timezone: string | null;
          languages: string[] | null;
          headline: string | null;
          bio: string | null;
          photo_url: string | null;
          years_experience: number | null;
          education: Json | null;
          work_history: Json | null;
          skills: string[] | null;
          last_enriched_at: string | null;
          enrichment_source: string | null;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
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
          personal_email?: string | null;
          twitter_url?: string | null;
          facebook_url?: string | null;
          github_url?: string | null;
          address?: string | null;
          postal_code?: string | null;
          timezone?: string | null;
          languages?: string[] | null;
          headline?: string | null;
          bio?: string | null;
          photo_url?: string | null;
          years_experience?: number | null;
          education?: Json | null;
          work_history?: Json | null;
          skills?: string[] | null;
          last_enriched_at?: string | null;
          enrichment_source?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string | null;
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
          personal_email?: string | null;
          twitter_url?: string | null;
          facebook_url?: string | null;
          github_url?: string | null;
          address?: string | null;
          postal_code?: string | null;
          timezone?: string | null;
          languages?: string[] | null;
          headline?: string | null;
          bio?: string | null;
          photo_url?: string | null;
          years_experience?: number | null;
          education?: Json | null;
          work_history?: Json | null;
          skills?: string[] | null;
          last_enriched_at?: string | null;
          enrichment_source?: string | null;
        };
      };
      // ============================================================
      // DEALS
      // ============================================================
      deals: {
        Row: {
          id: string;
          workspace_id: string | null;
          name: string;
          description: string | null;
          status: DealStatus;
          pipeline_id: string | null;
          stage_id: string | null;
          amount: number | null;
          currency: string;
          probability: number;
          expected_close_date: string | null;
          actual_close_date: string | null;
          weighted_value: number | null;
          contact_id: string | null;
          company_id: string | null;
          owner_id: string | null;
          forecast_category: ForecastCategory | null;
          loss_reason: string | null;
          win_reason: string | null;
          notes: string | null;
          custom_fields: Json | null;
          tags: string[] | null;
          source: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          name: string;
          description?: string | null;
          status?: DealStatus;
          pipeline_id?: string | null;
          stage_id?: string | null;
          amount?: number | null;
          currency?: string;
          probability?: number;
          expected_close_date?: string | null;
          contact_id?: string | null;
          company_id?: string | null;
          owner_id?: string | null;
          forecast_category?: ForecastCategory | null;
          loss_reason?: string | null;
          win_reason?: string | null;
          notes?: string | null;
          custom_fields?: Json | null;
          tags?: string[] | null;
          source?: string | null;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: DealStatus;
          pipeline_id?: string | null;
          stage_id?: string | null;
          amount?: number | null;
          currency?: string;
          probability?: number;
          expected_close_date?: string | null;
          actual_close_date?: string | null;
          contact_id?: string | null;
          company_id?: string | null;
          owner_id?: string | null;
          forecast_category?: ForecastCategory | null;
          loss_reason?: string | null;
          win_reason?: string | null;
          notes?: string | null;
          custom_fields?: Json | null;
          tags?: string[] | null;
          source?: string | null;
          updated_at?: string;
        };
      };
      deal_contacts: {
        Row: { deal_id: string; contact_id: string; role: string; created_at: string };
        Insert: { deal_id: string; contact_id: string; role?: string; created_at?: string };
        Update: { role?: string };
      };
      deal_stage_history: {
        Row: {
          id: string;
          deal_id: string;
          from_stage_id: string | null;
          to_stage_id: string;
          changed_by: string | null;
          changed_at: string;
          duration_in_prev_stage: string | null;
        };
        Insert: {
          id?: string;
          deal_id: string;
          from_stage_id?: string | null;
          to_stage_id: string;
          changed_by?: string | null;
          duration_in_prev_stage?: string | null;
        };
        Update: {};
      };
      // ============================================================
      // MEETINGS
      // ============================================================
      meetings: {
        Row: {
          id: string;
          workspace_id: string | null;
          title: string;
          description: string | null;
          meeting_type: string;
          status: MeetingStatus;
          location: string | null;
          meeting_url: string | null;
          start_time: string;
          end_time: string;
          duration_minutes: number | null;
          contact_id: string | null;
          company_id: string | null;
          deal_id: string | null;
          organizer_id: string | null;
          attendee_ids: string[] | null;
          external_attendees: Json | null;
          agenda: string | null;
          notes: string | null;
          outcome: string | null;
          next_steps: string | null;
          owner_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          title: string;
          description?: string | null;
          meeting_type?: string;
          status?: MeetingStatus;
          location?: string | null;
          meeting_url?: string | null;
          start_time: string;
          end_time: string;
          contact_id?: string | null;
          company_id?: string | null;
          deal_id?: string | null;
          organizer_id?: string | null;
          attendee_ids?: string[] | null;
          external_attendees?: Json | null;
          agenda?: string | null;
          notes?: string | null;
          outcome?: string | null;
          next_steps?: string | null;
          owner_id?: string | null;
          created_by?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          meeting_type?: string;
          status?: MeetingStatus;
          location?: string | null;
          meeting_url?: string | null;
          start_time?: string;
          end_time?: string;
          contact_id?: string | null;
          company_id?: string | null;
          deal_id?: string | null;
          organizer_id?: string | null;
          attendee_ids?: string[] | null;
          external_attendees?: Json | null;
          agenda?: string | null;
          notes?: string | null;
          outcome?: string | null;
          next_steps?: string | null;
          owner_id?: string | null;
          updated_at?: string;
        };
      };
      // ============================================================
      // PIPELINES
      // ============================================================
      pipelines: {
        Row: {
          id: string;
          workspace_id: string | null;
          entity_type: "contact" | "company" | "deal";
          name: string;
          description: string | null;
          is_default: boolean;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          entity_type: "contact" | "company" | "deal";
          name: string;
          description?: string | null;
          is_default?: boolean;
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_default?: boolean;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      // ============================================================
      // ACTIVITIES (unified timeline)
      // ============================================================
      activities: {
        Row: {
          id: string;
          workspace_id: string | null;
          activity_type: ActivityType;
          contact_id: string | null;
          company_id: string | null;
          deal_id: string | null;
          source_type: string | null;
          source_id: string | null;
          title: string;
          description: string | null;
          metadata: Json | null;
          performed_by: string | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          activity_type: ActivityType;
          contact_id?: string | null;
          company_id?: string | null;
          deal_id?: string | null;
          source_type?: string | null;
          source_id?: string | null;
          title: string;
          description?: string | null;
          metadata?: Json | null;
          performed_by?: string | null;
          occurred_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          metadata?: Json | null;
        };
      };
      // ============================================================
      // EXISTING TABLES (preserved with additions)
      // ============================================================
      tags: {
        Row: {
          id: string;
          workspace_id: string | null;
          name: string;
          color: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          name: string;
          color?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string | null;
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
          workspace_id: string | null;
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
          workspace_id?: string | null;
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
          workspace_id?: string | null;
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
          workspace_id: string | null;
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
          workspace_id?: string | null;
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
          workspace_id?: string | null;
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
          workspace_id: string | null;
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
          workspace_id?: string | null;
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
          workspace_id?: string | null;
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
          workspace_id: string | null;
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
          workspace_id?: string | null;
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
          workspace_id: string | null;
          pipeline_id: string | null;
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
          default_probability: number;
          forecast_category: ForecastCategory | null;
          rotting_days: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          pipeline_id?: string | null;
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
          default_probability?: number;
          forecast_category?: ForecastCategory | null;
          rotting_days?: number | null;
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
          default_probability?: number;
          forecast_category?: ForecastCategory | null;
          rotting_days?: number | null;
        };
      };
      global_picklists: {
        Row: {
          id: string;
          workspace_id: string | null;
          name: string;
          description: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
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
          workspace_id: string | null;
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
          workspace_id?: string | null;
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
      // ============================================================
      // ENGAGE MODULE
      // ============================================================
      sequences: {
        Row: {
          id: string;
          workspace_id: string | null;
          name: string;
          description: string | null;
          status: SequenceStatus;
          owner_id: string | null;
          schedule_config: Json | null;
          max_enrollments: number | null;
          exit_conditions: Json | null;
          tags: string[] | null;
          shared_with: string[] | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          name: string;
          description?: string | null;
          status?: SequenceStatus;
          owner_id?: string | null;
          schedule_config?: Json | null;
          max_enrollments?: number | null;
          exit_conditions?: Json | null;
          tags?: string[] | null;
          shared_with?: string[] | null;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: SequenceStatus;
          owner_id?: string | null;
          schedule_config?: Json | null;
          max_enrollments?: number | null;
          exit_conditions?: Json | null;
          tags?: string[] | null;
          shared_with?: string[] | null;
          updated_at?: string;
        };
      };
      sequence_steps: {
        Row: {
          id: string;
          sequence_id: string;
          step_order: number;
          step_type: StepType;
          label: string;
          delay_days: number;
          delay_hours: number;
          email_subject: string | null;
          email_body: string | null;
          task_instructions: string | null;
          call_instructions: string | null;
          linkedin_action: LinkedinAction | null;
          linkedin_message: string | null;
          sms_body: string | null;
          variable_template: Json | null;
          conditions: Json | null;
          ab_variant: "A" | "B" | "C" | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sequence_id: string;
          step_order: number;
          step_type: StepType;
          label?: string;
          delay_days?: number;
          delay_hours?: number;
          email_subject?: string | null;
          email_body?: string | null;
          task_instructions?: string | null;
          call_instructions?: string | null;
          linkedin_action?: LinkedinAction | null;
          linkedin_message?: string | null;
          sms_body?: string | null;
          variable_template?: Json | null;
          conditions?: Json | null;
          ab_variant?: "A" | "B" | "C" | null;
          is_active?: boolean;
        };
        Update: {
          step_order?: number;
          step_type?: StepType;
          label?: string;
          delay_days?: number;
          delay_hours?: number;
          email_subject?: string | null;
          email_body?: string | null;
          task_instructions?: string | null;
          call_instructions?: string | null;
          linkedin_action?: LinkedinAction | null;
          linkedin_message?: string | null;
          sms_body?: string | null;
          variable_template?: Json | null;
          conditions?: Json | null;
          ab_variant?: "A" | "B" | "C" | null;
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
          exit_reason: string | null;
          last_activity_at: string | null;
          metadata: Json | null;
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
          exit_reason?: string | null;
          metadata?: Json | null;
        };
        Update: {
          status?: EnrollmentStatus;
          current_step_order?: number;
          next_step_at?: string | null;
          completed_at?: string | null;
          paused_at?: string | null;
          exit_reason?: string | null;
          last_activity_at?: string | null;
          metadata?: Json | null;
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
          mailbox_id: string | null;
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
          mailbox_id?: string | null;
          owner_id?: string | null;
          scheduled_at?: string | null;
        };
        Update: {
          subject?: string;
          body_html?: string | null;
          status?: EmailStatus;
          mailbox_id?: string | null;
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
          mailbox_id: string | null;
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
          mailbox_id?: string | null;
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
      // ============================================================
      // DELIVERABILITY
      // ============================================================
      sending_domains: {
        Row: {
          id: string;
          domain_name: string;
          status: DomainStatus;
          spf_status: DnsRecordStatus;
          dkim_status: DnsRecordStatus;
          dmarc_status: DnsRecordStatus;
          warmup_enabled: boolean;
          warmup_progress: number;
          daily_sending_limit: number;
          sending_health: SendingHealth;
          verification_details: Json | null;
          notes: string | null;
          owner_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          domain_name: string;
          status?: DomainStatus;
          spf_status?: DnsRecordStatus;
          dkim_status?: DnsRecordStatus;
          dmarc_status?: DnsRecordStatus;
          warmup_enabled?: boolean;
          warmup_progress?: number;
          daily_sending_limit?: number;
          sending_health?: SendingHealth;
          verification_details?: Json | null;
          notes?: string | null;
          owner_id?: string | null;
          created_by?: string | null;
        };
        Update: {
          domain_name?: string;
          status?: DomainStatus;
          spf_status?: DnsRecordStatus;
          dkim_status?: DnsRecordStatus;
          dmarc_status?: DnsRecordStatus;
          warmup_enabled?: boolean;
          warmup_progress?: number;
          daily_sending_limit?: number;
          sending_health?: SendingHealth;
          verification_details?: Json | null;
          notes?: string | null;
          owner_id?: string | null;
          updated_at?: string;
        };
      };
      mailboxes: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          domain_id: string | null;
          provider_type: MailboxProviderType;
          smtp_host: string | null;
          smtp_port: number;
          smtp_username: string | null;
          smtp_secure: boolean;
          imap_host: string | null;
          imap_port: number;
          imap_username: string | null;
          imap_secure: boolean;
          connection_status: ConnectionStatus;
          warmup_enabled: boolean;
          warmup_progress: number;
          sending_health: SendingHealth;
          daily_sending_limit: number;
          emails_sent_today: number;
          last_checked_at: string | null;
          notes: string | null;
          owner_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          display_name?: string | null;
          domain_id?: string | null;
          provider_type?: MailboxProviderType;
          smtp_host?: string | null;
          smtp_port?: number;
          smtp_username?: string | null;
          smtp_secure?: boolean;
          imap_host?: string | null;
          imap_port?: number;
          imap_username?: string | null;
          imap_secure?: boolean;
          connection_status?: ConnectionStatus;
          warmup_enabled?: boolean;
          warmup_progress?: number;
          sending_health?: SendingHealth;
          daily_sending_limit?: number;
          emails_sent_today?: number;
          last_checked_at?: string | null;
          notes?: string | null;
          owner_id?: string | null;
          created_by?: string | null;
        };
        Update: {
          email?: string;
          display_name?: string | null;
          domain_id?: string | null;
          provider_type?: MailboxProviderType;
          smtp_host?: string | null;
          smtp_port?: number;
          smtp_username?: string | null;
          smtp_secure?: boolean;
          imap_host?: string | null;
          imap_port?: number;
          imap_username?: string | null;
          imap_secure?: boolean;
          connection_status?: ConnectionStatus;
          warmup_enabled?: boolean;
          warmup_progress?: number;
          sending_health?: SendingHealth;
          daily_sending_limit?: number;
          emails_sent_today?: number;
          last_checked_at?: string | null;
          notes?: string | null;
          owner_id?: string | null;
          updated_at?: string;
        };
      };
      sending_daily_counts: {
        Row: {
          id: string;
          mailbox_id: string;
          send_date: string;
          count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          mailbox_id: string;
          send_date?: string;
          count?: number;
        };
        Update: {
          count?: number;
        };
      };
      // ============================================================
      // OUTBOUND ARCHITECTURE TABLES
      // ============================================================
      email_providers: {
        Row: { id: string; provider_name: string; auth_type: string; api_endpoint: string | null; is_active: boolean; created_at: string; };
        Insert: { id?: string; provider_name: string; auth_type?: string; api_endpoint?: string | null; is_active?: boolean; };
        Update: { provider_name?: string; auth_type?: string; api_endpoint?: string | null; is_active?: boolean; };
      };
      email_templates: {
        Row: { id: string; workspace_id: string | null; name: string; subject: string | null; body: string | null; variables: Json; is_active: boolean; created_by: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; workspace_id?: string | null; name: string; subject?: string | null; body?: string | null; variables?: Json; is_active?: boolean; created_by?: string | null; };
        Update: { name?: string; subject?: string | null; body?: string | null; variables?: Json; is_active?: boolean; updated_at?: string; };
      };
      email_variants: {
        Row: { id: string; template_id: string; variant_name: string; subject: string | null; body: string | null; sent_count: number; reply_count: number; open_count: number; click_count: number; created_at: string; };
        Insert: { id?: string; template_id: string; variant_name?: string; subject?: string | null; body?: string | null; };
        Update: { variant_name?: string; subject?: string | null; body?: string | null; sent_count?: number; reply_count?: number; open_count?: number; click_count?: number; };
      };
      campaigns: {
        Row: { id: string; workspace_id: string | null; name: string; status: CampaignStatus; owner_id: string | null; daily_limit: number; min_wait_minutes: number; random_wait_minutes: number; max_new_leads_per_day: number; stop_on_reply: boolean; stop_on_auto_reply: boolean; template_id: string | null; description: string | null; created_by: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; workspace_id?: string | null; name: string; status?: CampaignStatus; owner_id?: string | null; daily_limit?: number; min_wait_minutes?: number; random_wait_minutes?: number; max_new_leads_per_day?: number; stop_on_reply?: boolean; stop_on_auto_reply?: boolean; template_id?: string | null; description?: string | null; created_by?: string | null; };
        Update: { name?: string; status?: CampaignStatus; owner_id?: string | null; daily_limit?: number; min_wait_minutes?: number; random_wait_minutes?: number; max_new_leads_per_day?: number; stop_on_reply?: boolean; stop_on_auto_reply?: boolean; template_id?: string | null; description?: string | null; updated_at?: string; };
      };
      campaign_contacts: {
        Row: { id: string; campaign_id: string; contact_id: string; status: CampaignContactStatus; sent_count: number; last_sent_at: string | null; reply_status: string | null; meeting_booked: boolean; deal_id: string | null; created_at: string; };
        Insert: { id?: string; campaign_id: string; contact_id: string; status?: CampaignContactStatus; sent_count?: number; last_sent_at?: string | null; reply_status?: string | null; meeting_booked?: boolean; deal_id?: string | null; };
        Update: { status?: CampaignContactStatus; sent_count?: number; last_sent_at?: string | null; reply_status?: string | null; meeting_booked?: boolean; deal_id?: string | null; };
      };
      campaign_mailboxes: {
        Row: { campaign_id: string; mailbox_id: string; created_at: string; };
        Insert: { campaign_id: string; mailbox_id: string; };
        Update: {};
      };
      mailbox_health: {
        Row: { id: string; mailbox_id: string; bounce_rate: number; reply_rate: number; open_rate: number; sent_last_7_days: number; sent_last_30_days: number; health_score: number; last_health_update: string; };
        Insert: { id?: string; mailbox_id: string; bounce_rate?: number; reply_rate?: number; open_rate?: number; sent_last_7_days?: number; sent_last_30_days?: number; health_score?: number; };
        Update: { bounce_rate?: number; reply_rate?: number; open_rate?: number; sent_last_7_days?: number; sent_last_30_days?: number; health_score?: number; last_health_update?: string; };
      };
      mailbox_warmup_settings: {
        Row: { id: string; mailbox_id: string; warmup_enabled: boolean; daily_warmup_limit: number; increase_per_day: number; reply_rate_target: number; open_rate_target: number; spam_protection_rate: number; read_emulation: boolean; weekdays_only: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; mailbox_id: string; warmup_enabled?: boolean; daily_warmup_limit?: number; increase_per_day?: number; reply_rate_target?: number; open_rate_target?: number; spam_protection_rate?: number; read_emulation?: boolean; weekdays_only?: boolean; };
        Update: { warmup_enabled?: boolean; daily_warmup_limit?: number; increase_per_day?: number; reply_rate_target?: number; open_rate_target?: number; spam_protection_rate?: number; read_emulation?: boolean; weekdays_only?: boolean; updated_at?: string; };
      };
      sending_windows: {
        Row: { id: string; workspace_id: string | null; name: string; start_hour: number; end_hour: number; timezone: string; weekdays_only: boolean; is_active: boolean; created_at: string; };
        Insert: { id?: string; workspace_id?: string | null; name?: string; start_hour?: number; end_hour?: number; timezone?: string; weekdays_only?: boolean; is_active?: boolean; };
        Update: { name?: string; start_hour?: number; end_hour?: number; timezone?: string; weekdays_only?: boolean; is_active?: boolean; };
      };
      esp_routing_rules: {
        Row: { id: string; workspace_id: string | null; recipient_provider: string; preferred_mailbox_provider: string; priority: number; is_active: boolean; created_at: string; };
        Insert: { id?: string; workspace_id?: string | null; recipient_provider: string; preferred_mailbox_provider: string; priority?: number; is_active?: boolean; };
        Update: { recipient_provider?: string; preferred_mailbox_provider?: string; priority?: number; is_active?: boolean; };
      };
      email_bounces: {
        Row: { id: string; email_id: string | null; mailbox_id: string | null; bounce_type: string; bounce_reason: string | null; smtp_code: string | null; recipient_address: string | null; created_at: string; };
        Insert: { id?: string; email_id?: string | null; mailbox_id?: string | null; bounce_type?: string; bounce_reason?: string | null; smtp_code?: string | null; recipient_address?: string | null; };
        Update: { bounce_type?: string; bounce_reason?: string | null; smtp_code?: string | null; };
      };
      domain_send_limits: {
        Row: { id: string; workspace_id: string | null; domain: string; max_per_day: number; sent_today: number; sent_last_30_days: number; last_reset_at: string; created_at: string; };
        Insert: { id?: string; workspace_id?: string | null; domain: string; max_per_day?: number; sent_today?: number; sent_last_30_days?: number; };
        Update: { domain?: string; max_per_day?: number; sent_today?: number; sent_last_30_days?: number; last_reset_at?: string; };
      };
      contact_suppression: {
        Row: { id: string; workspace_id: string | null; contact_id: string | null; reason: string; suppressed_by: string | null; created_at: string; };
        Insert: { id?: string; workspace_id?: string | null; contact_id?: string | null; reason?: string; suppressed_by?: string | null; };
        Update: { reason?: string; };
      };
      domain_suppression: {
        Row: { id: string; workspace_id: string | null; domain: string; reason: string; suppressed_by: string | null; created_at: string; };
        Insert: { id?: string; workspace_id?: string | null; domain: string; reason?: string; suppressed_by?: string | null; };
        Update: { reason?: string; };
      };
      campaign_stats: {
        Row: { id: string; campaign_id: string; emails_sent: number; emails_opened: number; emails_clicked: number; replies: number; bounces: number; meetings: number; deals: number; revenue: number; last_updated_at: string; };
        Insert: { id?: string; campaign_id: string; emails_sent?: number; emails_opened?: number; emails_clicked?: number; replies?: number; bounces?: number; meetings?: number; deals?: number; revenue?: number; };
        Update: { emails_sent?: number; emails_opened?: number; emails_clicked?: number; replies?: number; bounces?: number; meetings?: number; deals?: number; revenue?: number; last_updated_at?: string; };
      };
      inbox_threads: {
        Row: { id: string; thread_id: string | null; contact_id: string | null; mailbox_id: string | null; campaign_id: string | null; workspace_id: string | null; subject: string | null; status: InboxThreadStatus; last_message_at: string; message_count: number; assigned_to: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; thread_id?: string | null; contact_id?: string | null; mailbox_id?: string | null; campaign_id?: string | null; workspace_id?: string | null; subject?: string | null; status?: InboxThreadStatus; message_count?: number; assigned_to?: string | null; };
        Update: { subject?: string | null; status?: InboxThreadStatus; last_message_at?: string; message_count?: number; assigned_to?: string | null; updated_at?: string; };
      };
      inbox_messages: {
        Row: { id: string; thread_id: string; direction: string; from_address: string | null; to_address: string | null; subject: string | null; body_text: string | null; body_html: string | null; timestamp: string; email_id: string | null; created_at: string; };
        Insert: { id?: string; thread_id: string; direction?: string; from_address?: string | null; to_address?: string | null; subject?: string | null; body_text?: string | null; body_html?: string | null; email_id?: string | null; };
        Update: { direction?: string; subject?: string | null; body_text?: string | null; body_html?: string | null; };
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
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string };
        Returns: boolean;
      };
      workspace_role: {
        Args: { _user_id: string; _workspace_id: string };
        Returns: AppRole;
      };
      log_activity: {
        Args: {
          p_workspace_id: string;
          p_activity_type: ActivityType;
          p_title: string;
          p_contact_id?: string;
          p_company_id?: string;
          p_deal_id?: string;
          p_source_type?: string;
          p_source_id?: string;
          p_description?: string;
          p_metadata?: Json;
          p_performed_by?: string;
        };
        Returns: string;
      };
      increment_daily_send_count: {
        Args: { p_mailbox_id: string; p_limit: number };
        Returns: boolean;
      };
      check_mailbox_readiness: {
        Args: { p_mailbox_id: string };
        Returns: Json;
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
      deal_status: DealStatus;
      meeting_status: MeetingStatus;
      activity_type: ActivityType;
      campaign_status: CampaignStatus;
      campaign_contact_status: CampaignContactStatus;
      inbox_thread_status: InboxThreadStatus;
    };
  };
};
