import { Plugin, Notice } from "obsidian";
import { MnemoApiClient } from "./api-client";
import { MnemoSettings, MnemoSettingTab, DEFAULT_SETTINGS } from "./settings";
import { MnemoSearchModal } from "./search-modal";
import { MnemoGraphView, MNEMO_GRAPH_VIEW_TYPE } from "./graph-view";

// Mnemo SecondBrain Obsidian Plugin
export default class MnemoPlugin extends Plugin {
  settings: MnemoSettings = DEFAULT_SETTINGS;
  apiClient: MnemoApiClient = new MnemoApiClient(DEFAULT_SETTINGS.apiUrl);

  async onload(): Promise<void> {
    await this.loadSettings();
    this.apiClient.setBaseUrl(this.settings.apiUrl);

    // 설정 탭 등록 / Register settings tab
    this.addSettingTab(new MnemoSettingTab(this.app, this));

    // 리본 아이콘 / Ribbon icon
    this.addRibbonIcon("brain", "Mnemo search", () => {
      new MnemoSearchModal(this.app, this.apiClient, this.settings).open();
    });

    // 검색 커맨드 / Search command
    this.addCommand({
      id: "mnemo-search",
      name: "Mnemo: search",
      callback: () => {
        new MnemoSearchModal(this.app, this.apiClient, this.settings).open();
      },
    });

    // 그래프 뷰 등록 / Register graph view
    this.registerView(
      MNEMO_GRAPH_VIEW_TYPE,
      (leaf) => new MnemoGraphView(leaf, this.apiClient)
    );

    // 그래프 뷰 리본 아이콘
    this.addRibbonIcon("git-fork", "Mnemo graph", () => {
      void this.openGraphView();
    });

    // 그래프 뷰 열기 커맨드
    this.addCommand({
      id: "mnemo-open-graph",
      name: "Mnemo: open graph view",
      callback: () => { void this.openGraphView(); },
    });

    // 서버 상태 확인 / Check server on load
    this.addCommand({
      id: "mnemo-check-status",
      name: "Mnemo: check server status",
      callback: async () => {
        const stats = await this.apiClient.stats();
        if (stats) {
          new Notice(`Mnemo: ${stats.total_notes} notes, ${stats.total_edges} edges`);
        } else {
          new Notice("Mnemo: 서버에 연결할 수 없습니다 / server unreachable");
        }
      },
    });

    console.debug("Mnemo SecondBrain plugin loaded");
  }

  onunload(): void {
    console.debug("Mnemo SecondBrain plugin unloaded");
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData() as Partial<MnemoSettings>;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async openGraphView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(MNEMO_GRAPH_VIEW_TYPE);
    let leaf: import("obsidian").WorkspaceLeaf;
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = this.app.workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: MNEMO_GRAPH_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);

    // 현재 노트 기준으로 그래프 로드
    const file = this.app.workspace.getActiveFile();
    if (file) {
      const view = leaf.view as MnemoGraphView;
      view.setCenterPath(file.path);
    }
  }
}
