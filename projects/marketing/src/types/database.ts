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
      ai_budget_reservations: {
        Row: {
          actor_user_id: string | null
          actual_cost_micros: number | null
          brand_id: string
          completed_at: string | null
          created_at: string
          id: string
          model: string
          reserved_cost_micros: number
          status: string
          task: string
        }
        Insert: {
          actor_user_id?: string | null
          actual_cost_micros?: number | null
          brand_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          model: string
          reserved_cost_micros: number
          status?: string
          task: string
        }
        Update: {
          actor_user_id?: string | null
          actual_cost_micros?: number | null
          brand_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          model?: string
          reserved_cost_micros?: number
          status?: string
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_budget_reservations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          brand_id: string | null
          content_id: string | null
          created_at: string
          estimated_cost_micros: number
          id: number
          input_tokens: number
          latency_ms: number | null
          model: string
          output_tokens: number
          provider: string
          succeeded: boolean
          task: string
        }
        Insert: {
          brand_id?: string | null
          content_id?: string | null
          created_at?: string
          estimated_cost_micros: number
          id?: never
          input_tokens: number
          latency_ms?: number | null
          model: string
          output_tokens: number
          provider: string
          succeeded: boolean
          task: string
        }
        Update: {
          brand_id?: string | null
          content_id?: string | null
          created_at?: string
          estimated_cost_micros?: number
          id?: never
          input_tokens?: number
          latency_ms?: number | null
          model?: string
          output_tokens?: number
          provider?: string
          succeeded?: boolean
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          content_id: string
          created_at: string
          decision: string
          id: string
          notes: string
          reviewer_user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          decision: string
          id?: string
          notes?: string
          reviewer_user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          decision?: string
          id?: string
          notes?: string
          reviewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_type: Database["public"]["Enums"]["actor_type"]
          actor_user_id: string | null
          brand_id: string | null
          content_id: string | null
          created_at: string
          id: number
          metadata: Json
          new_state: Json | null
          previous_state: Json | null
        }
        Insert: {
          action: string
          actor_type: Database["public"]["Enums"]["actor_type"]
          actor_user_id?: string | null
          brand_id?: string | null
          content_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          new_state?: Json | null
          previous_state?: Json | null
        }
        Update: {
          action?: string
          actor_type?: Database["public"]["Enums"]["actor_type"]
          actor_user_id?: string | null
          brand_id?: string | null
          content_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          new_state?: Json | null
          previous_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_facts: {
        Row: {
          brand_id: string
          created_at: string
          fact_key: string
          id: string
          source_url: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          value: Json
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          brand_id: string
          created_at?: string
          fact_key: string
          id?: string
          source_url?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          value: Json
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          brand_id?: string
          created_at?: string
          fact_key?: string
          id?: string
          source_url?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          value?: Json
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "brand_facts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_media_policies: {
        Row: {
          ai_backgrounds_allowed: boolean
          ai_illustrations_allowed: boolean
          ai_real_person_likenesses_allowed: boolean | null
          brand_id: string
          policy_notes: string
          real_person_photos_require_approval: boolean
          statistical_graphics_allowed: boolean
          text_graphics_allowed: boolean
          updated_at: string
        }
        Insert: {
          ai_backgrounds_allowed?: boolean
          ai_illustrations_allowed?: boolean
          ai_real_person_likenesses_allowed?: boolean | null
          brand_id: string
          policy_notes?: string
          real_person_photos_require_approval?: boolean
          statistical_graphics_allowed?: boolean
          text_graphics_allowed?: boolean
          updated_at?: string
        }
        Update: {
          ai_backgrounds_allowed?: boolean
          ai_illustrations_allowed?: boolean
          ai_real_person_likenesses_allowed?: boolean | null
          brand_id?: string
          policy_notes?: string
          real_person_photos_require_approval?: boolean
          statistical_graphics_allowed?: boolean
          text_graphics_allowed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_media_policies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_memberships: {
        Row: {
          brand_id: string
          created_at: string
          role: Database["public"]["Enums"]["brand_role"]
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          role: Database["public"]["Enums"]["brand_role"]
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["brand_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_memberships_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_rules: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          is_active: boolean
          rule_text: string
          rule_type: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          rule_text: string
          rule_type: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          rule_text?: string
          rule_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_sources: {
        Row: {
          base_url: string | null
          brand_id: string
          created_at: string
          id: string
          is_approved: boolean
          name: string
          source_tier: number
        }
        Insert: {
          base_url?: string | null
          brand_id: string
          created_at?: string
          id?: string
          is_approved?: boolean
          name: string
          source_tier: number
        }
        Update: {
          base_url?: string | null
          brand_id?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          name?: string
          source_tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "brand_sources_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          agent_profile: Json
          ai_budget_warning_percent: number
          autonomy: Database["public"]["Enums"]["autonomy_level"]
          brand_voice: string | null
          content_pillars: Json
          created_at: string
          description: string
          freeform_instructions: string
          id: string
          industry: string | null
          logo_path: string | null
          marketing_objectives: Json
          monthly_ai_budget_cents: number
          name: string
          owner_user_id: string
          publishing_enabled: boolean
          slug: string
          target_audience: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          agent_profile?: Json
          ai_budget_warning_percent?: number
          autonomy?: Database["public"]["Enums"]["autonomy_level"]
          brand_voice?: string | null
          content_pillars?: Json
          created_at?: string
          description?: string
          freeform_instructions?: string
          id?: string
          industry?: string | null
          logo_path?: string | null
          marketing_objectives?: Json
          monthly_ai_budget_cents?: number
          name: string
          owner_user_id: string
          publishing_enabled?: boolean
          slug: string
          target_audience?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          agent_profile?: Json
          ai_budget_warning_percent?: number
          autonomy?: Database["public"]["Enums"]["autonomy_level"]
          brand_voice?: string | null
          content_pillars?: Json
          created_at?: string
          description?: string
          freeform_instructions?: string
          id?: string
          industry?: string | null
          logo_path?: string | null
          marketing_objectives?: Json
          monthly_ai_budget_cents?: number
          name?: string
          owner_user_id?: string
          publishing_enabled?: boolean
          slug?: string
          target_audience?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      content_items: {
        Row: {
          body: string
          brand_id: string
          content_type: string
          created_at: string
          created_by: string | null
          has_prohibited_claim: boolean
          id: string
          media_policy_satisfied: boolean
          requires_human_approval: boolean
          risk: Database["public"]["Enums"]["risk_level"]
          source_content_id: string | null
          source_opportunity_rank: number | null
          source_urls: Json
          status: Database["public"]["Enums"]["content_status"]
          target_channel: string | null
          title: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          body?: string
          brand_id: string
          content_type: string
          created_at?: string
          created_by?: string | null
          has_prohibited_claim?: boolean
          id?: string
          media_policy_satisfied?: boolean
          requires_human_approval?: boolean
          risk?: Database["public"]["Enums"]["risk_level"]
          source_content_id?: string | null
          source_opportunity_rank?: number | null
          source_urls?: Json
          status?: Database["public"]["Enums"]["content_status"]
          target_channel?: string | null
          title: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          body?: string
          brand_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          has_prohibited_claim?: boolean
          id?: string
          media_policy_satisfied?: boolean
          requires_human_approval?: boolean
          risk?: Database["public"]["Enums"]["risk_level"]
          source_content_id?: string | null
          source_opportunity_rank?: number | null
          source_urls?: Json
          status?: Database["public"]["Enums"]["content_status"]
          target_channel?: string | null
          title?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "content_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_source_content_id_fkey"
            columns: ["source_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      publishing_destinations: {
        Row: {
          brand_id: string
          channel: string
          connection_status: string
          created_at: string
          external_account_id: string | null
          external_account_name: string | null
          id: string
          last_error: string | null
          last_validated_at: string | null
          provider: string
          publish_mode: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          channel: string
          connection_status: string
          created_at?: string
          external_account_id?: string | null
          external_account_name?: string | null
          id?: string
          last_error?: string | null
          last_validated_at?: string | null
          provider: string
          publish_mode: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          channel?: string
          connection_status?: string
          created_at?: string
          external_account_id?: string | null
          external_account_name?: string | null
          id?: string
          last_error?: string | null
          last_validated_at?: string | null
          provider?: string
          publish_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publishing_destinations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_attempts: {
        Row: {
          attempt_count: number
          attempt_kind: string
          brand_id: string
          completed_at: string | null
          content_id: string
          created_at: string
          destination_id: string
          error_code: string | null
          external_post_id: string | null
          id: string
          idempotency_key: string
          requested_by_user_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          attempt_kind: string
          brand_id: string
          completed_at?: string | null
          content_id: string
          created_at?: string
          destination_id: string
          error_code?: string | null
          external_post_id?: string | null
          id?: string
          idempotency_key: string
          requested_by_user_id: string
          started_at?: string
          status: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          attempt_kind?: string
          brand_id?: string
          completed_at?: string | null
          content_id?: string
          created_at?: string
          destination_id?: string
          error_code?: string | null
          external_post_id?: string | null
          id?: string
          idempotency_key?: string
          requested_by_user_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_attempts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_attempts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_attempts_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "publishing_destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          global_auto_publish_enabled: boolean
          monthly_ai_budget_cents: number
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          global_auto_publish_enabled?: boolean
          monthly_ai_budget_cents?: number
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          global_auto_publish_enabled?: boolean
          monthly_ai_budget_cents?: number
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      import_project_card: {
        Args: { p_source_project_id: string; p_source_card_id: string; p_source_project_name: string; p_brand_id: string; p_title: string; p_body: string };
        Returns: Json;
      };
      get_project_card_briefs: { Args: { p_source_project_id?: string }; Returns: Json };
      can_access_brand: { Args: { target_brand_id: string }; Returns: boolean }
      can_admin_brand: { Args: { target_brand_id: string }; Returns: boolean }
      can_edit_brand: { Args: { target_brand_id: string }; Returns: boolean }
      can_review_brand: { Args: { target_brand_id: string }; Returns: boolean }
      connect_meta_publishing_destinations: {
        Args: {
          p_brand_id: string
          p_encrypted_credential: string
          p_expires_at?: string | null
          p_facebook_page_id: string
          p_facebook_page_name: string
          p_instagram_account_id: string
          p_instagram_account_name: string
        }
        Returns: undefined
      }
      create_ai_content_for_review: {
        Args: {
          p_body: string
          p_brand_id: string
          p_content_type: string
          p_estimated_cost_micros: number
          p_input_tokens: number
          p_latency_ms: number
          p_model: string
          p_output_tokens: number
          p_requires_research: boolean
          p_research_notes: Json
          p_reservation_id: string
          p_title: string
        }
        Returns: string
      }
      create_ai_briefing_for_review: {
        Args: {
          p_body: string
          p_brand_id: string
          p_estimated_cost_micros: number
          p_input_tokens: number
          p_latency_ms: number
          p_model: string
          p_output_tokens: number
          p_prompt_version: string
          p_reservation_id: string
          p_source_urls: Json
          p_title: string
        }
        Returns: string
      }
      create_ai_briefing_capture: {
        Args: {
          p_body: string
          p_brand_id: string
          p_input_tokens: number
          p_latency_ms: number
          p_output_tokens: number
          p_prompt_version: string
          p_quality_issues: Json
          p_reservation_id: string
          p_source_urls: Json
          p_title: string
        }
        Returns: string
      }
      fail_ai_budget_reservation: {
        Args: { p_reservation_id: string }
        Returns: undefined
      }
      get_ai_budget_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          monthly_budget_cents: number
          reserved_cost_micros: number
          used_cost_micros: number
        }[]
      }
      reserve_ai_budget: {
        Args: {
          p_brand_id: string
          p_model: string
          p_reserved_cost_micros: number
          p_task: string
        }
        Returns: string
      }
      claim_facebook_unpublished_test: {
        Args: { p_content_id: string }
        Returns: {
          attempt_id: string
          attempt_status: string
          brand_id: string
          content_body: string
          encrypted_credential: string
          page_id: string
          should_execute: boolean
        }[]
      }
      complete_facebook_unpublished_test: {
        Args: {
          p_attempt_id: string
          p_error_code?: string | null
          p_external_post_id?: string | null
          p_succeeded: boolean
        }
        Returns: undefined
      }
      create_content_for_review: {
        Args: {
          p_body: string
          p_brand_id: string
          p_content_type: string
          p_title: string
        }
        Returns: string
      }
      create_social_draft_from_briefing: {
        Args: {
          p_body: string
          p_channel: string
          p_opportunity_rank: number
          p_source_content_id: string
          p_source_updated_at: string
          p_source_urls: Json
          p_title: string
        }
        Returns: string
      }
      revise_content_for_review: {
        Args: { p_body: string; p_content_id: string; p_title: string }
        Returns: string
      }
      record_content_decision: {
        Args: { p_content_id: string; p_decision: string; p_notes?: string }
        Returns: string
      }
      disconnect_meta_publishing_destinations: {
        Args: { p_brand_id: string }
        Returns: undefined
      }
    }
    Enums: {
      actor_type: "HUMAN" | "AI" | "SYSTEM"
      autonomy_level:
        | "LEVEL_1_MANUAL"
        | "LEVEL_2_ASSISTED"
        | "LEVEL_3_TRUSTED"
        | "LEVEL_4_AUTONOMOUS"
      brand_role: "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "VIEWER"
      content_status:
        | "IDEA"
        | "RESEARCHING"
        | "DRAFTING"
        | "VERIFYING"
        | "NEEDS_REVIEW"
        | "APPROVED"
        | "SCHEDULED"
        | "PUBLISHING"
        | "PUBLISHED"
        | "FAILED"
        | "REJECTED"
      risk_level: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED"
      verification_status:
        | "VERIFIED"
        | "SUPPORTED"
        | "UNVERIFIED"
        | "CONFLICTING"
        | "INCORRECT"
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
      actor_type: ["HUMAN", "AI", "SYSTEM"],
      autonomy_level: [
        "LEVEL_1_MANUAL",
        "LEVEL_2_ASSISTED",
        "LEVEL_3_TRUSTED",
        "LEVEL_4_AUTONOMOUS",
      ],
      brand_role: ["OWNER", "ADMIN", "EDITOR", "REVIEWER", "VIEWER"],
      content_status: [
        "IDEA",
        "RESEARCHING",
        "DRAFTING",
        "VERIFYING",
        "NEEDS_REVIEW",
        "APPROVED",
        "SCHEDULED",
        "PUBLISHING",
        "PUBLISHED",
        "FAILED",
        "REJECTED",
      ],
      risk_level: ["LOW", "MEDIUM", "HIGH", "BLOCKED"],
      verification_status: [
        "VERIFIED",
        "SUPPORTED",
        "UNVERIFIED",
        "CONFLICTING",
        "INCORRECT",
      ],
    },
  },
} as const
