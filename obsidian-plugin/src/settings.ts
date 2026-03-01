import { App, PluginSettingTab, Setting } from "obsidian";
import type MnemoPlugin from "./main";

// 플러그인 설정 인터페이스 / Plugin settings interface
export interface MnemoSettings {
  apiUrl: string;
  searchLimit: number;
  searchMode: "hybrid" | "vector" | "keyword" | "graph";
}

export const DEFAULT_SETTINGS: MnemoSettings = {
  apiUrl: "http://127.0.0.1:8000",
  searchLimit: 10,
  searchMode: "hybrid",
};

// 설정 탭 / Settings tab
export class MnemoSettingTab extends PluginSettingTab {
  plugin: MnemoPlugin;

  constructor(app: App, plugin: MnemoPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // API URL 설정
    new Setting(containerEl)
      .setName("Mnemo API URL")
      .setDesc("Mnemo FastAPI server address (default: http://127.0.0.1:8000)")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:8000")
          .setValue(this.plugin.settings.apiUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiUrl = value;
            this.plugin.apiClient.setBaseUrl(value);
            await this.plugin.saveSettings();
          })
      );

    // 검색 결과 수
    new Setting(containerEl)
      .setName("Search result limit")
      .setDesc("Maximum number of search results to show")
      .addSlider((slider) =>
        slider
          .setLimits(5, 50, 5)
          .setValue(this.plugin.settings.searchLimit)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.searchLimit = value;
            await this.plugin.saveSettings();
          })
      );

    // 검색 모드
    new Setting(containerEl)
      .setName("Search mode")
      .setDesc("Select the search method to use")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            hybrid: "Hybrid (keyword + vector)",
            vector: "Vector (semantic)",
            keyword: "Keyword (BM25)",
            graph: "Graph (relationship)",
          })
          .setValue(this.plugin.settings.searchMode)
          .onChange(async (value) => {
            this.plugin.settings.searchMode = value as MnemoSettings["searchMode"];
            await this.plugin.saveSettings();
          })
      );
  }
}
