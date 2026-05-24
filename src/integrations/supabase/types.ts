export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          description: string | null
          id: string
          metadata: Json | null
          occurred_at: string
          performed_by: string | null
          source_id: string | null
          source_type: string | null
          title: string
          workspace_id: string | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          performed_by?: string | null
          source_id?: string | null
          source_type?: string | null
          title: string
          workspace_id?: string | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          performed_by?: string | null
          source_id?: string | null
          source_type?: string | null
          title?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activity_feed: {
        Row: {
          event_description: string | null
          event_title: string
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string | null
          workspace_id: string | null
          workspace_name: string | null
        }
        Insert: {
          event_description?: string | null
          event_title: string
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Update: {
          event_description?: string | null
          event_title?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_feed_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_campaign_summaries: {
        Row: {
          attributed_revenue: number | null
          campaign_id: string
          campaign_name: string | null
          deals: number | null
          emails_sent: number | null
          id: string
          meetings: number | null
          replies: number | null
          revenue: number | null
          status: string | null
          updated_at: string | null
          workspace_id: string
          workspace_name: string | null
        }
        Insert: {
          attributed_revenue?: number | null
          campaign_id: string
          campaign_name?: string | null
          deals?: number | null
          emails_sent?: number | null
          id?: string
          meetings?: number | null
          replies?: number | null
          revenue?: number | null
          status?: string | null
          updated_at?: string | null
          workspace_id: string
          workspace_name?: string | null
        }
        Update: {
          attributed_revenue?: number | null
          campaign_id?: string
          campaign_name?: string | null
          deals?: number | null
          emails_sent?: number | null
          id?: string
          meetings?: number | null
          replies?: number | null
          revenue?: number | null
          status?: string | null
          updated_at?: string | null
          workspace_id?: string
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_campaign_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_linkedin_summaries: {
        Row: {
          account_name: string | null
          connection_status: string | null
          connects_sent_today: number | null
          health_score: number | null
          id: string
          last_activity_at: string | null
          linkedin_account_id: string
          messages_sent_today: number | null
          updated_at: string | null
          workspace_id: string
          workspace_name: string | null
        }
        Insert: {
          account_name?: string | null
          connection_status?: string | null
          connects_sent_today?: number | null
          health_score?: number | null
          id?: string
          last_activity_at?: string | null
          linkedin_account_id: string
          messages_sent_today?: number | null
          updated_at?: string | null
          workspace_id: string
          workspace_name?: string | null
        }
        Update: {
          account_name?: string | null
          connection_status?: string | null
          connects_sent_today?: number | null
          health_score?: number | null
          id?: string
          last_activity_at?: string | null
          linkedin_account_id?: string
          messages_sent_today?: number | null
          updated_at?: string | null
          workspace_id?: string
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_linkedin_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_mailbox_summaries: {
        Row: {
          bounce_rate: number | null
          emails_sent_7d: number | null
          health_score: number | null
          id: string
          mailbox_email: string | null
          mailbox_id: string
          provider: string | null
          reply_rate: number | null
          status: string | null
          updated_at: string | null
          workspace_id: string
          workspace_name: string | null
        }
        Insert: {
          bounce_rate?: number | null
          emails_sent_7d?: number | null
          health_score?: number | null
          id?: string
          mailbox_email?: string | null
          mailbox_id: string
          provider?: string | null
          reply_rate?: number | null
          status?: string | null
          updated_at?: string | null
          workspace_id: string
          workspace_name?: string | null
        }
        Update: {
          bounce_rate?: number | null
          emails_sent_7d?: number | null
          health_score?: number | null
          id?: string
          mailbox_email?: string | null
          mailbox_id?: string
          provider?: string | null
          reply_rate?: number | null
          status?: string | null
          updated_at?: string | null
          workspace_id?: string
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_mailbox_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_platform_kpis: {
        Row: {
          active_campaigns: number | null
          active_workspaces: number | null
          attributed_revenue: number | null
          deals_created: number | null
          emails_sent: number | null
          id: string
          meetings_booked: number | null
          replies_received: number | null
          revenue_generated: number | null
          total_campaigns: number | null
          total_companies: number | null
          total_contacts: number | null
          total_workspaces: number | null
          updated_at: string | null
        }
        Insert: {
          active_campaigns?: number | null
          active_workspaces?: number | null
          attributed_revenue?: number | null
          deals_created?: number | null
          emails_sent?: number | null
          id?: string
          meetings_booked?: number | null
          replies_received?: number | null
          revenue_generated?: number | null
          total_campaigns?: number | null
          total_companies?: number | null
          total_contacts?: number | null
          total_workspaces?: number | null
          updated_at?: string | null
        }
        Update: {
          active_campaigns?: number | null
          active_workspaces?: number | null
          attributed_revenue?: number | null
          deals_created?: number | null
          emails_sent?: number | null
          id?: string
          meetings_booked?: number | null
          replies_received?: number | null
          revenue_generated?: number | null
          total_campaigns?: number | null
          total_companies?: number | null
          total_contacts?: number | null
          total_workspaces?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_workspace_summaries: {
        Row: {
          active_campaigns: number | null
          attributed_revenue: number | null
          deals_created: number | null
          emails_sent: number | null
          id: string
          last_activity_at: string | null
          meetings_booked: number | null
          member_count: number | null
          owner_email: string | null
          replies_received: number | null
          revenue_generated: number | null
          total_campaigns: number | null
          total_companies: number | null
          total_contacts: number | null
          updated_at: string | null
          workspace_id: string
          workspace_name: string
        }
        Insert: {
          active_campaigns?: number | null
          attributed_revenue?: number | null
          deals_created?: number | null
          emails_sent?: number | null
          id?: string
          last_activity_at?: string | null
          meetings_booked?: number | null
          member_count?: number | null
          owner_email?: string | null
          replies_received?: number | null
          revenue_generated?: number | null
          total_campaigns?: number | null
          total_companies?: number | null
          total_contacts?: number | null
          updated_at?: string | null
          workspace_id: string
          workspace_name: string
        }
        Update: {
          active_campaigns?: number | null
          attributed_revenue?: number | null
          deals_created?: number | null
          emails_sent?: number | null
          id?: string
          last_activity_at?: string | null
          meetings_booked?: number | null
          member_count?: number | null
          owner_email?: string | null
          replies_received?: number | null
          revenue_generated?: number | null
          total_campaigns?: number | null
          total_companies?: number | null
          total_contacts?: number | null
          updated_at?: string | null
          workspace_id?: string
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_workspace_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          prompt_type: Database["public"]["Enums"]["ai_prompt_type"]
          system_prompt: string | null
          user_prompt_template: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          prompt_type?: Database["public"]["Enums"]["ai_prompt_type"]
          system_prompt?: string | null
          user_prompt_template?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          prompt_type?: Database["public"]["Enums"]["ai_prompt_type"]
          system_prompt?: string | null
          user_prompt_template?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_emails: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      bounce_feedback: {
        Row: {
          bounce_category: Database["public"]["Enums"]["bounce_category"] | null
          bounce_type: string
          campaign_id: string | null
          diagnostic_code: string | null
          email_normalized: string
          escalated: boolean
          id: string
          mailbox_id: string | null
          provider: string | null
          raw_payload: Json | null
          received_at: string
          smtp_code: number | null
          smtp_response: string | null
          source: string
          workspace_id: string | null
        }
        Insert: {
          bounce_category?:
            | Database["public"]["Enums"]["bounce_category"]
            | null
          bounce_type?: string
          campaign_id?: string | null
          diagnostic_code?: string | null
          email_normalized: string
          escalated?: boolean
          id?: string
          mailbox_id?: string | null
          provider?: string | null
          raw_payload?: Json | null
          received_at?: string
          smtp_code?: number | null
          smtp_response?: string | null
          source?: string
          workspace_id?: string | null
        }
        Update: {
          bounce_category?:
            | Database["public"]["Enums"]["bounce_category"]
            | null
          bounce_type?: string
          campaign_id?: string | null
          diagnostic_code?: string | null
          email_normalized?: string
          escalated?: boolean
          id?: string
          mailbox_id?: string | null
          provider?: string | null
          raw_payload?: Json | null
          received_at?: string
          smtp_code?: number | null
          smtp_response?: string | null
          source?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bounce_feedback_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bounce_feedback_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bounce_feedback_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bounce_intelligence: {
        Row: {
          bounce_category: string | null
          created_at: string
          domain: string | null
          id: string
          last_seen_at: string | null
          occurrences: number | null
          provider_type: string | null
          smtp_code: number | null
        }
        Insert: {
          bounce_category?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          last_seen_at?: string | null
          occurrences?: number | null
          provider_type?: string | null
          smtp_code?: number | null
        }
        Update: {
          bounce_category?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          last_seen_at?: string | null
          occurrences?: number | null
          provider_type?: string | null
          smtp_code?: number | null
        }
        Relationships: []
      }
      calls: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          enrollment_id: string | null
          id: string
          notes: string | null
          outcome: Database["public"]["Enums"]["call_outcome"] | null
          owner_id: string | null
          phone_number: string | null
          scheduled_at: string | null
          sequence_id: string | null
          sequence_step_id: string | null
          started_at: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          enrollment_id?: string | null
          id?: string
          notes?: string | null
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          owner_id?: string | null
          phone_number?: string | null
          scheduled_at?: string | null
          sequence_id?: string | null
          sequence_step_id?: string | null
          started_at?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          enrollment_id?: string | null
          id?: string
          notes?: string | null
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          owner_id?: string | null
          phone_number?: string | null
          scheduled_at?: string | null
          sequence_id?: string | null
          sequence_step_id?: string | null
          started_at?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_sequence_step_id_fkey"
            columns: ["sequence_step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_attribution: {
        Row: {
          attributed_revenue: number | null
          attribution_type: Database["public"]["Enums"]["attribution_type"]
          campaign_id: string
          company_id: string | null
          contact_id: string
          created_at: string | null
          deal_id: string | null
          id: string
          meeting_id: string | null
          workspace_id: string | null
        }
        Insert: {
          attributed_revenue?: number | null
          attribution_type?: Database["public"]["Enums"]["attribution_type"]
          campaign_id: string
          company_id?: string | null
          contact_id: string
          created_at?: string | null
          deal_id?: string | null
          id?: string
          meeting_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          attributed_revenue?: number | null
          attribution_type?: Database["public"]["Enums"]["attribution_type"]
          campaign_id?: string
          company_id?: string | null
          contact_id?: string
          created_at?: string | null
          deal_id?: string | null
          id?: string
          meeting_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_attribution_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_attribution_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_attribution_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_attribution_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_attribution_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_attribution_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_contacts: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string | null
          deal_id: string | null
          id: string
          last_sent_at: string | null
          meeting_booked: boolean | null
          reply_status: string | null
          sent_count: number | null
          status: Database["public"]["Enums"]["campaign_contact_status"]
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string | null
          deal_id?: string | null
          id?: string
          last_sent_at?: string | null
          meeting_booked?: boolean | null
          reply_status?: string | null
          sent_count?: number | null
          status?: Database["public"]["Enums"]["campaign_contact_status"]
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string | null
          deal_id?: string | null
          id?: string
          last_sent_at?: string | null
          meeting_booked?: boolean | null
          reply_status?: string | null
          sent_count?: number | null
          status?: Database["public"]["Enums"]["campaign_contact_status"]
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_enrollments: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string | null
          current_step_id: string | null
          id: string
          last_step_executed_at: string | null
          scheduled_start: string | null
          status: Database["public"]["Enums"]["campaign_enrollment_status"]
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string | null
          current_step_id?: string | null
          id?: string
          last_step_executed_at?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["campaign_enrollment_status"]
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string | null
          current_step_id?: string | null
          id?: string
          last_step_executed_at?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["campaign_enrollment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "campaign_enrollments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "campaign_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_linkedin_accounts: {
        Row: {
          campaign_id: string
          created_at: string | null
          linkedin_account_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          linkedin_account_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          linkedin_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_linkedin_accounts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_linkedin_accounts_linkedin_account_id_fkey"
            columns: ["linkedin_account_id"]
            isOneToOne: false
            referencedRelation: "linkedin_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_mailbox_pool: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          is_active: boolean
          mailbox_id: string
          weight: number
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          mailbox_id: string
          weight?: number
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          mailbox_id?: string
          weight?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_mailbox_pool_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_mailbox_pool_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_mailboxes: {
        Row: {
          campaign_id: string
          created_at: string | null
          mailbox_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          mailbox_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          mailbox_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_mailboxes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_mailboxes_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_performance_metrics: {
        Row: {
          campaign_id: string
          created_at: string | null
          deal_rate: number | null
          deals_created: number | null
          emails_delivered: number | null
          emails_sent: number | null
          id: string
          meeting_rate: number | null
          meetings_booked: number | null
          open_rate: number | null
          positive_replies: number | null
          replies_received: number | null
          reply_rate: number | null
          revenue_generated: number | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          deal_rate?: number | null
          deals_created?: number | null
          emails_delivered?: number | null
          emails_sent?: number | null
          id?: string
          meeting_rate?: number | null
          meetings_booked?: number | null
          open_rate?: number | null
          positive_replies?: number | null
          replies_received?: number | null
          reply_rate?: number | null
          revenue_generated?: number | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          deal_rate?: number | null
          deals_created?: number | null
          emails_delivered?: number | null
          emails_sent?: number | null
          id?: string
          meeting_rate?: number | null
          meetings_booked?: number | null
          open_rate?: number | null
          positive_replies?: number | null
          replies_received?: number | null
          reply_rate?: number | null
          revenue_generated?: number | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_performance_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_performance_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_stats: {
        Row: {
          bounces: number | null
          campaign_id: string
          deals: number | null
          emails_clicked: number | null
          emails_opened: number | null
          emails_sent: number | null
          id: string
          last_updated_at: string | null
          meetings: number | null
          replies: number | null
          revenue: number | null
        }
        Insert: {
          bounces?: number | null
          campaign_id: string
          deals?: number | null
          emails_clicked?: number | null
          emails_opened?: number | null
          emails_sent?: number | null
          id?: string
          last_updated_at?: string | null
          meetings?: number | null
          replies?: number | null
          revenue?: number | null
        }
        Update: {
          bounces?: number | null
          campaign_id?: string
          deals?: number | null
          emails_clicked?: number | null
          emails_opened?: number | null
          emails_sent?: number | null
          id?: string
          last_updated_at?: string | null
          meetings?: number | null
          replies?: number | null
          revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_step_executions: {
        Row: {
          created_at: string | null
          enrollment_id: string
          executed_at: string | null
          id: string
          notes: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["campaign_step_execution_status"]
          step_id: string
        }
        Insert: {
          created_at?: string | null
          enrollment_id: string
          executed_at?: string | null
          id?: string
          notes?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["campaign_step_execution_status"]
          step_id: string
        }
        Update: {
          created_at?: string | null
          enrollment_id?: string
          executed_at?: string | null
          id?: string
          notes?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["campaign_step_execution_status"]
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_step_executions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "campaign_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_step_executions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "campaign_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_steps: {
        Row: {
          campaign_id: string
          created_at: string | null
          delay_days: number
          delay_hours: number
          email_template_id: string | null
          id: string
          linkedin_message_template_id: string | null
          step_order: number
          step_type: Database["public"]["Enums"]["campaign_step_type"]
          task_description: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          delay_days?: number
          delay_hours?: number
          email_template_id?: string | null
          id?: string
          linkedin_message_template_id?: string | null
          step_order?: number
          step_type?: Database["public"]["Enums"]["campaign_step_type"]
          task_description?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          delay_days?: number
          delay_hours?: number
          email_template_id?: string | null
          id?: string
          linkedin_message_template_id?: string | null
          step_order?: number
          step_type?: Database["public"]["Enums"]["campaign_step_type"]
          task_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_steps_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_steps_linkedin_message_template_id_fkey"
            columns: ["linkedin_message_template_id"]
            isOneToOne: false
            referencedRelation: "linkedin_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_tags: {
        Row: {
          campaign_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_tags_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ab_winning_metric: string
          active_days: Json
          allow_risky_emails: boolean
          auto_optimize_ab: boolean
          bcc: string | null
          campaign_domain_limit: number | null
          cc: string | null
          created_at: string | null
          created_by: string | null
          daily_limit: number | null
          delivery_optimization: boolean
          description: string | null
          end_at: string | null
          id: string
          insert_unsubscribe_header: boolean
          limit_emails_per_company: boolean
          max_emails_per_company_per_day: number
          max_new_leads_per_day: number | null
          min_wait_minutes: number | null
          name: string
          override_domain_limiter: boolean
          owner_id: string | null
          prioritize_new_leads: boolean
          provider_matching: boolean
          random_wait_minutes: number | null
          reply_to: string | null
          send_end_hour: number
          send_start_hour: number
          sending_window_id: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          stop_company_on_reply: boolean
          stop_on_auto_reply: boolean | null
          stop_on_click: boolean
          stop_on_reply: boolean | null
          template_id: string | null
          timezone: string
          track_clicks: boolean
          track_opens: boolean
          updated_at: string | null
          use_esp_routing: boolean
          workspace_id: string | null
        }
        Insert: {
          ab_winning_metric?: string
          active_days?: Json
          allow_risky_emails?: boolean
          auto_optimize_ab?: boolean
          bcc?: string | null
          campaign_domain_limit?: number | null
          cc?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_limit?: number | null
          delivery_optimization?: boolean
          description?: string | null
          end_at?: string | null
          id?: string
          insert_unsubscribe_header?: boolean
          limit_emails_per_company?: boolean
          max_emails_per_company_per_day?: number
          max_new_leads_per_day?: number | null
          min_wait_minutes?: number | null
          name: string
          override_domain_limiter?: boolean
          owner_id?: string | null
          prioritize_new_leads?: boolean
          provider_matching?: boolean
          random_wait_minutes?: number | null
          reply_to?: string | null
          send_end_hour?: number
          send_start_hour?: number
          sending_window_id?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          stop_company_on_reply?: boolean
          stop_on_auto_reply?: boolean | null
          stop_on_click?: boolean
          stop_on_reply?: boolean | null
          template_id?: string | null
          timezone?: string
          track_clicks?: boolean
          track_opens?: boolean
          updated_at?: string | null
          use_esp_routing?: boolean
          workspace_id?: string | null
        }
        Update: {
          ab_winning_metric?: string
          active_days?: Json
          allow_risky_emails?: boolean
          auto_optimize_ab?: boolean
          bcc?: string | null
          campaign_domain_limit?: number | null
          cc?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_limit?: number | null
          delivery_optimization?: boolean
          description?: string | null
          end_at?: string | null
          id?: string
          insert_unsubscribe_header?: boolean
          limit_emails_per_company?: boolean
          max_emails_per_company_per_day?: number
          max_new_leads_per_day?: number | null
          min_wait_minutes?: number | null
          name?: string
          override_domain_limiter?: boolean
          owner_id?: string | null
          prioritize_new_leads?: boolean
          provider_matching?: boolean
          random_wait_minutes?: number | null
          reply_to?: string | null
          send_end_hour?: number
          send_start_hour?: number
          sending_window_id?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          stop_company_on_reply?: boolean
          stop_on_auto_reply?: boolean | null
          stop_on_click?: boolean
          stop_on_reply?: boolean | null
          template_id?: string | null
          timezone?: string
          track_clicks?: boolean
          track_opens?: boolean
          updated_at?: string | null
          use_esp_routing?: boolean
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_sending_window_id_fkey"
            columns: ["sending_window_id"]
            isOneToOne: false
            referencedRelation: "sending_windows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          annual_revenue: number | null
          city: string | null
          company_address: string | null
          company_city: string | null
          company_country: string | null
          company_linkedin_url: string | null
          company_name_for_emails: string | null
          company_phone: string | null
          company_state: string | null
          company_type: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          custom_fields: Json | null
          data_quality_score: number | null
          description: string | null
          domain: string | null
          employee_count: number | null
          employee_count_by_department: Json | null
          employee_range: string | null
          enrichment_data: Json | null
          enrichment_source: string | null
          external_account_id: string | null
          facebook_url: string | null
          founded_year: number | null
          funding_stage: string | null
          headcount_growth_pct: number | null
          headquarters: string | null
          id: string
          industry: string | null
          keywords: string[] | null
          last_enriched_at: string | null
          last_raised_at: string | null
          last_verified_at: string | null
          latest_funding: string | null
          latest_funding_amount: number | null
          linkedin_url: string | null
          logo_url: string | null
          market_segments: string[] | null
          naics_code: string | null
          name: string
          news_summary: string | null
          normalized_domain: string | null
          normalized_name: string | null
          notes: string | null
          owner_id: string | null
          parent_company_id: string | null
          postal_code: string | null
          retail_location_count: number | null
          revenue_range: string | null
          sic_code: string | null
          signals: Json | null
          specialties: string[] | null
          state: string | null
          stock_ticker: string | null
          technologies: string[] | null
          territories: string[] | null
          timezone: string | null
          total_funding: number | null
          twitter_url: string | null
          updated_at: string | null
          website: string | null
          workspace_id: string | null
        }
        Insert: {
          annual_revenue?: number | null
          city?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_linkedin_url?: string | null
          company_name_for_emails?: string | null
          company_phone?: string | null
          company_state?: string | null
          company_type?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          data_quality_score?: number | null
          description?: string | null
          domain?: string | null
          employee_count?: number | null
          employee_count_by_department?: Json | null
          employee_range?: string | null
          enrichment_data?: Json | null
          enrichment_source?: string | null
          external_account_id?: string | null
          facebook_url?: string | null
          founded_year?: number | null
          funding_stage?: string | null
          headcount_growth_pct?: number | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          keywords?: string[] | null
          last_enriched_at?: string | null
          last_raised_at?: string | null
          last_verified_at?: string | null
          latest_funding?: string | null
          latest_funding_amount?: number | null
          linkedin_url?: string | null
          logo_url?: string | null
          market_segments?: string[] | null
          naics_code?: string | null
          name: string
          news_summary?: string | null
          normalized_domain?: string | null
          normalized_name?: string | null
          notes?: string | null
          owner_id?: string | null
          parent_company_id?: string | null
          postal_code?: string | null
          retail_location_count?: number | null
          revenue_range?: string | null
          sic_code?: string | null
          signals?: Json | null
          specialties?: string[] | null
          state?: string | null
          stock_ticker?: string | null
          technologies?: string[] | null
          territories?: string[] | null
          timezone?: string | null
          total_funding?: number | null
          twitter_url?: string | null
          updated_at?: string | null
          website?: string | null
          workspace_id?: string | null
        }
        Update: {
          annual_revenue?: number | null
          city?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_linkedin_url?: string | null
          company_name_for_emails?: string | null
          company_phone?: string | null
          company_state?: string | null
          company_type?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          data_quality_score?: number | null
          description?: string | null
          domain?: string | null
          employee_count?: number | null
          employee_count_by_department?: Json | null
          employee_range?: string | null
          enrichment_data?: Json | null
          enrichment_source?: string | null
          external_account_id?: string | null
          facebook_url?: string | null
          founded_year?: number | null
          funding_stage?: string | null
          headcount_growth_pct?: number | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          keywords?: string[] | null
          last_enriched_at?: string | null
          last_raised_at?: string | null
          last_verified_at?: string | null
          latest_funding?: string | null
          latest_funding_amount?: number | null
          linkedin_url?: string | null
          logo_url?: string | null
          market_segments?: string[] | null
          naics_code?: string | null
          name?: string
          news_summary?: string | null
          normalized_domain?: string | null
          normalized_name?: string | null
          notes?: string | null
          owner_id?: string | null
          parent_company_id?: string | null
          postal_code?: string | null
          retail_location_count?: number | null
          revenue_range?: string | null
          sic_code?: string | null
          signals?: Json | null
          specialties?: string[] | null
          state?: string | null
          stock_ticker?: string | null
          technologies?: string[] | null
          territories?: string[] | null
          timezone?: string | null
          total_funding?: number | null
          twitter_url?: string | null
          updated_at?: string | null
          website?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_activity_log: {
        Row: {
          action: string
          company_id: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_insights: {
        Row: {
          company_id: string
          fit_score: number | null
          id: string
          industry_score: number | null
          last_scored_at: string | null
          outreach_priority_score: number | null
        }
        Insert: {
          company_id: string
          fit_score?: number | null
          id?: string
          industry_score?: number | null
          last_scored_at?: string | null
          outreach_priority_score?: number | null
        }
        Update: {
          company_id?: string
          fit_score?: number | null
          id?: string
          industry_score?: number | null
          last_scored_at?: string | null
          outreach_priority_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_insights_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_tags: {
        Row: {
          company_id: string
          created_at: string | null
          tag_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          tag_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_activity_log: {
        Row: {
          action: string
          contact_id: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          contact_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          contact_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_activity_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_funnel_metrics: {
        Row: {
          campaign_id: string | null
          contact_id: string
          deals_created: number | null
          emails_sent: number | null
          id: string
          last_activity_at: string | null
          linkedin_actions_completed: number | null
          meetings_booked: number | null
          replies_received: number | null
          revenue_generated: number | null
          workspace_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id: string
          deals_created?: number | null
          emails_sent?: number | null
          id?: string
          last_activity_at?: string | null
          linkedin_actions_completed?: number | null
          meetings_booked?: number | null
          replies_received?: number | null
          revenue_generated?: number | null
          workspace_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string
          deals_created?: number | null
          emails_sent?: number | null
          id?: string
          last_activity_at?: string | null
          linkedin_actions_completed?: number | null
          meetings_booked?: number | null
          replies_received?: number | null
          revenue_generated?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_funnel_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_funnel_metrics_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_funnel_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_insights: {
        Row: {
          contact_id: string
          fit_score: number | null
          id: string
          last_scored_at: string | null
          personalization_score: number | null
          readiness_score: number | null
        }
        Insert: {
          contact_id: string
          fit_score?: number | null
          id?: string
          last_scored_at?: string | null
          personalization_score?: number | null
          readiness_score?: number | null
        }
        Update: {
          contact_id?: string
          fit_score?: number | null
          id?: string
          last_scored_at?: string | null
          personalization_score?: number | null
          readiness_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_insights_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_outreach_history: {
        Row: {
          campaign_id: string | null
          contact_id: string
          created_at: string | null
          emails_sent: number
          id: string
          last_contacted_at: string | null
          linkedin_actions: number
          tasks_completed: number
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id: string
          created_at?: string | null
          emails_sent?: number
          id?: string
          last_contacted_at?: string | null
          linkedin_actions?: number
          tasks_completed?: number
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string
          created_at?: string | null
          emails_sent?: number
          id?: string
          last_contacted_at?: string | null
          linkedin_actions?: number
          tasks_completed?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_outreach_history_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_outreach_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_suppression: {
        Row: {
          contact_id: string | null
          created_at: string | null
          id: string
          reason: string
          suppressed_by: string | null
          workspace_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string
          suppressed_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string
          suppressed_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_suppression_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_suppression_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string | null
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          bio: string | null
          city: string | null
          company_id: string | null
          company_name_raw: string | null
          corporate_phone: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          current_role_start_date: string | null
          custom_fields: Json | null
          data_quality_score: number | null
          department: string | null
          do_not_contact: boolean
          education: Json | null
          email: string | null
          email_confidence: number | null
          email_validity_status: Database["public"]["Enums"]["email_validity"]
          enrichment_data: Json | null
          enrichment_source: string | null
          external_contact_id: string | null
          external_source: string | null
          facebook_url: string | null
          first_name: string | null
          github_url: string | null
          headline: string | null
          home_phone: string | null
          id: string
          import_tag: string | null
          job_change_date: string | null
          job_title: string | null
          languages: string[] | null
          last_contacted_at: string | null
          last_enriched_at: string | null
          last_name: string | null
          last_verified_at: string | null
          lifecycle_status: Database["public"]["Enums"]["lifecycle_status"]
          linkedin_url: string | null
          mobile_phone: string | null
          normalized_name: string | null
          notes: string | null
          other_phone: string | null
          outreach_status: Database["public"]["Enums"]["outreach_status"]
          owner_id: string | null
          persona: string | null
          personal_email: string | null
          phone: string | null
          phone_status: Database["public"]["Enums"]["phone_status"] | null
          photo_url: string | null
          postal_code: string | null
          primary_email_source: string | null
          secondary_email: string | null
          secondary_email_source: string | null
          seniority_level: string | null
          skills: string[] | null
          source: string | null
          source_file: string | null
          state: string | null
          tertiary_email: string | null
          tertiary_email_source: string | null
          timezone: string | null
          twitter_url: string | null
          updated_at: string | null
          work_direct_phone: string | null
          work_history: Json | null
          workspace_id: string | null
          years_experience: number | null
        }
        Insert: {
          address?: string | null
          bio?: string | null
          city?: string | null
          company_id?: string | null
          company_name_raw?: string | null
          corporate_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          current_role_start_date?: string | null
          custom_fields?: Json | null
          data_quality_score?: number | null
          department?: string | null
          do_not_contact?: boolean
          education?: Json | null
          email?: string | null
          email_confidence?: number | null
          email_validity_status?: Database["public"]["Enums"]["email_validity"]
          enrichment_data?: Json | null
          enrichment_source?: string | null
          external_contact_id?: string | null
          external_source?: string | null
          facebook_url?: string | null
          first_name?: string | null
          github_url?: string | null
          headline?: string | null
          home_phone?: string | null
          id?: string
          import_tag?: string | null
          job_change_date?: string | null
          job_title?: string | null
          languages?: string[] | null
          last_contacted_at?: string | null
          last_enriched_at?: string | null
          last_name?: string | null
          last_verified_at?: string | null
          lifecycle_status?: Database["public"]["Enums"]["lifecycle_status"]
          linkedin_url?: string | null
          mobile_phone?: string | null
          normalized_name?: string | null
          notes?: string | null
          other_phone?: string | null
          outreach_status?: Database["public"]["Enums"]["outreach_status"]
          owner_id?: string | null
          persona?: string | null
          personal_email?: string | null
          phone?: string | null
          phone_status?: Database["public"]["Enums"]["phone_status"] | null
          photo_url?: string | null
          postal_code?: string | null
          primary_email_source?: string | null
          secondary_email?: string | null
          secondary_email_source?: string | null
          seniority_level?: string | null
          skills?: string[] | null
          source?: string | null
          source_file?: string | null
          state?: string | null
          tertiary_email?: string | null
          tertiary_email_source?: string | null
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          work_direct_phone?: string | null
          work_history?: Json | null
          workspace_id?: string | null
          years_experience?: number | null
        }
        Update: {
          address?: string | null
          bio?: string | null
          city?: string | null
          company_id?: string | null
          company_name_raw?: string | null
          corporate_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          current_role_start_date?: string | null
          custom_fields?: Json | null
          data_quality_score?: number | null
          department?: string | null
          do_not_contact?: boolean
          education?: Json | null
          email?: string | null
          email_confidence?: number | null
          email_validity_status?: Database["public"]["Enums"]["email_validity"]
          enrichment_data?: Json | null
          enrichment_source?: string | null
          external_contact_id?: string | null
          external_source?: string | null
          facebook_url?: string | null
          first_name?: string | null
          github_url?: string | null
          headline?: string | null
          home_phone?: string | null
          id?: string
          import_tag?: string | null
          job_change_date?: string | null
          job_title?: string | null
          languages?: string[] | null
          last_contacted_at?: string | null
          last_enriched_at?: string | null
          last_name?: string | null
          last_verified_at?: string | null
          lifecycle_status?: Database["public"]["Enums"]["lifecycle_status"]
          linkedin_url?: string | null
          mobile_phone?: string | null
          normalized_name?: string | null
          notes?: string | null
          other_phone?: string | null
          outreach_status?: Database["public"]["Enums"]["outreach_status"]
          owner_id?: string | null
          persona?: string | null
          personal_email?: string | null
          phone?: string | null
          phone_status?: Database["public"]["Enums"]["phone_status"] | null
          photo_url?: string | null
          postal_code?: string | null
          primary_email_source?: string | null
          secondary_email?: string | null
          secondary_email_source?: string | null
          seniority_level?: string | null
          skills?: string[] | null
          source?: string | null
          source_file?: string | null
          state?: string | null
          tertiary_email?: string | null
          tertiary_email_source?: string | null
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          work_direct_phone?: string | null
          work_history?: Json | null
          workspace_id?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          created_at: string | null
          created_by: string | null
          default_value: string | null
          description: string | null
          display_order: number | null
          entity_type: string
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_active: boolean | null
          is_required: boolean | null
          picklist_id: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          default_value?: string | null
          description?: string | null
          display_order?: number | null
          entity_type: string
          field_label: string
          field_name: string
          field_type: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          picklist_id?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          default_value?: string | null
          description?: string | null
          display_order?: number | null
          entity_type?: string
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          picklist_id?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_picklist_id_fkey"
            columns: ["picklist_id"]
            isOneToOne: false
            referencedRelation: "global_picklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_fields_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_contacts: {
        Row: {
          contact_id: string
          created_at: string | null
          deal_id: string
          role: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          deal_id: string
          role?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          deal_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          deal_id: string
          duration_in_prev_stage: string | null
          from_stage_id: string | null
          id: string
          to_stage_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          deal_id: string
          duration_in_prev_stage?: string | null
          from_stage_id?: string | null
          id?: string
          to_stage_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          deal_id?: string
          duration_in_prev_stage?: string | null
          from_stage_id?: string | null
          id?: string
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          actual_close_date: string | null
          amount: number | null
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          custom_fields: Json | null
          description: string | null
          expected_close_date: string | null
          forecast_category: string | null
          id: string
          loss_reason: string | null
          name: string
          notes: string | null
          owner_id: string | null
          pipeline_id: string | null
          probability: number | null
          source: string | null
          stage_id: string | null
          status: Database["public"]["Enums"]["deal_status"]
          tags: string[] | null
          updated_at: string | null
          weighted_value: number | null
          win_reason: string | null
          workspace_id: string | null
        }
        Insert: {
          actual_close_date?: string | null
          amount?: number | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          custom_fields?: Json | null
          description?: string | null
          expected_close_date?: string | null
          forecast_category?: string | null
          id?: string
          loss_reason?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          probability?: number | null
          source?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          tags?: string[] | null
          updated_at?: string | null
          weighted_value?: number | null
          win_reason?: string | null
          workspace_id?: string | null
        }
        Update: {
          actual_close_date?: string | null
          amount?: number | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          custom_fields?: Json | null
          description?: string | null
          expected_close_date?: string | null
          forecast_category?: string | null
          id?: string
          loss_reason?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          probability?: number | null
          source?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          tags?: string[] | null
          updated_at?: string | null
          weighted_value?: number | null
          win_reason?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_intelligence: {
        Row: {
          block_reason: string | null
          bounce_rate: number | null
          catch_all_rate: number | null
          deliverability_score: number | null
          domain: string
          freshness_label:
            | Database["public"]["Enums"]["verification_freshness"]
            | null
          is_blocked: boolean | null
          last_seen_at: string | null
          learning_signals: Json | null
          mx_health: string | null
          provider_type: string | null
          reputation_score: number | null
          total_bounces: number | null
          total_catch_all: number | null
          total_emails_seen: number | null
          total_unknown: number | null
          total_valid: number | null
          updated_at: string
        }
        Insert: {
          block_reason?: string | null
          bounce_rate?: number | null
          catch_all_rate?: number | null
          deliverability_score?: number | null
          domain: string
          freshness_label?:
            | Database["public"]["Enums"]["verification_freshness"]
            | null
          is_blocked?: boolean | null
          last_seen_at?: string | null
          learning_signals?: Json | null
          mx_health?: string | null
          provider_type?: string | null
          reputation_score?: number | null
          total_bounces?: number | null
          total_catch_all?: number | null
          total_emails_seen?: number | null
          total_unknown?: number | null
          total_valid?: number | null
          updated_at?: string
        }
        Update: {
          block_reason?: string | null
          bounce_rate?: number | null
          catch_all_rate?: number | null
          deliverability_score?: number | null
          domain?: string
          freshness_label?:
            | Database["public"]["Enums"]["verification_freshness"]
            | null
          is_blocked?: boolean | null
          last_seen_at?: string | null
          learning_signals?: Json | null
          mx_health?: string | null
          provider_type?: string | null
          reputation_score?: number | null
          total_bounces?: number | null
          total_catch_all?: number | null
          total_emails_seen?: number | null
          total_unknown?: number | null
          total_valid?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      domain_reputation: {
        Row: {
          bounce_count: number
          bounce_rate: number | null
          catch_all_confidence: number | null
          catch_all_delivery_success_rate: number | null
          created_at: string
          domain: string
          id: string
          invalid_count: number
          is_catch_all: boolean | null
          is_disposable: boolean | null
          is_free_provider: boolean | null
          last_seen_active: string | null
          last_smtp_behavior: Json | null
          last_verified_at: string | null
          mx_host: string | null
          mx_provider: string | null
          mx_region: string | null
          provider_type: string | null
          quality_score: number | null
          risk_score: number | null
          risk_tier:
            | Database["public"]["Enums"]["verification_risk_tier"]
            | null
          smtp_accept_rate: number | null
          suspicious_pattern_score: number | null
          temporary_failure_rate: number | null
          total_bounces: number
          total_catch_all: number
          total_invalid: number
          total_verifications: number
          total_verified: number
          updated_at: string
          valid_count: number
        }
        Insert: {
          bounce_count?: number
          bounce_rate?: number | null
          catch_all_confidence?: number | null
          catch_all_delivery_success_rate?: number | null
          created_at?: string
          domain: string
          id?: string
          invalid_count?: number
          is_catch_all?: boolean | null
          is_disposable?: boolean | null
          is_free_provider?: boolean | null
          last_seen_active?: string | null
          last_smtp_behavior?: Json | null
          last_verified_at?: string | null
          mx_host?: string | null
          mx_provider?: string | null
          mx_region?: string | null
          provider_type?: string | null
          quality_score?: number | null
          risk_score?: number | null
          risk_tier?:
            | Database["public"]["Enums"]["verification_risk_tier"]
            | null
          smtp_accept_rate?: number | null
          suspicious_pattern_score?: number | null
          temporary_failure_rate?: number | null
          total_bounces?: number
          total_catch_all?: number
          total_invalid?: number
          total_verifications?: number
          total_verified?: number
          updated_at?: string
          valid_count?: number
        }
        Update: {
          bounce_count?: number
          bounce_rate?: number | null
          catch_all_confidence?: number | null
          catch_all_delivery_success_rate?: number | null
          created_at?: string
          domain?: string
          id?: string
          invalid_count?: number
          is_catch_all?: boolean | null
          is_disposable?: boolean | null
          is_free_provider?: boolean | null
          last_seen_active?: string | null
          last_smtp_behavior?: Json | null
          last_verified_at?: string | null
          mx_host?: string | null
          mx_provider?: string | null
          mx_region?: string | null
          provider_type?: string | null
          quality_score?: number | null
          risk_score?: number | null
          risk_tier?:
            | Database["public"]["Enums"]["verification_risk_tier"]
            | null
          smtp_accept_rate?: number | null
          suspicious_pattern_score?: number | null
          temporary_failure_rate?: number | null
          total_bounces?: number
          total_catch_all?: number
          total_invalid?: number
          total_verifications?: number
          total_verified?: number
          updated_at?: string
          valid_count?: number
        }
        Relationships: []
      }
      domain_send_limits: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          last_reset_at: string | null
          max_per_day: number | null
          sent_last_30_days: number | null
          sent_today: number | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          last_reset_at?: string | null
          max_per_day?: number | null
          sent_last_30_days?: number | null
          sent_today?: number | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          last_reset_at?: string | null
          max_per_day?: number | null
          sent_last_30_days?: number | null
          sent_today?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_send_limits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_suppression: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          reason: string
          suppressed_by: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          reason?: string
          suppressed_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          reason?: string
          suppressed_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_suppression_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_candidates: {
        Row: {
          created_at: string
          entity_type: string
          group_id: string
          id: string
          is_primary: boolean
          match_reasons: string[]
          match_score: number | null
          merge_status: Database["public"]["Enums"]["merge_status"]
          record_id: string
        }
        Insert: {
          created_at?: string
          entity_type?: string
          group_id: string
          id?: string
          is_primary?: boolean
          match_reasons?: string[]
          match_score?: number | null
          merge_status?: Database["public"]["Enums"]["merge_status"]
          record_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          group_id?: string
          id?: string
          is_primary?: boolean
          match_reasons?: string[]
          match_score?: number | null
          merge_status?: Database["public"]["Enums"]["merge_status"]
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_candidates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "duplicate_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_groups: {
        Row: {
          confidence_score: number | null
          created_at: string
          entity_type: string
          id: string
          match_rules: string[]
          primary_record_id: string | null
          record_count: number
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["duplicate_group_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          entity_type?: string
          id?: string
          match_rules?: string[]
          primary_record_id?: string | null
          record_count?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["duplicate_group_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          entity_type?: string
          id?: string
          match_rules?: string[]
          primary_record_id?: string | null
          record_count?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["duplicate_group_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_bounces: {
        Row: {
          bounce_reason: string | null
          bounce_type: string
          created_at: string | null
          email_id: string | null
          id: string
          mailbox_id: string | null
          recipient_address: string | null
          smtp_code: string | null
        }
        Insert: {
          bounce_reason?: string | null
          bounce_type?: string
          created_at?: string | null
          email_id?: string | null
          id?: string
          mailbox_id?: string | null
          recipient_address?: string | null
          smtp_code?: string | null
        }
        Update: {
          bounce_reason?: string | null
          bounce_type?: string
          created_at?: string | null
          email_id?: string | null
          id?: string
          mailbox_id?: string | null
          recipient_address?: string | null
          smtp_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_bounces_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_bounces_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string | null
          details: Json | null
          email_id: string
          event_type: string
          id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          email_id: string
          event_type: string
          id?: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          email_id?: string
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_history: {
        Row: {
          bounce_count: number | null
          bounce_risk_score: number | null
          catch_all_probability: number | null
          confidence_decay_score: number | null
          created_at: string
          current_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          deliverability_score: number | null
          domain: string | null
          email_normalized: string
          engagement_count: number | null
          first_seen_at: string | null
          freshness_label:
            | Database["public"]["Enums"]["verification_freshness"]
            | null
          historical_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          id: string
          is_catch_all: boolean | null
          is_disposable: boolean | null
          is_role_based: boolean | null
          last_bounce_at: string | null
          last_campaign_sent_at: string | null
          last_open_at: string | null
          last_reply_at: string | null
          last_seen_valid_at: string | null
          last_verified_at: string | null
          metadata: Json | null
          provider_type: string | null
          risk_level:
            | Database["public"]["Enums"]["verification_risk_tier"]
            | null
          status_changed_at: string | null
          updated_at: string
          verification_count: number | null
          verification_source:
            | Database["public"]["Enums"]["verification_source"]
            | null
          workspace_id: string
        }
        Insert: {
          bounce_count?: number | null
          bounce_risk_score?: number | null
          catch_all_probability?: number | null
          confidence_decay_score?: number | null
          created_at?: string
          current_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          deliverability_score?: number | null
          domain?: string | null
          email_normalized: string
          engagement_count?: number | null
          first_seen_at?: string | null
          freshness_label?:
            | Database["public"]["Enums"]["verification_freshness"]
            | null
          historical_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          id?: string
          is_catch_all?: boolean | null
          is_disposable?: boolean | null
          is_role_based?: boolean | null
          last_bounce_at?: string | null
          last_campaign_sent_at?: string | null
          last_open_at?: string | null
          last_reply_at?: string | null
          last_seen_valid_at?: string | null
          last_verified_at?: string | null
          metadata?: Json | null
          provider_type?: string | null
          risk_level?:
            | Database["public"]["Enums"]["verification_risk_tier"]
            | null
          status_changed_at?: string | null
          updated_at?: string
          verification_count?: number | null
          verification_source?:
            | Database["public"]["Enums"]["verification_source"]
            | null
          workspace_id: string
        }
        Update: {
          bounce_count?: number | null
          bounce_risk_score?: number | null
          catch_all_probability?: number | null
          confidence_decay_score?: number | null
          created_at?: string
          current_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          deliverability_score?: number | null
          domain?: string | null
          email_normalized?: string
          engagement_count?: number | null
          first_seen_at?: string | null
          freshness_label?:
            | Database["public"]["Enums"]["verification_freshness"]
            | null
          historical_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          id?: string
          is_catch_all?: boolean | null
          is_disposable?: boolean | null
          is_role_based?: boolean | null
          last_bounce_at?: string | null
          last_campaign_sent_at?: string | null
          last_open_at?: string | null
          last_reply_at?: string | null
          last_seen_valid_at?: string | null
          last_verified_at?: string | null
          metadata?: Json | null
          provider_type?: string | null
          risk_level?:
            | Database["public"]["Enums"]["verification_risk_tier"]
            | null
          status_changed_at?: string | null
          updated_at?: string
          verification_count?: number | null
          verification_source?:
            | Database["public"]["Enums"]["verification_source"]
            | null
          workspace_id?: string
        }
        Relationships: []
      }
      email_providers: {
        Row: {
          api_endpoint: string | null
          auth_type: string
          created_at: string | null
          id: string
          is_active: boolean
          provider_name: string
        }
        Insert: {
          api_endpoint?: string | null
          auth_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          provider_name: string
        }
        Update: {
          api_endpoint?: string | null
          auth_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          provider_name?: string
        }
        Relationships: []
      }
      email_reputation_history: {
        Row: {
          confidence: number | null
          details: Json | null
          email_normalized: string
          event_type: string
          id: string
          recorded_at: string
          source_engine: string | null
          status: Database["public"]["Enums"]["verification_status"]
          workspace_id: string | null
        }
        Insert: {
          confidence?: number | null
          details?: Json | null
          email_normalized: string
          event_type?: string
          id?: string
          recorded_at?: string
          source_engine?: string | null
          status: Database["public"]["Enums"]["verification_status"]
          workspace_id?: string | null
        }
        Update: {
          confidence?: number | null
          details?: Json | null
          email_normalized?: string
          event_type?: string
          id?: string
          recorded_at?: string
          source_engine?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_reputation_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          updated_at: string | null
          variables: Json | null
          workspace_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          updated_at?: string | null
          variables?: Json | null
          workspace_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          updated_at?: string | null
          variables?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_variants: {
        Row: {
          body: string | null
          click_count: number | null
          created_at: string | null
          id: string
          open_count: number | null
          reply_count: number | null
          sent_count: number | null
          subject: string | null
          template_id: string
          variant_name: string
        }
        Insert: {
          body?: string | null
          click_count?: number | null
          created_at?: string | null
          id?: string
          open_count?: number | null
          reply_count?: number | null
          sent_count?: number | null
          subject?: string | null
          template_id: string
          variant_name?: string
        }
        Update: {
          body?: string | null
          click_count?: number | null
          created_at?: string | null
          id?: string
          open_count?: number | null
          reply_count?: number | null
          sent_count?: number | null
          subject?: string | null
          template_id?: string
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_variants_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          bcc: string | null
          body_html: string | null
          body_text: string | null
          bounced_at: string | null
          cc: string | null
          clicked_at: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          enrollment_id: string | null
          error_message: string | null
          from_address: string | null
          id: string
          mailbox_id: string | null
          metadata: Json | null
          opened_at: string | null
          owner_id: string | null
          replied_at: string | null
          scheduled_at: string | null
          sent_at: string | null
          sequence_id: string | null
          sequence_step_id: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          to_address: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          bcc?: string | null
          body_html?: string | null
          body_text?: string | null
          bounced_at?: string | null
          cc?: string | null
          clicked_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          error_message?: string | null
          from_address?: string | null
          id?: string
          mailbox_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          owner_id?: string | null
          replied_at?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          sequence_step_id?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          to_address: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          bcc?: string | null
          body_html?: string | null
          body_text?: string | null
          bounced_at?: string | null
          cc?: string | null
          clicked_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          error_message?: string | null
          from_address?: string | null
          id?: string
          mailbox_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          owner_id?: string | null
          replied_at?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          sequence_step_id?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          to_address?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_sequence_step_id_fkey"
            columns: ["sequence_step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_routing_rules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          preferred_mailbox_provider: string
          priority: number | null
          recipient_provider: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          preferred_mailbox_provider: string
          priority?: number | null
          recipient_provider: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          preferred_mailbox_provider?: string
          priority?: number | null
          recipient_provider?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esp_routing_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          entity_type: string
          error_message: string | null
          export_type: Database["public"]["Enums"]["export_type"]
          file_name: string
          file_url: string | null
          filter_definition: Json | null
          id: string
          processed_rows: number
          selected_columns: string[]
          selected_ids: string[] | null
          source_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["export_status"]
          template_id: string | null
          total_rows: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_type?: string
          error_message?: string | null
          export_type?: Database["public"]["Enums"]["export_type"]
          file_name: string
          file_url?: string | null
          filter_definition?: Json | null
          id?: string
          processed_rows?: number
          selected_columns?: string[]
          selected_ids?: string[] | null
          source_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["export_status"]
          template_id?: string | null
          total_rows?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_type?: string
          error_message?: string | null
          export_type?: Database["public"]["Enums"]["export_type"]
          file_name?: string
          file_url?: string | null
          filter_definition?: Json | null
          id?: string
          processed_rows?: number
          selected_columns?: string[]
          selected_ids?: string[] | null
          source_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["export_status"]
          template_id?: string | null
          total_rows?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      export_templates: {
        Row: {
          columns: string[]
          created_at: string
          created_by: string | null
          entity_type: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          columns?: string[]
          created_at?: string
          created_by?: string | null
          entity_type?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          columns?: string[]
          created_at?: string
          created_by?: string | null
          entity_type?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_content: {
        Row: {
          campaign_id: string | null
          company_id: string | null
          contact_id: string | null
          content_type: Database["public"]["Enums"]["generated_content_type"]
          created_at: string | null
          generated_text: string | null
          generation_status: Database["public"]["Enums"]["generation_status"]
          id: string
          workspace_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          content_type: Database["public"]["Enums"]["generated_content_type"]
          created_at?: string | null
          generated_text?: string | null
          generation_status?: Database["public"]["Enums"]["generation_status"]
          id?: string
          workspace_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          content_type?: Database["public"]["Enums"]["generated_content_type"]
          created_at?: string | null
          generated_text?: string | null
          generation_status?: Database["public"]["Enums"]["generation_status"]
          id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_content_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_content_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_content_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_content_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      global_picklist_options: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          label: string
          picklist_id: string
          value: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label: string
          picklist_id: string
          value: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label?: string
          picklist_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_picklist_options_picklist_id_fkey"
            columns: ["picklist_id"]
            isOneToOne: false
            referencedRelation: "global_picklists"
            referencedColumns: ["id"]
          },
        ]
      }
      global_picklists: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_picklists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          current_value: number
          description: string | null
          end_date: string
          goal_type: string
          id: string
          is_active: boolean | null
          name: string
          period: string
          start_date: string
          target_value: number
          team_goal: boolean | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          current_value?: number
          description?: string | null
          end_date: string
          goal_type: string
          id?: string
          is_active?: boolean | null
          name: string
          period: string
          start_date: string
          target_value?: number
          team_goal?: boolean | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          current_value?: number
          description?: string | null
          end_date?: string
          goal_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
          period?: string
          start_date?: string
          target_value?: number
          team_goal?: boolean | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      greylisting_events: {
        Row: {
          attempts: number
          detected_at: string
          domain: string
          id: string
          provider_key: string | null
          recovered_at: string | null
          result_id: string | null
          success: boolean | null
        }
        Insert: {
          attempts?: number
          detected_at?: string
          domain: string
          id?: string
          provider_key?: string | null
          recovered_at?: string | null
          result_id?: string | null
          success?: boolean | null
        }
        Update: {
          attempts?: number
          detected_at?: string
          domain?: string
          id?: string
          provider_key?: string | null
          recovered_at?: string | null
          result_id?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "greylisting_events_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "verification_results"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_imports: {
        Row: {
          column_mapping: Json
          completed_at: string | null
          created_at: string
          error_message: string | null
          failed_count: number | null
          file_name: string
          file_path: string | null
          file_size_bytes: number | null
          id: string
          metadata: Json | null
          processed_count: number | null
          row_count: number | null
          source_label: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["historical_import_status"]
          updated_at: string
          uploaded_by: string
          workspace_id: string | null
        }
        Insert: {
          column_mapping?: Json
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_count?: number | null
          file_name: string
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          processed_count?: number | null
          row_count?: number | null
          source_label?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["historical_import_status"]
          updated_at?: string
          uploaded_by: string
          workspace_id?: string | null
        }
        Update: {
          column_mapping?: Json
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_count?: number | null
          file_name?: string
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          processed_count?: number | null
          row_count?: number | null
          source_label?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["historical_import_status"]
          updated_at?: string
          uploaded_by?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      import_job_rows: {
        Row: {
          action_taken: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          duplicate_match_reason: string | null
          error_message: string | null
          id: string
          import_job_id: string
          normalized_data: Json | null
          raw_data: Json
          review_required: boolean
          row_number: number
          status: Database["public"]["Enums"]["import_row_status"]
        }
        Insert: {
          action_taken?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          duplicate_match_reason?: string | null
          error_message?: string | null
          id?: string
          import_job_id: string
          normalized_data?: Json | null
          raw_data: Json
          review_required?: boolean
          row_number: number
          status?: Database["public"]["Enums"]["import_row_status"]
        }
        Update: {
          action_taken?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          duplicate_match_reason?: string | null
          error_message?: string | null
          id?: string
          import_job_id?: string
          normalized_data?: Json | null
          raw_data?: Json
          review_required?: boolean
          row_number?: number
          status?: Database["public"]["Enums"]["import_row_status"]
        }
        Relationships: [
          {
            foreignKeyName: "import_job_rows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_rows_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          column_mapping: Json | null
          completed_at: string | null
          created_at: string | null
          created_by: string
          duplicate_rows: number
          error_rows: number
          error_summary: Json | null
          file_name: string
          file_url: string | null
          id: string
          inserted_rows: number
          processed_rows: number
          review_rows: number
          settings: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["import_status"]
          success_rows: number
          total_rows: number
          workspace_id: string | null
        }
        Insert: {
          column_mapping?: Json | null
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          duplicate_rows?: number
          error_rows?: number
          error_summary?: Json | null
          file_name: string
          file_url?: string | null
          id?: string
          inserted_rows?: number
          processed_rows?: number
          review_rows?: number
          settings?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          success_rows?: number
          total_rows?: number
          workspace_id?: string | null
        }
        Update: {
          column_mapping?: Json | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          duplicate_rows?: number
          error_rows?: number
          error_summary?: Json | null
          file_name?: string
          file_url?: string | null
          id?: string
          inserted_rows?: number
          processed_rows?: number
          review_rows?: number
          settings?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          success_rows?: number
          total_rows?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string | null
          direction: string
          email_id: string | null
          from_address: string | null
          id: string
          subject: string | null
          thread_id: string
          timestamp: string | null
          to_address: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          direction?: string
          email_id?: string | null
          from_address?: string | null
          id?: string
          subject?: string | null
          thread_id: string
          timestamp?: string | null
          to_address?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          direction?: string
          email_id?: string | null
          from_address?: string | null
          id?: string
          subject?: string | null
          thread_id?: string
          timestamp?: string | null
          to_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "inbox_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_threads: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          category: Database["public"]["Enums"]["reply_category"]
          classification_confidence: number
          classification_source: Database["public"]["Enums"]["classification_source"]
          classified_at: string | null
          contact_id: string | null
          created_at: string | null
          id: string
          is_primary: boolean
          last_message_at: string | null
          mailbox_id: string | null
          message_count: number | null
          status: Database["public"]["Enums"]["inbox_thread_status"]
          subject: string | null
          thread_id: string | null
          updated_at: string | null
          user_category: Database["public"]["Enums"]["reply_category"] | null
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          category?: Database["public"]["Enums"]["reply_category"]
          classification_confidence?: number
          classification_source?: Database["public"]["Enums"]["classification_source"]
          classified_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean
          last_message_at?: string | null
          mailbox_id?: string | null
          message_count?: number | null
          status?: Database["public"]["Enums"]["inbox_thread_status"]
          subject?: string | null
          thread_id?: string | null
          updated_at?: string | null
          user_category?: Database["public"]["Enums"]["reply_category"] | null
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          category?: Database["public"]["Enums"]["reply_category"]
          classification_confidence?: number
          classification_source?: Database["public"]["Enums"]["classification_source"]
          classified_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean
          last_message_at?: string | null
          mailbox_id?: string | null
          message_count?: number | null
          status?: Database["public"]["Enums"]["inbox_thread_status"]
          subject?: string | null
          thread_id?: string | null
          updated_at?: string | null
          user_category?: Database["public"]["Enums"]["reply_category"] | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_threads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_threads_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_threads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_account_health: {
        Row: {
          account_id: string
          connects_last_7_days: number
          connects_sent_today: number
          health_score: number
          id: string
          last_health_update: string | null
          messages_last_7_days: number
          messages_sent_today: number
        }
        Insert: {
          account_id: string
          connects_last_7_days?: number
          connects_sent_today?: number
          health_score?: number
          id?: string
          last_health_update?: string | null
          messages_last_7_days?: number
          messages_sent_today?: number
        }
        Update: {
          account_id?: string
          connects_last_7_days?: number
          connects_sent_today?: number
          health_score?: number
          id?: string
          last_health_update?: string | null
          messages_last_7_days?: number
          messages_sent_today?: number
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_account_health_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "linkedin_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_accounts: {
        Row: {
          active: boolean
          connection_status: Database["public"]["Enums"]["linkedin_connection_status"]
          created_at: string | null
          daily_comment_limit: number
          daily_connect_limit: number
          daily_endorse_limit: number
          daily_inmail_limit: number
          daily_like_limit: number
          daily_message_limit: number
          daily_view_limit: number
          daily_withdraw_limit: number
          health_score: number
          id: string
          last_action_at: string | null
          market_median_connects: number
          market_median_messages: number
          max_action_delay_seconds: number
          min_action_delay_seconds: number
          notes: string | null
          owner_user_id: string | null
          profile_name: string
          profile_url: string | null
          proxy_label: string | null
          schedule_days_of_week: number[]
          sending_window_end: string
          sending_window_start: string
          smart_limits_enabled: boolean
          timezone: string
          updated_at: string
          warmup_level: number
          workspace_id: string | null
        }
        Insert: {
          active?: boolean
          connection_status?: Database["public"]["Enums"]["linkedin_connection_status"]
          created_at?: string | null
          daily_comment_limit?: number
          daily_connect_limit?: number
          daily_endorse_limit?: number
          daily_inmail_limit?: number
          daily_like_limit?: number
          daily_message_limit?: number
          daily_view_limit?: number
          daily_withdraw_limit?: number
          health_score?: number
          id?: string
          last_action_at?: string | null
          market_median_connects?: number
          market_median_messages?: number
          max_action_delay_seconds?: number
          min_action_delay_seconds?: number
          notes?: string | null
          owner_user_id?: string | null
          profile_name: string
          profile_url?: string | null
          proxy_label?: string | null
          schedule_days_of_week?: number[]
          sending_window_end?: string
          sending_window_start?: string
          smart_limits_enabled?: boolean
          timezone?: string
          updated_at?: string
          warmup_level?: number
          workspace_id?: string | null
        }
        Update: {
          active?: boolean
          connection_status?: Database["public"]["Enums"]["linkedin_connection_status"]
          created_at?: string | null
          daily_comment_limit?: number
          daily_connect_limit?: number
          daily_endorse_limit?: number
          daily_inmail_limit?: number
          daily_like_limit?: number
          daily_message_limit?: number
          daily_view_limit?: number
          daily_withdraw_limit?: number
          health_score?: number
          id?: string
          last_action_at?: string | null
          market_median_connects?: number
          market_median_messages?: number
          max_action_delay_seconds?: number
          min_action_delay_seconds?: number
          notes?: string | null
          owner_user_id?: string | null
          profile_name?: string
          profile_url?: string | null
          proxy_label?: string | null
          schedule_days_of_week?: number[]
          sending_window_end?: string
          sending_window_start?: string
          smart_limits_enabled?: boolean
          timezone?: string
          updated_at?: string
          warmup_level?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_action_history: {
        Row: {
          action_type: Database["public"]["Enums"]["linkedin_action_type"]
          campaign_id: string | null
          contact_id: string
          error_message: string | null
          executed_at: string | null
          id: string
          linkedin_account_id: string
          metadata: Json
          result: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["linkedin_action_type"]
          campaign_id?: string | null
          contact_id: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          linkedin_account_id: string
          metadata?: Json
          result?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["linkedin_action_type"]
          campaign_id?: string | null
          contact_id?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          linkedin_account_id?: string
          metadata?: Json
          result?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_action_history_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_action_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_action_history_linkedin_account_id_fkey"
            columns: ["linkedin_account_id"]
            isOneToOne: false
            referencedRelation: "linkedin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_action_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_action_queue: {
        Row: {
          action_type: Database["public"]["Enums"]["linkedin_action_type"]
          campaign_id: string | null
          campaign_step_id: string | null
          contact_id: string
          created_at: string | null
          error_message: string | null
          executed_at: string | null
          id: string
          linkedin_account_id: string
          payload: Json
          priority: number
          retry_count: number
          scheduled_at: string | null
          status: Database["public"]["Enums"]["linkedin_queue_status"]
          updated_at: string
          variant_id: string | null
          workflow_node_id: string | null
          workspace_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["linkedin_action_type"]
          campaign_id?: string | null
          campaign_step_id?: string | null
          contact_id: string
          created_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          linkedin_account_id: string
          payload?: Json
          priority?: number
          retry_count?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["linkedin_queue_status"]
          updated_at?: string
          variant_id?: string | null
          workflow_node_id?: string | null
          workspace_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["linkedin_action_type"]
          campaign_id?: string | null
          campaign_step_id?: string | null
          contact_id?: string
          created_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          linkedin_account_id?: string
          payload?: Json
          priority?: number
          retry_count?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["linkedin_queue_status"]
          updated_at?: string
          variant_id?: string | null
          workflow_node_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_action_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaign_stats_v"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "linkedin_action_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_action_queue_campaign_step_id_fkey"
            columns: ["campaign_step_id"]
            isOneToOne: false
            referencedRelation: "campaign_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_action_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_action_queue_linkedin_account_id_fkey"
            columns: ["linkedin_account_id"]
            isOneToOne: false
            referencedRelation: "linkedin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_action_queue_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "linkedin_message_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_action_queue_workflow_node_id_fkey"
            columns: ["workflow_node_id"]
            isOneToOne: false
            referencedRelation: "linkedin_workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_action_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[]
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_campaign_leads: {
        Row: {
          added_by: string | null
          assigned_sender_id: string | null
          campaign_id: string
          connection_status: string
          contact_id: string
          created_at: string
          current_node_id: string | null
          current_step_order: number
          id: string
          last_action_at: string | null
          last_action_type: string | null
          last_branch_condition:
            | Database["public"]["Enums"]["linkedin_edge_condition"]
            | null
          last_reply_at: string | null
          next_action_at: string | null
          outcome: string | null
          pause_reason: string | null
          paused_at: string | null
          reply_status: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          added_by?: string | null
          assigned_sender_id?: string | null
          campaign_id: string
          connection_status?: string
          contact_id: string
          created_at?: string
          current_node_id?: string | null
          current_step_order?: number
          id?: string
          last_action_at?: string | null
          last_action_type?: string | null
          last_branch_condition?:
            | Database["public"]["Enums"]["linkedin_edge_condition"]
            | null
          last_reply_at?: string | null
          next_action_at?: string | null
          outcome?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          reply_status?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          added_by?: string | null
          assigned_sender_id?: string | null
          campaign_id?: string
          connection_status?: string
          contact_id?: string
          created_at?: string
          current_node_id?: string | null
          current_step_order?: number
          id?: string
          last_action_at?: string | null
          last_action_type?: string | null
          last_branch_condition?:
            | Database["public"]["Enums"]["linkedin_edge_condition"]
            | null
          last_reply_at?: string | null
          next_action_at?: string | null
          outcome?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          reply_status?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_campaign_leads_assigned_sender_id_fkey"
            columns: ["assigned_sender_id"]
            isOneToOne: false
            referencedRelation: "linkedin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaign_stats_v"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "linkedin_campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_campaign_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_campaign_leads_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "linkedin_workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_campaign_leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_campaign_senders: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          is_active: boolean
          linkedin_account_id: string
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          linkedin_account_id: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          linkedin_account_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_campaign_senders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaign_stats_v"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "linkedin_campaign_senders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_campaign_senders_linkedin_account_id_fkey"
            columns: ["linkedin_account_id"]
            isOneToOne: false
            referencedRelation: "linkedin_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_campaign_steps: {
        Row: {
          campaign_id: string
          created_at: string
          delay_days: number
          delay_hours: number
          id: string
          message_body: string | null
          step_order: number
          step_type: string
          task_description: string | null
          task_title: string | null
          template_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delay_days?: number
          delay_hours?: number
          id?: string
          message_body?: string | null
          step_order?: number
          step_type: string
          task_description?: string | null
          task_title?: string | null
          template_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delay_days?: number
          delay_hours?: number
          id?: string
          message_body?: string | null
          step_order?: number
          step_type?: string
          task_description?: string | null
          task_title?: string | null
          template_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaign_stats_v"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "linkedin_campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_campaign_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "linkedin_message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_campaign_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          creation_step: string
          daily_connect_limit: number
          daily_message_limit: number
          description: string | null
          exclude_existing_connections: boolean
          id: string
          linkedin_account_id: string | null
          name: string
          sending_window_end: string
          sending_window_start: string
          source_list_id: string | null
          status: string
          stop_on_reply: boolean
          timezone: string
          updated_at: string
          variant_min_sends_per_variant: number
          variant_rotation: Database["public"]["Enums"]["linkedin_variant_strategy"]
          variant_winning_metric: Database["public"]["Enums"]["linkedin_variant_metric"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          creation_step?: string
          daily_connect_limit?: number
          daily_message_limit?: number
          description?: string | null
          exclude_existing_connections?: boolean
          id?: string
          linkedin_account_id?: string | null
          name: string
          sending_window_end?: string
          sending_window_start?: string
          source_list_id?: string | null
          status?: string
          stop_on_reply?: boolean
          timezone?: string
          updated_at?: string
          variant_min_sends_per_variant?: number
          variant_rotation?: Database["public"]["Enums"]["linkedin_variant_strategy"]
          variant_winning_metric?: Database["public"]["Enums"]["linkedin_variant_metric"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          creation_step?: string
          daily_connect_limit?: number
          daily_message_limit?: number
          description?: string | null
          exclude_existing_connections?: boolean
          id?: string
          linkedin_account_id?: string | null
          name?: string
          sending_window_end?: string
          sending_window_start?: string
          source_list_id?: string | null
          status?: string
          stop_on_reply?: boolean
          timezone?: string
          updated_at?: string
          variant_min_sends_per_variant?: number
          variant_rotation?: Database["public"]["Enums"]["linkedin_variant_strategy"]
          variant_winning_metric?: Database["public"]["Enums"]["linkedin_variant_metric"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_campaigns_linkedin_account_id_fkey"
            columns: ["linkedin_account_id"]
            isOneToOne: false
            referencedRelation: "linkedin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_contact_state: {
        Row: {
          connection_status: string
          contact_id: string
          created_at: string
          id: string
          inbox_status: string | null
          last_enriched_at: string | null
          last_li_action_type: string | null
          last_li_activity_at: string | null
          linkedin_account_id: string | null
          notes: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          connection_status?: string
          contact_id: string
          created_at?: string
          id?: string
          inbox_status?: string | null
          last_enriched_at?: string | null
          last_li_action_type?: string | null
          last_li_activity_at?: string | null
          linkedin_account_id?: string | null
          notes?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          connection_status?: string
          contact_id?: string
          created_at?: string
          id?: string
          inbox_status?: string | null
          last_enriched_at?: string | null
          last_li_action_type?: string | null
          last_li_activity_at?: string | null
          linkedin_account_id?: string | null
          notes?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_contact_state_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_contact_state_linkedin_account_id_fkey"
            columns: ["linkedin_account_id"]
            isOneToOne: false
            referencedRelation: "linkedin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_contact_state_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_execution_adapters: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          credentials_secret_name: string | null
          health_message: string | null
          health_status: string
          id: string
          is_active: boolean
          last_health_at: string | null
          name: string
          provider: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials_secret_name?: string | null
          health_message?: string | null
          health_status?: string
          id?: string
          is_active?: boolean
          last_health_at?: string | null
          name: string
          provider: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials_secret_name?: string | null
          health_message?: string | null
          health_status?: string
          id?: string
          is_active?: boolean
          last_health_at?: string | null
          name?: string
          provider?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_execution_adapters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_filter_presets: {
        Row: {
          created_at: string
          created_by: string | null
          filters: Json
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filters?: Json
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filters?: Json
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_filter_presets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_inbox_messages: {
        Row: {
          body: string | null
          created_at: string
          direction: string
          id: string
          sent_at: string
          thread_id: string
          workspace_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          direction?: string
          id?: string
          sent_at?: string
          thread_id: string
          workspace_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          direction?: string
          id?: string
          sent_at?: string
          thread_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_inbox_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "linkedin_inbox_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_inbox_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_inbox_threads: {
        Row: {
          campaign_id: string | null
          category: string
          contact_id: string | null
          created_at: string
          id: string
          is_read: boolean
          is_starred: boolean
          last_message_at: string | null
          linkedin_account_id: string | null
          message_count: number
          preview: string | null
          subject: string | null
          updated_at: string
          user_category: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          category?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          is_starred?: boolean
          last_message_at?: string | null
          linkedin_account_id?: string | null
          message_count?: number
          preview?: string | null
          subject?: string | null
          updated_at?: string
          user_category?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          category?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          is_starred?: boolean
          last_message_at?: string | null
          linkedin_account_id?: string | null
          message_count?: number
          preview?: string | null
          subject?: string | null
          updated_at?: string
          user_category?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_inbox_threads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaign_stats_v"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "linkedin_inbox_threads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_inbox_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_inbox_threads_linkedin_account_id_fkey"
            columns: ["linkedin_account_id"]
            isOneToOne: false
            referencedRelation: "linkedin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_inbox_threads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_llm_integrations: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_default: boolean
          model: string
          provider: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          model?: string
          provider?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          model?: string
          provider?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_llm_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_message_templates: {
        Row: {
          created_at: string | null
          id: string
          message_body: string | null
          name: string
          variables: Json | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_body?: string | null
          name: string
          variables?: Json | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message_body?: string | null
          name?: string
          variables?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_message_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_message_variants: {
        Row: {
          accepted_count: number
          body: string
          campaign_id: string
          created_at: string
          id: string
          is_active: boolean
          is_winner: boolean
          label: string
          node_id: string
          positive_count: number
          replies_count: number
          sends_count: number
          subject: string | null
          updated_at: string
          weight: number
          workspace_id: string
        }
        Insert: {
          accepted_count?: number
          body?: string
          campaign_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_winner?: boolean
          label?: string
          node_id: string
          positive_count?: number
          replies_count?: number
          sends_count?: number
          subject?: string | null
          updated_at?: string
          weight?: number
          workspace_id: string
        }
        Update: {
          accepted_count?: number
          body?: string
          campaign_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_winner?: boolean
          label?: string
          node_id?: string
          positive_count?: number
          replies_count?: number
          sends_count?: number
          subject?: string | null
          updated_at?: string
          weight?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_message_variants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaign_stats_v"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "linkedin_message_variants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_message_variants_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "linkedin_workflow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_performance_metrics: {
        Row: {
          connect_requests_sent: number | null
          deals_created: number | null
          id: string
          linkedin_account_id: string
          meetings_booked: number | null
          messages_sent: number | null
          period_end: string
          period_start: string
          replies_received: number | null
          workspace_id: string | null
        }
        Insert: {
          connect_requests_sent?: number | null
          deals_created?: number | null
          id?: string
          linkedin_account_id: string
          meetings_booked?: number | null
          messages_sent?: number | null
          period_end: string
          period_start: string
          replies_received?: number | null
          workspace_id?: string | null
        }
        Update: {
          connect_requests_sent?: number | null
          deals_created?: number | null
          id?: string
          linkedin_account_id?: string
          meetings_booked?: number | null
          messages_sent?: number | null
          period_end?: string
          period_start?: string
          replies_received?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_performance_metrics_linkedin_account_id_fkey"
            columns: ["linkedin_account_id"]
            isOneToOne: false
            referencedRelation: "linkedin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_performance_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_safety_rules: {
        Row: {
          created_at: string | null
          id: string
          max_connects_per_day: number
          max_delay_minutes: number
          max_messages_per_day: number
          min_delay_minutes: number
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_connects_per_day?: number
          max_delay_minutes?: number
          max_messages_per_day?: number
          min_delay_minutes?: number
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_connects_per_day?: number
          max_delay_minutes?: number
          max_messages_per_day?: number
          min_delay_minutes?: number
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_safety_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_stoplist: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          match_type: string
          match_value: string
          reason: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          match_type?: string
          match_value: string
          reason?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          match_type?: string
          match_value?: string
          reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_stoplist_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_tasks: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          linkedin_account_id: string | null
          status: string
          step_id: string | null
          task_type: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          linkedin_account_id?: string | null
          status?: string
          step_id?: string | null
          task_type?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          linkedin_account_id?: string | null
          status?: string
          step_id?: string | null
          task_type?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaign_stats_v"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "linkedin_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_tasks_linkedin_account_id_fkey"
            columns: ["linkedin_account_id"]
            isOneToOne: false
            referencedRelation: "linkedin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_tasks_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaign_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          events: string[]
          id: string
          is_active: boolean
          name: string
          secret: string | null
          updated_at: string
          url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          name: string
          secret?: string | null
          updated_at?: string
          url: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_webhooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_worker_runs: {
        Row: {
          blocked: number
          claimed: number
          error: string | null
          failed: number
          finished_at: string | null
          id: string
          notes: Json
          skipped: number
          started_at: string
          succeeded: number
        }
        Insert: {
          blocked?: number
          claimed?: number
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          notes?: Json
          skipped?: number
          started_at?: string
          succeeded?: number
        }
        Update: {
          blocked?: number
          claimed?: number
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          notes?: Json
          skipped?: number
          started_at?: string
          succeeded?: number
        }
        Relationships: []
      }
      linkedin_workflow_edges: {
        Row: {
          campaign_id: string
          condition: Database["public"]["Enums"]["linkedin_edge_condition"]
          created_at: string
          from_node_id: string
          id: string
          to_node_id: string
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          condition?: Database["public"]["Enums"]["linkedin_edge_condition"]
          created_at?: string
          from_node_id: string
          id?: string
          to_node_id: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          condition?: Database["public"]["Enums"]["linkedin_edge_condition"]
          created_at?: string
          from_node_id?: string
          id?: string
          to_node_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_workflow_edges_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaign_stats_v"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "linkedin_workflow_edges_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_workflow_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "linkedin_workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_workflow_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "linkedin_workflow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_workflow_nodes: {
        Row: {
          attachments: Json | null
          campaign_id: string
          config: Json | null
          connection_note: string | null
          created_at: string
          delay_amount: number | null
          delay_unit: string | null
          id: string
          label: string | null
          message_body: string | null
          message_subject: string | null
          node_type: Database["public"]["Enums"]["linkedin_node_type"]
          position_x: number | null
          position_y: number | null
          send_always: boolean | null
          skip_note_if_too_long: boolean | null
          task_description: string | null
          task_title: string | null
          updated_at: string
          wait_timeout_days: number | null
          withdraw_after_days: number | null
          workspace_id: string
        }
        Insert: {
          attachments?: Json | null
          campaign_id: string
          config?: Json | null
          connection_note?: string | null
          created_at?: string
          delay_amount?: number | null
          delay_unit?: string | null
          id?: string
          label?: string | null
          message_body?: string | null
          message_subject?: string | null
          node_type: Database["public"]["Enums"]["linkedin_node_type"]
          position_x?: number | null
          position_y?: number | null
          send_always?: boolean | null
          skip_note_if_too_long?: boolean | null
          task_description?: string | null
          task_title?: string | null
          updated_at?: string
          wait_timeout_days?: number | null
          withdraw_after_days?: number | null
          workspace_id: string
        }
        Update: {
          attachments?: Json | null
          campaign_id?: string
          config?: Json | null
          connection_note?: string | null
          created_at?: string
          delay_amount?: number | null
          delay_unit?: string | null
          id?: string
          label?: string | null
          message_body?: string | null
          message_subject?: string | null
          node_type?: Database["public"]["Enums"]["linkedin_node_type"]
          position_x?: number | null
          position_y?: number | null
          send_always?: boolean | null
          skip_note_if_too_long?: boolean | null
          task_description?: string | null
          task_title?: string | null
          updated_at?: string
          wait_timeout_days?: number | null
          withdraw_after_days?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_workflow_nodes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaign_stats_v"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "linkedin_workflow_nodes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "linkedin_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      list_contacts: {
        Row: {
          added_at: string | null
          added_by: string | null
          contact_id: string
          list_id: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          contact_id: string
          list_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          contact_id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          filter_criteria: Json | null
          id: string
          is_dynamic: boolean
          name: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          is_dynamic?: boolean
          name: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          is_dynamic?: boolean
          name?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      login_audit_log: {
        Row: {
          created_at: string
          email: string
          error_message: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      mailbox_health: {
        Row: {
          bounce_rate: number | null
          health_score: number | null
          id: string
          last_health_update: string | null
          mailbox_id: string
          open_rate: number | null
          reply_rate: number | null
          sent_last_30_days: number | null
          sent_last_7_days: number | null
        }
        Insert: {
          bounce_rate?: number | null
          health_score?: number | null
          id?: string
          last_health_update?: string | null
          mailbox_id: string
          open_rate?: number | null
          reply_rate?: number | null
          sent_last_30_days?: number | null
          sent_last_7_days?: number | null
        }
        Update: {
          bounce_rate?: number | null
          health_score?: number | null
          id?: string
          last_health_update?: string | null
          mailbox_id?: string
          open_rate?: number | null
          reply_rate?: number | null
          sent_last_30_days?: number | null
          sent_last_7_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_health_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: true
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mailbox_performance_metrics: {
        Row: {
          bounce_count: number | null
          deals_created: number | null
          emails_sent: number | null
          health_score: number | null
          id: string
          mailbox_id: string
          meetings_booked: number | null
          period_end: string
          period_start: string
          replies_received: number | null
          workspace_id: string | null
        }
        Insert: {
          bounce_count?: number | null
          deals_created?: number | null
          emails_sent?: number | null
          health_score?: number | null
          id?: string
          mailbox_id: string
          meetings_booked?: number | null
          period_end: string
          period_start: string
          replies_received?: number | null
          workspace_id?: string | null
        }
        Update: {
          bounce_count?: number | null
          deals_created?: number | null
          emails_sent?: number | null
          health_score?: number | null
          id?: string
          mailbox_id?: string
          meetings_booked?: number | null
          period_end?: string
          period_start?: string
          replies_received?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_performance_metrics_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mailbox_performance_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      mailbox_rotation_state: {
        Row: {
          emails_sent_today: number
          id: string
          last_reset_date: string | null
          last_sent_at: string | null
          mailbox_id: string
        }
        Insert: {
          emails_sent_today?: number
          id?: string
          last_reset_date?: string | null
          last_sent_at?: string | null
          mailbox_id: string
        }
        Update: {
          emails_sent_today?: number
          id?: string
          last_reset_date?: string | null
          last_sent_at?: string | null
          mailbox_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_rotation_state_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: true
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mailbox_warmup_settings: {
        Row: {
          created_at: string | null
          daily_warmup_limit: number | null
          disable_slow_warmup: boolean | null
          id: string
          increase_per_day: number | null
          mailbox_id: string
          mark_important_rate: number | null
          open_rate_target: number | null
          read_emulation: boolean | null
          reply_rate_target: number | null
          saved_from_spam_week: number | null
          spam_protection_rate: number | null
          updated_at: string | null
          warm_custom_tracking_domain: boolean | null
          warmup_emails_received_week: number | null
          warmup_emails_sent_week: number | null
          warmup_enabled: boolean | null
          warmup_filter_tag: string | null
          weekdays_only: boolean | null
          weekly_chart: Json | null
        }
        Insert: {
          created_at?: string | null
          daily_warmup_limit?: number | null
          disable_slow_warmup?: boolean | null
          id?: string
          increase_per_day?: number | null
          mailbox_id: string
          mark_important_rate?: number | null
          open_rate_target?: number | null
          read_emulation?: boolean | null
          reply_rate_target?: number | null
          saved_from_spam_week?: number | null
          spam_protection_rate?: number | null
          updated_at?: string | null
          warm_custom_tracking_domain?: boolean | null
          warmup_emails_received_week?: number | null
          warmup_emails_sent_week?: number | null
          warmup_enabled?: boolean | null
          warmup_filter_tag?: string | null
          weekdays_only?: boolean | null
          weekly_chart?: Json | null
        }
        Update: {
          created_at?: string | null
          daily_warmup_limit?: number | null
          disable_slow_warmup?: boolean | null
          id?: string
          increase_per_day?: number | null
          mailbox_id?: string
          mark_important_rate?: number | null
          open_rate_target?: number | null
          read_emulation?: boolean | null
          reply_rate_target?: number | null
          saved_from_spam_week?: number | null
          spam_protection_rate?: number | null
          updated_at?: string | null
          warm_custom_tracking_domain?: boolean | null
          warmup_emails_received_week?: number | null
          warmup_emails_sent_week?: number | null
          warmup_enabled?: boolean | null
          warmup_filter_tag?: string | null
          weekdays_only?: boolean | null
          weekly_chart?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_warmup_settings_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: true
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mailboxes: {
        Row: {
          connection_status:
            | Database["public"]["Enums"]["connection_status"]
            | null
          created_at: string | null
          created_by: string | null
          daily_campaign_limit: number | null
          daily_inbox_placement_test_limit: number | null
          daily_sending_limit: number | null
          display_name: string | null
          domain_id: string | null
          email: string
          emails_sent_today: number | null
          first_name: string | null
          id: string
          imap_host: string | null
          imap_port: number | null
          imap_secure: boolean | null
          imap_username: string | null
          last_checked_at: string | null
          last_name: string | null
          last_send_at: string | null
          min_wait_seconds: number | null
          next_send_eligible_at: string | null
          notes: string | null
          oauth_access_token: string | null
          oauth_expires_at: string | null
          oauth_refresh_token: string | null
          owner_id: string | null
          provider_id: string | null
          provider_type:
            | Database["public"]["Enums"]["mailbox_provider_type"]
            | null
          reply_to_email: string | null
          sender_name: string | null
          sending_health: Database["public"]["Enums"]["sending_health"] | null
          signature: string | null
          slow_ramp_enabled: boolean | null
          smtp_host: string | null
          smtp_password_encrypted: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_username: string | null
          tags: string[] | null
          tracking_cname_target: string | null
          tracking_cname_verified: boolean | null
          tracking_domain: string | null
          tracking_last_checked_at: string | null
          tracking_ssl_verified: boolean | null
          tracking_subdomain: string | null
          updated_at: string | null
          warmup_enabled: boolean | null
          warmup_progress: number | null
          warmup_started_at: string | null
          workspace_id: string | null
        }
        Insert: {
          connection_status?:
            | Database["public"]["Enums"]["connection_status"]
            | null
          created_at?: string | null
          created_by?: string | null
          daily_campaign_limit?: number | null
          daily_inbox_placement_test_limit?: number | null
          daily_sending_limit?: number | null
          display_name?: string | null
          domain_id?: string | null
          email: string
          emails_sent_today?: number | null
          first_name?: string | null
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          imap_secure?: boolean | null
          imap_username?: string | null
          last_checked_at?: string | null
          last_name?: string | null
          last_send_at?: string | null
          min_wait_seconds?: number | null
          next_send_eligible_at?: string | null
          notes?: string | null
          oauth_access_token?: string | null
          oauth_expires_at?: string | null
          oauth_refresh_token?: string | null
          owner_id?: string | null
          provider_id?: string | null
          provider_type?:
            | Database["public"]["Enums"]["mailbox_provider_type"]
            | null
          reply_to_email?: string | null
          sender_name?: string | null
          sending_health?: Database["public"]["Enums"]["sending_health"] | null
          signature?: string | null
          slow_ramp_enabled?: boolean | null
          smtp_host?: string | null
          smtp_password_encrypted?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_username?: string | null
          tags?: string[] | null
          tracking_cname_target?: string | null
          tracking_cname_verified?: boolean | null
          tracking_domain?: string | null
          tracking_last_checked_at?: string | null
          tracking_ssl_verified?: boolean | null
          tracking_subdomain?: string | null
          updated_at?: string | null
          warmup_enabled?: boolean | null
          warmup_progress?: number | null
          warmup_started_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          connection_status?:
            | Database["public"]["Enums"]["connection_status"]
            | null
          created_at?: string | null
          created_by?: string | null
          daily_campaign_limit?: number | null
          daily_inbox_placement_test_limit?: number | null
          daily_sending_limit?: number | null
          display_name?: string | null
          domain_id?: string | null
          email?: string
          emails_sent_today?: number | null
          first_name?: string | null
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          imap_secure?: boolean | null
          imap_username?: string | null
          last_checked_at?: string | null
          last_name?: string | null
          last_send_at?: string | null
          min_wait_seconds?: number | null
          next_send_eligible_at?: string | null
          notes?: string | null
          oauth_access_token?: string | null
          oauth_expires_at?: string | null
          oauth_refresh_token?: string | null
          owner_id?: string | null
          provider_id?: string | null
          provider_type?:
            | Database["public"]["Enums"]["mailbox_provider_type"]
            | null
          reply_to_email?: string | null
          sender_name?: string | null
          sending_health?: Database["public"]["Enums"]["sending_health"] | null
          signature?: string | null
          slow_ramp_enabled?: boolean | null
          smtp_host?: string | null
          smtp_password_encrypted?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_username?: string | null
          tags?: string[] | null
          tracking_cname_target?: string | null
          tracking_cname_verified?: boolean | null
          tracking_domain?: string | null
          tracking_last_checked_at?: string | null
          tracking_ssl_verified?: boolean | null
          tracking_subdomain?: string | null
          updated_at?: string | null
          warmup_enabled?: boolean | null
          warmup_progress?: number | null
          warmup_started_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mailboxes_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "sending_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mailboxes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "email_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mailboxes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: string | null
          attendee_ids: string[] | null
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          deal_id: string | null
          description: string | null
          duration_minutes: number | null
          end_time: string
          external_attendees: Json | null
          id: string
          location: string | null
          meeting_type: string | null
          meeting_url: string | null
          next_steps: string | null
          notes: string | null
          organizer_id: string | null
          outcome: string | null
          owner_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          agenda?: string | null
          attendee_ids?: string[] | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time: string
          external_attendees?: Json | null
          id?: string
          location?: string | null
          meeting_type?: string | null
          meeting_url?: string | null
          next_steps?: string | null
          notes?: string | null
          organizer_id?: string | null
          outcome?: string | null
          owner_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          agenda?: string | null
          attendee_ids?: string[] | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string
          external_attendees?: Json | null
          id?: string
          location?: string | null
          meeting_type?: string | null
          meeting_url?: string | null
          next_steps?: string | null
          notes?: string | null
          organizer_id?: string | null
          outcome?: string | null
          owner_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      merge_history: {
        Row: {
          created_at: string
          duplicate_group_id: string | null
          entity_type: string
          field_selections: Json
          id: string
          merge_summary: Json | null
          merged_record_ids: string[]
          performed_by: string | null
          surviving_record_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          duplicate_group_id?: string | null
          entity_type?: string
          field_selections?: Json
          id?: string
          merge_summary?: Json | null
          merged_record_ids?: string[]
          performed_by?: string | null
          surviving_record_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          duplicate_group_id?: string | null
          entity_type?: string
          field_selections?: Json
          id?: string
          merge_summary?: Json | null
          merged_record_ids?: string[]
          performed_by?: string | null
          surviving_record_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merge_history_duplicate_group_id_fkey"
            columns: ["duplicate_group_id"]
            isOneToOne: false
            referencedRelation: "duplicate_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merge_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string | null
          enrollment_id: string | null
          id: string
          last_error: string | null
          mailbox_id: string | null
          max_attempts: number
          payload: Json
          priority: number
          queue_type: string
          reference_id: string | null
          reference_type: string | null
          scheduled_for: string
          sequence_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["queue_item_status"]
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          last_error?: string | null
          mailbox_id?: string | null
          max_attempts?: number
          payload: Json
          priority?: number
          queue_type: string
          reference_id?: string | null
          reference_type?: string | null
          scheduled_for?: string
          sequence_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["queue_item_status"]
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          last_error?: string | null
          mailbox_id?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          queue_type?: string
          reference_id?: string | null
          reference_type?: string | null
          scheduled_for?: string
          sequence_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["queue_item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_queue_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_queue_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      personalization_variables: {
        Row: {
          company_id: string | null
          confidence_score: number | null
          contact_id: string | null
          created_at: string | null
          id: string
          source: string | null
          variable_key: string
          variable_value: string | null
          workspace_id: string | null
        }
        Insert: {
          company_id?: string | null
          confidence_score?: number | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          source?: string | null
          variable_key: string
          variable_value?: string | null
          workspace_id?: string | null
        }
        Update: {
          company_id?: string | null
          confidence_score?: number | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          source?: string | null
          variable_key?: string
          variable_value?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personalization_variables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personalization_variables_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personalization_variables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          default_probability: number | null
          description: string | null
          display_order: number | null
          entity_type: string
          forecast_category: string | null
          id: string
          is_active: boolean | null
          is_closed: boolean | null
          is_won: boolean | null
          pipeline_id: string | null
          pipeline_name: string
          rotting_days: number | null
          stage_key: string
          stage_name: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_probability?: number | null
          description?: string | null
          display_order?: number | null
          entity_type: string
          forecast_category?: string | null
          id?: string
          is_active?: boolean | null
          is_closed?: boolean | null
          is_won?: boolean | null
          pipeline_id?: string | null
          pipeline_name?: string
          rotting_days?: number | null
          stage_key: string
          stage_name: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_probability?: number | null
          description?: string | null
          display_order?: number | null
          entity_type?: string
          forecast_category?: string | null
          id?: string
          is_active?: boolean | null
          is_closed?: boolean | null
          is_won?: boolean | null
          pipeline_id?: string | null
          pipeline_name?: string
          rotting_days?: number | null
          stage_key?: string
          stage_name?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          entity_type: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entity_type: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entity_type?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      prospect_research_profiles: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          id: string
          pain_points: string | null
          recent_signals: string | null
          research_status: Database["public"]["Enums"]["research_status"]
          summary: string | null
          updated_at: string | null
          value_props: string | null
          workspace_id: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          pain_points?: string | null
          recent_signals?: string | null
          research_status?: Database["public"]["Enums"]["research_status"]
          summary?: string | null
          updated_at?: string | null
          value_props?: string | null
          workspace_id?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          pain_points?: string | null
          recent_signals?: string | null
          research_status?: Database["public"]["Enums"]["research_status"]
          summary?: string | null
          updated_at?: string | null
          value_props?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_research_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_research_profiles_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_research_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_research_sources: {
        Row: {
          created_at: string | null
          id: string
          research_profile_id: string
          source_content: string | null
          source_title: string | null
          source_type: Database["public"]["Enums"]["research_source_type"]
          source_url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          research_profile_id: string
          source_content?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["research_source_type"]
          source_url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          research_profile_id?: string
          source_content?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["research_source_type"]
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_research_sources_research_profile_id_fkey"
            columns: ["research_profile_id"]
            isOneToOne: false
            referencedRelation: "prospect_research_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_behavior: {
        Row: {
          accept_rate: number | null
          accepts: number | null
          avg_latency_ms: number | null
          avg_retry_delay_seconds: number | null
          bounce_rate: number | null
          bounces: number | null
          catch_all_count: number | null
          greylist_rate: number | null
          greylists: number | null
          id: string
          last_seen_at: string | null
          provider_type: string
          recommended_concurrency: number | null
          rejects: number | null
          reliability_score: number | null
          top_responses: Json | null
          total_verifications: number | null
          updated_at: string
        }
        Insert: {
          accept_rate?: number | null
          accepts?: number | null
          avg_latency_ms?: number | null
          avg_retry_delay_seconds?: number | null
          bounce_rate?: number | null
          bounces?: number | null
          catch_all_count?: number | null
          greylist_rate?: number | null
          greylists?: number | null
          id?: string
          last_seen_at?: string | null
          provider_type: string
          recommended_concurrency?: number | null
          rejects?: number | null
          reliability_score?: number | null
          top_responses?: Json | null
          total_verifications?: number | null
          updated_at?: string
        }
        Update: {
          accept_rate?: number | null
          accepts?: number | null
          avg_latency_ms?: number | null
          avg_retry_delay_seconds?: number | null
          bounce_rate?: number | null
          bounces?: number | null
          catch_all_count?: number | null
          greylist_rate?: number | null
          greylists?: number | null
          id?: string
          last_seen_at?: string | null
          provider_type?: string
          recommended_concurrency?: number | null
          rejects?: number | null
          reliability_score?: number | null
          top_responses?: Json | null
          total_verifications?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_behavior_logs: {
        Row: {
          behavior_type: string
          details: Json | null
          domain: string
          id: string
          mx_provider: string | null
          observed_at: string
          sample_email: string | null
          smtp_code: number | null
          smtp_response: string | null
        }
        Insert: {
          behavior_type: string
          details?: Json | null
          domain: string
          id?: string
          mx_provider?: string | null
          observed_at?: string
          sample_email?: string | null
          smtp_code?: number | null
          smtp_response?: string | null
        }
        Update: {
          behavior_type?: string
          details?: Json | null
          domain?: string
          id?: string
          mx_provider?: string | null
          observed_at?: string
          sample_email?: string | null
          smtp_code?: number | null
          smtp_response?: string | null
        }
        Relationships: []
      }
      provider_behavior_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          provider_type: string
          rule_key: string
          rule_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          provider_type: string
          rule_key: string
          rule_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          provider_type?: string
          rule_key?: string
          rule_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      provider_connection_logs: {
        Row: {
          connection_id: string
          created_at: string
          event_message: string | null
          event_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          connection_id: string
          created_at?: string
          event_message?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          connection_id?: string
          created_at?: string
          event_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_connection_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "provider_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_connections: {
        Row: {
          account_email: string | null
          account_name: string
          connection_status: Database["public"]["Enums"]["provider_connection_status"]
          created_at: string
          created_by: string | null
          daily_connect_limit: number | null
          daily_message_limit: number | null
          default_daily_limit: number | null
          from_email: string | null
          from_name: string | null
          health_state: string | null
          id: string
          imap_host: string | null
          imap_port: number | null
          last_sync_at: string | null
          last_validated_at: string | null
          notes: string | null
          oauth_metadata: Json | null
          profile_url: string | null
          provider_type: Database["public"]["Enums"]["provider_type"]
          smtp_host: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_username: string | null
          token_status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_email?: string | null
          account_name: string
          connection_status?: Database["public"]["Enums"]["provider_connection_status"]
          created_at?: string
          created_by?: string | null
          daily_connect_limit?: number | null
          daily_message_limit?: number | null
          default_daily_limit?: number | null
          from_email?: string | null
          from_name?: string | null
          health_state?: string | null
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          last_sync_at?: string | null
          last_validated_at?: string | null
          notes?: string | null
          oauth_metadata?: Json | null
          profile_url?: string | null
          provider_type: Database["public"]["Enums"]["provider_type"]
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_username?: string | null
          token_status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_email?: string | null
          account_name?: string
          connection_status?: Database["public"]["Enums"]["provider_connection_status"]
          created_at?: string
          created_by?: string | null
          daily_connect_limit?: number | null
          daily_message_limit?: number | null
          default_daily_limit?: number | null
          from_email?: string | null
          from_name?: string | null
          health_state?: string | null
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          last_sync_at?: string | null
          last_validated_at?: string | null
          notes?: string | null
          oauth_metadata?: Json | null
          profile_url?: string | null
          provider_type?: Database["public"]["Enums"]["provider_type"]
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_username?: string | null
          token_status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_profiles: {
        Row: {
          banner_patterns: string[]
          connect_timeout_ms: number
          created_at: string
          display_name: string
          extended_timeout_ms: number
          greylisting_strategy: string
          helo_rotation: boolean
          id: string
          max_concurrency: number
          mx_patterns: string[]
          notes: string | null
          per_domain_delay_ms: number
          provider_key: string
          retry_base_seconds: number
          retry_multiplier: number
          smtp_timeout_ms: number
          updated_at: string
        }
        Insert: {
          banner_patterns?: string[]
          connect_timeout_ms?: number
          created_at?: string
          display_name: string
          extended_timeout_ms?: number
          greylisting_strategy?: string
          helo_rotation?: boolean
          id?: string
          max_concurrency?: number
          mx_patterns?: string[]
          notes?: string | null
          per_domain_delay_ms?: number
          provider_key: string
          retry_base_seconds?: number
          retry_multiplier?: number
          smtp_timeout_ms?: number
          updated_at?: string
        }
        Update: {
          banner_patterns?: string[]
          connect_timeout_ms?: number
          created_at?: string
          display_name?: string
          extended_timeout_ms?: number
          greylisting_strategy?: string
          helo_rotation?: boolean
          id?: string
          max_concurrency?: number
          mx_patterns?: string[]
          notes?: string | null
          per_domain_delay_ms?: number
          provider_key?: string
          retry_base_seconds?: number
          retry_multiplier?: number
          smtp_timeout_ms?: number
          updated_at?: string
        }
        Relationships: []
      }
      provider_validation_results: {
        Row: {
          connection_id: string
          error_message: string | null
          id: string
          passed: boolean
          validated_at: string
          validation_type: string
        }
        Insert: {
          connection_id: string
          error_message?: string | null
          id?: string
          passed?: boolean
          validated_at?: string
          validation_type: string
        }
        Update: {
          connection_id?: string
          error_message?: string | null
          id?: string
          passed?: boolean
          validated_at?: string
          validation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_validation_results_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "provider_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          entity_type: string
          filter_definition: Json
          id: string
          is_pinned: boolean | null
          last_used_at: string | null
          name: string
          updated_at: string | null
          usage_count: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entity_type?: string
          filter_definition?: Json
          id?: string
          is_pinned?: boolean | null
          last_used_at?: string | null
          name: string
          updated_at?: string | null
          usage_count?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entity_type?: string
          filter_definition?: Json
          id?: string
          is_pinned?: boolean | null
          last_used_at?: string | null
          name?: string
          updated_at?: string | null
          usage_count?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          columns: Json | null
          created_at: string | null
          created_by: string | null
          entity_type: string
          filters: Json
          id: string
          is_default: boolean
          name: string
          sort_by: string | null
          sort_direction: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          columns?: Json | null
          created_at?: string | null
          created_by?: string | null
          entity_type: string
          filters?: Json
          id?: string
          is_default?: boolean
          name: string
          sort_by?: string | null
          sort_direction?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          columns?: Json | null
          created_at?: string | null
          created_by?: string | null
          entity_type?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name?: string
          sort_by?: string | null
          sort_direction?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sending_daily_counts: {
        Row: {
          count: number
          created_at: string | null
          id: string
          mailbox_id: string
          send_date: string
        }
        Insert: {
          count?: number
          created_at?: string | null
          id?: string
          mailbox_id: string
          send_date?: string
        }
        Update: {
          count?: number
          created_at?: string | null
          id?: string
          mailbox_id?: string
          send_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "sending_daily_counts_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      sending_domains: {
        Row: {
          created_at: string | null
          created_by: string | null
          daily_sending_limit: number | null
          dkim_status: Database["public"]["Enums"]["dns_record_status"]
          dmarc_status: Database["public"]["Enums"]["dns_record_status"]
          domain_name: string
          id: string
          notes: string | null
          owner_id: string | null
          sending_health: Database["public"]["Enums"]["sending_health"] | null
          spf_status: Database["public"]["Enums"]["dns_record_status"]
          status: Database["public"]["Enums"]["domain_status"]
          updated_at: string | null
          verification_details: Json | null
          warmup_enabled: boolean | null
          warmup_progress: number | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          daily_sending_limit?: number | null
          dkim_status?: Database["public"]["Enums"]["dns_record_status"]
          dmarc_status?: Database["public"]["Enums"]["dns_record_status"]
          domain_name: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          sending_health?: Database["public"]["Enums"]["sending_health"] | null
          spf_status?: Database["public"]["Enums"]["dns_record_status"]
          status?: Database["public"]["Enums"]["domain_status"]
          updated_at?: string | null
          verification_details?: Json | null
          warmup_enabled?: boolean | null
          warmup_progress?: number | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          daily_sending_limit?: number | null
          dkim_status?: Database["public"]["Enums"]["dns_record_status"]
          dmarc_status?: Database["public"]["Enums"]["dns_record_status"]
          domain_name?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          sending_health?: Database["public"]["Enums"]["sending_health"] | null
          spf_status?: Database["public"]["Enums"]["dns_record_status"]
          status?: Database["public"]["Enums"]["domain_status"]
          updated_at?: string | null
          verification_details?: Json | null
          warmup_enabled?: boolean | null
          warmup_progress?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sending_domains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sending_windows: {
        Row: {
          created_at: string | null
          end_hour: number
          id: string
          is_active: boolean | null
          name: string | null
          start_hour: number
          timezone: string
          weekdays_only: boolean | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          end_hour?: number
          id?: string
          is_active?: boolean | null
          name?: string | null
          start_hour?: number
          timezone?: string
          weekdays_only?: boolean | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          end_hour?: number
          id?: string
          is_active?: boolean | null
          name?: string | null
          start_hour?: number
          timezone?: string
          weekdays_only?: boolean | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sending_windows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_enrollments: {
        Row: {
          completed_at: string | null
          contact_id: string
          current_step_order: number
          enrolled_at: string | null
          enrolled_by: string | null
          exit_reason: string | null
          id: string
          last_activity_at: string | null
          metadata: Json | null
          next_step_at: string | null
          paused_at: string | null
          sequence_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          current_step_order?: number
          enrolled_at?: string | null
          enrolled_by?: string | null
          exit_reason?: string | null
          id?: string
          last_activity_at?: string | null
          metadata?: Json | null
          next_step_at?: string | null
          paused_at?: string | null
          sequence_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          current_step_order?: number
          enrolled_at?: string | null
          enrolled_by?: string | null
          exit_reason?: string | null
          id?: string
          last_activity_at?: string | null
          metadata?: Json | null
          next_step_at?: string | null
          paused_at?: string | null
          sequence_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_safety_rules: {
        Row: {
          cooldown_days: number
          created_at: string | null
          id: string
          max_emails_per_contact: number
          max_emails_per_domain: number
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          cooldown_days?: number
          created_at?: string | null
          id?: string
          max_emails_per_contact?: number
          max_emails_per_domain?: number
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          cooldown_days?: number
          created_at?: string | null
          id?: string
          max_emails_per_contact?: number
          max_emails_per_domain?: number
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_safety_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          ab_variant: string | null
          call_instructions: string | null
          campaign_id: string | null
          conditions: Json | null
          created_at: string | null
          delay_days: number
          delay_hours: number
          delay_minutes: number
          email_body: string | null
          email_subject: string | null
          id: string
          is_active: boolean | null
          label: string
          linkedin_action: string | null
          linkedin_message: string | null
          sequence_id: string
          sms_body: string | null
          step_order: number
          step_type: string
          task_instructions: string | null
          updated_at: string | null
          variable_template: Json | null
          workspace_id: string | null
        }
        Insert: {
          ab_variant?: string | null
          call_instructions?: string | null
          campaign_id?: string | null
          conditions?: Json | null
          created_at?: string | null
          delay_days?: number
          delay_hours?: number
          delay_minutes?: number
          email_body?: string | null
          email_subject?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          linkedin_action?: string | null
          linkedin_message?: string | null
          sequence_id: string
          sms_body?: string | null
          step_order: number
          step_type: string
          task_instructions?: string | null
          updated_at?: string | null
          variable_template?: Json | null
          workspace_id?: string | null
        }
        Update: {
          ab_variant?: string | null
          call_instructions?: string | null
          campaign_id?: string | null
          conditions?: Json | null
          created_at?: string | null
          delay_days?: number
          delay_hours?: number
          delay_minutes?: number
          email_body?: string | null
          email_subject?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          linkedin_action?: string | null
          linkedin_message?: string | null
          sequence_id?: string
          sms_body?: string | null
          step_order?: number
          step_type?: string
          task_instructions?: string | null
          updated_at?: string | null
          variable_template?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          exit_conditions: Json | null
          id: string
          max_enrollments: number | null
          name: string
          owner_id: string | null
          schedule_config: Json | null
          shared_with: string[] | null
          status: Database["public"]["Enums"]["sequence_status"]
          tags: string[] | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          exit_conditions?: Json | null
          id?: string
          max_enrollments?: number | null
          name: string
          owner_id?: string | null
          schedule_config?: Json | null
          shared_with?: string[] | null
          status?: Database["public"]["Enums"]["sequence_status"]
          tags?: string[] | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          exit_conditions?: Json | null
          id?: string
          max_enrollments?: number | null
          name?: string
          owner_id?: string | null
          schedule_config?: Json | null
          shared_with?: string[] | null
          status?: Database["public"]["Enums"]["sequence_status"]
          tags?: string[] | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      smtp_patterns: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          inferred_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          last_seen_at: string | null
          occurrences: number | null
          provider_type: string
          response_pattern: string
          smtp_code: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          inferred_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          last_seen_at?: string | null
          occurrences?: number | null
          provider_type: string
          response_pattern: string
          smtp_code?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          inferred_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          last_seen_at?: string | null
          occurrences?: number | null
          provider_type?: string
          response_pattern?: string
          smtp_code?: number | null
        }
        Relationships: []
      }
      smtp_session_log: {
        Row: {
          banner: string | null
          captured_at: string
          disconnect_reason: string | null
          domain: string | null
          email: string
          helo_used: string | null
          id: string
          latency_ms: number | null
          mx_host: string | null
          pass_number: number | null
          provider_key: string | null
          response_code: number | null
          response_text: string | null
          result_id: string | null
          tls_used: boolean | null
          workspace_id: string | null
        }
        Insert: {
          banner?: string | null
          captured_at?: string
          disconnect_reason?: string | null
          domain?: string | null
          email: string
          helo_used?: string | null
          id?: string
          latency_ms?: number | null
          mx_host?: string | null
          pass_number?: number | null
          provider_key?: string | null
          response_code?: number | null
          response_text?: string | null
          result_id?: string | null
          tls_used?: boolean | null
          workspace_id?: string | null
        }
        Update: {
          banner?: string | null
          captured_at?: string
          disconnect_reason?: string | null
          domain?: string | null
          email?: string
          helo_used?: string | null
          id?: string
          latency_ms?: number | null
          mx_host?: string | null
          pass_number?: number | null
          provider_key?: string | null
          response_code?: number | null
          response_text?: string | null
          result_id?: string | null
          tls_used?: boolean | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smtp_session_log_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "verification_results"
            referencedColumns: ["id"]
          },
        ]
      }
      suppression_list: {
        Row: {
          added_by: string | null
          created_at: string
          email_normalized: string
          expires_at: string | null
          id: string
          notes: string | null
          reason: string
          source: string
          workspace_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email_normalized: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          reason?: string
          source?: string
          workspace_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email_normalized?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          reason?: string
          source?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppression_list_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      system_activity_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          performed_by?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          enrollment_id: string | null
          id: string
          owner_id: string | null
          priority: string
          sequence_id: string | null
          sequence_step_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: string
          title: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          owner_id?: string | null
          priority?: string
          sequence_id?: string | null
          sequence_step_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: string
          title: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          owner_id?: string | null
          priority?: string
          sequence_id?: string | null
          sequence_step_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: string
          title?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sequence_step_id_fkey"
            columns: ["sequence_step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      unknown_reason_stats: {
        Row: {
          day: string
          id: string
          provider_key: string
          reason_code: string
          recovered: number
          recovery_rate: number | null
          total: number
          updated_at: string
        }
        Insert: {
          day: string
          id?: string
          provider_key: string
          reason_code: string
          recovered?: number
          recovery_rate?: number | null
          total?: number
          updated_at?: string
        }
        Update: {
          day?: string
          id?: string
          provider_key?: string
          reason_code?: string
          recovered?: number
          recovery_rate?: number | null
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_workspace_preferences: {
        Row: {
          active_workspace_id: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_workspace_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_workspace_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_workspace_preferences_active_workspace_id_fkey"
            columns: ["active_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json
          target_id: string | null
          target_type: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_cache: {
        Row: {
          cached_until: string
          confidence: number | null
          domain: string | null
          email_normalized: string
          engine_version: string | null
          hit_count: number
          id: string
          is_catch_all: boolean | null
          is_disposable: boolean | null
          is_free_provider: boolean | null
          is_role_based: boolean | null
          mx_provider: string | null
          mx_record: string | null
          raw_response: Json | null
          risk_reasons: string[]
          smtp_code: number | null
          smtp_response: string | null
          source_engine: string | null
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
          verified_at: string
        }
        Insert: {
          cached_until?: string
          confidence?: number | null
          domain?: string | null
          email_normalized: string
          engine_version?: string | null
          hit_count?: number
          id?: string
          is_catch_all?: boolean | null
          is_disposable?: boolean | null
          is_free_provider?: boolean | null
          is_role_based?: boolean | null
          mx_provider?: string | null
          mx_record?: string | null
          raw_response?: Json | null
          risk_reasons?: string[]
          smtp_code?: number | null
          smtp_response?: string | null
          source_engine?: string | null
          status: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          verified_at?: string
        }
        Update: {
          cached_until?: string
          confidence?: number | null
          domain?: string | null
          email_normalized?: string
          engine_version?: string | null
          hit_count?: number
          id?: string
          is_catch_all?: boolean | null
          is_disposable?: boolean | null
          is_free_provider?: boolean | null
          is_role_based?: boolean | null
          mx_provider?: string | null
          mx_record?: string | null
          raw_response?: Json | null
          risk_reasons?: string[]
          smtp_code?: number | null
          smtp_response?: string | null
          source_engine?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          verified_at?: string
        }
        Relationships: []
      }
      verification_dead_letter: {
        Row: {
          attempt_count: number
          email: string
          escalated_at: string
          id: string
          job_id: string | null
          last_error: string | null
          payload: Json
          reason: string
          recovered_at: string | null
          result_id: string | null
          workspace_id: string
        }
        Insert: {
          attempt_count?: number
          email: string
          escalated_at?: string
          id?: string
          job_id?: string | null
          last_error?: string | null
          payload?: Json
          reason: string
          recovered_at?: string | null
          result_id?: string | null
          workspace_id: string
        }
        Update: {
          attempt_count?: number
          email?: string
          escalated_at?: string
          id?: string
          job_id?: string | null
          last_error?: string | null
          payload?: Json
          reason?: string
          recovered_at?: string | null
          result_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_dead_letter_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "verification_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_dead_letter_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "verification_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_dead_letter_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_engine_runs: {
        Row: {
          confidence: number | null
          created_at: string
          engine_name: string
          engine_version: string | null
          error: string | null
          id: string
          latency_ms: number | null
          response: Json
          result_id: string
          status: Database["public"]["Enums"]["verification_status"] | null
          workspace_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          engine_name: string
          engine_version?: string | null
          error?: string | null
          id?: string
          latency_ms?: number | null
          response?: Json
          result_id: string
          status?: Database["public"]["Enums"]["verification_status"] | null
          workspace_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          engine_name?: string
          engine_version?: string | null
          error?: string | null
          id?: string
          latency_ms?: number | null
          response?: Json
          result_id?: string
          status?: Database["public"]["Enums"]["verification_status"] | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_engine_runs_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "verification_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_engine_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_engines: {
        Row: {
          avg_latency_ms: number | null
          config: Json
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["verification_engine_kind"]
          last_heartbeat_at: string | null
          name: string
          notes: string | null
          priority: number
          status: Database["public"]["Enums"]["verification_worker_status"]
          success_rate: number | null
          total_runs: number
          updated_at: string
          version: string | null
        }
        Insert: {
          avg_latency_ms?: number | null
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["verification_engine_kind"]
          last_heartbeat_at?: string | null
          name: string
          notes?: string | null
          priority?: number
          status?: Database["public"]["Enums"]["verification_worker_status"]
          success_rate?: number | null
          total_runs?: number
          updated_at?: string
          version?: string | null
        }
        Update: {
          avg_latency_ms?: number | null
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["verification_engine_kind"]
          last_heartbeat_at?: string | null
          name?: string
          notes?: string | null
          priority?: number
          status?: Database["public"]["Enums"]["verification_worker_status"]
          success_rate?: number | null
          total_runs?: number
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      verification_events: {
        Row: {
          created_at: string
          details: Json | null
          email_normalized: string
          event_type: string
          id: string
          previous_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          provider_type: string | null
          smtp_code: number | null
          smtp_response: string | null
          source: Database["public"]["Enums"]["verification_source"] | null
          status: Database["public"]["Enums"]["verification_status"] | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          email_normalized: string
          event_type: string
          id?: string
          previous_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          provider_type?: string | null
          smtp_code?: number | null
          smtp_response?: string | null
          source?: Database["public"]["Enums"]["verification_source"] | null
          status?: Database["public"]["Enums"]["verification_status"] | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          email_normalized?: string
          event_type?: string
          id?: string
          previous_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          provider_type?: string | null
          smtp_code?: number | null
          smtp_response?: string | null
          source?: Database["public"]["Enums"]["verification_source"] | null
          status?: Database["public"]["Enums"]["verification_status"] | null
          workspace_id?: string
        }
        Relationships: []
      }
      verification_jobs: {
        Row: {
          avg_latency_ms: number | null
          cache_hit_rate: number | null
          cached_hit_count: number
          campaign_id: string | null
          catch_all_count: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          dead_letter_count: number
          disposable_count: number
          error_message: string | null
          failed_count: number
          id: string
          invalid_count: number
          list_id: string | null
          list_quality_score: number | null
          max_retries: number
          name: string | null
          priority: number
          processed_count: number
          rate_limit_per_min: number
          risky_count: number
          role_based_count: number
          safe_count: number
          source: Database["public"]["Enums"]["verification_job_source"]
          source_columns: Json | null
          source_file_name: string | null
          source_file_path: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["verification_job_status"]
          total_count: number
          unknown_count: number
          updated_at: string
          valid_count: number
          verification_quality:
            | Database["public"]["Enums"]["verification_quality_mode"]
            | null
          workspace_id: string
        }
        Insert: {
          avg_latency_ms?: number | null
          cache_hit_rate?: number | null
          cached_hit_count?: number
          campaign_id?: string | null
          catch_all_count?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dead_letter_count?: number
          disposable_count?: number
          error_message?: string | null
          failed_count?: number
          id?: string
          invalid_count?: number
          list_id?: string | null
          list_quality_score?: number | null
          max_retries?: number
          name?: string | null
          priority?: number
          processed_count?: number
          rate_limit_per_min?: number
          risky_count?: number
          role_based_count?: number
          safe_count?: number
          source?: Database["public"]["Enums"]["verification_job_source"]
          source_columns?: Json | null
          source_file_name?: string | null
          source_file_path?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["verification_job_status"]
          total_count?: number
          unknown_count?: number
          updated_at?: string
          valid_count?: number
          verification_quality?:
            | Database["public"]["Enums"]["verification_quality_mode"]
            | null
          workspace_id: string
        }
        Update: {
          avg_latency_ms?: number | null
          cache_hit_rate?: number | null
          cached_hit_count?: number
          campaign_id?: string | null
          catch_all_count?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dead_letter_count?: number
          disposable_count?: number
          error_message?: string | null
          failed_count?: number
          id?: string
          invalid_count?: number
          list_id?: string | null
          list_quality_score?: number | null
          max_retries?: number
          name?: string | null
          priority?: number
          processed_count?: number
          rate_limit_per_min?: number
          risky_count?: number
          role_based_count?: number
          safe_count?: number
          source?: Database["public"]["Enums"]["verification_job_source"]
          source_columns?: Json | null
          source_file_name?: string | null
          source_file_path?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["verification_job_status"]
          total_count?: number
          unknown_count?: number
          updated_at?: string
          valid_count?: number
          verification_quality?:
            | Database["public"]["Enums"]["verification_quality_mode"]
            | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_quality_logs: {
        Row: {
          avg_latency_ms: number | null
          created_at: string
          greylist_detected: number | null
          id: string
          job_id: string | null
          quality_mode: Database["public"]["Enums"]["verification_quality_mode"]
          retry_success: number | null
          retry_total: number | null
          total_processed: number | null
          unknown_recovery_attempts: number | null
          unknown_recovery_success: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          avg_latency_ms?: number | null
          created_at?: string
          greylist_detected?: number | null
          id?: string
          job_id?: string | null
          quality_mode?: Database["public"]["Enums"]["verification_quality_mode"]
          retry_success?: number | null
          retry_total?: number | null
          total_processed?: number | null
          unknown_recovery_attempts?: number | null
          unknown_recovery_success?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          avg_latency_ms?: number | null
          created_at?: string
          greylist_detected?: number | null
          id?: string
          job_id?: string | null
          quality_mode?: Database["public"]["Enums"]["verification_quality_mode"]
          retry_success?: number | null
          retry_total?: number | null
          total_processed?: number | null
          unknown_recovery_attempts?: number | null
          unknown_recovery_success?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      verification_quotas: {
        Row: {
          abuse_flagged: boolean
          abuse_reason: string | null
          created_at: string
          daily_limit: number
          day_reset_at: string
          month_reset_at: string
          monthly_limit: number
          updated_at: string
          used_month: number
          used_today: number
          workspace_id: string
        }
        Insert: {
          abuse_flagged?: boolean
          abuse_reason?: string | null
          created_at?: string
          daily_limit?: number
          day_reset_at?: string
          month_reset_at?: string
          monthly_limit?: number
          updated_at?: string
          used_month?: number
          used_today?: number
          workspace_id: string
        }
        Update: {
          abuse_flagged?: boolean
          abuse_reason?: string | null
          created_at?: string
          daily_limit?: number
          day_reset_at?: string
          month_reset_at?: string
          monthly_limit?: number
          updated_at?: string
          used_month?: number
          used_today?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_quotas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_recovery_queue: {
        Row: {
          attempt_count: number
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          domain: string | null
          email: string
          id: string
          job_id: string | null
          last_error: string | null
          last_smtp_code: number | null
          last_smtp_message: string | null
          next_attempt_at: string
          pass_number: number
          provider_key: string
          reason_code: string
          result_id: string
          state: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempt_count?: number
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          domain?: string | null
          email: string
          id?: string
          job_id?: string | null
          last_error?: string | null
          last_smtp_code?: number | null
          last_smtp_message?: string | null
          next_attempt_at?: string
          pass_number: number
          provider_key?: string
          reason_code: string
          result_id: string
          state?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempt_count?: number
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          domain?: string | null
          email?: string
          id?: string
          job_id?: string | null
          last_error?: string | null
          last_smtp_code?: number | null
          last_smtp_message?: string | null
          next_attempt_at?: string
          pass_number?: number
          provider_key?: string
          reason_code?: string
          result_id?: string
          state?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_recovery_queue_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "verification_results"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_results: {
        Row: {
          ai_confidence: number | null
          ai_risk_score: number | null
          attempt_count: number
          behavioral_signals: Json
          bounce_risk_score: number | null
          cached_until: string | null
          catch_all_probability: number | null
          confidence: number | null
          confidence_decay_score: number | null
          contact_id: string | null
          created_at: string
          current_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          dead_letter: boolean
          deliverability_score: number | null
          did_you_mean: string | null
          disconnect_reason: string | null
          domain: string | null
          domain_reputation_score: number | null
          email: string
          email_normalized: string | null
          engagement_correlation: number | null
          engine_conflict: boolean
          engine_consensus_score: number | null
          engine_latency_ms: number | null
          engine_version: string | null
          error_message: string | null
          fallback_engine: string | null
          freshness_label:
            | Database["public"]["Enums"]["verification_freshness"]
            | null
          from_cache: boolean
          greylisting_detected: boolean | null
          historical_outcome_score: number | null
          historical_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          id: string
          is_catch_all: boolean | null
          is_disposable: boolean | null
          is_free_provider: boolean | null
          is_role_based: boolean | null
          job_id: string
          last_attempt_at: string | null
          last_bounce_at: string | null
          last_campaign_sent_at: string | null
          last_open_at: string | null
          last_recovery_at: string | null
          last_reply_at: string | null
          last_seen_valid_at: string | null
          last_verified_at: string | null
          mx_provider: string | null
          mx_record: string | null
          mx_status: string | null
          next_recheck_at: string | null
          next_retry_at: string | null
          primary_engine: string | null
          priority: number
          probe_metadata: Json
          processing_started_at: string | null
          provider_key: string | null
          provider_reputation_score: number | null
          provider_type: string | null
          raw_response: Json | null
          recheck_attempts: number | null
          recheck_required: boolean | null
          recovery_passes: number
          retry_count: number
          risk_level:
            | Database["public"]["Enums"]["verification_risk_tier"]
            | null
          risk_reasons: string[]
          smtp_banner: string | null
          smtp_code: number | null
          smtp_response: string | null
          smtp_result: string | null
          source_engine: string | null
          status: Database["public"]["Enums"]["verification_status"]
          status_changed_at: string | null
          tls_supported: boolean | null
          unknown_confidence: string | null
          unknown_reason: string | null
          verification_mode: string | null
          verification_quality:
            | Database["public"]["Enums"]["verification_quality_mode"]
            | null
          verification_reason: string | null
          verification_source:
            | Database["public"]["Enums"]["verification_source"]
            | null
          verified_at: string | null
          worker_id: string | null
          workspace_id: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_risk_score?: number | null
          attempt_count?: number
          behavioral_signals?: Json
          bounce_risk_score?: number | null
          cached_until?: string | null
          catch_all_probability?: number | null
          confidence?: number | null
          confidence_decay_score?: number | null
          contact_id?: string | null
          created_at?: string
          current_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          dead_letter?: boolean
          deliverability_score?: number | null
          did_you_mean?: string | null
          disconnect_reason?: string | null
          domain?: string | null
          domain_reputation_score?: number | null
          email: string
          email_normalized?: string | null
          engagement_correlation?: number | null
          engine_conflict?: boolean
          engine_consensus_score?: number | null
          engine_latency_ms?: number | null
          engine_version?: string | null
          error_message?: string | null
          fallback_engine?: string | null
          freshness_label?:
            | Database["public"]["Enums"]["verification_freshness"]
            | null
          from_cache?: boolean
          greylisting_detected?: boolean | null
          historical_outcome_score?: number | null
          historical_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          id?: string
          is_catch_all?: boolean | null
          is_disposable?: boolean | null
          is_free_provider?: boolean | null
          is_role_based?: boolean | null
          job_id: string
          last_attempt_at?: string | null
          last_bounce_at?: string | null
          last_campaign_sent_at?: string | null
          last_open_at?: string | null
          last_recovery_at?: string | null
          last_reply_at?: string | null
          last_seen_valid_at?: string | null
          last_verified_at?: string | null
          mx_provider?: string | null
          mx_record?: string | null
          mx_status?: string | null
          next_recheck_at?: string | null
          next_retry_at?: string | null
          primary_engine?: string | null
          priority?: number
          probe_metadata?: Json
          processing_started_at?: string | null
          provider_key?: string | null
          provider_reputation_score?: number | null
          provider_type?: string | null
          raw_response?: Json | null
          recheck_attempts?: number | null
          recheck_required?: boolean | null
          recovery_passes?: number
          retry_count?: number
          risk_level?:
            | Database["public"]["Enums"]["verification_risk_tier"]
            | null
          risk_reasons?: string[]
          smtp_banner?: string | null
          smtp_code?: number | null
          smtp_response?: string | null
          smtp_result?: string | null
          source_engine?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          status_changed_at?: string | null
          tls_supported?: boolean | null
          unknown_confidence?: string | null
          unknown_reason?: string | null
          verification_mode?: string | null
          verification_quality?:
            | Database["public"]["Enums"]["verification_quality_mode"]
            | null
          verification_reason?: string | null
          verification_source?:
            | Database["public"]["Enums"]["verification_source"]
            | null
          verified_at?: string | null
          worker_id?: string | null
          workspace_id: string
        }
        Update: {
          ai_confidence?: number | null
          ai_risk_score?: number | null
          attempt_count?: number
          behavioral_signals?: Json
          bounce_risk_score?: number | null
          cached_until?: string | null
          catch_all_probability?: number | null
          confidence?: number | null
          confidence_decay_score?: number | null
          contact_id?: string | null
          created_at?: string
          current_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          dead_letter?: boolean
          deliverability_score?: number | null
          did_you_mean?: string | null
          disconnect_reason?: string | null
          domain?: string | null
          domain_reputation_score?: number | null
          email?: string
          email_normalized?: string | null
          engagement_correlation?: number | null
          engine_conflict?: boolean
          engine_consensus_score?: number | null
          engine_latency_ms?: number | null
          engine_version?: string | null
          error_message?: string | null
          fallback_engine?: string | null
          freshness_label?:
            | Database["public"]["Enums"]["verification_freshness"]
            | null
          from_cache?: boolean
          greylisting_detected?: boolean | null
          historical_outcome_score?: number | null
          historical_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          id?: string
          is_catch_all?: boolean | null
          is_disposable?: boolean | null
          is_free_provider?: boolean | null
          is_role_based?: boolean | null
          job_id?: string
          last_attempt_at?: string | null
          last_bounce_at?: string | null
          last_campaign_sent_at?: string | null
          last_open_at?: string | null
          last_recovery_at?: string | null
          last_reply_at?: string | null
          last_seen_valid_at?: string | null
          last_verified_at?: string | null
          mx_provider?: string | null
          mx_record?: string | null
          mx_status?: string | null
          next_recheck_at?: string | null
          next_retry_at?: string | null
          primary_engine?: string | null
          priority?: number
          probe_metadata?: Json
          processing_started_at?: string | null
          provider_key?: string | null
          provider_reputation_score?: number | null
          provider_type?: string | null
          raw_response?: Json | null
          recheck_attempts?: number | null
          recheck_required?: boolean | null
          recovery_passes?: number
          retry_count?: number
          risk_level?:
            | Database["public"]["Enums"]["verification_risk_tier"]
            | null
          risk_reasons?: string[]
          smtp_banner?: string | null
          smtp_code?: number | null
          smtp_response?: string | null
          smtp_result?: string | null
          source_engine?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          status_changed_at?: string | null
          tls_supported?: boolean | null
          unknown_confidence?: string | null
          unknown_reason?: string | null
          verification_mode?: string | null
          verification_quality?:
            | Database["public"]["Enums"]["verification_quality_mode"]
            | null
          verification_reason?: string | null
          verification_source?:
            | Database["public"]["Enums"]["verification_source"]
            | null
          verified_at?: string | null
          worker_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_results_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "verification_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_results_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_workers: {
        Row: {
          avg_latency_ms: number | null
          claimed_batch_size: number | null
          created_at: string
          host: string | null
          id: string
          in_flight_count: number | null
          last_error: string | null
          last_heartbeat_at: string | null
          metadata: Json
          status: Database["public"]["Enums"]["verification_worker_status"]
          total_processed: number
          updated_at: string
          version: string | null
          worker_id: string
        }
        Insert: {
          avg_latency_ms?: number | null
          claimed_batch_size?: number | null
          created_at?: string
          host?: string | null
          id?: string
          in_flight_count?: number | null
          last_error?: string | null
          last_heartbeat_at?: string | null
          metadata?: Json
          status?: Database["public"]["Enums"]["verification_worker_status"]
          total_processed?: number
          updated_at?: string
          version?: string | null
          worker_id: string
        }
        Update: {
          avg_latency_ms?: number | null
          claimed_batch_size?: number | null
          created_at?: string
          host?: string | null
          id?: string
          in_flight_count?: number | null
          last_error?: string | null
          last_heartbeat_at?: string | null
          metadata?: Json
          status?: Database["public"]["Enums"]["verification_worker_status"]
          total_processed?: number
          updated_at?: string
          version?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      worker_activity_logs: {
        Row: {
          cpu_pct: number | null
          created_at: string
          details: Json | null
          error_message: string | null
          event_type: string
          host: string | null
          id: string
          in_flight: number | null
          mem_mb: number | null
          throughput: number | null
          version: string | null
          worker_id: string
        }
        Insert: {
          cpu_pct?: number | null
          created_at?: string
          details?: Json | null
          error_message?: string | null
          event_type: string
          host?: string | null
          id?: string
          in_flight?: number | null
          mem_mb?: number | null
          throughput?: number | null
          version?: string | null
          worker_id: string
        }
        Update: {
          cpu_pct?: number | null
          created_at?: string
          details?: Json | null
          error_message?: string | null
          event_type?: string
          host?: string | null
          id?: string
          in_flight?: number | null
          mem_mb?: number | null
          throughput?: number | null
          version?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      workspace_kpis: {
        Row: {
          campaigns_active: number | null
          contacts_enrolled: number | null
          created_at: string | null
          deals_created: number | null
          emails_sent: number | null
          id: string
          meetings_booked: number | null
          period_end: string
          period_start: string
          replies_received: number | null
          revenue_generated: number | null
          workspace_id: string
        }
        Insert: {
          campaigns_active?: number | null
          contacts_enrolled?: number | null
          created_at?: string | null
          deals_created?: number | null
          emails_sent?: number | null
          id?: string
          meetings_booked?: number | null
          period_end: string
          period_start: string
          replies_received?: number | null
          revenue_generated?: number | null
          workspace_id: string
        }
        Update: {
          campaigns_active?: number | null
          contacts_enrolled?: number | null
          created_at?: string | null
          deals_created?: number | null
          emails_sent?: number | null
          id?: string
          meetings_booked?: number | null
          period_end?: string
          period_start?: string
          replies_received?: number | null
          revenue_generated?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_kpis_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          logo_url: string | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      email_queue_health_v: {
        Row: {
          completed_24h: number | null
          failed: number | null
          in_flight: number | null
          oldest_pending_at: string | null
          waiting: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mailboxes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_campaign_stats_v: {
        Row: {
          campaign_id: string | null
          connected: number | null
          connects_sent: number | null
          leads_total: number | null
          meetings: number | null
          messages_sent: number | null
          queued_actions: number | null
          replies: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_queue_health_v: {
        Row: {
          count: number | null
          last_updated_at: string | null
          oldest_scheduled_at: string | null
          status: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_action_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assert_email_allowed: { Args: never; Returns: undefined }
      bump_provider_behavior: {
        Args: {
          _latency_ms?: number
          _provider: string
          _smtp_response?: string
          _status: Database["public"]["Enums"]["verification_status"]
        }
        Returns: undefined
      }
      check_campaign_list_safety: {
        Args: { _campaign_id: string }
        Returns: Json
      }
      check_email_send_eligibility: {
        Args: { _email: string; _workspace_id: string }
        Returns: Json
      }
      check_mailbox_readiness: { Args: { p_mailbox_id: string }; Returns: Json }
      claim_recovery_batch: {
        Args: { _limit?: number; _worker_id: string }
        Returns: {
          attempt_count: number
          connect_timeout_ms: number
          domain: string
          email: string
          extended_timeout_ms: number
          greylisting_strategy: string
          helo_rotation: boolean
          id: string
          job_id: string
          pass_number: number
          per_domain_delay_ms: number
          provider_key: string
          reason_code: string
          result_id: string
          smtp_timeout_ms: number
          workspace_id: string
        }[]
      }
      claim_verification_batch: {
        Args: { _limit?: number }
        Returns: {
          domain: string
          email: string
          job_id: string
          provider_hint: string
          quality_mode: Database["public"]["Enums"]["verification_quality_mode"]
          recommended_concurrency: number
          result_id: string
          retry_delay_seconds: number
          workspace_id: string
        }[]
      }
      classify_inbound_message: {
        Args: { p_body: string; p_subject: string }
        Returns: Database["public"]["Enums"]["reply_category"]
      }
      classify_unknown_confidence: {
        Args: { _pass: number; _provider: string; _reason: string }
        Returns: string
      }
      classify_unknown_reason: {
        Args: { _err: string; _smtp_code: number; _smtp_text: string }
        Returns: string
      }
      complete_recovery: {
        Args: {
          _banner?: string
          _disconnect_reason?: string
          _helo_used?: string
          _id: string
          _latency: number
          _mx_host?: string
          _smtp_code: number
          _smtp_text: string
          _status: string
          _tls_used?: boolean
        }
        Returns: Json
      }
      compute_catch_all_probability: {
        Args: { _domain: string }
        Returns: number
      }
      compute_decay: {
        Args: { _confidence: number; _last_verified_at: string }
        Returns: number
      }
      compute_deliverability_score: {
        Args: { _result_id: string }
        Returns: number
      }
      compute_domain_intelligence: {
        Args: { _domain: string }
        Returns: number
      }
      compute_domain_risk: { Args: { _domain: string }; Returns: Json }
      compute_freshness: {
        Args: { _last_verified_at: string }
        Returns: Database["public"]["Enums"]["verification_freshness"]
      }
      compute_list_health: { Args: { _job_id: string }; Returns: Json }
      compute_provider_reputation: {
        Args: { _provider: string }
        Returns: number
      }
      compute_recheck_required: {
        Args: {
          _confidence_decay: number
          _is_catch_all: boolean
          _last_verified_at: string
          _status: Database["public"]["Enums"]["verification_status"]
        }
        Returns: boolean
      }
      consume_verification_quota: {
        Args: { _count: number; _workspace_id: string }
        Returns: Json
      }
      create_workspace_for_user: {
        Args: { p_name: string; p_user_id: string }
        Returns: Json
      }
      decide_verification_strategy: {
        Args: { _email: string; _workspace_id: string }
        Returns: Json
      }
      detect_provider: {
        Args: { _banner: string; _mx: string }
        Returns: string
      }
      enqueue_recovery: {
        Args: {
          _reason: string
          _result_id: string
          _smtp_code: number
          _smtp_text: string
        }
        Returns: undefined
      }
      enqueue_verification_job:
        | {
            Args: {
              _campaign_id?: string
              _emails: string[]
              _list_id?: string
              _name: string
              _source?: Database["public"]["Enums"]["verification_job_source"]
              _workspace_id: string
            }
            Returns: string
          }
        | {
            Args: {
              _campaign_id?: string
              _emails: string[]
              _list_id?: string
              _name: string
              _quality?: Database["public"]["Enums"]["verification_quality_mode"]
              _source?: Database["public"]["Enums"]["verification_job_source"]
              _workspace_id: string
            }
            Returns: string
          }
      enrollment_should_stop_for_reply: {
        Args: { _enrollment_id: string }
        Returns: boolean
      }
      generate_workspace_slug: { Args: { p_name: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_daily_send_count: {
        Args: { p_limit: number; p_mailbox_id: string }
        Returns: boolean
      }
      ingest_bounce_feedback: {
        Args: {
          _bounce_type: string
          _email: string
          _raw?: Json
          _smtp_code: number
          _smtp_response: string
          _source?: string
          _workspace_id: string
        }
        Returns: undefined
      }
      intelligence_rollup: { Args: never; Returns: Json }
      is_email_allowed: { Args: { p_email: string }; Returns: boolean }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_sending_window_open: { Args: { _window_id: string }; Returns: boolean }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member_or_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      linkedin_account_in_window: {
        Args: { _account_id: string }
        Returns: boolean
      }
      linkedin_account_remaining_capacity: {
        Args: { _account_id: string; _action_type: string }
        Returns: number
      }
      linkedin_block_action: {
        Args: { _queue_id: string; _reason: string }
        Returns: undefined
      }
      linkedin_check_connection_status: {
        Args: { _contact_id: string; _workspace_id: string }
        Returns: string
      }
      linkedin_claim_due_actions: {
        Args: { _limit?: number }
        Returns: {
          action_type: Database["public"]["Enums"]["linkedin_action_type"]
          campaign_id: string | null
          campaign_step_id: string | null
          contact_id: string
          created_at: string | null
          error_message: string | null
          executed_at: string | null
          id: string
          linkedin_account_id: string
          payload: Json
          priority: number
          retry_count: number
          scheduled_at: string | null
          status: Database["public"]["Enums"]["linkedin_queue_status"]
          updated_at: string
          variant_id: string | null
          workflow_node_id: string | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "linkedin_action_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      linkedin_contact_on_stoplist: {
        Args: { _contact_id: string; _workspace_id: string }
        Returns: boolean
      }
      linkedin_count_workflow_nodes: {
        Args: { _campaign_id: string }
        Returns: number
      }
      linkedin_enroll_leads: {
        Args: { _campaign_id: string; _contact_ids: string[] }
        Returns: Json
      }
      linkedin_enroll_leads_v2: {
        Args: {
          _campaign_id: string
          _contact_ids: string[]
          _only_new?: boolean
        }
        Returns: Json
      }
      linkedin_has_active_adapter: {
        Args: { _workspace_id: string }
        Returns: boolean
      }
      linkedin_launch_campaign: {
        Args: { _campaign_id: string; _mode?: string }
        Returns: Json
      }
      linkedin_pick_sender: { Args: { _campaign_id: string }; Returns: string }
      linkedin_pick_variant: { Args: { _node_id: string }; Returns: string }
      linkedin_record_action_result: {
        Args: {
          _error?: string
          _max_retries?: number
          _outcome: string
          _provider_response?: Json
          _queue_id: string
        }
        Returns: Json
      }
      linkedin_schedule_next_action: {
        Args: { _lead_id: string }
        Returns: Json
      }
      linkedin_schedule_next_action_v2: {
        Args: {
          _condition?: Database["public"]["Enums"]["linkedin_edge_condition"]
          _lead_id: string
        }
        Returns: Json
      }
      linkedin_transition_lead: {
        Args: { _action: string; _lead_id: string; _reason?: string }
        Returns: Json
      }
      linkedin_workflow_next_node: {
        Args: {
          _condition?: Database["public"]["Enums"]["linkedin_edge_condition"]
          _node_id: string
        }
        Returns: string
      }
      linkedin_workflow_validate: {
        Args: { _campaign_id: string }
        Returns: Json
      }
      log_activity: {
        Args: {
          p_activity_type: Database["public"]["Enums"]["activity_type"]
          p_company_id?: string
          p_contact_id?: string
          p_deal_id?: string
          p_description?: string
          p_metadata?: Json
          p_performed_by?: string
          p_source_id?: string
          p_source_type?: string
          p_title: string
          p_workspace_id: string
        }
        Returns: string
      }
      pick_campaign_mailbox: { Args: { _campaign_id: string }; Returns: string }
      record_bounce: {
        Args: {
          _campaign_id?: string
          _category: Database["public"]["Enums"]["bounce_category"]
          _email: string
          _provider?: string
          _smtp_code?: number
          _smtp_response?: string
          _workspace_id: string
        }
        Returns: Json
      }
      record_bounce_outcome: {
        Args: {
          _category: string
          _email: string
          _provider?: string
          _smtp_code: number
          _workspace_id: string
        }
        Returns: undefined
      }
      record_engagement: {
        Args: { _email: string; _event: string; _workspace_id: string }
        Returns: undefined
      }
      record_smtp_pattern: {
        Args: {
          _inferred: Database["public"]["Enums"]["verification_status"]
          _provider: string
          _response: string
          _smtp_code: number
        }
        Returns: undefined
      }
      record_verification_result: {
        Args: {
          _confidence?: number
          _did_you_mean?: string
          _engine_version?: string
          _error?: string
          _is_catch_all?: boolean
          _is_disposable?: boolean
          _is_free_provider?: boolean
          _is_role_based?: boolean
          _mx_provider?: string
          _mx_record?: string
          _raw?: Json
          _result_id: string
          _risk_reasons?: string[]
          _smtp_code?: number
          _smtp_response?: string
          _source_engine?: string
          _status: Database["public"]["Enums"]["verification_status"]
        }
        Returns: Json
      }
      recover_stuck_verification_jobs: { Args: never; Returns: Json }
      recovery_metrics: { Args: never; Returns: Json }
      recovery_rollup_tick: { Args: never; Returns: undefined }
      refresh_email_freshness_batch: {
        Args: { _limit?: number }
        Returns: number
      }
      retry_verification_result: {
        Args: { _error: string; _result_id: string }
        Returns: undefined
      }
      schedule_recheck: {
        Args: { _reason: string; _result_id: string }
        Returns: Json
      }
      sweep_due_rechecks: { Args: { _limit?: number }; Returns: number }
      user_workspace_ids: { Args: never; Returns: string[] }
      worker_heartbeat: {
        Args: {
          _avg_latency?: number
          _batch_size?: number
          _host?: string
          _in_flight?: number
          _last_error?: string
          _metadata?: Json
          _status?: Database["public"]["Enums"]["verification_worker_status"]
          _version?: string
          _worker_id: string
        }
        Returns: string
      }
      workspace_role: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      workspace_verification_overview: {
        Args: { _workspace_id: string }
        Returns: Json
      }
    }
    Enums: {
      activity_type:
        | "email_sent"
        | "email_opened"
        | "email_clicked"
        | "email_replied"
        | "email_bounced"
        | "call_made"
        | "call_received"
        | "meeting_scheduled"
        | "meeting_completed"
        | "meeting_cancelled"
        | "task_created"
        | "task_completed"
        | "deal_created"
        | "deal_stage_changed"
        | "deal_won"
        | "deal_lost"
        | "note_added"
        | "contact_created"
        | "contact_updated"
        | "contact_merged"
        | "company_created"
        | "company_updated"
        | "sequence_enrolled"
        | "sequence_completed"
        | "sequence_replied"
        | "list_added"
        | "list_removed"
        | "field_changed"
        | "custom"
      ai_prompt_type:
        | "research"
        | "email_personalization"
        | "linkedin_message"
        | "summary"
      app_role: "admin" | "manager" | "operator" | "viewer"
      attribution_type: "first_touch" | "last_touch" | "multi_touch"
      bounce_category:
        | "hard_bounce"
        | "soft_bounce"
        | "mailbox_full"
        | "spam_block"
        | "greylisted"
        | "invalid_recipient"
        | "policy_block"
        | "temporary_failure"
      call_outcome:
        | "no_answer"
        | "voicemail"
        | "connected"
        | "interested"
        | "not_interested"
        | "callback"
        | "wrong_number"
      campaign_contact_status:
        | "pending"
        | "sent"
        | "replied"
        | "bounced"
        | "opted_out"
        | "meeting_booked"
      campaign_enrollment_status: "pending" | "active" | "completed" | "stopped"
      campaign_status: "draft" | "active" | "paused" | "completed"
      campaign_step_execution_status:
        | "scheduled"
        | "completed"
        | "skipped"
        | "failed"
      campaign_step_type:
        | "email"
        | "linkedin_connect"
        | "linkedin_message"
        | "task"
        | "delay"
      classification_source: "rule" | "ai" | "manual"
      connection_status: "active" | "disconnected" | "warming" | "error"
      deal_status: "open" | "won" | "lost" | "abandoned"
      dns_record_status: "pending" | "pass" | "fail"
      domain_status: "pending" | "verified" | "failed"
      duplicate_group_status: "pending" | "reviewing" | "resolved" | "dismissed"
      email_status:
        | "draft"
        | "queued"
        | "processing"
        | "sent_mock"
        | "sent"
        | "failed"
        | "bounced"
      email_validity:
        | "unknown"
        | "valid"
        | "invalid"
        | "catch_all"
        | "disposable"
        | "role_based"
      enrollment_status:
        | "active"
        | "paused"
        | "completed"
        | "bounced"
        | "replied"
        | "opted_out"
        | "failed"
      export_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      export_type: "filtered" | "selected" | "list" | "saved_search" | "full"
      generated_content_type:
        | "email_subject"
        | "email_body"
        | "linkedin_message"
        | "summary"
      generation_status: "pending" | "generating" | "completed" | "failed"
      historical_import_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "partial"
      import_row_status:
        | "pending"
        | "success"
        | "error"
        | "skipped"
        | "duplicate"
        | "review"
      import_status:
        | "pending"
        | "mapping"
        | "validating"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      inbox_thread_status: "open" | "snoozed" | "closed" | "archived"
      lifecycle_status:
        | "new"
        | "researching"
        | "qualified"
        | "nurturing"
        | "engaged"
        | "converted"
        | "churned"
        | "archived"
      linkedin_action_type:
        | "connect"
        | "message"
        | "view_profile"
        | "follow_up_message"
        | "manual_task"
        | "wait"
        | "inmail"
        | "like_post"
        | "comment_post"
        | "endorse_skills"
        | "withdraw_request"
      linkedin_connection_status:
        | "connected"
        | "disconnected"
        | "pending_setup"
        | "paused"
      linkedin_edge_condition:
        | "default"
        | "connected"
        | "not_connected"
        | "accepted"
        | "declined"
        | "timeout"
        | "replied"
        | "no_reply"
        | "opened"
        | "not_opened"
        | "success"
        | "failure"
      linkedin_node_type:
        | "start"
        | "visit_profile"
        | "connect_request"
        | "wait_for_connection"
        | "message"
        | "inmail"
        | "like_post"
        | "comment_post"
        | "endorse_skills"
        | "withdraw_request"
        | "time_delay"
        | "manual_task"
        | "end"
      linkedin_queue_status:
        | "pending"
        | "scheduled"
        | "completed"
        | "failed"
        | "blocked"
        | "paused"
      linkedin_variant_metric:
        | "reply_rate"
        | "acceptance_rate"
        | "positive_reply"
      linkedin_variant_strategy: "even_then_winner" | "even" | "weighted"
      mailbox_provider_type: "google" | "microsoft" | "smtp" | "other"
      meeting_status: "scheduled" | "completed" | "cancelled" | "no_show"
      merge_status: "candidate" | "merged" | "kept_separate" | "skipped"
      outreach_status:
        | "not_contacted"
        | "queued"
        | "contacted"
        | "replied"
        | "bounced"
        | "opted_out"
        | "unresponsive"
      phone_status: "verified" | "invalid" | "unknown" | "do_not_call"
      provider_connection_status:
        | "connected"
        | "disconnected"
        | "needs_reauth"
        | "invalid_credentials"
        | "pending_validation"
      provider_type: "google_workspace" | "microsoft_365" | "smtp" | "linkedin"
      queue_item_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      reply_category:
        | "lead"
        | "interested"
        | "not_interested"
        | "meeting_booked"
        | "meeting_completed"
        | "won"
        | "auto_reply"
        | "bounce"
        | "neutral"
        | "unknown"
      research_source_type: "website" | "linkedin" | "manual" | "crm" | "notes"
      research_status: "pending" | "completed" | "failed"
      sending_health: "unknown" | "good" | "warning" | "poor"
      sequence_status: "draft" | "active" | "paused" | "archived"
      task_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "skipped"
        | "cancelled"
      verification_engine_kind: "primary" | "fallback" | "consensus" | "ai"
      verification_freshness:
        | "fresh"
        | "aging"
        | "stale"
        | "expired"
        | "reverified"
      verification_job_source:
        | "csv_upload"
        | "import_clean"
        | "campaign_precheck"
        | "single_lookup"
        | "api"
        | "recheck"
      verification_job_status:
        | "pending"
        | "processing"
        | "partial"
        | "completed"
        | "failed"
        | "cancelled"
      verification_quality_mode:
        | "standard"
        | "high"
        | "fast"
        | "balanced"
        | "high_accuracy"
      verification_risk_tier: "low" | "medium" | "high" | "critical"
      verification_source:
        | "live"
        | "historical"
        | "imported_legacy"
        | "api"
        | "recheck"
      verification_status:
        | "safe"
        | "valid"
        | "invalid"
        | "risky"
        | "catch_all"
        | "disposable"
        | "role_based"
        | "unknown"
        | "suppressed"
        | "failed"
        | "ok"
        | "ok_for_all"
        | "email_disabled"
        | "invalid_syntax"
        | "dead_server"
        | "invalid_mx"
        | "antispam_system"
        | "smtp_protocol"
        | "spamtrap"
        | "greylisted"
        | "temporary_failure"
        | "provider_blocked"
      verification_worker_status: "online" | "idle" | "degraded" | "offline"
      warmup_status: "off" | "active" | "paused" | "complete"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "email_sent",
        "email_opened",
        "email_clicked",
        "email_replied",
        "email_bounced",
        "call_made",
        "call_received",
        "meeting_scheduled",
        "meeting_completed",
        "meeting_cancelled",
        "task_created",
        "task_completed",
        "deal_created",
        "deal_stage_changed",
        "deal_won",
        "deal_lost",
        "note_added",
        "contact_created",
        "contact_updated",
        "contact_merged",
        "company_created",
        "company_updated",
        "sequence_enrolled",
        "sequence_completed",
        "sequence_replied",
        "list_added",
        "list_removed",
        "field_changed",
        "custom",
      ],
      ai_prompt_type: [
        "research",
        "email_personalization",
        "linkedin_message",
        "summary",
      ],
      app_role: ["admin", "manager", "operator", "viewer"],
      attribution_type: ["first_touch", "last_touch", "multi_touch"],
      bounce_category: [
        "hard_bounce",
        "soft_bounce",
        "mailbox_full",
        "spam_block",
        "greylisted",
        "invalid_recipient",
        "policy_block",
        "temporary_failure",
      ],
      call_outcome: [
        "no_answer",
        "voicemail",
        "connected",
        "interested",
        "not_interested",
        "callback",
        "wrong_number",
      ],
      campaign_contact_status: [
        "pending",
        "sent",
        "replied",
        "bounced",
        "opted_out",
        "meeting_booked",
      ],
      campaign_enrollment_status: ["pending", "active", "completed", "stopped"],
      campaign_status: ["draft", "active", "paused", "completed"],
      campaign_step_execution_status: [
        "scheduled",
        "completed",
        "skipped",
        "failed",
      ],
      campaign_step_type: [
        "email",
        "linkedin_connect",
        "linkedin_message",
        "task",
        "delay",
      ],
      classification_source: ["rule", "ai", "manual"],
      connection_status: ["active", "disconnected", "warming", "error"],
      deal_status: ["open", "won", "lost", "abandoned"],
      dns_record_status: ["pending", "pass", "fail"],
      domain_status: ["pending", "verified", "failed"],
      duplicate_group_status: ["pending", "reviewing", "resolved", "dismissed"],
      email_status: [
        "draft",
        "queued",
        "processing",
        "sent_mock",
        "sent",
        "failed",
        "bounced",
      ],
      email_validity: [
        "unknown",
        "valid",
        "invalid",
        "catch_all",
        "disposable",
        "role_based",
      ],
      enrollment_status: [
        "active",
        "paused",
        "completed",
        "bounced",
        "replied",
        "opted_out",
        "failed",
      ],
      export_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      export_type: ["filtered", "selected", "list", "saved_search", "full"],
      generated_content_type: [
        "email_subject",
        "email_body",
        "linkedin_message",
        "summary",
      ],
      generation_status: ["pending", "generating", "completed", "failed"],
      historical_import_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "partial",
      ],
      import_row_status: [
        "pending",
        "success",
        "error",
        "skipped",
        "duplicate",
        "review",
      ],
      import_status: [
        "pending",
        "mapping",
        "validating",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      inbox_thread_status: ["open", "snoozed", "closed", "archived"],
      lifecycle_status: [
        "new",
        "researching",
        "qualified",
        "nurturing",
        "engaged",
        "converted",
        "churned",
        "archived",
      ],
      linkedin_action_type: [
        "connect",
        "message",
        "view_profile",
        "follow_up_message",
        "manual_task",
        "wait",
        "inmail",
        "like_post",
        "comment_post",
        "endorse_skills",
        "withdraw_request",
      ],
      linkedin_connection_status: [
        "connected",
        "disconnected",
        "pending_setup",
        "paused",
      ],
      linkedin_edge_condition: [
        "default",
        "connected",
        "not_connected",
        "accepted",
        "declined",
        "timeout",
        "replied",
        "no_reply",
        "opened",
        "not_opened",
        "success",
        "failure",
      ],
      linkedin_node_type: [
        "start",
        "visit_profile",
        "connect_request",
        "wait_for_connection",
        "message",
        "inmail",
        "like_post",
        "comment_post",
        "endorse_skills",
        "withdraw_request",
        "time_delay",
        "manual_task",
        "end",
      ],
      linkedin_queue_status: [
        "pending",
        "scheduled",
        "completed",
        "failed",
        "blocked",
        "paused",
      ],
      linkedin_variant_metric: [
        "reply_rate",
        "acceptance_rate",
        "positive_reply",
      ],
      linkedin_variant_strategy: ["even_then_winner", "even", "weighted"],
      mailbox_provider_type: ["google", "microsoft", "smtp", "other"],
      meeting_status: ["scheduled", "completed", "cancelled", "no_show"],
      merge_status: ["candidate", "merged", "kept_separate", "skipped"],
      outreach_status: [
        "not_contacted",
        "queued",
        "contacted",
        "replied",
        "bounced",
        "opted_out",
        "unresponsive",
      ],
      phone_status: ["verified", "invalid", "unknown", "do_not_call"],
      provider_connection_status: [
        "connected",
        "disconnected",
        "needs_reauth",
        "invalid_credentials",
        "pending_validation",
      ],
      provider_type: ["google_workspace", "microsoft_365", "smtp", "linkedin"],
      queue_item_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      reply_category: [
        "lead",
        "interested",
        "not_interested",
        "meeting_booked",
        "meeting_completed",
        "won",
        "auto_reply",
        "bounce",
        "neutral",
        "unknown",
      ],
      research_source_type: ["website", "linkedin", "manual", "crm", "notes"],
      research_status: ["pending", "completed", "failed"],
      sending_health: ["unknown", "good", "warning", "poor"],
      sequence_status: ["draft", "active", "paused", "archived"],
      task_status: [
        "pending",
        "in_progress",
        "completed",
        "skipped",
        "cancelled",
      ],
      verification_engine_kind: ["primary", "fallback", "consensus", "ai"],
      verification_freshness: [
        "fresh",
        "aging",
        "stale",
        "expired",
        "reverified",
      ],
      verification_job_source: [
        "csv_upload",
        "import_clean",
        "campaign_precheck",
        "single_lookup",
        "api",
        "recheck",
      ],
      verification_job_status: [
        "pending",
        "processing",
        "partial",
        "completed",
        "failed",
        "cancelled",
      ],
      verification_quality_mode: [
        "standard",
        "high",
        "fast",
        "balanced",
        "high_accuracy",
      ],
      verification_risk_tier: ["low", "medium", "high", "critical"],
      verification_source: [
        "live",
        "historical",
        "imported_legacy",
        "api",
        "recheck",
      ],
      verification_status: [
        "safe",
        "valid",
        "invalid",
        "risky",
        "catch_all",
        "disposable",
        "role_based",
        "unknown",
        "suppressed",
        "failed",
        "ok",
        "ok_for_all",
        "email_disabled",
        "invalid_syntax",
        "dead_server",
        "invalid_mx",
        "antispam_system",
        "smtp_protocol",
        "spamtrap",
        "greylisted",
        "temporary_failure",
        "provider_blocked",
      ],
      verification_worker_status: ["online", "idle", "degraded", "offline"],
      warmup_status: ["off", "active", "paused", "complete"],
    },
  },
} as const
