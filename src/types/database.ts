/**
 * Supabase Database Types
 * Auto-generated with: supabase gen types typescript
 * @author haiping.yu@zoom.us
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          avatar_url: string | null;
          settings: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          settings?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          settings?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      todos: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          deadline: string | null;
          reminder: string | null;
          tags: string[];
          category: string | null;
          ai_suggestions: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          deadline?: string | null;
          reminder?: string | null;
          tags?: string[];
          category?: string | null;
          ai_suggestions?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          deadline?: string | null;
          reminder?: string | null;
          tags?: string[];
          category?: string | null;
          ai_suggestions?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      attachments: {
        Row: {
          id: string;
          todo_id: string;
          type: 'image' | 'file';
          name: string;
          size: number;
          mime_type: string;
          storage_path: string;
          thumbnail_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          todo_id: string;
          type: 'image' | 'file';
          name: string;
          size: number;
          mime_type: string;
          storage_path: string;
          thumbnail_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          todo_id?: string;
          type?: 'image' | 'file';
          name?: string;
          size?: number;
          mime_type?: string;
          storage_path?: string;
          thumbnail_path?: string | null;
          created_at?: string;
        };
      };
      knowledge_items: {
        Row: {
          id: string;
          user_id: string;
          type: 'article' | 'note';
          url: string | null;
          title: string;
          content: string | null;
          summary: string | null;
          tags: string[];
          keywords: string[];
          category: string | null;
          source: string | null;
          author: string | null;
          published_at: string | null;
          status: 'pending' | 'processing' | 'ready' | 'error';
          processing_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'article' | 'note';
          url?: string | null;
          title: string;
          content?: string | null;
          summary?: string | null;
          tags?: string[];
          keywords?: string[];
          category?: string | null;
          source?: string | null;
          author?: string | null;
          published_at?: string | null;
          status?: 'pending' | 'processing' | 'ready' | 'error';
          processing_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'article' | 'note';
          url?: string | null;
          title?: string;
          content?: string | null;
          summary?: string | null;
          tags?: string[];
          keywords?: string[];
          category?: string | null;
          source?: string | null;
          author?: string | null;
          published_at?: string | null;
          status?: 'pending' | 'processing' | 'ready' | 'error';
          processing_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      highlights: {
        Row: {
          id: string;
          knowledge_item_id: string;
          highlighted_text: string;
          note: string | null;
          start_pos: number;
          end_pos: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          knowledge_item_id: string;
          highlighted_text: string;
          note?: string | null;
          start_pos: number;
          end_pos: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          knowledge_item_id?: string;
          highlighted_text?: string;
          note?: string | null;
          start_pos?: number;
          end_pos?: number;
          created_at?: string;
        };
      };
      embeddings: {
        Row: {
          id: string;
          knowledge_item_id: string;
          embedding: number[];
          model: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          knowledge_item_id: string;
          embedding: number[];
          model: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          knowledge_item_id?: string;
          embedding?: number[];
          model?: string;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      todo_status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
      todo_priority: 'low' | 'medium' | 'high' | 'urgent';
      attachment_type: 'image' | 'file';
      knowledge_type: 'article' | 'note';
      knowledge_status: 'pending' | 'processing' | 'ready' | 'error';
    };
  };
}

