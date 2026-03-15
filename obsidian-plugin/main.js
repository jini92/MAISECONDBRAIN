"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MnemoPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/api-client.ts
var import_obsidian = require("obsidian");
function isLineageAmbiguousDetail(value) {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  if (!("code" in value) || value.code !== "ambiguous_node") {
    return false;
  }
  return "query" in value && typeof value.query === "string" && "message" in value && typeof value.message === "string" && "candidates" in value && Array.isArray(value.candidates);
}
var MnemoApiClient = class {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  setBaseUrl(url) {
    this.baseUrl = url.replace(/\/+$/, "");
  }
  // 검색 API 호출 / Call search API
  async search(query, mode = "hybrid", limit = 10) {
    const params = new URLSearchParams({ q: query, mode, limit: String(limit) });
    const url = `${this.baseUrl}/search?${params}`;
    try {
      const response = await (0, import_obsidian.requestUrl)({ url, method: "GET" });
      const data = response.json;
      const rawResults = Array.isArray(data) ? data : data.results ?? [];
      return rawResults.map((r) => ({
        name: r.name ?? "",
        title: r.title || r.name || r.key || "Untitled",
        snippet: r.snippet ?? "",
        score: r.score ?? 0,
        entity_type: r.entity_type,
        source: r.source,
        path: r.path
      }));
    } catch (err) {
      this.handleError(err);
      return [];
    }
  }
  // 서버 상태 확인 / Check server stats
  async stats() {
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: `${this.baseUrl}/stats`,
        method: "GET"
      });
      return response.json;
    } catch (err) {
      this.handleError(err);
      return null;
    }
  }
  // 서브그래프 조회 / Get subgraph for visualization
  async subgraph(center, depth = 2) {
    const params = new URLSearchParams({ center, depth: String(depth) });
    const url = `${this.baseUrl}/graph/subgraph?${params}`;
    try {
      const response = await (0, import_obsidian.requestUrl)({ url, method: "GET" });
      return response.json;
    } catch (err) {
      this.handleError(err);
      return null;
    }
  }
  // 계보 그래프 조회 / Get lineage graph around a note
  async lineage(node, depth = 2, direction = "both") {
    const params = new URLSearchParams({
      node,
      depth: String(depth),
      direction
    });
    const url = `${this.baseUrl}/graph/lineage?${params}`;
    try {
      const response = await (0, import_obsidian.requestUrl)({ url, method: "GET" });
      const payload = response.json;
      if (response.status === 409) {
        const detail = this.extractAmbiguousDetail(payload);
        if (detail) {
          return { kind: "ambiguous", detail };
        }
      }
      return { kind: "ok", data: payload };
    } catch (err) {
      const detail = this.tryExtractAmbiguousDetail(err);
      if (detail) {
        return { kind: "ambiguous", detail };
      }
      this.handleError(err);
      return null;
    }
  }
  // 클러스터 그래프 (계층적 탐색) / Cluster graph for drill-down
  async clusters() {
    try {
      const response = await (0, import_obsidian.requestUrl)({ url: `${this.baseUrl}/graph/clusters`, method: "GET" });
      return response.json;
    } catch (err) {
      this.handleError(err);
      return null;
    }
  }
  // 클러스터 상세 (drill-down) / Cluster detail
  async clusterDetail(index) {
    try {
      const response = await (0, import_obsidian.requestUrl)({ url: `${this.baseUrl}/graph/cluster/${index}`, method: "GET" });
      return response.json;
    } catch (err) {
      this.handleError(err);
      return null;
    }
  }
  // 전체 그래프 (사전 계산 레이아웃) / Full graph with precomputed layout
  async fullGraph() {
    const url = `${this.baseUrl}/graph/full`;
    try {
      const response = await (0, import_obsidian.requestUrl)({ url, method: "GET" });
      return response.json;
    } catch (err) {
      this.handleError(err);
      return null;
    }
  }
  // 에러 처리 / Error handling with friendly messages
  extractAmbiguousDetail(payload) {
    if (typeof payload !== "object" || payload == null) {
      return null;
    }
    const maybeWrapped = "detail" in payload && payload.detail ? payload.detail : payload;
    if (isLineageAmbiguousDetail(maybeWrapped)) {
      return maybeWrapped;
    }
    return null;
  }
  tryExtractAmbiguousDetail(err) {
    if (typeof err !== "object" || err == null) {
      return null;
    }
    const withText = err;
    const text = withText.text ?? withText.response?.text;
    const status = withText.status ?? withText.response?.status;
    if (status !== 409 || !text) {
      return null;
    }
    try {
      const payload = JSON.parse(text);
      return this.extractAmbiguousDetail(payload);
    } catch {
      return null;
    }
  }
  handleError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("net::ERR")) {
      console.error(
        `[Mnemo] \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. Mnemo \uC11C\uBC84\uAC00 \uC2E4\uD589 \uC911\uC778\uC9C0 \uD655\uC778\uD558\uC138\uC694.
Cannot connect to Mnemo server at ${this.baseUrl}. Is it running?`
      );
    } else {
      console.error(`[Mnemo] API error: ${msg}`);
    }
  }
};

// src/settings.ts
var import_obsidian2 = require("obsidian");
var DEFAULT_SETTINGS = {
  apiUrl: "http://127.0.0.1:8000",
  searchLimit: 10,
  searchMode: "hybrid"
};
var MnemoSettingTab = class extends import_obsidian2.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("Mnemo API URL").setDesc("Mnemo FastAPI server address (default: http://127.0.0.1:8000)").addText(
      (text) => text.setPlaceholder("http://127.0.0.1:8000").setValue(this.plugin.settings.apiUrl).onChange(async (value) => {
        this.plugin.settings.apiUrl = value;
        this.plugin.apiClient.setBaseUrl(value);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Search result limit").setDesc("Maximum number of search results to show").addSlider(
      (slider) => slider.setLimits(5, 50, 5).setValue(this.plugin.settings.searchLimit).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.searchLimit = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Search mode").setDesc("Select the search method to use").addDropdown(
      (dropdown) => dropdown.addOptions({
        hybrid: "Hybrid (keyword + vector)",
        vector: "Vector (semantic)",
        keyword: "Keyword (BM25)",
        graph: "Graph (relationship)"
      }).setValue(this.plugin.settings.searchMode).onChange(async (value) => {
        this.plugin.settings.searchMode = value;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/search-modal.ts
var import_obsidian3 = require("obsidian");
var MnemoSearchModal = class extends import_obsidian3.SuggestModal {
  constructor(app, apiClient, settings) {
    super(app);
    this.apiClient = apiClient;
    this.settings = settings;
    this.setPlaceholder("Mnemo search...");
  }
  results = [];
  debounceTimer = null;
  async getSuggestions(query) {
    if (!query || query.length < 2) return [];
    return new Promise((resolve) => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        void this.apiClient.search(query, this.settings.searchMode, this.settings.searchLimit).then((results) => {
          this.results = results;
          resolve(this.results);
        });
      }, 300);
    });
  }
  renderSuggestion(result, el) {
    const container = el.createDiv({ cls: "mnemo-search-result" });
    container.createEl("div", {
      text: result.title,
      cls: "mnemo-result-title"
    });
    container.createEl("small", {
      text: result.snippet,
      cls: "mnemo-result-snippet"
    });
    container.createEl("span", {
      text: `score: ${result.score.toFixed(3)}`,
      cls: "mnemo-result-score"
    });
  }
  onChooseSuggestion(result) {
    let path = result.path || `${result.title}.md`;
    if (!path.endsWith(".md")) path += ".md";
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian3.TFile) {
      void this.app.workspace.getLeaf().openFile(file);
    } else {
      new import_obsidian3.Notice(`\uB178\uD2B8\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${result.title}
Note not found in vault.`);
    }
  }
};

// src/graph-view.ts
var import_obsidian4 = require("obsidian");
var MNEMO_GRAPH_VIEW_TYPE = "mnemo-graph-view";
var TYPE_COLORS = {
  event: "#4A90D9",
  project: "#E8913A",
  note: "#50C878",
  source: "#9B59B6",
  decision: "#E74C3C",
  insight: "#F1C40F",
  tool: "#16A085",
  concept: "#5C7CFA",
  person: "#EC4899",
  unknown: "#888888"
};
var DEFAULT_COLOR = "#888888";
var LINEAGE_COLORS = {
  center: "#B388FF",
  upstream: "#F5B342",
  downstream: "#4DD0E1",
  bridge: "#7C3AED",
  unknown: "#8A8F98"
};
var LineageCandidateModal = class extends import_obsidian4.SuggestModal {
  constructor(app, detail) {
    super(app);
    this.detail = detail;
    this.setPlaceholder(`Choose lineage target for "${detail.query}"`);
    this.setInstructions([
      { command: "??", purpose: "move" },
      { command: "?", purpose: "select" },
      { command: "esc", purpose: "cancel" }
    ]);
  }
  resolver = null;
  settled = false;
  pick() {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.open();
    });
  }
  getSuggestions(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.detail.candidates;
    }
    return this.detail.candidates.filter((candidate) => {
      const haystacks = [candidate.name, candidate.path, candidate.entity_type, candidate.match_kind].map((value) => value.toLowerCase());
      return haystacks.some((value) => value.includes(normalized));
    });
  }
  renderSuggestion(candidate, el) {
    const container = el.createDiv({ cls: "mnemo-lineage-candidate" });
    container.createEl("div", { text: candidate.name, cls: "mnemo-lineage-candidate-title" });
    container.createEl("small", {
      text: `${candidate.entity_type} ? ${candidate.match_kind} ? score ${candidate.score}`,
      cls: "mnemo-lineage-candidate-meta"
    });
    container.createEl("div", { text: candidate.path, cls: "mnemo-lineage-candidate-path" });
  }
  onChooseSuggestion(candidate) {
    this.settled = true;
    this.resolver?.(candidate);
    this.resolver = null;
  }
  onClose() {
    super.onClose();
    if (!this.settled) {
      this.resolver?.(null);
      this.resolver = null;
    }
  }
};
var MnemoGraphView = class extends import_obsidian4.ItemView {
  constructor(leaf, apiClient) {
    super(leaf);
    this.apiClient = apiClient;
  }
  canvas = null;
  ctx = null;
  nodes = [];
  edges = [];
  nodeMap = /* @__PURE__ */ new Map();
  offsetX = 0;
  offsetY = 0;
  scale = 1;
  dragNode = null;
  isPanning = false;
  panStart = { x: 0, y: 0 };
  lastMouse = { x: 0, y: 0 };
  hoveredNode = null;
  animFrame = 0;
  simRunning = false;
  simIterations = 0;
  centerPath = "";
  viewMode = "lineage";
  clusterData = [];
  backBtn = null;
  allBtns = [];
  statusEl = null;
  legendEl = null;
  getViewType() {
    return MNEMO_GRAPH_VIEW_TYPE;
  }
  getDisplayText() {
    return "Mnemo graph";
  }
  getIcon() {
    return "git-fork";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("mnemo-graph-container");
    const toolbar = container.createDiv({ cls: "mnemo-graph-toolbar" });
    toolbar.createEl("span", { text: "Mnemo graph", cls: "mnemo-graph-title" });
    const lineageBtn = toolbar.createEl("button", {
      text: "\u{1F9EC} lineage",
      cls: "mnemo-graph-btn mnemo-graph-btn-active",
      attr: { title: "Current note lineage" }
    });
    lineageBtn.addEventListener("click", () => {
      this.setActiveBtn(lineageBtn);
      this.viewMode = "lineage";
      void this.loadLineage();
    });
    const localBtn = toolbar.createEl("button", {
      text: "\u{1F4CD} local",
      cls: "mnemo-graph-btn",
      attr: { title: "Current note neighborhood" }
    });
    localBtn.addEventListener("click", () => {
      this.setActiveBtn(localBtn);
      this.viewMode = "local";
      void this.loadGraph();
    });
    const clusterBtn = toolbar.createEl("button", {
      text: "\u{1F52E} explore",
      cls: "mnemo-graph-btn",
      attr: { title: "Explore by clusters" }
    });
    clusterBtn.addEventListener("click", () => {
      this.setActiveBtn(clusterBtn);
      this.viewMode = "cluster";
      void this.loadClusters();
    });
    const fullBtn = toolbar.createEl("button", {
      text: "\u{1F310} full",
      cls: "mnemo-graph-btn",
      attr: { title: "Full knowledge graph" }
    });
    fullBtn.addEventListener("click", () => {
      this.setActiveBtn(fullBtn);
      this.viewMode = "full";
      void this.loadFullGraph();
    });
    this.backBtn = toolbar.createEl("button", {
      text: "\u2190 back",
      cls: "mnemo-graph-btn",
      attr: { title: "Back to clusters" }
    });
    this.backBtn.hide();
    this.backBtn.addEventListener("click", () => {
      this.backBtn?.hide();
      void this.loadClusters();
    });
    this.allBtns = [lineageBtn, localBtn, clusterBtn, fullBtn];
    const refreshBtn = toolbar.createEl("button", {
      text: "\u21BB",
      cls: "mnemo-graph-btn",
      attr: { title: "Refresh" }
    });
    refreshBtn.addEventListener("click", () => {
      void this.refreshCurrentView();
    });
    const fitBtn = toolbar.createEl("button", {
      text: "\u22A1",
      cls: "mnemo-graph-btn",
      attr: { title: "Fit to view" }
    });
    fitBtn.addEventListener("click", () => this.fitToView());
    const meta = container.createDiv({ cls: "mnemo-graph-meta" });
    this.statusEl = meta.createDiv({ cls: "mnemo-graph-status" });
    this.legendEl = meta.createDiv({ cls: "mnemo-graph-legend" });
    this.renderLegend();
    this.canvas = container.createEl("canvas", { cls: "mnemo-graph-canvas" });
    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();
    this.registerDomEvent(window, "resize", () => this.resizeCanvas());
    this.setupInteraction();
    await this.loadLineage();
  }
  onClose() {
    this.simRunning = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
    }
    return Promise.resolve();
  }
  async loadGraph(path) {
    const activePath = this.getRequestedPath(path);
    if (!activePath) {
      this.setStatus("Open a note to inspect its graph neighborhood");
      this.drawEmpty("Open a note, then refresh");
      return;
    }
    this.centerPath = activePath;
    this.renderLegend();
    this.setStatus("Current note neighborhood \xB7 depth 1");
    const apiPath = this.normalizePath(activePath);
    const data = await this.apiClient.subgraph(apiPath, 1);
    if (!data || data.nodes.length === 0) {
      this.drawEmpty("No graph data for this note");
      return;
    }
    let nodes = data.nodes;
    let edges = data.edges;
    if (nodes.length > 80) {
      const keep = /* @__PURE__ */ new Set();
      const centerNode = nodes.find((n) => this.matchesPath(n.id, void 0, [activePath, apiPath]));
      if (centerNode) {
        keep.add(centerNode.id);
      }
      const sorted = [...nodes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      for (const n of sorted) {
        if (keep.size >= 80) {
          break;
        }
        keep.add(n.id);
      }
      nodes = nodes.filter((n) => keep.has(n.id));
      edges = edges.filter((e) => keep.has(e.source) && keep.has(e.target));
    }
    this.buildGraph(nodes, edges, [activePath, apiPath]);
    this.runSimulation();
    this.setStatus(`Current note neighborhood \xB7 ${this.nodes.length} nodes \xB7 ${this.edges.length} edges`);
  }
  async loadLineage(path) {
    const activePath = this.getRequestedPath(path);
    if (!activePath) {
      this.setStatus("Open a note to inspect its lineage");
      this.drawEmpty("Open a note, then refresh");
      return;
    }
    this.centerPath = activePath;
    this.renderLegend();
    this.setStatus("Current note lineage \xB7 depth 2 \xB7 both directions");
    this.drawEmpty("Loading lineage...");
    const apiPath = this.normalizePath(activePath);
    const result = await this.apiClient.lineage(apiPath, 2, "both");
    if (!result) {
      this.drawEmpty("Lineage view unavailable\nStart or update the Mnemo API server");
      return;
    }
    if (result.kind === "ambiguous") {
      await this.resolveAmbiguousLineage(result.detail);
      return;
    }
    const data = result.data;
    if (!data.nodes || data.nodes.length === 0) {
      this.drawEmpty("No lineage data for this note");
      return;
    }
    this.buildLineageGraph(data, [activePath, apiPath]);
    this.simRunning = false;
    this.fitToView();
    this.draw();
    this.setStatus(`Current note lineage \xB7 ${this.nodes.length} nodes \xB7 ${this.edges.length} edges`);
  }
  async resolveAmbiguousLineage(detail) {
    this.setStatus(`Lineage reference is ambiguous ? ${detail.candidates.length} candidates`);
    const picker = new LineageCandidateModal(this.app, detail);
    const selected = await picker.pick();
    if (!selected) {
      this.drawEmpty("Lineage selection canceled");
      return;
    }
    new import_obsidian4.Notice(`Loading lineage for ${selected.name}`);
    await this.loadLineage(selected.id);
  }
  setCenterPath(path) {
    this.centerPath = path;
    void this.refreshCurrentView(path);
  }
  async refreshCurrentView(path) {
    switch (this.viewMode) {
      case "full":
        await this.loadFullGraph();
        break;
      case "cluster":
        await this.loadClusters();
        break;
      case "lineage":
        await this.loadLineage(path);
        break;
      case "local":
      default:
        await this.loadGraph(path);
        break;
    }
  }
  setActiveBtn(active) {
    for (const btn of this.allBtns) {
      btn.removeClass("mnemo-graph-btn-active");
    }
    active.addClass("mnemo-graph-btn-active");
    if (this.backBtn) {
      this.backBtn.hide();
    }
    this.renderLegend();
  }
  async loadClusters() {
    this.renderLegend();
    this.setStatus("Cluster explorer");
    this.drawEmpty("Loading clusters...");
    const data = await this.apiClient.clusters();
    if (!data || !data.clusters || data.clusters.length === 0) {
      this.drawEmpty("No cluster data");
      return;
    }
    this.clusterData = data.clusters;
    const canvas = this.ensureCanvas();
    const w = canvas.width;
    const h = canvas.height;
    this.nodes = data.clusters.map((c) => ({
      id: c.id,
      name: `${c.hub_name} (${c.size})`,
      type: c.dominant_type,
      score: c.size,
      x: c.x / 1e3 * w * 0.9 + w * 0.05,
      y: c.y / 1e3 * h * 0.9 + h * 0.05,
      vx: 0,
      vy: 0,
      radius: Math.max(8, Math.min(40, 8 + Math.sqrt(c.size) * 2)),
      isCenter: false,
      _clusterIndex: c.index
    }));
    this.edges = (data.edges ?? []).map((e) => ({
      source: e.source,
      target: e.target,
      type: "cluster_link"
    }));
    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.resetViewport();
    this.simRunning = false;
    this.draw();
    this.setStatus(`Cluster explorer \xB7 ${this.clusterData.length} clusters`);
  }
  async drillIntoCluster(clusterIndex) {
    this.renderLegend();
    this.setStatus(`Cluster detail \xB7 #${clusterIndex}`);
    this.drawEmpty("Loading cluster detail...");
    const data = await this.apiClient.clusterDetail(clusterIndex);
    if (!data || data.nodes.length === 0) {
      this.drawEmpty("Empty cluster");
      return;
    }
    const canvas = this.ensureCanvas();
    const w = canvas.width;
    const h = canvas.height;
    this.nodes = data.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      score: n.degree,
      x: (n.x ?? 0) / 1e3 * w * 0.9 + w * 0.05,
      y: (n.y ?? 0) / 1e3 * h * 0.9 + h * 0.05,
      vx: 0,
      vy: 0,
      radius: Math.max(4, Math.min(16, 4 + (n.degree || 0) * 0.1)),
      isCenter: false
    }));
    this.edges = data.edges;
    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.resetViewport();
    this.simRunning = false;
    this.backBtn?.show();
    this.draw();
    this.setStatus(`Cluster detail \xB7 ${this.nodes.length} nodes \xB7 ${this.edges.length} edges`);
  }
  async loadFullGraph() {
    this.renderLegend();
    this.setStatus("Full knowledge graph");
    this.drawEmpty("Loading full graph...");
    const data = await this.apiClient.fullGraph();
    if (!data || data.nodes.length === 0) {
      this.drawEmpty("No graph data");
      return;
    }
    const canvas = this.ensureCanvas();
    const w = canvas.width;
    const h = canvas.height;
    this.nodes = data.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      score: n.degree,
      x: (n.x ?? 0) / 1e3 * w * 0.9 + w * 0.05,
      y: (n.y ?? 0) / 1e3 * h * 0.9 + h * 0.05,
      vx: 0,
      vy: 0,
      radius: Math.max(3, Math.min(16, 3 + (n.degree || 0) * 0.05)),
      isCenter: false
    }));
    this.edges = data.edges;
    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.resetViewport();
    this.simRunning = false;
    this.draw();
    this.setStatus(`Full knowledge graph \xB7 ${this.nodes.length} nodes \xB7 ${this.edges.length} edges`);
  }
  buildGraph(nodes, edges, centerCandidates) {
    const canvas = this.ensureCanvas();
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    this.nodes = nodes.map((n) => {
      const isCenter = this.matchesPath(n.id, void 0, centerCandidates);
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        score: n.score,
        x: isCenter ? cx : cx + (Math.random() - 0.5) * 300,
        y: isCenter ? cy : cy + (Math.random() - 0.5) * 300,
        vx: 0,
        vy: 0,
        radius: isCenter ? 18 : 12,
        isCenter
      };
    });
    this.edges = edges;
    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.resetViewport();
  }
  buildLineageGraph(data, centerCandidates) {
    const canvas = this.ensureCanvas();
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const normalizedCenter = this.normalizePath(data.center);
    const allCenterCandidates = [...centerCandidates, normalizedCenter];
    const upstream = data.nodes.filter((node) => this.normalizeLineageRole(node.lineage_role) === "upstream").sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
    const downstream = data.nodes.filter((node) => this.normalizeLineageRole(node.lineage_role) === "downstream").sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
    const bridge = data.nodes.filter((node) => this.normalizeLineageRole(node.lineage_role) === "bridge").sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
    const other = data.nodes.filter((node) => {
      const role = this.normalizeLineageRole(node.lineage_role);
      return role !== "center" && role !== "upstream" && role !== "downstream" && role !== "bridge";
    }).sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
    const positions = /* @__PURE__ */ new Map();
    const placeLine = (group, direction, verticalOffset = 0) => {
      const depthBuckets = /* @__PURE__ */ new Map();
      for (const node of group) {
        const bucket = depthBuckets.get(node.depth) ?? [];
        bucket.push(node);
        depthBuckets.set(node.depth, bucket);
      }
      for (const [depth, bucket] of depthBuckets.entries()) {
        const x = cx + direction * Math.max(180, depth * 220);
        const count = bucket.length;
        const span = Math.min(h * 0.7, Math.max(120, count * 84));
        const step = count > 1 ? span / (count - 1) : 0;
        const startY = cy + verticalOffset - span / 2;
        bucket.forEach((node, index) => {
          positions.set(node.id, {
            x,
            y: count === 1 ? cy + verticalOffset : startY + index * step
          });
        });
      }
    };
    placeLine(upstream, -1);
    placeLine(downstream, 1);
    placeLine(bridge, 0, 0);
    placeLine(other, 1, Math.min(120, h * 0.18));
    this.nodes = data.nodes.map((node) => {
      const role = this.normalizeLineageRole(node.lineage_role);
      const isCenter = role === "center" || this.matchesPath(node.id, node.path, allCenterCandidates);
      const pos = isCenter ? { x: cx, y: cy } : positions.get(node.id) ?? { x: cx, y: cy + 150 };
      return {
        id: node.id,
        name: node.name,
        path: node.path,
        type: node.entity_type ?? "note",
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        radius: isCenter ? 20 : Math.max(10, 15 - Math.min(node.depth, 4)),
        isCenter,
        lineageRole: isCenter ? "center" : role,
        lineageDepth: node.depth
      };
    });
    this.edges = data.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      weight: edge.weight
    }));
    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.resetViewport();
  }
  runSimulation() {
    this.simRunning = true;
    this.simIterations = 0;
    const tick = () => {
      if (!this.simRunning) {
        return;
      }
      this.simIterations++;
      this.simulateStep();
      this.draw();
      if (this.simIterations < 200) {
        this.animFrame = requestAnimationFrame(tick);
      } else {
        this.simRunning = false;
        this.draw();
      }
    };
    this.animFrame = requestAnimationFrame(tick);
  }
  simulateStep() {
    const alpha = Math.max(0.01, 1 - this.simIterations / 200);
    const nodes = this.nodes;
    const repulsion = 3e3;
    const springLen = 120;
    const springK = 0.02;
    const centerGravity = 0.01;
    const canvas = this.ensureCanvas();
    const w = canvas.width / 2;
    const h = canvas.height / 2;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = dx / dist * force * alpha;
        const fy = dy / dist * force * alpha;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }
    for (const e of this.edges) {
      const a = this.nodeMap.get(e.source);
      const b = this.nodeMap.get(e.target);
      if (!a || !b) {
        continue;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - springLen) * springK * alpha;
      const fx = dx / dist * force;
      const fy = dy / dist * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    for (const n of nodes) {
      n.vx += (w - n.x) * centerGravity * alpha;
      n.vy += (h - n.y) * centerGravity * alpha;
      n.vx *= 0.85;
      n.vy *= 0.85;
      if (!n.isCenter || this.simIterations > 5) {
        n.x += n.vx;
        n.y += n.vy;
      }
    }
  }
  draw() {
    const ctx = this.ensureContext();
    const canvas = this.ensureCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    for (const e of this.edges) {
      const a = this.nodeMap.get(e.source);
      const b = this.nodeMap.get(e.target);
      if (!a || !b) {
        continue;
      }
      const edgeStyle = this.getEdgeStyle(a, b, e);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = edgeStyle.color;
      ctx.lineWidth = edgeStyle.width;
      ctx.setLineDash(edgeStyle.dash);
      ctx.stroke();
      ctx.setLineDash([]);
      if (edgeStyle.arrow) {
        this.drawArrowHead(ctx, a, b, edgeStyle.color);
      }
    }
    for (const n of this.nodes) {
      const isHovered = this.hoveredNode === n;
      const typeColor = TYPE_COLORS[n.type] || DEFAULT_COLOR;
      const roleColor = this.viewMode === "lineage" ? LINEAGE_COLORS[n.lineageRole ?? "unknown"] : typeColor;
      if (this.viewMode === "lineage") {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + (n.isCenter ? 8 : 6), 0, Math.PI * 2);
        ctx.fillStyle = this.withAlpha(roleColor, n.isCenter ? 0.22 : 0.12);
        ctx.fill();
      } else if (n.isCenter) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 7, 0, Math.PI * 2);
        ctx.fillStyle = this.withAlpha(typeColor, 0.22);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + (isHovered ? 3 : 0), 0, Math.PI * 2);
      ctx.fillStyle = typeColor;
      ctx.fill();
      if (this.viewMode === "lineage") {
        ctx.save();
        if (n.lineageRole === "bridge") {
          ctx.setLineDash([4, 3]);
        }
        ctx.strokeStyle = roleColor;
        ctx.lineWidth = isHovered ? 3.6 : n.isCenter ? 3.2 : 2.4;
        ctx.stroke();
        ctx.restore();
        if (n.isCenter) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, Math.max(4, n.radius * 0.42), 0, Math.PI * 2);
          ctx.fillStyle = roleColor;
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = isHovered ? "#ffffff" : this.isDarkTheme() ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)";
        ctx.lineWidth = isHovered ? 2.5 : 1;
        ctx.stroke();
      }
      ctx.fillStyle = this.isDarkTheme() ? "#e0e0e0" : "#333333";
      ctx.font = n.isCenter ? "bold 11px sans-serif" : "10px sans-serif";
      ctx.textAlign = "center";
      if (isHovered || n.isCenter) {
        const label = n.name.length > 40 ? `${n.name.slice(0, 38)}\u2026` : n.name;
        ctx.fillText(label, n.x, n.y + n.radius + 14);
      } else if (this.scale > 0.75 && n.radius >= 5) {
        const short = n.name.length > 12 ? `${n.name.slice(0, 10)}\u2026` : n.name;
        ctx.fillText(short, n.x, n.y + n.radius + 14);
      }
    }
    ctx.restore();
    if (this.hoveredNode) {
      this.drawTooltip(this.hoveredNode);
    }
  }
  getEdgeStyle(a, b, edge) {
    if (this.viewMode === "lineage") {
      const role = this.pickLineageEdgeRole(a, b);
      return {
        color: this.withAlpha(LINEAGE_COLORS[role], this.isDarkTheme() ? 0.65 : 0.8),
        width: Math.max(1.5, Math.min(4, 1.2 + (edge.weight ?? 1) * 0.7)),
        dash: [],
        arrow: true
      };
    }
    if (edge.type === "related") {
      return {
        color: this.isDarkTheme() ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
        width: 1.5,
        dash: [6, 4],
        arrow: false
      };
    }
    if (edge.type === "tag_shared") {
      return {
        color: this.isDarkTheme() ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
        width: 1.2,
        dash: [3, 5],
        arrow: false
      };
    }
    return {
      color: this.isDarkTheme() ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
      width: 1.5,
      dash: [],
      arrow: false
    };
  }
  drawArrowHead(ctx, source, target, color) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-3) {
      return;
    }
    const ux = dx / dist;
    const uy = dy / dist;
    const tipX = target.x - ux * (target.radius + 2);
    const tipY = target.y - uy * (target.radius + 2);
    const size = 7;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - ux * size - uy * (size * 0.6), tipY - uy * size + ux * (size * 0.6));
    ctx.lineTo(tipX - ux * size + uy * (size * 0.6), tipY - uy * size - ux * (size * 0.6));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  drawTooltip(n) {
    const ctx = this.ensureContext();
    const sx = n.x * this.scale + this.offsetX;
    const sy = n.y * this.scale + this.offsetY - n.radius * this.scale - 10;
    const lines = [n.name, `Type: ${n.type}`];
    if (n.lineageRole) {
      lines.push(`Role: ${this.capitalize(n.lineageRole)}`);
    }
    if (n.lineageDepth != null) {
      lines.push(`Depth: ${n.lineageDepth}`);
    }
    if (n.score != null) {
      lines.push(`Score: ${n.score.toFixed(3)}`);
    }
    ctx.font = "11px sans-serif";
    const maxW = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 16;
    const h = lines.length * 16 + 10;
    const tx = sx - maxW / 2;
    const ty = sy - h;
    ctx.fillStyle = this.isDarkTheme() ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.95)";
    ctx.strokeStyle = this.isDarkTheme() ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, tx, ty, maxW, h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.isDarkTheme() ? "#e0e0e0" : "#333333";
    ctx.textAlign = "left";
    lines.forEach((line, index) => {
      ctx.fillText(line, tx + 8, ty + 16 + index * 16);
    });
  }
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  drawEmpty(msg) {
    const ctx = this.ensureContext();
    const canvas = this.ensureCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = this.isDarkTheme() ? "#999" : "#666";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    const lines = msg.split("\n");
    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, canvas.height / 2 + index * 20);
    });
  }
  setupInteraction() {
    const canvas = this.ensureCanvas();
    canvas.addEventListener("mousedown", (e) => {
      const node = this.hitTest(e.offsetX, e.offsetY);
      if (node) {
        this.dragNode = node;
      } else {
        this.isPanning = true;
        this.panStart = { x: e.offsetX, y: e.offsetY };
      }
      this.lastMouse = { x: e.offsetX, y: e.offsetY };
    });
    canvas.addEventListener("mousemove", (e) => {
      const dx = e.offsetX - this.lastMouse.x;
      const dy = e.offsetY - this.lastMouse.y;
      if (this.dragNode) {
        this.dragNode.x += dx / this.scale;
        this.dragNode.y += dy / this.scale;
        this.dragNode.vx = 0;
        this.dragNode.vy = 0;
        if (!this.simRunning) {
          this.draw();
        }
      } else if (this.isPanning) {
        this.offsetX += dx;
        this.offsetY += dy;
        if (!this.simRunning) {
          this.draw();
        }
      } else {
        const previous = this.hoveredNode;
        this.hoveredNode = this.hitTest(e.offsetX, e.offsetY);
        canvas.style.cursor = this.hoveredNode ? "pointer" : "default";
        if (previous !== this.hoveredNode && !this.simRunning) {
          this.draw();
        }
      }
      this.lastMouse = { x: e.offsetX, y: e.offsetY };
    });
    canvas.addEventListener("mouseup", (e) => {
      if (this.dragNode) {
        const dx = Math.abs(e.offsetX - this.lastMouse.x);
        const dy = Math.abs(e.offsetY - this.lastMouse.y);
        if (dx < 3 && dy < 3) {
          this.openNote(this.dragNode);
        }
      }
      this.dragNode = null;
      this.isPanning = false;
    });
    canvas.addEventListener("click", (e) => {
      const node = this.hitTest(e.offsetX, e.offsetY);
      if (!node) {
        return;
      }
      if (node._clusterIndex != null) {
        void this.drillIntoCluster(node._clusterIndex);
      } else {
        this.openNote(node);
      }
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const zoom = e.deltaY < 0 ? 1.1 : 0.9;
        const mx = e.offsetX;
        const my = e.offsetY;
        this.offsetX = mx - zoom * (mx - this.offsetX);
        this.offsetY = my - zoom * (my - this.offsetY);
        this.scale = Math.max(0.2, Math.min(5, this.scale * zoom));
        if (!this.simRunning) {
          this.draw();
        }
      },
      { passive: false }
    );
  }
  hitTest(mx, my) {
    const x = (mx - this.offsetX) / this.scale;
    const y = (my - this.offsetY) / this.scale;
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const dx = x - n.x;
      const dy = y - n.y;
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) {
        return n;
      }
    }
    return null;
  }
  openNote(node) {
    const file = this.resolveFileForNode(node);
    if (file) {
      void this.app.workspace.getLeaf(true).openFile(file);
    }
  }
  resolveFileForNode(node) {
    const candidates = [node.path, node.id, `${node.path ?? ""}.md`, `${node.id}.md`].filter((candidate) => Boolean(candidate)).map((candidate) => candidate.replace(/^\/+/, ""));
    for (const candidate of candidates) {
      const file = this.app.vault.getFileByPath(candidate);
      if (file) {
        return file;
      }
    }
    return null;
  }
  fitToView() {
    if (this.nodes.length === 0) {
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of this.nodes) {
      minX = Math.min(minX, n.x - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    }
    const pad = 50;
    const canvas = this.ensureCanvas();
    const w = canvas.width;
    const h = canvas.height;
    const gw = maxX - minX + pad * 2;
    const gh = maxY - minY + pad * 2;
    this.scale = Math.min(w / gw, h / gh, 1.8);
    this.offsetX = w / 2 - (minX + maxX) / 2 * this.scale;
    this.offsetY = h / 2 - (minY + maxY) / 2 * this.scale;
    this.draw();
  }
  resizeCanvas() {
    if (!this.canvas) {
      return;
    }
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    if (!this.simRunning) {
      this.draw();
    }
  }
  setStatus(text) {
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }
  renderLegend() {
    if (!this.legendEl) {
      return;
    }
    this.legendEl.empty();
    if (this.viewMode !== "lineage") {
      this.legendEl.hide();
      return;
    }
    this.legendEl.show();
    const items = [
      { key: "center", label: "Center" },
      { key: "upstream", label: "Upstream" },
      { key: "downstream", label: "Downstream" },
      { key: "bridge", label: "Bridge" }
    ];
    for (const item of items) {
      const chip = this.legendEl.createDiv({ cls: "mnemo-graph-legend-chip" });
      const dot = chip.createSpan({ cls: "mnemo-graph-legend-dot" });
      dot.style.backgroundColor = LINEAGE_COLORS[item.key];
      chip.createSpan({ text: item.label });
    }
    const note = this.legendEl.createSpan({ text: "Node core = entity type ? halo = lineage role", cls: "mnemo-graph-legend-note" });
    note.setAttr("title", "Entity color stays in the node core; lineage role is shown as halo/outline");
  }
  normalizeLineageRole(role) {
    const normalized = (role ?? "").toLowerCase();
    if (normalized === "center" || normalized === "upstream" || normalized === "downstream" || normalized === "bridge") {
      return normalized;
    }
    return "unknown";
  }
  pickLineageEdgeRole(a, b) {
    if (a.lineageRole === "bridge" || b.lineageRole === "bridge") {
      return "bridge";
    }
    if (a.lineageRole === "upstream" || b.lineageRole === "upstream") {
      return "upstream";
    }
    if (a.lineageRole === "downstream" || b.lineageRole === "downstream") {
      return "downstream";
    }
    if (a.lineageRole === "center" || b.lineageRole === "center") {
      return "center";
    }
    return "unknown";
  }
  normalizePath(path) {
    return path.replace(/\.md$/i, "").replace(/^\/+/, "");
  }
  matchesPath(id, path, candidates) {
    const normalizedCandidates = candidates.map((candidate) => this.normalizePath(candidate));
    return normalizedCandidates.includes(this.normalizePath(id)) || (path ? normalizedCandidates.includes(this.normalizePath(path)) : false);
  }
  getRequestedPath(path) {
    if (path) {
      return path;
    }
    if (this.centerPath) {
      return this.centerPath;
    }
    const file = this.app.workspace.getActiveFile();
    return file?.path ?? "";
  }
  resetViewport() {
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
  }
  withAlpha(hexColor, alpha) {
    const color = hexColor.replace("#", "");
    if (color.length !== 6) {
      return hexColor;
    }
    const r = Number.parseInt(color.slice(0, 2), 16);
    const g = Number.parseInt(color.slice(2, 4), 16);
    const b = Number.parseInt(color.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  capitalize(value) {
    return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
  }
  ensureCanvas() {
    if (!this.canvas) {
      throw new Error("Graph canvas is not ready");
    }
    return this.canvas;
  }
  ensureContext() {
    if (!this.ctx) {
      throw new Error("Graph canvas context is not ready");
    }
    return this.ctx;
  }
  isDarkTheme() {
    return document.body.classList.contains("theme-dark");
  }
};

// src/main.ts
var MnemoPlugin = class extends import_obsidian5.Plugin {
  settings = DEFAULT_SETTINGS;
  apiClient = new MnemoApiClient(DEFAULT_SETTINGS.apiUrl);
  async onload() {
    await this.loadSettings();
    this.apiClient.setBaseUrl(this.settings.apiUrl);
    this.addSettingTab(new MnemoSettingTab(this.app, this));
    this.addRibbonIcon("brain", "Mnemo search", () => {
      new MnemoSearchModal(this.app, this.apiClient, this.settings).open();
    });
    this.addCommand({
      id: "mnemo-search",
      name: "Mnemo: search",
      callback: () => {
        new MnemoSearchModal(this.app, this.apiClient, this.settings).open();
      }
    });
    this.registerView(
      MNEMO_GRAPH_VIEW_TYPE,
      (leaf) => new MnemoGraphView(leaf, this.apiClient)
    );
    this.addRibbonIcon("git-fork", "Mnemo graph", () => {
      void this.openGraphView();
    });
    this.addCommand({
      id: "mnemo-open-graph",
      name: "Mnemo: open graph view",
      callback: () => {
        void this.openGraphView();
      }
    });
    this.addCommand({
      id: "mnemo-check-status",
      name: "Mnemo: check server status",
      callback: async () => {
        const stats = await this.apiClient.stats();
        if (stats) {
          new import_obsidian5.Notice(`Mnemo: ${stats.total_notes} notes, ${stats.total_edges} edges`);
        } else {
          new import_obsidian5.Notice("Mnemo: \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 / server unreachable");
        }
      }
    });
    console.debug("Mnemo SecondBrain plugin loaded");
  }
  onunload() {
    console.debug("Mnemo SecondBrain plugin unloaded");
  }
  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async openGraphView() {
    const existing = this.app.workspace.getLeavesOfType(MNEMO_GRAPH_VIEW_TYPE);
    let leaf;
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: MNEMO_GRAPH_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    const file = this.app.workspace.getActiveFile();
    if (file) {
      const view = leaf.view;
      view.setCenterPath(file.path);
    }
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2FwaS1jbGllbnQudHMiLCAic3JjL3NldHRpbmdzLnRzIiwgInNyYy9zZWFyY2gtbW9kYWwudHMiLCAic3JjL2dyYXBoLXZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIlx1RkVGRmltcG9ydCB7IFBsdWdpbiwgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBNbmVtb0FwaUNsaWVudCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcbmltcG9ydCB7IE1uZW1vU2V0dGluZ3MsIE1uZW1vU2V0dGluZ1RhYiwgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBNbmVtb1NlYXJjaE1vZGFsIH0gZnJvbSBcIi4vc2VhcmNoLW1vZGFsXCI7XG5pbXBvcnQgeyBNbmVtb0dyYXBoVmlldywgTU5FTU9fR1JBUEhfVklFV19UWVBFIH0gZnJvbSBcIi4vZ3JhcGgtdmlld1wiO1xuXG4vLyBNbmVtbyBTZWNvbmRCcmFpbiBPYnNpZGlhbiBQbHVnaW5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1uZW1vUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IE1uZW1vU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuICBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50ID0gbmV3IE1uZW1vQXBpQ2xpZW50KERFRkFVTFRfU0VUVElOR1MuYXBpVXJsKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFwaUNsaWVudC5zZXRCYXNlVXJsKHRoaXMuc2V0dGluZ3MuYXBpVXJsKTtcblxuICAgIC8vIFx1QzEyNFx1QzgxNSBcdUQwRUQgXHVCNEYxXHVCODVEIC8gUmVnaXN0ZXIgc2V0dGluZ3MgdGFiXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNbmVtb1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIC8vIFx1QjlBQ1x1QkNGOCBcdUM1NDRcdUM3NzRcdUNGNTggLyBSaWJib24gaWNvblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcImJyYWluXCIsIFwiTW5lbW8gc2VhcmNoXCIsICgpID0+IHtcbiAgICAgIG5ldyBNbmVtb1NlYXJjaE1vZGFsKHRoaXMuYXBwLCB0aGlzLmFwaUNsaWVudCwgdGhpcy5zZXR0aW5ncykub3BlbigpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1Q0VFNFx1QjlFOFx1QjREQyAvIFNlYXJjaCBjb21tYW5kXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLXNlYXJjaFwiLFxuICAgICAgbmFtZTogXCJNbmVtbzogc2VhcmNoXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICBuZXcgTW5lbW9TZWFyY2hNb2RhbCh0aGlzLmFwcCwgdGhpcy5hcGlDbGllbnQsIHRoaXMuc2V0dGluZ3MpLm9wZW4oKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBcdUFERjhcdUI3OThcdUQ1MDQgXHVCREYwIFx1QjRGMVx1Qjg1RCAvIFJlZ2lzdGVyIGdyYXBoIHZpZXdcbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhcbiAgICAgIE1ORU1PX0dSQVBIX1ZJRVdfVFlQRSxcbiAgICAgIChsZWFmKSA9PiBuZXcgTW5lbW9HcmFwaFZpZXcobGVhZiwgdGhpcy5hcGlDbGllbnQpXG4gICAgKTtcblxuICAgIC8vIFx1QURGOFx1Qjc5OFx1RDUwNCBcdUJERjAgXHVCOUFDXHVCQ0Y4IFx1QzU0NFx1Qzc3NFx1Q0Y1OFxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcImdpdC1mb3JrXCIsIFwiTW5lbW8gZ3JhcGhcIiwgKCkgPT4ge1xuICAgICAgdm9pZCB0aGlzLm9wZW5HcmFwaFZpZXcoKTtcbiAgICB9KTtcblxuICAgIC8vIFx1QURGOFx1Qjc5OFx1RDUwNCBcdUJERjAgXHVDNUY0XHVBRTMwIFx1Q0VFNFx1QjlFOFx1QjREQ1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJtbmVtby1vcGVuLWdyYXBoXCIsXG4gICAgICBuYW1lOiBcIk1uZW1vOiBvcGVuIGdyYXBoIHZpZXdcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7IHZvaWQgdGhpcy5vcGVuR3JhcGhWaWV3KCk7IH0sXG4gICAgfSk7XG5cbiAgICAvLyBcdUMxMUNcdUJDODQgXHVDMEMxXHVEMERDIFx1RDY1NVx1Qzc3OCAvIENoZWNrIHNlcnZlciBvbiBsb2FkXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLWNoZWNrLXN0YXR1c1wiLFxuICAgICAgbmFtZTogXCJNbmVtbzogY2hlY2sgc2VydmVyIHN0YXR1c1wiLFxuICAgICAgY2FsbGJhY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLmFwaUNsaWVudC5zdGF0cygpO1xuICAgICAgICBpZiAoc3RhdHMpIHtcbiAgICAgICAgICBuZXcgTm90aWNlKGBNbmVtbzogJHtzdGF0cy50b3RhbF9ub3Rlc30gbm90ZXMsICR7c3RhdHMudG90YWxfZWRnZXN9IGVkZ2VzYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3IE5vdGljZShcIk1uZW1vOiBcdUMxMUNcdUJDODRcdUM1RDAgXHVDNUYwXHVBQ0IwXHVENTYwIFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQgLyBzZXJ2ZXIgdW5yZWFjaGFibGVcIik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmRlYnVnKFwiTW5lbW8gU2Vjb25kQnJhaW4gcGx1Z2luIGxvYWRlZFwiKTtcbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIGNvbnNvbGUuZGVidWcoXCJNbmVtbyBTZWNvbmRCcmFpbiBwbHVnaW4gdW5sb2FkZWRcIik7XG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgbG9hZGVkID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpIGFzIFBhcnRpYWw8TW5lbW9TZXR0aW5ncz47XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGxvYWRlZCk7XG4gIH1cblxuICBhc3luYyBzYXZlU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgb3BlbkdyYXBoVmlldygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoTU5FTU9fR1JBUEhfVklFV19UWVBFKTtcbiAgICBsZXQgbGVhZjogaW1wb3J0KFwib2JzaWRpYW5cIikuV29ya3NwYWNlTGVhZjtcbiAgICBpZiAoZXhpc3RpbmcubGVuZ3RoID4gMCkge1xuICAgICAgbGVhZiA9IGV4aXN0aW5nWzBdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSkhO1xuICAgICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBNTkVNT19HUkFQSF9WSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG5cbiAgICAvLyBcdUQ2MDRcdUM3QUMgXHVCMTc4XHVEMkI4IFx1QUUzMFx1QzkwMFx1QzczQ1x1Qjg1QyBcdUFERjhcdUI3OThcdUQ1MDQgXHVCODVDXHVCNERDXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgaWYgKGZpbGUpIHtcbiAgICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXcgYXMgTW5lbW9HcmFwaFZpZXc7XG4gICAgICB2aWV3LnNldENlbnRlclBhdGgoZmlsZS5wYXRoKTtcbiAgICB9XG4gIH1cbn1cbiIsICJcdUZFRkZpbXBvcnQgeyByZXF1ZXN0VXJsIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG4vLyBNbmVtbyBBUEkgXHVBQzgwXHVDMEM5IFx1QUNCMFx1QUNGQyBcdUQwQzBcdUM3ODUgLyBTZWFyY2ggcmVzdWx0IHR5cGVcclxuZXhwb3J0IGludGVyZmFjZSBNbmVtb1NlYXJjaFJlc3VsdCB7XHJcbiAgbmFtZTogc3RyaW5nO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgc25pcHBldDogc3RyaW5nO1xyXG4gIHNjb3JlOiBudW1iZXI7XHJcbiAgZW50aXR5X3R5cGU/OiBzdHJpbmc7XHJcbiAgc291cmNlPzogc3RyaW5nO1xyXG4gIHBhdGg/OiBzdHJpbmc7XHJcbn1cclxuXHJcbi8vIE1uZW1vIFx1QzExQ1x1QkM4NCBcdUQxQjVcdUFDQzQgLyBTZXJ2ZXIgc3RhdHNcclxuZXhwb3J0IGludGVyZmFjZSBNbmVtb1N0YXRzIHtcclxuICB0b3RhbF9ub3RlczogbnVtYmVyO1xyXG4gIHRvdGFsX2VkZ2VzOiBudW1iZXI7XHJcbiAgaW5kZXhfc3RhdHVzOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgU3ViZ3JhcGhOb2RlIHtcclxuICBpZDogc3RyaW5nO1xyXG4gIG5hbWU6IHN0cmluZztcclxuICB0eXBlOiBzdHJpbmc7XHJcbiAgc2NvcmU/OiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgU3ViZ3JhcGhFZGdlIHtcclxuICBzb3VyY2U6IHN0cmluZztcclxuICB0YXJnZXQ6IHN0cmluZztcclxuICB0eXBlOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCB0eXBlIExpbmVhZ2VEaXJlY3Rpb24gPSBcInVwc3RyZWFtXCIgfCBcImRvd25zdHJlYW1cIiB8IFwiYm90aFwiO1xyXG5leHBvcnQgdHlwZSBMaW5lYWdlUm9sZSA9IFwiY2VudGVyXCIgfCBcInVwc3RyZWFtXCIgfCBcImRvd25zdHJlYW1cIiB8IFwiYnJpZGdlXCIgfCBcInVua25vd25cIjtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTGluZWFnZU5vZGUge1xyXG4gIGlkOiBzdHJpbmc7XHJcbiAgbmFtZTogc3RyaW5nO1xyXG4gIHBhdGg/OiBzdHJpbmc7XHJcbiAgZW50aXR5X3R5cGU/OiBzdHJpbmc7XHJcbiAgZGVwdGg6IG51bWJlcjtcclxuICBsaW5lYWdlX3JvbGU/OiBMaW5lYWdlUm9sZTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBMaW5lYWdlRWRnZSB7XHJcbiAgc291cmNlOiBzdHJpbmc7XHJcbiAgdGFyZ2V0OiBzdHJpbmc7XHJcbiAgdHlwZTogc3RyaW5nO1xyXG4gIHdlaWdodD86IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBMaW5lYWdlQ2FuZGlkYXRlIHtcclxuICBpZDogc3RyaW5nO1xyXG4gIG5hbWU6IHN0cmluZztcclxuICBwYXRoOiBzdHJpbmc7XHJcbiAgZW50aXR5X3R5cGU6IHN0cmluZztcclxuICBtYXRjaF9raW5kOiBzdHJpbmc7XHJcbiAgc2NvcmU6IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBMaW5lYWdlQW1iaWd1b3VzRGV0YWlsIHtcclxuICBjb2RlOiBcImFtYmlndW91c19ub2RlXCI7XHJcbiAgcXVlcnk6IHN0cmluZztcclxuICBtZXNzYWdlOiBzdHJpbmc7XHJcbiAgY2FuZGlkYXRlczogTGluZWFnZUNhbmRpZGF0ZVtdO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIExpbmVhZ2VSZXNwb25zZSB7XHJcbiAgY2VudGVyOiBzdHJpbmc7XHJcbiAgZGlyZWN0aW9uOiBMaW5lYWdlRGlyZWN0aW9uO1xyXG4gIGRlcHRoOiBudW1iZXI7XHJcbiAgbm9kZXM6IExpbmVhZ2VOb2RlW107XHJcbiAgZWRnZXM6IExpbmVhZ2VFZGdlW107XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzTGluZWFnZUFtYmlndW91c0RldGFpbCh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIExpbmVhZ2VBbWJpZ3VvdXNEZXRhaWwge1xyXG4gIGlmICh0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgfHwgdmFsdWUgPT0gbnVsbCkge1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgaWYgKCEoXCJjb2RlXCIgaW4gdmFsdWUpIHx8IHZhbHVlLmNvZGUgIT09IFwiYW1iaWd1b3VzX25vZGVcIikge1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIFwicXVlcnlcIiBpbiB2YWx1ZVxyXG4gICAgJiYgdHlwZW9mIHZhbHVlLnF1ZXJ5ID09PSBcInN0cmluZ1wiXHJcbiAgICAmJiBcIm1lc3NhZ2VcIiBpbiB2YWx1ZVxyXG4gICAgJiYgdHlwZW9mIHZhbHVlLm1lc3NhZ2UgPT09IFwic3RyaW5nXCJcclxuICAgICYmIFwiY2FuZGlkYXRlc1wiIGluIHZhbHVlXHJcbiAgICAmJiBBcnJheS5pc0FycmF5KHZhbHVlLmNhbmRpZGF0ZXMpO1xyXG59XHJcblxyXG5leHBvcnQgdHlwZSBMaW5lYWdlTG9va3VwUmVzdWx0ID1cclxuICB8IHsga2luZDogXCJva1wiOyBkYXRhOiBMaW5lYWdlUmVzcG9uc2UgfVxyXG4gIHwgeyBraW5kOiBcImFtYmlndW91c1wiOyBkZXRhaWw6IExpbmVhZ2VBbWJpZ3VvdXNEZXRhaWwgfTtcclxuXHJcbi8vIEFQSSBcdUM3NTFcdUIyRjUgXHVCMEI0XHVCRDgwIFx1RDBDMFx1Qzc4NSAvIEludGVybmFsIEFQSSByZXNwb25zZSB0eXBlc1xyXG5pbnRlcmZhY2UgUmF3U2VhcmNoUmVzdWx0IHtcclxuICBuYW1lPzogc3RyaW5nO1xyXG4gIHRpdGxlPzogc3RyaW5nO1xyXG4gIGtleT86IHN0cmluZztcclxuICBzbmlwcGV0Pzogc3RyaW5nO1xyXG4gIHNjb3JlPzogbnVtYmVyO1xyXG4gIGVudGl0eV90eXBlPzogc3RyaW5nO1xyXG4gIHNvdXJjZT86IHN0cmluZztcclxuICBwYXRoPzogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgU2VhcmNoQXBpUmVzcG9uc2Uge1xyXG4gIHJlc3VsdHM/OiBSYXdTZWFyY2hSZXN1bHRbXTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDbHVzdGVySW5mbyB7XHJcbiAgaWQ6IHN0cmluZztcclxuICBodWJfbmFtZTogc3RyaW5nO1xyXG4gIHNpemU6IG51bWJlcjtcclxuICBkb21pbmFudF90eXBlOiBzdHJpbmc7XHJcbiAgeDogbnVtYmVyO1xyXG4gIHk6IG51bWJlcjtcclxuICBpbmRleDogbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIENsdXN0ZXJzUmVzcG9uc2Uge1xyXG4gIGNsdXN0ZXJzOiBDbHVzdGVySW5mb1tdO1xyXG4gIGVkZ2VzPzogQXJyYXk8eyBzb3VyY2U6IHN0cmluZzsgdGFyZ2V0OiBzdHJpbmcgfT47XHJcbn1cclxuXHJcbi8vIFx1QzBBQ1x1QzgwNCBcdUFDQzRcdUMwQjBcdUI0MUMgXHVCODA4XHVDNzc0XHVDNTQ0XHVDNkMzIFx1Qzg4Q1x1RDQ1Q1x1Qjk3QyBcdUQzRUNcdUQ1NjhcdUQ1NUMgXHVCMTc4XHVCNERDIFx1RDBDMFx1Qzc4NVxyXG5leHBvcnQgaW50ZXJmYWNlIFN1YmdyYXBoTm9kZVdpdGhMYXlvdXQgZXh0ZW5kcyBTdWJncmFwaE5vZGUge1xyXG4gIGRlZ3JlZT86IG51bWJlcjtcclxuICB4PzogbnVtYmVyO1xyXG4gIHk/OiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBNbmVtb0FwaUNsaWVudCB7XHJcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmcpIHt9XHJcblxyXG4gIHNldEJhc2VVcmwodXJsOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMuYmFzZVVybCA9IHVybC5yZXBsYWNlKC9cXC8rJC8sIFwiXCIpO1xyXG4gIH1cclxuXHJcbiAgLy8gXHVBQzgwXHVDMEM5IEFQSSBcdUQ2MzhcdUNEOUMgLyBDYWxsIHNlYXJjaCBBUElcclxuICBhc3luYyBzZWFyY2goXHJcbiAgICBxdWVyeTogc3RyaW5nLFxyXG4gICAgbW9kZTogc3RyaW5nID0gXCJoeWJyaWRcIixcclxuICAgIGxpbWl0OiBudW1iZXIgPSAxMFxyXG4gICk6IFByb21pc2U8TW5lbW9TZWFyY2hSZXN1bHRbXT4ge1xyXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7IHE6IHF1ZXJ5LCBtb2RlLCBsaW1pdDogU3RyaW5nKGxpbWl0KSB9KTtcclxuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0vc2VhcmNoPyR7cGFyYW1zfWA7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHsgdXJsLCBtZXRob2Q6IFwiR0VUXCIgfSk7XHJcbiAgICAgIGNvbnN0IGRhdGEgPSByZXNwb25zZS5qc29uIGFzIFNlYXJjaEFwaVJlc3BvbnNlIHwgUmF3U2VhcmNoUmVzdWx0W107XHJcbiAgICAgIGNvbnN0IHJhd1Jlc3VsdHM6IFJhd1NlYXJjaFJlc3VsdFtdID0gQXJyYXkuaXNBcnJheShkYXRhKVxyXG4gICAgICAgID8gZGF0YVxyXG4gICAgICAgIDogKGRhdGEucmVzdWx0cyA/PyBbXSk7XHJcbiAgICAgIHJldHVybiByYXdSZXN1bHRzLm1hcCgocjogUmF3U2VhcmNoUmVzdWx0KTogTW5lbW9TZWFyY2hSZXN1bHQgPT4gKHtcclxuICAgICAgICBuYW1lOiByLm5hbWUgPz8gXCJcIixcclxuICAgICAgICB0aXRsZTogci50aXRsZSB8fCByLm5hbWUgfHwgci5rZXkgfHwgXCJVbnRpdGxlZFwiLFxyXG4gICAgICAgIHNuaXBwZXQ6IHIuc25pcHBldCA/PyBcIlwiLFxyXG4gICAgICAgIHNjb3JlOiByLnNjb3JlID8/IDAsXHJcbiAgICAgICAgZW50aXR5X3R5cGU6IHIuZW50aXR5X3R5cGUsXHJcbiAgICAgICAgc291cmNlOiByLnNvdXJjZSxcclxuICAgICAgICBwYXRoOiByLnBhdGgsXHJcbiAgICAgIH0pKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICB0aGlzLmhhbmRsZUVycm9yKGVycik7XHJcbiAgICAgIHJldHVybiBbXTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFx1QzExQ1x1QkM4NCBcdUMwQzFcdUQwREMgXHVENjU1XHVDNzc4IC8gQ2hlY2sgc2VydmVyIHN0YXRzXHJcbiAgYXN5bmMgc3RhdHMoKTogUHJvbWlzZTxNbmVtb1N0YXRzIHwgbnVsbD4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcclxuICAgICAgICB1cmw6IGAke3RoaXMuYmFzZVVybH0vc3RhdHNgLFxyXG4gICAgICAgIG1ldGhvZDogXCJHRVRcIixcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiByZXNwb25zZS5qc29uIGFzIE1uZW1vU3RhdHM7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFx1QzExQ1x1QkUwQ1x1QURGOFx1Qjc5OFx1RDUwNCBcdUM4NzBcdUQ2OEMgLyBHZXQgc3ViZ3JhcGggZm9yIHZpc3VhbGl6YXRpb25cclxuICBhc3luYyBzdWJncmFwaChcclxuICAgIGNlbnRlcjogc3RyaW5nLFxyXG4gICAgZGVwdGg6IG51bWJlciA9IDJcclxuICApOiBQcm9taXNlPHsgbm9kZXM6IFN1YmdyYXBoTm9kZVtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW10gfSB8IG51bGw+IHtcclxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoeyBjZW50ZXIsIGRlcHRoOiBTdHJpbmcoZGVwdGgpIH0pO1xyXG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5iYXNlVXJsfS9ncmFwaC9zdWJncmFwaD8ke3BhcmFtc31gO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHsgdXJsLCBtZXRob2Q6IFwiR0VUXCIgfSk7XHJcbiAgICAgIHJldHVybiByZXNwb25zZS5qc29uIGFzIHsgbm9kZXM6IFN1YmdyYXBoTm9kZVtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW10gfTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICB0aGlzLmhhbmRsZUVycm9yKGVycik7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gXHVBQ0M0XHVCQ0Y0IFx1QURGOFx1Qjc5OFx1RDUwNCBcdUM4NzBcdUQ2OEMgLyBHZXQgbGluZWFnZSBncmFwaCBhcm91bmQgYSBub3RlXHJcbiAgYXN5bmMgbGluZWFnZShcclxuICAgIG5vZGU6IHN0cmluZyxcclxuICAgIGRlcHRoOiBudW1iZXIgPSAyLFxyXG4gICAgZGlyZWN0aW9uOiBMaW5lYWdlRGlyZWN0aW9uID0gXCJib3RoXCJcclxuICApOiBQcm9taXNlPExpbmVhZ2VMb29rdXBSZXN1bHQgfCBudWxsPiB7XHJcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcclxuICAgICAgbm9kZSxcclxuICAgICAgZGVwdGg6IFN0cmluZyhkZXB0aCksXHJcbiAgICAgIGRpcmVjdGlvbixcclxuICAgIH0pO1xyXG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5iYXNlVXJsfS9ncmFwaC9saW5lYWdlPyR7cGFyYW1zfWA7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmwsIG1ldGhvZDogXCJHRVRcIiB9KTtcclxuICAgICAgY29uc3QgcGF5bG9hZCA9IHJlc3BvbnNlLmpzb24gYXMgTGluZWFnZVJlc3BvbnNlIHwgeyBkZXRhaWw/OiBMaW5lYWdlQW1iaWd1b3VzRGV0YWlsIH0gfCBMaW5lYWdlQW1iaWd1b3VzRGV0YWlsO1xyXG4gICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDkpIHtcclxuICAgICAgICBjb25zdCBkZXRhaWwgPSB0aGlzLmV4dHJhY3RBbWJpZ3VvdXNEZXRhaWwocGF5bG9hZCk7XHJcbiAgICAgICAgaWYgKGRldGFpbCkge1xyXG4gICAgICAgICAgcmV0dXJuIHsga2luZDogXCJhbWJpZ3VvdXNcIiwgZGV0YWlsIH07XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwib2tcIiwgZGF0YTogcGF5bG9hZCBhcyBMaW5lYWdlUmVzcG9uc2UgfTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBjb25zdCBkZXRhaWwgPSB0aGlzLnRyeUV4dHJhY3RBbWJpZ3VvdXNEZXRhaWwoZXJyKTtcclxuICAgICAgaWYgKGRldGFpbCkge1xyXG4gICAgICAgIHJldHVybiB7IGtpbmQ6IFwiYW1iaWd1b3VzXCIsIGRldGFpbCB9O1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZXJyKTtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBcdUQwNzRcdUI3RUNcdUMyQTRcdUQxMzAgXHVBREY4XHVCNzk4XHVENTA0IChcdUFDQzRcdUNFMzVcdUM4MDEgXHVEMEQwXHVDMEM5KSAvIENsdXN0ZXIgZ3JhcGggZm9yIGRyaWxsLWRvd25cclxuICBhc3luYyBjbHVzdGVycygpOiBQcm9taXNlPENsdXN0ZXJzUmVzcG9uc2UgfCBudWxsPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmw6IGAke3RoaXMuYmFzZVVybH0vZ3JhcGgvY2x1c3RlcnNgLCBtZXRob2Q6IFwiR0VUXCIgfSk7XHJcbiAgICAgIHJldHVybiByZXNwb25zZS5qc29uIGFzIENsdXN0ZXJzUmVzcG9uc2U7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFx1RDA3NFx1QjdFQ1x1QzJBNFx1RDEzMCBcdUMwQzFcdUMxMzggKGRyaWxsLWRvd24pIC8gQ2x1c3RlciBkZXRhaWxcclxuICBhc3luYyBjbHVzdGVyRGV0YWlsKGluZGV4OiBudW1iZXIpOiBQcm9taXNlPHsgbm9kZXM6IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXRbXTsgZWRnZXM6IFN1YmdyYXBoRWRnZVtdIH0gfCBudWxsPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmw6IGAke3RoaXMuYmFzZVVybH0vZ3JhcGgvY2x1c3Rlci8ke2luZGV4fWAsIG1ldGhvZDogXCJHRVRcIiB9KTtcclxuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlV2l0aExheW91dFtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW10gfTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICB0aGlzLmhhbmRsZUVycm9yKGVycik7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gXHVDODA0XHVDQ0I0IFx1QURGOFx1Qjc5OFx1RDUwNCAoXHVDMEFDXHVDODA0IFx1QUNDNFx1QzBCMCBcdUI4MDhcdUM3NzRcdUM1NDRcdUM2QzMpIC8gRnVsbCBncmFwaCB3aXRoIHByZWNvbXB1dGVkIGxheW91dFxyXG4gIGFzeW5jIGZ1bGxHcmFwaCgpOiBQcm9taXNlPHsgbm9kZXM6IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXRbXTsgZWRnZXM6IFN1YmdyYXBoRWRnZVtdOyBsYXlvdXQ6IHN0cmluZyB9IHwgbnVsbD4ge1xyXG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5iYXNlVXJsfS9ncmFwaC9mdWxsYDtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xyXG4gICAgICByZXR1cm4gcmVzcG9uc2UuanNvbiBhcyB7IG5vZGVzOiBTdWJncmFwaE5vZGVXaXRoTGF5b3V0W107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXTsgbGF5b3V0OiBzdHJpbmcgfTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICB0aGlzLmhhbmRsZUVycm9yKGVycik7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gXHVDNUQwXHVCN0VDIFx1Q0M5OFx1QjlBQyAvIEVycm9yIGhhbmRsaW5nIHdpdGggZnJpZW5kbHkgbWVzc2FnZXNcclxuICBwcml2YXRlIGV4dHJhY3RBbWJpZ3VvdXNEZXRhaWwoXHJcbiAgICBwYXlsb2FkOiBMaW5lYWdlUmVzcG9uc2UgfCB7IGRldGFpbD86IExpbmVhZ2VBbWJpZ3VvdXNEZXRhaWwgfSB8IExpbmVhZ2VBbWJpZ3VvdXNEZXRhaWxcclxuICApOiBMaW5lYWdlQW1iaWd1b3VzRGV0YWlsIHwgbnVsbCB7XHJcbiAgICBpZiAodHlwZW9mIHBheWxvYWQgIT09IFwib2JqZWN0XCIgfHwgcGF5bG9hZCA9PSBudWxsKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gICAgY29uc3QgbWF5YmVXcmFwcGVkID0gXCJkZXRhaWxcIiBpbiBwYXlsb2FkICYmIHBheWxvYWQuZGV0YWlsID8gcGF5bG9hZC5kZXRhaWwgOiBwYXlsb2FkO1xyXG4gICAgaWYgKGlzTGluZWFnZUFtYmlndW91c0RldGFpbChtYXliZVdyYXBwZWQpKSB7XHJcbiAgICAgIHJldHVybiBtYXliZVdyYXBwZWQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdHJ5RXh0cmFjdEFtYmlndW91c0RldGFpbChlcnI6IHVua25vd24pOiBMaW5lYWdlQW1iaWd1b3VzRGV0YWlsIHwgbnVsbCB7XHJcbiAgICBpZiAodHlwZW9mIGVyciAhPT0gXCJvYmplY3RcIiB8fCBlcnIgPT0gbnVsbCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB3aXRoVGV4dCA9IGVyciBhcyB7IHRleHQ/OiBzdHJpbmc7IHN0YXR1cz86IG51bWJlcjsgcmVzcG9uc2U/OiB7IHRleHQ/OiBzdHJpbmc7IHN0YXR1cz86IG51bWJlciB9IH07XHJcbiAgICBjb25zdCB0ZXh0ID0gd2l0aFRleHQudGV4dCA/PyB3aXRoVGV4dC5yZXNwb25zZT8udGV4dDtcclxuICAgIGNvbnN0IHN0YXR1cyA9IHdpdGhUZXh0LnN0YXR1cyA/PyB3aXRoVGV4dC5yZXNwb25zZT8uc3RhdHVzO1xyXG4gICAgaWYgKHN0YXR1cyAhPT0gNDA5IHx8ICF0ZXh0KSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKHRleHQpIGFzIExpbmVhZ2VSZXNwb25zZSB8IHsgZGV0YWlsPzogTGluZWFnZUFtYmlndW91c0RldGFpbCB9IHwgTGluZWFnZUFtYmlndW91c0RldGFpbDtcclxuICAgICAgcmV0dXJuIHRoaXMuZXh0cmFjdEFtYmlndW91c0RldGFpbChwYXlsb2FkKTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlRXJyb3IoZXJyOiB1bmtub3duKTogdm9pZCB7XHJcbiAgICBjb25zdCBtc2cgPSBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycik7XHJcbiAgICBpZiAobXNnLmluY2x1ZGVzKFwiRUNPTk5SRUZVU0VEXCIpIHx8IG1zZy5pbmNsdWRlcyhcIm5ldDo6RVJSXCIpKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoXHJcbiAgICAgICAgYFtNbmVtb10gXHVDMTFDXHVCQzg0XHVDNUQwIFx1QzVGMFx1QUNCMFx1RDU2MCBcdUMyMTggXHVDNUM2XHVDMkI1XHVCMkM4XHVCMkU0LiBNbmVtbyBcdUMxMUNcdUJDODRcdUFDMDAgXHVDMkU0XHVENTg5IFx1QzkxMVx1Qzc3OFx1QzlDMCBcdUQ2NTVcdUM3NzhcdUQ1NThcdUMxMzhcdUM2OTQuXFxuYCArXHJcbiAgICAgICAgICBgQ2Fubm90IGNvbm5lY3QgdG8gTW5lbW8gc2VydmVyIGF0ICR7dGhpcy5iYXNlVXJsfS4gSXMgaXQgcnVubmluZz9gXHJcbiAgICAgICk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGBbTW5lbW9dIEFQSSBlcnJvcjogJHttc2d9YCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiIsICJcdUZFRkZpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIE1uZW1vUGx1Z2luIGZyb20gXCIuL21haW5cIjtcblxuLy8gXHVENTBDXHVCN0VDXHVBREY4XHVDNzc4IFx1QzEyNFx1QzgxNSBcdUM3NzhcdUQxMzBcdUQzOThcdUM3NzRcdUMyQTQgLyBQbHVnaW4gc2V0dGluZ3MgaW50ZXJmYWNlXG5leHBvcnQgaW50ZXJmYWNlIE1uZW1vU2V0dGluZ3Mge1xuICBhcGlVcmw6IHN0cmluZztcbiAgc2VhcmNoTGltaXQ6IG51bWJlcjtcbiAgc2VhcmNoTW9kZTogXCJoeWJyaWRcIiB8IFwidmVjdG9yXCIgfCBcImtleXdvcmRcIiB8IFwiZ3JhcGhcIjtcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IE1uZW1vU2V0dGluZ3MgPSB7XG4gIGFwaVVybDogXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIixcbiAgc2VhcmNoTGltaXQ6IDEwLFxuICBzZWFyY2hNb2RlOiBcImh5YnJpZFwiLFxufTtcblxuLy8gXHVDMTI0XHVDODE1IFx1RDBFRCAvIFNldHRpbmdzIHRhYlxuZXhwb3J0IGNsYXNzIE1uZW1vU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IE1uZW1vUGx1Z2luO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE1uZW1vUGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICAvLyBBUEkgVVJMIFx1QzEyNFx1QzgxNVxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJNbmVtbyBBUEkgVVJMXCIpXG4gICAgICAuc2V0RGVzYyhcIk1uZW1vIEZhc3RBUEkgc2VydmVyIGFkZHJlc3MgKGRlZmF1bHQ6IGh0dHA6Ly8xMjcuMC4wLjE6ODAwMClcIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiaHR0cDovLzEyNy4wLjAuMTo4MDAwXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaVVybClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlVcmwgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmFwaUNsaWVudC5zZXRCYXNlVXJsKHZhbHVlKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1QUNCMFx1QUNGQyBcdUMyMThcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiU2VhcmNoIHJlc3VsdCBsaW1pdFwiKVxuICAgICAgLnNldERlc2MoXCJNYXhpbXVtIG51bWJlciBvZiBzZWFyY2ggcmVzdWx0cyB0byBzaG93XCIpXG4gICAgICAuYWRkU2xpZGVyKChzbGlkZXIpID0+XG4gICAgICAgIHNsaWRlclxuICAgICAgICAgIC5zZXRMaW1pdHMoNSwgNTAsIDUpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNlYXJjaExpbWl0KVxuICAgICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTGltaXQgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1QkFBOFx1QjREQ1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJTZWFyY2ggbW9kZVwiKVxuICAgICAgLnNldERlc2MoXCJTZWxlY3QgdGhlIHNlYXJjaCBtZXRob2QgdG8gdXNlXCIpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxuICAgICAgICBkcm9wZG93blxuICAgICAgICAgIC5hZGRPcHRpb25zKHtcbiAgICAgICAgICAgIGh5YnJpZDogXCJIeWJyaWQgKGtleXdvcmQgKyB2ZWN0b3IpXCIsXG4gICAgICAgICAgICB2ZWN0b3I6IFwiVmVjdG9yIChzZW1hbnRpYylcIixcbiAgICAgICAgICAgIGtleXdvcmQ6IFwiS2V5d29yZCAoQk0yNSlcIixcbiAgICAgICAgICAgIGdyYXBoOiBcIkdyYXBoIChyZWxhdGlvbnNoaXApXCIsXG4gICAgICAgICAgfSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTW9kZSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zZWFyY2hNb2RlID0gdmFsdWUgYXMgTW5lbW9TZXR0aW5nc1tcInNlYXJjaE1vZGVcIl07XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxufVxuIiwgIlx1RkVGRmltcG9ydCB7IEFwcCwgU3VnZ2VzdE1vZGFsLCBOb3RpY2UsIFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSB7IE1uZW1vQXBpQ2xpZW50LCBNbmVtb1NlYXJjaFJlc3VsdCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcbmltcG9ydCB0eXBlIHsgTW5lbW9TZXR0aW5ncyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5cbi8vIE1uZW1vIFx1QUM4MFx1QzBDOSBcdUJBQThcdUIyRUMgLyBTZWFyY2ggbW9kYWxcbmV4cG9ydCBjbGFzcyBNbmVtb1NlYXJjaE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPE1uZW1vU2VhcmNoUmVzdWx0PiB7XG4gIHByaXZhdGUgcmVzdWx0czogTW5lbW9TZWFyY2hSZXN1bHRbXSA9IFtdO1xuICBwcml2YXRlIGRlYm91bmNlVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50LFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IE1uZW1vU2V0dGluZ3NcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiTW5lbW8gc2VhcmNoLi4uXCIpO1xuICB9XG5cbiAgYXN5bmMgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFByb21pc2U8TW5lbW9TZWFyY2hSZXN1bHRbXT4ge1xuICAgIGlmICghcXVlcnkgfHwgcXVlcnkubGVuZ3RoIDwgMikgcmV0dXJuIFtdO1xuXG4gICAgLy8gXHVCNTE0XHVCQzE0XHVDNkI0XHVDMkE0IDMwMG1zIC8gRGVib3VuY2UgaW5wdXRcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIpIGNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHZvaWQgdGhpcy5hcGlDbGllbnQuc2VhcmNoKHF1ZXJ5LCB0aGlzLnNldHRpbmdzLnNlYXJjaE1vZGUsIHRoaXMuc2V0dGluZ3Muc2VhcmNoTGltaXQpXG4gICAgICAgICAgLnRoZW4oKHJlc3VsdHMpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHM7XG4gICAgICAgICAgICByZXNvbHZlKHRoaXMucmVzdWx0cyk7XG4gICAgICAgICAgfSk7XG4gICAgICB9LCAzMDApO1xuICAgIH0pO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihyZXN1bHQ6IE1uZW1vU2VhcmNoUmVzdWx0LCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb25zdCBjb250YWluZXIgPSBlbC5jcmVhdGVEaXYoeyBjbHM6IFwibW5lbW8tc2VhcmNoLXJlc3VsdFwiIH0pO1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7XG4gICAgICB0ZXh0OiByZXN1bHQudGl0bGUsXG4gICAgICBjbHM6IFwibW5lbW8tcmVzdWx0LXRpdGxlXCIsXG4gICAgfSk7XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwic21hbGxcIiwge1xuICAgICAgdGV4dDogcmVzdWx0LnNuaXBwZXQsXG4gICAgICBjbHM6IFwibW5lbW8tcmVzdWx0LXNuaXBwZXRcIixcbiAgICB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJzcGFuXCIsIHtcbiAgICAgIHRleHQ6IGBzY29yZTogJHtyZXN1bHQuc2NvcmUudG9GaXhlZCgzKX1gLFxuICAgICAgY2xzOiBcIm1uZW1vLXJlc3VsdC1zY29yZVwiLFxuICAgIH0pO1xuICB9XG5cbiAgb25DaG9vc2VTdWdnZXN0aW9uKHJlc3VsdDogTW5lbW9TZWFyY2hSZXN1bHQpOiB2b2lkIHtcbiAgICAvLyBcdUJDRkNcdUQyQjhcdUM1RDBcdUMxMUMgXHVENTc0XHVCMkY5IFx1QjE3OFx1RDJCOCBcdUM1RjRcdUFFMzAgLyBPcGVuIG1hdGNoaW5nIG5vdGUgaW4gdmF1bHRcbiAgICBsZXQgcGF0aCA9IHJlc3VsdC5wYXRoIHx8IGAke3Jlc3VsdC50aXRsZX0ubWRgO1xuICAgIGlmICghcGF0aC5lbmRzV2l0aChcIi5tZFwiKSkgcGF0aCArPSBcIi5tZFwiO1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG5cbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUoZmlsZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ldyBOb3RpY2UoYFx1QjE3OFx1RDJCOFx1Qjk3QyBcdUNDM0VcdUM3NDQgXHVDMjE4IFx1QzVDNlx1QzJCNVx1QjJDOFx1QjJFNDogJHtyZXN1bHQudGl0bGV9XFxuTm90ZSBub3QgZm91bmQgaW4gdmF1bHQuYCk7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgSXRlbVZpZXcsIE5vdGljZSwgU3VnZ2VzdE1vZGFsLCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB0eXBlIHtcclxuICBDbHVzdGVySW5mbyxcclxuICBMaW5lYWdlQW1iaWd1b3VzRGV0YWlsLFxyXG4gIExpbmVhZ2VDYW5kaWRhdGUsXHJcbiAgTGluZWFnZVJlc3BvbnNlLFxyXG4gIE1uZW1vQXBpQ2xpZW50LFxyXG4gIFN1YmdyYXBoRWRnZSxcclxuICBTdWJncmFwaE5vZGUsXHJcbiAgU3ViZ3JhcGhOb2RlV2l0aExheW91dCxcclxufSBmcm9tIFwiLi9hcGktY2xpZW50XCI7XHJcblxyXG5leHBvcnQgY29uc3QgTU5FTU9fR1JBUEhfVklFV19UWVBFID0gXCJtbmVtby1ncmFwaC12aWV3XCI7XHJcblxyXG5jb25zdCBUWVBFX0NPTE9SUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcclxuICBldmVudDogXCIjNEE5MEQ5XCIsXHJcbiAgcHJvamVjdDogXCIjRTg5MTNBXCIsXHJcbiAgbm90ZTogXCIjNTBDODc4XCIsXHJcbiAgc291cmNlOiBcIiM5QjU5QjZcIixcclxuICBkZWNpc2lvbjogXCIjRTc0QzNDXCIsXHJcbiAgaW5zaWdodDogXCIjRjFDNDBGXCIsXHJcbiAgdG9vbDogXCIjMTZBMDg1XCIsXHJcbiAgY29uY2VwdDogXCIjNUM3Q0ZBXCIsXHJcbiAgcGVyc29uOiBcIiNFQzQ4OTlcIixcclxuICB1bmtub3duOiBcIiM4ODg4ODhcIixcclxufTtcclxuY29uc3QgREVGQVVMVF9DT0xPUiA9IFwiIzg4ODg4OFwiO1xyXG5cclxuY29uc3QgTElORUFHRV9DT0xPUlMgPSB7XHJcbiAgY2VudGVyOiBcIiNCMzg4RkZcIixcclxuICB1cHN0cmVhbTogXCIjRjVCMzQyXCIsXHJcbiAgZG93bnN0cmVhbTogXCIjNEREMEUxXCIsXHJcbiAgYnJpZGdlOiBcIiM3QzNBRURcIixcclxuICB1bmtub3duOiBcIiM4QThGOThcIixcclxufSBhcyBjb25zdDtcclxuXHJcbnR5cGUgR3JhcGhWaWV3TW9kZSA9IFwibGluZWFnZVwiIHwgXCJsb2NhbFwiIHwgXCJmdWxsXCIgfCBcImNsdXN0ZXJcIjtcclxudHlwZSBMaW5lYWdlUm9sZSA9IGtleW9mIHR5cGVvZiBMSU5FQUdFX0NPTE9SUztcclxuXHJcbmludGVyZmFjZSBHcmFwaE5vZGUge1xyXG4gIGlkOiBzdHJpbmc7XHJcbiAgbmFtZTogc3RyaW5nO1xyXG4gIHR5cGU6IHN0cmluZztcclxuICBzY29yZT86IG51bWJlcjtcclxuICBwYXRoPzogc3RyaW5nO1xyXG4gIHg6IG51bWJlcjtcclxuICB5OiBudW1iZXI7XHJcbiAgdng6IG51bWJlcjtcclxuICB2eTogbnVtYmVyO1xyXG4gIHJhZGl1czogbnVtYmVyO1xyXG4gIGlzQ2VudGVyOiBib29sZWFuO1xyXG4gIGxpbmVhZ2VSb2xlPzogTGluZWFnZVJvbGU7XHJcbiAgbGluZWFnZURlcHRoPzogbnVtYmVyO1xyXG4gIF9jbHVzdGVySW5kZXg/OiBudW1iZXI7XHJcbn1cclxuXHJcbmludGVyZmFjZSBHcmFwaEVkZ2Uge1xyXG4gIHNvdXJjZTogc3RyaW5nO1xyXG4gIHRhcmdldDogc3RyaW5nO1xyXG4gIHR5cGU6IHN0cmluZztcclxuICB3ZWlnaHQ/OiBudW1iZXI7XHJcbn1cclxuXHJcbmNsYXNzIExpbmVhZ2VDYW5kaWRhdGVNb2RhbCBleHRlbmRzIFN1Z2dlc3RNb2RhbDxMaW5lYWdlQ2FuZGlkYXRlPiB7XHJcbiAgcHJpdmF0ZSByZXNvbHZlcjogKChjYW5kaWRhdGU6IExpbmVhZ2VDYW5kaWRhdGUgfCBudWxsKSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgc2V0dGxlZCA9IGZhbHNlO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIGFwcDogSXRlbVZpZXdbXCJhcHBcIl0sXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IGRldGFpbDogTGluZWFnZUFtYmlndW91c0RldGFpbFxyXG4gICkge1xyXG4gICAgc3VwZXIoYXBwKTtcclxuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoYENob29zZSBsaW5lYWdlIHRhcmdldCBmb3IgXCIke2RldGFpbC5xdWVyeX1cImApO1xyXG4gICAgdGhpcy5zZXRJbnN0cnVjdGlvbnMoW1xyXG4gICAgICB7IGNvbW1hbmQ6IFwiPz9cIiwgcHVycG9zZTogXCJtb3ZlXCIgfSxcclxuICAgICAgeyBjb21tYW5kOiBcIj9cIiwgcHVycG9zZTogXCJzZWxlY3RcIiB9LFxyXG4gICAgICB7IGNvbW1hbmQ6IFwiZXNjXCIsIHB1cnBvc2U6IFwiY2FuY2VsXCIgfSxcclxuICAgIF0pO1xyXG4gIH1cclxuXHJcbiAgcGljaygpOiBQcm9taXNlPExpbmVhZ2VDYW5kaWRhdGUgfCBudWxsPiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgdGhpcy5yZXNvbHZlciA9IHJlc29sdmU7XHJcbiAgICAgIHRoaXMub3BlbigpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBnZXRTdWdnZXN0aW9ucyhxdWVyeTogc3RyaW5nKTogTGluZWFnZUNhbmRpZGF0ZVtdIHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBxdWVyeS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuICAgIGlmICghbm9ybWFsaXplZCkge1xyXG4gICAgICByZXR1cm4gdGhpcy5kZXRhaWwuY2FuZGlkYXRlcztcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLmRldGFpbC5jYW5kaWRhdGVzLmZpbHRlcigoY2FuZGlkYXRlKSA9PiB7XHJcbiAgICAgIGNvbnN0IGhheXN0YWNrcyA9IFtjYW5kaWRhdGUubmFtZSwgY2FuZGlkYXRlLnBhdGgsIGNhbmRpZGF0ZS5lbnRpdHlfdHlwZSwgY2FuZGlkYXRlLm1hdGNoX2tpbmRdXHJcbiAgICAgICAgLm1hcCgodmFsdWUpID0+IHZhbHVlLnRvTG93ZXJDYXNlKCkpO1xyXG4gICAgICByZXR1cm4gaGF5c3RhY2tzLnNvbWUoKHZhbHVlKSA9PiB2YWx1ZS5pbmNsdWRlcyhub3JtYWxpemVkKSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHJlbmRlclN1Z2dlc3Rpb24oY2FuZGlkYXRlOiBMaW5lYWdlQ2FuZGlkYXRlLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhaW5lciA9IGVsLmNyZWF0ZURpdih7IGNsczogXCJtbmVtby1saW5lYWdlLWNhbmRpZGF0ZVwiIH0pO1xyXG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgdGV4dDogY2FuZGlkYXRlLm5hbWUsIGNsczogXCJtbmVtby1saW5lYWdlLWNhbmRpZGF0ZS10aXRsZVwiIH0pO1xyXG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwic21hbGxcIiwge1xyXG4gICAgICB0ZXh0OiBgJHtjYW5kaWRhdGUuZW50aXR5X3R5cGV9ID8gJHtjYW5kaWRhdGUubWF0Y2hfa2luZH0gPyBzY29yZSAke2NhbmRpZGF0ZS5zY29yZX1gLFxyXG4gICAgICBjbHM6IFwibW5lbW8tbGluZWFnZS1jYW5kaWRhdGUtbWV0YVwiLFxyXG4gICAgfSk7XHJcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyB0ZXh0OiBjYW5kaWRhdGUucGF0aCwgY2xzOiBcIm1uZW1vLWxpbmVhZ2UtY2FuZGlkYXRlLXBhdGhcIiB9KTtcclxuICB9XHJcblxyXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihjYW5kaWRhdGU6IExpbmVhZ2VDYW5kaWRhdGUpOiB2b2lkIHtcclxuICAgIHRoaXMuc2V0dGxlZCA9IHRydWU7XHJcbiAgICB0aGlzLnJlc29sdmVyPy4oY2FuZGlkYXRlKTtcclxuICAgIHRoaXMucmVzb2x2ZXIgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgb3ZlcnJpZGUgb25DbG9zZSgpOiB2b2lkIHtcclxuICAgIHN1cGVyLm9uQ2xvc2UoKTtcclxuICAgIGlmICghdGhpcy5zZXR0bGVkKSB7XHJcbiAgICAgIHRoaXMucmVzb2x2ZXI/LihudWxsKTtcclxuICAgICAgdGhpcy5yZXNvbHZlciA9IG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgTW5lbW9HcmFwaFZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XHJcbiAgcHJpdmF0ZSBjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50IHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgbm9kZXM6IEdyYXBoTm9kZVtdID0gW107XHJcbiAgcHJpdmF0ZSBlZGdlczogR3JhcGhFZGdlW10gPSBbXTtcclxuICBwcml2YXRlIG5vZGVNYXA6IE1hcDxzdHJpbmcsIEdyYXBoTm9kZT4gPSBuZXcgTWFwKCk7XHJcblxyXG4gIHByaXZhdGUgb2Zmc2V0WCA9IDA7XHJcbiAgcHJpdmF0ZSBvZmZzZXRZID0gMDtcclxuICBwcml2YXRlIHNjYWxlID0gMTtcclxuXHJcbiAgcHJpdmF0ZSBkcmFnTm9kZTogR3JhcGhOb2RlIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBpc1Bhbm5pbmcgPSBmYWxzZTtcclxuICBwcml2YXRlIHBhblN0YXJ0ID0geyB4OiAwLCB5OiAwIH07XHJcbiAgcHJpdmF0ZSBsYXN0TW91c2UgPSB7IHg6IDAsIHk6IDAgfTtcclxuICBwcml2YXRlIGhvdmVyZWROb2RlOiBHcmFwaE5vZGUgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGFuaW1GcmFtZSA9IDA7XHJcbiAgcHJpdmF0ZSBzaW1SdW5uaW5nID0gZmFsc2U7XHJcbiAgcHJpdmF0ZSBzaW1JdGVyYXRpb25zID0gMDtcclxuXHJcbiAgcHJpdmF0ZSBjZW50ZXJQYXRoID0gXCJcIjtcclxuICBwcml2YXRlIHZpZXdNb2RlOiBHcmFwaFZpZXdNb2RlID0gXCJsaW5lYWdlXCI7XHJcbiAgcHJpdmF0ZSBjbHVzdGVyRGF0YTogQ2x1c3RlckluZm9bXSA9IFtdO1xyXG4gIHByaXZhdGUgYmFja0J0bjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGFsbEJ0bnM6IEhUTUxFbGVtZW50W10gPSBbXTtcclxuICBwcml2YXRlIHN0YXR1c0VsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgbGVnZW5kRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgbGVhZjogV29ya3NwYWNlTGVhZixcclxuICAgIHByaXZhdGUgYXBpQ2xpZW50OiBNbmVtb0FwaUNsaWVudFxyXG4gICkge1xyXG4gICAgc3VwZXIobGVhZik7XHJcbiAgfVxyXG5cclxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIE1ORU1PX0dSQVBIX1ZJRVdfVFlQRTtcclxuICB9XHJcblxyXG4gIGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gXCJNbmVtbyBncmFwaFwiO1xyXG4gIH1cclxuXHJcbiAgZ2V0SWNvbigpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIFwiZ2l0LWZvcmtcIjtcclxuICB9XHJcblxyXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyRWwuY2hpbGRyZW5bMV0gYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICBjb250YWluZXIuZW1wdHkoKTtcclxuICAgIGNvbnRhaW5lci5hZGRDbGFzcyhcIm1uZW1vLWdyYXBoLWNvbnRhaW5lclwiKTtcclxuXHJcbiAgICBjb25zdCB0b29sYmFyID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJtbmVtby1ncmFwaC10b29sYmFyXCIgfSk7XHJcbiAgICB0b29sYmFyLmNyZWF0ZUVsKFwic3BhblwiLCB7IHRleHQ6IFwiTW5lbW8gZ3JhcGhcIiwgY2xzOiBcIm1uZW1vLWdyYXBoLXRpdGxlXCIgfSk7XHJcblxyXG4gICAgY29uc3QgbGluZWFnZUJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwge1xyXG4gICAgICB0ZXh0OiBcIlx1RDgzRVx1RERFQyBsaW5lYWdlXCIsXHJcbiAgICAgIGNsczogXCJtbmVtby1ncmFwaC1idG4gbW5lbW8tZ3JhcGgtYnRuLWFjdGl2ZVwiLFxyXG4gICAgICBhdHRyOiB7IHRpdGxlOiBcIkN1cnJlbnQgbm90ZSBsaW5lYWdlXCIgfSxcclxuICAgIH0pO1xyXG4gICAgbGluZWFnZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICB0aGlzLnNldEFjdGl2ZUJ0bihsaW5lYWdlQnRuKTtcclxuICAgICAgdGhpcy52aWV3TW9kZSA9IFwibGluZWFnZVwiO1xyXG4gICAgICB2b2lkIHRoaXMubG9hZExpbmVhZ2UoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGxvY2FsQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7XHJcbiAgICAgIHRleHQ6IFwiXHVEODNEXHVEQ0NEIGxvY2FsXCIsXHJcbiAgICAgIGNsczogXCJtbmVtby1ncmFwaC1idG5cIixcclxuICAgICAgYXR0cjogeyB0aXRsZTogXCJDdXJyZW50IG5vdGUgbmVpZ2hib3Job29kXCIgfSxcclxuICAgIH0pO1xyXG4gICAgbG9jYWxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgdGhpcy5zZXRBY3RpdmVCdG4obG9jYWxCdG4pO1xyXG4gICAgICB0aGlzLnZpZXdNb2RlID0gXCJsb2NhbFwiO1xyXG4gICAgICB2b2lkIHRoaXMubG9hZEdyYXBoKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBjbHVzdGVyQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7XHJcbiAgICAgIHRleHQ6IFwiXHVEODNEXHVERDJFIGV4cGxvcmVcIixcclxuICAgICAgY2xzOiBcIm1uZW1vLWdyYXBoLWJ0blwiLFxyXG4gICAgICBhdHRyOiB7IHRpdGxlOiBcIkV4cGxvcmUgYnkgY2x1c3RlcnNcIiB9LFxyXG4gICAgfSk7XHJcbiAgICBjbHVzdGVyQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMuc2V0QWN0aXZlQnRuKGNsdXN0ZXJCdG4pO1xyXG4gICAgICB0aGlzLnZpZXdNb2RlID0gXCJjbHVzdGVyXCI7XHJcbiAgICAgIHZvaWQgdGhpcy5sb2FkQ2x1c3RlcnMoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGZ1bGxCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcclxuICAgICAgdGV4dDogXCJcdUQ4M0NcdURGMTAgZnVsbFwiLFxyXG4gICAgICBjbHM6IFwibW5lbW8tZ3JhcGgtYnRuXCIsXHJcbiAgICAgIGF0dHI6IHsgdGl0bGU6IFwiRnVsbCBrbm93bGVkZ2UgZ3JhcGhcIiB9LFxyXG4gICAgfSk7XHJcbiAgICBmdWxsQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMuc2V0QWN0aXZlQnRuKGZ1bGxCdG4pO1xyXG4gICAgICB0aGlzLnZpZXdNb2RlID0gXCJmdWxsXCI7XHJcbiAgICAgIHZvaWQgdGhpcy5sb2FkRnVsbEdyYXBoKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmJhY2tCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcclxuICAgICAgdGV4dDogXCJcdTIxOTAgYmFja1wiLFxyXG4gICAgICBjbHM6IFwibW5lbW8tZ3JhcGgtYnRuXCIsXHJcbiAgICAgIGF0dHI6IHsgdGl0bGU6IFwiQmFjayB0byBjbHVzdGVyc1wiIH0sXHJcbiAgICB9KTtcclxuICAgIHRoaXMuYmFja0J0bi5oaWRlKCk7XHJcbiAgICB0aGlzLmJhY2tCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgdGhpcy5iYWNrQnRuPy5oaWRlKCk7XHJcbiAgICAgIHZvaWQgdGhpcy5sb2FkQ2x1c3RlcnMoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWxsQnRucyA9IFtsaW5lYWdlQnRuLCBsb2NhbEJ0biwgY2x1c3RlckJ0biwgZnVsbEJ0bl07XHJcblxyXG4gICAgY29uc3QgcmVmcmVzaEJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwge1xyXG4gICAgICB0ZXh0OiBcIlx1MjFCQlwiLFxyXG4gICAgICBjbHM6IFwibW5lbW8tZ3JhcGgtYnRuXCIsXHJcbiAgICAgIGF0dHI6IHsgdGl0bGU6IFwiUmVmcmVzaFwiIH0sXHJcbiAgICB9KTtcclxuICAgIHJlZnJlc2hCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgdm9pZCB0aGlzLnJlZnJlc2hDdXJyZW50VmlldygpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZml0QnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7XHJcbiAgICAgIHRleHQ6IFwiXHUyMkExXCIsXHJcbiAgICAgIGNsczogXCJtbmVtby1ncmFwaC1idG5cIixcclxuICAgICAgYXR0cjogeyB0aXRsZTogXCJGaXQgdG8gdmlld1wiIH0sXHJcbiAgICB9KTtcclxuICAgIGZpdEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5maXRUb1ZpZXcoKSk7XHJcblxyXG4gICAgY29uc3QgbWV0YSA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwibW5lbW8tZ3JhcGgtbWV0YVwiIH0pO1xyXG4gICAgdGhpcy5zdGF0dXNFbCA9IG1ldGEuY3JlYXRlRGl2KHsgY2xzOiBcIm1uZW1vLWdyYXBoLXN0YXR1c1wiIH0pO1xyXG4gICAgdGhpcy5sZWdlbmRFbCA9IG1ldGEuY3JlYXRlRGl2KHsgY2xzOiBcIm1uZW1vLWdyYXBoLWxlZ2VuZFwiIH0pO1xyXG4gICAgdGhpcy5yZW5kZXJMZWdlbmQoKTtcclxuXHJcbiAgICB0aGlzLmNhbnZhcyA9IGNvbnRhaW5lci5jcmVhdGVFbChcImNhbnZhc1wiLCB7IGNsczogXCJtbmVtby1ncmFwaC1jYW52YXNcIiB9KTtcclxuICAgIHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xyXG5cclxuICAgIHRoaXMucmVzaXplQ2FudmFzKCk7XHJcbiAgICB0aGlzLnJlZ2lzdGVyRG9tRXZlbnQod2luZG93LCBcInJlc2l6ZVwiLCAoKSA9PiB0aGlzLnJlc2l6ZUNhbnZhcygpKTtcclxuICAgIHRoaXMuc2V0dXBJbnRlcmFjdGlvbigpO1xyXG4gICAgYXdhaXQgdGhpcy5sb2FkTGluZWFnZSgpO1xyXG4gIH1cclxuXHJcbiAgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRoaXMuc2ltUnVubmluZyA9IGZhbHNlO1xyXG4gICAgaWYgKHRoaXMuYW5pbUZyYW1lKSB7XHJcbiAgICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRoaXMuYW5pbUZyYW1lKTtcclxuICAgIH1cclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGxvYWRHcmFwaChwYXRoPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBhY3RpdmVQYXRoID0gdGhpcy5nZXRSZXF1ZXN0ZWRQYXRoKHBhdGgpO1xyXG4gICAgaWYgKCFhY3RpdmVQYXRoKSB7XHJcbiAgICAgIHRoaXMuc2V0U3RhdHVzKFwiT3BlbiBhIG5vdGUgdG8gaW5zcGVjdCBpdHMgZ3JhcGggbmVpZ2hib3Job29kXCIpO1xyXG4gICAgICB0aGlzLmRyYXdFbXB0eShcIk9wZW4gYSBub3RlLCB0aGVuIHJlZnJlc2hcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmNlbnRlclBhdGggPSBhY3RpdmVQYXRoO1xyXG4gICAgdGhpcy5yZW5kZXJMZWdlbmQoKTtcclxuICAgIHRoaXMuc2V0U3RhdHVzKFwiQ3VycmVudCBub3RlIG5laWdoYm9yaG9vZCBcdTAwQjcgZGVwdGggMVwiKTtcclxuXHJcbiAgICBjb25zdCBhcGlQYXRoID0gdGhpcy5ub3JtYWxpemVQYXRoKGFjdGl2ZVBhdGgpO1xyXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuYXBpQ2xpZW50LnN1YmdyYXBoKGFwaVBhdGgsIDEpO1xyXG4gICAgaWYgKCFkYXRhIHx8IGRhdGEubm9kZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHRoaXMuZHJhd0VtcHR5KFwiTm8gZ3JhcGggZGF0YSBmb3IgdGhpcyBub3RlXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IG5vZGVzID0gZGF0YS5ub2RlcztcclxuICAgIGxldCBlZGdlcyA9IGRhdGEuZWRnZXM7XHJcbiAgICBpZiAobm9kZXMubGVuZ3RoID4gODApIHtcclxuICAgICAgY29uc3Qga2VlcCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gICAgICBjb25zdCBjZW50ZXJOb2RlID0gbm9kZXMuZmluZCgobikgPT4gdGhpcy5tYXRjaGVzUGF0aChuLmlkLCB1bmRlZmluZWQsIFthY3RpdmVQYXRoLCBhcGlQYXRoXSkpO1xyXG4gICAgICBpZiAoY2VudGVyTm9kZSkge1xyXG4gICAgICAgIGtlZXAuYWRkKGNlbnRlck5vZGUuaWQpO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IHNvcnRlZCA9IFsuLi5ub2Rlc10uc29ydCgoYSwgYikgPT4gKGIuc2NvcmUgPz8gMCkgLSAoYS5zY29yZSA/PyAwKSk7XHJcbiAgICAgIGZvciAoY29uc3QgbiBvZiBzb3J0ZWQpIHtcclxuICAgICAgICBpZiAoa2VlcC5zaXplID49IDgwKSB7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICAgICAga2VlcC5hZGQobi5pZCk7XHJcbiAgICAgIH1cclxuICAgICAgbm9kZXMgPSBub2Rlcy5maWx0ZXIoKG4pID0+IGtlZXAuaGFzKG4uaWQpKTtcclxuICAgICAgZWRnZXMgPSBlZGdlcy5maWx0ZXIoKGUpID0+IGtlZXAuaGFzKGUuc291cmNlKSAmJiBrZWVwLmhhcyhlLnRhcmdldCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuYnVpbGRHcmFwaChub2RlcywgZWRnZXMsIFthY3RpdmVQYXRoLCBhcGlQYXRoXSk7XHJcbiAgICB0aGlzLnJ1blNpbXVsYXRpb24oKTtcclxuICAgIHRoaXMuc2V0U3RhdHVzKGBDdXJyZW50IG5vdGUgbmVpZ2hib3Job29kIFx1MDBCNyAke3RoaXMubm9kZXMubGVuZ3RofSBub2RlcyBcdTAwQjcgJHt0aGlzLmVkZ2VzLmxlbmd0aH0gZWRnZXNgKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGxvYWRMaW5lYWdlKHBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFjdGl2ZVBhdGggPSB0aGlzLmdldFJlcXVlc3RlZFBhdGgocGF0aCk7XHJcbiAgICBpZiAoIWFjdGl2ZVBhdGgpIHtcclxuICAgICAgdGhpcy5zZXRTdGF0dXMoXCJPcGVuIGEgbm90ZSB0byBpbnNwZWN0IGl0cyBsaW5lYWdlXCIpO1xyXG4gICAgICB0aGlzLmRyYXdFbXB0eShcIk9wZW4gYSBub3RlLCB0aGVuIHJlZnJlc2hcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmNlbnRlclBhdGggPSBhY3RpdmVQYXRoO1xyXG4gICAgdGhpcy5yZW5kZXJMZWdlbmQoKTtcclxuICAgIHRoaXMuc2V0U3RhdHVzKFwiQ3VycmVudCBub3RlIGxpbmVhZ2UgXHUwMEI3IGRlcHRoIDIgXHUwMEI3IGJvdGggZGlyZWN0aW9uc1wiKTtcclxuICAgIHRoaXMuZHJhd0VtcHR5KFwiTG9hZGluZyBsaW5lYWdlLi4uXCIpO1xyXG5cclxuICAgIGNvbnN0IGFwaVBhdGggPSB0aGlzLm5vcm1hbGl6ZVBhdGgoYWN0aXZlUGF0aCk7XHJcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmFwaUNsaWVudC5saW5lYWdlKGFwaVBhdGgsIDIsIFwiYm90aFwiKTtcclxuICAgIGlmICghcmVzdWx0KSB7XHJcbiAgICAgIHRoaXMuZHJhd0VtcHR5KFwiTGluZWFnZSB2aWV3IHVuYXZhaWxhYmxlXFxuU3RhcnQgb3IgdXBkYXRlIHRoZSBNbmVtbyBBUEkgc2VydmVyXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAocmVzdWx0LmtpbmQgPT09IFwiYW1iaWd1b3VzXCIpIHtcclxuICAgICAgYXdhaXQgdGhpcy5yZXNvbHZlQW1iaWd1b3VzTGluZWFnZShyZXN1bHQuZGV0YWlsKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGRhdGEgPSByZXN1bHQuZGF0YTtcclxuICAgIGlmICghZGF0YS5ub2RlcyB8fCBkYXRhLm5vZGVzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICB0aGlzLmRyYXdFbXB0eShcIk5vIGxpbmVhZ2UgZGF0YSBmb3IgdGhpcyBub3RlXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5idWlsZExpbmVhZ2VHcmFwaChkYXRhLCBbYWN0aXZlUGF0aCwgYXBpUGF0aF0pO1xyXG4gICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XHJcbiAgICB0aGlzLmZpdFRvVmlldygpO1xyXG4gICAgdGhpcy5kcmF3KCk7XHJcbiAgICB0aGlzLnNldFN0YXR1cyhgQ3VycmVudCBub3RlIGxpbmVhZ2UgXHUwMEI3ICR7dGhpcy5ub2Rlcy5sZW5ndGh9IG5vZGVzIFx1MDBCNyAke3RoaXMuZWRnZXMubGVuZ3RofSBlZGdlc2ApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyByZXNvbHZlQW1iaWd1b3VzTGluZWFnZShkZXRhaWw6IExpbmVhZ2VBbWJpZ3VvdXNEZXRhaWwpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRoaXMuc2V0U3RhdHVzKGBMaW5lYWdlIHJlZmVyZW5jZSBpcyBhbWJpZ3VvdXMgPyAke2RldGFpbC5jYW5kaWRhdGVzLmxlbmd0aH0gY2FuZGlkYXRlc2ApO1xyXG4gICAgY29uc3QgcGlja2VyID0gbmV3IExpbmVhZ2VDYW5kaWRhdGVNb2RhbCh0aGlzLmFwcCwgZGV0YWlsKTtcclxuICAgIGNvbnN0IHNlbGVjdGVkID0gYXdhaXQgcGlja2VyLnBpY2soKTtcclxuICAgIGlmICghc2VsZWN0ZWQpIHtcclxuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJMaW5lYWdlIHNlbGVjdGlvbiBjYW5jZWxlZFwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIG5ldyBOb3RpY2UoYExvYWRpbmcgbGluZWFnZSBmb3IgJHtzZWxlY3RlZC5uYW1lfWApO1xyXG4gICAgYXdhaXQgdGhpcy5sb2FkTGluZWFnZShzZWxlY3RlZC5pZCk7XHJcbiAgfVxyXG5cclxuICBzZXRDZW50ZXJQYXRoKHBhdGg6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5jZW50ZXJQYXRoID0gcGF0aDtcclxuICAgIHZvaWQgdGhpcy5yZWZyZXNoQ3VycmVudFZpZXcocGF0aCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHJlZnJlc2hDdXJyZW50VmlldyhwYXRoPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBzd2l0Y2ggKHRoaXMudmlld01vZGUpIHtcclxuICAgICAgY2FzZSBcImZ1bGxcIjpcclxuICAgICAgICBhd2FpdCB0aGlzLmxvYWRGdWxsR3JhcGgoKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBcImNsdXN0ZXJcIjpcclxuICAgICAgICBhd2FpdCB0aGlzLmxvYWRDbHVzdGVycygpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIFwibGluZWFnZVwiOlxyXG4gICAgICAgIGF3YWl0IHRoaXMubG9hZExpbmVhZ2UocGF0aCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgXCJsb2NhbFwiOlxyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIGF3YWl0IHRoaXMubG9hZEdyYXBoKHBhdGgpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzZXRBY3RpdmVCdG4oYWN0aXZlOiBIVE1MRWxlbWVudCk6IHZvaWQge1xyXG4gICAgZm9yIChjb25zdCBidG4gb2YgdGhpcy5hbGxCdG5zKSB7XHJcbiAgICAgIGJ0bi5yZW1vdmVDbGFzcyhcIm1uZW1vLWdyYXBoLWJ0bi1hY3RpdmVcIik7XHJcbiAgICB9XHJcbiAgICBhY3RpdmUuYWRkQ2xhc3MoXCJtbmVtby1ncmFwaC1idG4tYWN0aXZlXCIpO1xyXG4gICAgaWYgKHRoaXMuYmFja0J0bikge1xyXG4gICAgICB0aGlzLmJhY2tCdG4uaGlkZSgpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5yZW5kZXJMZWdlbmQoKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGxvYWRDbHVzdGVycygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRoaXMucmVuZGVyTGVnZW5kKCk7XHJcbiAgICB0aGlzLnNldFN0YXR1cyhcIkNsdXN0ZXIgZXhwbG9yZXJcIik7XHJcbiAgICB0aGlzLmRyYXdFbXB0eShcIkxvYWRpbmcgY2x1c3RlcnMuLi5cIik7XHJcblxyXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuYXBpQ2xpZW50LmNsdXN0ZXJzKCk7XHJcbiAgICBpZiAoIWRhdGEgfHwgIWRhdGEuY2x1c3RlcnMgfHwgZGF0YS5jbHVzdGVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJObyBjbHVzdGVyIGRhdGFcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmNsdXN0ZXJEYXRhID0gZGF0YS5jbHVzdGVycztcclxuICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuZW5zdXJlQ2FudmFzKCk7XHJcbiAgICBjb25zdCB3ID0gY2FudmFzLndpZHRoO1xyXG4gICAgY29uc3QgaCA9IGNhbnZhcy5oZWlnaHQ7XHJcblxyXG4gICAgdGhpcy5ub2RlcyA9IGRhdGEuY2x1c3RlcnMubWFwKChjOiBDbHVzdGVySW5mbykgPT4gKHtcclxuICAgICAgaWQ6IGMuaWQsXHJcbiAgICAgIG5hbWU6IGAke2MuaHViX25hbWV9ICgke2Muc2l6ZX0pYCxcclxuICAgICAgdHlwZTogYy5kb21pbmFudF90eXBlLFxyXG4gICAgICBzY29yZTogYy5zaXplLFxyXG4gICAgICB4OiAoYy54IC8gMTAwMCkgKiB3ICogMC45ICsgdyAqIDAuMDUsXHJcbiAgICAgIHk6IChjLnkgLyAxMDAwKSAqIGggKiAwLjkgKyBoICogMC4wNSxcclxuICAgICAgdng6IDAsXHJcbiAgICAgIHZ5OiAwLFxyXG4gICAgICByYWRpdXM6IE1hdGgubWF4KDgsIE1hdGgubWluKDQwLCA4ICsgTWF0aC5zcXJ0KGMuc2l6ZSkgKiAyKSksXHJcbiAgICAgIGlzQ2VudGVyOiBmYWxzZSxcclxuICAgICAgX2NsdXN0ZXJJbmRleDogYy5pbmRleCxcclxuICAgIH0pKTtcclxuXHJcbiAgICB0aGlzLmVkZ2VzID0gKGRhdGEuZWRnZXMgPz8gW10pLm1hcCgoZSkgPT4gKHtcclxuICAgICAgc291cmNlOiBlLnNvdXJjZSxcclxuICAgICAgdGFyZ2V0OiBlLnRhcmdldCxcclxuICAgICAgdHlwZTogXCJjbHVzdGVyX2xpbmtcIixcclxuICAgIH0pKTtcclxuXHJcbiAgICB0aGlzLm5vZGVNYXAgPSBuZXcgTWFwKHRoaXMubm9kZXMubWFwKChuKSA9PiBbbi5pZCwgbl0pKTtcclxuICAgIHRoaXMucmVzZXRWaWV3cG9ydCgpO1xyXG4gICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XHJcbiAgICB0aGlzLmRyYXcoKTtcclxuICAgIHRoaXMuc2V0U3RhdHVzKGBDbHVzdGVyIGV4cGxvcmVyIFx1MDBCNyAke3RoaXMuY2x1c3RlckRhdGEubGVuZ3RofSBjbHVzdGVyc2ApO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgZHJpbGxJbnRvQ2x1c3RlcihjbHVzdGVySW5kZXg6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdGhpcy5yZW5kZXJMZWdlbmQoKTtcclxuICAgIHRoaXMuc2V0U3RhdHVzKGBDbHVzdGVyIGRldGFpbCBcdTAwQjcgIyR7Y2x1c3RlckluZGV4fWApO1xyXG4gICAgdGhpcy5kcmF3RW1wdHkoXCJMb2FkaW5nIGNsdXN0ZXIgZGV0YWlsLi4uXCIpO1xyXG5cclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmFwaUNsaWVudC5jbHVzdGVyRGV0YWlsKGNsdXN0ZXJJbmRleCk7XHJcbiAgICBpZiAoIWRhdGEgfHwgZGF0YS5ub2Rlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJFbXB0eSBjbHVzdGVyXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5lbnN1cmVDYW52YXMoKTtcclxuICAgIGNvbnN0IHcgPSBjYW52YXMud2lkdGg7XHJcbiAgICBjb25zdCBoID0gY2FudmFzLmhlaWdodDtcclxuXHJcbiAgICB0aGlzLm5vZGVzID0gZGF0YS5ub2Rlcy5tYXAoKG46IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXQpID0+ICh7XHJcbiAgICAgIGlkOiBuLmlkLFxyXG4gICAgICBuYW1lOiBuLm5hbWUsXHJcbiAgICAgIHR5cGU6IG4udHlwZSxcclxuICAgICAgc2NvcmU6IG4uZGVncmVlLFxyXG4gICAgICB4OiAoKG4ueCA/PyAwKSAvIDEwMDApICogdyAqIDAuOSArIHcgKiAwLjA1LFxyXG4gICAgICB5OiAoKG4ueSA/PyAwKSAvIDEwMDApICogaCAqIDAuOSArIGggKiAwLjA1LFxyXG4gICAgICB2eDogMCxcclxuICAgICAgdnk6IDAsXHJcbiAgICAgIHJhZGl1czogTWF0aC5tYXgoNCwgTWF0aC5taW4oMTYsIDQgKyAobi5kZWdyZWUgfHwgMCkgKiAwLjEpKSxcclxuICAgICAgaXNDZW50ZXI6IGZhbHNlLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIHRoaXMuZWRnZXMgPSBkYXRhLmVkZ2VzO1xyXG4gICAgdGhpcy5ub2RlTWFwID0gbmV3IE1hcCh0aGlzLm5vZGVzLm1hcCgobikgPT4gW24uaWQsIG5dKSk7XHJcbiAgICB0aGlzLnJlc2V0Vmlld3BvcnQoKTtcclxuICAgIHRoaXMuc2ltUnVubmluZyA9IGZhbHNlO1xyXG4gICAgdGhpcy5iYWNrQnRuPy5zaG93KCk7XHJcbiAgICB0aGlzLmRyYXcoKTtcclxuICAgIHRoaXMuc2V0U3RhdHVzKGBDbHVzdGVyIGRldGFpbCBcdTAwQjcgJHt0aGlzLm5vZGVzLmxlbmd0aH0gbm9kZXMgXHUwMEI3ICR7dGhpcy5lZGdlcy5sZW5ndGh9IGVkZ2VzYCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBsb2FkRnVsbEdyYXBoKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdGhpcy5yZW5kZXJMZWdlbmQoKTtcclxuICAgIHRoaXMuc2V0U3RhdHVzKFwiRnVsbCBrbm93bGVkZ2UgZ3JhcGhcIik7XHJcbiAgICB0aGlzLmRyYXdFbXB0eShcIkxvYWRpbmcgZnVsbCBncmFwaC4uLlwiKTtcclxuXHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuZnVsbEdyYXBoKCk7XHJcbiAgICBpZiAoIWRhdGEgfHwgZGF0YS5ub2Rlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJObyBncmFwaCBkYXRhXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5lbnN1cmVDYW52YXMoKTtcclxuICAgIGNvbnN0IHcgPSBjYW52YXMud2lkdGg7XHJcbiAgICBjb25zdCBoID0gY2FudmFzLmhlaWdodDtcclxuXHJcbiAgICB0aGlzLm5vZGVzID0gZGF0YS5ub2Rlcy5tYXAoKG46IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXQpID0+ICh7XHJcbiAgICAgIGlkOiBuLmlkLFxyXG4gICAgICBuYW1lOiBuLm5hbWUsXHJcbiAgICAgIHR5cGU6IG4udHlwZSxcclxuICAgICAgc2NvcmU6IG4uZGVncmVlLFxyXG4gICAgICB4OiAoKG4ueCA/PyAwKSAvIDEwMDApICogdyAqIDAuOSArIHcgKiAwLjA1LFxyXG4gICAgICB5OiAoKG4ueSA/PyAwKSAvIDEwMDApICogaCAqIDAuOSArIGggKiAwLjA1LFxyXG4gICAgICB2eDogMCxcclxuICAgICAgdnk6IDAsXHJcbiAgICAgIHJhZGl1czogTWF0aC5tYXgoMywgTWF0aC5taW4oMTYsIDMgKyAobi5kZWdyZWUgfHwgMCkgKiAwLjA1KSksXHJcbiAgICAgIGlzQ2VudGVyOiBmYWxzZSxcclxuICAgIH0pKTtcclxuXHJcbiAgICB0aGlzLmVkZ2VzID0gZGF0YS5lZGdlcztcclxuICAgIHRoaXMubm9kZU1hcCA9IG5ldyBNYXAodGhpcy5ub2Rlcy5tYXAoKG4pID0+IFtuLmlkLCBuXSkpO1xyXG4gICAgdGhpcy5yZXNldFZpZXdwb3J0KCk7XHJcbiAgICB0aGlzLnNpbVJ1bm5pbmcgPSBmYWxzZTtcclxuICAgIHRoaXMuZHJhdygpO1xyXG4gICAgdGhpcy5zZXRTdGF0dXMoYEZ1bGwga25vd2xlZGdlIGdyYXBoIFx1MDBCNyAke3RoaXMubm9kZXMubGVuZ3RofSBub2RlcyBcdTAwQjcgJHt0aGlzLmVkZ2VzLmxlbmd0aH0gZWRnZXNgKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGRHcmFwaChub2RlczogU3ViZ3JhcGhOb2RlW10sIGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSwgY2VudGVyQ2FuZGlkYXRlczogc3RyaW5nW10pOiB2b2lkIHtcclxuICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuZW5zdXJlQ2FudmFzKCk7XHJcbiAgICBjb25zdCBjeCA9IGNhbnZhcy53aWR0aCAvIDI7XHJcbiAgICBjb25zdCBjeSA9IGNhbnZhcy5oZWlnaHQgLyAyO1xyXG5cclxuICAgIHRoaXMubm9kZXMgPSBub2Rlcy5tYXAoKG4pID0+IHtcclxuICAgICAgY29uc3QgaXNDZW50ZXIgPSB0aGlzLm1hdGNoZXNQYXRoKG4uaWQsIHVuZGVmaW5lZCwgY2VudGVyQ2FuZGlkYXRlcyk7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgaWQ6IG4uaWQsXHJcbiAgICAgICAgbmFtZTogbi5uYW1lLFxyXG4gICAgICAgIHR5cGU6IG4udHlwZSxcclxuICAgICAgICBzY29yZTogbi5zY29yZSxcclxuICAgICAgICB4OiBpc0NlbnRlciA/IGN4IDogY3ggKyAoTWF0aC5yYW5kb20oKSAtIDAuNSkgKiAzMDAsXHJcbiAgICAgICAgeTogaXNDZW50ZXIgPyBjeSA6IGN5ICsgKE1hdGgucmFuZG9tKCkgLSAwLjUpICogMzAwLFxyXG4gICAgICAgIHZ4OiAwLFxyXG4gICAgICAgIHZ5OiAwLFxyXG4gICAgICAgIHJhZGl1czogaXNDZW50ZXIgPyAxOCA6IDEyLFxyXG4gICAgICAgIGlzQ2VudGVyLFxyXG4gICAgICB9O1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5lZGdlcyA9IGVkZ2VzO1xyXG4gICAgdGhpcy5ub2RlTWFwID0gbmV3IE1hcCh0aGlzLm5vZGVzLm1hcCgobikgPT4gW24uaWQsIG5dKSk7XHJcbiAgICB0aGlzLnJlc2V0Vmlld3BvcnQoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGRMaW5lYWdlR3JhcGgoZGF0YTogTGluZWFnZVJlc3BvbnNlLCBjZW50ZXJDYW5kaWRhdGVzOiBzdHJpbmdbXSk6IHZvaWQge1xyXG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5lbnN1cmVDYW52YXMoKTtcclxuICAgIGNvbnN0IHcgPSBjYW52YXMud2lkdGg7XHJcbiAgICBjb25zdCBoID0gY2FudmFzLmhlaWdodDtcclxuICAgIGNvbnN0IGN4ID0gdyAvIDI7XHJcbiAgICBjb25zdCBjeSA9IGggLyAyO1xyXG5cclxuICAgIGNvbnN0IG5vcm1hbGl6ZWRDZW50ZXIgPSB0aGlzLm5vcm1hbGl6ZVBhdGgoZGF0YS5jZW50ZXIpO1xyXG4gICAgY29uc3QgYWxsQ2VudGVyQ2FuZGlkYXRlcyA9IFsuLi5jZW50ZXJDYW5kaWRhdGVzLCBub3JtYWxpemVkQ2VudGVyXTtcclxuXHJcbiAgICBjb25zdCB1cHN0cmVhbSA9IGRhdGEubm9kZXNcclxuICAgICAgLmZpbHRlcigobm9kZSkgPT4gdGhpcy5ub3JtYWxpemVMaW5lYWdlUm9sZShub2RlLmxpbmVhZ2Vfcm9sZSkgPT09IFwidXBzdHJlYW1cIilcclxuICAgICAgLnNvcnQoKGEsIGIpID0+IGEuZGVwdGggLSBiLmRlcHRoIHx8IGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSkpO1xyXG4gICAgY29uc3QgZG93bnN0cmVhbSA9IGRhdGEubm9kZXNcclxuICAgICAgLmZpbHRlcigobm9kZSkgPT4gdGhpcy5ub3JtYWxpemVMaW5lYWdlUm9sZShub2RlLmxpbmVhZ2Vfcm9sZSkgPT09IFwiZG93bnN0cmVhbVwiKVxyXG4gICAgICAuc29ydCgoYSwgYikgPT4gYS5kZXB0aCAtIGIuZGVwdGggfHwgYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSk7XHJcbiAgICBjb25zdCBicmlkZ2UgPSBkYXRhLm5vZGVzXHJcbiAgICAgIC5maWx0ZXIoKG5vZGUpID0+IHRoaXMubm9ybWFsaXplTGluZWFnZVJvbGUobm9kZS5saW5lYWdlX3JvbGUpID09PSBcImJyaWRnZVwiKVxyXG4gICAgICAuc29ydCgoYSwgYikgPT4gYS5kZXB0aCAtIGIuZGVwdGggfHwgYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSk7XHJcbiAgICBjb25zdCBvdGhlciA9IGRhdGEubm9kZXNcclxuICAgICAgLmZpbHRlcigobm9kZSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLm5vcm1hbGl6ZUxpbmVhZ2VSb2xlKG5vZGUubGluZWFnZV9yb2xlKTtcclxuICAgICAgICByZXR1cm4gcm9sZSAhPT0gXCJjZW50ZXJcIiAmJiByb2xlICE9PSBcInVwc3RyZWFtXCIgJiYgcm9sZSAhPT0gXCJkb3duc3RyZWFtXCIgJiYgcm9sZSAhPT0gXCJicmlkZ2VcIjtcclxuICAgICAgfSlcclxuICAgICAgLnNvcnQoKGEsIGIpID0+IGEuZGVwdGggLSBiLmRlcHRoIHx8IGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSkpO1xyXG5cclxuICAgIGNvbnN0IHBvc2l0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0+KCk7XHJcblxyXG4gICAgY29uc3QgcGxhY2VMaW5lID0gKFxyXG4gICAgICBncm91cDogdHlwZW9mIGRhdGEubm9kZXMsXHJcbiAgICAgIGRpcmVjdGlvbjogLTEgfCAwIHwgMSxcclxuICAgICAgdmVydGljYWxPZmZzZXQ6IG51bWJlciA9IDBcclxuICAgICk6IHZvaWQgPT4ge1xyXG4gICAgICBjb25zdCBkZXB0aEJ1Y2tldHMgPSBuZXcgTWFwPG51bWJlciwgdHlwZW9mIGRhdGEubm9kZXM+KCk7XHJcbiAgICAgIGZvciAoY29uc3Qgbm9kZSBvZiBncm91cCkge1xyXG4gICAgICAgIGNvbnN0IGJ1Y2tldCA9IGRlcHRoQnVja2V0cy5nZXQobm9kZS5kZXB0aCkgPz8gW107XHJcbiAgICAgICAgYnVja2V0LnB1c2gobm9kZSk7XHJcbiAgICAgICAgZGVwdGhCdWNrZXRzLnNldChub2RlLmRlcHRoLCBidWNrZXQpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBmb3IgKGNvbnN0IFtkZXB0aCwgYnVja2V0XSBvZiBkZXB0aEJ1Y2tldHMuZW50cmllcygpKSB7XHJcbiAgICAgICAgY29uc3QgeCA9IGN4ICsgZGlyZWN0aW9uICogTWF0aC5tYXgoMTgwLCBkZXB0aCAqIDIyMCk7XHJcbiAgICAgICAgY29uc3QgY291bnQgPSBidWNrZXQubGVuZ3RoO1xyXG4gICAgICAgIGNvbnN0IHNwYW4gPSBNYXRoLm1pbihoICogMC43LCBNYXRoLm1heCgxMjAsIGNvdW50ICogODQpKTtcclxuICAgICAgICBjb25zdCBzdGVwID0gY291bnQgPiAxID8gc3BhbiAvIChjb3VudCAtIDEpIDogMDtcclxuICAgICAgICBjb25zdCBzdGFydFkgPSBjeSArIHZlcnRpY2FsT2Zmc2V0IC0gc3BhbiAvIDI7XHJcblxyXG4gICAgICAgIGJ1Y2tldC5mb3JFYWNoKChub2RlLCBpbmRleCkgPT4ge1xyXG4gICAgICAgICAgcG9zaXRpb25zLnNldChub2RlLmlkLCB7XHJcbiAgICAgICAgICAgIHgsXHJcbiAgICAgICAgICAgIHk6IGNvdW50ID09PSAxID8gY3kgKyB2ZXJ0aWNhbE9mZnNldCA6IHN0YXJ0WSArIGluZGV4ICogc3RlcCxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHBsYWNlTGluZSh1cHN0cmVhbSwgLTEpO1xyXG4gICAgcGxhY2VMaW5lKGRvd25zdHJlYW0sIDEpO1xyXG4gICAgcGxhY2VMaW5lKGJyaWRnZSwgMCwgMCk7XHJcbiAgICBwbGFjZUxpbmUob3RoZXIsIDEsIE1hdGgubWluKDEyMCwgaCAqIDAuMTgpKTtcclxuXHJcbiAgICB0aGlzLm5vZGVzID0gZGF0YS5ub2Rlcy5tYXAoKG5vZGUpID0+IHtcclxuICAgICAgY29uc3Qgcm9sZSA9IHRoaXMubm9ybWFsaXplTGluZWFnZVJvbGUobm9kZS5saW5lYWdlX3JvbGUpO1xyXG4gICAgICBjb25zdCBpc0NlbnRlciA9IHJvbGUgPT09IFwiY2VudGVyXCIgfHwgdGhpcy5tYXRjaGVzUGF0aChub2RlLmlkLCBub2RlLnBhdGgsIGFsbENlbnRlckNhbmRpZGF0ZXMpO1xyXG4gICAgICBjb25zdCBwb3MgPSBpc0NlbnRlciA/IHsgeDogY3gsIHk6IGN5IH0gOiBwb3NpdGlvbnMuZ2V0KG5vZGUuaWQpID8/IHsgeDogY3gsIHk6IGN5ICsgMTUwIH07XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgaWQ6IG5vZGUuaWQsXHJcbiAgICAgICAgbmFtZTogbm9kZS5uYW1lLFxyXG4gICAgICAgIHBhdGg6IG5vZGUucGF0aCxcclxuICAgICAgICB0eXBlOiBub2RlLmVudGl0eV90eXBlID8/IFwibm90ZVwiLFxyXG4gICAgICAgIHg6IHBvcy54LFxyXG4gICAgICAgIHk6IHBvcy55LFxyXG4gICAgICAgIHZ4OiAwLFxyXG4gICAgICAgIHZ5OiAwLFxyXG4gICAgICAgIHJhZGl1czogaXNDZW50ZXIgPyAyMCA6IE1hdGgubWF4KDEwLCAxNSAtIE1hdGgubWluKG5vZGUuZGVwdGgsIDQpKSxcclxuICAgICAgICBpc0NlbnRlcixcclxuICAgICAgICBsaW5lYWdlUm9sZTogaXNDZW50ZXIgPyBcImNlbnRlclwiIDogcm9sZSxcclxuICAgICAgICBsaW5lYWdlRGVwdGg6IG5vZGUuZGVwdGgsXHJcbiAgICAgIH07XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmVkZ2VzID0gZGF0YS5lZGdlcy5tYXAoKGVkZ2UpID0+ICh7XHJcbiAgICAgIHNvdXJjZTogZWRnZS5zb3VyY2UsXHJcbiAgICAgIHRhcmdldDogZWRnZS50YXJnZXQsXHJcbiAgICAgIHR5cGU6IGVkZ2UudHlwZSxcclxuICAgICAgd2VpZ2h0OiBlZGdlLndlaWdodCxcclxuICAgIH0pKTtcclxuXHJcbiAgICB0aGlzLm5vZGVNYXAgPSBuZXcgTWFwKHRoaXMubm9kZXMubWFwKChuKSA9PiBbbi5pZCwgbl0pKTtcclxuICAgIHRoaXMucmVzZXRWaWV3cG9ydCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBydW5TaW11bGF0aW9uKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zaW1SdW5uaW5nID0gdHJ1ZTtcclxuICAgIHRoaXMuc2ltSXRlcmF0aW9ucyA9IDA7XHJcbiAgICBjb25zdCB0aWNrID0gKCkgPT4ge1xyXG4gICAgICBpZiAoIXRoaXMuc2ltUnVubmluZykge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnNpbUl0ZXJhdGlvbnMrKztcclxuICAgICAgdGhpcy5zaW11bGF0ZVN0ZXAoKTtcclxuICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgIGlmICh0aGlzLnNpbUl0ZXJhdGlvbnMgPCAyMDApIHtcclxuICAgICAgICB0aGlzLmFuaW1GcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLnNpbVJ1bm5pbmcgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIHRoaXMuYW5pbUZyYW1lID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzaW11bGF0ZVN0ZXAoKTogdm9pZCB7XHJcbiAgICBjb25zdCBhbHBoYSA9IE1hdGgubWF4KDAuMDEsIDEgLSB0aGlzLnNpbUl0ZXJhdGlvbnMgLyAyMDApO1xyXG4gICAgY29uc3Qgbm9kZXMgPSB0aGlzLm5vZGVzO1xyXG4gICAgY29uc3QgcmVwdWxzaW9uID0gMzAwMDtcclxuICAgIGNvbnN0IHNwcmluZ0xlbiA9IDEyMDtcclxuICAgIGNvbnN0IHNwcmluZ0sgPSAwLjAyO1xyXG4gICAgY29uc3QgY2VudGVyR3Jhdml0eSA9IDAuMDE7XHJcbiAgICBjb25zdCBjYW52YXMgPSB0aGlzLmVuc3VyZUNhbnZhcygpO1xyXG4gICAgY29uc3QgdyA9IGNhbnZhcy53aWR0aCAvIDI7XHJcbiAgICBjb25zdCBoID0gY2FudmFzLmhlaWdodCAvIDI7XHJcblxyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBub2Rlcy5sZW5ndGg7IGorKykge1xyXG4gICAgICAgIGNvbnN0IGEgPSBub2Rlc1tpXTtcclxuICAgICAgICBjb25zdCBiID0gbm9kZXNbal07XHJcbiAgICAgICAgY29uc3QgZHggPSBiLnggLSBhLng7XHJcbiAgICAgICAgY29uc3QgZHkgPSBiLnkgLSBhLnk7XHJcbiAgICAgICAgY29uc3QgZGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSkgfHwgMTtcclxuICAgICAgICBjb25zdCBmb3JjZSA9IHJlcHVsc2lvbiAvIChkaXN0ICogZGlzdCk7XHJcbiAgICAgICAgY29uc3QgZnggPSAoZHggLyBkaXN0KSAqIGZvcmNlICogYWxwaGE7XHJcbiAgICAgICAgY29uc3QgZnkgPSAoZHkgLyBkaXN0KSAqIGZvcmNlICogYWxwaGE7XHJcbiAgICAgICAgYS52eCAtPSBmeDtcclxuICAgICAgICBhLnZ5IC09IGZ5O1xyXG4gICAgICAgIGIudnggKz0gZng7XHJcbiAgICAgICAgYi52eSArPSBmeTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZvciAoY29uc3QgZSBvZiB0aGlzLmVkZ2VzKSB7XHJcbiAgICAgIGNvbnN0IGEgPSB0aGlzLm5vZGVNYXAuZ2V0KGUuc291cmNlKTtcclxuICAgICAgY29uc3QgYiA9IHRoaXMubm9kZU1hcC5nZXQoZS50YXJnZXQpO1xyXG4gICAgICBpZiAoIWEgfHwgIWIpIHtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBkeCA9IGIueCAtIGEueDtcclxuICAgICAgY29uc3QgZHkgPSBiLnkgLSBhLnk7XHJcbiAgICAgIGNvbnN0IGRpc3QgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpIHx8IDE7XHJcbiAgICAgIGNvbnN0IGZvcmNlID0gKGRpc3QgLSBzcHJpbmdMZW4pICogc3ByaW5nSyAqIGFscGhhO1xyXG4gICAgICBjb25zdCBmeCA9IChkeCAvIGRpc3QpICogZm9yY2U7XHJcbiAgICAgIGNvbnN0IGZ5ID0gKGR5IC8gZGlzdCkgKiBmb3JjZTtcclxuICAgICAgYS52eCArPSBmeDtcclxuICAgICAgYS52eSArPSBmeTtcclxuICAgICAgYi52eCAtPSBmeDtcclxuICAgICAgYi52eSAtPSBmeTtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKGNvbnN0IG4gb2Ygbm9kZXMpIHtcclxuICAgICAgbi52eCArPSAodyAtIG4ueCkgKiBjZW50ZXJHcmF2aXR5ICogYWxwaGE7XHJcbiAgICAgIG4udnkgKz0gKGggLSBuLnkpICogY2VudGVyR3Jhdml0eSAqIGFscGhhO1xyXG4gICAgICBuLnZ4ICo9IDAuODU7XHJcbiAgICAgIG4udnkgKj0gMC44NTtcclxuICAgICAgaWYgKCFuLmlzQ2VudGVyIHx8IHRoaXMuc2ltSXRlcmF0aW9ucyA+IDUpIHtcclxuICAgICAgICBuLnggKz0gbi52eDtcclxuICAgICAgICBuLnkgKz0gbi52eTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkcmF3KCk6IHZvaWQge1xyXG4gICAgY29uc3QgY3R4ID0gdGhpcy5lbnN1cmVDb250ZXh0KCk7XHJcbiAgICBjb25zdCBjYW52YXMgPSB0aGlzLmVuc3VyZUNhbnZhcygpO1xyXG4gICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xyXG4gICAgY3R4LnNhdmUoKTtcclxuICAgIGN0eC50cmFuc2xhdGUodGhpcy5vZmZzZXRYLCB0aGlzLm9mZnNldFkpO1xyXG4gICAgY3R4LnNjYWxlKHRoaXMuc2NhbGUsIHRoaXMuc2NhbGUpO1xyXG5cclxuICAgIGZvciAoY29uc3QgZSBvZiB0aGlzLmVkZ2VzKSB7XHJcbiAgICAgIGNvbnN0IGEgPSB0aGlzLm5vZGVNYXAuZ2V0KGUuc291cmNlKTtcclxuICAgICAgY29uc3QgYiA9IHRoaXMubm9kZU1hcC5nZXQoZS50YXJnZXQpO1xyXG4gICAgICBpZiAoIWEgfHwgIWIpIHtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgZWRnZVN0eWxlID0gdGhpcy5nZXRFZGdlU3R5bGUoYSwgYiwgZSk7XHJcbiAgICAgIGN0eC5iZWdpblBhdGgoKTtcclxuICAgICAgY3R4Lm1vdmVUbyhhLngsIGEueSk7XHJcbiAgICAgIGN0eC5saW5lVG8oYi54LCBiLnkpO1xyXG4gICAgICBjdHguc3Ryb2tlU3R5bGUgPSBlZGdlU3R5bGUuY29sb3I7XHJcbiAgICAgIGN0eC5saW5lV2lkdGggPSBlZGdlU3R5bGUud2lkdGg7XHJcbiAgICAgIGN0eC5zZXRMaW5lRGFzaChlZGdlU3R5bGUuZGFzaCk7XHJcbiAgICAgIGN0eC5zdHJva2UoKTtcclxuICAgICAgY3R4LnNldExpbmVEYXNoKFtdKTtcclxuXHJcbiAgICAgIGlmIChlZGdlU3R5bGUuYXJyb3cpIHtcclxuICAgICAgICB0aGlzLmRyYXdBcnJvd0hlYWQoY3R4LCBhLCBiLCBlZGdlU3R5bGUuY29sb3IpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZm9yIChjb25zdCBuIG9mIHRoaXMubm9kZXMpIHtcclxuICAgICAgY29uc3QgaXNIb3ZlcmVkID0gdGhpcy5ob3ZlcmVkTm9kZSA9PT0gbjtcclxuICAgICAgY29uc3QgdHlwZUNvbG9yID0gVFlQRV9DT0xPUlNbbi50eXBlXSB8fCBERUZBVUxUX0NPTE9SO1xyXG4gICAgICBjb25zdCByb2xlQ29sb3IgPSB0aGlzLnZpZXdNb2RlID09PSBcImxpbmVhZ2VcIlxyXG4gICAgICAgID8gTElORUFHRV9DT0xPUlNbbi5saW5lYWdlUm9sZSA/PyBcInVua25vd25cIl1cclxuICAgICAgICA6IHR5cGVDb2xvcjtcclxuXHJcbiAgICAgIGlmICh0aGlzLnZpZXdNb2RlID09PSBcImxpbmVhZ2VcIikge1xyXG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcclxuICAgICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIChuLmlzQ2VudGVyID8gOCA6IDYpLCAwLCBNYXRoLlBJICogMik7XHJcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMud2l0aEFscGhhKHJvbGVDb2xvciwgbi5pc0NlbnRlciA/IDAuMjIgOiAwLjEyKTtcclxuICAgICAgICBjdHguZmlsbCgpO1xyXG4gICAgICB9IGVsc2UgaWYgKG4uaXNDZW50ZXIpIHtcclxuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XHJcbiAgICAgICAgY3R4LmFyYyhuLngsIG4ueSwgbi5yYWRpdXMgKyA3LCAwLCBNYXRoLlBJICogMik7XHJcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMud2l0aEFscGhhKHR5cGVDb2xvciwgMC4yMik7XHJcbiAgICAgICAgY3R4LmZpbGwoKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY3R4LmJlZ2luUGF0aCgpO1xyXG4gICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIChpc0hvdmVyZWQgPyAzIDogMCksIDAsIE1hdGguUEkgKiAyKTtcclxuICAgICAgY3R4LmZpbGxTdHlsZSA9IHR5cGVDb2xvcjtcclxuICAgICAgY3R4LmZpbGwoKTtcclxuXHJcbiAgICAgIGlmICh0aGlzLnZpZXdNb2RlID09PSBcImxpbmVhZ2VcIikge1xyXG4gICAgICAgIGN0eC5zYXZlKCk7XHJcbiAgICAgICAgaWYgKG4ubGluZWFnZVJvbGUgPT09IFwiYnJpZGdlXCIpIHtcclxuICAgICAgICAgIGN0eC5zZXRMaW5lRGFzaChbNCwgM10pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSByb2xlQ29sb3I7XHJcbiAgICAgICAgY3R4LmxpbmVXaWR0aCA9IGlzSG92ZXJlZCA/IDMuNiA6IG4uaXNDZW50ZXIgPyAzLjIgOiAyLjQ7XHJcbiAgICAgICAgY3R4LnN0cm9rZSgpO1xyXG4gICAgICAgIGN0eC5yZXN0b3JlKCk7XHJcblxyXG4gICAgICAgIGlmIChuLmlzQ2VudGVyKSB7XHJcbiAgICAgICAgICBjdHguYmVnaW5QYXRoKCk7XHJcbiAgICAgICAgICBjdHguYXJjKG4ueCwgbi55LCBNYXRoLm1heCg0LCBuLnJhZGl1cyAqIDAuNDIpLCAwLCBNYXRoLlBJICogMik7XHJcbiAgICAgICAgICBjdHguZmlsbFN0eWxlID0gcm9sZUNvbG9yO1xyXG4gICAgICAgICAgY3R4LmZpbGwoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY3R4LnN0cm9rZVN0eWxlID0gaXNIb3ZlcmVkXHJcbiAgICAgICAgICA/IFwiI2ZmZmZmZlwiXHJcbiAgICAgICAgICA6IHRoaXMuaXNEYXJrVGhlbWUoKVxyXG4gICAgICAgICAgICA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjMpXCJcclxuICAgICAgICAgICAgOiBcInJnYmEoMCwwLDAsMC4yKVwiO1xyXG4gICAgICAgIGN0eC5saW5lV2lkdGggPSBpc0hvdmVyZWQgPyAyLjUgOiAxO1xyXG4gICAgICAgIGN0eC5zdHJva2UoKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwiI2UwZTBlMFwiIDogXCIjMzMzMzMzXCI7XHJcbiAgICAgIGN0eC5mb250ID0gbi5pc0NlbnRlciA/IFwiYm9sZCAxMXB4IHNhbnMtc2VyaWZcIiA6IFwiMTBweCBzYW5zLXNlcmlmXCI7XHJcbiAgICAgIGN0eC50ZXh0QWxpZ24gPSBcImNlbnRlclwiO1xyXG4gICAgICBpZiAoaXNIb3ZlcmVkIHx8IG4uaXNDZW50ZXIpIHtcclxuICAgICAgICBjb25zdCBsYWJlbCA9IG4ubmFtZS5sZW5ndGggPiA0MCA/IGAke24ubmFtZS5zbGljZSgwLCAzOCl9XHUyMDI2YCA6IG4ubmFtZTtcclxuICAgICAgICBjdHguZmlsbFRleHQobGFiZWwsIG4ueCwgbi55ICsgbi5yYWRpdXMgKyAxNCk7XHJcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5zY2FsZSA+IDAuNzUgJiYgbi5yYWRpdXMgPj0gNSkge1xyXG4gICAgICAgIGNvbnN0IHNob3J0ID0gbi5uYW1lLmxlbmd0aCA+IDEyID8gYCR7bi5uYW1lLnNsaWNlKDAsIDEwKX1cdTIwMjZgIDogbi5uYW1lO1xyXG4gICAgICAgIGN0eC5maWxsVGV4dChzaG9ydCwgbi54LCBuLnkgKyBuLnJhZGl1cyArIDE0KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGN0eC5yZXN0b3JlKCk7XHJcblxyXG4gICAgaWYgKHRoaXMuaG92ZXJlZE5vZGUpIHtcclxuICAgICAgdGhpcy5kcmF3VG9vbHRpcCh0aGlzLmhvdmVyZWROb2RlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0RWRnZVN0eWxlKGE6IEdyYXBoTm9kZSwgYjogR3JhcGhOb2RlLCBlZGdlOiBHcmFwaEVkZ2UpOiB7XHJcbiAgICBjb2xvcjogc3RyaW5nO1xyXG4gICAgd2lkdGg6IG51bWJlcjtcclxuICAgIGRhc2g6IG51bWJlcltdO1xyXG4gICAgYXJyb3c6IGJvb2xlYW47XHJcbiAgfSB7XHJcbiAgICBpZiAodGhpcy52aWV3TW9kZSA9PT0gXCJsaW5lYWdlXCIpIHtcclxuICAgICAgY29uc3Qgcm9sZSA9IHRoaXMucGlja0xpbmVhZ2VFZGdlUm9sZShhLCBiKTtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBjb2xvcjogdGhpcy53aXRoQWxwaGEoTElORUFHRV9DT0xPUlNbcm9sZV0sIHRoaXMuaXNEYXJrVGhlbWUoKSA/IDAuNjUgOiAwLjgpLFxyXG4gICAgICAgIHdpZHRoOiBNYXRoLm1heCgxLjUsIE1hdGgubWluKDQsIDEuMiArIChlZGdlLndlaWdodCA/PyAxKSAqIDAuNykpLFxyXG4gICAgICAgIGRhc2g6IFtdLFxyXG4gICAgICAgIGFycm93OiB0cnVlLFxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChlZGdlLnR5cGUgPT09IFwicmVsYXRlZFwiKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgY29sb3I6IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjIpXCIgOiBcInJnYmEoMCwwLDAsMC4xNSlcIixcclxuICAgICAgICB3aWR0aDogMS41LFxyXG4gICAgICAgIGRhc2g6IFs2LCA0XSxcclxuICAgICAgICBhcnJvdzogZmFsc2UsXHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgICBpZiAoZWRnZS50eXBlID09PSBcInRhZ19zaGFyZWRcIikge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGNvbG9yOiB0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMjU1LDI1NSwyNTUsMC4xKVwiIDogXCJyZ2JhKDAsMCwwLDAuMDgpXCIsXHJcbiAgICAgICAgd2lkdGg6IDEuMixcclxuICAgICAgICBkYXNoOiBbMywgNV0sXHJcbiAgICAgICAgYXJyb3c6IGZhbHNlLFxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIGNvbG9yOiB0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMjU1LDI1NSwyNTUsMC4yKVwiIDogXCJyZ2JhKDAsMCwwLDAuMTUpXCIsXHJcbiAgICAgIHdpZHRoOiAxLjUsXHJcbiAgICAgIGRhc2g6IFtdLFxyXG4gICAgICBhcnJvdzogZmFsc2UsXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkcmF3QXJyb3dIZWFkKGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELCBzb3VyY2U6IEdyYXBoTm9kZSwgdGFyZ2V0OiBHcmFwaE5vZGUsIGNvbG9yOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGR4ID0gdGFyZ2V0LnggLSBzb3VyY2UueDtcclxuICAgIGNvbnN0IGR5ID0gdGFyZ2V0LnkgLSBzb3VyY2UueTtcclxuICAgIGNvbnN0IGRpc3QgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xyXG4gICAgaWYgKGRpc3QgPCAwLjAwMSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdXggPSBkeCAvIGRpc3Q7XHJcbiAgICBjb25zdCB1eSA9IGR5IC8gZGlzdDtcclxuICAgIGNvbnN0IHRpcFggPSB0YXJnZXQueCAtIHV4ICogKHRhcmdldC5yYWRpdXMgKyAyKTtcclxuICAgIGNvbnN0IHRpcFkgPSB0YXJnZXQueSAtIHV5ICogKHRhcmdldC5yYWRpdXMgKyAyKTtcclxuICAgIGNvbnN0IHNpemUgPSA3O1xyXG5cclxuICAgIGN0eC5iZWdpblBhdGgoKTtcclxuICAgIGN0eC5tb3ZlVG8odGlwWCwgdGlwWSk7XHJcbiAgICBjdHgubGluZVRvKHRpcFggLSB1eCAqIHNpemUgLSB1eSAqIChzaXplICogMC42KSwgdGlwWSAtIHV5ICogc2l6ZSArIHV4ICogKHNpemUgKiAwLjYpKTtcclxuICAgIGN0eC5saW5lVG8odGlwWCAtIHV4ICogc2l6ZSArIHV5ICogKHNpemUgKiAwLjYpLCB0aXBZIC0gdXkgKiBzaXplIC0gdXggKiAoc2l6ZSAqIDAuNikpO1xyXG4gICAgY3R4LmNsb3NlUGF0aCgpO1xyXG4gICAgY3R4LmZpbGxTdHlsZSA9IGNvbG9yO1xyXG4gICAgY3R4LmZpbGwoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZHJhd1Rvb2x0aXAobjogR3JhcGhOb2RlKTogdm9pZCB7XHJcbiAgICBjb25zdCBjdHggPSB0aGlzLmVuc3VyZUNvbnRleHQoKTtcclxuICAgIGNvbnN0IHN4ID0gbi54ICogdGhpcy5zY2FsZSArIHRoaXMub2Zmc2V0WDtcclxuICAgIGNvbnN0IHN5ID0gbi55ICogdGhpcy5zY2FsZSArIHRoaXMub2Zmc2V0WSAtIG4ucmFkaXVzICogdGhpcy5zY2FsZSAtIDEwO1xyXG5cclxuICAgIGNvbnN0IGxpbmVzID0gW24ubmFtZSwgYFR5cGU6ICR7bi50eXBlfWBdO1xyXG4gICAgaWYgKG4ubGluZWFnZVJvbGUpIHtcclxuICAgICAgbGluZXMucHVzaChgUm9sZTogJHt0aGlzLmNhcGl0YWxpemUobi5saW5lYWdlUm9sZSl9YCk7XHJcbiAgICB9XHJcbiAgICBpZiAobi5saW5lYWdlRGVwdGggIT0gbnVsbCkge1xyXG4gICAgICBsaW5lcy5wdXNoKGBEZXB0aDogJHtuLmxpbmVhZ2VEZXB0aH1gKTtcclxuICAgIH1cclxuICAgIGlmIChuLnNjb3JlICE9IG51bGwpIHtcclxuICAgICAgbGluZXMucHVzaChgU2NvcmU6ICR7bi5zY29yZS50b0ZpeGVkKDMpfWApO1xyXG4gICAgfVxyXG5cclxuICAgIGN0eC5mb250ID0gXCIxMXB4IHNhbnMtc2VyaWZcIjtcclxuICAgIGNvbnN0IG1heFcgPSBNYXRoLm1heCguLi5saW5lcy5tYXAoKGxpbmUpID0+IGN0eC5tZWFzdXJlVGV4dChsaW5lKS53aWR0aCkpICsgMTY7XHJcbiAgICBjb25zdCBoID0gbGluZXMubGVuZ3RoICogMTYgKyAxMDtcclxuXHJcbiAgICBjb25zdCB0eCA9IHN4IC0gbWF4VyAvIDI7XHJcbiAgICBjb25zdCB0eSA9IHN5IC0gaDtcclxuXHJcbiAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDMwLDMwLDMwLDAuOTUpXCIgOiBcInJnYmEoMjU1LDI1NSwyNTUsMC45NSlcIjtcclxuICAgIGN0eC5zdHJva2VTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjIpXCIgOiBcInJnYmEoMCwwLDAsMC4xNSlcIjtcclxuICAgIGN0eC5saW5lV2lkdGggPSAxO1xyXG4gICAgdGhpcy5yb3VuZFJlY3QoY3R4LCB0eCwgdHksIG1heFcsIGgsIDYpO1xyXG4gICAgY3R4LmZpbGwoKTtcclxuICAgIGN0eC5zdHJva2UoKTtcclxuXHJcbiAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCIjZTBlMGUwXCIgOiBcIiMzMzMzMzNcIjtcclxuICAgIGN0eC50ZXh0QWxpZ24gPSBcImxlZnRcIjtcclxuICAgIGxpbmVzLmZvckVhY2goKGxpbmUsIGluZGV4KSA9PiB7XHJcbiAgICAgIGN0eC5maWxsVGV4dChsaW5lLCB0eCArIDgsIHR5ICsgMTYgKyBpbmRleCAqIDE2KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByb3VuZFJlY3QoXHJcbiAgICBjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCxcclxuICAgIHg6IG51bWJlcixcclxuICAgIHk6IG51bWJlcixcclxuICAgIHc6IG51bWJlcixcclxuICAgIGg6IG51bWJlcixcclxuICAgIHI6IG51bWJlclxyXG4gICk6IHZvaWQge1xyXG4gICAgY3R4LmJlZ2luUGF0aCgpO1xyXG4gICAgY3R4Lm1vdmVUbyh4ICsgciwgeSk7XHJcbiAgICBjdHgubGluZVRvKHggKyB3IC0gciwgeSk7XHJcbiAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4ICsgdywgeSwgeCArIHcsIHkgKyByKTtcclxuICAgIGN0eC5saW5lVG8oeCArIHcsIHkgKyBoIC0gcik7XHJcbiAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4ICsgdywgeSArIGgsIHggKyB3IC0gciwgeSArIGgpO1xyXG4gICAgY3R4LmxpbmVUbyh4ICsgciwgeSArIGgpO1xyXG4gICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCwgeSArIGgsIHgsIHkgKyBoIC0gcik7XHJcbiAgICBjdHgubGluZVRvKHgsIHkgKyByKTtcclxuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHgsIHksIHggKyByLCB5KTtcclxuICAgIGN0eC5jbG9zZVBhdGgoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZHJhd0VtcHR5KG1zZzogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjdHggPSB0aGlzLmVuc3VyZUNvbnRleHQoKTtcclxuICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuZW5zdXJlQ2FudmFzKCk7XHJcbiAgICBjdHguY2xlYXJSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XHJcbiAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCIjOTk5XCIgOiBcIiM2NjZcIjtcclxuICAgIGN0eC5mb250ID0gXCIxNHB4IHNhbnMtc2VyaWZcIjtcclxuICAgIGN0eC50ZXh0QWxpZ24gPSBcImNlbnRlclwiO1xyXG4gICAgY29uc3QgbGluZXMgPSBtc2cuc3BsaXQoXCJcXG5cIik7XHJcbiAgICBsaW5lcy5mb3JFYWNoKChsaW5lLCBpbmRleCkgPT4ge1xyXG4gICAgICBjdHguZmlsbFRleHQobGluZSwgY2FudmFzLndpZHRoIC8gMiwgY2FudmFzLmhlaWdodCAvIDIgKyBpbmRleCAqIDIwKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzZXR1cEludGVyYWN0aW9uKCk6IHZvaWQge1xyXG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5lbnN1cmVDYW52YXMoKTtcclxuXHJcbiAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCAoZSkgPT4ge1xyXG4gICAgICBjb25zdCBub2RlID0gdGhpcy5oaXRUZXN0KGUub2Zmc2V0WCwgZS5vZmZzZXRZKTtcclxuICAgICAgaWYgKG5vZGUpIHtcclxuICAgICAgICB0aGlzLmRyYWdOb2RlID0gbm9kZTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmlzUGFubmluZyA9IHRydWU7XHJcbiAgICAgICAgdGhpcy5wYW5TdGFydCA9IHsgeDogZS5vZmZzZXRYLCB5OiBlLm9mZnNldFkgfTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLmxhc3RNb3VzZSA9IHsgeDogZS5vZmZzZXRYLCB5OiBlLm9mZnNldFkgfTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIChlKSA9PiB7XHJcbiAgICAgIGNvbnN0IGR4ID0gZS5vZmZzZXRYIC0gdGhpcy5sYXN0TW91c2UueDtcclxuICAgICAgY29uc3QgZHkgPSBlLm9mZnNldFkgLSB0aGlzLmxhc3RNb3VzZS55O1xyXG5cclxuICAgICAgaWYgKHRoaXMuZHJhZ05vZGUpIHtcclxuICAgICAgICB0aGlzLmRyYWdOb2RlLnggKz0gZHggLyB0aGlzLnNjYWxlO1xyXG4gICAgICAgIHRoaXMuZHJhZ05vZGUueSArPSBkeSAvIHRoaXMuc2NhbGU7XHJcbiAgICAgICAgdGhpcy5kcmFnTm9kZS52eCA9IDA7XHJcbiAgICAgICAgdGhpcy5kcmFnTm9kZS52eSA9IDA7XHJcbiAgICAgICAgaWYgKCF0aGlzLnNpbVJ1bm5pbmcpIHtcclxuICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzUGFubmluZykge1xyXG4gICAgICAgIHRoaXMub2Zmc2V0WCArPSBkeDtcclxuICAgICAgICB0aGlzLm9mZnNldFkgKz0gZHk7XHJcbiAgICAgICAgaWYgKCF0aGlzLnNpbVJ1bm5pbmcpIHtcclxuICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zdCBwcmV2aW91cyA9IHRoaXMuaG92ZXJlZE5vZGU7XHJcbiAgICAgICAgdGhpcy5ob3ZlcmVkTm9kZSA9IHRoaXMuaGl0VGVzdChlLm9mZnNldFgsIGUub2Zmc2V0WSk7XHJcbiAgICAgICAgY2FudmFzLnN0eWxlLmN1cnNvciA9IHRoaXMuaG92ZXJlZE5vZGUgPyBcInBvaW50ZXJcIiA6IFwiZGVmYXVsdFwiO1xyXG4gICAgICAgIGlmIChwcmV2aW91cyAhPT0gdGhpcy5ob3ZlcmVkTm9kZSAmJiAhdGhpcy5zaW1SdW5uaW5nKSB7XHJcbiAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5sYXN0TW91c2UgPSB7IHg6IGUub2Zmc2V0WCwgeTogZS5vZmZzZXRZIH07XHJcbiAgICB9KTtcclxuXHJcbiAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgKGUpID0+IHtcclxuICAgICAgaWYgKHRoaXMuZHJhZ05vZGUpIHtcclxuICAgICAgICBjb25zdCBkeCA9IE1hdGguYWJzKGUub2Zmc2V0WCAtIHRoaXMubGFzdE1vdXNlLngpO1xyXG4gICAgICAgIGNvbnN0IGR5ID0gTWF0aC5hYnMoZS5vZmZzZXRZIC0gdGhpcy5sYXN0TW91c2UueSk7XHJcbiAgICAgICAgaWYgKGR4IDwgMyAmJiBkeSA8IDMpIHtcclxuICAgICAgICAgIHRoaXMub3Blbk5vdGUodGhpcy5kcmFnTm9kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuZHJhZ05vZGUgPSBudWxsO1xyXG4gICAgICB0aGlzLmlzUGFubmluZyA9IGZhbHNlO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xyXG4gICAgICBjb25zdCBub2RlID0gdGhpcy5oaXRUZXN0KGUub2Zmc2V0WCwgZS5vZmZzZXRZKTtcclxuICAgICAgaWYgKCFub2RlKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChub2RlLl9jbHVzdGVySW5kZXggIT0gbnVsbCkge1xyXG4gICAgICAgIHZvaWQgdGhpcy5kcmlsbEludG9DbHVzdGVyKG5vZGUuX2NsdXN0ZXJJbmRleCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5vcGVuTm90ZShub2RlKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXHJcbiAgICAgIFwid2hlZWxcIixcclxuICAgICAgKGUpID0+IHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgY29uc3Qgem9vbSA9IGUuZGVsdGFZIDwgMCA/IDEuMSA6IDAuOTtcclxuICAgICAgICBjb25zdCBteCA9IGUub2Zmc2V0WDtcclxuICAgICAgICBjb25zdCBteSA9IGUub2Zmc2V0WTtcclxuICAgICAgICB0aGlzLm9mZnNldFggPSBteCAtIHpvb20gKiAobXggLSB0aGlzLm9mZnNldFgpO1xyXG4gICAgICAgIHRoaXMub2Zmc2V0WSA9IG15IC0gem9vbSAqIChteSAtIHRoaXMub2Zmc2V0WSk7XHJcbiAgICAgICAgdGhpcy5zY2FsZSA9IE1hdGgubWF4KDAuMiwgTWF0aC5taW4oNSwgdGhpcy5zY2FsZSAqIHpvb20pKTtcclxuICAgICAgICBpZiAoIXRoaXMuc2ltUnVubmluZykge1xyXG4gICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICB7IHBhc3NpdmU6IGZhbHNlIH1cclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhpdFRlc3QobXg6IG51bWJlciwgbXk6IG51bWJlcik6IEdyYXBoTm9kZSB8IG51bGwge1xyXG4gICAgY29uc3QgeCA9IChteCAtIHRoaXMub2Zmc2V0WCkgLyB0aGlzLnNjYWxlO1xyXG4gICAgY29uc3QgeSA9IChteSAtIHRoaXMub2Zmc2V0WSkgLyB0aGlzLnNjYWxlO1xyXG4gICAgZm9yIChsZXQgaSA9IHRoaXMubm9kZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgY29uc3QgbiA9IHRoaXMubm9kZXNbaV07XHJcbiAgICAgIGNvbnN0IGR4ID0geCAtIG4ueDtcclxuICAgICAgY29uc3QgZHkgPSB5IC0gbi55O1xyXG4gICAgICBpZiAoZHggKiBkeCArIGR5ICogZHkgPD0gKG4ucmFkaXVzICsgNCkgKiAobi5yYWRpdXMgKyA0KSkge1xyXG4gICAgICAgIHJldHVybiBuO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgb3Blbk5vdGUobm9kZTogR3JhcGhOb2RlKTogdm9pZCB7XHJcbiAgICBjb25zdCBmaWxlID0gdGhpcy5yZXNvbHZlRmlsZUZvck5vZGUobm9kZSk7XHJcbiAgICBpZiAoZmlsZSkge1xyXG4gICAgICB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKHRydWUpLm9wZW5GaWxlKGZpbGUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXNvbHZlRmlsZUZvck5vZGUobm9kZTogR3JhcGhOb2RlKSB7XHJcbiAgICBjb25zdCBjYW5kaWRhdGVzID0gW25vZGUucGF0aCwgbm9kZS5pZCwgYCR7bm9kZS5wYXRoID8/IFwiXCJ9Lm1kYCwgYCR7bm9kZS5pZH0ubWRgXVxyXG4gICAgICAuZmlsdGVyKChjYW5kaWRhdGUpOiBjYW5kaWRhdGUgaXMgc3RyaW5nID0+IEJvb2xlYW4oY2FuZGlkYXRlKSlcclxuICAgICAgLm1hcCgoY2FuZGlkYXRlKSA9PiBjYW5kaWRhdGUucmVwbGFjZSgvXlxcLysvLCBcIlwiKSk7XHJcblxyXG4gICAgZm9yIChjb25zdCBjYW5kaWRhdGUgb2YgY2FuZGlkYXRlcykge1xyXG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0RmlsZUJ5UGF0aChjYW5kaWRhdGUpO1xyXG4gICAgICBpZiAoZmlsZSkge1xyXG4gICAgICAgIHJldHVybiBmaWxlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZml0VG9WaWV3KCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMubm9kZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGxldCBtaW5YID0gSW5maW5pdHk7XHJcbiAgICBsZXQgbWF4WCA9IC1JbmZpbml0eTtcclxuICAgIGxldCBtaW5ZID0gSW5maW5pdHk7XHJcbiAgICBsZXQgbWF4WSA9IC1JbmZpbml0eTtcclxuICAgIGZvciAoY29uc3QgbiBvZiB0aGlzLm5vZGVzKSB7XHJcbiAgICAgIG1pblggPSBNYXRoLm1pbihtaW5YLCBuLnggLSBuLnJhZGl1cyk7XHJcbiAgICAgIG1heFggPSBNYXRoLm1heChtYXhYLCBuLnggKyBuLnJhZGl1cyk7XHJcbiAgICAgIG1pblkgPSBNYXRoLm1pbihtaW5ZLCBuLnkgLSBuLnJhZGl1cyk7XHJcbiAgICAgIG1heFkgPSBNYXRoLm1heChtYXhZLCBuLnkgKyBuLnJhZGl1cyk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBwYWQgPSA1MDtcclxuICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuZW5zdXJlQ2FudmFzKCk7XHJcbiAgICBjb25zdCB3ID0gY2FudmFzLndpZHRoO1xyXG4gICAgY29uc3QgaCA9IGNhbnZhcy5oZWlnaHQ7XHJcbiAgICBjb25zdCBndyA9IG1heFggLSBtaW5YICsgcGFkICogMjtcclxuICAgIGNvbnN0IGdoID0gbWF4WSAtIG1pblkgKyBwYWQgKiAyO1xyXG4gICAgdGhpcy5zY2FsZSA9IE1hdGgubWluKHcgLyBndywgaCAvIGdoLCAxLjgpO1xyXG4gICAgdGhpcy5vZmZzZXRYID0gdyAvIDIgLSAoKG1pblggKyBtYXhYKSAvIDIpICogdGhpcy5zY2FsZTtcclxuICAgIHRoaXMub2Zmc2V0WSA9IGggLyAyIC0gKChtaW5ZICsgbWF4WSkgLyAyKSAqIHRoaXMuc2NhbGU7XHJcbiAgICB0aGlzLmRyYXcoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVzaXplQ2FudmFzKCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmNhbnZhcykge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCByZWN0ID0gdGhpcy5jYW52YXMucGFyZW50RWxlbWVudD8uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICBpZiAoIXJlY3QpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jYW52YXMud2lkdGggPSByZWN0LndpZHRoO1xyXG4gICAgdGhpcy5jYW52YXMuaGVpZ2h0ID0gcmVjdC5oZWlnaHQ7XHJcbiAgICBpZiAoIXRoaXMuc2ltUnVubmluZykge1xyXG4gICAgICB0aGlzLmRyYXcoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2V0U3RhdHVzKHRleHQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuc3RhdHVzRWwpIHtcclxuICAgICAgdGhpcy5zdGF0dXNFbC50ZXh0Q29udGVudCA9IHRleHQ7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlckxlZ2VuZCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5sZWdlbmRFbCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5sZWdlbmRFbC5lbXB0eSgpO1xyXG4gICAgaWYgKHRoaXMudmlld01vZGUgIT09IFwibGluZWFnZVwiKSB7XHJcbiAgICAgIHRoaXMubGVnZW5kRWwuaGlkZSgpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5sZWdlbmRFbC5zaG93KCk7XHJcbiAgICBjb25zdCBpdGVtczogQXJyYXk8eyBrZXk6IExpbmVhZ2VSb2xlOyBsYWJlbDogc3RyaW5nIH0+ID0gW1xyXG4gICAgICB7IGtleTogXCJjZW50ZXJcIiwgbGFiZWw6IFwiQ2VudGVyXCIgfSxcclxuICAgICAgeyBrZXk6IFwidXBzdHJlYW1cIiwgbGFiZWw6IFwiVXBzdHJlYW1cIiB9LFxyXG4gICAgICB7IGtleTogXCJkb3duc3RyZWFtXCIsIGxhYmVsOiBcIkRvd25zdHJlYW1cIiB9LFxyXG4gICAgICB7IGtleTogXCJicmlkZ2VcIiwgbGFiZWw6IFwiQnJpZGdlXCIgfSxcclxuICAgIF07XHJcblxyXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XHJcbiAgICAgIGNvbnN0IGNoaXAgPSB0aGlzLmxlZ2VuZEVsLmNyZWF0ZURpdih7IGNsczogXCJtbmVtby1ncmFwaC1sZWdlbmQtY2hpcFwiIH0pO1xyXG4gICAgICBjb25zdCBkb3QgPSBjaGlwLmNyZWF0ZVNwYW4oeyBjbHM6IFwibW5lbW8tZ3JhcGgtbGVnZW5kLWRvdFwiIH0pO1xyXG4gICAgICBkb3Quc3R5bGUuYmFja2dyb3VuZENvbG9yID0gTElORUFHRV9DT0xPUlNbaXRlbS5rZXldO1xyXG4gICAgICBjaGlwLmNyZWF0ZVNwYW4oeyB0ZXh0OiBpdGVtLmxhYmVsIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG5vdGUgPSB0aGlzLmxlZ2VuZEVsLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIk5vZGUgY29yZSA9IGVudGl0eSB0eXBlID8gaGFsbyA9IGxpbmVhZ2Ugcm9sZVwiLCBjbHM6IFwibW5lbW8tZ3JhcGgtbGVnZW5kLW5vdGVcIiB9KTtcclxuICAgIG5vdGUuc2V0QXR0cihcInRpdGxlXCIsIFwiRW50aXR5IGNvbG9yIHN0YXlzIGluIHRoZSBub2RlIGNvcmU7IGxpbmVhZ2Ugcm9sZSBpcyBzaG93biBhcyBoYWxvL291dGxpbmVcIik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG5vcm1hbGl6ZUxpbmVhZ2VSb2xlKHJvbGU/OiBzdHJpbmcpOiBMaW5lYWdlUm9sZSB7XHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gKHJvbGUgPz8gXCJcIikudG9Mb3dlckNhc2UoKTtcclxuICAgIGlmIChub3JtYWxpemVkID09PSBcImNlbnRlclwiIHx8IG5vcm1hbGl6ZWQgPT09IFwidXBzdHJlYW1cIiB8fCBub3JtYWxpemVkID09PSBcImRvd25zdHJlYW1cIiB8fCBub3JtYWxpemVkID09PSBcImJyaWRnZVwiKSB7XHJcbiAgICAgIHJldHVybiBub3JtYWxpemVkO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFwidW5rbm93blwiO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwaWNrTGluZWFnZUVkZ2VSb2xlKGE6IEdyYXBoTm9kZSwgYjogR3JhcGhOb2RlKTogTGluZWFnZVJvbGUge1xyXG4gICAgaWYgKGEubGluZWFnZVJvbGUgPT09IFwiYnJpZGdlXCIgfHwgYi5saW5lYWdlUm9sZSA9PT0gXCJicmlkZ2VcIikge1xyXG4gICAgICByZXR1cm4gXCJicmlkZ2VcIjtcclxuICAgIH1cclxuICAgIGlmIChhLmxpbmVhZ2VSb2xlID09PSBcInVwc3RyZWFtXCIgfHwgYi5saW5lYWdlUm9sZSA9PT0gXCJ1cHN0cmVhbVwiKSB7XHJcbiAgICAgIHJldHVybiBcInVwc3RyZWFtXCI7XHJcbiAgICB9XHJcbiAgICBpZiAoYS5saW5lYWdlUm9sZSA9PT0gXCJkb3duc3RyZWFtXCIgfHwgYi5saW5lYWdlUm9sZSA9PT0gXCJkb3duc3RyZWFtXCIpIHtcclxuICAgICAgcmV0dXJuIFwiZG93bnN0cmVhbVwiO1xyXG4gICAgfVxyXG4gICAgaWYgKGEubGluZWFnZVJvbGUgPT09IFwiY2VudGVyXCIgfHwgYi5saW5lYWdlUm9sZSA9PT0gXCJjZW50ZXJcIikge1xyXG4gICAgICByZXR1cm4gXCJjZW50ZXJcIjtcclxuICAgIH1cclxuICAgIHJldHVybiBcInVua25vd25cIjtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbm9ybWFsaXplUGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHBhdGgucmVwbGFjZSgvXFwubWQkL2ksIFwiXCIpLnJlcGxhY2UoL15cXC8rLywgXCJcIik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG1hdGNoZXNQYXRoKGlkOiBzdHJpbmcsIHBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCwgY2FuZGlkYXRlczogc3RyaW5nW10pOiBib29sZWFuIHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWRDYW5kaWRhdGVzID0gY2FuZGlkYXRlcy5tYXAoKGNhbmRpZGF0ZSkgPT4gdGhpcy5ub3JtYWxpemVQYXRoKGNhbmRpZGF0ZSkpO1xyXG4gICAgcmV0dXJuIG5vcm1hbGl6ZWRDYW5kaWRhdGVzLmluY2x1ZGVzKHRoaXMubm9ybWFsaXplUGF0aChpZCkpXHJcbiAgICAgIHx8IChwYXRoID8gbm9ybWFsaXplZENhbmRpZGF0ZXMuaW5jbHVkZXModGhpcy5ub3JtYWxpemVQYXRoKHBhdGgpKSA6IGZhbHNlKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UmVxdWVzdGVkUGF0aChwYXRoPzogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGlmIChwYXRoKSB7XHJcbiAgICAgIHJldHVybiBwYXRoO1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMuY2VudGVyUGF0aCkge1xyXG4gICAgICByZXR1cm4gdGhpcy5jZW50ZXJQYXRoO1xyXG4gICAgfVxyXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XHJcbiAgICByZXR1cm4gZmlsZT8ucGF0aCA/PyBcIlwiO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXNldFZpZXdwb3J0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5vZmZzZXRYID0gMDtcclxuICAgIHRoaXMub2Zmc2V0WSA9IDA7XHJcbiAgICB0aGlzLnNjYWxlID0gMTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgd2l0aEFscGhhKGhleENvbG9yOiBzdHJpbmcsIGFscGhhOiBudW1iZXIpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgY29sb3IgPSBoZXhDb2xvci5yZXBsYWNlKFwiI1wiLCBcIlwiKTtcclxuICAgIGlmIChjb2xvci5sZW5ndGggIT09IDYpIHtcclxuICAgICAgcmV0dXJuIGhleENvbG9yO1xyXG4gICAgfVxyXG4gICAgY29uc3QgciA9IE51bWJlci5wYXJzZUludChjb2xvci5zbGljZSgwLCAyKSwgMTYpO1xyXG4gICAgY29uc3QgZyA9IE51bWJlci5wYXJzZUludChjb2xvci5zbGljZSgyLCA0KSwgMTYpO1xyXG4gICAgY29uc3QgYiA9IE51bWJlci5wYXJzZUludChjb2xvci5zbGljZSg0LCA2KSwgMTYpO1xyXG4gICAgcmV0dXJuIGByZ2JhKCR7cn0sICR7Z30sICR7Yn0sICR7YWxwaGF9KWA7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNhcGl0YWxpemUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdmFsdWUubGVuZ3RoID4gMCA/IGAke3ZhbHVlWzBdLnRvVXBwZXJDYXNlKCl9JHt2YWx1ZS5zbGljZSgxKX1gIDogdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGVuc3VyZUNhbnZhcygpOiBIVE1MQ2FudmFzRWxlbWVudCB7XHJcbiAgICBpZiAoIXRoaXMuY2FudmFzKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkdyYXBoIGNhbnZhcyBpcyBub3QgcmVhZHlcIik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5jYW52YXM7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGVuc3VyZUNvbnRleHQoKTogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIHtcclxuICAgIGlmICghdGhpcy5jdHgpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiR3JhcGggY2FudmFzIGNvbnRleHQgaXMgbm90IHJlYWR5XCIpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMuY3R4O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpc0RhcmtUaGVtZSgpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5jb250YWlucyhcInRoZW1lLWRhcmtcIik7XHJcbiAgfVxyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FB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LFdBQVcsUUFBUTtBQUFBLFFBQzVFLE9BQU87QUFDTCxjQUFJLHdCQUFPLG1HQUE0QztBQUFBLFFBQ3pEO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUVELFlBQVEsTUFBTSxpQ0FBaUM7QUFBQSxFQUNqRDtBQUFBLEVBRUEsV0FBaUI7QUFDZixZQUFRLE1BQU0sbUNBQW1DO0FBQUEsRUFDbkQ7QUFBQSxFQUVBLE1BQU0sZUFBOEI7QUFDbEMsVUFBTSxTQUFTLE1BQU0sS0FBSyxTQUFTO0FBQ25DLFNBQUssV0FBVyxPQUFPLE9BQU8sQ0FBQyxHQUFHLGtCQUFrQixNQUFNO0FBQUEsRUFDNUQ7QUFBQSxFQUVBLE1BQU0sZUFBOEI7QUFDbEMsVUFBTSxLQUFLLFNBQVMsS0FBSyxRQUFRO0FBQUEsRUFDbkM7QUFBQSxFQUVBLE1BQWMsZ0JBQStCO0FBQzNDLFVBQU0sV0FBVyxLQUFLLElBQUksVUFBVSxnQkFBZ0IscUJBQXFCO0FBQ3pFLFFBQUk7QUFDSixRQUFJLFNBQVMsU0FBUyxHQUFHO0FBQ3ZCLGFBQU8sU0FBUyxDQUFDO0FBQUEsSUFDbkIsT0FBTztBQUNMLGFBQU8sS0FBSyxJQUFJLFVBQVUsYUFBYSxLQUFLO0FBQzVDLFlBQU0sS0FBSyxhQUFhLEVBQUUsTUFBTSx1QkFBdUIsUUFBUSxLQUFLLENBQUM7QUFBQSxJQUN2RTtBQUNBLFVBQU0sS0FBSyxJQUFJLFVBQVUsV0FBVyxJQUFJO0FBR3hDLFVBQU0sT0FBTyxLQUFLLElBQUksVUFBVSxjQUFjO0FBQzlDLFFBQUksTUFBTTtBQUNSLFlBQU0sT0FBTyxLQUFLO0FBQ2xCLFdBQUssY0FBYyxLQUFLLElBQUk7QUFBQSxJQUM5QjtBQUFBLEVBQ0Y7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIl0KfQo=
