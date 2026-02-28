import { requestUrl } from "obsidian";

// Mnemo API 검색 결과 타입 / Search result type
export interface MnemoSearchResult {
  name: string;
  title: string;
  snippet: string;
  score: number;
  entity_type?: string;
  source?: string;
  path?: string;
}

// Mnemo 서버 통계 / Server stats
export interface MnemoStats {
  total_notes: number;
  total_edges: number;
  index_status: string;
}

export interface SubgraphNode {
  id: string;
  name: string;
  type: string;
  score?: number;
}

export interface SubgraphEdge {
  source: string;
  target: string;
  type: string;
}

// API 응답 내부 타입 / Internal API response types
interface RawSearchResult {
  name?: string;
  title?: string;
  key?: string;
  snippet?: string;
  score?: number;
  entity_type?: string;
  source?: string;
  path?: string;
}

interface SearchApiResponse {
  results?: RawSearchResult[];
}

export interface ClusterInfo {
  id: string;
  hub_name: string;
  size: number;
  dominant_type: string;
  x: number;
  y: number;
  index: number;
}

export interface ClustersResponse {
  clusters: ClusterInfo[];
  edges?: Array<{ source: string; target: string }>;
}

// 사전 계산된 레이아웃 좌표를 포함한 노드 타입
export interface SubgraphNodeWithLayout extends SubgraphNode {
  degree?: number;
  x?: number;
  y?: number;
}

export class MnemoApiClient {
  constructor(private baseUrl: string) {}

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, "");
  }

  // 검색 API 호출 / Call search API
  async search(
    query: string,
    mode: string = "hybrid",
    limit: number = 10
  ): Promise<MnemoSearchResult[]> {
    const params = new URLSearchParams({ q: query, mode, limit: String(limit) });
    const url = `${this.baseUrl}/search?${params}`;

    try {
      const response = await requestUrl({ url, method: "GET" });
      const data = response.json as SearchApiResponse | RawSearchResult[];
      const rawResults: RawSearchResult[] = Array.isArray(data)
        ? data
        : (data.results ?? []);
      return rawResults.map((r: RawSearchResult): MnemoSearchResult => ({
        name: r.name ?? "",
        title: r.title || r.name || r.key || "Untitled",
        snippet: r.snippet ?? "",
        score: r.score ?? 0,
        entity_type: r.entity_type,
        source: r.source,
        path: r.path,
      }));
    } catch (err) {
      this.handleError(err);
      return [];
    }
  }

  // 서버 상태 확인 / Check server stats
  async stats(): Promise<MnemoStats | null> {
    try {
      const response = await requestUrl({
        url: `${this.baseUrl}/stats`,
        method: "GET",
      });
      return response.json as MnemoStats;
    } catch (err) {
      this.handleError(err);
      return null;
    }
  }

  // 서브그래프 조회 / Get subgraph for visualization
  async subgraph(
    center: string,
    depth: number = 2
  ): Promise<{ nodes: SubgraphNode[]; edges: SubgraphEdge[] } | null> {
    const params = new URLSearchParams({ center, depth: String(depth) });
    const url = `${this.baseUrl}/graph/subgraph?${params}`;
    try {
      const response = await requestUrl({ url, method: "GET" });
      return response.json as { nodes: SubgraphNode[]; edges: SubgraphEdge[] };
    } catch (err) {
      this.handleError(err);
      return null;
    }
  }

  // 클러스터 그래프 (계층적 탐색) / Cluster graph for drill-down
  async clusters(): Promise<ClustersResponse | null> {
    try {
      const response = await requestUrl({ url: `${this.baseUrl}/graph/clusters`, method: "GET" });
      return response.json as ClustersResponse;
    } catch (err) {
      this.handleError(err);
      return null;
    }
  }

  // 클러스터 상세 (drill-down) / Cluster detail
  async clusterDetail(index: number): Promise<{ nodes: SubgraphNodeWithLayout[]; edges: SubgraphEdge[] } | null> {
    try {
      const response = await requestUrl({ url: `${this.baseUrl}/graph/cluster/${index}`, method: "GET" });
      return response.json as { nodes: SubgraphNodeWithLayout[]; edges: SubgraphEdge[] };
    } catch (err) {
      this.handleError(err);
      return null;
    }
  }

  // 전체 그래프 (사전 계산 레이아웃) / Full graph with precomputed layout
  async fullGraph(): Promise<{ nodes: SubgraphNodeWithLayout[]; edges: SubgraphEdge[]; layout: string } | null> {
    const url = `${this.baseUrl}/graph/full`;
    try {
      const response = await requestUrl({ url, method: "GET" });
      return response.json as { nodes: SubgraphNodeWithLayout[]; edges: SubgraphEdge[]; layout: string };
    } catch (err) {
      this.handleError(err);
      return null;
    }
  }

  // 에러 처리 / Error handling with friendly messages
  private handleError(err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("net::ERR")) {
      console.error(
        `[Mnemo] 서버에 연결할 수 없습니다. Mnemo 서버가 실행 중인지 확인하세요.\n` +
          `Cannot connect to Mnemo server at ${this.baseUrl}. Is it running?`
      );
    } else {
      console.error(`[Mnemo] API error: ${msg}`);
    }
  }
}
