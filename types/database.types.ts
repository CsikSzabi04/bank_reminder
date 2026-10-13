export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      budgets: {
        Row: {
          category_id: string;
          created_at: string;
          currency: string;
          id: string;
          monthly_limit: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          created_at?: string;
          currency?: string;
          id?: string;
          monthly_limit: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          monthly_limit?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          color_slot: number;
          created_at: string;
          icon: string;
          id: string;
          key: string | null;
          kind: string;
          name_en: string | null;
          name_hu: string | null;
          sort: number;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          color_slot?: number;
          created_at?: string;
          icon?: string;
          id?: string;
          key?: string | null;
          kind?: string;
          name_en?: string | null;
          name_hu?: string | null;
          sort?: number;
          user_id?: string | null;
        };
        Update: {
          color_slot?: number;
          created_at?: string;
          icon?: string;
          id?: string;
          key?: string | null;
          kind?: string;
          name_en?: string | null;
          name_hu?: string | null;
          sort?: number;
          user_id?: string | null;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          amount: number;
          category_id: string | null;
          created_at: string;
          currency: string;
          id: string;
          note: string | null;
          spent_on: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          category_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          note?: string | null;
          spent_on?: string;
          user_id?: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          note?: string | null;
          spent_on?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      fx_rates: {
        Row: {
          as_of: string;
          currency: string;
          per_eur: number;
        };
        ComputedFields: never;
        Insert: {
          as_of: string;
          currency: string;
          per_eur: number;
        };
        Update: {
          as_of?: string;
          currency?: string;
          per_eur?: number;
        };
        Relationships: [];
      };
      goal_contributions: {
        Row: {
          amount: number;
          contributed_on: string;
          created_at: string;
          goal_id: string;
          id: string;
          note: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          contributed_on?: string;
          created_at?: string;
          goal_id: string;
          id?: string;
          note?: string | null;
          user_id?: string;
        };
        Update: {
          amount?: number;
          contributed_on?: string;
          created_at?: string;
          goal_id?: string;
          id?: string;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "savings_goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goal_contributions_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "savings_goals_progress";
            referencedColumns: ["id"];
          },
        ];
      };
      news_items: {
        Row: {
          expires_at: string;
          fetched_at: string;
          id: string;
          image_url: string | null;
          is_hidden: boolean;
          published_at: string;
          score: number;
          snippet: string | null;
          source_key: string;
          title: string;
          topic: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          expires_at: string;
          fetched_at?: string;
          id?: string;
          image_url?: string | null;
          is_hidden?: boolean;
          published_at: string;
          score?: number;
          snippet?: string | null;
          source_key: string;
          title: string;
          topic: string;
          url: string;
        };
        Update: {
          expires_at?: string;
          fetched_at?: string;
          id?: string;
          image_url?: string | null;
          is_hidden?: boolean;
          published_at?: string;
          score?: number;
          snippet?: string | null;
          source_key?: string;
          title?: string;
          topic?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "news_items_source_key_fkey";
            columns: ["source_key"];
            isOneToOne: false;
            referencedRelation: "news_sources";
            referencedColumns: ["key"];
          },
        ];
      };
      news_reports: {
        Row: {
          created_at: string;
          id: string;
          news_id: string;
          reason: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          news_id: string;
          reason: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          news_id?: string;
          reason?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "news_reports_news_id_fkey";
            columns: ["news_id"];
            isOneToOne: false;
            referencedRelation: "news_items";
            referencedColumns: ["id"];
          },
        ];
      };
      news_sources: {
        Row: {
          enabled: boolean;
          etag: string | null;
          feed_url: string;
          home_url: string;
          key: string;
          last_error: string | null;
          last_fetched_at: string | null;
          last_modified: string | null;
          last_status: number | null;
          license_note: string | null;
          name: string;
          topic_hint: string | null;
        };
        ComputedFields: never;
        Insert: {
          enabled?: boolean;
          etag?: string | null;
          feed_url: string;
          home_url: string;
          key: string;
          last_error?: string | null;
          last_fetched_at?: string | null;
          last_modified?: string | null;
          last_status?: number | null;
          license_note?: string | null;
          name: string;
          topic_hint?: string | null;
        };
        Update: {
          enabled?: boolean;
          etag?: string | null;
          feed_url?: string;
          home_url?: string;
          key?: string;
          last_error?: string | null;
          last_fetched_at?: string | null;
          last_modified?: string | null;
          last_status?: number | null;
          license_note?: string | null;
          name?: string;
          topic_hint?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          attempts: number;
          channel: string;
          claimed_at: string | null;
          created_at: string;
          dedupe_key: string;
          id: string;
          kind: string;
          last_error: string | null;
          next_attempt_at: string | null;
          occurrence_id: string | null;
          payload: NonNullable<Json>;
          read_at: string | null;
          reminder_id: string | null;
          scheduled_for: string;
          sent_at: string | null;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          channel: string;
          claimed_at?: string | null;
          created_at?: string;
          dedupe_key: string;
          id?: string;
          kind: string;
          last_error?: string | null;
          next_attempt_at?: string | null;
          occurrence_id?: string | null;
          payload?: NonNullable<Json>;
          read_at?: string | null;
          reminder_id?: string | null;
          scheduled_for: string;
          sent_at?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          channel?: string;
          claimed_at?: string | null;
          created_at?: string;
          dedupe_key?: string;
          id?: string;
          kind?: string;
          last_error?: string | null;
          next_attempt_at?: string | null;
          occurrence_id?: string | null;
          payload?: NonNullable<Json>;
          read_at?: string | null;
          reminder_id?: string | null;
          scheduled_for?: string;
          sent_at?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_occurrence_id_fkey";
            columns: ["occurrence_id"];
            isOneToOne: false;
            referencedRelation: "occurrences";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_occurrence_id_fkey";
            columns: ["occurrence_id"];
            isOneToOne: false;
            referencedRelation: "v_occurrences";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_occurrence_id_fkey";
            columns: ["occurrence_id"];
            isOneToOne: false;
            referencedRelation: "v_reminders";
            referencedColumns: ["next_occurrence_id"];
          },
          {
            foreignKeyName: "notifications_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "v_reminders";
            referencedColumns: ["id"];
          },
        ];
      };
      occurrences: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          due_date: string;
          id: string;
          paid_amount: number | null;
          paid_at: string | null;
          paid_on: string | null;
          reminder_id: string;
          snoozed_until: string | null;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          currency: string;
          due_date: string;
          id?: string;
          paid_amount?: number | null;
          paid_at?: string | null;
          paid_on?: string | null;
          reminder_id: string;
          snoozed_until?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          due_date?: string;
          id?: string;
          paid_amount?: number | null;
          paid_at?: string | null;
          paid_on?: string | null;
          reminder_id?: string;
          snoozed_until?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "occurrences_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "occurrences_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "v_reminders";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          base_currency: string;
          channel_email: boolean;
          channel_push: boolean;
          created_at: string;
          default_notify_time: string;
          default_offsets: number[];
          display_name: string | null;
          ics_token: string;
          id: string;
          locale: string;
          monthly_income: number | null;
          news_enabled: boolean;
          notify_hide_details: boolean;
          onboarding_done: boolean;
          reminders_enabled: boolean;
          theme: string;
          timezone: string;
          tips_enabled: boolean;
          updated_at: string;
          weekly_digest: boolean;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          base_currency?: string;
          channel_email?: boolean;
          channel_push?: boolean;
          created_at?: string;
          default_notify_time?: string;
          default_offsets?: number[];
          display_name?: string | null;
          ics_token?: string;
          id: string;
          locale?: string;
          monthly_income?: number | null;
          news_enabled?: boolean;
          notify_hide_details?: boolean;
          onboarding_done?: boolean;
          reminders_enabled?: boolean;
          theme?: string;
          timezone?: string;
          tips_enabled?: boolean;
          updated_at?: string;
          weekly_digest?: boolean;
        };
        Update: {
          avatar_path?: string | null;
          base_currency?: string;
          channel_email?: boolean;
          channel_push?: boolean;
          created_at?: string;
          default_notify_time?: string;
          default_offsets?: number[];
          display_name?: string | null;
          ics_token?: string;
          id?: string;
          locale?: string;
          monthly_income?: number | null;
          news_enabled?: boolean;
          notify_hide_details?: boolean;
          onboarding_done?: boolean;
          reminders_enabled?: boolean;
          theme?: string;
          timezone?: string;
          tips_enabled?: boolean;
          updated_at?: string;
          weekly_digest?: boolean;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          disabled_at: string | null;
          endpoint: string;
          failed_count: number;
          id: string;
          label: string | null;
          last_seen_at: string;
          last_success_at: string | null;
          p256dh: string;
          platform: string | null;
          user_agent: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          disabled_at?: string | null;
          endpoint: string;
          failed_count?: number;
          id?: string;
          label?: string | null;
          last_seen_at?: string;
          last_success_at?: string | null;
          p256dh: string;
          platform?: string | null;
          user_agent?: string | null;
          user_id?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          disabled_at?: string | null;
          endpoint?: string;
          failed_count?: number;
          id?: string;
          label?: string | null;
          last_seen_at?: string;
          last_success_at?: string | null;
          p256dh?: string;
          platform?: string | null;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          amount: number;
          auto_paid: boolean;
          category_id: string | null;
          channels: string[];
          created_at: string;
          currency: string;
          end_date: string | null;
          id: string;
          is_active: boolean;
          is_demo: boolean;
          is_subscription: boolean;
          month_end: boolean;
          name: string;
          note: string | null;
          recur_every: number;
          recur_unit: string | null;
          remind_enabled: boolean;
          remind_offsets: number[];
          remind_time: string;
          service_slug: string | null;
          start_date: string;
          trial_ends_on: string | null;
          updated_at: string;
          url: string | null;
          usage_tags: string[];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          auto_paid?: boolean;
          category_id?: string | null;
          channels?: string[];
          created_at?: string;
          currency?: string;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          is_demo?: boolean;
          is_subscription?: boolean;
          month_end?: boolean;
          name: string;
          note?: string | null;
          recur_every?: number;
          recur_unit?: string | null;
          remind_enabled?: boolean;
          remind_offsets?: number[];
          remind_time?: string;
          service_slug?: string | null;
          start_date: string;
          trial_ends_on?: string | null;
          updated_at?: string;
          url?: string | null;
          usage_tags?: string[];
          user_id?: string;
        };
        Update: {
          amount?: number;
          auto_paid?: boolean;
          category_id?: string | null;
          channels?: string[];
          created_at?: string;
          currency?: string;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          is_demo?: boolean;
          is_subscription?: boolean;
          month_end?: boolean;
          name?: string;
          note?: string | null;
          recur_every?: number;
          recur_unit?: string | null;
          remind_enabled?: boolean;
          remind_offsets?: number[];
          remind_time?: string;
          service_slug?: string | null;
          start_date?: string;
          trial_ends_on?: string | null;
          updated_at?: string;
          url?: string | null;
          usage_tags?: string[];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminders_service_slug_fkey";
            columns: ["service_slug"];
            isOneToOne: false;
            referencedRelation: "service_catalog";
            referencedColumns: ["slug"];
          },
        ];
      };
      savings_goals: {
        Row: {
          archived_at: string | null;
          color_slot: number;
          created_at: string;
          currency: string;
          icon: string;
          id: string;
          name: string;
          target_amount: number;
          target_date: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          color_slot?: number;
          created_at?: string;
          currency?: string;
          icon?: string;
          id?: string;
          name: string;
          target_amount: number;
          target_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          color_slot?: number;
          created_at?: string;
          currency?: string;
          icon?: string;
          id?: string;
          name?: string;
          target_amount?: number;
          target_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      service_catalog: {
        Row: {
          annual_discount_pct: number | null;
          category_key: string;
          common_tags: string[];
          family_plan: boolean;
          group_key: string | null;
          is_active: boolean;
          logo_url: string | null;
          name: string;
          slug: string;
          source_url: string | null;
          typical_amount: number | null;
          typical_currency: string | null;
          typical_unit: string;
          unique_tags: string[];
          verified_at: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          annual_discount_pct?: number | null;
          category_key: string;
          common_tags?: string[];
          family_plan?: boolean;
          group_key?: string | null;
          is_active?: boolean;
          logo_url?: string | null;
          name: string;
          slug: string;
          source_url?: string | null;
          typical_amount?: number | null;
          typical_currency?: string | null;
          typical_unit?: string;
          unique_tags?: string[];
          verified_at: string;
          website?: string | null;
        };
        Update: {
          annual_discount_pct?: number | null;
          category_key?: string;
          common_tags?: string[];
          family_plan?: boolean;
          group_key?: string | null;
          is_active?: boolean;
          logo_url?: string | null;
          name?: string;
          slug?: string;
          source_url?: string | null;
          typical_amount?: number | null;
          typical_currency?: string | null;
          typical_unit?: string;
          unique_tags?: string[];
          verified_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      tip_config: {
        Row: {
          key: string;
          note: string | null;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          note?: string | null;
          value: number;
        };
        Update: {
          key?: string;
          note?: string | null;
          value?: number;
        };
        Relationships: [];
      };
      tips: {
        Row: {
          code: string;
          created_at: string;
          est_monthly_saving: number | null;
          fingerprint: string;
          id: string;
          params: NonNullable<Json>;
          reminder_ids: string[];
          severity: string;
          snoozed_until: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          est_monthly_saving?: number | null;
          fingerprint: string;
          id?: string;
          params?: NonNullable<Json>;
          reminder_ids?: string[];
          severity?: string;
          snoozed_until?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          est_monthly_saving?: number | null;
          fingerprint?: string;
          id?: string;
          params?: NonNullable<Json>;
          reminder_ids?: string[];
          severity?: string;
          snoozed_until?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      usage_checks: {
        Row: {
          answered_at: string;
          id: string;
          reminder_id: string;
          used: boolean;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          answered_at?: string;
          id?: string;
          reminder_id: string;
          used: boolean;
          user_id?: string;
        };
        Update: {
          answered_at?: string;
          id?: string;
          reminder_id?: string;
          used?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_checks_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usage_checks_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "v_reminders";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      savings_goals_progress: {
        Row: {
          archived_at: string | null;
          color_slot: number | null;
          created_at: string | null;
          currency: string | null;
          icon: string | null;
          id: string | null;
          months_left: number | null;
          name: string | null;
          needed_per_month: number | null;
          pct: number | null;
          reached: boolean | null;
          saved: number | null;
          target_amount: number | null;
          target_date: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_items: {
        Row: {
          amount_base: number | null;
          amount_native: number | null;
          category_id: string | null;
          currency: string | null;
          group_slot: number | null;
          is_subscription: boolean | null;
          item_id: string | null;
          kind: string | null;
          name: string | null;
          on_date: string | null;
          reminder_id: string | null;
          status: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_occurrences: {
        Row: {
          amount: number | null;
          amount_base: number | null;
          category_id: string | null;
          created_at: string | null;
          currency: string | null;
          due_date: string | null;
          id: string | null;
          is_subscription: boolean | null;
          overdue: boolean | null;
          paid_amount: number | null;
          paid_at: string | null;
          paid_on: string | null;
          reminder_id: string | null;
          reminder_name: string | null;
          service_slug: string | null;
          snoozed_until: string | null;
          status: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "occurrences_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "occurrences_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "v_reminders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminders_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminders_service_slug_fkey";
            columns: ["service_slug"];
            isOneToOne: false;
            referencedRelation: "service_catalog";
            referencedColumns: ["slug"];
          },
        ];
      };
      v_reminders: {
        Row: {
          amount: number | null;
          auto_paid: boolean | null;
          category_id: string | null;
          channels: string[] | null;
          created_at: string | null;
          currency: string | null;
          end_date: string | null;
          id: string | null;
          is_active: boolean | null;
          is_demo: boolean | null;
          is_subscription: boolean | null;
          last_paid_on: string | null;
          month_end: boolean | null;
          monthly_base: number | null;
          name: string | null;
          next_amount: number | null;
          next_due: string | null;
          next_occurrence_id: string | null;
          next_overdue: boolean | null;
          note: string | null;
          recur_every: number | null;
          recur_unit: string | null;
          remind_enabled: boolean | null;
          remind_offsets: number[] | null;
          remind_time: string | null;
          service_slug: string | null;
          start_date: string | null;
          trial_ends_on: string | null;
          updated_at: string | null;
          url: string | null;
          usage_tags: string[] | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "reminders_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminders_service_slug_fkey";
            columns: ["service_slug"];
            isOneToOne: false;
            referencedRelation: "service_catalog";
            referencedColumns: ["slug"];
          },
        ];
      };
    };
    Functions: {
      analytics_by_group: {
        Args: { p_from: string; p_to: string };
        Returns: {
          group_key: string;
          group_slot: number;
          items: number;
          paid: number;
          remaining: number;
          total: number;
        }[];
      };
      analytics_cumulative: {
        Args: { p_month: string };
        Returns: {
          cum_prev: number;
          cum_this: number;
          day: string;
        }[];
      };
      analytics_group_trend: {
        Args: { p_months: number };
        Returns: {
          group_slot: number;
          month: string;
          total: number;
        }[];
      };
      analytics_monthly_trend: {
        Args: { p_months: number };
        Returns: {
          month: string;
          paid: number;
          remaining: number;
        }[];
      };
      analytics_subscriptions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          monthly: number;
          name: string;
          reminder_id: string;
          service_slug: string;
          share_pct: number;
          yearly: number;
        }[];
      };
      analytics_top: {
        Args: { p_from: string; p_limit?: number; p_to: string };
        Returns: {
          group_slot: number;
          name: string;
          reminder_id: string;
          total: number;
        }[];
      };
      answer_usage_check: { Args: { p_reminder_id: string; p_used: boolean }; Returns: number };
      budget_status: {
        Args: { p_month?: string };
        Returns: {
          budget_id: string;
          category_id: string;
          committed: number;
          forecast: number;
          left: number;
          monthly_limit: number;
          spent: number;
          state: string;
          suggested_limit: number;
        }[];
      };
      budget_status_for: {
        Args: { p_month: string; p_today: string; p_user: string };
        Returns: {
          budget_id: string;
          category_id: string;
          committed: number;
          forecast: number;
          left: number;
          monthly_limit: number;
          spent: number;
          state: string;
          suggested_limit: number;
        }[];
      };
      budget_suggestions: {
        Args: { p_month?: string };
        Returns: {
          category_id: string;
          suggested_limit: number;
        }[];
      };
      call_edge_function: { Args: { p_name: string }; Returns: number };
      cancel_occurrence_notifications: {
        Args: { p_now?: string; p_occ: string };
        Returns: undefined;
      };
      claim_due_notifications: {
        Args: { p_limit?: number; p_now?: string };
        Returns: {
          attempts: number;
          channel: string;
          claimed_at: string | null;
          created_at: string;
          dedupe_key: string;
          id: string;
          kind: string;
          last_error: string | null;
          next_attempt_at: string | null;
          occurrence_id: string | null;
          payload: NonNullable<Json>;
          read_at: string | null;
          reminder_id: string | null;
          scheduled_for: string;
          sent_at: string | null;
          status: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "notifications";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      cleanup_old_data: { Args: Record<PropertyKey, never>; Returns: Json };
      clear_demo_data: { Args: Record<PropertyKey, never>; Returns: number };
      compute_tips: { Args: { p_now?: string; p_user: string }; Returns: number };
      dashboard_summary: { Args: { p_month?: string }; Returns: Json };
      enqueue_extra_notifications: { Args: { p_now?: string }; Returns: number };
      ensure_occurrences: {
        Args: { p_horizon_days?: number; p_now?: string; p_reminder_id?: string };
        Returns: number;
      };
      ensure_occurrences_all: { Args: { p_now?: string }; Returns: number };
      export_my_data: { Args: Record<PropertyKey, never>; Returns: Json };
      finish_notification: {
        Args: { p_error?: string; p_id: string; p_now?: string; p_outcome: string };
        Returns: undefined;
      };
      fx_convert: {
        Args: { p_amount: number; p_from: string; p_on: string; p_to: string };
        Returns: number;
      };
      group_key: { Args: { p_slot: number }; Returns: string };
      ics_feed: {
        Args: { p_token: string };
        Returns: {
          amount: number;
          currency: string;
          due_date: string;
          name: string;
          offset_days: number;
          remind: boolean;
          uid: string;
        }[];
      };
      is_valid_timezone: { Args: { tz: string }; Returns: boolean };
      load_demo_data: { Args: Record<PropertyKey, never>; Returns: number };
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number };
      mark_paid: {
        Args: { p_occurrence_id: string; p_paid_amount?: number; p_paid_on?: string };
        Returns: {
          amount: number;
          created_at: string;
          currency: string;
          due_date: string;
          id: string;
          paid_amount: number | null;
          paid_at: string | null;
          paid_on: string | null;
          reminder_id: string;
          snoozed_until: string | null;
          status: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "occurrences";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mark_unpaid: {
        Args: { p_occurrence_id: string };
        Returns: {
          amount: number;
          created_at: string;
          currency: string;
          due_date: string;
          id: string;
          paid_amount: number | null;
          paid_at: string | null;
          paid_on: string | null;
          reminder_id: string;
          snoozed_until: string | null;
          status: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "occurrences";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      month_start: { Args: { d: string }; Returns: string };
      monthly_equivalent: {
        Args: {
          p_amount: number;
          p_base: string;
          p_currency: string;
          p_every: number;
          p_on: string;
          p_unit: string;
        };
        Returns: number;
      };
      news_feed: {
        Args: {
          p_before_id?: string;
          p_before_published?: string;
          p_limit?: number;
          p_topic?: string;
        };
        Returns: {
          expires_at: string;
          freshness: string;
          id: string;
          image_url: string;
          published_at: string;
          snippet: string;
          source_key: string;
          source_name: string;
          title: string;
          topic: string;
          url: string;
        }[];
      };
      news_get: {
        Args: { p_id: string };
        Returns: {
          expires_at: string;
          freshness: string;
          id: string;
          image_url: string;
          published_at: string;
          snippet: string;
          source_key: string;
          source_name: string;
          title: string;
          topic: string;
          url: string;
        }[];
      };
      occurrence_dates: {
        Args: {
          p_end?: string;
          p_every: number;
          p_from: string;
          p_month_end: boolean;
          p_start: string;
          p_to: string;
          p_unit: string;
        };
        Returns: string[];
      };
      ops_health: { Args: Record<PropertyKey, never>; Returns: Json };
      preview_dates: {
        Args: {
          p_count?: number;
          p_every: number;
          p_month_end?: boolean;
          p_start: string;
          p_unit: string;
        };
        Returns: string[];
      };
      process_auto_paid: { Args: { p_now?: string }; Returns: number };
      rebuild_notification_queue: {
        Args: { p_now?: string; p_reminder_id: string };
        Returns: number;
      };
      rebuild_notification_queue_all: { Args: { p_now?: string }; Returns: number };
      record_push_result: {
        Args: { p_http: number; p_now?: string; p_sub: string };
        Returns: undefined;
      };
      refresh_tips: { Args: Record<PropertyKey, never>; Returns: number };
      refresh_tips_all: { Args: { p_now?: string }; Returns: number };
      register_push_subscription: {
        Args: {
          p_auth: string;
          p_endpoint: string;
          p_label?: string;
          p_p256dh: string;
          p_platform?: string;
          p_user_agent?: string;
        };
        Returns: {
          auth: string;
          created_at: string;
          disabled_at: string | null;
          endpoint: string;
          failed_count: number;
          id: string;
          label: string | null;
          last_seen_at: string;
          last_success_at: string | null;
          p256dh: string;
          platform: string | null;
          user_agent: string | null;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "push_subscriptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reminder_history: {
        Args: { p_limit?: number; p_reminder_id: string };
        Returns: {
          amount: number;
          change_pct: number;
          currency: string;
          due_date: string;
          occurrence_id: string;
          overdue: boolean;
          paid_amount: number;
          paid_on: string;
          prev_amount: number;
          status: string;
        }[];
      };
      rotate_ics_token: { Args: Record<PropertyKey, never>; Returns: string };
      run_daily_maintenance: { Args: { p_now?: string }; Returns: Json };
      skip_occurrence: {
        Args: { p_occurrence_id: string };
        Returns: {
          amount: number;
          created_at: string;
          currency: string;
          due_date: string;
          id: string;
          paid_amount: number | null;
          paid_at: string | null;
          paid_on: string | null;
          reminder_id: string;
          snoozed_until: string | null;
          status: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "occurrences";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      snooze_occurrence: {
        Args: { p_occurrence_id: string; p_until?: string };
        Returns: {
          amount: number;
          created_at: string;
          currency: string;
          due_date: string;
          id: string;
          paid_amount: number | null;
          paid_at: string | null;
          paid_on: string | null;
          reminder_id: string;
          snoozed_until: string | null;
          status: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "occurrences";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      tip_action: {
        Args: { p_action: string; p_tip_id: string };
        Returns: {
          code: string;
          created_at: string;
          est_monthly_saving: number | null;
          fingerprint: string;
          id: string;
          params: NonNullable<Json>;
          reminder_ids: string[];
          severity: string;
          snoozed_until: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "tips";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      tip_cfg: { Args: { p_key: string }; Returns: number };
      unread_notifications: { Args: Record<PropertyKey, never>; Returns: number };
      unregister_push_subscription: { Args: { p_endpoint: string }; Returns: boolean };
      upcoming_days: {
        Args: { p_days?: number };
        Returns: {
          day: string;
          items: number;
          total: number;
        }[];
      };
      user_today: { Args: Record<PropertyKey, never>; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
