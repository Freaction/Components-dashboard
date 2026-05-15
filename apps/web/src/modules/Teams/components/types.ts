export interface Node {
  id: string;
  session_id: string;
  name: string;
  type: string;
  parent_id: string | null;
  depth: number;
  file_key?: string;
  file_name?: string;
  component_id?: string;
  has_children?: boolean;
}

export interface Team { id: string; name: string; }
export interface Session { id: string; status: string; nodes_count: number; created_at: string; }
export interface File { id: number; team_id: string; file_key: string; file_name: string; }
