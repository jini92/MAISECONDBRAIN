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
    const localBtn = toolbar.createEl("button", { text: "\u{1F4CD} local", cls: "mnemo-graph-btn mnemo-graph-btn-active", attr: { title: "Current note graph" } });
    localBtn.addEventListener("click", () => {
      this.setActiveBtn(localBtn);
      this.viewMode = "local";
      void this.loadGraph();
    });
    const clusterBtn = toolbar.createEl("button", { text: "\u{1F52E} explore", cls: "mnemo-graph-btn", attr: { title: "Explore by clusters" } });
    clusterBtn.addEventListener("click", () => {
      this.setActiveBtn(clusterBtn);
      this.viewMode = "cluster";
      void this.loadClusters();
    });
    const fullBtn = toolbar.createEl("button", { text: "\u{1F310} full", cls: "mnemo-graph-btn", attr: { title: "Full knowledge graph" } });
    fullBtn.addEventListener("click", () => {
      this.setActiveBtn(fullBtn);
      this.viewMode = "full";
      void this.loadFullGraph();
    });
    this.backBtn = toolbar.createEl("button", { text: "\u2190 back", cls: "mnemo-graph-btn", attr: { title: "Back to clusters" } });
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2FwaS1jbGllbnQudHMiLCAic3JjL3NldHRpbmdzLnRzIiwgInNyYy9zZWFyY2gtbW9kYWwudHMiLCAic3JjL2dyYXBoLXZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIlx1RkVGRmltcG9ydCB7IFBsdWdpbiwgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBNbmVtb0FwaUNsaWVudCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcbmltcG9ydCB7IE1uZW1vU2V0dGluZ3MsIE1uZW1vU2V0dGluZ1RhYiwgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBNbmVtb1NlYXJjaE1vZGFsIH0gZnJvbSBcIi4vc2VhcmNoLW1vZGFsXCI7XG5pbXBvcnQgeyBNbmVtb0dyYXBoVmlldywgTU5FTU9fR1JBUEhfVklFV19UWVBFIH0gZnJvbSBcIi4vZ3JhcGgtdmlld1wiO1xuXG4vLyBNbmVtbyBTZWNvbmRCcmFpbiBPYnNpZGlhbiBQbHVnaW5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1uZW1vUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IE1uZW1vU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuICBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50ID0gbmV3IE1uZW1vQXBpQ2xpZW50KERFRkFVTFRfU0VUVElOR1MuYXBpVXJsKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFwaUNsaWVudC5zZXRCYXNlVXJsKHRoaXMuc2V0dGluZ3MuYXBpVXJsKTtcblxuICAgIC8vIFx1QzEyNFx1QzgxNSBcdUQwRUQgXHVCNEYxXHVCODVEIC8gUmVnaXN0ZXIgc2V0dGluZ3MgdGFiXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNbmVtb1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIC8vIFx1QjlBQ1x1QkNGOCBcdUM1NDRcdUM3NzRcdUNGNTggLyBSaWJib24gaWNvblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcImJyYWluXCIsIFwiTW5lbW8gc2VhcmNoXCIsICgpID0+IHtcbiAgICAgIG5ldyBNbmVtb1NlYXJjaE1vZGFsKHRoaXMuYXBwLCB0aGlzLmFwaUNsaWVudCwgdGhpcy5zZXR0aW5ncykub3BlbigpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1Q0VFNFx1QjlFOFx1QjREQyAvIFNlYXJjaCBjb21tYW5kXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLXNlYXJjaFwiLFxuICAgICAgbmFtZTogXCJNbmVtbzogc2VhcmNoXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICBuZXcgTW5lbW9TZWFyY2hNb2RhbCh0aGlzLmFwcCwgdGhpcy5hcGlDbGllbnQsIHRoaXMuc2V0dGluZ3MpLm9wZW4oKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBcdUFERjhcdUI3OThcdUQ1MDQgXHVCREYwIFx1QjRGMVx1Qjg1RCAvIFJlZ2lzdGVyIGdyYXBoIHZpZXdcbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhcbiAgICAgIE1ORU1PX0dSQVBIX1ZJRVdfVFlQRSxcbiAgICAgIChsZWFmKSA9PiBuZXcgTW5lbW9HcmFwaFZpZXcobGVhZiwgdGhpcy5hcGlDbGllbnQpXG4gICAgKTtcblxuICAgIC8vIFx1QURGOFx1Qjc5OFx1RDUwNCBcdUJERjAgXHVCOUFDXHVCQ0Y4IFx1QzU0NFx1Qzc3NFx1Q0Y1OFxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcImdpdC1mb3JrXCIsIFwiTW5lbW8gZ3JhcGhcIiwgKCkgPT4ge1xuICAgICAgdm9pZCB0aGlzLm9wZW5HcmFwaFZpZXcoKTtcbiAgICB9KTtcblxuICAgIC8vIFx1QURGOFx1Qjc5OFx1RDUwNCBcdUJERjAgXHVDNUY0XHVBRTMwIFx1Q0VFNFx1QjlFOFx1QjREQ1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJtbmVtby1vcGVuLWdyYXBoXCIsXG4gICAgICBuYW1lOiBcIk1uZW1vOiBvcGVuIGdyYXBoIHZpZXdcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7IHZvaWQgdGhpcy5vcGVuR3JhcGhWaWV3KCk7IH0sXG4gICAgfSk7XG5cbiAgICAvLyBcdUMxMUNcdUJDODQgXHVDMEMxXHVEMERDIFx1RDY1NVx1Qzc3OCAvIENoZWNrIHNlcnZlciBvbiBsb2FkXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLWNoZWNrLXN0YXR1c1wiLFxuICAgICAgbmFtZTogXCJNbmVtbzogY2hlY2sgc2VydmVyIHN0YXR1c1wiLFxuICAgICAgY2FsbGJhY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLmFwaUNsaWVudC5zdGF0cygpO1xuICAgICAgICBpZiAoc3RhdHMpIHtcbiAgICAgICAgICBuZXcgTm90aWNlKGBNbmVtbzogJHtzdGF0cy50b3RhbF9ub3Rlc30gbm90ZXMsICR7c3RhdHMudG90YWxfZWRnZXN9IGVkZ2VzYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3IE5vdGljZShcIk1uZW1vOiBcdUMxMUNcdUJDODRcdUM1RDAgXHVDNUYwXHVBQ0IwXHVENTYwIFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQgLyBzZXJ2ZXIgdW5yZWFjaGFibGVcIik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmRlYnVnKFwiTW5lbW8gU2Vjb25kQnJhaW4gcGx1Z2luIGxvYWRlZFwiKTtcbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIGNvbnNvbGUuZGVidWcoXCJNbmVtbyBTZWNvbmRCcmFpbiBwbHVnaW4gdW5sb2FkZWRcIik7XG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgbG9hZGVkID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpIGFzIFBhcnRpYWw8TW5lbW9TZXR0aW5ncz47XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGxvYWRlZCk7XG4gIH1cblxuICBhc3luYyBzYXZlU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgb3BlbkdyYXBoVmlldygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoTU5FTU9fR1JBUEhfVklFV19UWVBFKTtcbiAgICBsZXQgbGVhZjogaW1wb3J0KFwib2JzaWRpYW5cIikuV29ya3NwYWNlTGVhZjtcbiAgICBpZiAoZXhpc3RpbmcubGVuZ3RoID4gMCkge1xuICAgICAgbGVhZiA9IGV4aXN0aW5nWzBdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSkhO1xuICAgICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBNTkVNT19HUkFQSF9WSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG5cbiAgICAvLyBcdUQ2MDRcdUM3QUMgXHVCMTc4XHVEMkI4IFx1QUUzMFx1QzkwMFx1QzczQ1x1Qjg1QyBcdUFERjhcdUI3OThcdUQ1MDQgXHVCODVDXHVCNERDXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgaWYgKGZpbGUpIHtcbiAgICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXcgYXMgTW5lbW9HcmFwaFZpZXc7XG4gICAgICB2aWV3LnNldENlbnRlclBhdGgoZmlsZS5wYXRoKTtcbiAgICB9XG4gIH1cbn1cbiIsICJcdUZFRkZpbXBvcnQgeyByZXF1ZXN0VXJsIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbi8vIE1uZW1vIEFQSSBcdUFDODBcdUMwQzkgXHVBQ0IwXHVBQ0ZDIFx1RDBDMFx1Qzc4NSAvIFNlYXJjaCByZXN1bHQgdHlwZVxuZXhwb3J0IGludGVyZmFjZSBNbmVtb1NlYXJjaFJlc3VsdCB7XG4gIG5hbWU6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgc25pcHBldDogc3RyaW5nO1xuICBzY29yZTogbnVtYmVyO1xuICBlbnRpdHlfdHlwZT86IHN0cmluZztcbiAgc291cmNlPzogc3RyaW5nO1xuICBwYXRoPzogc3RyaW5nO1xufVxuXG4vLyBNbmVtbyBcdUMxMUNcdUJDODQgXHVEMUI1XHVBQ0M0IC8gU2VydmVyIHN0YXRzXG5leHBvcnQgaW50ZXJmYWNlIE1uZW1vU3RhdHMge1xuICB0b3RhbF9ub3RlczogbnVtYmVyO1xuICB0b3RhbF9lZGdlczogbnVtYmVyO1xuICBpbmRleF9zdGF0dXM6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdWJncmFwaE5vZGUge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbiAgc2NvcmU/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3ViZ3JhcGhFZGdlIHtcbiAgc291cmNlOiBzdHJpbmc7XG4gIHRhcmdldDogc3RyaW5nO1xuICB0eXBlOiBzdHJpbmc7XG59XG5cbi8vIEFQSSBcdUM3NTFcdUIyRjUgXHVCMEI0XHVCRDgwIFx1RDBDMFx1Qzc4NSAvIEludGVybmFsIEFQSSByZXNwb25zZSB0eXBlc1xuaW50ZXJmYWNlIFJhd1NlYXJjaFJlc3VsdCB7XG4gIG5hbWU/OiBzdHJpbmc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBrZXk/OiBzdHJpbmc7XG4gIHNuaXBwZXQ/OiBzdHJpbmc7XG4gIHNjb3JlPzogbnVtYmVyO1xuICBlbnRpdHlfdHlwZT86IHN0cmluZztcbiAgc291cmNlPzogc3RyaW5nO1xuICBwYXRoPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgU2VhcmNoQXBpUmVzcG9uc2Uge1xuICByZXN1bHRzPzogUmF3U2VhcmNoUmVzdWx0W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2x1c3RlckluZm8ge1xuICBpZDogc3RyaW5nO1xuICBodWJfbmFtZTogc3RyaW5nO1xuICBzaXplOiBudW1iZXI7XG4gIGRvbWluYW50X3R5cGU6IHN0cmluZztcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIGluZGV4OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2x1c3RlcnNSZXNwb25zZSB7XG4gIGNsdXN0ZXJzOiBDbHVzdGVySW5mb1tdO1xuICBlZGdlcz86IEFycmF5PHsgc291cmNlOiBzdHJpbmc7IHRhcmdldDogc3RyaW5nIH0+O1xufVxuXG4vLyBcdUMwQUNcdUM4MDQgXHVBQ0M0XHVDMEIwXHVCNDFDIFx1QjgwOFx1Qzc3NFx1QzU0NFx1QzZDMyBcdUM4OENcdUQ0NUNcdUI5N0MgXHVEM0VDXHVENTY4XHVENTVDIFx1QjE3OFx1QjREQyBcdUQwQzBcdUM3ODVcbmV4cG9ydCBpbnRlcmZhY2UgU3ViZ3JhcGhOb2RlV2l0aExheW91dCBleHRlbmRzIFN1YmdyYXBoTm9kZSB7XG4gIGRlZ3JlZT86IG51bWJlcjtcbiAgeD86IG51bWJlcjtcbiAgeT86IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIE1uZW1vQXBpQ2xpZW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmcpIHt9XG5cbiAgc2V0QmFzZVVybCh1cmw6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuYmFzZVVybCA9IHVybC5yZXBsYWNlKC9cXC8rJC8sIFwiXCIpO1xuICB9XG5cbiAgLy8gXHVBQzgwXHVDMEM5IEFQSSBcdUQ2MzhcdUNEOUMgLyBDYWxsIHNlYXJjaCBBUElcbiAgYXN5bmMgc2VhcmNoKFxuICAgIHF1ZXJ5OiBzdHJpbmcsXG4gICAgbW9kZTogc3RyaW5nID0gXCJoeWJyaWRcIixcbiAgICBsaW1pdDogbnVtYmVyID0gMTBcbiAgKTogUHJvbWlzZTxNbmVtb1NlYXJjaFJlc3VsdFtdPiB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7IHE6IHF1ZXJ5LCBtb2RlLCBsaW1pdDogU3RyaW5nKGxpbWl0KSB9KTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L3NlYXJjaD8ke3BhcmFtc31gO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgY29uc3QgZGF0YSA9IHJlc3BvbnNlLmpzb24gYXMgU2VhcmNoQXBpUmVzcG9uc2UgfCBSYXdTZWFyY2hSZXN1bHRbXTtcbiAgICAgIGNvbnN0IHJhd1Jlc3VsdHM6IFJhd1NlYXJjaFJlc3VsdFtdID0gQXJyYXkuaXNBcnJheShkYXRhKVxuICAgICAgICA/IGRhdGFcbiAgICAgICAgOiAoZGF0YS5yZXN1bHRzID8/IFtdKTtcbiAgICAgIHJldHVybiByYXdSZXN1bHRzLm1hcCgocjogUmF3U2VhcmNoUmVzdWx0KTogTW5lbW9TZWFyY2hSZXN1bHQgPT4gKHtcbiAgICAgICAgbmFtZTogci5uYW1lID8/IFwiXCIsXG4gICAgICAgIHRpdGxlOiByLnRpdGxlIHx8IHIubmFtZSB8fCByLmtleSB8fCBcIlVudGl0bGVkXCIsXG4gICAgICAgIHNuaXBwZXQ6IHIuc25pcHBldCA/PyBcIlwiLFxuICAgICAgICBzY29yZTogci5zY29yZSA/PyAwLFxuICAgICAgICBlbnRpdHlfdHlwZTogci5lbnRpdHlfdHlwZSxcbiAgICAgICAgc291cmNlOiByLnNvdXJjZSxcbiAgICAgICAgcGF0aDogci5wYXRoLFxuICAgICAgfSkpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1QzExQ1x1QkM4NCBcdUMwQzFcdUQwREMgXHVENjU1XHVDNzc4IC8gQ2hlY2sgc2VydmVyIHN0YXRzXG4gIGFzeW5jIHN0YXRzKCk6IFByb21pc2U8TW5lbW9TdGF0cyB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgICAgdXJsOiBgJHt0aGlzLmJhc2VVcmx9L3N0YXRzYCxcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzcG9uc2UuanNvbiBhcyBNbmVtb1N0YXRzO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVDMTFDXHVCRTBDXHVBREY4XHVCNzk4XHVENTA0IFx1Qzg3MFx1RDY4QyAvIEdldCBzdWJncmFwaCBmb3IgdmlzdWFsaXphdGlvblxuICBhc3luYyBzdWJncmFwaChcbiAgICBjZW50ZXI6IHN0cmluZyxcbiAgICBkZXB0aDogbnVtYmVyID0gMlxuICApOiBQcm9taXNlPHsgbm9kZXM6IFN1YmdyYXBoTm9kZVtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW10gfSB8IG51bGw+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHsgY2VudGVyLCBkZXB0aDogU3RyaW5nKGRlcHRoKSB9KTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2dyYXBoL3N1YmdyYXBoPyR7cGFyYW1zfWA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlW107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSB9O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVEMDc0XHVCN0VDXHVDMkE0XHVEMTMwIFx1QURGOFx1Qjc5OFx1RDUwNCAoXHVBQ0M0XHVDRTM1XHVDODAxIFx1RDBEMFx1QzBDOSkgLyBDbHVzdGVyIGdyYXBoIGZvciBkcmlsbC1kb3duXG4gIGFzeW5jIGNsdXN0ZXJzKCk6IFByb21pc2U8Q2x1c3RlcnNSZXNwb25zZSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHsgdXJsOiBgJHt0aGlzLmJhc2VVcmx9L2dyYXBoL2NsdXN0ZXJzYCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgQ2x1c3RlcnNSZXNwb25zZTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZXJyKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1RDA3NFx1QjdFQ1x1QzJBNFx1RDEzMCBcdUMwQzFcdUMxMzggKGRyaWxsLWRvd24pIC8gQ2x1c3RlciBkZXRhaWxcbiAgYXN5bmMgY2x1c3RlckRldGFpbChpbmRleDogbnVtYmVyKTogUHJvbWlzZTx7IG5vZGVzOiBTdWJncmFwaE5vZGVXaXRoTGF5b3V0W107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSB9IHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmw6IGAke3RoaXMuYmFzZVVybH0vZ3JhcGgvY2x1c3Rlci8ke2luZGV4fWAsIG1ldGhvZDogXCJHRVRcIiB9KTtcbiAgICAgIHJldHVybiByZXNwb25zZS5qc29uIGFzIHsgbm9kZXM6IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXRbXTsgZWRnZXM6IFN1YmdyYXBoRWRnZVtdIH07XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLmhhbmRsZUVycm9yKGVycik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvLyBcdUM4MDRcdUNDQjQgXHVBREY4XHVCNzk4XHVENTA0IChcdUMwQUNcdUM4MDQgXHVBQ0M0XHVDMEIwIFx1QjgwOFx1Qzc3NFx1QzU0NFx1QzZDMykgLyBGdWxsIGdyYXBoIHdpdGggcHJlY29tcHV0ZWQgbGF5b3V0XG4gIGFzeW5jIGZ1bGxHcmFwaCgpOiBQcm9taXNlPHsgbm9kZXM6IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXRbXTsgZWRnZXM6IFN1YmdyYXBoRWRnZVtdOyBsYXlvdXQ6IHN0cmluZyB9IHwgbnVsbD4ge1xuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0vZ3JhcGgvZnVsbGA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlV2l0aExheW91dFtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW107IGxheW91dDogc3RyaW5nIH07XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLmhhbmRsZUVycm9yKGVycik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvLyBcdUM1RDBcdUI3RUMgXHVDQzk4XHVCOUFDIC8gRXJyb3IgaGFuZGxpbmcgd2l0aCBmcmllbmRseSBtZXNzYWdlc1xuICBwcml2YXRlIGhhbmRsZUVycm9yKGVycjogdW5rbm93bik6IHZvaWQge1xuICAgIGNvbnN0IG1zZyA9IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKTtcbiAgICBpZiAobXNnLmluY2x1ZGVzKFwiRUNPTk5SRUZVU0VEXCIpIHx8IG1zZy5pbmNsdWRlcyhcIm5ldDo6RVJSXCIpKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBgW01uZW1vXSBcdUMxMUNcdUJDODRcdUM1RDAgXHVDNUYwXHVBQ0IwXHVENTYwIFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQuIE1uZW1vIFx1QzExQ1x1QkM4NFx1QUMwMCBcdUMyRTRcdUQ1ODkgXHVDOTExXHVDNzc4XHVDOUMwIFx1RDY1NVx1Qzc3OFx1RDU1OFx1QzEzOFx1QzY5NC5cXG5gICtcbiAgICAgICAgICBgQ2Fubm90IGNvbm5lY3QgdG8gTW5lbW8gc2VydmVyIGF0ICR7dGhpcy5iYXNlVXJsfS4gSXMgaXQgcnVubmluZz9gXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBbTW5lbW9dIEFQSSBlcnJvcjogJHttc2d9YCk7XG4gICAgfVxuICB9XG59XHJcbiIsICJcdUZFRkZpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIE1uZW1vUGx1Z2luIGZyb20gXCIuL21haW5cIjtcblxuLy8gXHVENTBDXHVCN0VDXHVBREY4XHVDNzc4IFx1QzEyNFx1QzgxNSBcdUM3NzhcdUQxMzBcdUQzOThcdUM3NzRcdUMyQTQgLyBQbHVnaW4gc2V0dGluZ3MgaW50ZXJmYWNlXG5leHBvcnQgaW50ZXJmYWNlIE1uZW1vU2V0dGluZ3Mge1xuICBhcGlVcmw6IHN0cmluZztcbiAgc2VhcmNoTGltaXQ6IG51bWJlcjtcbiAgc2VhcmNoTW9kZTogXCJoeWJyaWRcIiB8IFwidmVjdG9yXCIgfCBcImtleXdvcmRcIiB8IFwiZ3JhcGhcIjtcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IE1uZW1vU2V0dGluZ3MgPSB7XG4gIGFwaVVybDogXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIixcbiAgc2VhcmNoTGltaXQ6IDEwLFxuICBzZWFyY2hNb2RlOiBcImh5YnJpZFwiLFxufTtcblxuLy8gXHVDMTI0XHVDODE1IFx1RDBFRCAvIFNldHRpbmdzIHRhYlxuZXhwb3J0IGNsYXNzIE1uZW1vU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IE1uZW1vUGx1Z2luO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE1uZW1vUGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICAvLyBBUEkgVVJMIFx1QzEyNFx1QzgxNVxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJNbmVtbyBBUEkgVVJMXCIpXG4gICAgICAuc2V0RGVzYyhcIk1uZW1vIEZhc3RBUEkgc2VydmVyIGFkZHJlc3MgKGRlZmF1bHQ6IGh0dHA6Ly8xMjcuMC4wLjE6ODAwMClcIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiaHR0cDovLzEyNy4wLjAuMTo4MDAwXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaVVybClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlVcmwgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmFwaUNsaWVudC5zZXRCYXNlVXJsKHZhbHVlKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1QUNCMFx1QUNGQyBcdUMyMThcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiU2VhcmNoIHJlc3VsdCBsaW1pdFwiKVxuICAgICAgLnNldERlc2MoXCJNYXhpbXVtIG51bWJlciBvZiBzZWFyY2ggcmVzdWx0cyB0byBzaG93XCIpXG4gICAgICAuYWRkU2xpZGVyKChzbGlkZXIpID0+XG4gICAgICAgIHNsaWRlclxuICAgICAgICAgIC5zZXRMaW1pdHMoNSwgNTAsIDUpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNlYXJjaExpbWl0KVxuICAgICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTGltaXQgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1QkFBOFx1QjREQ1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJTZWFyY2ggbW9kZVwiKVxuICAgICAgLnNldERlc2MoXCJTZWxlY3QgdGhlIHNlYXJjaCBtZXRob2QgdG8gdXNlXCIpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxuICAgICAgICBkcm9wZG93blxuICAgICAgICAgIC5hZGRPcHRpb25zKHtcbiAgICAgICAgICAgIGh5YnJpZDogXCJIeWJyaWQgKGtleXdvcmQgKyB2ZWN0b3IpXCIsXG4gICAgICAgICAgICB2ZWN0b3I6IFwiVmVjdG9yIChzZW1hbnRpYylcIixcbiAgICAgICAgICAgIGtleXdvcmQ6IFwiS2V5d29yZCAoQk0yNSlcIixcbiAgICAgICAgICAgIGdyYXBoOiBcIkdyYXBoIChyZWxhdGlvbnNoaXApXCIsXG4gICAgICAgICAgfSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTW9kZSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zZWFyY2hNb2RlID0gdmFsdWUgYXMgTW5lbW9TZXR0aW5nc1tcInNlYXJjaE1vZGVcIl07XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxufVxuIiwgIlx1RkVGRmltcG9ydCB7IEFwcCwgU3VnZ2VzdE1vZGFsLCBOb3RpY2UsIFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSB7IE1uZW1vQXBpQ2xpZW50LCBNbmVtb1NlYXJjaFJlc3VsdCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcbmltcG9ydCB0eXBlIHsgTW5lbW9TZXR0aW5ncyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5cbi8vIE1uZW1vIFx1QUM4MFx1QzBDOSBcdUJBQThcdUIyRUMgLyBTZWFyY2ggbW9kYWxcbmV4cG9ydCBjbGFzcyBNbmVtb1NlYXJjaE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPE1uZW1vU2VhcmNoUmVzdWx0PiB7XG4gIHByaXZhdGUgcmVzdWx0czogTW5lbW9TZWFyY2hSZXN1bHRbXSA9IFtdO1xuICBwcml2YXRlIGRlYm91bmNlVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50LFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IE1uZW1vU2V0dGluZ3NcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiTW5lbW8gc2VhcmNoLi4uXCIpO1xuICB9XG5cbiAgYXN5bmMgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFByb21pc2U8TW5lbW9TZWFyY2hSZXN1bHRbXT4ge1xuICAgIGlmICghcXVlcnkgfHwgcXVlcnkubGVuZ3RoIDwgMikgcmV0dXJuIFtdO1xuXG4gICAgLy8gXHVCNTE0XHVCQzE0XHVDNkI0XHVDMkE0IDMwMG1zIC8gRGVib3VuY2UgaW5wdXRcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIpIGNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHZvaWQgdGhpcy5hcGlDbGllbnQuc2VhcmNoKHF1ZXJ5LCB0aGlzLnNldHRpbmdzLnNlYXJjaE1vZGUsIHRoaXMuc2V0dGluZ3Muc2VhcmNoTGltaXQpXG4gICAgICAgICAgLnRoZW4oKHJlc3VsdHMpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHM7XG4gICAgICAgICAgICByZXNvbHZlKHRoaXMucmVzdWx0cyk7XG4gICAgICAgICAgfSk7XG4gICAgICB9LCAzMDApO1xuICAgIH0pO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihyZXN1bHQ6IE1uZW1vU2VhcmNoUmVzdWx0LCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb25zdCBjb250YWluZXIgPSBlbC5jcmVhdGVEaXYoeyBjbHM6IFwibW5lbW8tc2VhcmNoLXJlc3VsdFwiIH0pO1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7XG4gICAgICB0ZXh0OiByZXN1bHQudGl0bGUsXG4gICAgICBjbHM6IFwibW5lbW8tcmVzdWx0LXRpdGxlXCIsXG4gICAgfSk7XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwic21hbGxcIiwge1xuICAgICAgdGV4dDogcmVzdWx0LnNuaXBwZXQsXG4gICAgICBjbHM6IFwibW5lbW8tcmVzdWx0LXNuaXBwZXRcIixcbiAgICB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJzcGFuXCIsIHtcbiAgICAgIHRleHQ6IGBzY29yZTogJHtyZXN1bHQuc2NvcmUudG9GaXhlZCgzKX1gLFxuICAgICAgY2xzOiBcIm1uZW1vLXJlc3VsdC1zY29yZVwiLFxuICAgIH0pO1xuICB9XG5cbiAgb25DaG9vc2VTdWdnZXN0aW9uKHJlc3VsdDogTW5lbW9TZWFyY2hSZXN1bHQpOiB2b2lkIHtcbiAgICAvLyBcdUJDRkNcdUQyQjhcdUM1RDBcdUMxMUMgXHVENTc0XHVCMkY5IFx1QjE3OFx1RDJCOCBcdUM1RjRcdUFFMzAgLyBPcGVuIG1hdGNoaW5nIG5vdGUgaW4gdmF1bHRcbiAgICBsZXQgcGF0aCA9IHJlc3VsdC5wYXRoIHx8IGAke3Jlc3VsdC50aXRsZX0ubWRgO1xuICAgIGlmICghcGF0aC5lbmRzV2l0aChcIi5tZFwiKSkgcGF0aCArPSBcIi5tZFwiO1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG5cbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUoZmlsZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ldyBOb3RpY2UoYFx1QjE3OFx1RDJCOFx1Qjk3QyBcdUNDM0VcdUM3NDQgXHVDMjE4IFx1QzVDNlx1QzJCNVx1QjJDOFx1QjJFNDogJHtyZXN1bHQudGl0bGV9XFxuTm90ZSBub3QgZm91bmQgaW4gdmF1bHQuYCk7XG4gICAgfVxuICB9XG59XG4iLCAiXHVGRUZGaW1wb3J0IHsgSXRlbVZpZXcsIFdvcmtzcGFjZUxlYWYgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIHsgTW5lbW9BcGlDbGllbnQsIFN1YmdyYXBoTm9kZSwgU3ViZ3JhcGhFZGdlLCBDbHVzdGVySW5mbywgU3ViZ3JhcGhOb2RlV2l0aExheW91dCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcblxuZXhwb3J0IGNvbnN0IE1ORU1PX0dSQVBIX1ZJRVdfVFlQRSA9IFwibW5lbW8tZ3JhcGgtdmlld1wiO1xuXG4vLyBcdUMwQzlcdUMwQzEgXHVCOUY1IChlbnRpdHlfdHlwZVx1QkNDNClcbmNvbnN0IFRZUEVfQ09MT1JTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBldmVudDogXCIjNEE5MEQ5XCIsXG4gIHByb2plY3Q6IFwiI0U4OTEzQVwiLFxuICBub3RlOiBcIiM1MEM4NzhcIixcbiAgc291cmNlOiBcIiM5QjU5QjZcIixcbiAgZGVjaXNpb246IFwiI0U3NEMzQ1wiLFxuICBpbnNpZ2h0OiBcIiNGMUM0MEZcIixcbn07XG5jb25zdCBERUZBVUxUX0NPTE9SID0gXCIjODg4ODg4XCI7XG5cbmludGVyZmFjZSBHcmFwaE5vZGUge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbiAgc2NvcmU/OiBudW1iZXI7XG4gIHg6IG51bWJlcjtcbiAgeTogbnVtYmVyO1xuICB2eDogbnVtYmVyO1xuICB2eTogbnVtYmVyO1xuICByYWRpdXM6IG51bWJlcjtcbiAgaXNDZW50ZXI6IGJvb2xlYW47XG4gIF9jbHVzdGVySW5kZXg/OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBHcmFwaEVkZ2Uge1xuICBzb3VyY2U6IHN0cmluZztcbiAgdGFyZ2V0OiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1uZW1vR3JhcGhWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG5vZGVzOiBHcmFwaE5vZGVbXSA9IFtdO1xuICBwcml2YXRlIGVkZ2VzOiBHcmFwaEVkZ2VbXSA9IFtdO1xuICBwcml2YXRlIG5vZGVNYXA6IE1hcDxzdHJpbmcsIEdyYXBoTm9kZT4gPSBuZXcgTWFwKCk7XG5cbiAgLy8gXHVDRTc0XHVCQTU0XHVCNzdDXG4gIHByaXZhdGUgb2Zmc2V0WCA9IDA7XG4gIHByaXZhdGUgb2Zmc2V0WSA9IDA7XG4gIHByaXZhdGUgc2NhbGUgPSAxO1xuXG4gIC8vIFx1Qzc3OFx1RDEzMFx1Qjc5OVx1QzE1OFxuICBwcml2YXRlIGRyYWdOb2RlOiBHcmFwaE5vZGUgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBpc1Bhbm5pbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBsYXN0TW91c2UgPSB7IHg6IDAsIHk6IDAgfTtcbiAgcHJpdmF0ZSBob3ZlcmVkTm9kZTogR3JhcGhOb2RlIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgYW5pbUZyYW1lID0gMDtcbiAgcHJpdmF0ZSBzaW1SdW5uaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgc2ltSXRlcmF0aW9ucyA9IDA7XG5cbiAgcHJpdmF0ZSBjZW50ZXJQYXRoID0gXCJcIjtcbiAgcHJpdmF0ZSB2aWV3TW9kZTogXCJsb2NhbFwiIHwgXCJmdWxsXCIgfCBcImNsdXN0ZXJcIiA9IFwibG9jYWxcIjtcbiAgcHJpdmF0ZSBjbHVzdGVyRGF0YTogQ2x1c3RlckluZm9bXSA9IFtdO1xuICBwcml2YXRlIGJhY2tCdG46IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgYWxsQnRuczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGxlYWY6IFdvcmtzcGFjZUxlYWYsXG4gICAgcHJpdmF0ZSBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50XG4gICkge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHsgcmV0dXJuIE1ORU1PX0dSQVBIX1ZJRVdfVFlQRTsgfVxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcgeyByZXR1cm4gXCJNbmVtbyBncmFwaFwiOyB9XG4gIGdldEljb24oKTogc3RyaW5nIHsgcmV0dXJuIFwiZ2l0LWZvcmtcIjsgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdIGFzIEhUTUxFbGVtZW50O1xuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIGNvbnRhaW5lci5hZGRDbGFzcyhcIm1uZW1vLWdyYXBoLWNvbnRhaW5lclwiKTtcblxuICAgIC8vIFx1RDIzNFx1QkMxNFxuICAgIGNvbnN0IHRvb2xiYXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcIm1uZW1vLWdyYXBoLXRvb2xiYXJcIiB9KTtcbiAgICB0b29sYmFyLmNyZWF0ZUVsKFwic3BhblwiLCB7IHRleHQ6IFwiTW5lbW8gZ3JhcGhcIiwgY2xzOiBcIm1uZW1vLWdyYXBoLXRpdGxlXCIgfSk7XG5cbiAgICBjb25zdCBsb2NhbEJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1RDgzRFx1RENDRCBsb2NhbFwiLCBjbHM6IFwibW5lbW8tZ3JhcGgtYnRuIG1uZW1vLWdyYXBoLWJ0bi1hY3RpdmVcIiwgYXR0cjogeyB0aXRsZTogXCJDdXJyZW50IG5vdGUgZ3JhcGhcIiB9IH0pO1xuICAgIGxvY2FsQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7IHRoaXMuc2V0QWN0aXZlQnRuKGxvY2FsQnRuKTsgdGhpcy52aWV3TW9kZSA9IFwibG9jYWxcIjsgdm9pZCB0aGlzLmxvYWRHcmFwaCgpOyB9KTtcblxuICAgIGNvbnN0IGNsdXN0ZXJCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdUQ4M0RcdUREMkUgZXhwbG9yZVwiLCBjbHM6IFwibW5lbW8tZ3JhcGgtYnRuXCIsIGF0dHI6IHsgdGl0bGU6IFwiRXhwbG9yZSBieSBjbHVzdGVyc1wiIH0gfSk7XG4gICAgY2x1c3RlckJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4geyB0aGlzLnNldEFjdGl2ZUJ0bihjbHVzdGVyQnRuKTsgdGhpcy52aWV3TW9kZSA9IFwiY2x1c3RlclwiOyB2b2lkIHRoaXMubG9hZENsdXN0ZXJzKCk7IH0pO1xuXG4gICAgY29uc3QgZnVsbEJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1RDgzQ1x1REYxMCBmdWxsXCIsIGNsczogXCJtbmVtby1ncmFwaC1idG5cIiwgYXR0cjogeyB0aXRsZTogXCJGdWxsIGtub3dsZWRnZSBncmFwaFwiIH0gfSk7XG4gICAgZnVsbEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4geyB0aGlzLnNldEFjdGl2ZUJ0bihmdWxsQnRuKTsgdGhpcy52aWV3TW9kZSA9IFwiZnVsbFwiOyB2b2lkIHRoaXMubG9hZEZ1bGxHcmFwaCgpOyB9KTtcblxuICAgIHRoaXMuYmFja0J0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1MjE5MCBiYWNrXCIsIGNsczogXCJtbmVtby1ncmFwaC1idG5cIiwgYXR0cjogeyB0aXRsZTogXCJCYWNrIHRvIGNsdXN0ZXJzXCIgfSB9KTtcbiAgICB0aGlzLmJhY2tCdG4uaGlkZSgpO1xuICAgIHRoaXMuYmFja0J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4geyB0aGlzLmJhY2tCdG4hLmhpZGUoKTsgdm9pZCB0aGlzLmxvYWRDbHVzdGVycygpOyB9KTtcblxuICAgIHRoaXMuYWxsQnRucyA9IFtsb2NhbEJ0biwgY2x1c3RlckJ0biwgZnVsbEJ0bl07XG5cbiAgICBjb25zdCByZWZyZXNoQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyMUJCXCIsIGNsczogXCJtbmVtby1ncmFwaC1idG5cIiwgYXR0cjogeyB0aXRsZTogXCJSZWZyZXNoXCIgfSB9KTtcbiAgICByZWZyZXNoQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7IHZvaWQgKHRoaXMudmlld01vZGUgPT09IFwiZnVsbFwiID8gdGhpcy5sb2FkRnVsbEdyYXBoKCkgOiB0aGlzLmxvYWRHcmFwaCgpKTsgfSk7XG5cbiAgICBjb25zdCBmaXRCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTIyQTFcIiwgY2xzOiBcIm1uZW1vLWdyYXBoLWJ0blwiLCBhdHRyOiB7IHRpdGxlOiBcIkZpdCB0byB2aWV3XCIgfSB9KTtcbiAgICBmaXRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMuZml0VG9WaWV3KCkpO1xuXG4gICAgLy8gXHVDRTk0XHVCQzg0XHVDMkE0XG4gICAgdGhpcy5jYW52YXMgPSBjb250YWluZXIuY3JlYXRlRWwoXCJjYW52YXNcIiwgeyBjbHM6IFwibW5lbW8tZ3JhcGgtY2FudmFzXCIgfSk7XG4gICAgdGhpcy5jdHggPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XG5cbiAgICB0aGlzLnJlc2l6ZUNhbnZhcygpO1xuICAgIHRoaXMucmVnaXN0ZXJEb21FdmVudCh3aW5kb3csIFwicmVzaXplXCIsICgpID0+IHRoaXMucmVzaXplQ2FudmFzKCkpO1xuICAgIHRoaXMuc2V0dXBJbnRlcmFjdGlvbigpO1xuICAgIGF3YWl0IHRoaXMubG9hZEdyYXBoKCk7XG4gIH1cblxuICBvbkNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2ltUnVubmluZyA9IGZhbHNlO1xuICAgIGlmICh0aGlzLmFuaW1GcmFtZSkgY2FuY2VsQW5pbWF0aW9uRnJhbWUodGhpcy5hbmltRnJhbWUpO1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIC8vIFx1RDYwNFx1QzdBQyBcdUIxNzhcdUQyQjggXHVBRTMwXHVDOTAwIFx1Qjg1Q1x1QjREQ1xuICBhc3luYyBsb2FkR3JhcGgocGF0aD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghcGF0aCkge1xuICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICBwYXRoID0gZmlsZSA/IGZpbGUucGF0aCA6IFwiXCI7XG4gICAgfVxuICAgIGlmICghcGF0aCkge1xuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJPcGVuIGEgbm90ZSwgdGhlbiByZWZyZXNoXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmNlbnRlclBhdGggPSBwYXRoO1xuICAgIGNvbnN0IGFwaVBhdGggPSBwYXRoLnJlcGxhY2UoL1xcLm1kJC8sIFwiXCIpO1xuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuYXBpQ2xpZW50LnN1YmdyYXBoKGFwaVBhdGgsIDEpO1xuICAgIGlmICghZGF0YSB8fCBkYXRhLm5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJObyBncmFwaCBkYXRhIGZvciB0aGlzIG5vdGVcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gXHVCMTc4XHVCNERDIFx1QzIxOCBcdUM4MUNcdUQ1NUMgKFx1QzEzMVx1QjJBNSBcdTIwMTQgXHVDRDVDXHVCMzAwIDgwXHVCMTc4XHVCNERDKVxuICAgIGxldCBub2RlcyA9IGRhdGEubm9kZXM7XG4gICAgbGV0IGVkZ2VzID0gZGF0YS5lZGdlcztcbiAgICBpZiAobm9kZXMubGVuZ3RoID4gODApIHtcbiAgICAgIGNvbnN0IGtlZXAgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgIGNvbnN0IGNlbnRlck5vZGUgPSBub2Rlcy5maW5kKG4gPT4gbi5pZCA9PT0gcGF0aCB8fCBuLmlkID09PSBwYXRoLnJlcGxhY2UoL1xcLm1kJC8sIFwiXCIpKTtcbiAgICAgIGlmIChjZW50ZXJOb2RlKSBrZWVwLmFkZChjZW50ZXJOb2RlLmlkKTtcbiAgICAgIGNvbnN0IHNvcnRlZCA9IFsuLi5ub2Rlc10uc29ydCgoYSwgYikgPT4gKGIuc2NvcmUgPz8gMCkgLSAoYS5zY29yZSA/PyAwKSk7XG4gICAgICBmb3IgKGNvbnN0IG4gb2Ygc29ydGVkKSB7XG4gICAgICAgIGlmIChrZWVwLnNpemUgPj0gODApIGJyZWFrO1xuICAgICAgICBrZWVwLmFkZChuLmlkKTtcbiAgICAgIH1cbiAgICAgIG5vZGVzID0gbm9kZXMuZmlsdGVyKG4gPT4ga2VlcC5oYXMobi5pZCkpO1xuICAgICAgZWRnZXMgPSBlZGdlcy5maWx0ZXIoZSA9PiBrZWVwLmhhcyhlLnNvdXJjZSkgJiYga2VlcC5oYXMoZS50YXJnZXQpKTtcbiAgICB9XG5cbiAgICB0aGlzLmJ1aWxkR3JhcGgobm9kZXMsIGVkZ2VzLCBhcGlQYXRoKTtcbiAgICB0aGlzLnJ1blNpbXVsYXRpb24oKTtcbiAgfVxuXG4gIHNldENlbnRlclBhdGgocGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgdm9pZCB0aGlzLmxvYWRHcmFwaChwYXRoKTtcbiAgfVxuXG4gIHByaXZhdGUgc2V0QWN0aXZlQnRuKGFjdGl2ZTogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGJ0biBvZiB0aGlzLmFsbEJ0bnMpIGJ0bi5yZW1vdmVDbGFzcyhcIm1uZW1vLWdyYXBoLWJ0bi1hY3RpdmVcIik7XG4gICAgYWN0aXZlLmFkZENsYXNzKFwibW5lbW8tZ3JhcGgtYnRuLWFjdGl2ZVwiKTtcbiAgICBpZiAodGhpcy5iYWNrQnRuKSB0aGlzLmJhY2tCdG4uaGlkZSgpO1xuICB9XG5cbiAgYXN5bmMgbG9hZENsdXN0ZXJzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuZHJhd0VtcHR5KFwiTG9hZGluZyBjbHVzdGVycy4uLlwiKTtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuY2x1c3RlcnMoKTtcbiAgICBpZiAoIWRhdGEgfHwgIWRhdGEuY2x1c3RlcnMgfHwgZGF0YS5jbHVzdGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuZHJhd0VtcHR5KFwiTm8gY2x1c3RlciBkYXRhXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuY2x1c3RlckRhdGEgPSBkYXRhLmNsdXN0ZXJzO1xuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGg7XG4gICAgY29uc3QgaCA9IHRoaXMuY2FudmFzIS5oZWlnaHQ7XG5cbiAgICB0aGlzLm5vZGVzID0gZGF0YS5jbHVzdGVycy5tYXAoKGM6IENsdXN0ZXJJbmZvKSA9PiAoe1xuICAgICAgaWQ6IGMuaWQsXG4gICAgICBuYW1lOiBgJHtjLmh1Yl9uYW1lfSAoJHtjLnNpemV9KWAsXG4gICAgICB0eXBlOiBjLmRvbWluYW50X3R5cGUsXG4gICAgICBzY29yZTogYy5zaXplLFxuICAgICAgeDogKGMueCAvIDEwMDApICogdyAqIDAuOSArIHcgKiAwLjA1LFxuICAgICAgeTogKGMueSAvIDEwMDApICogaCAqIDAuOSArIGggKiAwLjA1LFxuICAgICAgdng6IDAsXG4gICAgICB2eTogMCxcbiAgICAgIHJhZGl1czogTWF0aC5tYXgoOCwgTWF0aC5taW4oNDAsIDggKyBNYXRoLnNxcnQoYy5zaXplKSAqIDIpKSxcbiAgICAgIGlzQ2VudGVyOiBmYWxzZSxcbiAgICAgIF9jbHVzdGVySW5kZXg6IGMuaW5kZXgsXG4gICAgfSkpO1xuXG4gICAgdGhpcy5lZGdlcyA9IChkYXRhLmVkZ2VzID8/IFtdKS5tYXAoKGUpID0+ICh7XG4gICAgICBzb3VyY2U6IGUuc291cmNlLFxuICAgICAgdGFyZ2V0OiBlLnRhcmdldCxcbiAgICAgIHR5cGU6IFwiY2x1c3Rlcl9saW5rXCIsXG4gICAgfSkpO1xuXG4gICAgdGhpcy5ub2RlTWFwID0gbmV3IE1hcCh0aGlzLm5vZGVzLm1hcCgobikgPT4gW24uaWQsIG5dKSk7XG4gICAgdGhpcy5vZmZzZXRYID0gMDtcbiAgICB0aGlzLm9mZnNldFkgPSAwO1xuICAgIHRoaXMuc2NhbGUgPSAxO1xuICAgIHRoaXMuc2ltUnVubmluZyA9IGZhbHNlO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG5cbiAgYXN5bmMgZHJpbGxJbnRvQ2x1c3RlcihjbHVzdGVySW5kZXg6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuZHJhd0VtcHR5KFwiTG9hZGluZyBjbHVzdGVyIGRldGFpbC4uLlwiKTtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuY2x1c3RlckRldGFpbChjbHVzdGVySW5kZXgpO1xuICAgIGlmICghZGF0YSB8fCBkYXRhLm5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJFbXB0eSBjbHVzdGVyXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGg7XG4gICAgY29uc3QgaCA9IHRoaXMuY2FudmFzIS5oZWlnaHQ7XG5cbiAgICB0aGlzLm5vZGVzID0gZGF0YS5ub2Rlcy5tYXAoKG46IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXQpID0+ICh7XG4gICAgICBpZDogbi5pZCxcbiAgICAgIG5hbWU6IG4ubmFtZSxcbiAgICAgIHR5cGU6IG4udHlwZSxcbiAgICAgIHNjb3JlOiBuLmRlZ3JlZSxcbiAgICAgIHg6ICgobi54ID8/IDApIC8gMTAwMCkgKiB3ICogMC45ICsgdyAqIDAuMDUsXG4gICAgICB5OiAoKG4ueSA/PyAwKSAvIDEwMDApICogaCAqIDAuOSArIGggKiAwLjA1LFxuICAgICAgdng6IDAsXG4gICAgICB2eTogMCxcbiAgICAgIHJhZGl1czogTWF0aC5tYXgoNCwgTWF0aC5taW4oMTYsIDQgKyAobi5kZWdyZWUgfHwgMCkgKiAwLjEpKSxcbiAgICAgIGlzQ2VudGVyOiBmYWxzZSxcbiAgICB9KSk7XG5cbiAgICB0aGlzLmVkZ2VzID0gZGF0YS5lZGdlcztcbiAgICB0aGlzLm5vZGVNYXAgPSBuZXcgTWFwKHRoaXMubm9kZXMubWFwKChuKSA9PiBbbi5pZCwgbl0pKTtcbiAgICB0aGlzLm9mZnNldFggPSAwO1xuICAgIHRoaXMub2Zmc2V0WSA9IDA7XG4gICAgdGhpcy5zY2FsZSA9IDE7XG4gICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuYmFja0J0bikgdGhpcy5iYWNrQnRuLnNob3coKTtcbiAgICB0aGlzLmRyYXcoKTtcbiAgfVxuXG4gIGFzeW5jIGxvYWRGdWxsR3JhcGgoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5kcmF3RW1wdHkoXCJMb2FkaW5nIGZ1bGwgZ3JhcGguLi5cIik7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuYXBpQ2xpZW50LmZ1bGxHcmFwaCgpO1xuICAgIGlmICghZGF0YSB8fCBkYXRhLm5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJObyBncmFwaCBkYXRhXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGg7XG4gICAgY29uc3QgaCA9IHRoaXMuY2FudmFzIS5oZWlnaHQ7XG5cbiAgICB0aGlzLm5vZGVzID0gZGF0YS5ub2Rlcy5tYXAoKG46IFN1YmdyYXBoTm9kZVdpdGhMYXlvdXQpID0+ICh7XG4gICAgICBpZDogbi5pZCxcbiAgICAgIG5hbWU6IG4ubmFtZSxcbiAgICAgIHR5cGU6IG4udHlwZSxcbiAgICAgIHNjb3JlOiBuLmRlZ3JlZSxcbiAgICAgIHg6ICgobi54ID8/IDApIC8gMTAwMCkgKiB3ICogMC45ICsgdyAqIDAuMDUsXG4gICAgICB5OiAoKG4ueSA/PyAwKSAvIDEwMDApICogaCAqIDAuOSArIGggKiAwLjA1LFxuICAgICAgdng6IDAsXG4gICAgICB2eTogMCxcbiAgICAgIHJhZGl1czogTWF0aC5tYXgoMywgTWF0aC5taW4oMTYsIDMgKyAobi5kZWdyZWUgfHwgMCkgKiAwLjA1KSksXG4gICAgICBpc0NlbnRlcjogZmFsc2UsXG4gICAgfSkpO1xuXG4gICAgdGhpcy5lZGdlcyA9IGRhdGEuZWRnZXM7XG4gICAgdGhpcy5ub2RlTWFwID0gbmV3IE1hcCh0aGlzLm5vZGVzLm1hcCgobikgPT4gW24uaWQsIG5dKSk7XG4gICAgdGhpcy5vZmZzZXRYID0gMDtcbiAgICB0aGlzLm9mZnNldFkgPSAwO1xuICAgIHRoaXMuc2NhbGUgPSAxO1xuICAgIHRoaXMuc2ltUnVubmluZyA9IGZhbHNlO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG5cbiAgLy8gPT09PT0gXHVBREY4XHVCNzk4XHVENTA0IFx1QkU0Q1x1QjREQyA9PT09PVxuICBwcml2YXRlIGJ1aWxkR3JhcGgobm9kZXM6IFN1YmdyYXBoTm9kZVtdLCBlZGdlczogU3ViZ3JhcGhFZGdlW10sIGNlbnRlclBhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGg7XG4gICAgY29uc3QgaCA9IHRoaXMuY2FudmFzIS5oZWlnaHQ7XG4gICAgY29uc3QgY3ggPSB3IC8gMiwgY3kgPSBoIC8gMjtcblxuICAgIHRoaXMubm9kZXMgPSBub2Rlcy5tYXAoKG4pID0+ICh7XG4gICAgICBpZDogbi5pZCxcbiAgICAgIG5hbWU6IG4ubmFtZSxcbiAgICAgIHR5cGU6IG4udHlwZSxcbiAgICAgIHNjb3JlOiBuLnNjb3JlLFxuICAgICAgeDogbi5pZCA9PT0gY2VudGVyUGF0aCA/IGN4IDogY3ggKyAoTWF0aC5yYW5kb20oKSAtIDAuNSkgKiAzMDAsXG4gICAgICB5OiBuLmlkID09PSBjZW50ZXJQYXRoID8gY3kgOiBjeSArIChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDMwMCxcbiAgICAgIHZ4OiAwLFxuICAgICAgdnk6IDAsXG4gICAgICByYWRpdXM6IG4uaWQgPT09IGNlbnRlclBhdGggPyAxOCA6IDEyLFxuICAgICAgaXNDZW50ZXI6IG4uaWQgPT09IGNlbnRlclBhdGgsXG4gICAgfSkpO1xuXG4gICAgdGhpcy5lZGdlcyA9IGVkZ2VzO1xuICAgIHRoaXMubm9kZU1hcCA9IG5ldyBNYXAodGhpcy5ub2Rlcy5tYXAoKG4pID0+IFtuLmlkLCBuXSkpO1xuICAgIHRoaXMub2Zmc2V0WCA9IDA7XG4gICAgdGhpcy5vZmZzZXRZID0gMDtcbiAgICB0aGlzLnNjYWxlID0gMTtcbiAgfVxuXG4gIC8vID09PT09IEZvcmNlLWRpcmVjdGVkIFx1QzJEQ1x1QkJBQ1x1QjgwOFx1Qzc3NFx1QzE1OCA9PT09PVxuICBwcml2YXRlIHJ1blNpbXVsYXRpb24oKTogdm9pZCB7XG4gICAgdGhpcy5zaW1SdW5uaW5nID0gdHJ1ZTtcbiAgICB0aGlzLnNpbUl0ZXJhdGlvbnMgPSAwO1xuICAgIGNvbnN0IHRpY2sgPSAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2ltUnVubmluZykgcmV0dXJuO1xuICAgICAgdGhpcy5zaW1JdGVyYXRpb25zKys7XG4gICAgICB0aGlzLnNpbXVsYXRlU3RlcCgpO1xuICAgICAgdGhpcy5kcmF3KCk7XG4gICAgICBpZiAodGhpcy5zaW1JdGVyYXRpb25zIDwgMjAwKSB7XG4gICAgICAgIHRoaXMuYW5pbUZyYW1lID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZHJhdygpO1xuICAgICAgfVxuICAgIH07XG4gICAgdGhpcy5hbmltRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gIH1cblxuICBwcml2YXRlIHNpbXVsYXRlU3RlcCgpOiB2b2lkIHtcbiAgICBjb25zdCBhbHBoYSA9IE1hdGgubWF4KDAuMDEsIDEgLSB0aGlzLnNpbUl0ZXJhdGlvbnMgLyAyMDApO1xuICAgIGNvbnN0IG5vZGVzID0gdGhpcy5ub2RlcztcbiAgICBjb25zdCByZXB1bHNpb24gPSAzMDAwO1xuICAgIGNvbnN0IHNwcmluZ0xlbiA9IDEyMDtcbiAgICBjb25zdCBzcHJpbmdLID0gMC4wMjtcbiAgICBjb25zdCBjZW50ZXJHcmF2aXR5ID0gMC4wMTtcbiAgICBjb25zdCB3ID0gdGhpcy5jYW52YXMhLndpZHRoIC8gMjtcbiAgICBjb25zdCBoID0gdGhpcy5jYW52YXMhLmhlaWdodCAvIDI7XG5cbiAgICAvLyBSZXB1bHNpb24gKGFsbCBwYWlycylcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBub2Rlcy5sZW5ndGg7IGorKykge1xuICAgICAgICBjb25zdCBhID0gbm9kZXNbaV0sIGIgPSBub2Rlc1tqXTtcbiAgICAgICAgY29uc3QgZHggPSBiLnggLSBhLngsIGR5ID0gYi55IC0gYS55O1xuICAgICAgICBjb25zdCBkaXN0ID0gTWF0aC5zcXJ0KGR4ICogZHggKyBkeSAqIGR5KSB8fCAxO1xuICAgICAgICBjb25zdCBmb3JjZSA9IHJlcHVsc2lvbiAvIChkaXN0ICogZGlzdCk7XG4gICAgICAgIGNvbnN0IGZ4ID0gKGR4IC8gZGlzdCkgKiBmb3JjZSAqIGFscGhhO1xuICAgICAgICBjb25zdCBmeSA9IChkeSAvIGRpc3QpICogZm9yY2UgKiBhbHBoYTtcbiAgICAgICAgYS52eCAtPSBmeDsgYS52eSAtPSBmeTtcbiAgICAgICAgYi52eCArPSBmeDsgYi52eSArPSBmeTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTcHJpbmcgKGVkZ2VzKVxuICAgIGZvciAoY29uc3QgZSBvZiB0aGlzLmVkZ2VzKSB7XG4gICAgICBjb25zdCBhID0gdGhpcy5ub2RlTWFwLmdldChlLnNvdXJjZSk7XG4gICAgICBjb25zdCBiID0gdGhpcy5ub2RlTWFwLmdldChlLnRhcmdldCk7XG4gICAgICBpZiAoIWEgfHwgIWIpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgZHggPSBiLnggLSBhLngsIGR5ID0gYi55IC0gYS55O1xuICAgICAgY29uc3QgZGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSkgfHwgMTtcbiAgICAgIGNvbnN0IGZvcmNlID0gKGRpc3QgLSBzcHJpbmdMZW4pICogc3ByaW5nSyAqIGFscGhhO1xuICAgICAgY29uc3QgZnggPSAoZHggLyBkaXN0KSAqIGZvcmNlO1xuICAgICAgY29uc3QgZnkgPSAoZHkgLyBkaXN0KSAqIGZvcmNlO1xuICAgICAgYS52eCArPSBmeDsgYS52eSArPSBmeTtcbiAgICAgIGIudnggLT0gZng7IGIudnkgLT0gZnk7XG4gICAgfVxuXG4gICAgLy8gQ2VudGVyIGdyYXZpdHlcbiAgICBmb3IgKGNvbnN0IG4gb2Ygbm9kZXMpIHtcbiAgICAgIG4udnggKz0gKHcgLSBuLngpICogY2VudGVyR3Jhdml0eSAqIGFscGhhO1xuICAgICAgbi52eSArPSAoaCAtIG4ueSkgKiBjZW50ZXJHcmF2aXR5ICogYWxwaGE7XG4gICAgICAvLyBEYW1waW5nXG4gICAgICBuLnZ4ICo9IDAuODU7XG4gICAgICBuLnZ5ICo9IDAuODU7XG4gICAgICBpZiAoIW4uaXNDZW50ZXIgfHwgdGhpcy5zaW1JdGVyYXRpb25zID4gNSkge1xuICAgICAgICBuLnggKz0gbi52eDtcbiAgICAgICAgbi55ICs9IG4udnk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gPT09PT0gXHVCODBDXHVCMzU0XHVCOUMxID09PT09XG4gIHByaXZhdGUgZHJhdygpOiB2b2lkIHtcbiAgICBjb25zdCBjdHggPSB0aGlzLmN0eCE7XG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5jYW52YXMhO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICBjdHguc2F2ZSgpO1xuICAgIGN0eC50cmFuc2xhdGUodGhpcy5vZmZzZXRYLCB0aGlzLm9mZnNldFkpO1xuICAgIGN0eC5zY2FsZSh0aGlzLnNjYWxlLCB0aGlzLnNjYWxlKTtcblxuICAgIC8vIFx1QzVFM1x1QzlDMFxuICAgIGZvciAoY29uc3QgZSBvZiB0aGlzLmVkZ2VzKSB7XG4gICAgICBjb25zdCBhID0gdGhpcy5ub2RlTWFwLmdldChlLnNvdXJjZSk7XG4gICAgICBjb25zdCBiID0gdGhpcy5ub2RlTWFwLmdldChlLnRhcmdldCk7XG4gICAgICBpZiAoIWEgfHwgIWIpIGNvbnRpbnVlO1xuXG4gICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICBjdHgubW92ZVRvKGEueCwgYS55KTtcbiAgICAgIGN0eC5saW5lVG8oYi54LCBiLnkpO1xuICAgICAgY3R4LnN0cm9rZVN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDI1NSwyNTUsMjU1LDAuMilcIiA6IFwicmdiYSgwLDAsMCwwLjE1KVwiO1xuICAgICAgY3R4LmxpbmVXaWR0aCA9IDEuNTtcblxuICAgICAgaWYgKGUudHlwZSA9PT0gXCJyZWxhdGVkXCIpIHtcbiAgICAgICAgY3R4LnNldExpbmVEYXNoKFs2LCA0XSk7XG4gICAgICB9IGVsc2UgaWYgKGUudHlwZSA9PT0gXCJ0YWdfc2hhcmVkXCIpIHtcbiAgICAgICAgY3R4LnNldExpbmVEYXNoKFszLCA1XSk7XG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjEpXCIgOiBcInJnYmEoMCwwLDAsMC4wOClcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGN0eC5zZXRMaW5lRGFzaChbXSk7XG4gICAgICB9XG4gICAgICBjdHguc3Ryb2tlKCk7XG4gICAgICBjdHguc2V0TGluZURhc2goW10pO1xuICAgIH1cblxuICAgIC8vIFx1QjE3OFx1QjREQ1xuICAgIGZvciAoY29uc3QgbiBvZiB0aGlzLm5vZGVzKSB7XG4gICAgICBjb25zdCBjb2xvciA9IFRZUEVfQ09MT1JTW24udHlwZV0gfHwgREVGQVVMVF9DT0xPUjtcbiAgICAgIGNvbnN0IGlzSG92ZXJlZCA9IHRoaXMuaG92ZXJlZE5vZGUgPT09IG47XG5cbiAgICAgIC8vIEdsb3cgZm9yIGNlbnRlclxuICAgICAgaWYgKG4uaXNDZW50ZXIpIHtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIDYsIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IGNvbG9yICsgXCIzM1wiO1xuICAgICAgICBjdHguZmlsbCgpO1xuICAgICAgfVxuXG4gICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIChpc0hvdmVyZWQgPyAzIDogMCksIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgIGN0eC5maWxsU3R5bGUgPSBjb2xvcjtcbiAgICAgIGN0eC5maWxsKCk7XG4gICAgICBjdHguc3Ryb2tlU3R5bGUgPSBpc0hvdmVyZWQgPyBcIiNmZmZmZmZcIiA6ICh0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMjU1LDI1NSwyNTUsMC4zKVwiIDogXCJyZ2JhKDAsMCwwLDAuMilcIik7XG4gICAgICBjdHgubGluZVdpZHRoID0gaXNIb3ZlcmVkID8gMi41IDogMTtcbiAgICAgIGN0eC5zdHJva2UoKTtcblxuICAgICAgLy8gTGFiZWxcbiAgICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcIiNlMGUwZTBcIiA6IFwiIzMzMzMzM1wiO1xuICAgICAgY3R4LmZvbnQgPSBuLmlzQ2VudGVyID8gXCJib2xkIDExcHggc2Fucy1zZXJpZlwiIDogXCIxMHB4IHNhbnMtc2VyaWZcIjtcbiAgICAgIGN0eC50ZXh0QWxpZ24gPSBcImNlbnRlclwiO1xuICAgICAgY29uc3QgaXNIb3YgPSB0aGlzLmhvdmVyZWROb2RlID09PSBuO1xuICAgICAgaWYgKGlzSG92IHx8IG4uaXNDZW50ZXIpIHtcbiAgICAgICAgY29uc3QgbGFiZWwgPSBuLm5hbWUubGVuZ3RoID4gNDAgPyBuLm5hbWUuc2xpY2UoMCwgMzgpICsgXCJcdTIwMjZcIiA6IG4ubmFtZTtcbiAgICAgICAgY3R4LmZpbGxUZXh0KGxhYmVsLCBuLngsIG4ueSArIG4ucmFkaXVzICsgMTQpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnNjYWxlID4gMC42ICYmIG4ucmFkaXVzID49IDUpIHtcbiAgICAgICAgY29uc3Qgc2hvcnQgPSBuLm5hbWUubGVuZ3RoID4gMTIgPyBuLm5hbWUuc2xpY2UoMCwgMTApICsgXCJcdTIwMjZcIiA6IG4ubmFtZTtcbiAgICAgICAgY3R4LmZpbGxUZXh0KHNob3J0LCBuLngsIG4ueSArIG4ucmFkaXVzICsgMTQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGN0eC5yZXN0b3JlKCk7XG5cbiAgICAvLyBcdUQyMzRcdUQzMDFcbiAgICBpZiAodGhpcy5ob3ZlcmVkTm9kZSkge1xuICAgICAgdGhpcy5kcmF3VG9vbHRpcCh0aGlzLmhvdmVyZWROb2RlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGRyYXdUb29sdGlwKG46IEdyYXBoTm9kZSk6IHZvaWQge1xuICAgIGNvbnN0IGN0eCA9IHRoaXMuY3R4ITtcbiAgICBjb25zdCBzeCA9IG4ueCAqIHRoaXMuc2NhbGUgKyB0aGlzLm9mZnNldFg7XG4gICAgY29uc3Qgc3kgPSBuLnkgKiB0aGlzLnNjYWxlICsgdGhpcy5vZmZzZXRZIC0gbi5yYWRpdXMgKiB0aGlzLnNjYWxlIC0gMTA7XG5cbiAgICBjb25zdCBsaW5lcyA9IFtuLm5hbWUsIGBUeXBlOiAke24udHlwZX1gXTtcbiAgICBpZiAobi5zY29yZSAhPSBudWxsKSBsaW5lcy5wdXNoKGBTY29yZTogJHtuLnNjb3JlLnRvRml4ZWQoMyl9YCk7XG5cbiAgICBjdHguZm9udCA9IFwiMTFweCBzYW5zLXNlcmlmXCI7XG4gICAgY29uc3QgbWF4VyA9IE1hdGgubWF4KC4uLmxpbmVzLm1hcCgobCkgPT4gY3R4Lm1lYXN1cmVUZXh0KGwpLndpZHRoKSkgKyAxNjtcbiAgICBjb25zdCBoID0gbGluZXMubGVuZ3RoICogMTYgKyAxMDtcblxuICAgIGNvbnN0IHR4ID0gc3ggLSBtYXhXIC8gMjtcbiAgICBjb25zdCB0eSA9IHN5IC0gaDtcblxuICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMzAsMzAsMzAsMC45NSlcIiA6IFwicmdiYSgyNTUsMjU1LDI1NSwwLjk1KVwiO1xuICAgIGN0eC5zdHJva2VTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjIpXCIgOiBcInJnYmEoMCwwLDAsMC4xNSlcIjtcbiAgICBjdHgubGluZVdpZHRoID0gMTtcbiAgICB0aGlzLnJvdW5kUmVjdChjdHgsIHR4LCB0eSwgbWF4VywgaCwgNik7XG4gICAgY3R4LmZpbGwoKTtcbiAgICBjdHguc3Ryb2tlKCk7XG5cbiAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCIjZTBlMGUwXCIgOiBcIiMzMzMzMzNcIjtcbiAgICBjdHgudGV4dEFsaWduID0gXCJsZWZ0XCI7XG4gICAgbGluZXMuZm9yRWFjaCgobGluZSwgaSkgPT4ge1xuICAgICAgY3R4LmZpbGxUZXh0KGxpbmUsIHR4ICsgOCwgdHkgKyAxNiArIGkgKiAxNik7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHJvdW5kUmVjdChjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCwgeDogbnVtYmVyLCB5OiBudW1iZXIsIHc6IG51bWJlciwgaDogbnVtYmVyLCByOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgY3R4Lm1vdmVUbyh4ICsgciwgeSk7XG4gICAgY3R4LmxpbmVUbyh4ICsgdyAtIHIsIHkpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHggKyB3LCB5LCB4ICsgdywgeSArIHIpO1xuICAgIGN0eC5saW5lVG8oeCArIHcsIHkgKyBoIC0gcik7XG4gICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCArIHcsIHkgKyBoLCB4ICsgdyAtIHIsIHkgKyBoKTtcbiAgICBjdHgubGluZVRvKHggKyByLCB5ICsgaCk7XG4gICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCwgeSArIGgsIHgsIHkgKyBoIC0gcik7XG4gICAgY3R4LmxpbmVUbyh4LCB5ICsgcik7XG4gICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCwgeSwgeCArIHIsIHkpO1xuICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgfVxuXG4gIHByaXZhdGUgZHJhd0VtcHR5KG1zZzogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgY3R4ID0gdGhpcy5jdHghO1xuICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuY2FudmFzITtcbiAgICBjdHguY2xlYXJSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwiIzk5OVwiIDogXCIjNjY2XCI7XG4gICAgY3R4LmZvbnQgPSBcIjE0cHggc2Fucy1zZXJpZlwiO1xuICAgIGN0eC50ZXh0QWxpZ24gPSBcImNlbnRlclwiO1xuICAgIGN0eC5maWxsVGV4dChtc2csIGNhbnZhcy53aWR0aCAvIDIsIGNhbnZhcy5oZWlnaHQgLyAyKTtcbiAgfVxuXG4gIC8vID09PT09IFx1Qzc3OFx1RDEzMFx1Qjc5OVx1QzE1OCA9PT09PVxuICBwcml2YXRlIHNldHVwSW50ZXJhY3Rpb24oKTogdm9pZCB7XG4gICAgY29uc3QgYyA9IHRoaXMuY2FudmFzITtcblxuICAgIGMuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCAoZSkgPT4ge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuaGl0VGVzdChlLm9mZnNldFgsIGUub2Zmc2V0WSk7XG4gICAgICBpZiAobm9kZSkge1xuICAgICAgICB0aGlzLmRyYWdOb2RlID0gbm9kZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaXNQYW5uaW5nID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubGFzdE1vdXNlID0geyB4OiBlLm9mZnNldFgsIHk6IGUub2Zmc2V0WSB9O1xuICAgIH0pO1xuXG4gICAgYy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIChlKSA9PiB7XG4gICAgICBjb25zdCBkeCA9IGUub2Zmc2V0WCAtIHRoaXMubGFzdE1vdXNlLng7XG4gICAgICBjb25zdCBkeSA9IGUub2Zmc2V0WSAtIHRoaXMubGFzdE1vdXNlLnk7XG5cbiAgICAgIGlmICh0aGlzLmRyYWdOb2RlKSB7XG4gICAgICAgIHRoaXMuZHJhZ05vZGUueCArPSBkeCAvIHRoaXMuc2NhbGU7XG4gICAgICAgIHRoaXMuZHJhZ05vZGUueSArPSBkeSAvIHRoaXMuc2NhbGU7XG4gICAgICAgIHRoaXMuZHJhZ05vZGUudnggPSAwO1xuICAgICAgICB0aGlzLmRyYWdOb2RlLnZ5ID0gMDtcbiAgICAgICAgaWYgKCF0aGlzLnNpbVJ1bm5pbmcpIHRoaXMuZHJhdygpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzUGFubmluZykge1xuICAgICAgICB0aGlzLm9mZnNldFggKz0gZHg7XG4gICAgICAgIHRoaXMub2Zmc2V0WSArPSBkeTtcbiAgICAgICAgaWYgKCF0aGlzLnNpbVJ1bm5pbmcpIHRoaXMuZHJhdygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcHJldiA9IHRoaXMuaG92ZXJlZE5vZGU7XG4gICAgICAgIHRoaXMuaG92ZXJlZE5vZGUgPSB0aGlzLmhpdFRlc3QoZS5vZmZzZXRYLCBlLm9mZnNldFkpO1xuICAgICAgICBjLnN0eWxlLmN1cnNvciA9IHRoaXMuaG92ZXJlZE5vZGUgPyBcInBvaW50ZXJcIiA6IFwiZGVmYXVsdFwiO1xuICAgICAgICBpZiAocHJldiAhPT0gdGhpcy5ob3ZlcmVkTm9kZSAmJiAhdGhpcy5zaW1SdW5uaW5nKSB0aGlzLmRyYXcoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubGFzdE1vdXNlID0geyB4OiBlLm9mZnNldFgsIHk6IGUub2Zmc2V0WSB9O1xuICAgIH0pO1xuXG4gICAgYy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCAoZSkgPT4ge1xuICAgICAgaWYgKHRoaXMuZHJhZ05vZGUpIHtcbiAgICAgICAgLy8gXHVEMDc0XHVCOUFEIChcdUI0RENcdUI3OThcdUFERjggXHVDNTQ0XHVCMkQ4KSBcdTIxOTIgXHVCMTc4XHVEMkI4IFx1QzVGNFx1QUUzMFxuICAgICAgICBjb25zdCBkeCA9IE1hdGguYWJzKGUub2Zmc2V0WCAtIHRoaXMubGFzdE1vdXNlLngpO1xuICAgICAgICBjb25zdCBkeSA9IE1hdGguYWJzKGUub2Zmc2V0WSAtIHRoaXMubGFzdE1vdXNlLnkpO1xuICAgICAgICBpZiAoZHggPCAzICYmIGR5IDwgMykge1xuICAgICAgICAgIHRoaXMub3Blbk5vdGUodGhpcy5kcmFnTm9kZS5pZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZHJhZ05vZGUgPSBudWxsO1xuICAgICAgdGhpcy5pc1Bhbm5pbmcgPSBmYWxzZTtcbiAgICB9KTtcblxuICAgIGMuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICBjb25zdCBub2RlID0gdGhpcy5oaXRUZXN0KGUub2Zmc2V0WCwgZS5vZmZzZXRZKTtcbiAgICAgIGlmIChub2RlKSB7XG4gICAgICAgIGlmIChub2RlLl9jbHVzdGVySW5kZXggIT0gbnVsbCkge1xuICAgICAgICAgIC8vIFx1RDA3NFx1QjdFQ1x1QzJBNFx1RDEzMCBcdTIxOTIgXHVCNERDXHVCOUI0XHVCMkU0XHVDNkI0XG4gICAgICAgICAgdm9pZCB0aGlzLmRyaWxsSW50b0NsdXN0ZXIobm9kZS5fY2x1c3RlckluZGV4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm9wZW5Ob3RlKG5vZGUuaWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjLmFkZEV2ZW50TGlzdGVuZXIoXCJ3aGVlbFwiLCAoZSkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgY29uc3Qgem9vbSA9IGUuZGVsdGFZIDwgMCA/IDEuMSA6IDAuOTtcbiAgICAgIGNvbnN0IG14ID0gZS5vZmZzZXRYLCBteSA9IGUub2Zmc2V0WTtcbiAgICAgIHRoaXMub2Zmc2V0WCA9IG14IC0gem9vbSAqIChteCAtIHRoaXMub2Zmc2V0WCk7XG4gICAgICB0aGlzLm9mZnNldFkgPSBteSAtIHpvb20gKiAobXkgLSB0aGlzLm9mZnNldFkpO1xuICAgICAgdGhpcy5zY2FsZSAqPSB6b29tO1xuICAgICAgdGhpcy5zY2FsZSA9IE1hdGgubWF4KDAuMiwgTWF0aC5taW4oNSwgdGhpcy5zY2FsZSkpO1xuICAgICAgaWYgKCF0aGlzLnNpbVJ1bm5pbmcpIHRoaXMuZHJhdygpO1xuICAgIH0sIHsgcGFzc2l2ZTogZmFsc2UgfSk7XG4gIH1cblxuICBwcml2YXRlIGhpdFRlc3QobXg6IG51bWJlciwgbXk6IG51bWJlcik6IEdyYXBoTm9kZSB8IG51bGwge1xuICAgIGNvbnN0IHggPSAobXggLSB0aGlzLm9mZnNldFgpIC8gdGhpcy5zY2FsZTtcbiAgICBjb25zdCB5ID0gKG15IC0gdGhpcy5vZmZzZXRZKSAvIHRoaXMuc2NhbGU7XG4gICAgLy8gUmV2ZXJzZSBvcmRlciBzbyB0b3AtZHJhd24gbm9kZXMgYXJlIGhpdCBmaXJzdFxuICAgIGZvciAobGV0IGkgPSB0aGlzLm5vZGVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBuID0gdGhpcy5ub2Rlc1tpXTtcbiAgICAgIGNvbnN0IGR4ID0geCAtIG4ueCwgZHkgPSB5IC0gbi55O1xuICAgICAgaWYgKGR4ICogZHggKyBkeSAqIGR5IDw9IChuLnJhZGl1cyArIDQpICogKG4ucmFkaXVzICsgNCkpIHJldHVybiBuO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgb3Blbk5vdGUoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIGlkXHVCMjk0IFx1RDMwQ1x1Qzc3QyBcdUFDQkRcdUI4NUMgKFx1QzYwODogXCJmb2xkZXIvbm90ZS5tZFwiKVxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoaWQpO1xuICAgIGlmIChmaWxlKSB7XG4gICAgICB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoaWQsIFwiXCIsIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZml0VG9WaWV3KCk6IHZvaWQge1xuICAgIGlmICh0aGlzLm5vZGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgIGxldCBtaW5YID0gSW5maW5pdHksIG1heFggPSAtSW5maW5pdHksIG1pblkgPSBJbmZpbml0eSwgbWF4WSA9IC1JbmZpbml0eTtcbiAgICBmb3IgKGNvbnN0IG4gb2YgdGhpcy5ub2Rlcykge1xuICAgICAgbWluWCA9IE1hdGgubWluKG1pblgsIG4ueCAtIG4ucmFkaXVzKTtcbiAgICAgIG1heFggPSBNYXRoLm1heChtYXhYLCBuLnggKyBuLnJhZGl1cyk7XG4gICAgICBtaW5ZID0gTWF0aC5taW4obWluWSwgbi55IC0gbi5yYWRpdXMpO1xuICAgICAgbWF4WSA9IE1hdGgubWF4KG1heFksIG4ueSArIG4ucmFkaXVzKTtcbiAgICB9XG4gICAgY29uc3QgcGFkID0gNDA7XG4gICAgY29uc3QgdyA9IHRoaXMuY2FudmFzIS53aWR0aDtcbiAgICBjb25zdCBoID0gdGhpcy5jYW52YXMhLmhlaWdodDtcbiAgICBjb25zdCBndyA9IG1heFggLSBtaW5YICsgcGFkICogMjtcbiAgICBjb25zdCBnaCA9IG1heFkgLSBtaW5ZICsgcGFkICogMjtcbiAgICB0aGlzLnNjYWxlID0gTWF0aC5taW4odyAvIGd3LCBoIC8gZ2gsIDIpO1xuICAgIHRoaXMub2Zmc2V0WCA9IHcgLyAyIC0gKChtaW5YICsgbWF4WCkgLyAyKSAqIHRoaXMuc2NhbGU7XG4gICAgdGhpcy5vZmZzZXRZID0gaCAvIDIgLSAoKG1pblkgKyBtYXhZKSAvIDIpICogdGhpcy5zY2FsZTtcbiAgICB0aGlzLmRyYXcoKTtcbiAgfVxuXG4gIC8vID09PT09IFx1QzcyMFx1RDJGOCA9PT09PVxuICBwcml2YXRlIHJlc2l6ZUNhbnZhcygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY2FudmFzKSByZXR1cm47XG4gICAgY29uc3QgcmVjdCA9IHRoaXMuY2FudmFzLnBhcmVudEVsZW1lbnQhLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHRoaXMuY2FudmFzLndpZHRoID0gcmVjdC53aWR0aDtcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSByZWN0LmhlaWdodDtcbiAgICBpZiAoIXRoaXMuc2ltUnVubmluZykgdGhpcy5kcmF3KCk7XG4gIH1cblxuICBwcml2YXRlIGlzRGFya1RoZW1lKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5jb250YWlucyhcInRoZW1lLWRhcmtcIik7XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFDLElBQUFBLG1CQUErQjs7O0FDQS9CLHNCQUEyQjtBQXVFckIsSUFBTSxpQkFBTixNQUFxQjtBQUFBLEVBQzFCLFlBQW9CLFNBQWlCO0FBQWpCO0FBQUEsRUFBa0I7QUFBQSxFQUV0QyxXQUFXLEtBQW1CO0FBQzVCLFNBQUssVUFBVSxJQUFJLFFBQVEsUUFBUSxFQUFFO0FBQUEsRUFDdkM7QUFBQTtBQUFBLEVBR0EsTUFBTSxPQUNKLE9BQ0EsT0FBZSxVQUNmLFFBQWdCLElBQ2M7QUFDOUIsVUFBTSxTQUFTLElBQUksZ0JBQWdCLEVBQUUsR0FBRyxPQUFPLE1BQU0sT0FBTyxPQUFPLEtBQUssRUFBRSxDQUFDO0FBQzNFLFVBQU0sTUFBTSxHQUFHLEtBQUssT0FBTyxXQUFXLE1BQU07QUFFNUMsUUFBSTtBQUNGLFlBQU0sV0FBVyxVQUFNLDRCQUFXLEVBQUUsS0FBSyxRQUFRLE1BQU0sQ0FBQztBQUN4RCxZQUFNLE9BQU8sU0FBUztBQUN0QixZQUFNLGFBQWdDLE1BQU0sUUFBUSxJQUFJLElBQ3BELE9BQ0MsS0FBSyxXQUFXLENBQUM7QUFDdEIsYUFBTyxXQUFXLElBQUksQ0FBQyxPQUEyQztBQUFBLFFBQ2hFLE1BQU0sRUFBRSxRQUFRO0FBQUEsUUFDaEIsT0FBTyxFQUFF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QVM7QUFBQSxJQUNuRDtBQUdBLFNBQUssY0FBYyxZQUFZLGVBQWUsTUFBTTtBQUNsRCxXQUFLLEtBQUssY0FBYztBQUFBLElBQzFCLENBQUM7QUFHRCxTQUFLLFdBQVc7QUFBQSxNQUNkLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFVBQVUsTUFBTTtBQUFFLGFBQUssS0FBSyxjQUFjO0FBQUEsTUFBRztBQUFBLElBQy9DLENBQUM7QUFHRCxTQUFLLFdBQVc7QUFBQSxNQUNkLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFVBQVUsWUFBWTtBQUNwQixjQUFNLFFBQVEsTUFBTSxLQUFLLFVBQVUsTUFBTTtBQUN6QyxZQUFJLE9BQU87QUFDVCxjQUFJLHdCQUFPLFVBQVUsTUFBTSxXQUFXLFdBQVcsTUFBTSxXQUFXLFFBQVE7QUFBQSxRQUM1RSxPQUFPO0FBQ0wsY0FBSSx3QkFBTyxtR0FBNEM7QUFBQSxRQUN6RDtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFFRCxZQUFRLE1BQU0saUNBQWlDO0FBQUEsRUFDakQ7QUFBQSxFQUVBLFdBQWlCO0FBQ2YsWUFBUSxNQUFNLG1DQUFtQztBQUFBLEVBQ25EO0FBQUEsRUFFQSxNQUFNLGVBQThCO0FBQ2xDLFVBQU0sU0FBUyxNQUFNLEtBQUssU0FBUztBQUNuQyxTQUFLLFdBQVcsT0FBTyxPQUFPLENBQUMsR0FBRyxrQkFBa0IsTUFBTTtBQUFBLEVBQzVEO0FBQUEsRUFFQSxNQUFNLGVBQThCO0FBQ2xDLFVBQU0sS0FBSyxTQUFTLEtBQUssUUFBUTtBQUFBLEVBQ25DO0FBQUEsRUFFQSxNQUFjLGdCQUErQjtBQUMzQyxVQUFNLFdBQVcsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLHFCQUFxQjtBQUN6RSxRQUFJO0FBQ0osUUFBSSxTQUFTLFNBQVMsR0FBRztBQUN2QixhQUFPLFNBQVMsQ0FBQztBQUFBLElBQ25CLE9BQU87QUFDTCxhQUFPLEtBQUssSUFBSSxVQUFVLGFBQWEsS0FBSztBQUM1QyxZQUFNLEtBQUssYUFBYSxFQUFFLE1BQU0sdUJBQXVCLFFBQVEsS0FBSyxDQUFDO0FBQUEsSUFDdkU7QUFDQSxVQUFNLEtBQUssSUFBSSxVQUFVLFdBQVcsSUFBSTtBQUd4QyxVQUFNLE9BQU8sS0FBSyxJQUFJLFVBQVUsY0FBYztBQUM5QyxRQUFJLE1BQU07QUFDUixZQUFNLE9BQU8sS0FBSztBQUNsQixXQUFLLGNBQWMsS0FBSyxJQUFJO0FBQUEsSUFDOUI7QUFBQSxFQUNGO0FBQ0Y7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiJdCn0K
