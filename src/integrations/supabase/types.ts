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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: []
      }
      api_request_log: {
        Row: {
          api_key_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          ip: string | null
          method: string
          path: string
          status: number
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          ip?: string | null
          method: string
          path: string
          status?: number
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          ip?: string | null
          method?: string
          path?: string
          status?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_request_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      attribution_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          phone_e164: string
          provider: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          phone_e164: string
          provider: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          phone_e164?: string
          provider?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          created_at: string
          holidays: Json
          id: string
          name: string
          schedule: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          holidays?: Json
          id?: string
          name: string
          schedule?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          holidays?: Json
          id?: string
          name?: string
          schedule?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          call_id: string
          id: string
          joined_at: string | null
          left_at: string | null
          state: string
          user_id: string
        }
        Insert: {
          call_id: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          state?: string
          user_id: string
        }
        Update: {
          call_id?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_queues: {
        Row: {
          active: boolean
          announce_position: boolean
          created_at: string
          description: string | null
          hold_music: string | null
          id: string
          max_wait_seconds: number
          name: string
          overflow_action: string
          overflow_target: string | null
          priority: number
          ring_seconds: number
          strategy: string
          updated_at: string
          wrap_seconds: number
        }
        Insert: {
          active?: boolean
          announce_position?: boolean
          created_at?: string
          description?: string | null
          hold_music?: string | null
          id?: string
          max_wait_seconds?: number
          name: string
          overflow_action?: string
          overflow_target?: string | null
          priority?: number
          ring_seconds?: number
          strategy?: string
          updated_at?: string
          wrap_seconds?: number
        }
        Update: {
          active?: boolean
          announce_position?: boolean
          created_at?: string
          description?: string | null
          hold_music?: string | null
          id?: string
          max_wait_seconds?: number
          name?: string
          overflow_action?: string
          overflow_target?: string | null
          priority?: number
          ring_seconds?: number
          strategy?: string
          updated_at?: string
          wrap_seconds?: number
        }
        Relationships: []
      }
      call_sessions: {
        Row: {
          answered_at: string | null
          conversation_id: string | null
          duration_seconds: number
          ended_at: string | null
          external_number: string | null
          id: string
          initiator_id: string | null
          kind: string
          metadata: Json
          provider: string | null
          provider_call_id: string | null
          recording_url: string | null
          scope: string
          started_at: string
          status: string
        }
        Insert: {
          answered_at?: string | null
          conversation_id?: string | null
          duration_seconds?: number
          ended_at?: string | null
          external_number?: string | null
          id?: string
          initiator_id?: string | null
          kind?: string
          metadata?: Json
          provider?: string | null
          provider_call_id?: string | null
          recording_url?: string | null
          scope?: string
          started_at?: string
          status?: string
        }
        Update: {
          answered_at?: string | null
          conversation_id?: string | null
          duration_seconds?: number
          ended_at?: string | null
          external_number?: string | null
          id?: string
          initiator_id?: string | null
          kind?: string
          metadata?: Json
          provider?: string | null
          provider_call_id?: string | null
          recording_url?: string | null
          scope?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      callbacks: {
        Row: {
          assigned_to: string | null
          attempts: number
          contact_id: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          detail: string | null
          id: string
          last_attempt_at: string | null
          notes: string | null
          outcome: string | null
          phone_e164: string
          queue_id: string | null
          reason: string
          requested_at: string
          scheduled_at: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attempts?: number
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          last_attempt_at?: string | null
          notes?: string | null
          outcome?: string | null
          phone_e164: string
          queue_id?: string | null
          reason?: string
          requested_at?: string
          scheduled_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attempts?: number
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          last_attempt_at?: string | null
          notes?: string | null
          outcome?: string | null
          phone_e164?: string
          queue_id?: string | null
          reason?: string
          requested_at?: string
          scheduled_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "callbacks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callbacks_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "call_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          external_ids: Json
          full_name: string
          id: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          source: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          external_ids?: Json
          full_name?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          source?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          external_ids?: Json
          full_name?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          source?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string
          member_role: string
          muted: boolean
          pinned: boolean
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string
          member_role?: string
          muted?: boolean
          pinned?: boolean
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string
          member_role?: string
          muted?: boolean
          pinned?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_initials: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_message_at: string
          last_message_preview: string
          name: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          avatar_initials?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          last_message_preview?: string
          name?: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          avatar_initials?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          last_message_preview?: string
          name?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dial_tasks: {
        Row: {
          assigned_to: string | null
          attempts: number
          campaign_id: string
          contact_id: string | null
          contact_name: string | null
          created_at: string
          id: string
          last_attempt_at: string | null
          last_outcome: string | null
          next_attempt_at: string | null
          notes: string | null
          phone_e164: string
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attempts?: number
          campaign_id: string
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_outcome?: string | null
          next_attempt_at?: string | null
          notes?: string | null
          phone_e164: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attempts?: number
          campaign_id?: string
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_outcome?: string | null
          next_attempt_at?: string | null
          notes?: string | null
          phone_e164?: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dial_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dialer_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dial_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      dialer_calls: {
        Row: {
          agent_user_id: string | null
          answered_at: string | null
          campaign_id: string | null
          contact_id: string | null
          contact_name: string | null
          created_at: string
          dial_task_id: string | null
          direction: string
          disposition: string | null
          ended_at: string | null
          from_number: string | null
          hold_seconds: number
          id: string
          muted: boolean
          notes: string | null
          on_hold: boolean
          phone_e164: string | null
          phone_number_id: string | null
          provider: string | null
          provider_call_id: string | null
          queue_id: string | null
          queued_at: string
          recording_url: string | null
          state: string
          talk_seconds: number
          to_number: string | null
          updated_at: string
          wait_seconds: number
        }
        Insert: {
          agent_user_id?: string | null
          answered_at?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          dial_task_id?: string | null
          direction?: string
          disposition?: string | null
          ended_at?: string | null
          from_number?: string | null
          hold_seconds?: number
          id?: string
          muted?: boolean
          notes?: string | null
          on_hold?: boolean
          phone_e164?: string | null
          phone_number_id?: string | null
          provider?: string | null
          provider_call_id?: string | null
          queue_id?: string | null
          queued_at?: string
          recording_url?: string | null
          state?: string
          talk_seconds?: number
          to_number?: string | null
          updated_at?: string
          wait_seconds?: number
        }
        Update: {
          agent_user_id?: string | null
          answered_at?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          dial_task_id?: string | null
          direction?: string
          disposition?: string | null
          ended_at?: string | null
          from_number?: string | null
          hold_seconds?: number
          id?: string
          muted?: boolean
          notes?: string | null
          on_hold?: boolean
          phone_e164?: string | null
          phone_number_id?: string | null
          provider?: string | null
          provider_call_id?: string | null
          queue_id?: string | null
          queued_at?: string
          recording_url?: string | null
          state?: string
          talk_seconds?: number
          to_number?: string | null
          updated_at?: string
          wait_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "dialer_calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dialer_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialer_calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialer_calls_dial_task_id_fkey"
            columns: ["dial_task_id"]
            isOneToOne: false
            referencedRelation: "dial_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialer_calls_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialer_calls_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "call_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      dialer_campaigns: {
        Row: {
          active: boolean
          caller_id: string | null
          calling_window_end: string
          calling_window_start: string
          created_at: string
          created_by: string | null
          id: string
          max_attempts: number
          mode: string
          name: string
          pacing: number
          queue_id: string | null
          retry_minutes: number
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          caller_id?: string | null
          calling_window_end?: string
          calling_window_start?: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_attempts?: number
          mode?: string
          name: string
          pacing?: number
          queue_id?: string | null
          retry_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          caller_id?: string | null
          calling_window_end?: string
          calling_window_start?: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_attempts?: number
          mode?: string
          name?: string
          pacing?: number
          queue_id?: string | null
          retry_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialer_campaigns_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "call_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      dnc_entries: {
        Row: {
          active: boolean
          added_by: string | null
          contact_name: string | null
          created_at: string
          id: string
          notes: string | null
          phone_e164: string
          reason: string
          released_at: string | null
          released_by: string | null
          scope: string
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          added_by?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phone_e164: string
          reason?: string
          released_at?: string | null
          released_by?: string | null
          scope?: string
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          added_by?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phone_e164?: string
          reason?: string
          released_at?: string | null
          released_by?: string | null
          scope?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      dnc_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          detail: Json
          entry_id: string | null
          id: string
          phone_e164: string
          reason: string | null
          source: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: Json
          entry_id?: string | null
          id?: string
          phone_e164: string
          reason?: string | null
          source?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: Json
          entry_id?: string | null
          id?: string
          phone_e164?: string
          reason?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "dnc_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "dnc_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          created_at: string
          direction: string
          error: string | null
          event_type: string
          id: string
          integration_id: string | null
          payload: Json
          provider: string
          response: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          direction?: string
          error?: string | null
          event_type?: string
          id?: string
          integration_id?: string | null
          payload?: Json
          provider: string
          response?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          direction?: string
          error?: string | null
          event_type?: string
          id?: string
          integration_id?: string | null
          payload?: Json
          provider?: string
          response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          auth_type: string
          base_url: string | null
          category: string
          config: Json
          created_at: string
          created_by: string | null
          direction: string
          enabled: boolean
          errors_24h: number
          events_24h: number
          id: string
          last_error: string | null
          last_sync_at: string | null
          name: string
          provider: string
          secret_name: string | null
          status: string
          updated_at: string
          webhook_token: string | null
        }
        Insert: {
          auth_type?: string
          base_url?: string | null
          category?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          direction?: string
          enabled?: boolean
          errors_24h?: number
          events_24h?: number
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          provider: string
          secret_name?: string | null
          status?: string
          updated_at?: string
          webhook_token?: string | null
        }
        Update: {
          auth_type?: string
          base_url?: string | null
          category?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          direction?: string
          enabled?: boolean
          errors_24h?: number
          events_24h?: number
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          provider?: string
          secret_name?: string | null
          status?: string
          updated_at?: string
          webhook_token?: string | null
        }
        Relationships: []
      }
      ivr_menus: {
        Row: {
          active: boolean
          created_at: string
          greeting: string
          id: string
          invalid_message: string
          max_retries: number
          name: string
          options: Json
          timeout_seconds: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          greeting?: string
          id?: string
          invalid_message?: string
          max_retries?: number
          name: string
          options?: Json
          timeout_seconds?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          greeting?: string
          id?: string
          invalid_message?: string
          max_retries?: number
          name?: string
          options?: Json
          timeout_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      journey_touches: {
        Row: {
          call_id: string | null
          created_at: string
          direction: string | null
          id: string
          journey_id: string
          occurred_at: string
          provider: string
          talk_seconds: number
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          direction?: string | null
          id?: string
          journey_id: string
          occurred_at?: string
          provider: string
          talk_seconds?: number
        }
        Update: {
          call_id?: string | null
          created_at?: string
          direction?: string | null
          id?: string
          journey_id?: string
          occurred_at?: string
          provider?: string
          talk_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "journey_touches_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "telephony_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_touches_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "lead_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_journeys: {
        Row: {
          attributed_provider: string | null
          callback_via_calltools: boolean
          contact_id: string | null
          created_at: string
          days_to_contact: number | null
          first_touch_at: string | null
          first_touch_provider: string | null
          id: string
          inbound_callgrid_count: number
          last_touch_at: string | null
          last_touch_provider: string | null
          outbound_calltools_count: number
          owner_id: string | null
          phone_e164: string
          total_attempts: number
          total_talk_seconds: number
          updated_at: string
        }
        Insert: {
          attributed_provider?: string | null
          callback_via_calltools?: boolean
          contact_id?: string | null
          created_at?: string
          days_to_contact?: number | null
          first_touch_at?: string | null
          first_touch_provider?: string | null
          id?: string
          inbound_callgrid_count?: number
          last_touch_at?: string | null
          last_touch_provider?: string | null
          outbound_calltools_count?: number
          owner_id?: string | null
          phone_e164: string
          total_attempts?: number
          total_talk_seconds?: number
          updated_at?: string
        }
        Update: {
          attributed_provider?: string | null
          callback_via_calltools?: boolean
          contact_id?: string | null
          created_at?: string
          days_to_contact?: number | null
          first_touch_at?: string | null
          first_touch_provider?: string | null
          id?: string
          inbound_callgrid_count?: number
          last_touch_at?: string | null
          last_touch_provider?: string | null
          outbound_calltools_count?: number
          owner_id?: string | null
          phone_e164?: string
          total_attempts?: number
          total_talk_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_journeys_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          days: number
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days?: number
          end_date: string
          id?: string
          leave_type: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: number
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_attendance: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          left_at: string | null
          meeting_id: string
          seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          meeting_id: string
          seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          meeting_id?: string
          seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          created_at: string
          email: string | null
          email_sent_at: string | null
          email_status: string
          id: string
          meeting_id: string
          name: string | null
          participant_role: string
          response: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          email_sent_at?: string | null
          email_status?: string
          id?: string
          meeting_id: string
          name?: string | null
          participant_role?: string
          response?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          email_sent_at?: string | null
          email_status?: string
          id?: string
          meeting_id?: string
          name?: string | null
          participant_role?: string
          response?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          action_items: Json
          agenda: Json
          created_at: string
          description: string | null
          duration_minutes: number
          ended_at: string | null
          host_id: string | null
          id: string
          notes: string | null
          recurrence: string
          recurrence_until: string | null
          room_code: string
          started_at: string | null
          starts_at: string
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          action_items?: Json
          agenda?: Json
          created_at?: string
          description?: string | null
          duration_minutes?: number
          ended_at?: string | null
          host_id?: string | null
          id?: string
          notes?: string | null
          recurrence?: string
          recurrence_until?: string | null
          room_code?: string
          started_at?: string | null
          starts_at: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_items?: Json
          agenda?: Json
          created_at?: string
          description?: string | null
          duration_minutes?: number
          ended_at?: string | null
          host_id?: string | null
          id?: string
          notes?: string | null
          recurrence?: string
          recurrence_until?: string | null
          room_code?: string
          started_at?: string | null
          starts_at?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          body: string
          call_direction: string | null
          call_duration: string | null
          call_missed: boolean | null
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          kind: string
          parent_id: string | null
          sender_id: string | null
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body?: string
          call_direction?: string | null
          call_duration?: string | null
          call_missed?: boolean | null
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          kind?: string
          parent_id?: string | null
          sender_id?: string | null
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body?: string
          call_direction?: string | null
          call_duration?: string | null
          call_missed?: boolean | null
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          kind?: string
          parent_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_candidates: {
        Row: {
          access_completed_at: string | null
          access_sent_at: string | null
          access_status: string
          address_line1: string | null
          address_line2: string | null
          agreement_sent_at: string | null
          agreement_signed_at: string | null
          agreement_status: string
          agreement_template: string | null
          agreement_viewed_at: string | null
          assigned_admin: string | null
          authorizations: Json
          banking: Json
          carrier: string | null
          carrier_decided_at: string | null
          carrier_notes: string | null
          carrier_requested_at: string | null
          carrier_status: string
          city: string | null
          completed_at: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          first_name: string
          form_progress: Json
          form_submitted_at: string | null
          hired_at: string | null
          id: string
          interview_at: string | null
          interview_completed_at: string | null
          interview_duration_minutes: number
          interview_link: string | null
          interview_notes: string | null
          last_activity_at: string
          last_name: string
          licensing: Json
          mailing_address_line1: string | null
          mailing_city: string | null
          mailing_same: boolean
          mailing_state: string | null
          mailing_zip: string | null
          middle_name: string | null
          not_hired_reason: string | null
          offer_sent_at: string | null
          offer_signed_at: string | null
          offer_status: string
          offer_template: string | null
          offer_viewed_at: string | null
          phone: string | null
          preferred_name: string | null
          sequence_paused: boolean
          source: string | null
          stage: string
          state: string | null
          updated_at: string
          user_id: string | null
          zip: string | null
        }
        Insert: {
          access_completed_at?: string | null
          access_sent_at?: string | null
          access_status?: string
          address_line1?: string | null
          address_line2?: string | null
          agreement_sent_at?: string | null
          agreement_signed_at?: string | null
          agreement_status?: string
          agreement_template?: string | null
          agreement_viewed_at?: string | null
          assigned_admin?: string | null
          authorizations?: Json
          banking?: Json
          carrier?: string | null
          carrier_decided_at?: string | null
          carrier_notes?: string | null
          carrier_requested_at?: string | null
          carrier_status?: string
          city?: string | null
          completed_at?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          first_name?: string
          form_progress?: Json
          form_submitted_at?: string | null
          hired_at?: string | null
          id?: string
          interview_at?: string | null
          interview_completed_at?: string | null
          interview_duration_minutes?: number
          interview_link?: string | null
          interview_notes?: string | null
          last_activity_at?: string
          last_name?: string
          licensing?: Json
          mailing_address_line1?: string | null
          mailing_city?: string | null
          mailing_same?: boolean
          mailing_state?: string | null
          mailing_zip?: string | null
          middle_name?: string | null
          not_hired_reason?: string | null
          offer_sent_at?: string | null
          offer_signed_at?: string | null
          offer_status?: string
          offer_template?: string | null
          offer_viewed_at?: string | null
          phone?: string | null
          preferred_name?: string | null
          sequence_paused?: boolean
          source?: string | null
          stage?: string
          state?: string | null
          updated_at?: string
          user_id?: string | null
          zip?: string | null
        }
        Update: {
          access_completed_at?: string | null
          access_sent_at?: string | null
          access_status?: string
          address_line1?: string | null
          address_line2?: string | null
          agreement_sent_at?: string | null
          agreement_signed_at?: string | null
          agreement_status?: string
          agreement_template?: string | null
          agreement_viewed_at?: string | null
          assigned_admin?: string | null
          authorizations?: Json
          banking?: Json
          carrier?: string | null
          carrier_decided_at?: string | null
          carrier_notes?: string | null
          carrier_requested_at?: string | null
          carrier_status?: string
          city?: string | null
          completed_at?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          first_name?: string
          form_progress?: Json
          form_submitted_at?: string | null
          hired_at?: string | null
          id?: string
          interview_at?: string | null
          interview_completed_at?: string | null
          interview_duration_minutes?: number
          interview_link?: string | null
          interview_notes?: string | null
          last_activity_at?: string
          last_name?: string
          licensing?: Json
          mailing_address_line1?: string | null
          mailing_city?: string | null
          mailing_same?: boolean
          mailing_state?: string | null
          mailing_zip?: string | null
          middle_name?: string | null
          not_hired_reason?: string | null
          offer_sent_at?: string | null
          offer_signed_at?: string | null
          offer_status?: string
          offer_template?: string | null
          offer_viewed_at?: string | null
          phone?: string | null
          preferred_name?: string | null
          sequence_paused?: boolean
          source?: string | null
          stage?: string
          state?: string | null
          updated_at?: string
          user_id?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      onboarding_documents: {
        Row: {
          candidate_id: string
          created_at: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          name: string
          required: boolean
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          uploaded_at: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          name: string
          required?: boolean
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uploaded_at?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          name?: string
          required?: boolean
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "onboarding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_emails: {
        Row: {
          candidate_id: string
          created_at: string
          email_type: string
          error: string | null
          id: string
          opened_at: string | null
          recipient: string
          sender: string | null
          sent_at: string | null
          stage: string | null
          status: string
          subject: string | null
          template_key: string
          trigger: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          email_type: string
          error?: string | null
          id?: string
          opened_at?: string | null
          recipient: string
          sender?: string | null
          sent_at?: string | null
          stage?: string | null
          status?: string
          subject?: string | null
          template_key: string
          trigger?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          email_type?: string
          error?: string | null
          id?: string
          opened_at?: string | null
          recipient?: string
          sender?: string | null
          sent_at?: string | null
          stage?: string | null
          status?: string
          subject?: string | null
          template_key?: string
          trigger?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_emails_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "onboarding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_events: {
        Row: {
          actor: string | null
          candidate_id: string
          created_at: string
          detail: string | null
          event: string
          id: string
          source: string
        }
        Insert: {
          actor?: string | null
          candidate_id: string
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          source?: string
        }
        Update: {
          actor?: string | null
          candidate_id?: string
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "onboarding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_interview_availability: {
        Row: {
          booking_token: string
          candidate_id: string
          created_at: string
          created_by: string | null
          daily_end: string
          daily_start: string
          ends_on: string
          id: string
          is_active: boolean
          meeting_link: string | null
          slot_minutes: number
          starts_on: string
          timezone: string
          updated_at: string
        }
        Insert: {
          booking_token?: string
          candidate_id: string
          created_at?: string
          created_by?: string | null
          daily_end: string
          daily_start: string
          ends_on: string
          id?: string
          is_active?: boolean
          meeting_link?: string | null
          slot_minutes?: number
          starts_on: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          booking_token?: string
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          daily_end?: string
          daily_start?: string
          ends_on?: string
          id?: string
          is_active?: boolean
          meeting_link?: string | null
          slot_minutes?: number
          starts_on?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_interview_availability_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "onboarding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_interview_bookings: {
        Row: {
          availability_id: string
          candidate_id: string
          created_at: string
          ends_at: string
          id: string
          meeting_link: string | null
          starts_at: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          availability_id: string
          candidate_id: string
          created_at?: string
          ends_at: string
          id?: string
          meeting_link?: string | null
          starts_at: string
          status?: string
          timezone: string
          updated_at?: string
        }
        Update: {
          availability_id?: string
          candidate_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          meeting_link?: string | null
          starts_at?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_interview_bookings_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "onboarding_interview_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_interview_bookings_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "onboarding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_notes: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          candidate_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          candidate_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          candidate_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "onboarding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_sequence_steps: {
        Row: {
          anchor: string
          enabled: boolean
          id: string
          name: string
          offset_minutes: number
          sort_order: number
          step_key: string
          template_key: string
          updated_at: string
        }
        Insert: {
          anchor: string
          enabled?: boolean
          id?: string
          name: string
          offset_minutes?: number
          sort_order?: number
          step_key: string
          template_key: string
          updated_at?: string
        }
        Update: {
          anchor?: string
          enabled?: boolean
          id?: string
          name?: string
          offset_minutes?: number
          sort_order?: number
          step_key?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_templates: {
        Row: {
          body: string
          category: string
          id: string
          name: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string
          id?: string
          name: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          id?: string
          name?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      outbound_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          event: string
          failures: number
          id: string
          last_fired_at: string | null
          secret_name: string | null
          status: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event: string
          failures?: number
          id?: string
          last_fired_at?: string | null
          secret_name?: string | null
          status?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event?: string
          failures?: number
          id?: string
          last_fired_at?: string | null
          secret_name?: string | null
          status?: string
          url?: string
        }
        Relationships: []
      }
      phone_numbers: {
        Row: {
          active: boolean
          after_hours_action: string
          after_hours_target: string | null
          business_hours_id: string | null
          country: string
          created_at: string
          e164: string
          id: string
          ivr_menu_id: string | null
          kind: string
          label: string
          notes: string | null
          provider: string
          queue_id: string | null
          record_calls: boolean
          sms_enabled: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          after_hours_action?: string
          after_hours_target?: string | null
          business_hours_id?: string | null
          country?: string
          created_at?: string
          e164: string
          id?: string
          ivr_menu_id?: string | null
          kind?: string
          label: string
          notes?: string | null
          provider?: string
          queue_id?: string | null
          record_calls?: boolean
          sms_enabled?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          after_hours_action?: string
          after_hours_target?: string | null
          business_hours_id?: string | null
          country?: string
          created_at?: string
          e164?: string
          id?: string
          ivr_menu_id?: string | null
          kind?: string
          label?: string
          notes?: string | null
          provider?: string
          queue_id?: string | null
          record_calls?: boolean
          sms_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_business_hours_id_fkey"
            columns: ["business_hours_id"]
            isOneToOne: false
            referencedRelation: "business_hours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_ivr_menu_id_fkey"
            columns: ["ivr_menu_id"]
            isOneToOne: false
            referencedRelation: "ivr_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "call_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      post_attachments: {
        Row: {
          created_at: string
          id: string
          mime: string | null
          name: string
          path: string
          post_id: string
          size: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mime?: string | null
          name: string
          path: string
          post_id: string
          size?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mime?: string | null
          name?: string
          path?: string
          post_id?: string
          size?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_attachments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          audience: string
          author_id: string | null
          body: string
          channel: string
          created_at: string
          id: string
          kind: string
          pinned: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          audience?: string
          author_id?: string | null
          body?: string
          channel?: string
          created_at?: string
          id?: string
          kind?: string
          pinned?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string
          author_id?: string | null
          body?: string
          channel?: string
          created_at?: string
          id?: string
          kind?: string
          pinned?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_initials: string
          avatar_url: string | null
          created_at: string
          department: string
          email: string
          id: string
          landing: string
          name: string
          phone: string | null
          presence: string
          team: string
          title: string
          updated_at: string
        }
        Insert: {
          avatar_initials?: string
          avatar_url?: string | null
          created_at?: string
          department?: string
          email?: string
          id: string
          landing?: string
          name?: string
          phone?: string | null
          presence?: string
          team?: string
          title?: string
          updated_at?: string
        }
        Update: {
          avatar_initials?: string
          avatar_url?: string | null
          created_at?: string
          department?: string
          email?: string
          id?: string
          landing?: string
          name?: string
          phone?: string | null
          presence?: string
          team?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      queue_members: {
        Row: {
          active: boolean
          created_at: string
          id: string
          queue_id: string
          skill_priority: number
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          queue_id: string
          skill_priority?: number
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          queue_id?: string
          skill_priority?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_members_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "call_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_sessions: {
        Row: {
          auto_closed: boolean
          available_seconds: number
          break_count: number
          break_overrun_seconds: number
          break_seconds: number
          created_at: string
          current_status: string
          current_status_at: string
          id: string
          lunch_count: number
          lunch_overrun_seconds: number
          lunch_seconds: number
          meeting_seconds: number
          on_call_seconds: number
          signed_in_at: string
          signed_out_at: string | null
          training_seconds: number
          unavailable_seconds: number
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          auto_closed?: boolean
          available_seconds?: number
          break_count?: number
          break_overrun_seconds?: number
          break_seconds?: number
          created_at?: string
          current_status?: string
          current_status_at?: string
          id?: string
          lunch_count?: number
          lunch_overrun_seconds?: number
          lunch_seconds?: number
          meeting_seconds?: number
          on_call_seconds?: number
          signed_in_at?: string
          signed_out_at?: string | null
          training_seconds?: number
          unavailable_seconds?: number
          updated_at?: string
          user_id: string
          work_date?: string
        }
        Update: {
          auto_closed?: boolean
          available_seconds?: number
          break_count?: number
          break_overrun_seconds?: number
          break_seconds?: number
          created_at?: string
          current_status?: string
          current_status_at?: string
          id?: string
          lunch_count?: number
          lunch_overrun_seconds?: number
          lunch_seconds?: number
          meeting_seconds?: number
          on_call_seconds?: number
          signed_in_at?: string
          signed_out_at?: string | null
          training_seconds?: number
          unavailable_seconds?: number
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: []
      }
      shift_status_events: {
        Row: {
          allowance_seconds: number | null
          created_at: string
          detail: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          overrun_seconds: number
          session_id: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          allowance_seconds?: number | null
          created_at?: string
          detail?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          overrun_seconds?: number
          session_id: string
          started_at?: string
          status: string
          user_id: string
        }
        Update: {
          allowance_seconds?: number | null
          created_at?: string
          detail?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          overrun_seconds?: number
          session_id?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_status_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "shift_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          body: string
          created_at: string
          direction: string
          error: string | null
          id: string
          media_path: string | null
          provider: string | null
          provider_message_id: string | null
          sent_by: string | null
          status: string
          thread_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          media_path?: string | null
          provider?: string | null
          provider_message_id?: string | null
          sent_by?: string | null
          status?: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          media_path?: string | null
          provider?: string | null
          provider_message_id?: string | null
          sent_by?: string | null
          status?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "sms_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_threads: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          from_number: string | null
          id: string
          last_message_at: string
          last_message_preview: string
          provider: string | null
          status: string
          unread_count: number
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          contact_name?: string
          contact_phone: string
          created_at?: string
          from_number?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string
          provider?: string | null
          status?: string
          unread_count?: number
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          from_number?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string
          provider?: string | null
          status?: string
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "sms_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_state: {
        Row: {
          created_at: string
          cursor: string | null
          id: string
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          provider: string
          records_last_run: number
          records_total: number
          resource: string
          updated_at: string
          watermark: string | null
        }
        Insert: {
          created_at?: string
          cursor?: string | null
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          provider: string
          records_last_run?: number
          records_total?: number
          resource: string
          updated_at?: string
          watermark?: string | null
        }
        Update: {
          created_at?: string
          cursor?: string | null
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          provider?: string
          records_last_run?: number
          records_total?: number
          resource?: string
          updated_at?: string
          watermark?: string | null
        }
        Relationships: []
      }
      telephony_action_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          method: string
          ok: boolean
          outbox_id: string | null
          path: string
          provider: string
          request: Json | null
          response: Json | null
          response_status: number | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          method: string
          ok?: boolean
          outbox_id?: string | null
          path: string
          provider?: string
          request?: Json | null
          response?: Json | null
          response_status?: number | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          method?: string
          ok?: boolean
          outbox_id?: string | null
          path?: string
          provider?: string
          request?: Json | null
          response?: Json | null
          response_status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telephony_action_log_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "telephony_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_agents: {
        Row: {
          active: boolean
          created_at: string
          extension: string | null
          id: string
          last_seen_at: string | null
          provider: string
          provider_agent_email: string | null
          provider_agent_id: string
          provider_agent_name: string | null
          provider_status: string | null
          provider_status_at: string | null
          updated_at: string
          user_id: string | null
          web_phone_status: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          extension?: string | null
          id?: string
          last_seen_at?: string | null
          provider: string
          provider_agent_email?: string | null
          provider_agent_id: string
          provider_agent_name?: string | null
          provider_status?: string | null
          provider_status_at?: string | null
          updated_at?: string
          user_id?: string | null
          web_phone_status?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          extension?: string | null
          id?: string
          last_seen_at?: string | null
          provider?: string
          provider_agent_email?: string | null
          provider_agent_id?: string
          provider_agent_name?: string | null
          provider_status?: string | null
          provider_status_at?: string | null
          updated_at?: string
          user_id?: string | null
          web_phone_status?: string | null
        }
        Relationships: []
      }
      telephony_calls: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          agent_user_id: string | null
          buyer: string | null
          campaign: string | null
          contact_id: string | null
          created_at: string
          crm_originated: boolean
          direction: string | null
          disposition: string | null
          ended_at: string | null
          from_number: string | null
          id: string
          journey_id: string | null
          lead_phone_e164: string | null
          payout: number | null
          provider: string
          provider_call_id: string
          publisher: string | null
          raw: Json
          recording_url: string | null
          revenue: number | null
          script_name: string | null
          started_at: string | null
          state_code: string | null
          status: string | null
          synced_at: string
          talk_seconds: number
          to_number: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          agent_user_id?: string | null
          buyer?: string | null
          campaign?: string | null
          contact_id?: string | null
          created_at?: string
          crm_originated?: boolean
          direction?: string | null
          disposition?: string | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          journey_id?: string | null
          lead_phone_e164?: string | null
          payout?: number | null
          provider: string
          provider_call_id: string
          publisher?: string | null
          raw?: Json
          recording_url?: string | null
          revenue?: number | null
          script_name?: string | null
          started_at?: string | null
          state_code?: string | null
          status?: string | null
          synced_at?: string
          talk_seconds?: number
          to_number?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          agent_user_id?: string | null
          buyer?: string | null
          campaign?: string | null
          contact_id?: string | null
          created_at?: string
          crm_originated?: boolean
          direction?: string | null
          disposition?: string | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          journey_id?: string | null
          lead_phone_e164?: string | null
          payout?: number | null
          provider?: string
          provider_call_id?: string
          publisher?: string | null
          raw?: Json
          recording_url?: string | null
          revenue?: number | null
          script_name?: string | null
          started_at?: string | null
          state_code?: string | null
          status?: string | null
          synced_at?: string
          talk_seconds?: number
          to_number?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telephony_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "telephony_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telephony_calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telephony_calls_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "lead_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_dispositions: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          id: string
          is_callback: boolean
          is_sale: boolean
          name: string
          provider: string
          provider_disposition_id: string
          raw: Json
          sort_order: number
          synced_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          is_callback?: boolean
          is_sale?: boolean
          name: string
          provider?: string
          provider_disposition_id: string
          raw?: Json
          sort_order?: number
          synced_at?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          is_callback?: boolean
          is_sale?: boolean
          name?: string
          provider?: string
          provider_disposition_id?: string
          raw?: Json
          sort_order?: number
          synced_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      telephony_outbox: {
        Row: {
          action: string
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          method: string
          next_attempt_at: string
          path: string
          payload: Json
          provider: string
          requested_by: string | null
          response: Json | null
          response_status: number | null
          status: string
          target_ref: string | null
          updated_at: string
        }
        Insert: {
          action: string
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          method?: string
          next_attempt_at?: string
          path: string
          payload?: Json
          provider?: string
          requested_by?: string | null
          response?: Json | null
          response_status?: number | null
          status?: string
          target_ref?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          method?: string
          next_attempt_at?: string
          path?: string
          payload?: Json
          provider?: string
          requested_by?: string | null
          response?: Json | null
          response_status?: number | null
          status?: string
          target_ref?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      telephony_queue_items: {
        Row: {
          assigned_user_id: string | null
          attempts: number
          campaign: string | null
          contact_id: string | null
          contact_name: string | null
          created_at: string
          id: string
          kind: string
          notes: string | null
          phone_e164: string | null
          provider: string
          provider_item_id: string | null
          raw: Json
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          attempts?: number
          campaign?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          phone_e164?: string | null
          provider?: string
          provider_item_id?: string | null
          raw?: Json
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          attempts?: number
          campaign?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          phone_e164?: string | null
          provider?: string
          provider_item_id?: string | null
          raw?: Json
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telephony_queue_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_settings: {
        Row: {
          connector_button_id: string | null
          created_at: string
          default_caller_id: string | null
          default_caller_number: string | null
          default_campaign_id: string | null
          default_queue_id: string | null
          dial_enabled: boolean
          id: string
          notes: string | null
          provider: string
          status_sync_enabled: boolean
          updated_at: string
          updated_by: string | null
          webhook_token: string
          webhooks_enabled: boolean
          writes_enabled: boolean
        }
        Insert: {
          connector_button_id?: string | null
          created_at?: string
          default_caller_id?: string | null
          default_caller_number?: string | null
          default_campaign_id?: string | null
          default_queue_id?: string | null
          dial_enabled?: boolean
          id?: string
          notes?: string | null
          provider?: string
          status_sync_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          webhook_token?: string
          webhooks_enabled?: boolean
          writes_enabled?: boolean
        }
        Update: {
          connector_button_id?: string | null
          created_at?: string
          default_caller_id?: string | null
          default_caller_number?: string | null
          default_campaign_id?: string | null
          default_queue_id?: string | null
          dial_enabled?: boolean
          id?: string
          notes?: string | null
          provider?: string
          status_sync_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          webhook_token?: string
          webhooks_enabled?: boolean
          writes_enabled?: boolean
        }
        Relationships: []
      }
      telephony_status_map: {
        Row: {
          created_at: string
          crm_status: string
          id: string
          provider: string
          provider_status: string
          ready: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          crm_status: string
          id?: string
          provider?: string
          provider_status: string
          ready?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          crm_status?: string
          id?: string
          provider?: string
          provider_status?: string
          ready?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_interview_slot: {
        Args: { _starts_at: string; _token: string }
        Returns: Json
      }
      can_manage_onboarding: { Args: { _user_id: string }; Returns: boolean }
      can_read_attachment: {
        Args: { _path: string; _user_id: string }
        Returns: boolean
      }
      can_view_post: {
        Args: { _post_id: string; _user_id: string }
        Returns: boolean
      }
      get_interview_booking_page: { Args: { _token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_sales_access: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_call_participant: {
        Args: { _call_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_ops: { Args: { _user_id: string }; Returns: boolean }
      owns_onboarding: {
        Args: { _candidate_id: string; _user_id: string }
        Returns: boolean
      }
      shift_close_stale_sessions: {
        Args: { _max_hours?: number }
        Returns: number
      }
    }
    Enums: {
      app_role:
        | "CEO"
        | "Administrator"
        | "Operations"
        | "HR"
        | "Accounting"
        | "QC"
        | "Agent"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "CEO",
        "Administrator",
        "Operations",
        "HR",
        "Accounting",
        "QC",
        "Agent",
      ],
    },
  },
} as const
