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
    new import_obsidian2.Setting(containerEl).setName("Mnemo SecondBrain settings").setHeading();
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
    this.setPlaceholder("Search Mnemo...");
  }
  results = [];
  debounceTimer = null;
  async getSuggestions(query) {
    if (!query || query.length < 2) return [];
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
  async onChooseSuggestion(result) {
    let path = result.path || `${result.title}.md`;
    if (!path.endsWith(".md")) path += ".md";
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian3.TFile) {
      await this.app.workspace.getLeaf().openFile(file);
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
  insight: "#F1C40F"
};
var DEFAULT_COLOR = "#888888";
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
  // 카메라
  offsetX = 0;
  offsetY = 0;
  scale = 1;
  // 인터랙션
  dragNode = null;
  isPanning = false;
  lastMouse = { x: 0, y: 0 };
  hoveredNode = null;
  animFrame = 0;
  simRunning = false;
  simIterations = 0;
  centerPath = "";
  viewMode = "local";
  clusterData = [];
  backBtn = null;
  allBtns = [];
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
    const localBtn = toolbar.createEl("button", { text: "\u{1F4CD} Local", cls: "mnemo-graph-btn mnemo-graph-btn-active", attr: { title: "Current note graph" } });
    localBtn.addEventListener("click", () => {
      this.setActiveBtn(localBtn);
      this.viewMode = "local";
      void this.loadGraph();
    });
    const clusterBtn = toolbar.createEl("button", { text: "\u{1F52E} Explore", cls: "mnemo-graph-btn", attr: { title: "Explore by clusters" } });
    clusterBtn.addEventListener("click", () => {
      this.setActiveBtn(clusterBtn);
      this.viewMode = "cluster";
      void this.loadClusters();
    });
    const fullBtn = toolbar.createEl("button", { text: "\u{1F310} Full", cls: "mnemo-graph-btn", attr: { title: "Full knowledge graph" } });
    fullBtn.addEventListener("click", () => {
      this.setActiveBtn(fullBtn);
      this.viewMode = "full";
      void this.loadFullGraph();
    });
    this.backBtn = toolbar.createEl("button", { text: "\u2190 Back", cls: "mnemo-graph-btn", attr: { title: "Back to clusters" } });
    this.backBtn.hide();
    this.backBtn.addEventListener("click", () => {
      this.backBtn.hide();
      void this.loadClusters();
    });
    this.allBtns = [localBtn, clusterBtn, fullBtn];
    const refreshBtn = toolbar.createEl("button", { text: "\u21BB", cls: "mnemo-graph-btn", attr: { title: "Refresh" } });
    refreshBtn.addEventListener("click", () => {
      void (this.viewMode === "full" ? this.loadFullGraph() : this.loadGraph());
    });
    const fitBtn = toolbar.createEl("button", { text: "\u22A1", cls: "mnemo-graph-btn", attr: { title: "Fit to view" } });
    fitBtn.addEventListener("click", () => this.fitToView());
    this.canvas = container.createEl("canvas", { cls: "mnemo-graph-canvas" });
    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();
    this.registerDomEvent(window, "resize", () => this.resizeCanvas());
    this.setupInteraction();
    await this.loadGraph();
  }
  onClose() {
    this.simRunning = false;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    return Promise.resolve();
  }
  // 현재 노트 기준 로드
  async loadGraph(path) {
    if (!path) {
      const file = this.app.workspace.getActiveFile();
      path = file ? file.path : "";
    }
    if (!path) {
      this.drawEmpty("Open a note, then refresh");
      return;
    }
    this.centerPath = path;
    const apiPath = path.replace(/\.md$/, "");
    const data = await this.apiClient.subgraph(apiPath, 1);
    if (!data || data.nodes.length === 0) {
      this.drawEmpty("No graph data for this note");
      return;
    }
    let nodes = data.nodes;
    let edges = data.edges;
    if (nodes.length > 80) {
      const keep = /* @__PURE__ */ new Set();
      const centerNode = nodes.find((n) => n.id === path || n.id === path.replace(/\.md$/, ""));
      if (centerNode) keep.add(centerNode.id);
      const sorted = [...nodes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      for (const n of sorted) {
        if (keep.size >= 80) break;
        keep.add(n.id);
      }
      nodes = nodes.filter((n) => keep.has(n.id));
      edges = edges.filter((e) => keep.has(e.source) && keep.has(e.target));
    }
    this.buildGraph(nodes, edges, apiPath);
    this.runSimulation();
  }
  setCenterPath(path) {
    void this.loadGraph(path);
  }
  setActiveBtn(active) {
    for (const btn of this.allBtns) btn.removeClass("mnemo-graph-btn-active");
    active.addClass("mnemo-graph-btn-active");
    if (this.backBtn) this.backBtn.hide();
  }
  async loadClusters() {
    this.drawEmpty("Loading clusters...");
    const data = await this.apiClient.clusters();
    if (!data || !data.clusters || data.clusters.length === 0) {
      this.drawEmpty("No cluster data");
      return;
    }
    this.clusterData = data.clusters;
    const w = this.canvas.width;
    const h = this.canvas.height;
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
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
    this.simRunning = false;
    this.draw();
  }
  async drillIntoCluster(clusterIndex) {
    this.drawEmpty("Loading cluster detail...");
    const data = await this.apiClient.clusterDetail(clusterIndex);
    if (!data || data.nodes.length === 0) {
      this.drawEmpty("Empty cluster");
      return;
    }
    const w = this.canvas.width;
    const h = this.canvas.height;
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
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
    this.simRunning = false;
    if (this.backBtn) this.backBtn.show();
    this.draw();
  }
  async loadFullGraph() {
    this.drawEmpty("Loading full graph...");
    const data = await this.apiClient.fullGraph();
    if (!data || data.nodes.length === 0) {
      this.drawEmpty("No graph data");
      return;
    }
    const w = this.canvas.width;
    const h = this.canvas.height;
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
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
    this.simRunning = false;
    this.draw();
  }
  // ===== 그래프 빌드 =====
  buildGraph(nodes, edges, centerPath) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2, cy = h / 2;
    this.nodes = nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      score: n.score,
      x: n.id === centerPath ? cx : cx + (Math.random() - 0.5) * 300,
      y: n.id === centerPath ? cy : cy + (Math.random() - 0.5) * 300,
      vx: 0,
      vy: 0,
      radius: n.id === centerPath ? 18 : 12,
      isCenter: n.id === centerPath
    }));
    this.edges = edges;
    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
  }
  // ===== Force-directed 시뮬레이션 =====
  runSimulation() {
    this.simRunning = true;
    this.simIterations = 0;
    const tick = () => {
      if (!this.simRunning) return;
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
    const w = this.canvas.width / 2;
    const h = this.canvas.height / 2;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
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
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
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
  // ===== 렌더링 =====
  draw() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    for (const e of this.edges) {
      const a = this.nodeMap.get(e.source);
      const b = this.nodeMap.get(e.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = this.isDarkTheme() ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1.5;
      if (e.type === "related") {
        ctx.setLineDash([6, 4]);
      } else if (e.type === "tag_shared") {
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = this.isDarkTheme() ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const n of this.nodes) {
      const color = TYPE_COLORS[n.type] || DEFAULT_COLOR;
      const isHovered = this.hoveredNode === n;
      if (n.isCenter) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = color + "33";
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + (isHovered ? 3 : 0), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = isHovered ? "#ffffff" : this.isDarkTheme() ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)";
      ctx.lineWidth = isHovered ? 2.5 : 1;
      ctx.stroke();
      ctx.fillStyle = this.isDarkTheme() ? "#e0e0e0" : "#333333";
      ctx.font = n.isCenter ? "bold 11px sans-serif" : "10px sans-serif";
      ctx.textAlign = "center";
      const isHov = this.hoveredNode === n;
      if (isHov || n.isCenter) {
        const label = n.name.length > 40 ? n.name.slice(0, 38) + "\u2026" : n.name;
        ctx.fillText(label, n.x, n.y + n.radius + 14);
      } else if (this.scale > 0.6 && n.radius >= 5) {
        const short = n.name.length > 12 ? n.name.slice(0, 10) + "\u2026" : n.name;
        ctx.fillText(short, n.x, n.y + n.radius + 14);
      }
    }
    ctx.restore();
    if (this.hoveredNode) {
      this.drawTooltip(this.hoveredNode);
    }
  }
  drawTooltip(n) {
    const ctx = this.ctx;
    const sx = n.x * this.scale + this.offsetX;
    const sy = n.y * this.scale + this.offsetY - n.radius * this.scale - 10;
    const lines = [n.name, `Type: ${n.type}`];
    if (n.score != null) lines.push(`Score: ${n.score.toFixed(3)}`);
    ctx.font = "11px sans-serif";
    const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
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
    lines.forEach((line, i) => {
      ctx.fillText(line, tx + 8, ty + 16 + i * 16);
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
    const ctx = this.ctx;
    const canvas = this.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = this.isDarkTheme() ? "#999" : "#666";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
  }
  // ===== 인터랙션 =====
  setupInteraction() {
    const c = this.canvas;
    c.addEventListener("mousedown", (e) => {
      const node = this.hitTest(e.offsetX, e.offsetY);
      if (node) {
        this.dragNode = node;
      } else {
        this.isPanning = true;
      }
      this.lastMouse = { x: e.offsetX, y: e.offsetY };
    });
    c.addEventListener("mousemove", (e) => {
      const dx = e.offsetX - this.lastMouse.x;
      const dy = e.offsetY - this.lastMouse.y;
      if (this.dragNode) {
        this.dragNode.x += dx / this.scale;
        this.dragNode.y += dy / this.scale;
        this.dragNode.vx = 0;
        this.dragNode.vy = 0;
        if (!this.simRunning) this.draw();
      } else if (this.isPanning) {
        this.offsetX += dx;
        this.offsetY += dy;
        if (!this.simRunning) this.draw();
      } else {
        const prev = this.hoveredNode;
        this.hoveredNode = this.hitTest(e.offsetX, e.offsetY);
        c.style.cursor = this.hoveredNode ? "pointer" : "default";
        if (prev !== this.hoveredNode && !this.simRunning) this.draw();
      }
      this.lastMouse = { x: e.offsetX, y: e.offsetY };
    });
    c.addEventListener("mouseup", (e) => {
      if (this.dragNode) {
        const dx = Math.abs(e.offsetX - this.lastMouse.x);
        const dy = Math.abs(e.offsetY - this.lastMouse.y);
        if (dx < 3 && dy < 3) {
          this.openNote(this.dragNode.id);
        }
      }
      this.dragNode = null;
      this.isPanning = false;
    });
    c.addEventListener("click", (e) => {
      const node = this.hitTest(e.offsetX, e.offsetY);
      if (node) {
        if (node._clusterIndex != null) {
          void this.drillIntoCluster(node._clusterIndex);
        } else {
          this.openNote(node.id);
        }
      }
    });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoom = e.deltaY < 0 ? 1.1 : 0.9;
      const mx = e.offsetX, my = e.offsetY;
      this.offsetX = mx - zoom * (mx - this.offsetX);
      this.offsetY = my - zoom * (my - this.offsetY);
      this.scale *= zoom;
      this.scale = Math.max(0.2, Math.min(5, this.scale));
      if (!this.simRunning) this.draw();
    }, { passive: false });
  }
  hitTest(mx, my) {
    const x = (mx - this.offsetX) / this.scale;
    const y = (my - this.offsetY) / this.scale;
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const dx = x - n.x, dy = y - n.y;
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) return n;
    }
    return null;
  }
  openNote(id) {
    const file = this.app.vault.getAbstractFileByPath(id);
    if (file) {
      void this.app.workspace.openLinkText(id, "", true);
    }
  }
  fitToView() {
    if (this.nodes.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      minX = Math.min(minX, n.x - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    }
    const pad = 40;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const gw = maxX - minX + pad * 2;
    const gh = maxY - minY + pad * 2;
    this.scale = Math.min(w / gw, h / gh, 2);
    this.offsetX = w / 2 - (minX + maxX) / 2 * this.scale;
    this.offsetY = h / 2 - (minY + maxY) / 2 * this.scale;
    this.draw();
  }
  // ===== 유틸 =====
  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    if (!this.simRunning) this.draw();
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
      name: "Search Mnemo",
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
      name: "Mnemo: Open graph view",
      callback: () => {
        void this.openGraphView();
      }
    });
    this.addCommand({
      id: "mnemo-check-status",
      name: "Check Mnemo server status",
      callback: async () => {
        const stats = await this.apiClient.stats();
        if (stats) {
          new import_obsidian5.Notice(`Mnemo: ${stats.total_notes} notes, ${stats.total_edges} edges`);
        } else {
          new import_obsidian5.Notice("Mnemo: \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 / Server unreachable");
        }
      }
    });
    console.debug("Mnemo SecondBrain plugin loaded");
  }
  onunload() {
    console.debug("Mnemo SecondBrain plugin unloaded");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
    this.app.workspace.revealLeaf(leaf);
    const file = this.app.workspace.getActiveFile();
    if (file) {
      const view = leaf.view;
      view.setCenterPath(file.path);
    }
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2FwaS1jbGllbnQudHMiLCAic3JjL3NldHRpbmdzLnRzIiwgInNyYy9zZWFyY2gtbW9kYWwudHMiLCAic3JjL2dyYXBoLXZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIlx1RkVGRmltcG9ydCB7IFBsdWdpbiwgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBNbmVtb0FwaUNsaWVudCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcbmltcG9ydCB7IE1uZW1vU2V0dGluZ3MsIE1uZW1vU2V0dGluZ1RhYiwgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBNbmVtb1NlYXJjaE1vZGFsIH0gZnJvbSBcIi4vc2VhcmNoLW1vZGFsXCI7XG5pbXBvcnQgeyBNbmVtb0dyYXBoVmlldywgTU5FTU9fR1JBUEhfVklFV19UWVBFIH0gZnJvbSBcIi4vZ3JhcGgtdmlld1wiO1xuXG4vLyBNbmVtbyBTZWNvbmRCcmFpbiBPYnNpZGlhbiBQbHVnaW5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1uZW1vUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IE1uZW1vU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuICBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50ID0gbmV3IE1uZW1vQXBpQ2xpZW50KERFRkFVTFRfU0VUVElOR1MuYXBpVXJsKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFwaUNsaWVudC5zZXRCYXNlVXJsKHRoaXMuc2V0dGluZ3MuYXBpVXJsKTtcblxuICAgIC8vIFx1QzEyNFx1QzgxNSBcdUQwRUQgXHVCNEYxXHVCODVEIC8gUmVnaXN0ZXIgc2V0dGluZ3MgdGFiXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNbmVtb1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIC8vIFx1QjlBQ1x1QkNGOCBcdUM1NDRcdUM3NzRcdUNGNTggLyBSaWJib24gaWNvblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcImJyYWluXCIsIFwiTW5lbW8gc2VhcmNoXCIsICgpID0+IHtcbiAgICAgIG5ldyBNbmVtb1NlYXJjaE1vZGFsKHRoaXMuYXBwLCB0aGlzLmFwaUNsaWVudCwgdGhpcy5zZXR0aW5ncykub3BlbigpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1Q0VFNFx1QjlFOFx1QjREQyAvIFNlYXJjaCBjb21tYW5kXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLXNlYXJjaFwiLFxuICAgICAgbmFtZTogXCJTZWFyY2ggTW5lbW9cIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIG5ldyBNbmVtb1NlYXJjaE1vZGFsKHRoaXMuYXBwLCB0aGlzLmFwaUNsaWVudCwgdGhpcy5zZXR0aW5ncykub3BlbigpO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFx1QURGOFx1Qjc5OFx1RDUwNCBcdUJERjAgXHVCNEYxXHVCODVEIC8gUmVnaXN0ZXIgZ3JhcGggdmlld1xuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFxuICAgICAgTU5FTU9fR1JBUEhfVklFV19UWVBFLFxuICAgICAgKGxlYWYpID0+IG5ldyBNbmVtb0dyYXBoVmlldyhsZWFmLCB0aGlzLmFwaUNsaWVudClcbiAgICApO1xuXG4gICAgLy8gXHVBREY4XHVCNzk4XHVENTA0IFx1QkRGMCBcdUI5QUNcdUJDRjggXHVDNTQ0XHVDNzc0XHVDRjU4XG4gICAgdGhpcy5hZGRSaWJib25JY29uKFwiZ2l0LWZvcmtcIiwgXCJNbmVtbyBncmFwaFwiLCAoKSA9PiB7XG4gICAgICB2b2lkIHRoaXMub3BlbkdyYXBoVmlldygpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBREY4XHVCNzk4XHVENTA0IFx1QkRGMCBcdUM1RjRcdUFFMzAgXHVDRUU0XHVCOUU4XHVCNERDXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLW9wZW4tZ3JhcGhcIixcbiAgICAgIG5hbWU6IFwiTW5lbW86IE9wZW4gZ3JhcGggdmlld1wiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHsgdm9pZCB0aGlzLm9wZW5HcmFwaFZpZXcoKTsgfSxcbiAgICB9KTtcblxuICAgIC8vIFx1QzExQ1x1QkM4NCBcdUMwQzFcdUQwREMgXHVENjU1XHVDNzc4IC8gQ2hlY2sgc2VydmVyIG9uIGxvYWRcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwibW5lbW8tY2hlY2stc3RhdHVzXCIsXG4gICAgICBuYW1lOiBcIkNoZWNrIE1uZW1vIHNlcnZlciBzdGF0dXNcIixcbiAgICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuc3RhdHMoKTtcbiAgICAgICAgaWYgKHN0YXRzKSB7XG4gICAgICAgICAgbmV3IE5vdGljZShgTW5lbW86ICR7c3RhdHMudG90YWxfbm90ZXN9IG5vdGVzLCAke3N0YXRzLnRvdGFsX2VkZ2VzfSBlZGdlc2ApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5ldyBOb3RpY2UoXCJNbmVtbzogXHVDMTFDXHVCQzg0XHVDNUQwIFx1QzVGMFx1QUNCMFx1RDU2MCBcdUMyMTggXHVDNUM2XHVDMkI1XHVCMkM4XHVCMkU0IC8gU2VydmVyIHVucmVhY2hhYmxlXCIpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc29sZS5kZWJ1ZyhcIk1uZW1vIFNlY29uZEJyYWluIHBsdWdpbiBsb2FkZWRcIik7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBjb25zb2xlLmRlYnVnKFwiTW5lbW8gU2Vjb25kQnJhaW4gcGx1Z2luIHVubG9hZGVkXCIpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIG9wZW5HcmFwaFZpZXcoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKE1ORU1PX0dSQVBIX1ZJRVdfVFlQRSk7XG4gICAgbGV0IGxlYWY6IGltcG9ydChcIm9ic2lkaWFuXCIpLldvcmtzcGFjZUxlYWY7XG4gICAgaWYgKGV4aXN0aW5nLmxlbmd0aCA+IDApIHtcbiAgICAgIGxlYWYgPSBleGlzdGluZ1swXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpITtcbiAgICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHsgdHlwZTogTU5FTU9fR1JBUEhfVklFV19UWVBFLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xuXG4gICAgLy8gXHVENjA0XHVDN0FDIFx1QjE3OFx1RDJCOCBcdUFFMzBcdUM5MDBcdUM3M0NcdUI4NUMgXHVBREY4XHVCNzk4XHVENTA0IFx1Qjg1Q1x1QjREQ1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgIGlmIChmaWxlKSB7XG4gICAgICBjb25zdCB2aWV3ID0gbGVhZi52aWV3IGFzIE1uZW1vR3JhcGhWaWV3O1xuICAgICAgdmlldy5zZXRDZW50ZXJQYXRoKGZpbGUucGF0aCk7XG4gICAgfVxuICB9XG59XHJcbiIsICJcdUZFRkZpbXBvcnQgeyByZXF1ZXN0VXJsIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbi8vIE1uZW1vIEFQSSBcdUFDODBcdUMwQzkgXHVBQ0IwXHVBQ0ZDIFx1RDBDMFx1Qzc4NSAvIFNlYXJjaCByZXN1bHQgdHlwZVxuZXhwb3J0IGludGVyZmFjZSBNbmVtb1NlYXJjaFJlc3VsdCB7XG4gIG5hbWU6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgc25pcHBldDogc3RyaW5nO1xuICBzY29yZTogbnVtYmVyO1xuICBlbnRpdHlfdHlwZT86IHN0cmluZztcbiAgc291cmNlPzogc3RyaW5nO1xuICBwYXRoPzogc3RyaW5nO1xufVxuXG4vLyBNbmVtbyBcdUMxMUNcdUJDODQgXHVEMUI1XHVBQ0M0IC8gU2VydmVyIHN0YXRzXG5leHBvcnQgaW50ZXJmYWNlIE1uZW1vU3RhdHMge1xuICB0b3RhbF9ub3RlczogbnVtYmVyO1xuICB0b3RhbF9lZGdlczogbnVtYmVyO1xuICBpbmRleF9zdGF0dXM6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdWJncmFwaE5vZGUge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbiAgc2NvcmU/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3ViZ3JhcGhFZGdlIHtcbiAgc291cmNlOiBzdHJpbmc7XG4gIHRhcmdldDogc3RyaW5nO1xuICB0eXBlOiBzdHJpbmc7XG59XG5cbi8vIEFQSSBcdUM3NTFcdUIyRjUgXHVCMEI0XHVCRDgwIFx1RDBDMFx1Qzc4NSAvIEludGVybmFsIEFQSSByZXNwb25zZSB0eXBlc1xuaW50ZXJmYWNlIFJhd1NlYXJjaFJlc3VsdCB7XG4gIG5hbWU/OiBzdHJpbmc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBrZXk/OiBzdHJpbmc7XG4gIHNuaXBwZXQ/OiBzdHJpbmc7XG4gIHNjb3JlPzogbnVtYmVyO1xuICBlbnRpdHlfdHlwZT86IHN0cmluZztcbiAgc291cmNlPzogc3RyaW5nO1xuICBwYXRoPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgU2VhcmNoQXBpUmVzcG9uc2Uge1xuICByZXN1bHRzPzogUmF3U2VhcmNoUmVzdWx0W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2x1c3RlckluZm8ge1xuICBpZDogc3RyaW5nO1xuICBodWJfbmFtZTogc3RyaW5nO1xuICBzaXplOiBudW1iZXI7XG4gIGRvbWluYW50X3R5cGU6IHN0cmluZztcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIGluZGV4OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2x1c3RlcnNSZXNwb25zZSB7XG4gIGNsdXN0ZXJzOiBDbHVzdGVySW5mb1tdO1xuICBlZGdlcz86IEFycmF5PHsgc291cmNlOiBzdHJpbmc7IHRhcmdldDogc3RyaW5nIH0+O1xufVxuXG4vLyBcdUMwQUNcdUM4MDQgXHVBQ0M0XHVDMEIwXHVCNDFDIFx1QjgwOFx1Qzc3NFx1QzU0NFx1QzZDMyBcdUM4OENcdUQ0NUNcdUI5N0MgXHVEM0VDXHVENTY4XHVENTVDIFx1QjE3OFx1QjREQyBcdUQwQzBcdUM3ODVcbmV4cG9ydCBpbnRlcmZhY2UgU3ViZ3JhcGhOb2RlV2l0aExheW91dCBleHRlbmRzIFN1YmdyYXBoTm9kZSB7XG4gIGRlZ3JlZT86IG51bWJlcjtcbiAgeD86IG51bWJlcjtcbiAgeT86IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIE1uZW1vQXBpQ2xpZW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmcpIHt9XG5cbiAgc2V0QmFzZVVybCh1cmw6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuYmFzZVVybCA9IHVybC5yZXBsYWNlKC9cXC8rJC8sIFwiXCIpO1xuICB9XG5cbiAgLy8gXHVBQzgwXHVDMEM5IEFQSSBcdUQ2MzhcdUNEOUMgLyBDYWxsIHNlYXJjaCBBUElcbiAgYXN5bmMgc2VhcmNoKFxuICAgIHF1ZXJ5OiBzdHJpbmcsXG4gICAgbW9kZTogc3RyaW5nID0gXCJoeWJyaWRcIixcbiAgICBsaW1pdDogbnVtYmVyID0gMTBcbiAgKTogUHJvbWlzZTxNbmVtb1NlYXJjaFJlc3VsdFtdPiB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7IHE6IHF1ZXJ5LCBtb2RlLCBsaW1pdDogU3RyaW5nKGxpbWl0KSB9KTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L3NlYXJjaD8ke3BhcmFtc31gO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgY29uc3QgZGF0YSA9IHJlc3BvbnNlLmpzb24gYXMgU2VhcmNoQXBpUmVzcG9uc2UgfCBSYXdTZWFyY2hSZXN1bHRbXTtcbiAgICAgIGNvbnN0IHJhd1Jlc3VsdHM6IFJhd1NlYXJjaFJlc3VsdFtdID0gQXJyYXkuaXNBcnJheShkYXRhKVxuICAgICAgICA/IGRhdGFcbiAgICAgICAgOiAoZGF0YS5yZXN1bHRzID8/IFtdKTtcbiAgICAgIHJldHVybiByYXdSZXN1bHRzLm1hcCgocjogUmF3U2VhcmNoUmVzdWx0KTogTW5lbW9TZWFyY2hSZXN1bHQgPT4gKHtcbiAgICAgICAgbmFtZTogci5uYW1lID8/IFwiXCIsXG4gICAgICAgIHRpdGxlOiByLnRpdGxlIHx8IHIubmFtZSB8fCByLmtleSB8fCBcIlVudGl0bGVkXCIsXG4gICAgICAgIHNuaXBwZXQ6IHIuc25pcHBldCA/PyBcIlwiLFxuICAgICAgICBzY29yZTogci5zY29yZSA/PyAwLFxuICAgICAgICBlbnRpdHlfdHlwZTogci5lbnRpdHlfdHlwZSxcbiAgICAgICAgc291cmNlOiByLnNvdXJjZSxcbiAgICAgICAgcGF0aDogci5wYXRoLFxuICAgICAgfSkpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1QzExQ1x1QkM4NCBcdUMwQzFcdUQwREMgXHVENjU1XHVDNzc4IC8gQ2hlY2sgc2VydmVyIHN0YXRzXG4gIGFzeW5jIHN0YXRzKCk6IFByb21pc2U8TW5lbW9TdGF0cyB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgICAgdXJsOiBgJHt0aGlzLmJhc2VVcmx9L3N0YXRzYCxcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzcG9uc2UuanNvbiBhcyBNbmVtb1N0YXRzO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVDMTFDXHVCRTBDXHVBREY4XHVCNzk4XHVENTA0IFx1Qzg3MFx1RDY4QyAvIEdldCBzdWJncmFwaCBmb3IgdmlzdWFsaXphdGlvblxuICBhc3luYyBzdWJncmFwaChcbiAgICBjZW50ZXI6IHN0cmluZyxcbiAgICBkZXB0aDogbnVtYmVyID0gMlxuICApOiBQcm9taXNlPHsgbm9kZXM6IFN1YmdyYXBoTm9kZVtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW10gfSB8IG51bGw+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHsgY2VudGVyLCBkZXB0aDogU3RyaW5nKGRlcHRoKSB9KTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2dyYXBoL3N1YmdyYXBoPyR7cGFyYW1zfWA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlW107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSB9O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVEMDc0XHVCN0VDXHVDMkE0XHVEMTMwIFx1QURGOFx1Qjc5OFx1RDUwNCAoXHVBQ0M0XHVDRTM1XHVDODAxIFx1RDBEMFx1QzBDOSkgLyBDbHVzdGVyIGdyYXBoIGZvciBkcmlsbC1kb3duXG4gIGFzeW5jIGNsdXN0ZXJzKCk6IFByb21pc2U8Q2x1c3RlcnNSZXNwb25zZSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHsgdXJsOiBgJHt0aGlzLmJhc2VVcmx9L2dyYXBoL2NsdXN0ZXJzYCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgQ2x1c3RlcnNSZXNwb25zZTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZXJyKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1RDA3NFx1QjdFQ1x1QzJBNFx1RDEzMCBcdUMwQzFcdUMxMzggKGRyaWxsLWRvd24pIC8gQ2x1c3RlciBkZXRhaWxcbiAgYXN5bmMgY2x1c3RlckRldGFpbChpbmRleDogbnVtYmVyKTogUHJvbWlzZTx7IG5vZGVzOiBTdWJncmFwaE5vZGVXaXRoTGF5b3V0W107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSB9IHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmw6IGAke3RoaXMuYmFzZVVybH0vZ3JhcGgvY2x1c3Rlci8ke2luZGV4fWAsIG1ldGhvZDogXCJHRVRcIiB9KTtcbiAgICAgIHJldHVybiByZXNwb25zZS5qc29uIGFzIHsgbm9kZXM6IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXRbXTsgZWRnZXM6IFN1YmdyYXBoRWRnZVtdIH07XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLmhhbmRsZUVycm9yKGVycik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvLyBcdUM4MDRcdUNDQjQgXHVBREY4XHVCNzk4XHVENTA0IChcdUMwQUNcdUM4MDQgXHVBQ0M0XHVDMEIwIFx1QjgwOFx1Qzc3NFx1QzU0NFx1QzZDMykgLyBGdWxsIGdyYXBoIHdpdGggcHJlY29tcHV0ZWQgbGF5b3V0XG4gIGFzeW5jIGZ1bGxHcmFwaCgpOiBQcm9taXNlPHsgbm9kZXM6IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXRbXTsgZWRnZXM6IFN1YmdyYXBoRWRnZVtdOyBsYXlvdXQ6IHN0cmluZyB9IHwgbnVsbD4ge1xuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0vZ3JhcGgvZnVsbGA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlV2l0aExheW91dFtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW107IGxheW91dDogc3RyaW5nIH07XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLmhhbmRsZUVycm9yKGVycik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvLyBcdUM1RDBcdUI3RUMgXHVDQzk4XHVCOUFDIC8gRXJyb3IgaGFuZGxpbmcgd2l0aCBmcmllbmRseSBtZXNzYWdlc1xuICBwcml2YXRlIGhhbmRsZUVycm9yKGVycjogdW5rbm93bik6IHZvaWQge1xuICAgIGNvbnN0IG1zZyA9IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKTtcbiAgICBpZiAobXNnLmluY2x1ZGVzKFwiRUNPTk5SRUZVU0VEXCIpIHx8IG1zZy5pbmNsdWRlcyhcIm5ldDo6RVJSXCIpKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBgW01uZW1vXSBcdUMxMUNcdUJDODRcdUM1RDAgXHVDNUYwXHVBQ0IwXHVENTYwIFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQuIE1uZW1vIFx1QzExQ1x1QkM4NFx1QUMwMCBcdUMyRTRcdUQ1ODkgXHVDOTExXHVDNzc4XHVDOUMwIFx1RDY1NVx1Qzc3OFx1RDU1OFx1QzEzOFx1QzY5NC5cXG5gICtcbiAgICAgICAgICBgQ2Fubm90IGNvbm5lY3QgdG8gTW5lbW8gc2VydmVyIGF0ICR7dGhpcy5iYXNlVXJsfS4gSXMgaXQgcnVubmluZz9gXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBbTW5lbW9dIEFQSSBlcnJvcjogJHttc2d9YCk7XG4gICAgfVxuICB9XG59XHJcbiIsICJcdUZFRkZpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIE1uZW1vUGx1Z2luIGZyb20gXCIuL21haW5cIjtcblxuLy8gXHVENTBDXHVCN0VDXHVBREY4XHVDNzc4IFx1QzEyNFx1QzgxNSBcdUM3NzhcdUQxMzBcdUQzOThcdUM3NzRcdUMyQTQgLyBQbHVnaW4gc2V0dGluZ3MgaW50ZXJmYWNlXG5leHBvcnQgaW50ZXJmYWNlIE1uZW1vU2V0dGluZ3Mge1xuICBhcGlVcmw6IHN0cmluZztcbiAgc2VhcmNoTGltaXQ6IG51bWJlcjtcbiAgc2VhcmNoTW9kZTogXCJoeWJyaWRcIiB8IFwidmVjdG9yXCIgfCBcImtleXdvcmRcIiB8IFwiZ3JhcGhcIjtcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IE1uZW1vU2V0dGluZ3MgPSB7XG4gIGFwaVVybDogXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIixcbiAgc2VhcmNoTGltaXQ6IDEwLFxuICBzZWFyY2hNb2RlOiBcImh5YnJpZFwiLFxufTtcblxuLy8gXHVDMTI0XHVDODE1IFx1RDBFRCAvIFNldHRpbmdzIHRhYlxuZXhwb3J0IGNsYXNzIE1uZW1vU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IE1uZW1vUGx1Z2luO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE1uZW1vUGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiTW5lbW8gU2Vjb25kQnJhaW4gc2V0dGluZ3NcIilcbiAgICAgIC5zZXRIZWFkaW5nKCk7XG5cbiAgICAvLyBBUEkgVVJMIFx1QzEyNFx1QzgxNVxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJNbmVtbyBBUEkgVVJMXCIpXG4gICAgICAuc2V0RGVzYyhcIk1uZW1vIEZhc3RBUEkgc2VydmVyIGFkZHJlc3MgKGRlZmF1bHQ6IGh0dHA6Ly8xMjcuMC4wLjE6ODAwMClcIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiaHR0cDovLzEyNy4wLjAuMTo4MDAwXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaVVybClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlVcmwgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmFwaUNsaWVudC5zZXRCYXNlVXJsKHZhbHVlKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1QUNCMFx1QUNGQyBcdUMyMThcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiU2VhcmNoIHJlc3VsdCBsaW1pdFwiKVxuICAgICAgLnNldERlc2MoXCJNYXhpbXVtIG51bWJlciBvZiBzZWFyY2ggcmVzdWx0cyB0byBzaG93XCIpXG4gICAgICAuYWRkU2xpZGVyKChzbGlkZXIpID0+XG4gICAgICAgIHNsaWRlclxuICAgICAgICAgIC5zZXRMaW1pdHMoNSwgNTAsIDUpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNlYXJjaExpbWl0KVxuICAgICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTGltaXQgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1QkFBOFx1QjREQ1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJTZWFyY2ggbW9kZVwiKVxuICAgICAgLnNldERlc2MoXCJTZWxlY3QgdGhlIHNlYXJjaCBtZXRob2QgdG8gdXNlXCIpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxuICAgICAgICBkcm9wZG93blxuICAgICAgICAgIC5hZGRPcHRpb25zKHtcbiAgICAgICAgICAgIGh5YnJpZDogXCJIeWJyaWQgKGtleXdvcmQgKyB2ZWN0b3IpXCIsXG4gICAgICAgICAgICB2ZWN0b3I6IFwiVmVjdG9yIChzZW1hbnRpYylcIixcbiAgICAgICAgICAgIGtleXdvcmQ6IFwiS2V5d29yZCAoQk0yNSlcIixcbiAgICAgICAgICAgIGdyYXBoOiBcIkdyYXBoIChyZWxhdGlvbnNoaXApXCIsXG4gICAgICAgICAgfSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTW9kZSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zZWFyY2hNb2RlID0gdmFsdWUgYXMgTW5lbW9TZXR0aW5nc1tcInNlYXJjaE1vZGVcIl07XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxufVxyXG4iLCAiXHVGRUZGaW1wb3J0IHsgQXBwLCBTdWdnZXN0TW9kYWwsIE5vdGljZSwgVEZpbGUgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIHsgTW5lbW9BcGlDbGllbnQsIE1uZW1vU2VhcmNoUmVzdWx0IH0gZnJvbSBcIi4vYXBpLWNsaWVudFwiO1xuaW1wb3J0IHR5cGUgeyBNbmVtb1NldHRpbmdzIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcblxuLy8gTW5lbW8gXHVBQzgwXHVDMEM5IFx1QkFBOFx1QjJFQyAvIFNlYXJjaCBtb2RhbFxuZXhwb3J0IGNsYXNzIE1uZW1vU2VhcmNoTW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8TW5lbW9TZWFyY2hSZXN1bHQ+IHtcbiAgcHJpdmF0ZSByZXN1bHRzOiBNbmVtb1NlYXJjaFJlc3VsdFtdID0gW107XG4gIHByaXZhdGUgZGVib3VuY2VUaW1lcjogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGFwaUNsaWVudDogTW5lbW9BcGlDbGllbnQsXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogTW5lbW9TZXR0aW5nc1xuICApIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJTZWFyY2ggTW5lbW8uLi5cIik7XG4gIH1cblxuICBhc3luYyBnZXRTdWdnZXN0aW9ucyhxdWVyeTogc3RyaW5nKTogUHJvbWlzZTxNbmVtb1NlYXJjaFJlc3VsdFtdPiB7XG4gICAgaWYgKCFxdWVyeSB8fCBxdWVyeS5sZW5ndGggPCAyKSByZXR1cm4gW107XG5cbiAgICAvLyBcdUI1MTRcdUJDMTRcdUM2QjRcdUMyQTQgMzAwbXMgLyBEZWJvdW5jZSBpbnB1dFxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lcikgY2xlYXJUaW1lb3V0KHRoaXMuZGVib3VuY2VUaW1lcik7XG4gICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuc2VhcmNoKFxuICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgIHRoaXMuc2V0dGluZ3Muc2VhcmNoTW9kZSxcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLnNlYXJjaExpbWl0XG4gICAgICAgICk7XG4gICAgICAgIHJlc29sdmUodGhpcy5yZXN1bHRzKTtcbiAgICAgIH0sIDMwMCk7XG4gICAgfSk7XG4gIH1cblxuICByZW5kZXJTdWdnZXN0aW9uKHJlc3VsdDogTW5lbW9TZWFyY2hSZXN1bHQsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGVsLmNyZWF0ZURpdih7IGNsczogXCJtbmVtby1zZWFyY2gtcmVzdWx0XCIgfSk7XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHtcbiAgICAgIHRleHQ6IHJlc3VsdC50aXRsZSxcbiAgICAgIGNsczogXCJtbmVtby1yZXN1bHQtdGl0bGVcIixcbiAgICB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJzbWFsbFwiLCB7XG4gICAgICB0ZXh0OiByZXN1bHQuc25pcHBldCxcbiAgICAgIGNsczogXCJtbmVtby1yZXN1bHQtc25pcHBldFwiLFxuICAgIH0pO1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcInNwYW5cIiwge1xuICAgICAgdGV4dDogYHNjb3JlOiAke3Jlc3VsdC5zY29yZS50b0ZpeGVkKDMpfWAsXG4gICAgICBjbHM6IFwibW5lbW8tcmVzdWx0LXNjb3JlXCIsXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBvbkNob29zZVN1Z2dlc3Rpb24ocmVzdWx0OiBNbmVtb1NlYXJjaFJlc3VsdCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIFx1QkNGQ1x1RDJCOFx1QzVEMFx1QzExQyBcdUQ1NzRcdUIyRjkgXHVCMTc4XHVEMkI4IFx1QzVGNFx1QUUzMCAvIE9wZW4gbWF0Y2hpbmcgbm90ZSBpbiB2YXVsdFxuICAgIGxldCBwYXRoID0gcmVzdWx0LnBhdGggfHwgYCR7cmVzdWx0LnRpdGxlfS5tZGA7XG4gICAgaWYgKCFwYXRoLmVuZHNXaXRoKFwiLm1kXCIpKSBwYXRoICs9IFwiLm1kXCI7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcblxuICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUoZmlsZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ldyBOb3RpY2UoYFx1QjE3OFx1RDJCOFx1Qjk3QyBcdUNDM0VcdUM3NDQgXHVDMjE4IFx1QzVDNlx1QzJCNVx1QjJDOFx1QjJFNDogJHtyZXN1bHQudGl0bGV9XFxuTm90ZSBub3QgZm91bmQgaW4gdmF1bHQuYCk7XG4gICAgfVxuICB9XG59XHJcbiIsICJcdUZFRkZpbXBvcnQgeyBJdGVtVmlldywgV29ya3NwYWNlTGVhZiB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgeyBNbmVtb0FwaUNsaWVudCwgU3ViZ3JhcGhOb2RlLCBTdWJncmFwaEVkZ2UsIENsdXN0ZXJJbmZvLCBTdWJncmFwaE5vZGVXaXRoTGF5b3V0IH0gZnJvbSBcIi4vYXBpLWNsaWVudFwiO1xuXG5leHBvcnQgY29uc3QgTU5FTU9fR1JBUEhfVklFV19UWVBFID0gXCJtbmVtby1ncmFwaC12aWV3XCI7XG5cbi8vIFx1QzBDOVx1QzBDMSBcdUI5RjUgKGVudGl0eV90eXBlXHVCQ0M0KVxuY29uc3QgVFlQRV9DT0xPUlM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIGV2ZW50OiBcIiM0QTkwRDlcIixcbiAgcHJvamVjdDogXCIjRTg5MTNBXCIsXG4gIG5vdGU6IFwiIzUwQzg3OFwiLFxuICBzb3VyY2U6IFwiIzlCNTlCNlwiLFxuICBkZWNpc2lvbjogXCIjRTc0QzNDXCIsXG4gIGluc2lnaHQ6IFwiI0YxQzQwRlwiLFxufTtcbmNvbnN0IERFRkFVTFRfQ09MT1IgPSBcIiM4ODg4ODhcIjtcblxuaW50ZXJmYWNlIEdyYXBoTm9kZSB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzY29yZT86IG51bWJlcjtcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIHZ4OiBudW1iZXI7XG4gIHZ5OiBudW1iZXI7XG4gIHJhZGl1czogbnVtYmVyO1xuICBpc0NlbnRlcjogYm9vbGVhbjtcbiAgX2NsdXN0ZXJJbmRleD86IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIEdyYXBoRWRnZSB7XG4gIHNvdXJjZTogc3RyaW5nO1xuICB0YXJnZXQ6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgTW5lbW9HcmFwaFZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gIHByaXZhdGUgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgbm9kZXM6IEdyYXBoTm9kZVtdID0gW107XG4gIHByaXZhdGUgZWRnZXM6IEdyYXBoRWRnZVtdID0gW107XG4gIHByaXZhdGUgbm9kZU1hcDogTWFwPHN0cmluZywgR3JhcGhOb2RlPiA9IG5ldyBNYXAoKTtcblxuICAvLyBcdUNFNzRcdUJBNTRcdUI3N0NcbiAgcHJpdmF0ZSBvZmZzZXRYID0gMDtcbiAgcHJpdmF0ZSBvZmZzZXRZID0gMDtcbiAgcHJpdmF0ZSBzY2FsZSA9IDE7XG5cbiAgLy8gXHVDNzc4XHVEMTMwXHVCNzk5XHVDMTU4XG4gIHByaXZhdGUgZHJhZ05vZGU6IEdyYXBoTm9kZSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGlzUGFubmluZyA9IGZhbHNlO1xuICBwcml2YXRlIGxhc3RNb3VzZSA9IHsgeDogMCwgeTogMCB9O1xuICBwcml2YXRlIGhvdmVyZWROb2RlOiBHcmFwaE5vZGUgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBhbmltRnJhbWUgPSAwO1xuICBwcml2YXRlIHNpbVJ1bm5pbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBzaW1JdGVyYXRpb25zID0gMDtcblxuICBwcml2YXRlIGNlbnRlclBhdGggPSBcIlwiO1xuICBwcml2YXRlIHZpZXdNb2RlOiBcImxvY2FsXCIgfCBcImZ1bGxcIiB8IFwiY2x1c3RlclwiID0gXCJsb2NhbFwiO1xuICBwcml2YXRlIGNsdXN0ZXJEYXRhOiBDbHVzdGVySW5mb1tdID0gW107XG4gIHByaXZhdGUgYmFja0J0bjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBhbGxCdG5zOiBIVE1MRWxlbWVudFtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgbGVhZjogV29ya3NwYWNlTGVhZixcbiAgICBwcml2YXRlIGFwaUNsaWVudDogTW5lbW9BcGlDbGllbnRcbiAgKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcgeyByZXR1cm4gTU5FTU9fR1JBUEhfVklFV19UWVBFOyB9XG4gIGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7IHJldHVybiBcIk1uZW1vIGdyYXBoXCI7IH1cbiAgZ2V0SWNvbigpOiBzdHJpbmcgeyByZXR1cm4gXCJnaXQtZm9ya1wiOyB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyRWwuY2hpbGRyZW5bMV0gYXMgSFRNTEVsZW1lbnQ7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgY29udGFpbmVyLmFkZENsYXNzKFwibW5lbW8tZ3JhcGgtY29udGFpbmVyXCIpO1xuXG4gICAgLy8gXHVEMjM0XHVCQzE0XG4gICAgY29uc3QgdG9vbGJhciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwibW5lbW8tZ3JhcGgtdG9vbGJhclwiIH0pO1xuICAgIHRvb2xiYXIuY3JlYXRlRWwoXCJzcGFuXCIsIHsgdGV4dDogXCJNbmVtbyBncmFwaFwiLCBjbHM6IFwibW5lbW8tZ3JhcGgtdGl0bGVcIiB9KTtcblxuICAgIGNvbnN0IGxvY2FsQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHVEODNEXHVEQ0NEIExvY2FsXCIsIGNsczogXCJtbmVtby1ncmFwaC1idG4gbW5lbW8tZ3JhcGgtYnRuLWFjdGl2ZVwiLCBhdHRyOiB7IHRpdGxlOiBcIkN1cnJlbnQgbm90ZSBncmFwaFwiIH0gfSk7XG4gICAgbG9jYWxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHsgdGhpcy5zZXRBY3RpdmVCdG4obG9jYWxCdG4pOyB0aGlzLnZpZXdNb2RlID0gXCJsb2NhbFwiOyB2b2lkIHRoaXMubG9hZEdyYXBoKCk7IH0pO1xuXG4gICAgY29uc3QgY2x1c3RlckJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1RDgzRFx1REQyRSBFeHBsb3JlXCIsIGNsczogXCJtbmVtby1ncmFwaC1idG5cIiwgYXR0cjogeyB0aXRsZTogXCJFeHBsb3JlIGJ5IGNsdXN0ZXJzXCIgfSB9KTtcbiAgICBjbHVzdGVyQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7IHRoaXMuc2V0QWN0aXZlQnRuKGNsdXN0ZXJCdG4pOyB0aGlzLnZpZXdNb2RlID0gXCJjbHVzdGVyXCI7IHZvaWQgdGhpcy5sb2FkQ2x1c3RlcnMoKTsgfSk7XG5cbiAgICBjb25zdCBmdWxsQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHVEODNDXHVERjEwIEZ1bGxcIiwgY2xzOiBcIm1uZW1vLWdyYXBoLWJ0blwiLCBhdHRyOiB7IHRpdGxlOiBcIkZ1bGwga25vd2xlZGdlIGdyYXBoXCIgfSB9KTtcbiAgICBmdWxsQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7IHRoaXMuc2V0QWN0aXZlQnRuKGZ1bGxCdG4pOyB0aGlzLnZpZXdNb2RlID0gXCJmdWxsXCI7IHZvaWQgdGhpcy5sb2FkRnVsbEdyYXBoKCk7IH0pO1xuXG4gICAgdGhpcy5iYWNrQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyMTkwIEJhY2tcIiwgY2xzOiBcIm1uZW1vLWdyYXBoLWJ0blwiLCBhdHRyOiB7IHRpdGxlOiBcIkJhY2sgdG8gY2x1c3RlcnNcIiB9IH0pO1xuICAgIHRoaXMuYmFja0J0bi5oaWRlKCk7XG4gICAgdGhpcy5iYWNrQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7IHRoaXMuYmFja0J0biEuaGlkZSgpOyB2b2lkIHRoaXMubG9hZENsdXN0ZXJzKCk7IH0pO1xuXG4gICAgdGhpcy5hbGxCdG5zID0gW2xvY2FsQnRuLCBjbHVzdGVyQnRuLCBmdWxsQnRuXTtcblxuICAgIGNvbnN0IHJlZnJlc2hCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTIxQkJcIiwgY2xzOiBcIm1uZW1vLWdyYXBoLWJ0blwiLCBhdHRyOiB7IHRpdGxlOiBcIlJlZnJlc2hcIiB9IH0pO1xuICAgIHJlZnJlc2hCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHsgdm9pZCAodGhpcy52aWV3TW9kZSA9PT0gXCJmdWxsXCIgPyB0aGlzLmxvYWRGdWxsR3JhcGgoKSA6IHRoaXMubG9hZEdyYXBoKCkpOyB9KTtcblxuICAgIGNvbnN0IGZpdEJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1MjJBMVwiLCBjbHM6IFwibW5lbW8tZ3JhcGgtYnRuXCIsIGF0dHI6IHsgdGl0bGU6IFwiRml0IHRvIHZpZXdcIiB9IH0pO1xuICAgIGZpdEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5maXRUb1ZpZXcoKSk7XG5cbiAgICAvLyBcdUNFOTRcdUJDODRcdUMyQTRcbiAgICB0aGlzLmNhbnZhcyA9IGNvbnRhaW5lci5jcmVhdGVFbChcImNhbnZhc1wiLCB7IGNsczogXCJtbmVtby1ncmFwaC1jYW52YXNcIiB9KTtcbiAgICB0aGlzLmN0eCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcblxuICAgIHRoaXMucmVzaXplQ2FudmFzKCk7XG4gICAgdGhpcy5yZWdpc3RlckRvbUV2ZW50KHdpbmRvdywgXCJyZXNpemVcIiwgKCkgPT4gdGhpcy5yZXNpemVDYW52YXMoKSk7XG4gICAgdGhpcy5zZXR1cEludGVyYWN0aW9uKCk7XG4gICAgYXdhaXQgdGhpcy5sb2FkR3JhcGgoKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuYW5pbUZyYW1lKSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLmFuaW1GcmFtZSk7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG5cbiAgLy8gXHVENjA0XHVDN0FDIFx1QjE3OFx1RDJCOCBcdUFFMzBcdUM5MDAgXHVCODVDXHVCNERDXG4gIGFzeW5jIGxvYWRHcmFwaChwYXRoPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFwYXRoKSB7XG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgIHBhdGggPSBmaWxlID8gZmlsZS5wYXRoIDogXCJcIjtcbiAgICB9XG4gICAgaWYgKCFwYXRoKSB7XG4gICAgICB0aGlzLmRyYXdFbXB0eShcIk9wZW4gYSBub3RlLCB0aGVuIHJlZnJlc2hcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuY2VudGVyUGF0aCA9IHBhdGg7XG4gICAgY29uc3QgYXBpUGF0aCA9IHBhdGgucmVwbGFjZSgvXFwubWQkLywgXCJcIik7XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuc3ViZ3JhcGgoYXBpUGF0aCwgMSk7XG4gICAgaWYgKCFkYXRhIHx8IGRhdGEubm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLmRyYXdFbXB0eShcIk5vIGdyYXBoIGRhdGEgZm9yIHRoaXMgbm90ZVwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBcdUIxNzhcdUI0REMgXHVDMjE4IFx1QzgxQ1x1RDU1QyAoXHVDMTMxXHVCMkE1IFx1MjAxNCBcdUNENUNcdUIzMDAgODBcdUIxNzhcdUI0REMpXG4gICAgbGV0IG5vZGVzID0gZGF0YS5ub2RlcztcbiAgICBsZXQgZWRnZXMgPSBkYXRhLmVkZ2VzO1xuICAgIGlmIChub2Rlcy5sZW5ndGggPiA4MCkge1xuICAgICAgY29uc3Qga2VlcCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgY29uc3QgY2VudGVyTm9kZSA9IG5vZGVzLmZpbmQobiA9PiBuLmlkID09PSBwYXRoIHx8IG4uaWQgPT09IHBhdGghLnJlcGxhY2UoL1xcLm1kJC8sIFwiXCIpKTtcbiAgICAgIGlmIChjZW50ZXJOb2RlKSBrZWVwLmFkZChjZW50ZXJOb2RlLmlkKTtcbiAgICAgIGNvbnN0IHNvcnRlZCA9IFsuLi5ub2Rlc10uc29ydCgoYSwgYikgPT4gKGIuc2NvcmUgPz8gMCkgLSAoYS5zY29yZSA/PyAwKSk7XG4gICAgICBmb3IgKGNvbnN0IG4gb2Ygc29ydGVkKSB7XG4gICAgICAgIGlmIChrZWVwLnNpemUgPj0gODApIGJyZWFrO1xuICAgICAgICBrZWVwLmFkZChuLmlkKTtcbiAgICAgIH1cbiAgICAgIG5vZGVzID0gbm9kZXMuZmlsdGVyKG4gPT4ga2VlcC5oYXMobi5pZCkpO1xuICAgICAgZWRnZXMgPSBlZGdlcy5maWx0ZXIoZSA9PiBrZWVwLmhhcyhlLnNvdXJjZSkgJiYga2VlcC5oYXMoZS50YXJnZXQpKTtcbiAgICB9XG5cbiAgICB0aGlzLmJ1aWxkR3JhcGgobm9kZXMsIGVkZ2VzLCBhcGlQYXRoKTtcbiAgICB0aGlzLnJ1blNpbXVsYXRpb24oKTtcbiAgfVxuXG4gIHNldENlbnRlclBhdGgocGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgdm9pZCB0aGlzLmxvYWRHcmFwaChwYXRoKTtcbiAgfVxuXG4gIHByaXZhdGUgc2V0QWN0aXZlQnRuKGFjdGl2ZTogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGJ0biBvZiB0aGlzLmFsbEJ0bnMpIGJ0bi5yZW1vdmVDbGFzcyhcIm1uZW1vLWdyYXBoLWJ0bi1hY3RpdmVcIik7XG4gICAgYWN0aXZlLmFkZENsYXNzKFwibW5lbW8tZ3JhcGgtYnRuLWFjdGl2ZVwiKTtcbiAgICBpZiAodGhpcy5iYWNrQnRuKSB0aGlzLmJhY2tCdG4uaGlkZSgpO1xuICB9XG5cbiAgYXN5bmMgbG9hZENsdXN0ZXJzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuZHJhd0VtcHR5KFwiTG9hZGluZyBjbHVzdGVycy4uLlwiKTtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuY2x1c3RlcnMoKTtcbiAgICBpZiAoIWRhdGEgfHwgIWRhdGEuY2x1c3RlcnMgfHwgZGF0YS5jbHVzdGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuZHJhd0VtcHR5KFwiTm8gY2x1c3RlciBkYXRhXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuY2x1c3RlckRhdGEgPSBkYXRhLmNsdXN0ZXJzO1xuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGg7XG4gICAgY29uc3QgaCA9IHRoaXMuY2FudmFzIS5oZWlnaHQ7XG5cbiAgICB0aGlzLm5vZGVzID0gZGF0YS5jbHVzdGVycy5tYXAoKGM6IENsdXN0ZXJJbmZvKSA9PiAoe1xuICAgICAgaWQ6IGMuaWQsXG4gICAgICBuYW1lOiBgJHtjLmh1Yl9uYW1lfSAoJHtjLnNpemV9KWAsXG4gICAgICB0eXBlOiBjLmRvbWluYW50X3R5cGUsXG4gICAgICBzY29yZTogYy5zaXplLFxuICAgICAgeDogKGMueCAvIDEwMDApICogdyAqIDAuOSArIHcgKiAwLjA1LFxuICAgICAgeTogKGMueSAvIDEwMDApICogaCAqIDAuOSArIGggKiAwLjA1LFxuICAgICAgdng6IDAsXG4gICAgICB2eTogMCxcbiAgICAgIHJhZGl1czogTWF0aC5tYXgoOCwgTWF0aC5taW4oNDAsIDggKyBNYXRoLnNxcnQoYy5zaXplKSAqIDIpKSxcbiAgICAgIGlzQ2VudGVyOiBmYWxzZSxcbiAgICAgIF9jbHVzdGVySW5kZXg6IGMuaW5kZXgsXG4gICAgfSkpO1xuXG4gICAgdGhpcy5lZGdlcyA9IChkYXRhLmVkZ2VzID8/IFtdKS5tYXAoKGUpID0+ICh7XG4gICAgICBzb3VyY2U6IGUuc291cmNlLFxuICAgICAgdGFyZ2V0OiBlLnRhcmdldCxcbiAgICAgIHR5cGU6IFwiY2x1c3Rlcl9saW5rXCIsXG4gICAgfSkpO1xuXG4gICAgdGhpcy5ub2RlTWFwID0gbmV3IE1hcCh0aGlzLm5vZGVzLm1hcCgobikgPT4gW24uaWQsIG5dKSk7XG4gICAgdGhpcy5vZmZzZXRYID0gMDtcbiAgICB0aGlzLm9mZnNldFkgPSAwO1xuICAgIHRoaXMuc2NhbGUgPSAxO1xuICAgIHRoaXMuc2ltUnVubmluZyA9IGZhbHNlO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG5cbiAgYXN5bmMgZHJpbGxJbnRvQ2x1c3RlcihjbHVzdGVySW5kZXg6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuZHJhd0VtcHR5KFwiTG9hZGluZyBjbHVzdGVyIGRldGFpbC4uLlwiKTtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuY2x1c3RlckRldGFpbChjbHVzdGVySW5kZXgpO1xuICAgIGlmICghZGF0YSB8fCBkYXRhLm5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJFbXB0eSBjbHVzdGVyXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGg7XG4gICAgY29uc3QgaCA9IHRoaXMuY2FudmFzIS5oZWlnaHQ7XG5cbiAgICB0aGlzLm5vZGVzID0gZGF0YS5ub2Rlcy5tYXAoKG46IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXQpID0+ICh7XG4gICAgICBpZDogbi5pZCxcbiAgICAgIG5hbWU6IG4ubmFtZSxcbiAgICAgIHR5cGU6IG4udHlwZSxcbiAgICAgIHNjb3JlOiBuLmRlZ3JlZSxcbiAgICAgIHg6ICgobi54ID8/IDApIC8gMTAwMCkgKiB3ICogMC45ICsgdyAqIDAuMDUsXG4gICAgICB5OiAoKG4ueSA/PyAwKSAvIDEwMDApICogaCAqIDAuOSArIGggKiAwLjA1LFxuICAgICAgdng6IDAsXG4gICAgICB2eTogMCxcbiAgICAgIHJhZGl1czogTWF0aC5tYXgoNCwgTWF0aC5taW4oMTYsIDQgKyAobi5kZWdyZWUgfHwgMCkgKiAwLjEpKSxcbiAgICAgIGlzQ2VudGVyOiBmYWxzZSxcbiAgICB9KSk7XG5cbiAgICB0aGlzLmVkZ2VzID0gZGF0YS5lZGdlcztcbiAgICB0aGlzLm5vZGVNYXAgPSBuZXcgTWFwKHRoaXMubm9kZXMubWFwKChuKSA9PiBbbi5pZCwgbl0pKTtcbiAgICB0aGlzLm9mZnNldFggPSAwO1xuICAgIHRoaXMub2Zmc2V0WSA9IDA7XG4gICAgdGhpcy5zY2FsZSA9IDE7XG4gICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuYmFja0J0bikgdGhpcy5iYWNrQnRuLnNob3coKTtcbiAgICB0aGlzLmRyYXcoKTtcbiAgfVxuXG4gIGFzeW5jIGxvYWRGdWxsR3JhcGgoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5kcmF3RW1wdHkoXCJMb2FkaW5nIGZ1bGwgZ3JhcGguLi5cIik7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuYXBpQ2xpZW50LmZ1bGxHcmFwaCgpO1xuICAgIGlmICghZGF0YSB8fCBkYXRhLm5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJObyBncmFwaCBkYXRhXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGg7XG4gICAgY29uc3QgaCA9IHRoaXMuY2FudmFzIS5oZWlnaHQ7XG5cbiAgICB0aGlzLm5vZGVzID0gZGF0YS5ub2Rlcy5tYXAoKG46IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXQpID0+ICh7XG4gICAgICBpZDogbi5pZCxcbiAgICAgIG5hbWU6IG4ubmFtZSxcbiAgICAgIHR5cGU6IG4udHlwZSxcbiAgICAgIHNjb3JlOiBuLmRlZ3JlZSxcbiAgICAgIHg6ICgobi54ID8/IDApIC8gMTAwMCkgKiB3ICogMC45ICsgdyAqIDAuMDUsXG4gICAgICB5OiAoKG4ueSA/PyAwKSAvIDEwMDApICogaCAqIDAuOSArIGggKiAwLjA1LFxuICAgICAgdng6IDAsXG4gICAgICB2eTogMCxcbiAgICAgIHJhZGl1czogTWF0aC5tYXgoMywgTWF0aC5taW4oMTYsIDMgKyAobi5kZWdyZWUgfHwgMCkgKiAwLjA1KSksXG4gICAgICBpc0NlbnRlcjogZmFsc2UsXG4gICAgfSkpO1xuXG4gICAgdGhpcy5lZGdlcyA9IGRhdGEuZWRnZXM7XG4gICAgdGhpcy5ub2RlTWFwID0gbmV3IE1hcCh0aGlzLm5vZGVzLm1hcCgobikgPT4gW24uaWQsIG5dKSk7XG4gICAgdGhpcy5vZmZzZXRYID0gMDtcbiAgICB0aGlzLm9mZnNldFkgPSAwO1xuICAgIHRoaXMuc2NhbGUgPSAxO1xuICAgIHRoaXMuc2ltUnVubmluZyA9IGZhbHNlO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG5cbiAgLy8gPT09PT0gXHVBREY4XHVCNzk4XHVENTA0IFx1QkU0Q1x1QjREQyA9PT09PVxuICBwcml2YXRlIGJ1aWxkR3JhcGgobm9kZXM6IFN1YmdyYXBoTm9kZVtdLCBlZGdlczogU3ViZ3JhcGhFZGdlW10sIGNlbnRlclBhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGg7XG4gICAgY29uc3QgaCA9IHRoaXMuY2FudmFzIS5oZWlnaHQ7XG4gICAgY29uc3QgY3ggPSB3IC8gMiwgY3kgPSBoIC8gMjtcblxuICAgIHRoaXMubm9kZXMgPSBub2Rlcy5tYXAoKG4pID0+ICh7XG4gICAgICBpZDogbi5pZCxcbiAgICAgIG5hbWU6IG4ubmFtZSxcbiAgICAgIHR5cGU6IG4udHlwZSxcbiAgICAgIHNjb3JlOiBuLnNjb3JlLFxuICAgICAgeDogbi5pZCA9PT0gY2VudGVyUGF0aCA/IGN4IDogY3ggKyAoTWF0aC5yYW5kb20oKSAtIDAuNSkgKiAzMDAsXG4gICAgICB5OiBuLmlkID09PSBjZW50ZXJQYXRoID8gY3kgOiBjeSArIChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDMwMCxcbiAgICAgIHZ4OiAwLFxuICAgICAgdnk6IDAsXG4gICAgICByYWRpdXM6IG4uaWQgPT09IGNlbnRlclBhdGggPyAxOCA6IDEyLFxuICAgICAgaXNDZW50ZXI6IG4uaWQgPT09IGNlbnRlclBhdGgsXG4gICAgfSkpO1xuXG4gICAgdGhpcy5lZGdlcyA9IGVkZ2VzO1xuICAgIHRoaXMubm9kZU1hcCA9IG5ldyBNYXAodGhpcy5ub2Rlcy5tYXAoKG4pID0+IFtuLmlkLCBuXSkpO1xuICAgIHRoaXMub2Zmc2V0WCA9IDA7XG4gICAgdGhpcy5vZmZzZXRZID0gMDtcbiAgICB0aGlzLnNjYWxlID0gMTtcbiAgfVxuXG4gIC8vID09PT09IEZvcmNlLWRpcmVjdGVkIFx1QzJEQ1x1QkJBQ1x1QjgwOFx1Qzc3NFx1QzE1OCA9PT09PVxuICBwcml2YXRlIHJ1blNpbXVsYXRpb24oKTogdm9pZCB7XG4gICAgdGhpcy5zaW1SdW5uaW5nID0gdHJ1ZTtcbiAgICB0aGlzLnNpbUl0ZXJhdGlvbnMgPSAwO1xuICAgIGNvbnN0IHRpY2sgPSAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2ltUnVubmluZykgcmV0dXJuO1xuICAgICAgdGhpcy5zaW1JdGVyYXRpb25zKys7XG4gICAgICB0aGlzLnNpbXVsYXRlU3RlcCgpO1xuICAgICAgdGhpcy5kcmF3KCk7XG4gICAgICBpZiAodGhpcy5zaW1JdGVyYXRpb25zIDwgMjAwKSB7XG4gICAgICAgIHRoaXMuYW5pbUZyYW1lID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZHJhdygpO1xuICAgICAgfVxuICAgIH07XG4gICAgdGhpcy5hbmltRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gIH1cblxuICBwcml2YXRlIHNpbXVsYXRlU3RlcCgpOiB2b2lkIHtcbiAgICBjb25zdCBhbHBoYSA9IE1hdGgubWF4KDAuMDEsIDEgLSB0aGlzLnNpbUl0ZXJhdGlvbnMgLyAyMDApO1xuICAgIGNvbnN0IG5vZGVzID0gdGhpcy5ub2RlcztcbiAgICBjb25zdCByZXB1bHNpb24gPSAzMDAwO1xuICAgIGNvbnN0IHNwcmluZ0xlbiA9IDEyMDtcbiAgICBjb25zdCBzcHJpbmdLID0gMC4wMjtcbiAgICBjb25zdCBjZW50ZXJHcmF2aXR5ID0gMC4wMTtcbiAgICBjb25zdCB3ID0gdGhpcy5jYW52YXMhLndpZHRoIC8gMjtcbiAgICBjb25zdCBoID0gdGhpcy5jYW52YXMhLmhlaWdodCAvIDI7XG5cbiAgICAvLyBSZXB1bHNpb24gKGFsbCBwYWlycylcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBub2Rlcy5sZW5ndGg7IGorKykge1xuICAgICAgICBjb25zdCBhID0gbm9kZXNbaV0sIGIgPSBub2Rlc1tqXTtcbiAgICAgICAgY29uc3QgZHggPSBiLnggLSBhLngsIGR5ID0gYi55IC0gYS55O1xuICAgICAgICBjb25zdCBkaXN0ID0gTWF0aC5zcXJ0KGR4ICogZHggKyBkeSAqIGR5KSB8fCAxO1xuICAgICAgICBjb25zdCBmb3JjZSA9IHJlcHVsc2lvbiAvIChkaXN0ICogZGlzdCk7XG4gICAgICAgIGNvbnN0IGZ4ID0gKGR4IC8gZGlzdCkgKiBmb3JjZSAqIGFscGhhO1xuICAgICAgICBjb25zdCBmeSA9IChkeSAvIGRpc3QpICogZm9yY2UgKiBhbHBoYTtcbiAgICAgICAgYS52eCAtPSBmeDsgYS52eSAtPSBmeTtcbiAgICAgICAgYi52eCArPSBmeDsgYi52eSArPSBmeTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTcHJpbmcgKGVkZ2VzKVxuICAgIGZvciAoY29uc3QgZSBvZiB0aGlzLmVkZ2VzKSB7XG4gICAgICBjb25zdCBhID0gdGhpcy5ub2RlTWFwLmdldChlLnNvdXJjZSk7XG4gICAgICBjb25zdCBiID0gdGhpcy5ub2RlTWFwLmdldChlLnRhcmdldCk7XG4gICAgICBpZiAoIWEgfHwgIWIpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgZHggPSBiLnggLSBhLngsIGR5ID0gYi55IC0gYS55O1xuICAgICAgY29uc3QgZGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSkgfHwgMTtcbiAgICAgIGNvbnN0IGZvcmNlID0gKGRpc3QgLSBzcHJpbmdMZW4pICogc3ByaW5nSyAqIGFscGhhO1xuICAgICAgY29uc3QgZnggPSAoZHggLyBkaXN0KSAqIGZvcmNlO1xuICAgICAgY29uc3QgZnkgPSAoZHkgLyBkaXN0KSAqIGZvcmNlO1xuICAgICAgYS52eCArPSBmeDsgYS52eSArPSBmeTtcbiAgICAgIGIudnggLT0gZng7IGIudnkgLT0gZnk7XG4gICAgfVxuXG4gICAgLy8gQ2VudGVyIGdyYXZpdHlcbiAgICBmb3IgKGNvbnN0IG4gb2Ygbm9kZXMpIHtcbiAgICAgIG4udnggKz0gKHcgLSBuLngpICogY2VudGVyR3Jhdml0eSAqIGFscGhhO1xuICAgICAgbi52eSArPSAoaCAtIG4ueSkgKiBjZW50ZXJHcmF2aXR5ICogYWxwaGE7XG4gICAgICAvLyBEYW1waW5nXG4gICAgICBuLnZ4ICo9IDAuODU7XG4gICAgICBuLnZ5ICo9IDAuODU7XG4gICAgICBpZiAoIW4uaXNDZW50ZXIgfHwgdGhpcy5zaW1JdGVyYXRpb25zID4gNSkge1xuICAgICAgICBuLnggKz0gbi52eDtcbiAgICAgICAgbi55ICs9IG4udnk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gPT09PT0gXHVCODBDXHVCMzU0XHVCOUMxID09PT09XG4gIHByaXZhdGUgZHJhdygpOiB2b2lkIHtcbiAgICBjb25zdCBjdHggPSB0aGlzLmN0eCE7XG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5jYW52YXMhO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICBjdHguc2F2ZSgpO1xuICAgIGN0eC50cmFuc2xhdGUodGhpcy5vZmZzZXRYLCB0aGlzLm9mZnNldFkpO1xuICAgIGN0eC5zY2FsZSh0aGlzLnNjYWxlLCB0aGlzLnNjYWxlKTtcblxuICAgIC8vIFx1QzVFM1x1QzlDMFxuICAgIGZvciAoY29uc3QgZSBvZiB0aGlzLmVkZ2VzKSB7XG4gICAgICBjb25zdCBhID0gdGhpcy5ub2RlTWFwLmdldChlLnNvdXJjZSk7XG4gICAgICBjb25zdCBiID0gdGhpcy5ub2RlTWFwLmdldChlLnRhcmdldCk7XG4gICAgICBpZiAoIWEgfHwgIWIpIGNvbnRpbnVlO1xuXG4gICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICBjdHgubW92ZVRvKGEueCwgYS55KTtcbiAgICAgIGN0eC5saW5lVG8oYi54LCBiLnkpO1xuICAgICAgY3R4LnN0cm9rZVN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDI1NSwyNTUsMjU1LDAuMilcIiA6IFwicmdiYSgwLDAsMCwwLjE1KVwiO1xuICAgICAgY3R4LmxpbmVXaWR0aCA9IDEuNTtcblxuICAgICAgaWYgKGUudHlwZSA9PT0gXCJyZWxhdGVkXCIpIHtcbiAgICAgICAgY3R4LnNldExpbmVEYXNoKFs2LCA0XSk7XG4gICAgICB9IGVsc2UgaWYgKGUudHlwZSA9PT0gXCJ0YWdfc2hhcmVkXCIpIHtcbiAgICAgICAgY3R4LnNldExpbmVEYXNoKFszLCA1XSk7XG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjEpXCIgOiBcInJnYmEoMCwwLDAsMC4wOClcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGN0eC5zZXRMaW5lRGFzaChbXSk7XG4gICAgICB9XG4gICAgICBjdHguc3Ryb2tlKCk7XG4gICAgICBjdHguc2V0TGluZURhc2goW10pO1xuICAgIH1cblxuICAgIC8vIFx1QjE3OFx1QjREQ1xuICAgIGZvciAoY29uc3QgbiBvZiB0aGlzLm5vZGVzKSB7XG4gICAgICBjb25zdCBjb2xvciA9IFRZUEVfQ09MT1JTW24udHlwZV0gfHwgREVGQVVMVF9DT0xPUjtcbiAgICAgIGNvbnN0IGlzSG92ZXJlZCA9IHRoaXMuaG92ZXJlZE5vZGUgPT09IG47XG5cbiAgICAgIC8vIEdsb3cgZm9yIGNlbnRlclxuICAgICAgaWYgKG4uaXNDZW50ZXIpIHtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIDYsIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IGNvbG9yICsgXCIzM1wiO1xuICAgICAgICBjdHguZmlsbCgpO1xuICAgICAgfVxuXG4gICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIChpc0hvdmVyZWQgPyAzIDogMCksIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgIGN0eC5maWxsU3R5bGUgPSBjb2xvcjtcbiAgICAgIGN0eC5maWxsKCk7XG4gICAgICBjdHguc3Ryb2tlU3R5bGUgPSBpc0hvdmVyZWQgPyBcIiNmZmZmZmZcIiA6ICh0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMjU1LDI1NSwyNTUsMC4zKVwiIDogXCJyZ2JhKDAsMCwwLDAuMilcIik7XG4gICAgICBjdHgubGluZVdpZHRoID0gaXNIb3ZlcmVkID8gMi41IDogMTtcbiAgICAgIGN0eC5zdHJva2UoKTtcblxuICAgICAgLy8gTGFiZWxcbiAgICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcIiNlMGUwZTBcIiA6IFwiIzMzMzMzM1wiO1xuICAgICAgY3R4LmZvbnQgPSBuLmlzQ2VudGVyID8gXCJib2xkIDExcHggc2Fucy1zZXJpZlwiIDogXCIxMHB4IHNhbnMtc2VyaWZcIjtcbiAgICAgIGN0eC50ZXh0QWxpZ24gPSBcImNlbnRlclwiO1xuICAgICAgY29uc3QgaXNIb3YgPSB0aGlzLmhvdmVyZWROb2RlID09PSBuO1xuICAgICAgaWYgKGlzSG92IHx8IG4uaXNDZW50ZXIpIHtcbiAgICAgICAgY29uc3QgbGFiZWwgPSBuLm5hbWUubGVuZ3RoID4gNDAgPyBuLm5hbWUuc2xpY2UoMCwgMzgpICsgXCJcdTIwMjZcIiA6IG4ubmFtZTtcbiAgICAgICAgY3R4LmZpbGxUZXh0KGxhYmVsLCBuLngsIG4ueSArIG4ucmFkaXVzICsgMTQpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnNjYWxlID4gMC42ICYmIG4ucmFkaXVzID49IDUpIHtcbiAgICAgICAgY29uc3Qgc2hvcnQgPSBuLm5hbWUubGVuZ3RoID4gMTIgPyBuLm5hbWUuc2xpY2UoMCwgMTApICsgXCJcdTIwMjZcIiA6IG4ubmFtZTtcbiAgICAgICAgY3R4LmZpbGxUZXh0KHNob3J0LCBuLngsIG4ueSArIG4ucmFkaXVzICsgMTQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGN0eC5yZXN0b3JlKCk7XG5cbiAgICAvLyBcdUQyMzRcdUQzMDFcbiAgICBpZiAodGhpcy5ob3ZlcmVkTm9kZSkge1xuICAgICAgdGhpcy5kcmF3VG9vbHRpcCh0aGlzLmhvdmVyZWROb2RlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGRyYXdUb29sdGlwKG46IEdyYXBoTm9kZSk6IHZvaWQge1xuICAgIGNvbnN0IGN0eCA9IHRoaXMuY3R4ITtcbiAgICBjb25zdCBzeCA9IG4ueCAqIHRoaXMuc2NhbGUgKyB0aGlzLm9mZnNldFg7XG4gICAgY29uc3Qgc3kgPSBuLnkgKiB0aGlzLnNjYWxlICsgdGhpcy5vZmZzZXRZIC0gbi5yYWRpdXMgKiB0aGlzLnNjYWxlIC0gMTA7XG5cbiAgICBjb25zdCBsaW5lcyA9IFtuLm5hbWUsIGBUeXBlOiAke24udHlwZX1gXTtcbiAgICBpZiAobi5zY29yZSAhPSBudWxsKSBsaW5lcy5wdXNoKGBTY29yZTogJHtuLnNjb3JlLnRvRml4ZWQoMyl9YCk7XG5cbiAgICBjdHguZm9udCA9IFwiMTFweCBzYW5zLXNlcmlmXCI7XG4gICAgY29uc3QgbWF4VyA9IE1hdGgubWF4KC4uLmxpbmVzLm1hcCgobCkgPT4gY3R4Lm1lYXN1cmVUZXh0KGwpLndpZHRoKSkgKyAxNjtcbiAgICBjb25zdCBoID0gbGluZXMubGVuZ3RoICogMTYgKyAxMDtcblxuICAgIGNvbnN0IHR4ID0gc3ggLSBtYXhXIC8gMjtcbiAgICBjb25zdCB0eSA9IHN5IC0gaDtcblxuICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMzAsMzAsMzAsMC45NSlcIiA6IFwicmdiYSgyNTUsMjU1LDI1NSwwLjk1KVwiO1xuICAgIGN0eC5zdHJva2VTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjIpXCIgOiBcInJnYmEoMCwwLDAsMC4xNSlcIjtcbiAgICBjdHgubGluZVdpZHRoID0gMTtcbiAgICB0aGlzLnJvdW5kUmVjdChjdHgsIHR4LCB0eSwgbWF4VywgaCwgNik7XG4gICAgY3R4LmZpbGwoKTtcbiAgICBjdHguc3Ryb2tlKCk7XG5cbiAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCIjZTBlMGUwXCIgOiBcIiMzMzMzMzNcIjtcbiAgICBjdHgudGV4dEFsaWduID0gXCJsZWZ0XCI7XG4gICAgbGluZXMuZm9yRWFjaCgobGluZSwgaSkgPT4ge1xuICAgICAgY3R4LmZpbGxUZXh0KGxpbmUsIHR4ICsgOCwgdHkgKyAxNiArIGkgKiAxNik7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHJvdW5kUmVjdChjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCwgeDogbnVtYmVyLCB5OiBudW1iZXIsIHc6IG51bWJlciwgaDogbnVtYmVyLCByOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgY3R4Lm1vdmVUbyh4ICsgciwgeSk7XG4gICAgY3R4LmxpbmVUbyh4ICsgdyAtIHIsIHkpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHggKyB3LCB5LCB4ICsgdywgeSArIHIpO1xuICAgIGN0eC5saW5lVG8oeCArIHcsIHkgKyBoIC0gcik7XG4gICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCArIHcsIHkgKyBoLCB4ICsgdyAtIHIsIHkgKyBoKTtcbiAgICBjdHgubGluZVRvKHggKyByLCB5ICsgaCk7XG4gICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCwgeSArIGgsIHgsIHkgKyBoIC0gcik7XG4gICAgY3R4LmxpbmVUbyh4LCB5ICsgcik7XG4gICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCwgeSwgeCArIHIsIHkpO1xuICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgfVxuXG4gIHByaXZhdGUgZHJhd0VtcHR5KG1zZzogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgY3R4ID0gdGhpcy5jdHghO1xuICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuY2FudmFzITtcbiAgICBjdHguY2xlYXJSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwiIzk5OVwiIDogXCIjNjY2XCI7XG4gICAgY3R4LmZvbnQgPSBcIjE0cHggc2Fucy1zZXJpZlwiO1xuICAgIGN0eC50ZXh0QWxpZ24gPSBcImNlbnRlclwiO1xuICAgIGN0eC5maWxsVGV4dChtc2csIGNhbnZhcy53aWR0aCAvIDIsIGNhbnZhcy5oZWlnaHQgLyAyKTtcbiAgfVxuXG4gIC8vID09PT09IFx1Qzc3OFx1RDEzMFx1Qjc5OVx1QzE1OCA9PT09PVxuICBwcml2YXRlIHNldHVwSW50ZXJhY3Rpb24oKTogdm9pZCB7XG4gICAgY29uc3QgYyA9IHRoaXMuY2FudmFzITtcblxuICAgIGMuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCAoZSkgPT4ge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuaGl0VGVzdChlLm9mZnNldFgsIGUub2Zmc2V0WSk7XG4gICAgICBpZiAobm9kZSkge1xuICAgICAgICB0aGlzLmRyYWdOb2RlID0gbm9kZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaXNQYW5uaW5nID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubGFzdE1vdXNlID0geyB4OiBlLm9mZnNldFgsIHk6IGUub2Zmc2V0WSB9O1xuICAgIH0pO1xuXG4gICAgYy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIChlKSA9PiB7XG4gICAgICBjb25zdCBkeCA9IGUub2Zmc2V0WCAtIHRoaXMubGFzdE1vdXNlLng7XG4gICAgICBjb25zdCBkeSA9IGUub2Zmc2V0WSAtIHRoaXMubGFzdE1vdXNlLnk7XG5cbiAgICAgIGlmICh0aGlzLmRyYWdOb2RlKSB7XG4gICAgICAgIHRoaXMuZHJhZ05vZGUueCArPSBkeCAvIHRoaXMuc2NhbGU7XG4gICAgICAgIHRoaXMuZHJhZ05vZGUueSArPSBkeSAvIHRoaXMuc2NhbGU7XG4gICAgICAgIHRoaXMuZHJhZ05vZGUudnggPSAwO1xuICAgICAgICB0aGlzLmRyYWdOb2RlLnZ5ID0gMDtcbiAgICAgICAgaWYgKCF0aGlzLnNpbVJ1bm5pbmcpIHRoaXMuZHJhdygpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzUGFubmluZykge1xuICAgICAgICB0aGlzLm9mZnNldFggKz0gZHg7XG4gICAgICAgIHRoaXMub2Zmc2V0WSArPSBkeTtcbiAgICAgICAgaWYgKCF0aGlzLnNpbVJ1bm5pbmcpIHRoaXMuZHJhdygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcHJldiA9IHRoaXMuaG92ZXJlZE5vZGU7XG4gICAgICAgIHRoaXMuaG92ZXJlZE5vZGUgPSB0aGlzLmhpdFRlc3QoZS5vZmZzZXRYLCBlLm9mZnNldFkpO1xuICAgICAgICBjLnN0eWxlLmN1cnNvciA9IHRoaXMuaG92ZXJlZE5vZGUgPyBcInBvaW50ZXJcIiA6IFwiZGVmYXVsdFwiO1xuICAgICAgICBpZiAocHJldiAhPT0gdGhpcy5ob3ZlcmVkTm9kZSAmJiAhdGhpcy5zaW1SdW5uaW5nKSB0aGlzLmRyYXcoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubGFzdE1vdXNlID0geyB4OiBlLm9mZnNldFgsIHk6IGUub2Zmc2V0WSB9O1xuICAgIH0pO1xuXG4gICAgYy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCAoZSkgPT4ge1xuICAgICAgaWYgKHRoaXMuZHJhZ05vZGUpIHtcbiAgICAgICAgLy8gXHVEMDc0XHVCOUFEIChcdUI0RENcdUI3OThcdUFERjggXHVDNTQ0XHVCMkQ4KSBcdTIxOTIgXHVCMTc4XHVEMkI4IFx1QzVGNFx1QUUzMFxuICAgICAgICBjb25zdCBkeCA9IE1hdGguYWJzKGUub2Zmc2V0WCAtIHRoaXMubGFzdE1vdXNlLngpO1xuICAgICAgICBjb25zdCBkeSA9IE1hdGguYWJzKGUub2Zmc2V0WSAtIHRoaXMubGFzdE1vdXNlLnkpO1xuICAgICAgICBpZiAoZHggPCAzICYmIGR5IDwgMykge1xuICAgICAgICAgIHRoaXMub3Blbk5vdGUodGhpcy5kcmFnTm9kZS5pZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZHJhZ05vZGUgPSBudWxsO1xuICAgICAgdGhpcy5pc1Bhbm5pbmcgPSBmYWxzZTtcbiAgICB9KTtcblxuICAgIGMuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICBjb25zdCBub2RlID0gdGhpcy5oaXRUZXN0KGUub2Zmc2V0WCwgZS5vZmZzZXRZKTtcbiAgICAgIGlmIChub2RlKSB7XG4gICAgICAgIGlmIChub2RlLl9jbHVzdGVySW5kZXggIT0gbnVsbCkge1xuICAgICAgICAgIC8vIFx1RDA3NFx1QjdFQ1x1QzJBNFx1RDEzMCBcdTIxOTIgXHVCNERDXHVCOUI0XHVCMkU0XHVDNkI0XG4gICAgICAgICAgdm9pZCB0aGlzLmRyaWxsSW50b0NsdXN0ZXIobm9kZS5fY2x1c3RlckluZGV4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm9wZW5Ob3RlKG5vZGUuaWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjLmFkZEV2ZW50TGlzdGVuZXIoXCJ3aGVlbFwiLCAoZSkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgY29uc3Qgem9vbSA9IGUuZGVsdGFZIDwgMCA/IDEuMSA6IDAuOTtcbiAgICAgIGNvbnN0IG14ID0gZS5vZmZzZXRYLCBteSA9IGUub2Zmc2V0WTtcbiAgICAgIHRoaXMub2Zmc2V0WCA9IG14IC0gem9vbSAqIChteCAtIHRoaXMub2Zmc2V0WCk7XG4gICAgICB0aGlzLm9mZnNldFkgPSBteSAtIHpvb20gKiAobXkgLSB0aGlzLm9mZnNldFkpO1xuICAgICAgdGhpcy5zY2FsZSAqPSB6b29tO1xuICAgICAgdGhpcy5zY2FsZSA9IE1hdGgubWF4KDAuMiwgTWF0aC5taW4oNSwgdGhpcy5zY2FsZSkpO1xuICAgICAgaWYgKCF0aGlzLnNpbVJ1bm5pbmcpIHRoaXMuZHJhdygpO1xuICAgIH0sIHsgcGFzc2l2ZTogZmFsc2UgfSk7XG4gIH1cblxuICBwcml2YXRlIGhpdFRlc3QobXg6IG51bWJlciwgbXk6IG51bWJlcik6IEdyYXBoTm9kZSB8IG51bGwge1xuICAgIGNvbnN0IHggPSAobXggLSB0aGlzLm9mZnNldFgpIC8gdGhpcy5zY2FsZTtcbiAgICBjb25zdCB5ID0gKG15IC0gdGhpcy5vZmZzZXRZKSAvIHRoaXMuc2NhbGU7XG4gICAgLy8gUmV2ZXJzZSBvcmRlciBzbyB0b3AtZHJhd24gbm9kZXMgYXJlIGhpdCBmaXJzdFxuICAgIGZvciAobGV0IGkgPSB0aGlzLm5vZGVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBuID0gdGhpcy5ub2Rlc1tpXTtcbiAgICAgIGNvbnN0IGR4ID0geCAtIG4ueCwgZHkgPSB5IC0gbi55O1xuICAgICAgaWYgKGR4ICogZHggKyBkeSAqIGR5IDw9IChuLnJhZGl1cyArIDQpICogKG4ucmFkaXVzICsgNCkpIHJldHVybiBuO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgb3Blbk5vdGUoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIGlkXHVCMjk0IFx1RDMwQ1x1Qzc3QyBcdUFDQkRcdUI4NUMgKFx1QzYwODogXCJmb2xkZXIvbm90ZS5tZFwiKVxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoaWQpO1xuICAgIGlmIChmaWxlKSB7XG4gICAgICB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoaWQsIFwiXCIsIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZml0VG9WaWV3KCk6IHZvaWQge1xuICAgIGlmICh0aGlzLm5vZGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgIGxldCBtaW5YID0gSW5maW5pdHksIG1heFggPSAtSW5maW5pdHksIG1pblkgPSBJbmZpbml0eSwgbWF4WSA9IC1JbmZpbml0eTtcbiAgICBmb3IgKGNvbnN0IG4gb2YgdGhpcy5ub2Rlcykge1xuICAgICAgbWluWCA9IE1hdGgubWluKG1pblgsIG4ueCAtIG4ucmFkaXVzKTtcbiAgICAgIG1heFggPSBNYXRoLm1heChtYXhYLCBuLnggKyBuLnJhZGl1cyk7XG4gICAgICBtaW5ZID0gTWF0aC5taW4obWluWSwgbi55IC0gbi5yYWRpdXMpO1xuICAgICAgbWF4WSA9IE1hdGgubWF4KG1heFksIG4ueSArIG4ucmFkaXVzKTtcbiAgICB9XG4gICAgY29uc3QgcGFkID0gNDA7XG4gICAgY29uc3QgdyA9IHRoaXMuY2FudmFzIS53aWR0aDtcbiAgICBjb25zdCBoID0gdGhpcy5jYW52YXMhLmhlaWdodDtcbiAgICBjb25zdCBndyA9IG1heFggLSBtaW5YICsgcGFkICogMjtcbiAgICBjb25zdCBnaCA9IG1heFkgLSBtaW5ZICsgcGFkICogMjtcbiAgICB0aGlzLnNjYWxlID0gTWF0aC5taW4odyAvIGd3LCBoIC8gZ2gsIDIpO1xuICAgIHRoaXMub2Zmc2V0WCA9IHcgLyAyIC0gKChtaW5YICsgbWF4WCkgLyAyKSAqIHRoaXMuc2NhbGU7XG4gICAgdGhpcy5vZmZzZXRZID0gaCAvIDIgLSAoKG1pblkgKyBtYXhZKSAvIDIpICogdGhpcy5zY2FsZTtcbiAgICB0aGlzLmRyYXcoKTtcbiAgfVxuXG4gIC8vID09PT09IFx1QzcyMFx1RDJGOCA9PT09PVxuICBwcml2YXRlIHJlc2l6ZUNhbnZhcygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY2FudmFzKSByZXR1cm47XG4gICAgY29uc3QgcmVjdCA9IHRoaXMuY2FudmFzLnBhcmVudEVsZW1lbnQhLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHRoaXMuY2FudmFzLndpZHRoID0gcmVjdC53aWR0aDtcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSByZWN0LmhlaWdodDtcbiAgICBpZiAoIXRoaXMuc2ltUnVubmluZykgdGhpcy5kcmF3KCk7XG4gIH1cblxuICBwcml2YXRlIGlzRGFya1RoZW1lKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5jb250YWlucyhcInRoZW1lLWRhcmtcIik7XG4gIH1cbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUMsSUFBQUEsbUJBQStCOzs7QUNBL0Isc0JBQTJCO0FBdUVyQixJQUFNLGlCQUFOLE1BQXFCO0FBQUEsRUFDMUIsWUFBb0IsU0FBaUI7QUFBakI7QUFBQSxFQUFrQjtBQUFBLEVBRXRDLFdBQVcsS0FBbUI7QUFDNUIsU0FBSyxVQUFVLElBQUksUUFBUSxRQUFRLEVBQUU7QUFBQSxFQUN2QztBQUFBO0FBQUEsRUFHQSxNQUFNLE9BQ0osT0FDQSxPQUFlLFVBQ2YsUUFBZ0IsSUFDYztBQUM5QixVQUFNLFNBQVMsSUFBSSxnQkFBZ0IsRUFBRSxHQUFHLE9BQU8sTUFBTSxPQUFPLE9BQU8sS0FBSyxFQUFFLENBQUM7QUFDM0UsVUFBTSxNQUFNLEdBQUcsS0FBSyxPQUFPLFdBQVcsTUFBTTtBQUU1QyxRQUFJO0FBQ0YsWUFBTSxXQUFXLFVBQU0sNEJBQVcsRUFBRSxLQUFLLFFBQVEsTUFBTSxDQUFDO0FBQ3hELFlBQU0sT0FBTyxTQUFTO0FBQ3RCLFlBQU0sYUFBZ0MsTUFBTSxRQUFRLElBQUksSUFDcEQsT0FDQyxLQUFLLFdBQVcsQ0FBQztBQUN0QixhQUFPLFdBQVcsSUFBSSxDQUFDLE9BQTJDO0FB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RTtBQUFBLElBQ0YsQ0FBQztBQUdELFNBQUs7QUFBQSxNQUNIO0FBQUEsTUFDQSxDQUFDLFNBQVMsSUFBSSxlQUFlLE1BQU0sS0FBSyxTQUFTO0FBQUEsSUFDbkQ7QUFHQSxTQUFLLGNBQWMsWUFBWSxlQUFlLE1BQU07QUFDbEQsV0FBSyxLQUFLLGNBQWM7QUFBQSxJQUMxQixDQUFDO0FBR0QsU0FBSyxXQUFXO0FBQUEsTUFDZCxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixVQUFVLE1BQU07QUFBRSxhQUFLLEtBQUssY0FBYztBQUFBLE1BQUc7QUFBQSxJQUMvQyxDQUFDO0FBR0QsU0FBSyxXQUFXO0FBQUEsTUFDZCxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixVQUFVLFlBQVk7QUFDcEIsY0FBTSxRQUFRLE1BQU0sS0FBSyxVQUFVLE1BQU07QUFDekMsWUFBSSxPQUFPO0FBQ1QsY0FBSSx3QkFBTyxVQUFVLE1BQU0sV0FBVyxXQUFXLE1BQU0sV0FBVyxRQUFRO0FBQUEsUUFDNUUsT0FBTztBQUNMLGNBQUksd0JBQU8sbUdBQTRDO0FBQUEsUUFDekQ7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBRUQsWUFBUSxNQUFNLGlDQUFpQztBQUFBLEVBQ2pEO0FBQUEsRUFFQSxXQUFpQjtBQUNmLFlBQVEsTUFBTSxtQ0FBbUM7QUFBQSxFQUNuRDtBQUFBLEVBRUEsTUFBTSxlQUE4QjtBQUNsQyxTQUFLLFdBQVcsT0FBTyxPQUFPLENBQUMsR0FBRyxrQkFBa0IsTUFBTSxLQUFLLFNBQVMsQ0FBQztBQUFBLEVBQzNFO0FBQUEsRUFFQSxNQUFNLGVBQThCO0FBQ2xDLFVBQU0sS0FBSyxTQUFTLEtBQUssUUFBUTtBQUFBLEVBQ25DO0FBQUEsRUFFQSxNQUFjLGdCQUErQjtBQUMzQyxVQUFNLFdBQVcsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLHFCQUFxQjtBQUN6RSxRQUFJO0FBQ0osUUFBSSxTQUFTLFNBQVMsR0FBRztBQUN2QixhQUFPLFNBQVMsQ0FBQztBQUFBLElBQ25CLE9BQU87QUFDTCxhQUFPLEtBQUssSUFBSSxVQUFVLGFBQWEsS0FBSztBQUM1QyxZQUFNLEtBQUssYUFBYSxFQUFFLE1BQU0sdUJBQXVCLFFBQVEsS0FBSyxDQUFDO0FBQUEsSUFDdkU7QUFDQSxTQUFLLElBQUksVUFBVSxXQUFXLElBQUk7QUFHbEMsVUFBTSxPQUFPLEtBQUssSUFBSSxVQUFVLGNBQWM7QUFDOUMsUUFBSSxNQUFNO0FBQ1IsWUFBTSxPQUFPLEtBQUs7QUFDbEIsV0FBSyxjQUFjLEtBQUssSUFBSTtBQUFBLElBQzlCO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iXQp9Cg==
