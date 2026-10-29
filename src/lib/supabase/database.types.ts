export type AppRole = "student" | "admin";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamped = {
  created_at: string;
  updated_at: string;
};

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Timestamped & { id: string; role: AppRole },
        { id: string },
        { updated_at?: string }
      >;
      documents: Table<
        Timestamped & {
          id: string;
          title: string;
          description: string | null;
          storage_path: string | null;
          mime_type: string | null;
          uploaded_by: string | null;
          metadata: Record<string, unknown>;
        },
        {
          id?: string;
          title: string;
          description?: string | null;
          storage_path?: string | null;
          mime_type?: string | null;
          uploaded_by?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        }
      >;
      chunks: Table<
        {
          id: string;
          document_id: string;
          chunk_index: number;
          content: string;
          embedding: number[] | null;
          metadata: Record<string, unknown>;
          created_at: string;
        },
        {
          id?: string;
          document_id: string;
          chunk_index: number;
          content: string;
          embedding?: number[] | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        }
      >;
      chats: Table<
        Timestamped & { id: string; user_id: string; title: string | null },
        {
          id?: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      messages: Table<
        {
          id: string;
          chat_id: string;
          sender: "user" | "assistant";
          content: string;
          citations: Json;
          evidence_found: boolean | null;
          question_message_id: string | null;
          created_at: string;
        },
        {
          id?: string;
          chat_id: string;
          sender: "user" | "assistant";
          content: string;
          citations?: Json;
          evidence_found?: boolean | null;
          question_message_id?: string | null;
          created_at?: string;
        }
      >;
      feedback: Table<
        Timestamped & {
          id: string;
          user_id: string;
          message_id: string;
          rating: number;
          comment: string | null;
          sentiment: "positive" | "negative" | null;
        },
        {
          id?: string;
          user_id: string;
          message_id: string;
          rating: number;
          comment?: string | null;
          sentiment?: "positive" | "negative" | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      set_profile_role: {
        Args: { p_user_id: string; p_role: AppRole };
        Returns: undefined;
      };
      match_document_chunks: {
        Args: {
          p_query_embedding: number[];
          p_match_threshold?: number;
          p_match_count?: number;
        };
        Returns: {
          chunk_id: string;
          document_id: string;
          title: string;
          content: string;
          metadata: Json;
          similarity: number;
        }[];
      };
      save_chat_exchange: {
        Args: {
          p_user_id: string;
          p_chat_id: string;
          p_question: string;
          p_answer: string;
          p_citations: Json;
          p_evidence_found: boolean;
        };
        Returns: {
          user_message_id: string;
          assistant_message_id: string;
        }[];
      };
      get_admin_analytics: {
        Args: Record<string, never>;
        Returns: Json;
      };
    };
    Enums: {
      app_role: AppRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
