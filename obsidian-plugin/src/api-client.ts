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
      const data = response.json;
      const results = (data.results ?? data) as any[];
      return results.map((r: any) => ({
        ...r,
        title: r.title || r.name || r.key || "Untitled",
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
