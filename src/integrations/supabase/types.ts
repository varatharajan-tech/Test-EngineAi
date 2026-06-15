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
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          columns: string[]
          created_at: string
          file_type: string | null
          id: string
          name: string
          preview: Json
          record_count: number
          source: string | null
          status: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          columns?: string[]
          created_at?: string
          file_type?: string | null
          id?: string
          name: string
          preview?: Json
          record_count?: number
          source?: string | null
          status?: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          columns?: string[]
          created_at?: string
          file_type?: string | null
          id?: string
          name?: string
          preview?: Json
          record_count?: number
          source?: string | null
          status?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      engines: {
        Row: {
          bore: number
          compression_ratio: number
          conn_rod_length: number | null
          cooling: string
          created_at: string
          cylinders: number
          displacement: number | null
          engine_type: string
          id: string
          is_preset: boolean
          name: string
          stroke: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bore: number
          compression_ratio: number
          conn_rod_length?: number | null
          cooling?: string
          created_at?: string
          cylinders: number
          displacement?: number | null
          engine_type: string
          id?: string
          is_preset?: boolean
          name: string
          stroke: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bore?: number
          compression_ratio?: number
          conn_rod_length?: number | null
          cooling?: string
          created_at?: string
          cylinders?: number
          displacement?: number | null
          engine_type?: string
          id?: string
          is_preset?: boolean
          name?: string
          stroke?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      fuels: {
        Row: {
          air_fuel_ratio: number
          calorific_value: number
          carbon_fraction: number
          cetane_number: number | null
          created_at: string
          density: number
          flash_point: number | null
          fuel_type: string
          id: string
          is_preset: boolean
          latent_heat: number | null
          name: string
          octane_number: number | null
          updated_at: string
          user_id: string | null
          viscosity: number | null
        }
        Insert: {
          air_fuel_ratio: number
          calorific_value: number
          carbon_fraction?: number
          cetane_number?: number | null
          created_at?: string
          density: number
          flash_point?: number | null
          fuel_type: string
          id?: string
          is_preset?: boolean
          latent_heat?: number | null
          name: string
          octane_number?: number | null
          updated_at?: string
          user_id?: string | null
          viscosity?: number | null
        }
        Update: {
          air_fuel_ratio?: number
          calorific_value?: number
          carbon_fraction?: number
          cetane_number?: number | null
          created_at?: string
          density?: number
          flash_point?: number | null
          fuel_type?: string
          id?: string
          is_preset?: boolean
          latent_heat?: number | null
          name?: string
          octane_number?: number | null
          updated_at?: string
          user_id?: string | null
          viscosity?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          units: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          units?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          units?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          format: string
          id: string
          simulation_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          format: string
          id?: string
          simulation_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          simulation_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_results: {
        Row: {
          brake_power: number | null
          bsfc: number | null
          co: number | null
          co2: number | null
          confidence: number | null
          created_at: string
          curve: Json | null
          fuel_consumption: number | null
          hc: number | null
          indicated_power: number | null
          mechanical_efficiency: number | null
          nox: number | null
          simulation_id: string
          smoke: number | null
          thermal_efficiency: number | null
          torque: number | null
          volumetric_efficiency: number | null
        }
        Insert: {
          brake_power?: number | null
          bsfc?: number | null
          co?: number | null
          co2?: number | null
          confidence?: number | null
          created_at?: string
          curve?: Json | null
          fuel_consumption?: number | null
          hc?: number | null
          indicated_power?: number | null
          mechanical_efficiency?: number | null
          nox?: number | null
          simulation_id: string
          smoke?: number | null
          thermal_efficiency?: number | null
          torque?: number | null
          volumetric_efficiency?: number | null
        }
        Update: {
          brake_power?: number | null
          bsfc?: number | null
          co?: number | null
          co2?: number | null
          confidence?: number | null
          created_at?: string
          curve?: Json | null
          fuel_consumption?: number | null
          hc?: number | null
          indicated_power?: number | null
          mechanical_efficiency?: number | null
          nox?: number | null
          simulation_id?: string
          smoke?: number | null
          thermal_efficiency?: number | null
          torque?: number | null
          volumetric_efficiency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "simulation_results_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: true
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          ambient_temp: number
          created_at: string
          engine_id: string
          fuel_id: string
          id: string
          intake_pressure: number
          intake_temp: number
          load_pct: number
          notes: string | null
          rpm: number
          status: string
          user_id: string
        }
        Insert: {
          ambient_temp?: number
          created_at?: string
          engine_id: string
          fuel_id: string
          id?: string
          intake_pressure?: number
          intake_temp?: number
          load_pct: number
          notes?: string | null
          rpm: number
          status?: string
          user_id: string
        }
        Update: {
          ambient_temp?: number
          created_at?: string
          engine_id?: string
          fuel_id?: string
          id?: string
          intake_pressure?: number
          intake_temp?: number
          load_pct?: number
          notes?: string | null
          rpm?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulations_engine_id_fkey"
            columns: ["engine_id"]
            isOneToOne: false
            referencedRelation: "engines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulations_fuel_id_fkey"
            columns: ["fuel_id"]
            isOneToOne: false
            referencedRelation: "fuels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
