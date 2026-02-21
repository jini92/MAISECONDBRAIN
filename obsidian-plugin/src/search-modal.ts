import { App, SuggestModal, Notice, TFile } from "obsidian";
import type { MnemoApiClient, MnemoSearchResult } from "./api-client";
import type { MnemoSettings } from "./settings";

// Mnemo 검색 모달 / Search modal (Ctrl+Shift+M)
export class MnemoSearchModal extends SuggestModal<MnemoSearchResult> {
  private results: MnemoSearchResult[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    app: App,
    private apiClient: MnemoApiClient,
    private settings: MnemoSettings
  ) {
    super(app);
    this.setPlaceholder("Mnemo 검색... / Search Mnemo...");
  }

  async getSuggestions(query: string): Promise<MnemoSearchResult[]> {
    if (!query || query.length < 2) return [];

    // 디바운스 300ms / Debounce input
    return new Promise((resolve) => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(async () => {
        this.results = await this.apiClient.search(
          query,
          this.settings.searchMode,
          this.settings.searchLimit
        );
        resolve(this.results);
      }, 300);
    });
  }

  renderSuggestion(result: MnemoSearchResult, el: HTMLElement): void {
    const container = el.createDiv({ cls: "mnemo-search-result" });
    container.createEl("div", {
      text: result.title,
      cls: "mnemo-result-title",
    });
    container.createEl("small", {
      text: result.snippet,
      cls: "mnemo-result-snippet",
    });
    container.createEl("span", {
      text: `score: ${result.score.toFixed(3)}`,
      cls: "mnemo-result-score",
    });
  }

  async onChooseSuggestion(result: MnemoSearchResult): Promise<void> {
    // 볼트에서 해당 노트 열기 / Open matching note in vault
    let path = result.path || `${result.title}.md`;
    if (!path.endsWith(".md")) path += ".md";
    const file = this.app.vault.getAbstractFileByPath(path);

    if (file instanceof TFile) {
      await this.app.workspace.getLeaf().openFile(file);
    } else {
      new Notice(`노트를 찾을 수 없습니다: ${result.title}\nNote not found in vault.`);
    }
  }
}
