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
    this.addRibbonIcon("brain", "Mnemo Search", () => {
      new MnemoSearchModal(this.app, this.apiClient, this.settings).open();
    });

    // 검색 커맨드 (Ctrl+Shift+M) / Search command
    this.addCommand({
      id: "mnemo-search",
      name: "Search Mnemo",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "m" }],
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
    this.addRibbonIcon("git-fork", "Mnemo Graph", () => {
      this.openGraphView();
    });

    // 그래프 뷰 열기 커맨드
    this.addCommand({
      id: "mnemo-open-graph",
      name: "Mnemo: Open Graph View",
      callback: () => this.openGraphView(),
    });

    // 서버 상태 확인 / Check server on load
    this.addCommand({
      id: "mnemo-check-status",
      name: "Check Mnemo Server Status",
      callback: async () => {
        const stats = await this.apiClient.stats();
        if (stats) {
          new Notice(`Mnemo: ${stats.total_notes} notes, ${stats.total_edges} edges`);
        } else {
          new Notice("Mnemo: 서버에 연결할 수 없습니다 / Server unreachable");
        }
      },
    });

    console.log("Mnemo SecondBrain plugin loaded");
  }

  onunload(): void {
    console.log("Mnemo SecondBrain plugin unloaded");
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
    this.app.workspace.revealLeaf(leaf);

    // 현재 노트 기준으로 그래프 로드
    const file = this.app.workspace.getActiveFile();
    if (file) {
      const view = leaf.view as MnemoGraphView;
      view.setCenterPath(file.path);
    }
  }
}
