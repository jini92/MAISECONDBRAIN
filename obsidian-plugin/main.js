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
    if (typeof maybeWrapped === "object" && maybeWrapped != null && "code" in maybeWrapped && maybeWrapped.code === "ambiguous_node" && "candidates" in maybeWrapped && Array.isArray(maybeWrapped.candidates)) {
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
      const file = this.app.vault.getAbstractFileByPath(candidate);
      if (file instanceof import_obsidian4.TFile) {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2FwaS1jbGllbnQudHMiLCAic3JjL3NldHRpbmdzLnRzIiwgInNyYy9zZWFyY2gtbW9kYWwudHMiLCAic3JjL2dyYXBoLXZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIlx1RkVGRmltcG9ydCB7IFBsdWdpbiwgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBNbmVtb0FwaUNsaWVudCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcbmltcG9ydCB7IE1uZW1vU2V0dGluZ3MsIE1uZW1vU2V0dGluZ1RhYiwgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBNbmVtb1NlYXJjaE1vZGFsIH0gZnJvbSBcIi4vc2VhcmNoLW1vZGFsXCI7XG5pbXBvcnQgeyBNbmVtb0dyYXBoVmlldywgTU5FTU9fR1JBUEhfVklFV19UWVBFIH0gZnJvbSBcIi4vZ3JhcGgtdmlld1wiO1xuXG4vLyBNbmVtbyBTZWNvbmRCcmFpbiBPYnNpZGlhbiBQbHVnaW5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1uZW1vUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IE1uZW1vU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuICBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50ID0gbmV3IE1uZW1vQXBpQ2xpZW50KERFRkFVTFRfU0VUVElOR1MuYXBpVXJsKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFwaUNsaWVudC5zZXRCYXNlVXJsKHRoaXMuc2V0dGluZ3MuYXBpVXJsKTtcblxuICAgIC8vIFx1QzEyNFx1QzgxNSBcdUQwRUQgXHVCNEYxXHVCODVEIC8gUmVnaXN0ZXIgc2V0dGluZ3MgdGFiXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNbmVtb1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIC8vIFx1QjlBQ1x1QkNGOCBcdUM1NDRcdUM3NzRcdUNGNTggLyBSaWJib24gaWNvblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcImJyYWluXCIsIFwiTW5lbW8gc2VhcmNoXCIsICgpID0+IHtcbiAgICAgIG5ldyBNbmVtb1NlYXJjaE1vZGFsKHRoaXMuYXBwLCB0aGlzLmFwaUNsaWVudCwgdGhpcy5zZXR0aW5ncykub3BlbigpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1Q0VFNFx1QjlFOFx1QjREQyAvIFNlYXJjaCBjb21tYW5kXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLXNlYXJjaFwiLFxuICAgICAgbmFtZTogXCJNbmVtbzogc2VhcmNoXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICBuZXcgTW5lbW9TZWFyY2hNb2RhbCh0aGlzLmFwcCwgdGhpcy5hcGlDbGllbnQsIHRoaXMuc2V0dGluZ3MpLm9wZW4oKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBcdUFERjhcdUI3OThcdUQ1MDQgXHVCREYwIFx1QjRGMVx1Qjg1RCAvIFJlZ2lzdGVyIGdyYXBoIHZpZXdcbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhcbiAgICAgIE1ORU1PX0dSQVBIX1ZJRVdfVFlQRSxcbiAgICAgIChsZWFmKSA9PiBuZXcgTW5lbW9HcmFwaFZpZXcobGVhZiwgdGhpcy5hcGlDbGllbnQpXG4gICAgKTtcblxuICAgIC8vIFx1QURGOFx1Qjc5OFx1RDUwNCBcdUJERjAgXHVCOUFDXHVCQ0Y4IFx1QzU0NFx1Qzc3NFx1Q0Y1OFxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcImdpdC1mb3JrXCIsIFwiTW5lbW8gZ3JhcGhcIiwgKCkgPT4ge1xuICAgICAgdm9pZCB0aGlzLm9wZW5HcmFwaFZpZXcoKTtcbiAgICB9KTtcblxuICAgIC8vIFx1QURGOFx1Qjc5OFx1RDUwNCBcdUJERjAgXHVDNUY0XHVBRTMwIFx1Q0VFNFx1QjlFOFx1QjREQ1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJtbmVtby1vcGVuLWdyYXBoXCIsXG4gICAgICBuYW1lOiBcIk1uZW1vOiBvcGVuIGdyYXBoIHZpZXdcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7IHZvaWQgdGhpcy5vcGVuR3JhcGhWaWV3KCk7IH0sXG4gICAgfSk7XG5cbiAgICAvLyBcdUMxMUNcdUJDODQgXHVDMEMxXHVEMERDIFx1RDY1NVx1Qzc3OCAvIENoZWNrIHNlcnZlciBvbiBsb2FkXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLWNoZWNrLXN0YXR1c1wiLFxuICAgICAgbmFtZTogXCJNbmVtbzogY2hlY2sgc2VydmVyIHN0YXR1c1wiLFxuICAgICAgY2FsbGJhY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLmFwaUNsaWVudC5zdGF0cygpO1xuICAgICAgICBpZiAoc3RhdHMpIHtcbiAgICAgICAgICBuZXcgTm90aWNlKGBNbmVtbzogJHtzdGF0cy50b3RhbF9ub3Rlc30gbm90ZXMsICR7c3RhdHMudG90YWxfZWRnZXN9IGVkZ2VzYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3IE5vdGljZShcIk1uZW1vOiBcdUMxMUNcdUJDODRcdUM1RDAgXHVDNUYwXHVBQ0IwXHVENTYwIFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQgLyBzZXJ2ZXIgdW5yZWFjaGFibGVcIik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmRlYnVnKFwiTW5lbW8gU2Vjb25kQnJhaW4gcGx1Z2luIGxvYWRlZFwiKTtcbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIGNvbnNvbGUuZGVidWcoXCJNbmVtbyBTZWNvbmRCcmFpbiBwbHVnaW4gdW5sb2FkZWRcIik7XG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgbG9hZGVkID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpIGFzIFBhcnRpYWw8TW5lbW9TZXR0aW5ncz47XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGxvYWRlZCk7XG4gIH1cblxuICBhc3luYyBzYXZlU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgb3BlbkdyYXBoVmlldygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoTU5FTU9fR1JBUEhfVklFV19UWVBFKTtcbiAgICBsZXQgbGVhZjogaW1wb3J0KFwib2JzaWRpYW5cIikuV29ya3NwYWNlTGVhZjtcbiAgICBpZiAoZXhpc3RpbmcubGVuZ3RoID4gMCkge1xuICAgICAgbGVhZiA9IGV4aXN0aW5nWzBdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSkhO1xuICAgICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBNTkVNT19HUkFQSF9WSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG5cbiAgICAvLyBcdUQ2MDRcdUM3QUMgXHVCMTc4XHVEMkI4IFx1QUUzMFx1QzkwMFx1QzczQ1x1Qjg1QyBcdUFERjhcdUI3OThcdUQ1MDQgXHVCODVDXHVCNERDXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgaWYgKGZpbGUpIHtcbiAgICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXcgYXMgTW5lbW9HcmFwaFZpZXc7XG4gICAgICB2aWV3LnNldENlbnRlclBhdGgoZmlsZS5wYXRoKTtcbiAgICB9XG4gIH1cbn1cbiIsICJcdUZFRkZpbXBvcnQgeyByZXF1ZXN0VXJsIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG4vLyBNbmVtbyBBUEkgXHVBQzgwXHVDMEM5IFx1QUNCMFx1QUNGQyBcdUQwQzBcdUM3ODUgLyBTZWFyY2ggcmVzdWx0IHR5cGVcclxuZXhwb3J0IGludGVyZmFjZSBNbmVtb1NlYXJjaFJlc3VsdCB7XHJcbiAgbmFtZTogc3RyaW5nO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgc25pcHBldDogc3RyaW5nO1xyXG4gIHNjb3JlOiBudW1iZXI7XHJcbiAgZW50aXR5X3R5cGU/OiBzdHJpbmc7XHJcbiAgc291cmNlPzogc3RyaW5nO1xyXG4gIHBhdGg/OiBzdHJpbmc7XHJcbn1cclxuXHJcbi8vIE1uZW1vIFx1QzExQ1x1QkM4NCBcdUQxQjVcdUFDQzQgLyBTZXJ2ZXIgc3RhdHNcclxuZXhwb3J0IGludGVyZmFjZSBNbmVtb1N0YXRzIHtcclxuICB0b3RhbF9ub3RlczogbnVtYmVyO1xyXG4gIHRvdGFsX2VkZ2VzOiBudW1iZXI7XHJcbiAgaW5kZXhfc3RhdHVzOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgU3ViZ3JhcGhOb2RlIHtcclxuICBpZDogc3RyaW5nO1xyXG4gIG5hbWU6IHN0cmluZztcclxuICB0eXBlOiBzdHJpbmc7XHJcbiAgc2NvcmU/OiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgU3ViZ3JhcGhFZGdlIHtcclxuICBzb3VyY2U6IHN0cmluZztcclxuICB0YXJnZXQ6IHN0cmluZztcclxuICB0eXBlOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCB0eXBlIExpbmVhZ2VEaXJlY3Rpb24gPSBcInVwc3RyZWFtXCIgfCBcImRvd25zdHJlYW1cIiB8IFwiYm90aFwiO1xyXG5leHBvcnQgdHlwZSBMaW5lYWdlUm9sZSA9IFwiY2VudGVyXCIgfCBcInVwc3RyZWFtXCIgfCBcImRvd25zdHJlYW1cIiB8IFwiYnJpZGdlXCIgfCBcInVua25vd25cIjtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTGluZWFnZU5vZGUge1xyXG4gIGlkOiBzdHJpbmc7XHJcbiAgbmFtZTogc3RyaW5nO1xyXG4gIHBhdGg/OiBzdHJpbmc7XHJcbiAgZW50aXR5X3R5cGU/OiBzdHJpbmc7XHJcbiAgZGVwdGg6IG51bWJlcjtcclxuICBsaW5lYWdlX3JvbGU/OiBMaW5lYWdlUm9sZSB8IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBMaW5lYWdlRWRnZSB7XHJcbiAgc291cmNlOiBzdHJpbmc7XHJcbiAgdGFyZ2V0OiBzdHJpbmc7XHJcbiAgdHlwZTogc3RyaW5nO1xyXG4gIHdlaWdodD86IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBMaW5lYWdlQ2FuZGlkYXRlIHtcclxuICBpZDogc3RyaW5nO1xyXG4gIG5hbWU6IHN0cmluZztcclxuICBwYXRoOiBzdHJpbmc7XHJcbiAgZW50aXR5X3R5cGU6IHN0cmluZztcclxuICBtYXRjaF9raW5kOiBzdHJpbmc7XHJcbiAgc2NvcmU6IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBMaW5lYWdlQW1iaWd1b3VzRGV0YWlsIHtcclxuICBjb2RlOiBcImFtYmlndW91c19ub2RlXCI7XHJcbiAgcXVlcnk6IHN0cmluZztcclxuICBtZXNzYWdlOiBzdHJpbmc7XHJcbiAgY2FuZGlkYXRlczogTGluZWFnZUNhbmRpZGF0ZVtdO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIExpbmVhZ2VSZXNwb25zZSB7XHJcbiAgY2VudGVyOiBzdHJpbmc7XHJcbiAgZGlyZWN0aW9uOiBMaW5lYWdlRGlyZWN0aW9uIHwgc3RyaW5nO1xyXG4gIGRlcHRoOiBudW1iZXI7XHJcbiAgbm9kZXM6IExpbmVhZ2VOb2RlW107XHJcbiAgZWRnZXM6IExpbmVhZ2VFZGdlW107XHJcbn1cclxuXHJcbmV4cG9ydCB0eXBlIExpbmVhZ2VMb29rdXBSZXN1bHQgPVxyXG4gIHwgeyBraW5kOiBcIm9rXCI7IGRhdGE6IExpbmVhZ2VSZXNwb25zZSB9XHJcbiAgfCB7IGtpbmQ6IFwiYW1iaWd1b3VzXCI7IGRldGFpbDogTGluZWFnZUFtYmlndW91c0RldGFpbCB9O1xyXG5cclxuLy8gQVBJIFx1Qzc1MVx1QjJGNSBcdUIwQjRcdUJEODAgXHVEMEMwXHVDNzg1IC8gSW50ZXJuYWwgQVBJIHJlc3BvbnNlIHR5cGVzXHJcbmludGVyZmFjZSBSYXdTZWFyY2hSZXN1bHQge1xyXG4gIG5hbWU/OiBzdHJpbmc7XHJcbiAgdGl0bGU/OiBzdHJpbmc7XHJcbiAga2V5Pzogc3RyaW5nO1xyXG4gIHNuaXBwZXQ/OiBzdHJpbmc7XHJcbiAgc2NvcmU/OiBudW1iZXI7XHJcbiAgZW50aXR5X3R5cGU/OiBzdHJpbmc7XHJcbiAgc291cmNlPzogc3RyaW5nO1xyXG4gIHBhdGg/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmludGVyZmFjZSBTZWFyY2hBcGlSZXNwb25zZSB7XHJcbiAgcmVzdWx0cz86IFJhd1NlYXJjaFJlc3VsdFtdO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIENsdXN0ZXJJbmZvIHtcclxuICBpZDogc3RyaW5nO1xyXG4gIGh1Yl9uYW1lOiBzdHJpbmc7XHJcbiAgc2l6ZTogbnVtYmVyO1xyXG4gIGRvbWluYW50X3R5cGU6IHN0cmluZztcclxuICB4OiBudW1iZXI7XHJcbiAgeTogbnVtYmVyO1xyXG4gIGluZGV4OiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQ2x1c3RlcnNSZXNwb25zZSB7XHJcbiAgY2x1c3RlcnM6IENsdXN0ZXJJbmZvW107XHJcbiAgZWRnZXM/OiBBcnJheTx7IHNvdXJjZTogc3RyaW5nOyB0YXJnZXQ6IHN0cmluZyB9PjtcclxufVxyXG5cclxuLy8gXHVDMEFDXHVDODA0IFx1QUNDNFx1QzBCMFx1QjQxQyBcdUI4MDhcdUM3NzRcdUM1NDRcdUM2QzMgXHVDODhDXHVENDVDXHVCOTdDIFx1RDNFQ1x1RDU2OFx1RDU1QyBcdUIxNzhcdUI0REMgXHVEMEMwXHVDNzg1XHJcbmV4cG9ydCBpbnRlcmZhY2UgU3ViZ3JhcGhOb2RlV2l0aExheW91dCBleHRlbmRzIFN1YmdyYXBoTm9kZSB7XHJcbiAgZGVncmVlPzogbnVtYmVyO1xyXG4gIHg/OiBudW1iZXI7XHJcbiAgeT86IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIE1uZW1vQXBpQ2xpZW50IHtcclxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGJhc2VVcmw6IHN0cmluZykge31cclxuXHJcbiAgc2V0QmFzZVVybCh1cmw6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5iYXNlVXJsID0gdXJsLnJlcGxhY2UoL1xcLyskLywgXCJcIik7XHJcbiAgfVxyXG5cclxuICAvLyBcdUFDODBcdUMwQzkgQVBJIFx1RDYzOFx1Q0Q5QyAvIENhbGwgc2VhcmNoIEFQSVxyXG4gIGFzeW5jIHNlYXJjaChcclxuICAgIHF1ZXJ5OiBzdHJpbmcsXHJcbiAgICBtb2RlOiBzdHJpbmcgPSBcImh5YnJpZFwiLFxyXG4gICAgbGltaXQ6IG51bWJlciA9IDEwXHJcbiAgKTogUHJvbWlzZTxNbmVtb1NlYXJjaFJlc3VsdFtdPiB7XHJcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHsgcTogcXVlcnksIG1vZGUsIGxpbWl0OiBTdHJpbmcobGltaXQpIH0pO1xyXG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5iYXNlVXJsfS9zZWFyY2g/JHtwYXJhbXN9YDtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmwsIG1ldGhvZDogXCJHRVRcIiB9KTtcclxuICAgICAgY29uc3QgZGF0YSA9IHJlc3BvbnNlLmpzb24gYXMgU2VhcmNoQXBpUmVzcG9uc2UgfCBSYXdTZWFyY2hSZXN1bHRbXTtcclxuICAgICAgY29uc3QgcmF3UmVzdWx0czogUmF3U2VhcmNoUmVzdWx0W10gPSBBcnJheS5pc0FycmF5KGRhdGEpXHJcbiAgICAgICAgPyBkYXRhXHJcbiAgICAgICAgOiAoZGF0YS5yZXN1bHRzID8/IFtdKTtcclxuICAgICAgcmV0dXJuIHJhd1Jlc3VsdHMubWFwKChyOiBSYXdTZWFyY2hSZXN1bHQpOiBNbmVtb1NlYXJjaFJlc3VsdCA9PiAoe1xyXG4gICAgICAgIG5hbWU6IHIubmFtZSA/PyBcIlwiLFxyXG4gICAgICAgIHRpdGxlOiByLnRpdGxlIHx8IHIubmFtZSB8fCByLmtleSB8fCBcIlVudGl0bGVkXCIsXHJcbiAgICAgICAgc25pcHBldDogci5zbmlwcGV0ID8/IFwiXCIsXHJcbiAgICAgICAgc2NvcmU6IHIuc2NvcmUgPz8gMCxcclxuICAgICAgICBlbnRpdHlfdHlwZTogci5lbnRpdHlfdHlwZSxcclxuICAgICAgICBzb3VyY2U6IHIuc291cmNlLFxyXG4gICAgICAgIHBhdGg6IHIucGF0aCxcclxuICAgICAgfSkpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZXJyKTtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gXHVDMTFDXHVCQzg0IFx1QzBDMVx1RDBEQyBcdUQ2NTVcdUM3NzggLyBDaGVjayBzZXJ2ZXIgc3RhdHNcclxuICBhc3luYyBzdGF0cygpOiBQcm9taXNlPE1uZW1vU3RhdHMgfCBudWxsPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoe1xyXG4gICAgICAgIHVybDogYCR7dGhpcy5iYXNlVXJsfS9zdGF0c2AsXHJcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgTW5lbW9TdGF0cztcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICB0aGlzLmhhbmRsZUVycm9yKGVycik7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gXHVDMTFDXHVCRTBDXHVBREY4XHVCNzk4XHVENTA0IFx1Qzg3MFx1RDY4QyAvIEdldCBzdWJncmFwaCBmb3IgdmlzdWFsaXphdGlvblxyXG4gIGFzeW5jIHN1YmdyYXBoKFxyXG4gICAgY2VudGVyOiBzdHJpbmcsXHJcbiAgICBkZXB0aDogbnVtYmVyID0gMlxyXG4gICk6IFByb21pc2U8eyBub2RlczogU3ViZ3JhcGhOb2RlW107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSB9IHwgbnVsbD4ge1xyXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7IGNlbnRlciwgZGVwdGg6IFN0cmluZyhkZXB0aCkgfSk7XHJcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2dyYXBoL3N1YmdyYXBoPyR7cGFyYW1zfWA7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmwsIG1ldGhvZDogXCJHRVRcIiB9KTtcclxuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlW107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSB9O1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZXJyKTtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBcdUFDQzRcdUJDRjQgXHVBREY4XHVCNzk4XHVENTA0IFx1Qzg3MFx1RDY4QyAvIEdldCBsaW5lYWdlIGdyYXBoIGFyb3VuZCBhIG5vdGVcclxuICBhc3luYyBsaW5lYWdlKFxyXG4gICAgbm9kZTogc3RyaW5nLFxyXG4gICAgZGVwdGg6IG51bWJlciA9IDIsXHJcbiAgICBkaXJlY3Rpb246IExpbmVhZ2VEaXJlY3Rpb24gPSBcImJvdGhcIlxyXG4gICk6IFByb21pc2U8TGluZWFnZUxvb2t1cFJlc3VsdCB8IG51bGw+IHtcclxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xyXG4gICAgICBub2RlLFxyXG4gICAgICBkZXB0aDogU3RyaW5nKGRlcHRoKSxcclxuICAgICAgZGlyZWN0aW9uLFxyXG4gICAgfSk7XHJcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2dyYXBoL2xpbmVhZ2U/JHtwYXJhbXN9YDtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xyXG4gICAgICBjb25zdCBwYXlsb2FkID0gcmVzcG9uc2UuanNvbiBhcyBMaW5lYWdlUmVzcG9uc2UgfCB7IGRldGFpbD86IExpbmVhZ2VBbWJpZ3VvdXNEZXRhaWwgfSB8IExpbmVhZ2VBbWJpZ3VvdXNEZXRhaWw7XHJcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwOSkge1xyXG4gICAgICAgIGNvbnN0IGRldGFpbCA9IHRoaXMuZXh0cmFjdEFtYmlndW91c0RldGFpbChwYXlsb2FkKTtcclxuICAgICAgICBpZiAoZGV0YWlsKSB7XHJcbiAgICAgICAgICByZXR1cm4geyBraW5kOiBcImFtYmlndW91c1wiLCBkZXRhaWwgfTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHsga2luZDogXCJva1wiLCBkYXRhOiBwYXlsb2FkIGFzIExpbmVhZ2VSZXNwb25zZSB9O1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnN0IGRldGFpbCA9IHRoaXMudHJ5RXh0cmFjdEFtYmlndW91c0RldGFpbChlcnIpO1xyXG4gICAgICBpZiAoZGV0YWlsKSB7XHJcbiAgICAgICAgcmV0dXJuIHsga2luZDogXCJhbWJpZ3VvdXNcIiwgZGV0YWlsIH07XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFx1RDA3NFx1QjdFQ1x1QzJBNFx1RDEzMCBcdUFERjhcdUI3OThcdUQ1MDQgKFx1QUNDNFx1Q0UzNVx1QzgwMSBcdUQwRDBcdUMwQzkpIC8gQ2x1c3RlciBncmFwaCBmb3IgZHJpbGwtZG93blxyXG4gIGFzeW5jIGNsdXN0ZXJzKCk6IFByb21pc2U8Q2x1c3RlcnNSZXNwb25zZSB8IG51bGw+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybDogYCR7dGhpcy5iYXNlVXJsfS9ncmFwaC9jbHVzdGVyc2AsIG1ldGhvZDogXCJHRVRcIiB9KTtcclxuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgQ2x1c3RlcnNSZXNwb25zZTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICB0aGlzLmhhbmRsZUVycm9yKGVycik7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gXHVEMDc0XHVCN0VDXHVDMkE0XHVEMTMwIFx1QzBDMVx1QzEzOCAoZHJpbGwtZG93bikgLyBDbHVzdGVyIGRldGFpbFxyXG4gIGFzeW5jIGNsdXN0ZXJEZXRhaWwoaW5kZXg6IG51bWJlcik6IFByb21pc2U8eyBub2RlczogU3ViZ3JhcGhOb2RlV2l0aExheW91dFtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW10gfSB8IG51bGw+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybDogYCR7dGhpcy5iYXNlVXJsfS9ncmFwaC9jbHVzdGVyLyR7aW5kZXh9YCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xyXG4gICAgICByZXR1cm4gcmVzcG9uc2UuanNvbiBhcyB7IG5vZGVzOiBTdWJncmFwaE5vZGVXaXRoTGF5b3V0W107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSB9O1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZXJyKTtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBcdUM4MDRcdUNDQjQgXHVBREY4XHVCNzk4XHVENTA0IChcdUMwQUNcdUM4MDQgXHVBQ0M0XHVDMEIwIFx1QjgwOFx1Qzc3NFx1QzU0NFx1QzZDMykgLyBGdWxsIGdyYXBoIHdpdGggcHJlY29tcHV0ZWQgbGF5b3V0XHJcbiAgYXN5bmMgZnVsbEdyYXBoKCk6IFByb21pc2U8eyBub2RlczogU3ViZ3JhcGhOb2RlV2l0aExheW91dFtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW107IGxheW91dDogc3RyaW5nIH0gfCBudWxsPiB7XHJcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2dyYXBoL2Z1bGxgO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHsgdXJsLCBtZXRob2Q6IFwiR0VUXCIgfSk7XHJcbiAgICAgIHJldHVybiByZXNwb25zZS5qc29uIGFzIHsgbm9kZXM6IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXRbXTsgZWRnZXM6IFN1YmdyYXBoRWRnZVtdOyBsYXlvdXQ6IHN0cmluZyB9O1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZXJyKTtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBcdUM1RDBcdUI3RUMgXHVDQzk4XHVCOUFDIC8gRXJyb3IgaGFuZGxpbmcgd2l0aCBmcmllbmRseSBtZXNzYWdlc1xyXG4gIHByaXZhdGUgZXh0cmFjdEFtYmlndW91c0RldGFpbChcclxuICAgIHBheWxvYWQ6IExpbmVhZ2VSZXNwb25zZSB8IHsgZGV0YWlsPzogTGluZWFnZUFtYmlndW91c0RldGFpbCB9IHwgTGluZWFnZUFtYmlndW91c0RldGFpbFxyXG4gICk6IExpbmVhZ2VBbWJpZ3VvdXNEZXRhaWwgfCBudWxsIHtcclxuICAgIGlmICh0eXBlb2YgcGF5bG9hZCAhPT0gXCJvYmplY3RcIiB8fCBwYXlsb2FkID09IG51bGwpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgICBjb25zdCBtYXliZVdyYXBwZWQgPSBcImRldGFpbFwiIGluIHBheWxvYWQgJiYgcGF5bG9hZC5kZXRhaWwgPyBwYXlsb2FkLmRldGFpbCA6IHBheWxvYWQ7XHJcbiAgICBpZiAoXHJcbiAgICAgIHR5cGVvZiBtYXliZVdyYXBwZWQgPT09IFwib2JqZWN0XCJcclxuICAgICAgJiYgbWF5YmVXcmFwcGVkICE9IG51bGxcclxuICAgICAgJiYgXCJjb2RlXCIgaW4gbWF5YmVXcmFwcGVkXHJcbiAgICAgICYmIG1heWJlV3JhcHBlZC5jb2RlID09PSBcImFtYmlndW91c19ub2RlXCJcclxuICAgICAgJiYgXCJjYW5kaWRhdGVzXCIgaW4gbWF5YmVXcmFwcGVkXHJcbiAgICAgICYmIEFycmF5LmlzQXJyYXkobWF5YmVXcmFwcGVkLmNhbmRpZGF0ZXMpXHJcbiAgICApIHtcclxuICAgICAgcmV0dXJuIG1heWJlV3JhcHBlZCBhcyBMaW5lYWdlQW1iaWd1b3VzRGV0YWlsO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRyeUV4dHJhY3RBbWJpZ3VvdXNEZXRhaWwoZXJyOiB1bmtub3duKTogTGluZWFnZUFtYmlndW91c0RldGFpbCB8IG51bGwge1xyXG4gICAgaWYgKHR5cGVvZiBlcnIgIT09IFwib2JqZWN0XCIgfHwgZXJyID09IG51bGwpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgd2l0aFRleHQgPSBlcnIgYXMgeyB0ZXh0Pzogc3RyaW5nOyBzdGF0dXM/OiBudW1iZXI7IHJlc3BvbnNlPzogeyB0ZXh0Pzogc3RyaW5nOyBzdGF0dXM/OiBudW1iZXIgfSB9O1xyXG4gICAgY29uc3QgdGV4dCA9IHdpdGhUZXh0LnRleHQgPz8gd2l0aFRleHQucmVzcG9uc2U/LnRleHQ7XHJcbiAgICBjb25zdCBzdGF0dXMgPSB3aXRoVGV4dC5zdGF0dXMgPz8gd2l0aFRleHQucmVzcG9uc2U/LnN0YXR1cztcclxuICAgIGlmIChzdGF0dXMgIT09IDQwOSB8fCAhdGV4dCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBMaW5lYWdlUmVzcG9uc2UgfCB7IGRldGFpbD86IExpbmVhZ2VBbWJpZ3VvdXNEZXRhaWwgfSB8IExpbmVhZ2VBbWJpZ3VvdXNEZXRhaWw7XHJcbiAgICAgIHJldHVybiB0aGlzLmV4dHJhY3RBbWJpZ3VvdXNEZXRhaWwocGF5bG9hZCk7XHJcbiAgICB9IGNhdGNoIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZUVycm9yKGVycjogdW5rbm93bik6IHZvaWQge1xyXG4gICAgY29uc3QgbXNnID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpO1xyXG4gICAgaWYgKG1zZy5pbmNsdWRlcyhcIkVDT05OUkVGVVNFRFwiKSB8fCBtc2cuaW5jbHVkZXMoXCJuZXQ6OkVSUlwiKSkge1xyXG4gICAgICBjb25zb2xlLmVycm9yKFxyXG4gICAgICAgIGBbTW5lbW9dIFx1QzExQ1x1QkM4NFx1QzVEMCBcdUM1RjBcdUFDQjBcdUQ1NjAgXHVDMjE4IFx1QzVDNlx1QzJCNVx1QjJDOFx1QjJFNC4gTW5lbW8gXHVDMTFDXHVCQzg0XHVBQzAwIFx1QzJFNFx1RDU4OSBcdUM5MTFcdUM3NzhcdUM5QzAgXHVENjU1XHVDNzc4XHVENTU4XHVDMTM4XHVDNjk0LlxcbmAgK1xyXG4gICAgICAgICAgYENhbm5vdCBjb25uZWN0IHRvIE1uZW1vIHNlcnZlciBhdCAke3RoaXMuYmFzZVVybH0uIElzIGl0IHJ1bm5pbmc/YFxyXG4gICAgICApO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgW01uZW1vXSBBUEkgZXJyb3I6ICR7bXNnfWApO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iLCAiXHVGRUZGaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBNbmVtb1BsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5cbi8vIFx1RDUwQ1x1QjdFQ1x1QURGOFx1Qzc3OCBcdUMxMjRcdUM4MTUgXHVDNzc4XHVEMTMwXHVEMzk4XHVDNzc0XHVDMkE0IC8gUGx1Z2luIHNldHRpbmdzIGludGVyZmFjZVxuZXhwb3J0IGludGVyZmFjZSBNbmVtb1NldHRpbmdzIHtcbiAgYXBpVXJsOiBzdHJpbmc7XG4gIHNlYXJjaExpbWl0OiBudW1iZXI7XG4gIHNlYXJjaE1vZGU6IFwiaHlicmlkXCIgfCBcInZlY3RvclwiIHwgXCJrZXl3b3JkXCIgfCBcImdyYXBoXCI7XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBNbmVtb1NldHRpbmdzID0ge1xuICBhcGlVcmw6IFwiaHR0cDovLzEyNy4wLjAuMTo4MDAwXCIsXG4gIHNlYXJjaExpbWl0OiAxMCxcbiAgc2VhcmNoTW9kZTogXCJoeWJyaWRcIixcbn07XG5cbi8vIFx1QzEyNFx1QzgxNSBcdUQwRUQgLyBTZXR0aW5ncyB0YWJcbmV4cG9ydCBjbGFzcyBNbmVtb1NldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgcGx1Z2luOiBNbmVtb1BsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBNbmVtb1BsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgLy8gQVBJIFVSTCBcdUMxMjRcdUM4MTVcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiTW5lbW8gQVBJIFVSTFwiKVxuICAgICAgLnNldERlc2MoXCJNbmVtbyBGYXN0QVBJIHNlcnZlciBhZGRyZXNzIChkZWZhdWx0OiBodHRwOi8vMTI3LjAuMC4xOjgwMDApXCIpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcImh0dHA6Ly8xMjcuMC4wLjE6ODAwMFwiKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlVcmwpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpVXJsID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5hcGlDbGllbnQuc2V0QmFzZVVybCh2YWx1ZSk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIC8vIFx1QUM4MFx1QzBDOSBcdUFDQjBcdUFDRkMgXHVDMjE4XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlNlYXJjaCByZXN1bHQgbGltaXRcIilcbiAgICAgIC5zZXREZXNjKFwiTWF4aW11bSBudW1iZXIgb2Ygc2VhcmNoIHJlc3VsdHMgdG8gc2hvd1wiKVxuICAgICAgLmFkZFNsaWRlcigoc2xpZGVyKSA9PlxuICAgICAgICBzbGlkZXJcbiAgICAgICAgICAuc2V0TGltaXRzKDUsIDUwLCA1KVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zZWFyY2hMaW1pdClcbiAgICAgICAgICAuc2V0RHluYW1pY1Rvb2x0aXAoKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNlYXJjaExpbWl0ID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIC8vIFx1QUM4MFx1QzBDOSBcdUJBQThcdUI0RENcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiU2VhcmNoIG1vZGVcIilcbiAgICAgIC5zZXREZXNjKFwiU2VsZWN0IHRoZSBzZWFyY2ggbWV0aG9kIHRvIHVzZVwiKVxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cbiAgICAgICAgZHJvcGRvd25cbiAgICAgICAgICAuYWRkT3B0aW9ucyh7XG4gICAgICAgICAgICBoeWJyaWQ6IFwiSHlicmlkIChrZXl3b3JkICsgdmVjdG9yKVwiLFxuICAgICAgICAgICAgdmVjdG9yOiBcIlZlY3RvciAoc2VtYW50aWMpXCIsXG4gICAgICAgICAgICBrZXl3b3JkOiBcIktleXdvcmQgKEJNMjUpXCIsXG4gICAgICAgICAgICBncmFwaDogXCJHcmFwaCAocmVsYXRpb25zaGlwKVwiLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNlYXJjaE1vZGUpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTW9kZSA9IHZhbHVlIGFzIE1uZW1vU2V0dGluZ3NbXCJzZWFyY2hNb2RlXCJdO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG4gIH1cbn1cbiIsICJcdUZFRkZpbXBvcnQgeyBBcHAsIFN1Z2dlc3RNb2RhbCwgTm90aWNlLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgeyBNbmVtb0FwaUNsaWVudCwgTW5lbW9TZWFyY2hSZXN1bHQgfSBmcm9tIFwiLi9hcGktY2xpZW50XCI7XG5pbXBvcnQgdHlwZSB7IE1uZW1vU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xuXG4vLyBNbmVtbyBcdUFDODBcdUMwQzkgXHVCQUE4XHVCMkVDIC8gU2VhcmNoIG1vZGFsXG5leHBvcnQgY2xhc3MgTW5lbW9TZWFyY2hNb2RhbCBleHRlbmRzIFN1Z2dlc3RNb2RhbDxNbmVtb1NlYXJjaFJlc3VsdD4ge1xuICBwcml2YXRlIHJlc3VsdHM6IE1uZW1vU2VhcmNoUmVzdWx0W10gPSBbXTtcbiAgcHJpdmF0ZSBkZWJvdW5jZVRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgYXBpQ2xpZW50OiBNbmVtb0FwaUNsaWVudCxcbiAgICBwcml2YXRlIHNldHRpbmdzOiBNbmVtb1NldHRpbmdzXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcihcIk1uZW1vIHNlYXJjaC4uLlwiKTtcbiAgfVxuXG4gIGFzeW5jIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBQcm9taXNlPE1uZW1vU2VhcmNoUmVzdWx0W10+IHtcbiAgICBpZiAoIXF1ZXJ5IHx8IHF1ZXJ5Lmxlbmd0aCA8IDIpIHJldHVybiBbXTtcblxuICAgIC8vIFx1QjUxNFx1QkMxNFx1QzZCNFx1QzJBNCAzMDBtcyAvIERlYm91bmNlIGlucHV0XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICBpZiAodGhpcy5kZWJvdW5jZVRpbWVyKSBjbGVhclRpbWVvdXQodGhpcy5kZWJvdW5jZVRpbWVyKTtcbiAgICAgIHRoaXMuZGVib3VuY2VUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB2b2lkIHRoaXMuYXBpQ2xpZW50LnNlYXJjaChxdWVyeSwgdGhpcy5zZXR0aW5ncy5zZWFyY2hNb2RlLCB0aGlzLnNldHRpbmdzLnNlYXJjaExpbWl0KVxuICAgICAgICAgIC50aGVuKChyZXN1bHRzKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xuICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJlc3VsdHMpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSwgMzAwKTtcbiAgICB9KTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24ocmVzdWx0OiBNbmVtb1NlYXJjaFJlc3VsdCwgZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgY29uc3QgY29udGFpbmVyID0gZWwuY3JlYXRlRGl2KHsgY2xzOiBcIm1uZW1vLXNlYXJjaC1yZXN1bHRcIiB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwge1xuICAgICAgdGV4dDogcmVzdWx0LnRpdGxlLFxuICAgICAgY2xzOiBcIm1uZW1vLXJlc3VsdC10aXRsZVwiLFxuICAgIH0pO1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcInNtYWxsXCIsIHtcbiAgICAgIHRleHQ6IHJlc3VsdC5zbmlwcGV0LFxuICAgICAgY2xzOiBcIm1uZW1vLXJlc3VsdC1zbmlwcGV0XCIsXG4gICAgfSk7XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwic3BhblwiLCB7XG4gICAgICB0ZXh0OiBgc2NvcmU6ICR7cmVzdWx0LnNjb3JlLnRvRml4ZWQoMyl9YCxcbiAgICAgIGNsczogXCJtbmVtby1yZXN1bHQtc2NvcmVcIixcbiAgICB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihyZXN1bHQ6IE1uZW1vU2VhcmNoUmVzdWx0KTogdm9pZCB7XG4gICAgLy8gXHVCQ0ZDXHVEMkI4XHVDNUQwXHVDMTFDIFx1RDU3NFx1QjJGOSBcdUIxNzhcdUQyQjggXHVDNUY0XHVBRTMwIC8gT3BlbiBtYXRjaGluZyBub3RlIGluIHZhdWx0XG4gICAgbGV0IHBhdGggPSByZXN1bHQucGF0aCB8fCBgJHtyZXN1bHQudGl0bGV9Lm1kYDtcbiAgICBpZiAoIXBhdGguZW5kc1dpdGgoXCIubWRcIikpIHBhdGggKz0gXCIubWRcIjtcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xuXG4gICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgdm9pZCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZigpLm9wZW5GaWxlKGZpbGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXcgTm90aWNlKGBcdUIxNzhcdUQyQjhcdUI5N0MgXHVDQzNFXHVDNzQ0IFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQ6ICR7cmVzdWx0LnRpdGxlfVxcbk5vdGUgbm90IGZvdW5kIGluIHZhdWx0LmApO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBOb3RpY2UsIFN1Z2dlc3RNb2RhbCwgVEZpbGUsIFdvcmtzcGFjZUxlYWYgfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuaW1wb3J0IHR5cGUge1xyXG4gIENsdXN0ZXJJbmZvLFxyXG4gIExpbmVhZ2VBbWJpZ3VvdXNEZXRhaWwsXHJcbiAgTGluZWFnZUNhbmRpZGF0ZSxcclxuICBMaW5lYWdlUmVzcG9uc2UsXHJcbiAgTW5lbW9BcGlDbGllbnQsXHJcbiAgU3ViZ3JhcGhFZGdlLFxyXG4gIFN1YmdyYXBoTm9kZSxcclxuICBTdWJncmFwaE5vZGVXaXRoTGF5b3V0LFxyXG59IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcclxuXHJcbmV4cG9ydCBjb25zdCBNTkVNT19HUkFQSF9WSUVXX1RZUEUgPSBcIm1uZW1vLWdyYXBoLXZpZXdcIjtcclxuXHJcbmNvbnN0IFRZUEVfQ09MT1JTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xyXG4gIGV2ZW50OiBcIiM0QTkwRDlcIixcclxuICBwcm9qZWN0OiBcIiNFODkxM0FcIixcclxuICBub3RlOiBcIiM1MEM4NzhcIixcclxuICBzb3VyY2U6IFwiIzlCNTlCNlwiLFxyXG4gIGRlY2lzaW9uOiBcIiNFNzRDM0NcIixcclxuICBpbnNpZ2h0OiBcIiNGMUM0MEZcIixcclxuICB0b29sOiBcIiMxNkEwODVcIixcclxuICBjb25jZXB0OiBcIiM1QzdDRkFcIixcclxuICBwZXJzb246IFwiI0VDNDg5OVwiLFxyXG4gIHVua25vd246IFwiIzg4ODg4OFwiLFxyXG59O1xyXG5jb25zdCBERUZBVUxUX0NPTE9SID0gXCIjODg4ODg4XCI7XHJcblxyXG5jb25zdCBMSU5FQUdFX0NPTE9SUyA9IHtcclxuICBjZW50ZXI6IFwiI0IzODhGRlwiLFxyXG4gIHVwc3RyZWFtOiBcIiNGNUIzNDJcIixcclxuICBkb3duc3RyZWFtOiBcIiM0REQwRTFcIixcclxuICBicmlkZ2U6IFwiIzdDM0FFRFwiLFxyXG4gIHVua25vd246IFwiIzhBOEY5OFwiLFxyXG59IGFzIGNvbnN0O1xyXG5cclxudHlwZSBHcmFwaFZpZXdNb2RlID0gXCJsaW5lYWdlXCIgfCBcImxvY2FsXCIgfCBcImZ1bGxcIiB8IFwiY2x1c3RlclwiO1xyXG50eXBlIExpbmVhZ2VSb2xlID0ga2V5b2YgdHlwZW9mIExJTkVBR0VfQ09MT1JTO1xyXG5cclxuaW50ZXJmYWNlIEdyYXBoTm9kZSB7XHJcbiAgaWQ6IHN0cmluZztcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgdHlwZTogc3RyaW5nO1xyXG4gIHNjb3JlPzogbnVtYmVyO1xyXG4gIHBhdGg/OiBzdHJpbmc7XHJcbiAgeDogbnVtYmVyO1xyXG4gIHk6IG51bWJlcjtcclxuICB2eDogbnVtYmVyO1xyXG4gIHZ5OiBudW1iZXI7XHJcbiAgcmFkaXVzOiBudW1iZXI7XHJcbiAgaXNDZW50ZXI6IGJvb2xlYW47XHJcbiAgbGluZWFnZVJvbGU/OiBMaW5lYWdlUm9sZTtcclxuICBsaW5lYWdlRGVwdGg/OiBudW1iZXI7XHJcbiAgX2NsdXN0ZXJJbmRleD86IG51bWJlcjtcclxufVxyXG5cclxuaW50ZXJmYWNlIEdyYXBoRWRnZSB7XHJcbiAgc291cmNlOiBzdHJpbmc7XHJcbiAgdGFyZ2V0OiBzdHJpbmc7XHJcbiAgdHlwZTogc3RyaW5nO1xyXG4gIHdlaWdodD86IG51bWJlcjtcclxufVxyXG5cclxuY2xhc3MgTGluZWFnZUNhbmRpZGF0ZU1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPExpbmVhZ2VDYW5kaWRhdGU+IHtcclxuICBwcml2YXRlIHJlc29sdmVyOiAoKGNhbmRpZGF0ZTogTGluZWFnZUNhbmRpZGF0ZSB8IG51bGwpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBzZXR0bGVkID0gZmFsc2U7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgYXBwOiBJdGVtVmlld1tcImFwcFwiXSxcclxuICAgIHByaXZhdGUgcmVhZG9ubHkgZGV0YWlsOiBMaW5lYWdlQW1iaWd1b3VzRGV0YWlsXHJcbiAgKSB7XHJcbiAgICBzdXBlcihhcHApO1xyXG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcihgQ2hvb3NlIGxpbmVhZ2UgdGFyZ2V0IGZvciBcIiR7ZGV0YWlsLnF1ZXJ5fVwiYCk7XHJcbiAgICB0aGlzLnNldEluc3RydWN0aW9ucyhbXHJcbiAgICAgIHsgY29tbWFuZDogXCI/P1wiLCBwdXJwb3NlOiBcIm1vdmVcIiB9LFxyXG4gICAgICB7IGNvbW1hbmQ6IFwiP1wiLCBwdXJwb3NlOiBcInNlbGVjdFwiIH0sXHJcbiAgICAgIHsgY29tbWFuZDogXCJlc2NcIiwgcHVycG9zZTogXCJjYW5jZWxcIiB9LFxyXG4gICAgXSk7XHJcbiAgfVxyXG5cclxuICBwaWNrKCk6IFByb21pc2U8TGluZWFnZUNhbmRpZGF0ZSB8IG51bGw+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICB0aGlzLnJlc29sdmVyID0gcmVzb2x2ZTtcclxuICAgICAgdGhpcy5vcGVuKCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBMaW5lYWdlQ2FuZGlkYXRlW10ge1xyXG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IHF1ZXJ5LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgaWYgKCFub3JtYWxpemVkKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmRldGFpbC5jYW5kaWRhdGVzO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMuZGV0YWlsLmNhbmRpZGF0ZXMuZmlsdGVyKChjYW5kaWRhdGUpID0+IHtcclxuICAgICAgY29uc3QgaGF5c3RhY2tzID0gW2NhbmRpZGF0ZS5uYW1lLCBjYW5kaWRhdGUucGF0aCwgY2FuZGlkYXRlLmVudGl0eV90eXBlLCBjYW5kaWRhdGUubWF0Y2hfa2luZF1cclxuICAgICAgICAubWFwKCh2YWx1ZSkgPT4gdmFsdWUudG9Mb3dlckNhc2UoKSk7XHJcbiAgICAgIHJldHVybiBoYXlzdGFja3Muc29tZSgodmFsdWUpID0+IHZhbHVlLmluY2x1ZGVzKG5vcm1hbGl6ZWQpKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmVuZGVyU3VnZ2VzdGlvbihjYW5kaWRhdGU6IExpbmVhZ2VDYW5kaWRhdGUsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFpbmVyID0gZWwuY3JlYXRlRGl2KHsgY2xzOiBcIm1uZW1vLWxpbmVhZ2UtY2FuZGlkYXRlXCIgfSk7XHJcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyB0ZXh0OiBjYW5kaWRhdGUubmFtZSwgY2xzOiBcIm1uZW1vLWxpbmVhZ2UtY2FuZGlkYXRlLXRpdGxlXCIgfSk7XHJcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJzbWFsbFwiLCB7XHJcbiAgICAgIHRleHQ6IGAke2NhbmRpZGF0ZS5lbnRpdHlfdHlwZX0gPyAke2NhbmRpZGF0ZS5tYXRjaF9raW5kfSA/IHNjb3JlICR7Y2FuZGlkYXRlLnNjb3JlfWAsXHJcbiAgICAgIGNsczogXCJtbmVtby1saW5lYWdlLWNhbmRpZGF0ZS1tZXRhXCIsXHJcbiAgICB9KTtcclxuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IHRleHQ6IGNhbmRpZGF0ZS5wYXRoLCBjbHM6IFwibW5lbW8tbGluZWFnZS1jYW5kaWRhdGUtcGF0aFwiIH0pO1xyXG4gIH1cclxuXHJcbiAgb25DaG9vc2VTdWdnZXN0aW9uKGNhbmRpZGF0ZTogTGluZWFnZUNhbmRpZGF0ZSk6IHZvaWQge1xyXG4gICAgdGhpcy5zZXR0bGVkID0gdHJ1ZTtcclxuICAgIHRoaXMucmVzb2x2ZXI/LihjYW5kaWRhdGUpO1xyXG4gICAgdGhpcy5yZXNvbHZlciA9IG51bGw7XHJcbiAgfVxyXG5cclxuICBvdmVycmlkZSBvbkNsb3NlKCk6IHZvaWQge1xyXG4gICAgc3VwZXIub25DbG9zZSgpO1xyXG4gICAgaWYgKCF0aGlzLnNldHRsZWQpIHtcclxuICAgICAgdGhpcy5yZXNvbHZlcj8uKG51bGwpO1xyXG4gICAgICB0aGlzLnJlc29sdmVyID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBNbmVtb0dyYXBoVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcclxuICBwcml2YXRlIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBub2RlczogR3JhcGhOb2RlW10gPSBbXTtcclxuICBwcml2YXRlIGVkZ2VzOiBHcmFwaEVkZ2VbXSA9IFtdO1xyXG4gIHByaXZhdGUgbm9kZU1hcDogTWFwPHN0cmluZywgR3JhcGhOb2RlPiA9IG5ldyBNYXAoKTtcclxuXHJcbiAgcHJpdmF0ZSBvZmZzZXRYID0gMDtcclxuICBwcml2YXRlIG9mZnNldFkgPSAwO1xyXG4gIHByaXZhdGUgc2NhbGUgPSAxO1xyXG5cclxuICBwcml2YXRlIGRyYWdOb2RlOiBHcmFwaE5vZGUgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGlzUGFubmluZyA9IGZhbHNlO1xyXG4gIHByaXZhdGUgcGFuU3RhcnQgPSB7IHg6IDAsIHk6IDAgfTtcclxuICBwcml2YXRlIGxhc3RNb3VzZSA9IHsgeDogMCwgeTogMCB9O1xyXG4gIHByaXZhdGUgaG92ZXJlZE5vZGU6IEdyYXBoTm9kZSB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgYW5pbUZyYW1lID0gMDtcclxuICBwcml2YXRlIHNpbVJ1bm5pbmcgPSBmYWxzZTtcclxuICBwcml2YXRlIHNpbUl0ZXJhdGlvbnMgPSAwO1xyXG5cclxuICBwcml2YXRlIGNlbnRlclBhdGggPSBcIlwiO1xyXG4gIHByaXZhdGUgdmlld01vZGU6IEdyYXBoVmlld01vZGUgPSBcImxpbmVhZ2VcIjtcclxuICBwcml2YXRlIGNsdXN0ZXJEYXRhOiBDbHVzdGVySW5mb1tdID0gW107XHJcbiAgcHJpdmF0ZSBiYWNrQnRuOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgYWxsQnRuczogSFRNTEVsZW1lbnRbXSA9IFtdO1xyXG4gIHByaXZhdGUgc3RhdHVzRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBsZWdlbmRFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuXHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBsZWFmOiBXb3Jrc3BhY2VMZWFmLFxyXG4gICAgcHJpdmF0ZSBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50XHJcbiAgKSB7XHJcbiAgICBzdXBlcihsZWFmKTtcclxuICB9XHJcblxyXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gTU5FTU9fR1JBUEhfVklFV19UWVBFO1xyXG4gIH1cclxuXHJcbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiBcIk1uZW1vIGdyYXBoXCI7XHJcbiAgfVxyXG5cclxuICBnZXRJY29uKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gXCJnaXQtZm9ya1wiO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXSBhcyBIVE1MRWxlbWVudDtcclxuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xyXG4gICAgY29udGFpbmVyLmFkZENsYXNzKFwibW5lbW8tZ3JhcGgtY29udGFpbmVyXCIpO1xyXG5cclxuICAgIGNvbnN0IHRvb2xiYXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcIm1uZW1vLWdyYXBoLXRvb2xiYXJcIiB9KTtcclxuICAgIHRvb2xiYXIuY3JlYXRlRWwoXCJzcGFuXCIsIHsgdGV4dDogXCJNbmVtbyBncmFwaFwiLCBjbHM6IFwibW5lbW8tZ3JhcGgtdGl0bGVcIiB9KTtcclxuXHJcbiAgICBjb25zdCBsaW5lYWdlQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7XHJcbiAgICAgIHRleHQ6IFwiXHVEODNFXHVEREVDIGxpbmVhZ2VcIixcclxuICAgICAgY2xzOiBcIm1uZW1vLWdyYXBoLWJ0biBtbmVtby1ncmFwaC1idG4tYWN0aXZlXCIsXHJcbiAgICAgIGF0dHI6IHsgdGl0bGU6IFwiQ3VycmVudCBub3RlIGxpbmVhZ2VcIiB9LFxyXG4gICAgfSk7XHJcbiAgICBsaW5lYWdlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMuc2V0QWN0aXZlQnRuKGxpbmVhZ2VCdG4pO1xyXG4gICAgICB0aGlzLnZpZXdNb2RlID0gXCJsaW5lYWdlXCI7XHJcbiAgICAgIHZvaWQgdGhpcy5sb2FkTGluZWFnZSgpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgbG9jYWxCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcclxuICAgICAgdGV4dDogXCJcdUQ4M0RcdURDQ0QgbG9jYWxcIixcclxuICAgICAgY2xzOiBcIm1uZW1vLWdyYXBoLWJ0blwiLFxyXG4gICAgICBhdHRyOiB7IHRpdGxlOiBcIkN1cnJlbnQgbm90ZSBuZWlnaGJvcmhvb2RcIiB9LFxyXG4gICAgfSk7XHJcbiAgICBsb2NhbEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICB0aGlzLnNldEFjdGl2ZUJ0bihsb2NhbEJ0bik7XHJcbiAgICAgIHRoaXMudmlld01vZGUgPSBcImxvY2FsXCI7XHJcbiAgICAgIHZvaWQgdGhpcy5sb2FkR3JhcGgoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGNsdXN0ZXJCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcclxuICAgICAgdGV4dDogXCJcdUQ4M0RcdUREMkUgZXhwbG9yZVwiLFxyXG4gICAgICBjbHM6IFwibW5lbW8tZ3JhcGgtYnRuXCIsXHJcbiAgICAgIGF0dHI6IHsgdGl0bGU6IFwiRXhwbG9yZSBieSBjbHVzdGVyc1wiIH0sXHJcbiAgICB9KTtcclxuICAgIGNsdXN0ZXJCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgdGhpcy5zZXRBY3RpdmVCdG4oY2x1c3RlckJ0bik7XHJcbiAgICAgIHRoaXMudmlld01vZGUgPSBcImNsdXN0ZXJcIjtcclxuICAgICAgdm9pZCB0aGlzLmxvYWRDbHVzdGVycygpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZnVsbEJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwge1xyXG4gICAgICB0ZXh0OiBcIlx1RDgzQ1x1REYxMCBmdWxsXCIsXHJcbiAgICAgIGNsczogXCJtbmVtby1ncmFwaC1idG5cIixcclxuICAgICAgYXR0cjogeyB0aXRsZTogXCJGdWxsIGtub3dsZWRnZSBncmFwaFwiIH0sXHJcbiAgICB9KTtcclxuICAgIGZ1bGxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgdGhpcy5zZXRBY3RpdmVCdG4oZnVsbEJ0bik7XHJcbiAgICAgIHRoaXMudmlld01vZGUgPSBcImZ1bGxcIjtcclxuICAgICAgdm9pZCB0aGlzLmxvYWRGdWxsR3JhcGgoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYmFja0J0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwge1xyXG4gICAgICB0ZXh0OiBcIlx1MjE5MCBiYWNrXCIsXHJcbiAgICAgIGNsczogXCJtbmVtby1ncmFwaC1idG5cIixcclxuICAgICAgYXR0cjogeyB0aXRsZTogXCJCYWNrIHRvIGNsdXN0ZXJzXCIgfSxcclxuICAgIH0pO1xyXG4gICAgdGhpcy5iYWNrQnRuLmhpZGUoKTtcclxuICAgIHRoaXMuYmFja0J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICB0aGlzLmJhY2tCdG4/LmhpZGUoKTtcclxuICAgICAgdm9pZCB0aGlzLmxvYWRDbHVzdGVycygpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hbGxCdG5zID0gW2xpbmVhZ2VCdG4sIGxvY2FsQnRuLCBjbHVzdGVyQnRuLCBmdWxsQnRuXTtcclxuXHJcbiAgICBjb25zdCByZWZyZXNoQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7XHJcbiAgICAgIHRleHQ6IFwiXHUyMUJCXCIsXHJcbiAgICAgIGNsczogXCJtbmVtby1ncmFwaC1idG5cIixcclxuICAgICAgYXR0cjogeyB0aXRsZTogXCJSZWZyZXNoXCIgfSxcclxuICAgIH0pO1xyXG4gICAgcmVmcmVzaEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICB2b2lkIHRoaXMucmVmcmVzaEN1cnJlbnRWaWV3KCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBmaXRCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcclxuICAgICAgdGV4dDogXCJcdTIyQTFcIixcclxuICAgICAgY2xzOiBcIm1uZW1vLWdyYXBoLWJ0blwiLFxyXG4gICAgICBhdHRyOiB7IHRpdGxlOiBcIkZpdCB0byB2aWV3XCIgfSxcclxuICAgIH0pO1xyXG4gICAgZml0QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB0aGlzLmZpdFRvVmlldygpKTtcclxuXHJcbiAgICBjb25zdCBtZXRhID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJtbmVtby1ncmFwaC1tZXRhXCIgfSk7XHJcbiAgICB0aGlzLnN0YXR1c0VsID0gbWV0YS5jcmVhdGVEaXYoeyBjbHM6IFwibW5lbW8tZ3JhcGgtc3RhdHVzXCIgfSk7XHJcbiAgICB0aGlzLmxlZ2VuZEVsID0gbWV0YS5jcmVhdGVEaXYoeyBjbHM6IFwibW5lbW8tZ3JhcGgtbGVnZW5kXCIgfSk7XHJcbiAgICB0aGlzLnJlbmRlckxlZ2VuZCgpO1xyXG5cclxuICAgIHRoaXMuY2FudmFzID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiY2FudmFzXCIsIHsgY2xzOiBcIm1uZW1vLWdyYXBoLWNhbnZhc1wiIH0pO1xyXG4gICAgdGhpcy5jdHggPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XHJcblxyXG4gICAgdGhpcy5yZXNpemVDYW52YXMoKTtcclxuICAgIHRoaXMucmVnaXN0ZXJEb21FdmVudCh3aW5kb3csIFwicmVzaXplXCIsICgpID0+IHRoaXMucmVzaXplQ2FudmFzKCkpO1xyXG4gICAgdGhpcy5zZXR1cEludGVyYWN0aW9uKCk7XHJcbiAgICBhd2FpdCB0aGlzLmxvYWRMaW5lYWdlKCk7XHJcbiAgfVxyXG5cclxuICBvbkNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XHJcbiAgICBpZiAodGhpcy5hbmltRnJhbWUpIHtcclxuICAgICAgY2FuY2VsQW5pbWF0aW9uRnJhbWUodGhpcy5hbmltRnJhbWUpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgbG9hZEdyYXBoKHBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFjdGl2ZVBhdGggPSB0aGlzLmdldFJlcXVlc3RlZFBhdGgocGF0aCk7XHJcbiAgICBpZiAoIWFjdGl2ZVBhdGgpIHtcclxuICAgICAgdGhpcy5zZXRTdGF0dXMoXCJPcGVuIGEgbm90ZSB0byBpbnNwZWN0IGl0cyBncmFwaCBuZWlnaGJvcmhvb2RcIik7XHJcbiAgICAgIHRoaXMuZHJhd0VtcHR5KFwiT3BlbiBhIG5vdGUsIHRoZW4gcmVmcmVzaFwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuY2VudGVyUGF0aCA9IGFjdGl2ZVBhdGg7XHJcbiAgICB0aGlzLnJlbmRlckxlZ2VuZCgpO1xyXG4gICAgdGhpcy5zZXRTdGF0dXMoXCJDdXJyZW50IG5vdGUgbmVpZ2hib3Job29kIFx1MDBCNyBkZXB0aCAxXCIpO1xyXG5cclxuICAgIGNvbnN0IGFwaVBhdGggPSB0aGlzLm5vcm1hbGl6ZVBhdGgoYWN0aXZlUGF0aCk7XHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuc3ViZ3JhcGgoYXBpUGF0aCwgMSk7XHJcbiAgICBpZiAoIWRhdGEgfHwgZGF0YS5ub2Rlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJObyBncmFwaCBkYXRhIGZvciB0aGlzIG5vdGVcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgbm9kZXMgPSBkYXRhLm5vZGVzO1xyXG4gICAgbGV0IGVkZ2VzID0gZGF0YS5lZGdlcztcclxuICAgIGlmIChub2Rlcy5sZW5ndGggPiA4MCkge1xyXG4gICAgICBjb25zdCBrZWVwID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgICAgIGNvbnN0IGNlbnRlck5vZGUgPSBub2Rlcy5maW5kKChuKSA9PiB0aGlzLm1hdGNoZXNQYXRoKG4uaWQsIHVuZGVmaW5lZCwgW2FjdGl2ZVBhdGgsIGFwaVBhdGhdKSk7XHJcbiAgICAgIGlmIChjZW50ZXJOb2RlKSB7XHJcbiAgICAgICAga2VlcC5hZGQoY2VudGVyTm9kZS5pZCk7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3Qgc29ydGVkID0gWy4uLm5vZGVzXS5zb3J0KChhLCBiKSA9PiAoYi5zY29yZSA/PyAwKSAtIChhLnNjb3JlID8/IDApKTtcclxuICAgICAgZm9yIChjb25zdCBuIG9mIHNvcnRlZCkge1xyXG4gICAgICAgIGlmIChrZWVwLnNpemUgPj0gODApIHtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgICBrZWVwLmFkZChuLmlkKTtcclxuICAgICAgfVxyXG4gICAgICBub2RlcyA9IG5vZGVzLmZpbHRlcigobikgPT4ga2VlcC5oYXMobi5pZCkpO1xyXG4gICAgICBlZGdlcyA9IGVkZ2VzLmZpbHRlcigoZSkgPT4ga2VlcC5oYXMoZS5zb3VyY2UpICYmIGtlZXAuaGFzKGUudGFyZ2V0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5idWlsZEdyYXBoKG5vZGVzLCBlZGdlcywgW2FjdGl2ZVBhdGgsIGFwaVBhdGhdKTtcclxuICAgIHRoaXMucnVuU2ltdWxhdGlvbigpO1xyXG4gICAgdGhpcy5zZXRTdGF0dXMoYEN1cnJlbnQgbm90ZSBuZWlnaGJvcmhvb2QgXHUwMEI3ICR7dGhpcy5ub2Rlcy5sZW5ndGh9IG5vZGVzIFx1MDBCNyAke3RoaXMuZWRnZXMubGVuZ3RofSBlZGdlc2ApO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgbG9hZExpbmVhZ2UocGF0aD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYWN0aXZlUGF0aCA9IHRoaXMuZ2V0UmVxdWVzdGVkUGF0aChwYXRoKTtcclxuICAgIGlmICghYWN0aXZlUGF0aCkge1xyXG4gICAgICB0aGlzLnNldFN0YXR1cyhcIk9wZW4gYSBub3RlIHRvIGluc3BlY3QgaXRzIGxpbmVhZ2VcIik7XHJcbiAgICAgIHRoaXMuZHJhd0VtcHR5KFwiT3BlbiBhIG5vdGUsIHRoZW4gcmVmcmVzaFwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuY2VudGVyUGF0aCA9IGFjdGl2ZVBhdGg7XHJcbiAgICB0aGlzLnJlbmRlckxlZ2VuZCgpO1xyXG4gICAgdGhpcy5zZXRTdGF0dXMoXCJDdXJyZW50IG5vdGUgbGluZWFnZSBcdTAwQjcgZGVwdGggMiBcdTAwQjcgYm90aCBkaXJlY3Rpb25zXCIpO1xyXG4gICAgdGhpcy5kcmF3RW1wdHkoXCJMb2FkaW5nIGxpbmVhZ2UuLi5cIik7XHJcblxyXG4gICAgY29uc3QgYXBpUGF0aCA9IHRoaXMubm9ybWFsaXplUGF0aChhY3RpdmVQYXRoKTtcclxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuYXBpQ2xpZW50LmxpbmVhZ2UoYXBpUGF0aCwgMiwgXCJib3RoXCIpO1xyXG4gICAgaWYgKCFyZXN1bHQpIHtcclxuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJMaW5lYWdlIHZpZXcgdW5hdmFpbGFibGVcXG5TdGFydCBvciB1cGRhdGUgdGhlIE1uZW1vIEFQSSBzZXJ2ZXJcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGlmIChyZXN1bHQua2luZCA9PT0gXCJhbWJpZ3VvdXNcIikge1xyXG4gICAgICBhd2FpdCB0aGlzLnJlc29sdmVBbWJpZ3VvdXNMaW5lYWdlKHJlc3VsdC5kZXRhaWwpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZGF0YSA9IHJlc3VsdC5kYXRhO1xyXG4gICAgaWYgKCFkYXRhLm5vZGVzIHx8IGRhdGEubm9kZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHRoaXMuZHJhd0VtcHR5KFwiTm8gbGluZWFnZSBkYXRhIGZvciB0aGlzIG5vdGVcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmJ1aWxkTGluZWFnZUdyYXBoKGRhdGEsIFthY3RpdmVQYXRoLCBhcGlQYXRoXSk7XHJcbiAgICB0aGlzLnNpbVJ1bm5pbmcgPSBmYWxzZTtcclxuICAgIHRoaXMuZml0VG9WaWV3KCk7XHJcbiAgICB0aGlzLmRyYXcoKTtcclxuICAgIHRoaXMuc2V0U3RhdHVzKGBDdXJyZW50IG5vdGUgbGluZWFnZSBcdTAwQjcgJHt0aGlzLm5vZGVzLmxlbmd0aH0gbm9kZXMgXHUwMEI3ICR7dGhpcy5lZGdlcy5sZW5ndGh9IGVkZ2VzYCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHJlc29sdmVBbWJpZ3VvdXNMaW5lYWdlKGRldGFpbDogTGluZWFnZUFtYmlndW91c0RldGFpbCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdGhpcy5zZXRTdGF0dXMoYExpbmVhZ2UgcmVmZXJlbmNlIGlzIGFtYmlndW91cyA/ICR7ZGV0YWlsLmNhbmRpZGF0ZXMubGVuZ3RofSBjYW5kaWRhdGVzYCk7XHJcbiAgICBjb25zdCBwaWNrZXIgPSBuZXcgTGluZWFnZUNhbmRpZGF0ZU1vZGFsKHRoaXMuYXBwLCBkZXRhaWwpO1xyXG4gICAgY29uc3Qgc2VsZWN0ZWQgPSBhd2FpdCBwaWNrZXIucGljaygpO1xyXG4gICAgaWYgKCFzZWxlY3RlZCkge1xyXG4gICAgICB0aGlzLmRyYXdFbXB0eShcIkxpbmVhZ2Ugc2VsZWN0aW9uIGNhbmNlbGVkXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgbmV3IE5vdGljZShgTG9hZGluZyBsaW5lYWdlIGZvciAke3NlbGVjdGVkLm5hbWV9YCk7XHJcbiAgICBhd2FpdCB0aGlzLmxvYWRMaW5lYWdlKHNlbGVjdGVkLmlkKTtcclxuICB9XHJcblxyXG4gIHNldENlbnRlclBhdGgocGF0aDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmNlbnRlclBhdGggPSBwYXRoO1xyXG4gICAgdm9pZCB0aGlzLnJlZnJlc2hDdXJyZW50VmlldyhwYXRoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgcmVmcmVzaEN1cnJlbnRWaWV3KHBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHN3aXRjaCAodGhpcy52aWV3TW9kZSkge1xyXG4gICAgICBjYXNlIFwiZnVsbFwiOlxyXG4gICAgICAgIGF3YWl0IHRoaXMubG9hZEZ1bGxHcmFwaCgpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIFwiY2x1c3RlclwiOlxyXG4gICAgICAgIGF3YWl0IHRoaXMubG9hZENsdXN0ZXJzKCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgXCJsaW5lYWdlXCI6XHJcbiAgICAgICAgYXdhaXQgdGhpcy5sb2FkTGluZWFnZShwYXRoKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBcImxvY2FsXCI6XHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgYXdhaXQgdGhpcy5sb2FkR3JhcGgocGF0aCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNldEFjdGl2ZUJ0bihhY3RpdmU6IEhUTUxFbGVtZW50KTogdm9pZCB7XHJcbiAgICBmb3IgKGNvbnN0IGJ0biBvZiB0aGlzLmFsbEJ0bnMpIHtcclxuICAgICAgYnRuLnJlbW92ZUNsYXNzKFwibW5lbW8tZ3JhcGgtYnRuLWFjdGl2ZVwiKTtcclxuICAgIH1cclxuICAgIGFjdGl2ZS5hZGRDbGFzcyhcIm1uZW1vLWdyYXBoLWJ0bi1hY3RpdmVcIik7XHJcbiAgICBpZiAodGhpcy5iYWNrQnRuKSB7XHJcbiAgICAgIHRoaXMuYmFja0J0bi5oaWRlKCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnJlbmRlckxlZ2VuZCgpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgbG9hZENsdXN0ZXJzKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdGhpcy5yZW5kZXJMZWdlbmQoKTtcclxuICAgIHRoaXMuc2V0U3RhdHVzKFwiQ2x1c3RlciBleHBsb3JlclwiKTtcclxuICAgIHRoaXMuZHJhd0VtcHR5KFwiTG9hZGluZyBjbHVzdGVycy4uLlwiKTtcclxuXHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuY2x1c3RlcnMoKTtcclxuICAgIGlmICghZGF0YSB8fCAhZGF0YS5jbHVzdGVycyB8fCBkYXRhLmNsdXN0ZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICB0aGlzLmRyYXdFbXB0eShcIk5vIGNsdXN0ZXIgZGF0YVwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuY2x1c3RlckRhdGEgPSBkYXRhLmNsdXN0ZXJzO1xyXG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5lbnN1cmVDYW52YXMoKTtcclxuICAgIGNvbnN0IHcgPSBjYW52YXMud2lkdGg7XHJcbiAgICBjb25zdCBoID0gY2FudmFzLmhlaWdodDtcclxuXHJcbiAgICB0aGlzLm5vZGVzID0gZGF0YS5jbHVzdGVycy5tYXAoKGM6IENsdXN0ZXJJbmZvKSA9PiAoe1xyXG4gICAgICBpZDogYy5pZCxcclxuICAgICAgbmFtZTogYCR7Yy5odWJfbmFtZX0gKCR7Yy5zaXplfSlgLFxyXG4gICAgICB0eXBlOiBjLmRvbWluYW50X3R5cGUsXHJcbiAgICAgIHNjb3JlOiBjLnNpemUsXHJcbiAgICAgIHg6IChjLnggLyAxMDAwKSAqIHcgKiAwLjkgKyB3ICogMC4wNSxcclxuICAgICAgeTogKGMueSAvIDEwMDApICogaCAqIDAuOSArIGggKiAwLjA1LFxyXG4gICAgICB2eDogMCxcclxuICAgICAgdnk6IDAsXHJcbiAgICAgIHJhZGl1czogTWF0aC5tYXgoOCwgTWF0aC5taW4oNDAsIDggKyBNYXRoLnNxcnQoYy5zaXplKSAqIDIpKSxcclxuICAgICAgaXNDZW50ZXI6IGZhbHNlLFxyXG4gICAgICBfY2x1c3RlckluZGV4OiBjLmluZGV4LFxyXG4gICAgfSkpO1xyXG5cclxuICAgIHRoaXMuZWRnZXMgPSAoZGF0YS5lZGdlcyA/PyBbXSkubWFwKChlKSA9PiAoe1xyXG4gICAgICBzb3VyY2U6IGUuc291cmNlLFxyXG4gICAgICB0YXJnZXQ6IGUudGFyZ2V0LFxyXG4gICAgICB0eXBlOiBcImNsdXN0ZXJfbGlua1wiLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIHRoaXMubm9kZU1hcCA9IG5ldyBNYXAodGhpcy5ub2Rlcy5tYXAoKG4pID0+IFtuLmlkLCBuXSkpO1xyXG4gICAgdGhpcy5yZXNldFZpZXdwb3J0KCk7XHJcbiAgICB0aGlzLnNpbVJ1bm5pbmcgPSBmYWxzZTtcclxuICAgIHRoaXMuZHJhdygpO1xyXG4gICAgdGhpcy5zZXRTdGF0dXMoYENsdXN0ZXIgZXhwbG9yZXIgXHUwMEI3ICR7dGhpcy5jbHVzdGVyRGF0YS5sZW5ndGh9IGNsdXN0ZXJzYCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBkcmlsbEludG9DbHVzdGVyKGNsdXN0ZXJJbmRleDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB0aGlzLnJlbmRlckxlZ2VuZCgpO1xyXG4gICAgdGhpcy5zZXRTdGF0dXMoYENsdXN0ZXIgZGV0YWlsIFx1MDBCNyAjJHtjbHVzdGVySW5kZXh9YCk7XHJcbiAgICB0aGlzLmRyYXdFbXB0eShcIkxvYWRpbmcgY2x1c3RlciBkZXRhaWwuLi5cIik7XHJcblxyXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuYXBpQ2xpZW50LmNsdXN0ZXJEZXRhaWwoY2x1c3RlckluZGV4KTtcclxuICAgIGlmICghZGF0YSB8fCBkYXRhLm5vZGVzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICB0aGlzLmRyYXdFbXB0eShcIkVtcHR5IGNsdXN0ZXJcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjYW52YXMgPSB0aGlzLmVuc3VyZUNhbnZhcygpO1xyXG4gICAgY29uc3QgdyA9IGNhbnZhcy53aWR0aDtcclxuICAgIGNvbnN0IGggPSBjYW52YXMuaGVpZ2h0O1xyXG5cclxuICAgIHRoaXMubm9kZXMgPSBkYXRhLm5vZGVzLm1hcCgobjogU3ViZ3JhcGhOb2RlV2l0aExheW91dCkgPT4gKHtcclxuICAgICAgaWQ6IG4uaWQsXHJcbiAgICAgIG5hbWU6IG4ubmFtZSxcclxuICAgICAgdHlwZTogbi50eXBlLFxyXG4gICAgICBzY29yZTogbi5kZWdyZWUsXHJcbiAgICAgIHg6ICgobi54ID8/IDApIC8gMTAwMCkgKiB3ICogMC45ICsgdyAqIDAuMDUsXHJcbiAgICAgIHk6ICgobi55ID8/IDApIC8gMTAwMCkgKiBoICogMC45ICsgaCAqIDAuMDUsXHJcbiAgICAgIHZ4OiAwLFxyXG4gICAgICB2eTogMCxcclxuICAgICAgcmFkaXVzOiBNYXRoLm1heCg0LCBNYXRoLm1pbigxNiwgNCArIChuLmRlZ3JlZSB8fCAwKSAqIDAuMSkpLFxyXG4gICAgICBpc0NlbnRlcjogZmFsc2UsXHJcbiAgICB9KSk7XHJcblxyXG4gICAgdGhpcy5lZGdlcyA9IGRhdGEuZWRnZXM7XHJcbiAgICB0aGlzLm5vZGVNYXAgPSBuZXcgTWFwKHRoaXMubm9kZXMubWFwKChuKSA9PiBbbi5pZCwgbl0pKTtcclxuICAgIHRoaXMucmVzZXRWaWV3cG9ydCgpO1xyXG4gICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XHJcbiAgICB0aGlzLmJhY2tCdG4/LnNob3coKTtcclxuICAgIHRoaXMuZHJhdygpO1xyXG4gICAgdGhpcy5zZXRTdGF0dXMoYENsdXN0ZXIgZGV0YWlsIFx1MDBCNyAke3RoaXMubm9kZXMubGVuZ3RofSBub2RlcyBcdTAwQjcgJHt0aGlzLmVkZ2VzLmxlbmd0aH0gZWRnZXNgKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGxvYWRGdWxsR3JhcGgoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB0aGlzLnJlbmRlckxlZ2VuZCgpO1xyXG4gICAgdGhpcy5zZXRTdGF0dXMoXCJGdWxsIGtub3dsZWRnZSBncmFwaFwiKTtcclxuICAgIHRoaXMuZHJhd0VtcHR5KFwiTG9hZGluZyBmdWxsIGdyYXBoLi4uXCIpO1xyXG5cclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmFwaUNsaWVudC5mdWxsR3JhcGgoKTtcclxuICAgIGlmICghZGF0YSB8fCBkYXRhLm5vZGVzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICB0aGlzLmRyYXdFbXB0eShcIk5vIGdyYXBoIGRhdGFcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjYW52YXMgPSB0aGlzLmVuc3VyZUNhbnZhcygpO1xyXG4gICAgY29uc3QgdyA9IGNhbnZhcy53aWR0aDtcclxuICAgIGNvbnN0IGggPSBjYW52YXMuaGVpZ2h0O1xyXG5cclxuICAgIHRoaXMubm9kZXMgPSBkYXRhLm5vZGVzLm1hcCgobjogU3ViZ3JhcGhOb2RlV2l0aExheW91dCkgPT4gKHtcclxuICAgICAgaWQ6IG4uaWQsXHJcbiAgICAgIG5hbWU6IG4ubmFtZSxcclxuICAgICAgdHlwZTogbi50eXBlLFxyXG4gICAgICBzY29yZTogbi5kZWdyZWUsXHJcbiAgICAgIHg6ICgobi54ID8/IDApIC8gMTAwMCkgKiB3ICogMC45ICsgdyAqIDAuMDUsXHJcbiAgICAgIHk6ICgobi55ID8/IDApIC8gMTAwMCkgKiBoICogMC45ICsgaCAqIDAuMDUsXHJcbiAgICAgIHZ4OiAwLFxyXG4gICAgICB2eTogMCxcclxuICAgICAgcmFkaXVzOiBNYXRoLm1heCgzLCBNYXRoLm1pbigxNiwgMyArIChuLmRlZ3JlZSB8fCAwKSAqIDAuMDUpKSxcclxuICAgICAgaXNDZW50ZXI6IGZhbHNlLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIHRoaXMuZWRnZXMgPSBkYXRhLmVkZ2VzO1xyXG4gICAgdGhpcy5ub2RlTWFwID0gbmV3IE1hcCh0aGlzLm5vZGVzLm1hcCgobikgPT4gW24uaWQsIG5dKSk7XHJcbiAgICB0aGlzLnJlc2V0Vmlld3BvcnQoKTtcclxuICAgIHRoaXMuc2ltUnVubmluZyA9IGZhbHNlO1xyXG4gICAgdGhpcy5kcmF3KCk7XHJcbiAgICB0aGlzLnNldFN0YXR1cyhgRnVsbCBrbm93bGVkZ2UgZ3JhcGggXHUwMEI3ICR7dGhpcy5ub2Rlcy5sZW5ndGh9IG5vZGVzIFx1MDBCNyAke3RoaXMuZWRnZXMubGVuZ3RofSBlZGdlc2ApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZEdyYXBoKG5vZGVzOiBTdWJncmFwaE5vZGVbXSwgZWRnZXM6IFN1YmdyYXBoRWRnZVtdLCBjZW50ZXJDYW5kaWRhdGVzOiBzdHJpbmdbXSk6IHZvaWQge1xyXG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5lbnN1cmVDYW52YXMoKTtcclxuICAgIGNvbnN0IGN4ID0gY2FudmFzLndpZHRoIC8gMjtcclxuICAgIGNvbnN0IGN5ID0gY2FudmFzLmhlaWdodCAvIDI7XHJcblxyXG4gICAgdGhpcy5ub2RlcyA9IG5vZGVzLm1hcCgobikgPT4ge1xyXG4gICAgICBjb25zdCBpc0NlbnRlciA9IHRoaXMubWF0Y2hlc1BhdGgobi5pZCwgdW5kZWZpbmVkLCBjZW50ZXJDYW5kaWRhdGVzKTtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBpZDogbi5pZCxcclxuICAgICAgICBuYW1lOiBuLm5hbWUsXHJcbiAgICAgICAgdHlwZTogbi50eXBlLFxyXG4gICAgICAgIHNjb3JlOiBuLnNjb3JlLFxyXG4gICAgICAgIHg6IGlzQ2VudGVyID8gY3ggOiBjeCArIChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDMwMCxcclxuICAgICAgICB5OiBpc0NlbnRlciA/IGN5IDogY3kgKyAoTWF0aC5yYW5kb20oKSAtIDAuNSkgKiAzMDAsXHJcbiAgICAgICAgdng6IDAsXHJcbiAgICAgICAgdnk6IDAsXHJcbiAgICAgICAgcmFkaXVzOiBpc0NlbnRlciA/IDE4IDogMTIsXHJcbiAgICAgICAgaXNDZW50ZXIsXHJcbiAgICAgIH07XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmVkZ2VzID0gZWRnZXM7XHJcbiAgICB0aGlzLm5vZGVNYXAgPSBuZXcgTWFwKHRoaXMubm9kZXMubWFwKChuKSA9PiBbbi5pZCwgbl0pKTtcclxuICAgIHRoaXMucmVzZXRWaWV3cG9ydCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZExpbmVhZ2VHcmFwaChkYXRhOiBMaW5lYWdlUmVzcG9uc2UsIGNlbnRlckNhbmRpZGF0ZXM6IHN0cmluZ1tdKTogdm9pZCB7XHJcbiAgICBjb25zdCBjYW52YXMgPSB0aGlzLmVuc3VyZUNhbnZhcygpO1xyXG4gICAgY29uc3QgdyA9IGNhbnZhcy53aWR0aDtcclxuICAgIGNvbnN0IGggPSBjYW52YXMuaGVpZ2h0O1xyXG4gICAgY29uc3QgY3ggPSB3IC8gMjtcclxuICAgIGNvbnN0IGN5ID0gaCAvIDI7XHJcblxyXG4gICAgY29uc3Qgbm9ybWFsaXplZENlbnRlciA9IHRoaXMubm9ybWFsaXplUGF0aChkYXRhLmNlbnRlcik7XHJcbiAgICBjb25zdCBhbGxDZW50ZXJDYW5kaWRhdGVzID0gWy4uLmNlbnRlckNhbmRpZGF0ZXMsIG5vcm1hbGl6ZWRDZW50ZXJdO1xyXG5cclxuICAgIGNvbnN0IHVwc3RyZWFtID0gZGF0YS5ub2Rlc1xyXG4gICAgICAuZmlsdGVyKChub2RlKSA9PiB0aGlzLm5vcm1hbGl6ZUxpbmVhZ2VSb2xlKG5vZGUubGluZWFnZV9yb2xlKSA9PT0gXCJ1cHN0cmVhbVwiKVxyXG4gICAgICAuc29ydCgoYSwgYikgPT4gYS5kZXB0aCAtIGIuZGVwdGggfHwgYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSk7XHJcbiAgICBjb25zdCBkb3duc3RyZWFtID0gZGF0YS5ub2Rlc1xyXG4gICAgICAuZmlsdGVyKChub2RlKSA9PiB0aGlzLm5vcm1hbGl6ZUxpbmVhZ2VSb2xlKG5vZGUubGluZWFnZV9yb2xlKSA9PT0gXCJkb3duc3RyZWFtXCIpXHJcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBhLmRlcHRoIC0gYi5kZXB0aCB8fCBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKTtcclxuICAgIGNvbnN0IGJyaWRnZSA9IGRhdGEubm9kZXNcclxuICAgICAgLmZpbHRlcigobm9kZSkgPT4gdGhpcy5ub3JtYWxpemVMaW5lYWdlUm9sZShub2RlLmxpbmVhZ2Vfcm9sZSkgPT09IFwiYnJpZGdlXCIpXHJcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBhLmRlcHRoIC0gYi5kZXB0aCB8fCBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKTtcclxuICAgIGNvbnN0IG90aGVyID0gZGF0YS5ub2Rlc1xyXG4gICAgICAuZmlsdGVyKChub2RlKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgcm9sZSA9IHRoaXMubm9ybWFsaXplTGluZWFnZVJvbGUobm9kZS5saW5lYWdlX3JvbGUpO1xyXG4gICAgICAgIHJldHVybiByb2xlICE9PSBcImNlbnRlclwiICYmIHJvbGUgIT09IFwidXBzdHJlYW1cIiAmJiByb2xlICE9PSBcImRvd25zdHJlYW1cIiAmJiByb2xlICE9PSBcImJyaWRnZVwiO1xyXG4gICAgICB9KVxyXG4gICAgICAuc29ydCgoYSwgYikgPT4gYS5kZXB0aCAtIGIuZGVwdGggfHwgYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSk7XHJcblxyXG4gICAgY29uc3QgcG9zaXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfT4oKTtcclxuXHJcbiAgICBjb25zdCBwbGFjZUxpbmUgPSAoXHJcbiAgICAgIGdyb3VwOiB0eXBlb2YgZGF0YS5ub2RlcyxcclxuICAgICAgZGlyZWN0aW9uOiAtMSB8IDAgfCAxLFxyXG4gICAgICB2ZXJ0aWNhbE9mZnNldDogbnVtYmVyID0gMFxyXG4gICAgKTogdm9pZCA9PiB7XHJcbiAgICAgIGNvbnN0IGRlcHRoQnVja2V0cyA9IG5ldyBNYXA8bnVtYmVyLCB0eXBlb2YgZGF0YS5ub2Rlcz4oKTtcclxuICAgICAgZm9yIChjb25zdCBub2RlIG9mIGdyb3VwKSB7XHJcbiAgICAgICAgY29uc3QgYnVja2V0ID0gZGVwdGhCdWNrZXRzLmdldChub2RlLmRlcHRoKSA/PyBbXTtcclxuICAgICAgICBidWNrZXQucHVzaChub2RlKTtcclxuICAgICAgICBkZXB0aEJ1Y2tldHMuc2V0KG5vZGUuZGVwdGgsIGJ1Y2tldCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGZvciAoY29uc3QgW2RlcHRoLCBidWNrZXRdIG9mIGRlcHRoQnVja2V0cy5lbnRyaWVzKCkpIHtcclxuICAgICAgICBjb25zdCB4ID0gY3ggKyBkaXJlY3Rpb24gKiBNYXRoLm1heCgxODAsIGRlcHRoICogMjIwKTtcclxuICAgICAgICBjb25zdCBjb3VudCA9IGJ1Y2tldC5sZW5ndGg7XHJcbiAgICAgICAgY29uc3Qgc3BhbiA9IE1hdGgubWluKGggKiAwLjcsIE1hdGgubWF4KDEyMCwgY291bnQgKiA4NCkpO1xyXG4gICAgICAgIGNvbnN0IHN0ZXAgPSBjb3VudCA+IDEgPyBzcGFuIC8gKGNvdW50IC0gMSkgOiAwO1xyXG4gICAgICAgIGNvbnN0IHN0YXJ0WSA9IGN5ICsgdmVydGljYWxPZmZzZXQgLSBzcGFuIC8gMjtcclxuXHJcbiAgICAgICAgYnVja2V0LmZvckVhY2goKG5vZGUsIGluZGV4KSA9PiB7XHJcbiAgICAgICAgICBwb3NpdGlvbnMuc2V0KG5vZGUuaWQsIHtcclxuICAgICAgICAgICAgeCxcclxuICAgICAgICAgICAgeTogY291bnQgPT09IDEgPyBjeSArIHZlcnRpY2FsT2Zmc2V0IDogc3RhcnRZICsgaW5kZXggKiBzdGVwLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgcGxhY2VMaW5lKHVwc3RyZWFtLCAtMSk7XHJcbiAgICBwbGFjZUxpbmUoZG93bnN0cmVhbSwgMSk7XHJcbiAgICBwbGFjZUxpbmUoYnJpZGdlLCAwLCAwKTtcclxuICAgIHBsYWNlTGluZShvdGhlciwgMSwgTWF0aC5taW4oMTIwLCBoICogMC4xOCkpO1xyXG5cclxuICAgIHRoaXMubm9kZXMgPSBkYXRhLm5vZGVzLm1hcCgobm9kZSkgPT4ge1xyXG4gICAgICBjb25zdCByb2xlID0gdGhpcy5ub3JtYWxpemVMaW5lYWdlUm9sZShub2RlLmxpbmVhZ2Vfcm9sZSk7XHJcbiAgICAgIGNvbnN0IGlzQ2VudGVyID0gcm9sZSA9PT0gXCJjZW50ZXJcIiB8fCB0aGlzLm1hdGNoZXNQYXRoKG5vZGUuaWQsIG5vZGUucGF0aCwgYWxsQ2VudGVyQ2FuZGlkYXRlcyk7XHJcbiAgICAgIGNvbnN0IHBvcyA9IGlzQ2VudGVyID8geyB4OiBjeCwgeTogY3kgfSA6IHBvc2l0aW9ucy5nZXQobm9kZS5pZCkgPz8geyB4OiBjeCwgeTogY3kgKyAxNTAgfTtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBpZDogbm9kZS5pZCxcclxuICAgICAgICBuYW1lOiBub2RlLm5hbWUsXHJcbiAgICAgICAgcGF0aDogbm9kZS5wYXRoLFxyXG4gICAgICAgIHR5cGU6IG5vZGUuZW50aXR5X3R5cGUgPz8gXCJub3RlXCIsXHJcbiAgICAgICAgeDogcG9zLngsXHJcbiAgICAgICAgeTogcG9zLnksXHJcbiAgICAgICAgdng6IDAsXHJcbiAgICAgICAgdnk6IDAsXHJcbiAgICAgICAgcmFkaXVzOiBpc0NlbnRlciA/IDIwIDogTWF0aC5tYXgoMTAsIDE1IC0gTWF0aC5taW4obm9kZS5kZXB0aCwgNCkpLFxyXG4gICAgICAgIGlzQ2VudGVyLFxyXG4gICAgICAgIGxpbmVhZ2VSb2xlOiBpc0NlbnRlciA/IFwiY2VudGVyXCIgOiByb2xlLFxyXG4gICAgICAgIGxpbmVhZ2VEZXB0aDogbm9kZS5kZXB0aCxcclxuICAgICAgfTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuZWRnZXMgPSBkYXRhLmVkZ2VzLm1hcCgoZWRnZSkgPT4gKHtcclxuICAgICAgc291cmNlOiBlZGdlLnNvdXJjZSxcclxuICAgICAgdGFyZ2V0OiBlZGdlLnRhcmdldCxcclxuICAgICAgdHlwZTogZWRnZS50eXBlLFxyXG4gICAgICB3ZWlnaHQ6IGVkZ2Uud2VpZ2h0LFxyXG4gICAgfSkpO1xyXG5cclxuICAgIHRoaXMubm9kZU1hcCA9IG5ldyBNYXAodGhpcy5ub2Rlcy5tYXAoKG4pID0+IFtuLmlkLCBuXSkpO1xyXG4gICAgdGhpcy5yZXNldFZpZXdwb3J0KCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJ1blNpbXVsYXRpb24oKTogdm9pZCB7XHJcbiAgICB0aGlzLnNpbVJ1bm5pbmcgPSB0cnVlO1xyXG4gICAgdGhpcy5zaW1JdGVyYXRpb25zID0gMDtcclxuICAgIGNvbnN0IHRpY2sgPSAoKSA9PiB7XHJcbiAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuc2ltSXRlcmF0aW9ucysrO1xyXG4gICAgICB0aGlzLnNpbXVsYXRlU3RlcCgpO1xyXG4gICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgaWYgKHRoaXMuc2ltSXRlcmF0aW9ucyA8IDIwMCkge1xyXG4gICAgICAgIHRoaXMuYW5pbUZyYW1lID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuc2ltUnVubmluZyA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhpcy5hbmltRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNpbXVsYXRlU3RlcCgpOiB2b2lkIHtcclxuICAgIGNvbnN0IGFscGhhID0gTWF0aC5tYXgoMC4wMSwgMSAtIHRoaXMuc2ltSXRlcmF0aW9ucyAvIDIwMCk7XHJcbiAgICBjb25zdCBub2RlcyA9IHRoaXMubm9kZXM7XHJcbiAgICBjb25zdCByZXB1bHNpb24gPSAzMDAwO1xyXG4gICAgY29uc3Qgc3ByaW5nTGVuID0gMTIwO1xyXG4gICAgY29uc3Qgc3ByaW5nSyA9IDAuMDI7XHJcbiAgICBjb25zdCBjZW50ZXJHcmF2aXR5ID0gMC4wMTtcclxuICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuZW5zdXJlQ2FudmFzKCk7XHJcbiAgICBjb25zdCB3ID0gY2FudmFzLndpZHRoIC8gMjtcclxuICAgIGNvbnN0IGggPSBjYW52YXMuaGVpZ2h0IC8gMjtcclxuXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IG5vZGVzLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgY29uc3QgYSA9IG5vZGVzW2ldO1xyXG4gICAgICAgIGNvbnN0IGIgPSBub2Rlc1tqXTtcclxuICAgICAgICBjb25zdCBkeCA9IGIueCAtIGEueDtcclxuICAgICAgICBjb25zdCBkeSA9IGIueSAtIGEueTtcclxuICAgICAgICBjb25zdCBkaXN0ID0gTWF0aC5zcXJ0KGR4ICogZHggKyBkeSAqIGR5KSB8fCAxO1xyXG4gICAgICAgIGNvbnN0IGZvcmNlID0gcmVwdWxzaW9uIC8gKGRpc3QgKiBkaXN0KTtcclxuICAgICAgICBjb25zdCBmeCA9IChkeCAvIGRpc3QpICogZm9yY2UgKiBhbHBoYTtcclxuICAgICAgICBjb25zdCBmeSA9IChkeSAvIGRpc3QpICogZm9yY2UgKiBhbHBoYTtcclxuICAgICAgICBhLnZ4IC09IGZ4O1xyXG4gICAgICAgIGEudnkgLT0gZnk7XHJcbiAgICAgICAgYi52eCArPSBmeDtcclxuICAgICAgICBiLnZ5ICs9IGZ5O1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZm9yIChjb25zdCBlIG9mIHRoaXMuZWRnZXMpIHtcclxuICAgICAgY29uc3QgYSA9IHRoaXMubm9kZU1hcC5nZXQoZS5zb3VyY2UpO1xyXG4gICAgICBjb25zdCBiID0gdGhpcy5ub2RlTWFwLmdldChlLnRhcmdldCk7XHJcbiAgICAgIGlmICghYSB8fCAhYikge1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IGR4ID0gYi54IC0gYS54O1xyXG4gICAgICBjb25zdCBkeSA9IGIueSAtIGEueTtcclxuICAgICAgY29uc3QgZGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSkgfHwgMTtcclxuICAgICAgY29uc3QgZm9yY2UgPSAoZGlzdCAtIHNwcmluZ0xlbikgKiBzcHJpbmdLICogYWxwaGE7XHJcbiAgICAgIGNvbnN0IGZ4ID0gKGR4IC8gZGlzdCkgKiBmb3JjZTtcclxuICAgICAgY29uc3QgZnkgPSAoZHkgLyBkaXN0KSAqIGZvcmNlO1xyXG4gICAgICBhLnZ4ICs9IGZ4O1xyXG4gICAgICBhLnZ5ICs9IGZ5O1xyXG4gICAgICBiLnZ4IC09IGZ4O1xyXG4gICAgICBiLnZ5IC09IGZ5O1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAoY29uc3QgbiBvZiBub2Rlcykge1xyXG4gICAgICBuLnZ4ICs9ICh3IC0gbi54KSAqIGNlbnRlckdyYXZpdHkgKiBhbHBoYTtcclxuICAgICAgbi52eSArPSAoaCAtIG4ueSkgKiBjZW50ZXJHcmF2aXR5ICogYWxwaGE7XHJcbiAgICAgIG4udnggKj0gMC44NTtcclxuICAgICAgbi52eSAqPSAwLjg1O1xyXG4gICAgICBpZiAoIW4uaXNDZW50ZXIgfHwgdGhpcy5zaW1JdGVyYXRpb25zID4gNSkge1xyXG4gICAgICAgIG4ueCArPSBuLnZ4O1xyXG4gICAgICAgIG4ueSArPSBuLnZ5O1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRyYXcoKTogdm9pZCB7XHJcbiAgICBjb25zdCBjdHggPSB0aGlzLmVuc3VyZUNvbnRleHQoKTtcclxuICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuZW5zdXJlQ2FudmFzKCk7XHJcbiAgICBjdHguY2xlYXJSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XHJcbiAgICBjdHguc2F2ZSgpO1xyXG4gICAgY3R4LnRyYW5zbGF0ZSh0aGlzLm9mZnNldFgsIHRoaXMub2Zmc2V0WSk7XHJcbiAgICBjdHguc2NhbGUodGhpcy5zY2FsZSwgdGhpcy5zY2FsZSk7XHJcblxyXG4gICAgZm9yIChjb25zdCBlIG9mIHRoaXMuZWRnZXMpIHtcclxuICAgICAgY29uc3QgYSA9IHRoaXMubm9kZU1hcC5nZXQoZS5zb3VyY2UpO1xyXG4gICAgICBjb25zdCBiID0gdGhpcy5ub2RlTWFwLmdldChlLnRhcmdldCk7XHJcbiAgICAgIGlmICghYSB8fCAhYikge1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBlZGdlU3R5bGUgPSB0aGlzLmdldEVkZ2VTdHlsZShhLCBiLCBlKTtcclxuICAgICAgY3R4LmJlZ2luUGF0aCgpO1xyXG4gICAgICBjdHgubW92ZVRvKGEueCwgYS55KTtcclxuICAgICAgY3R4LmxpbmVUbyhiLngsIGIueSk7XHJcbiAgICAgIGN0eC5zdHJva2VTdHlsZSA9IGVkZ2VTdHlsZS5jb2xvcjtcclxuICAgICAgY3R4LmxpbmVXaWR0aCA9IGVkZ2VTdHlsZS53aWR0aDtcclxuICAgICAgY3R4LnNldExpbmVEYXNoKGVkZ2VTdHlsZS5kYXNoKTtcclxuICAgICAgY3R4LnN0cm9rZSgpO1xyXG4gICAgICBjdHguc2V0TGluZURhc2goW10pO1xyXG5cclxuICAgICAgaWYgKGVkZ2VTdHlsZS5hcnJvdykge1xyXG4gICAgICAgIHRoaXMuZHJhd0Fycm93SGVhZChjdHgsIGEsIGIsIGVkZ2VTdHlsZS5jb2xvcik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmb3IgKGNvbnN0IG4gb2YgdGhpcy5ub2Rlcykge1xyXG4gICAgICBjb25zdCBpc0hvdmVyZWQgPSB0aGlzLmhvdmVyZWROb2RlID09PSBuO1xyXG4gICAgICBjb25zdCB0eXBlQ29sb3IgPSBUWVBFX0NPTE9SU1tuLnR5cGVdIHx8IERFRkFVTFRfQ09MT1I7XHJcbiAgICAgIGNvbnN0IHJvbGVDb2xvciA9IHRoaXMudmlld01vZGUgPT09IFwibGluZWFnZVwiXHJcbiAgICAgICAgPyBMSU5FQUdFX0NPTE9SU1tuLmxpbmVhZ2VSb2xlID8/IFwidW5rbm93blwiXVxyXG4gICAgICAgIDogdHlwZUNvbG9yO1xyXG5cclxuICAgICAgaWYgKHRoaXMudmlld01vZGUgPT09IFwibGluZWFnZVwiKSB7XHJcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xyXG4gICAgICAgIGN0eC5hcmMobi54LCBuLnksIG4ucmFkaXVzICsgKG4uaXNDZW50ZXIgPyA4IDogNiksIDAsIE1hdGguUEkgKiAyKTtcclxuICAgICAgICBjdHguZmlsbFN0eWxlID0gdGhpcy53aXRoQWxwaGEocm9sZUNvbG9yLCBuLmlzQ2VudGVyID8gMC4yMiA6IDAuMTIpO1xyXG4gICAgICAgIGN0eC5maWxsKCk7XHJcbiAgICAgIH0gZWxzZSBpZiAobi5pc0NlbnRlcikge1xyXG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcclxuICAgICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIDcsIDAsIE1hdGguUEkgKiAyKTtcclxuICAgICAgICBjdHguZmlsbFN0eWxlID0gdGhpcy53aXRoQWxwaGEodHlwZUNvbG9yLCAwLjIyKTtcclxuICAgICAgICBjdHguZmlsbCgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjdHguYmVnaW5QYXRoKCk7XHJcbiAgICAgIGN0eC5hcmMobi54LCBuLnksIG4ucmFkaXVzICsgKGlzSG92ZXJlZCA/IDMgOiAwKSwgMCwgTWF0aC5QSSAqIDIpO1xyXG4gICAgICBjdHguZmlsbFN0eWxlID0gdHlwZUNvbG9yO1xyXG4gICAgICBjdHguZmlsbCgpO1xyXG5cclxuICAgICAgaWYgKHRoaXMudmlld01vZGUgPT09IFwibGluZWFnZVwiKSB7XHJcbiAgICAgICAgY3R4LnNhdmUoKTtcclxuICAgICAgICBpZiAobi5saW5lYWdlUm9sZSA9PT0gXCJicmlkZ2VcIikge1xyXG4gICAgICAgICAgY3R4LnNldExpbmVEYXNoKFs0LCAzXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9IHJvbGVDb2xvcjtcclxuICAgICAgICBjdHgubGluZVdpZHRoID0gaXNIb3ZlcmVkID8gMy42IDogbi5pc0NlbnRlciA/IDMuMiA6IDIuNDtcclxuICAgICAgICBjdHguc3Ryb2tlKCk7XHJcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuXHJcbiAgICAgICAgaWYgKG4uaXNDZW50ZXIpIHtcclxuICAgICAgICAgIGN0eC5iZWdpblBhdGgoKTtcclxuICAgICAgICAgIGN0eC5hcmMobi54LCBuLnksIE1hdGgubWF4KDQsIG4ucmFkaXVzICogMC40MiksIDAsIE1hdGguUEkgKiAyKTtcclxuICAgICAgICAgIGN0eC5maWxsU3R5bGUgPSByb2xlQ29sb3I7XHJcbiAgICAgICAgICBjdHguZmlsbCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSBpc0hvdmVyZWRcclxuICAgICAgICAgID8gXCIjZmZmZmZmXCJcclxuICAgICAgICAgIDogdGhpcy5pc0RhcmtUaGVtZSgpXHJcbiAgICAgICAgICAgID8gXCJyZ2JhKDI1NSwyNTUsMjU1LDAuMylcIlxyXG4gICAgICAgICAgICA6IFwicmdiYSgwLDAsMCwwLjIpXCI7XHJcbiAgICAgICAgY3R4LmxpbmVXaWR0aCA9IGlzSG92ZXJlZCA/IDIuNSA6IDE7XHJcbiAgICAgICAgY3R4LnN0cm9rZSgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCIjZTBlMGUwXCIgOiBcIiMzMzMzMzNcIjtcclxuICAgICAgY3R4LmZvbnQgPSBuLmlzQ2VudGVyID8gXCJib2xkIDExcHggc2Fucy1zZXJpZlwiIDogXCIxMHB4IHNhbnMtc2VyaWZcIjtcclxuICAgICAgY3R4LnRleHRBbGlnbiA9IFwiY2VudGVyXCI7XHJcbiAgICAgIGlmIChpc0hvdmVyZWQgfHwgbi5pc0NlbnRlcikge1xyXG4gICAgICAgIGNvbnN0IGxhYmVsID0gbi5uYW1lLmxlbmd0aCA+IDQwID8gYCR7bi5uYW1lLnNsaWNlKDAsIDM4KX1cdTIwMjZgIDogbi5uYW1lO1xyXG4gICAgICAgIGN0eC5maWxsVGV4dChsYWJlbCwgbi54LCBuLnkgKyBuLnJhZGl1cyArIDE0KTtcclxuICAgICAgfSBlbHNlIGlmICh0aGlzLnNjYWxlID4gMC43NSAmJiBuLnJhZGl1cyA+PSA1KSB7XHJcbiAgICAgICAgY29uc3Qgc2hvcnQgPSBuLm5hbWUubGVuZ3RoID4gMTIgPyBgJHtuLm5hbWUuc2xpY2UoMCwgMTApfVx1MjAyNmAgOiBuLm5hbWU7XHJcbiAgICAgICAgY3R4LmZpbGxUZXh0KHNob3J0LCBuLngsIG4ueSArIG4ucmFkaXVzICsgMTQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY3R4LnJlc3RvcmUoKTtcclxuXHJcbiAgICBpZiAodGhpcy5ob3ZlcmVkTm9kZSkge1xyXG4gICAgICB0aGlzLmRyYXdUb29sdGlwKHRoaXMuaG92ZXJlZE5vZGUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRFZGdlU3R5bGUoYTogR3JhcGhOb2RlLCBiOiBHcmFwaE5vZGUsIGVkZ2U6IEdyYXBoRWRnZSk6IHtcclxuICAgIGNvbG9yOiBzdHJpbmc7XHJcbiAgICB3aWR0aDogbnVtYmVyO1xyXG4gICAgZGFzaDogbnVtYmVyW107XHJcbiAgICBhcnJvdzogYm9vbGVhbjtcclxuICB9IHtcclxuICAgIGlmICh0aGlzLnZpZXdNb2RlID09PSBcImxpbmVhZ2VcIikge1xyXG4gICAgICBjb25zdCByb2xlID0gdGhpcy5waWNrTGluZWFnZUVkZ2VSb2xlKGEsIGIpO1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGNvbG9yOiB0aGlzLndpdGhBbHBoYShMSU5FQUdFX0NPTE9SU1tyb2xlXSwgdGhpcy5pc0RhcmtUaGVtZSgpID8gMC42NSA6IDAuOCksXHJcbiAgICAgICAgd2lkdGg6IE1hdGgubWF4KDEuNSwgTWF0aC5taW4oNCwgMS4yICsgKGVkZ2Uud2VpZ2h0ID8/IDEpICogMC43KSksXHJcbiAgICAgICAgZGFzaDogW10sXHJcbiAgICAgICAgYXJyb3c6IHRydWUsXHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGVkZ2UudHlwZSA9PT0gXCJyZWxhdGVkXCIpIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBjb2xvcjogdGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDI1NSwyNTUsMjU1LDAuMilcIiA6IFwicmdiYSgwLDAsMCwwLjE1KVwiLFxyXG4gICAgICAgIHdpZHRoOiAxLjUsXHJcbiAgICAgICAgZGFzaDogWzYsIDRdLFxyXG4gICAgICAgIGFycm93OiBmYWxzZSxcclxuICAgICAgfTtcclxuICAgIH1cclxuICAgIGlmIChlZGdlLnR5cGUgPT09IFwidGFnX3NoYXJlZFwiKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgY29sb3I6IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjEpXCIgOiBcInJnYmEoMCwwLDAsMC4wOClcIixcclxuICAgICAgICB3aWR0aDogMS4yLFxyXG4gICAgICAgIGRhc2g6IFszLCA1XSxcclxuICAgICAgICBhcnJvdzogZmFsc2UsXHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgY29sb3I6IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjIpXCIgOiBcInJnYmEoMCwwLDAsMC4xNSlcIixcclxuICAgICAgd2lkdGg6IDEuNSxcclxuICAgICAgZGFzaDogW10sXHJcbiAgICAgIGFycm93OiBmYWxzZSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRyYXdBcnJvd0hlYWQoY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQsIHNvdXJjZTogR3JhcGhOb2RlLCB0YXJnZXQ6IEdyYXBoTm9kZSwgY29sb3I6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgZHggPSB0YXJnZXQueCAtIHNvdXJjZS54O1xyXG4gICAgY29uc3QgZHkgPSB0YXJnZXQueSAtIHNvdXJjZS55O1xyXG4gICAgY29uc3QgZGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSk7XHJcbiAgICBpZiAoZGlzdCA8IDAuMDAxKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB1eCA9IGR4IC8gZGlzdDtcclxuICAgIGNvbnN0IHV5ID0gZHkgLyBkaXN0O1xyXG4gICAgY29uc3QgdGlwWCA9IHRhcmdldC54IC0gdXggKiAodGFyZ2V0LnJhZGl1cyArIDIpO1xyXG4gICAgY29uc3QgdGlwWSA9IHRhcmdldC55IC0gdXkgKiAodGFyZ2V0LnJhZGl1cyArIDIpO1xyXG4gICAgY29uc3Qgc2l6ZSA9IDc7XHJcblxyXG4gICAgY3R4LmJlZ2luUGF0aCgpO1xyXG4gICAgY3R4Lm1vdmVUbyh0aXBYLCB0aXBZKTtcclxuICAgIGN0eC5saW5lVG8odGlwWCAtIHV4ICogc2l6ZSAtIHV5ICogKHNpemUgKiAwLjYpLCB0aXBZIC0gdXkgKiBzaXplICsgdXggKiAoc2l6ZSAqIDAuNikpO1xyXG4gICAgY3R4LmxpbmVUbyh0aXBYIC0gdXggKiBzaXplICsgdXkgKiAoc2l6ZSAqIDAuNiksIHRpcFkgLSB1eSAqIHNpemUgLSB1eCAqIChzaXplICogMC42KSk7XHJcbiAgICBjdHguY2xvc2VQYXRoKCk7XHJcbiAgICBjdHguZmlsbFN0eWxlID0gY29sb3I7XHJcbiAgICBjdHguZmlsbCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkcmF3VG9vbHRpcChuOiBHcmFwaE5vZGUpOiB2b2lkIHtcclxuICAgIGNvbnN0IGN0eCA9IHRoaXMuZW5zdXJlQ29udGV4dCgpO1xyXG4gICAgY29uc3Qgc3ggPSBuLnggKiB0aGlzLnNjYWxlICsgdGhpcy5vZmZzZXRYO1xyXG4gICAgY29uc3Qgc3kgPSBuLnkgKiB0aGlzLnNjYWxlICsgdGhpcy5vZmZzZXRZIC0gbi5yYWRpdXMgKiB0aGlzLnNjYWxlIC0gMTA7XHJcblxyXG4gICAgY29uc3QgbGluZXMgPSBbbi5uYW1lLCBgVHlwZTogJHtuLnR5cGV9YF07XHJcbiAgICBpZiAobi5saW5lYWdlUm9sZSkge1xyXG4gICAgICBsaW5lcy5wdXNoKGBSb2xlOiAke3RoaXMuY2FwaXRhbGl6ZShuLmxpbmVhZ2VSb2xlKX1gKTtcclxuICAgIH1cclxuICAgIGlmIChuLmxpbmVhZ2VEZXB0aCAhPSBudWxsKSB7XHJcbiAgICAgIGxpbmVzLnB1c2goYERlcHRoOiAke24ubGluZWFnZURlcHRofWApO1xyXG4gICAgfVxyXG4gICAgaWYgKG4uc2NvcmUgIT0gbnVsbCkge1xyXG4gICAgICBsaW5lcy5wdXNoKGBTY29yZTogJHtuLnNjb3JlLnRvRml4ZWQoMyl9YCk7XHJcbiAgICB9XHJcblxyXG4gICAgY3R4LmZvbnQgPSBcIjExcHggc2Fucy1zZXJpZlwiO1xyXG4gICAgY29uc3QgbWF4VyA9IE1hdGgubWF4KC4uLmxpbmVzLm1hcCgobGluZSkgPT4gY3R4Lm1lYXN1cmVUZXh0KGxpbmUpLndpZHRoKSkgKyAxNjtcclxuICAgIGNvbnN0IGggPSBsaW5lcy5sZW5ndGggKiAxNiArIDEwO1xyXG5cclxuICAgIGNvbnN0IHR4ID0gc3ggLSBtYXhXIC8gMjtcclxuICAgIGNvbnN0IHR5ID0gc3kgLSBoO1xyXG5cclxuICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMzAsMzAsMzAsMC45NSlcIiA6IFwicmdiYSgyNTUsMjU1LDI1NSwwLjk1KVwiO1xyXG4gICAgY3R4LnN0cm9rZVN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDI1NSwyNTUsMjU1LDAuMilcIiA6IFwicmdiYSgwLDAsMCwwLjE1KVwiO1xyXG4gICAgY3R4LmxpbmVXaWR0aCA9IDE7XHJcbiAgICB0aGlzLnJvdW5kUmVjdChjdHgsIHR4LCB0eSwgbWF4VywgaCwgNik7XHJcbiAgICBjdHguZmlsbCgpO1xyXG4gICAgY3R4LnN0cm9rZSgpO1xyXG5cclxuICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcIiNlMGUwZTBcIiA6IFwiIzMzMzMzM1wiO1xyXG4gICAgY3R4LnRleHRBbGlnbiA9IFwibGVmdFwiO1xyXG4gICAgbGluZXMuZm9yRWFjaCgobGluZSwgaW5kZXgpID0+IHtcclxuICAgICAgY3R4LmZpbGxUZXh0KGxpbmUsIHR4ICsgOCwgdHkgKyAxNiArIGluZGV4ICogMTYpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJvdW5kUmVjdChcclxuICAgIGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxyXG4gICAgeDogbnVtYmVyLFxyXG4gICAgeTogbnVtYmVyLFxyXG4gICAgdzogbnVtYmVyLFxyXG4gICAgaDogbnVtYmVyLFxyXG4gICAgcjogbnVtYmVyXHJcbiAgKTogdm9pZCB7XHJcbiAgICBjdHguYmVnaW5QYXRoKCk7XHJcbiAgICBjdHgubW92ZVRvKHggKyByLCB5KTtcclxuICAgIGN0eC5saW5lVG8oeCArIHcgLSByLCB5KTtcclxuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHggKyB3LCB5LCB4ICsgdywgeSArIHIpO1xyXG4gICAgY3R4LmxpbmVUbyh4ICsgdywgeSArIGggLSByKTtcclxuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHggKyB3LCB5ICsgaCwgeCArIHcgLSByLCB5ICsgaCk7XHJcbiAgICBjdHgubGluZVRvKHggKyByLCB5ICsgaCk7XHJcbiAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4LCB5ICsgaCwgeCwgeSArIGggLSByKTtcclxuICAgIGN0eC5saW5lVG8oeCwgeSArIHIpO1xyXG4gICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCwgeSwgeCArIHIsIHkpO1xyXG4gICAgY3R4LmNsb3NlUGF0aCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkcmF3RW1wdHkobXNnOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGN0eCA9IHRoaXMuZW5zdXJlQ29udGV4dCgpO1xyXG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5lbnN1cmVDYW52YXMoKTtcclxuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcclxuICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcIiM5OTlcIiA6IFwiIzY2NlwiO1xyXG4gICAgY3R4LmZvbnQgPSBcIjE0cHggc2Fucy1zZXJpZlwiO1xyXG4gICAgY3R4LnRleHRBbGlnbiA9IFwiY2VudGVyXCI7XHJcbiAgICBjb25zdCBsaW5lcyA9IG1zZy5zcGxpdChcIlxcblwiKTtcclxuICAgIGxpbmVzLmZvckVhY2goKGxpbmUsIGluZGV4KSA9PiB7XHJcbiAgICAgIGN0eC5maWxsVGV4dChsaW5lLCBjYW52YXMud2lkdGggLyAyLCBjYW52YXMuaGVpZ2h0IC8gMiArIGluZGV4ICogMjApO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNldHVwSW50ZXJhY3Rpb24oKTogdm9pZCB7XHJcbiAgICBjb25zdCBjYW52YXMgPSB0aGlzLmVuc3VyZUNhbnZhcygpO1xyXG5cclxuICAgIGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIChlKSA9PiB7XHJcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmhpdFRlc3QoZS5vZmZzZXRYLCBlLm9mZnNldFkpO1xyXG4gICAgICBpZiAobm9kZSkge1xyXG4gICAgICAgIHRoaXMuZHJhZ05vZGUgPSBub2RlO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuaXNQYW5uaW5nID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLnBhblN0YXJ0ID0geyB4OiBlLm9mZnNldFgsIHk6IGUub2Zmc2V0WSB9O1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMubGFzdE1vdXNlID0geyB4OiBlLm9mZnNldFgsIHk6IGUub2Zmc2V0WSB9O1xyXG4gICAgfSk7XHJcblxyXG4gICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgKGUpID0+IHtcclxuICAgICAgY29uc3QgZHggPSBlLm9mZnNldFggLSB0aGlzLmxhc3RNb3VzZS54O1xyXG4gICAgICBjb25zdCBkeSA9IGUub2Zmc2V0WSAtIHRoaXMubGFzdE1vdXNlLnk7XHJcblxyXG4gICAgICBpZiAodGhpcy5kcmFnTm9kZSkge1xyXG4gICAgICAgIHRoaXMuZHJhZ05vZGUueCArPSBkeCAvIHRoaXMuc2NhbGU7XHJcbiAgICAgICAgdGhpcy5kcmFnTm9kZS55ICs9IGR5IC8gdGhpcy5zY2FsZTtcclxuICAgICAgICB0aGlzLmRyYWdOb2RlLnZ4ID0gMDtcclxuICAgICAgICB0aGlzLmRyYWdOb2RlLnZ5ID0gMDtcclxuICAgICAgICBpZiAoIXRoaXMuc2ltUnVubmluZykge1xyXG4gICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNQYW5uaW5nKSB7XHJcbiAgICAgICAgdGhpcy5vZmZzZXRYICs9IGR4O1xyXG4gICAgICAgIHRoaXMub2Zmc2V0WSArPSBkeTtcclxuICAgICAgICBpZiAoIXRoaXMuc2ltUnVubmluZykge1xyXG4gICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnN0IHByZXZpb3VzID0gdGhpcy5ob3ZlcmVkTm9kZTtcclxuICAgICAgICB0aGlzLmhvdmVyZWROb2RlID0gdGhpcy5oaXRUZXN0KGUub2Zmc2V0WCwgZS5vZmZzZXRZKTtcclxuICAgICAgICBjYW52YXMuc3R5bGUuY3Vyc29yID0gdGhpcy5ob3ZlcmVkTm9kZSA/IFwicG9pbnRlclwiIDogXCJkZWZhdWx0XCI7XHJcbiAgICAgICAgaWYgKHByZXZpb3VzICE9PSB0aGlzLmhvdmVyZWROb2RlICYmICF0aGlzLnNpbVJ1bm5pbmcpIHtcclxuICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICB0aGlzLmxhc3RNb3VzZSA9IHsgeDogZS5vZmZzZXRYLCB5OiBlLm9mZnNldFkgfTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCAoZSkgPT4ge1xyXG4gICAgICBpZiAodGhpcy5kcmFnTm9kZSkge1xyXG4gICAgICAgIGNvbnN0IGR4ID0gTWF0aC5hYnMoZS5vZmZzZXRYIC0gdGhpcy5sYXN0TW91c2UueCk7XHJcbiAgICAgICAgY29uc3QgZHkgPSBNYXRoLmFicyhlLm9mZnNldFkgLSB0aGlzLmxhc3RNb3VzZS55KTtcclxuICAgICAgICBpZiAoZHggPCAzICYmIGR5IDwgMykge1xyXG4gICAgICAgICAgdGhpcy5vcGVuTm90ZSh0aGlzLmRyYWdOb2RlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5kcmFnTm9kZSA9IG51bGw7XHJcbiAgICAgIHRoaXMuaXNQYW5uaW5nID0gZmFsc2U7XHJcbiAgICB9KTtcclxuXHJcbiAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XHJcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmhpdFRlc3QoZS5vZmZzZXRYLCBlLm9mZnNldFkpO1xyXG4gICAgICBpZiAoIW5vZGUpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgaWYgKG5vZGUuX2NsdXN0ZXJJbmRleCAhPSBudWxsKSB7XHJcbiAgICAgICAgdm9pZCB0aGlzLmRyaWxsSW50b0NsdXN0ZXIobm9kZS5fY2x1c3RlckluZGV4KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLm9wZW5Ob3RlKG5vZGUpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcclxuICAgICAgXCJ3aGVlbFwiLFxyXG4gICAgICAoZSkgPT4ge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBjb25zdCB6b29tID0gZS5kZWx0YVkgPCAwID8gMS4xIDogMC45O1xyXG4gICAgICAgIGNvbnN0IG14ID0gZS5vZmZzZXRYO1xyXG4gICAgICAgIGNvbnN0IG15ID0gZS5vZmZzZXRZO1xyXG4gICAgICAgIHRoaXMub2Zmc2V0WCA9IG14IC0gem9vbSAqIChteCAtIHRoaXMub2Zmc2V0WCk7XHJcbiAgICAgICAgdGhpcy5vZmZzZXRZID0gbXkgLSB6b29tICogKG15IC0gdGhpcy5vZmZzZXRZKTtcclxuICAgICAgICB0aGlzLnNjYWxlID0gTWF0aC5tYXgoMC4yLCBNYXRoLm1pbig1LCB0aGlzLnNjYWxlICogem9vbSkpO1xyXG4gICAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB7XHJcbiAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHsgcGFzc2l2ZTogZmFsc2UgfVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGl0VGVzdChteDogbnVtYmVyLCBteTogbnVtYmVyKTogR3JhcGhOb2RlIHwgbnVsbCB7XHJcbiAgICBjb25zdCB4ID0gKG14IC0gdGhpcy5vZmZzZXRYKSAvIHRoaXMuc2NhbGU7XHJcbiAgICBjb25zdCB5ID0gKG15IC0gdGhpcy5vZmZzZXRZKSAvIHRoaXMuc2NhbGU7XHJcbiAgICBmb3IgKGxldCBpID0gdGhpcy5ub2Rlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICBjb25zdCBuID0gdGhpcy5ub2Rlc1tpXTtcclxuICAgICAgY29uc3QgZHggPSB4IC0gbi54O1xyXG4gICAgICBjb25zdCBkeSA9IHkgLSBuLnk7XHJcbiAgICAgIGlmIChkeCAqIGR4ICsgZHkgKiBkeSA8PSAobi5yYWRpdXMgKyA0KSAqIChuLnJhZGl1cyArIDQpKSB7XHJcbiAgICAgICAgcmV0dXJuIG47XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBvcGVuTm90ZShub2RlOiBHcmFwaE5vZGUpOiB2b2lkIHtcclxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLnJlc29sdmVGaWxlRm9yTm9kZShub2RlKTtcclxuICAgIGlmIChmaWxlKSB7XHJcbiAgICAgIHZvaWQgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYodHJ1ZSkub3BlbkZpbGUoZmlsZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc29sdmVGaWxlRm9yTm9kZShub2RlOiBHcmFwaE5vZGUpOiBURmlsZSB8IG51bGwge1xyXG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IFtub2RlLnBhdGgsIG5vZGUuaWQsIGAke25vZGUucGF0aCA/PyBcIlwifS5tZGAsIGAke25vZGUuaWR9Lm1kYF1cclxuICAgICAgLmZpbHRlcigoY2FuZGlkYXRlKTogY2FuZGlkYXRlIGlzIHN0cmluZyA9PiBCb29sZWFuKGNhbmRpZGF0ZSkpXHJcbiAgICAgIC5tYXAoKGNhbmRpZGF0ZSkgPT4gY2FuZGlkYXRlLnJlcGxhY2UoL15cXC8rLywgXCJcIikpO1xyXG5cclxuICAgIGZvciAoY29uc3QgY2FuZGlkYXRlIG9mIGNhbmRpZGF0ZXMpIHtcclxuICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjYW5kaWRhdGUpO1xyXG4gICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XHJcbiAgICAgICAgcmV0dXJuIGZpbGU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBmaXRUb1ZpZXcoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5ub2Rlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgbGV0IG1pblggPSBJbmZpbml0eTtcclxuICAgIGxldCBtYXhYID0gLUluZmluaXR5O1xyXG4gICAgbGV0IG1pblkgPSBJbmZpbml0eTtcclxuICAgIGxldCBtYXhZID0gLUluZmluaXR5O1xyXG4gICAgZm9yIChjb25zdCBuIG9mIHRoaXMubm9kZXMpIHtcclxuICAgICAgbWluWCA9IE1hdGgubWluKG1pblgsIG4ueCAtIG4ucmFkaXVzKTtcclxuICAgICAgbWF4WCA9IE1hdGgubWF4KG1heFgsIG4ueCArIG4ucmFkaXVzKTtcclxuICAgICAgbWluWSA9IE1hdGgubWluKG1pblksIG4ueSAtIG4ucmFkaXVzKTtcclxuICAgICAgbWF4WSA9IE1hdGgubWF4KG1heFksIG4ueSArIG4ucmFkaXVzKTtcclxuICAgIH1cclxuICAgIGNvbnN0IHBhZCA9IDUwO1xyXG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5lbnN1cmVDYW52YXMoKTtcclxuICAgIGNvbnN0IHcgPSBjYW52YXMud2lkdGg7XHJcbiAgICBjb25zdCBoID0gY2FudmFzLmhlaWdodDtcclxuICAgIGNvbnN0IGd3ID0gbWF4WCAtIG1pblggKyBwYWQgKiAyO1xyXG4gICAgY29uc3QgZ2ggPSBtYXhZIC0gbWluWSArIHBhZCAqIDI7XHJcbiAgICB0aGlzLnNjYWxlID0gTWF0aC5taW4odyAvIGd3LCBoIC8gZ2gsIDEuOCk7XHJcbiAgICB0aGlzLm9mZnNldFggPSB3IC8gMiAtICgobWluWCArIG1heFgpIC8gMikgKiB0aGlzLnNjYWxlO1xyXG4gICAgdGhpcy5vZmZzZXRZID0gaCAvIDIgLSAoKG1pblkgKyBtYXhZKSAvIDIpICogdGhpcy5zY2FsZTtcclxuICAgIHRoaXMuZHJhdygpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXNpemVDYW52YXMoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuY2FudmFzKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IHJlY3QgPSB0aGlzLmNhbnZhcy5wYXJlbnRFbGVtZW50Py5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgIGlmICghcmVjdCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLmNhbnZhcy53aWR0aCA9IHJlY3Qud2lkdGg7XHJcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSByZWN0LmhlaWdodDtcclxuICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB7XHJcbiAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzZXRTdGF0dXModGV4dDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5zdGF0dXNFbCkge1xyXG4gICAgICB0aGlzLnN0YXR1c0VsLnRleHRDb250ZW50ID0gdGV4dDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyTGVnZW5kKCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmxlZ2VuZEVsKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmxlZ2VuZEVsLmVtcHR5KCk7XHJcbiAgICBpZiAodGhpcy52aWV3TW9kZSAhPT0gXCJsaW5lYWdlXCIpIHtcclxuICAgICAgdGhpcy5sZWdlbmRFbC5oaWRlKCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmxlZ2VuZEVsLnNob3coKTtcclxuICAgIGNvbnN0IGl0ZW1zOiBBcnJheTx7IGtleTogTGluZWFnZVJvbGU7IGxhYmVsOiBzdHJpbmcgfT4gPSBbXHJcbiAgICAgIHsga2V5OiBcImNlbnRlclwiLCBsYWJlbDogXCJDZW50ZXJcIiB9LFxyXG4gICAgICB7IGtleTogXCJ1cHN0cmVhbVwiLCBsYWJlbDogXCJVcHN0cmVhbVwiIH0sXHJcbiAgICAgIHsga2V5OiBcImRvd25zdHJlYW1cIiwgbGFiZWw6IFwiRG93bnN0cmVhbVwiIH0sXHJcbiAgICAgIHsga2V5OiBcImJyaWRnZVwiLCBsYWJlbDogXCJCcmlkZ2VcIiB9LFxyXG4gICAgXTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcclxuICAgICAgY29uc3QgY2hpcCA9IHRoaXMubGVnZW5kRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm1uZW1vLWdyYXBoLWxlZ2VuZC1jaGlwXCIgfSk7XHJcbiAgICAgIGNvbnN0IGRvdCA9IGNoaXAuY3JlYXRlU3Bhbih7IGNsczogXCJtbmVtby1ncmFwaC1sZWdlbmQtZG90XCIgfSk7XHJcbiAgICAgIGRvdC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBMSU5FQUdFX0NPTE9SU1tpdGVtLmtleV07XHJcbiAgICAgIGNoaXAuY3JlYXRlU3Bhbih7IHRleHQ6IGl0ZW0ubGFiZWwgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgbm90ZSA9IHRoaXMubGVnZW5kRWwuY3JlYXRlU3Bhbih7IHRleHQ6IFwiTm9kZSBjb3JlID0gZW50aXR5IHR5cGUgPyBoYWxvID0gbGluZWFnZSByb2xlXCIsIGNsczogXCJtbmVtby1ncmFwaC1sZWdlbmQtbm90ZVwiIH0pO1xyXG4gICAgbm90ZS5zZXRBdHRyKFwidGl0bGVcIiwgXCJFbnRpdHkgY29sb3Igc3RheXMgaW4gdGhlIG5vZGUgY29yZTsgbGluZWFnZSByb2xlIGlzIHNob3duIGFzIGhhbG8vb3V0bGluZVwiKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbm9ybWFsaXplTGluZWFnZVJvbGUocm9sZT86IHN0cmluZyk6IExpbmVhZ2VSb2xlIHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSAocm9sZSA/PyBcIlwiKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgaWYgKG5vcm1hbGl6ZWQgPT09IFwiY2VudGVyXCIgfHwgbm9ybWFsaXplZCA9PT0gXCJ1cHN0cmVhbVwiIHx8IG5vcm1hbGl6ZWQgPT09IFwiZG93bnN0cmVhbVwiIHx8IG5vcm1hbGl6ZWQgPT09IFwiYnJpZGdlXCIpIHtcclxuICAgICAgcmV0dXJuIG5vcm1hbGl6ZWQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gXCJ1bmtub3duXCI7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBpY2tMaW5lYWdlRWRnZVJvbGUoYTogR3JhcGhOb2RlLCBiOiBHcmFwaE5vZGUpOiBMaW5lYWdlUm9sZSB7XHJcbiAgICBpZiAoYS5saW5lYWdlUm9sZSA9PT0gXCJicmlkZ2VcIiB8fCBiLmxpbmVhZ2VSb2xlID09PSBcImJyaWRnZVwiKSB7XHJcbiAgICAgIHJldHVybiBcImJyaWRnZVwiO1xyXG4gICAgfVxyXG4gICAgaWYgKGEubGluZWFnZVJvbGUgPT09IFwidXBzdHJlYW1cIiB8fCBiLmxpbmVhZ2VSb2xlID09PSBcInVwc3RyZWFtXCIpIHtcclxuICAgICAgcmV0dXJuIFwidXBzdHJlYW1cIjtcclxuICAgIH1cclxuICAgIGlmIChhLmxpbmVhZ2VSb2xlID09PSBcImRvd25zdHJlYW1cIiB8fCBiLmxpbmVhZ2VSb2xlID09PSBcImRvd25zdHJlYW1cIikge1xyXG4gICAgICByZXR1cm4gXCJkb3duc3RyZWFtXCI7XHJcbiAgICB9XHJcbiAgICBpZiAoYS5saW5lYWdlUm9sZSA9PT0gXCJjZW50ZXJcIiB8fCBiLmxpbmVhZ2VSb2xlID09PSBcImNlbnRlclwiKSB7XHJcbiAgICAgIHJldHVybiBcImNlbnRlclwiO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFwidW5rbm93blwiO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBub3JtYWxpemVQYXRoKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gcGF0aC5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIikucmVwbGFjZSgvXlxcLysvLCBcIlwiKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbWF0Y2hlc1BhdGgoaWQ6IHN0cmluZywgcGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkLCBjYW5kaWRhdGVzOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3Qgbm9ybWFsaXplZENhbmRpZGF0ZXMgPSBjYW5kaWRhdGVzLm1hcCgoY2FuZGlkYXRlKSA9PiB0aGlzLm5vcm1hbGl6ZVBhdGgoY2FuZGlkYXRlKSk7XHJcbiAgICByZXR1cm4gbm9ybWFsaXplZENhbmRpZGF0ZXMuaW5jbHVkZXModGhpcy5ub3JtYWxpemVQYXRoKGlkKSlcclxuICAgICAgfHwgKHBhdGggPyBub3JtYWxpemVkQ2FuZGlkYXRlcy5pbmNsdWRlcyh0aGlzLm5vcm1hbGl6ZVBhdGgocGF0aCkpIDogZmFsc2UpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRSZXF1ZXN0ZWRQYXRoKHBhdGg/OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgaWYgKHBhdGgpIHtcclxuICAgICAgcmV0dXJuIHBhdGg7XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5jZW50ZXJQYXRoKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmNlbnRlclBhdGg7XHJcbiAgICB9XHJcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcclxuICAgIHJldHVybiBmaWxlPy5wYXRoID8/IFwiXCI7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc2V0Vmlld3BvcnQoKTogdm9pZCB7XHJcbiAgICB0aGlzLm9mZnNldFggPSAwO1xyXG4gICAgdGhpcy5vZmZzZXRZID0gMDtcclxuICAgIHRoaXMuc2NhbGUgPSAxO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB3aXRoQWxwaGEoaGV4Q29sb3I6IHN0cmluZywgYWxwaGE6IG51bWJlcik6IHN0cmluZyB7XHJcbiAgICBjb25zdCBjb2xvciA9IGhleENvbG9yLnJlcGxhY2UoXCIjXCIsIFwiXCIpO1xyXG4gICAgaWYgKGNvbG9yLmxlbmd0aCAhPT0gNikge1xyXG4gICAgICByZXR1cm4gaGV4Q29sb3I7XHJcbiAgICB9XHJcbiAgICBjb25zdCByID0gTnVtYmVyLnBhcnNlSW50KGNvbG9yLnNsaWNlKDAsIDIpLCAxNik7XHJcbiAgICBjb25zdCBnID0gTnVtYmVyLnBhcnNlSW50KGNvbG9yLnNsaWNlKDIsIDQpLCAxNik7XHJcbiAgICBjb25zdCBiID0gTnVtYmVyLnBhcnNlSW50KGNvbG9yLnNsaWNlKDQsIDYpLCAxNik7XHJcbiAgICByZXR1cm4gYHJnYmEoJHtyfSwgJHtnfSwgJHtifSwgJHthbHBoYX0pYDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2FwaXRhbGl6ZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB2YWx1ZS5sZW5ndGggPiAwID8gYCR7dmFsdWVbMF0udG9VcHBlckNhc2UoKX0ke3ZhbHVlLnNsaWNlKDEpfWAgOiB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZW5zdXJlQ2FudmFzKCk6IEhUTUxDYW52YXNFbGVtZW50IHtcclxuICAgIGlmICghdGhpcy5jYW52YXMpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiR3JhcGggY2FudmFzIGlzIG5vdCByZWFkeVwiKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLmNhbnZhcztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZW5zdXJlQ29udGV4dCgpOiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQge1xyXG4gICAgaWYgKCF0aGlzLmN0eCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJHcmFwaCBjYW52YXMgY29udGV4dCBpcyBub3QgcmVhZHlcIik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5jdHg7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGlzRGFya1RoZW1lKCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmNvbnRhaW5zKFwidGhlbWUtZGFya1wiKTtcclxuICB9XHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUMsSUFBQUEsbUJBQStCOzs7QUNBL0Isc0JBQTJCO0FBc0hyQixJQUFNLGlCQUFOLE1BQXFCO0FBQUEsRUFDMUIsWUFBb0IsU0FBaUI7QUFBakI7QUFBQSxFQUFrQjtBQUFBLEVBRXRDLFdBQVcsS0FBbUI7QUFDNUIsU0FBSyxVQUFVLElBQUksUUFBUSxRQUFRLEVBQUU7QUFBQSxFQUN2QztBQUFBO0FBQUEsRUFHQSxNQUFNLE9B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QUErQjtBQUMzQyxVQUFNLFdBQVcsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLHFCQUFxQjtBQUN6RSxRQUFJO0FBQ0osUUFBSSxTQUFTLFNBQVMsR0FBRztBQUN2QixhQUFPLFNBQVMsQ0FBQztBQUFBLElBQ25CLE9BQU87QUFDTCxhQUFPLEtBQUssSUFBSSxVQUFVLGFBQWEsS0FBSztBQUM1QyxZQUFNLEtBQUssYUFBYSxFQUFFLE1BQU0sdUJBQXVCLFFBQVEsS0FBSyxDQUFDO0FBQUEsSUFDdkU7QUFDQSxVQUFNLEtBQUssSUFBSSxVQUFVLFdBQVcsSUFBSTtBQUd4QyxVQUFNLE9BQU8sS0FBSyxJQUFJLFVBQVUsY0FBYztBQUM5QyxRQUFJLE1BQU07QUFDUixZQUFNLE9BQU8sS0FBSztBQUNsQixXQUFLLGNBQWMsS0FBSyxJQUFJO0FBQUEsSUFDOUI7QUFBQSxFQUNGO0FBQ0Y7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiJdCn0K
