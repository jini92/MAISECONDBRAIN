import { ItemView, WorkspaceLeaf } from "obsidian";
import type { MnemoApiClient } from "./api-client";

export const MNEMO_GRAPH_VIEW_TYPE = "mnemo-graph-view";

// 그래프 시각화 뷰 (placeholder) / Graph visualization view
export class MnemoGraphView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private apiClient: MnemoApiClient
  ) {
    super(leaf);
  }

  getViewType(): string {
    return MNEMO_GRAPH_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Mnemo Graph";
  }

  getIcon(): string {
    return "git-fork";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl("h3", { text: "Mnemo Knowledge Graph" });

    // 서버 상태 확인 / Check server status
    const stats = await this.apiClient.stats();
    if (stats) {
      const info = container.createDiv({ cls: "mnemo-graph-info" });
      info.createEl("p", { text: `📝 Notes: ${stats.total_notes}` });
      info.createEl("p", { text: `🔗 Edges: ${stats.total_edges}` });
      info.createEl("p", { text: `📊 Status: ${stats.index_status}` });
    } else {
      container.createEl("p", {
        text: "⚠️ Mnemo 서버에 연결할 수 없습니다. 서버를 시작하세요.",
        cls: "mnemo-error",
      });
    }

    // TODO: D3.js 또는 Canvas 기반 그래프 시각화 구현
    container.createEl("p", {
      text: "🚧 Graph visualization coming soon...",
      cls: "mnemo-placeholder",
    });
  }

  async onClose(): Promise<void> {
    // cleanup
  }
}
