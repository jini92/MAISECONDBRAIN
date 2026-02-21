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
      const results = data.results ?? data;
      return results.map((r) => ({
        ...r,
        title: r.title || r.name || r.key || "Untitled"
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
    containerEl.createEl("h2", { text: "Mnemo SecondBrain Settings" });
    new import_obsidian2.Setting(containerEl).setName("Mnemo API URL").setDesc("Mnemo FastAPI \uC11C\uBC84 \uC8FC\uC18C / Mnemo server address").addText(
      (text) => text.setPlaceholder("http://127.0.0.1:8000").setValue(this.plugin.settings.apiUrl).onChange(async (value) => {
        this.plugin.settings.apiUrl = value;
        this.plugin.apiClient.setBaseUrl(value);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Search result limit").setDesc("\uAC80\uC0C9 \uACB0\uACFC \uCD5C\uB300 \uAC1C\uC218 / Maximum number of results").addSlider(
      (slider) => slider.setLimits(5, 50, 5).setValue(this.plugin.settings.searchLimit).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.searchLimit = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Search mode").setDesc("\uAC80\uC0C9 \uBC29\uC2DD \uC120\uD0DD / Select search method").addDropdown(
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
    this.setPlaceholder("Mnemo \uAC80\uC0C9... / Search Mnemo...");
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
    return "Mnemo Graph";
  }
  getIcon() {
    return "git-fork";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("mnemo-graph-container");
    const toolbar = container.createDiv({ cls: "mnemo-graph-toolbar" });
    toolbar.createEl("span", { text: "Mnemo Graph", cls: "mnemo-graph-title" });
    const localBtn = toolbar.createEl("button", { text: "\u{1F4CD} Local", cls: "mnemo-graph-btn mnemo-graph-btn-active", attr: { title: "Current note graph" } });
    localBtn.addEventListener("click", () => {
      this.setActiveBtn(localBtn);
      this.viewMode = "local";
      this.loadGraph();
    });
    const clusterBtn = toolbar.createEl("button", { text: "\u{1F52E} Explore", cls: "mnemo-graph-btn", attr: { title: "Explore by clusters (drill-down)" } });
    clusterBtn.addEventListener("click", () => {
      this.setActiveBtn(clusterBtn);
      this.viewMode = "cluster";
      this.loadClusters();
    });
    const fullBtn = toolbar.createEl("button", { text: "\u{1F310} Full", cls: "mnemo-graph-btn", attr: { title: "Full knowledge graph" } });
    fullBtn.addEventListener("click", () => {
      this.setActiveBtn(fullBtn);
      this.viewMode = "full";
      this.loadFullGraph();
    });
    this.backBtn = toolbar.createEl("button", { text: "\u2190 Back", cls: "mnemo-graph-btn", attr: { title: "Back to clusters" } });
    this.backBtn.style.display = "none";
    this.backBtn.addEventListener("click", () => {
      this.backBtn.style.display = "none";
      this.loadClusters();
    });
    this.allBtns = [localBtn, clusterBtn, fullBtn];
    const refreshBtn = toolbar.createEl("button", { text: "\u21BB", cls: "mnemo-graph-btn", attr: { title: "Refresh" } });
    refreshBtn.addEventListener("click", () => this.viewMode === "full" ? this.loadFullGraph() : this.loadGraph());
    const fitBtn = toolbar.createEl("button", { text: "\u22A1", cls: "mnemo-graph-btn", attr: { title: "Fit to view" } });
    fitBtn.addEventListener("click", () => this.fitToView());
    this.canvas = container.createEl("canvas", { cls: "mnemo-graph-canvas" });
    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();
    this.registerDomEvent(window, "resize", () => this.resizeCanvas());
    this.setupInteraction();
    this.loadGraph();
  }
  async onClose() {
    this.simRunning = false;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
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
      const centerNode = nodes.find((n) => n.id === path || n.id === path.replace(/\.md$/, ""));
      const keep = /* @__PURE__ */ new Set();
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
    this.loadGraph(path);
  }
  setActiveBtn(active) {
    for (const btn of this.allBtns) btn.removeClass("mnemo-graph-btn-active");
    active.addClass("mnemo-graph-btn-active");
    if (this.backBtn) this.backBtn.style.display = "none";
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
    this.edges = (data.edges || []).map((e) => ({
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
      x: n.x / 1e3 * w * 0.9 + w * 0.05,
      y: n.y / 1e3 * h * 0.9 + h * 0.05,
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
    if (this.backBtn) this.backBtn.style.display = "inline-block";
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
      x: n.x / 1e3 * w * 0.9 + w * 0.05,
      y: n.y / 1e3 * h * 0.9 + h * 0.05,
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
        let dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
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
      let dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
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
      const label = n.name.length > 20 ? n.name.slice(0, 18) + "\u2026" : n.name;
      ctx.fillText(label, n.x, n.y + n.radius + 14);
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
          this.drillIntoCluster(node._clusterIndex);
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
      this.app.workspace.openLinkText(id, "", true);
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
    this.addRibbonIcon("brain", "Mnemo Search", () => {
      new MnemoSearchModal(this.app, this.apiClient, this.settings).open();
    });
    this.addCommand({
      id: "mnemo-search",
      name: "Search Mnemo",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "m" }],
      callback: () => {
        new MnemoSearchModal(this.app, this.apiClient, this.settings).open();
      }
    });
    this.registerView(
      MNEMO_GRAPH_VIEW_TYPE,
      (leaf) => new MnemoGraphView(leaf, this.apiClient)
    );
    this.addRibbonIcon("git-fork", "Mnemo Graph", () => {
      this.openGraphView();
    });
    this.addCommand({
      id: "mnemo-open-graph",
      name: "Mnemo: Open Graph View",
      callback: () => this.openGraphView()
    });
    this.addCommand({
      id: "mnemo-check-status",
      name: "Check Mnemo Server Status",
      callback: async () => {
        const stats = await this.apiClient.stats();
        if (stats) {
          new import_obsidian5.Notice(`Mnemo: ${stats.total_notes} notes, ${stats.total_edges} edges`);
        } else {
          new import_obsidian5.Notice("Mnemo: \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 / Server unreachable");
        }
      }
    });
    console.log("Mnemo SecondBrain plugin loaded");
  }
  onunload() {
    console.log("Mnemo SecondBrain plugin unloaded");
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2FwaS1jbGllbnQudHMiLCAic3JjL3NldHRpbmdzLnRzIiwgInNyYy9zZWFyY2gtbW9kYWwudHMiLCAic3JjL2dyYXBoLXZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IFBsdWdpbiwgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBNbmVtb0FwaUNsaWVudCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcbmltcG9ydCB7IE1uZW1vU2V0dGluZ3MsIE1uZW1vU2V0dGluZ1RhYiwgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBNbmVtb1NlYXJjaE1vZGFsIH0gZnJvbSBcIi4vc2VhcmNoLW1vZGFsXCI7XG5pbXBvcnQgeyBNbmVtb0dyYXBoVmlldywgTU5FTU9fR1JBUEhfVklFV19UWVBFIH0gZnJvbSBcIi4vZ3JhcGgtdmlld1wiO1xuXG4vLyBNbmVtbyBTZWNvbmRCcmFpbiBPYnNpZGlhbiBQbHVnaW5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1uZW1vUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IE1uZW1vU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuICBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50ID0gbmV3IE1uZW1vQXBpQ2xpZW50KERFRkFVTFRfU0VUVElOR1MuYXBpVXJsKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFwaUNsaWVudC5zZXRCYXNlVXJsKHRoaXMuc2V0dGluZ3MuYXBpVXJsKTtcblxuICAgIC8vIFx1QzEyNFx1QzgxNSBcdUQwRUQgXHVCNEYxXHVCODVEIC8gUmVnaXN0ZXIgc2V0dGluZ3MgdGFiXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNbmVtb1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIC8vIFx1QjlBQ1x1QkNGOCBcdUM1NDRcdUM3NzRcdUNGNTggLyBSaWJib24gaWNvblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcImJyYWluXCIsIFwiTW5lbW8gU2VhcmNoXCIsICgpID0+IHtcbiAgICAgIG5ldyBNbmVtb1NlYXJjaE1vZGFsKHRoaXMuYXBwLCB0aGlzLmFwaUNsaWVudCwgdGhpcy5zZXR0aW5ncykub3BlbigpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1Q0VFNFx1QjlFOFx1QjREQyAoQ3RybCtTaGlmdCtNKSAvIFNlYXJjaCBjb21tYW5kXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLXNlYXJjaFwiLFxuICAgICAgbmFtZTogXCJTZWFyY2ggTW5lbW9cIixcbiAgICAgIGhvdGtleXM6IFt7IG1vZGlmaWVyczogW1wiQ3RybFwiLCBcIlNoaWZ0XCJdLCBrZXk6IFwibVwiIH1dLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgbmV3IE1uZW1vU2VhcmNoTW9kYWwodGhpcy5hcHAsIHRoaXMuYXBpQ2xpZW50LCB0aGlzLnNldHRpbmdzKS5vcGVuKCk7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gXHVBREY4XHVCNzk4XHVENTA0IFx1QkRGMCBcdUI0RjFcdUI4NUQgLyBSZWdpc3RlciBncmFwaCB2aWV3XG4gICAgdGhpcy5yZWdpc3RlclZpZXcoXG4gICAgICBNTkVNT19HUkFQSF9WSUVXX1RZUEUsXG4gICAgICAobGVhZikgPT4gbmV3IE1uZW1vR3JhcGhWaWV3KGxlYWYsIHRoaXMuYXBpQ2xpZW50KVxuICAgICk7XG5cbiAgICAvLyBcdUFERjhcdUI3OThcdUQ1MDQgXHVCREYwIFx1QjlBQ1x1QkNGOCBcdUM1NDRcdUM3NzRcdUNGNThcbiAgICB0aGlzLmFkZFJpYmJvbkljb24oXCJnaXQtZm9ya1wiLCBcIk1uZW1vIEdyYXBoXCIsICgpID0+IHtcbiAgICAgIHRoaXMub3BlbkdyYXBoVmlldygpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBREY4XHVCNzk4XHVENTA0IFx1QkRGMCBcdUM1RjRcdUFFMzAgXHVDRUU0XHVCOUU4XHVCNERDXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLW9wZW4tZ3JhcGhcIixcbiAgICAgIG5hbWU6IFwiTW5lbW86IE9wZW4gR3JhcGggVmlld1wiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHRoaXMub3BlbkdyYXBoVmlldygpLFxuICAgIH0pO1xuXG4gICAgLy8gXHVDMTFDXHVCQzg0IFx1QzBDMVx1RDBEQyBcdUQ2NTVcdUM3NzggLyBDaGVjayBzZXJ2ZXIgb24gbG9hZFxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJtbmVtby1jaGVjay1zdGF0dXNcIixcbiAgICAgIG5hbWU6IFwiQ2hlY2sgTW5lbW8gU2VydmVyIFN0YXR1c1wiLFxuICAgICAgY2FsbGJhY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLmFwaUNsaWVudC5zdGF0cygpO1xuICAgICAgICBpZiAoc3RhdHMpIHtcbiAgICAgICAgICBuZXcgTm90aWNlKGBNbmVtbzogJHtzdGF0cy50b3RhbF9ub3Rlc30gbm90ZXMsICR7c3RhdHMudG90YWxfZWRnZXN9IGVkZ2VzYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3IE5vdGljZShcIk1uZW1vOiBcdUMxMUNcdUJDODRcdUM1RDAgXHVDNUYwXHVBQ0IwXHVENTYwIFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQgLyBTZXJ2ZXIgdW5yZWFjaGFibGVcIik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZyhcIk1uZW1vIFNlY29uZEJyYWluIHBsdWdpbiBsb2FkZWRcIik7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZyhcIk1uZW1vIFNlY29uZEJyYWluIHBsdWdpbiB1bmxvYWRlZFwiKTtcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBvcGVuR3JhcGhWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShNTkVNT19HUkFQSF9WSUVXX1RZUEUpO1xuICAgIGxldCBsZWFmOiBpbXBvcnQoXCJvYnNpZGlhblwiKS5Xb3Jrc3BhY2VMZWFmO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICBsZWFmID0gZXhpc3RpbmdbMF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKSE7XG4gICAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IE1ORU1PX0dSQVBIX1ZJRVdfVFlQRSwgYWN0aXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcblxuICAgIC8vIFx1RDYwNFx1QzdBQyBcdUIxNzhcdUQyQjggXHVBRTMwXHVDOTAwXHVDNzNDXHVCODVDIFx1QURGOFx1Qjc5OFx1RDUwNCBcdUI4NUNcdUI0RENcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICBpZiAoZmlsZSkge1xuICAgICAgY29uc3QgdmlldyA9IGxlYWYudmlldyBhcyBNbmVtb0dyYXBoVmlldztcbiAgICAgIHZpZXcuc2V0Q2VudGVyUGF0aChmaWxlLnBhdGgpO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IHJlcXVlc3RVcmwgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuLy8gTW5lbW8gQVBJIFx1QUM4MFx1QzBDOSBcdUFDQjBcdUFDRkMgXHVEMEMwXHVDNzg1IC8gU2VhcmNoIHJlc3VsdCB0eXBlXG5leHBvcnQgaW50ZXJmYWNlIE1uZW1vU2VhcmNoUmVzdWx0IHtcbiAgbmFtZTogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBzbmlwcGV0OiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG4gIGVudGl0eV90eXBlPzogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIHBhdGg/OiBzdHJpbmc7XG59XG5cbi8vIE1uZW1vIFx1QzExQ1x1QkM4NCBcdUQxQjVcdUFDQzQgLyBTZXJ2ZXIgc3RhdHNcbmV4cG9ydCBpbnRlcmZhY2UgTW5lbW9TdGF0cyB7XG4gIHRvdGFsX25vdGVzOiBudW1iZXI7XG4gIHRvdGFsX2VkZ2VzOiBudW1iZXI7XG4gIGluZGV4X3N0YXR1czogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN1YmdyYXBoTm9kZSB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzY29yZT86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdWJncmFwaEVkZ2Uge1xuICBzb3VyY2U6IHN0cmluZztcbiAgdGFyZ2V0OiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1uZW1vQXBpQ2xpZW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmcpIHt9XG5cbiAgc2V0QmFzZVVybCh1cmw6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuYmFzZVVybCA9IHVybC5yZXBsYWNlKC9cXC8rJC8sIFwiXCIpO1xuICB9XG5cbiAgLy8gXHVBQzgwXHVDMEM5IEFQSSBcdUQ2MzhcdUNEOUMgLyBDYWxsIHNlYXJjaCBBUElcbiAgYXN5bmMgc2VhcmNoKFxuICAgIHF1ZXJ5OiBzdHJpbmcsXG4gICAgbW9kZTogc3RyaW5nID0gXCJoeWJyaWRcIixcbiAgICBsaW1pdDogbnVtYmVyID0gMTBcbiAgKTogUHJvbWlzZTxNbmVtb1NlYXJjaFJlc3VsdFtdPiB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7IHE6IHF1ZXJ5LCBtb2RlLCBsaW1pdDogU3RyaW5nKGxpbWl0KSB9KTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L3NlYXJjaD8ke3BhcmFtc31gO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgY29uc3QgZGF0YSA9IHJlc3BvbnNlLmpzb247XG4gICAgICBjb25zdCByZXN1bHRzID0gKGRhdGEucmVzdWx0cyA/PyBkYXRhKSBhcyBhbnlbXTtcbiAgICAgIHJldHVybiByZXN1bHRzLm1hcCgocjogYW55KSA9PiAoe1xuICAgICAgICAuLi5yLFxuICAgICAgICB0aXRsZTogci50aXRsZSB8fCByLm5hbWUgfHwgci5rZXkgfHwgXCJVbnRpdGxlZFwiLFxuICAgICAgfSkpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1QzExQ1x1QkM4NCBcdUMwQzFcdUQwREMgXHVENjU1XHVDNzc4IC8gQ2hlY2sgc2VydmVyIHN0YXRzXG4gIGFzeW5jIHN0YXRzKCk6IFByb21pc2U8TW5lbW9TdGF0cyB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgICAgdXJsOiBgJHt0aGlzLmJhc2VVcmx9L3N0YXRzYCxcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzcG9uc2UuanNvbiBhcyBNbmVtb1N0YXRzO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVDMTFDXHVCRTBDXHVBREY4XHVCNzk4XHVENTA0IFx1Qzg3MFx1RDY4QyAvIEdldCBzdWJncmFwaCBmb3IgdmlzdWFsaXphdGlvblxuICBhc3luYyBzdWJncmFwaChcbiAgICBjZW50ZXI6IHN0cmluZyxcbiAgICBkZXB0aDogbnVtYmVyID0gMlxuICApOiBQcm9taXNlPHsgbm9kZXM6IFN1YmdyYXBoTm9kZVtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW10gfSB8IG51bGw+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHsgY2VudGVyLCBkZXB0aDogU3RyaW5nKGRlcHRoKSB9KTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2dyYXBoL3N1YmdyYXBoPyR7cGFyYW1zfWA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlW107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSB9O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVEMDc0XHVCN0VDXHVDMkE0XHVEMTMwIFx1QURGOFx1Qjc5OFx1RDUwNCAoXHVBQ0M0XHVDRTM1XHVDODAxIFx1RDBEMFx1QzBDOSkgLyBDbHVzdGVyIGdyYXBoIGZvciBkcmlsbC1kb3duXG4gIGFzeW5jIGNsdXN0ZXJzKCk6IFByb21pc2U8YW55IHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmw6IGAke3RoaXMuYmFzZVVybH0vZ3JhcGgvY2x1c3RlcnNgLCBtZXRob2Q6IFwiR0VUXCIgfSk7XG4gICAgICByZXR1cm4gcmVzcG9uc2UuanNvbjtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZXJyKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1RDA3NFx1QjdFQ1x1QzJBNFx1RDEzMCBcdUMwQzFcdUMxMzggKGRyaWxsLWRvd24pIC8gQ2x1c3RlciBkZXRhaWxcbiAgYXN5bmMgY2x1c3RlckRldGFpbChpbmRleDogbnVtYmVyKTogUHJvbWlzZTx7IG5vZGVzOiBTdWJncmFwaE5vZGVbXTsgZWRnZXM6IFN1YmdyYXBoRWRnZVtdIH0gfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybDogYCR7dGhpcy5iYXNlVXJsfS9ncmFwaC9jbHVzdGVyLyR7aW5kZXh9YCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlW107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSB9O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVDODA0XHVDQ0I0IFx1QURGOFx1Qjc5OFx1RDUwNCAoXHVDMEFDXHVDODA0IFx1QUNDNFx1QzBCMCBcdUI4MDhcdUM3NzRcdUM1NDRcdUM2QzMpIC8gRnVsbCBncmFwaCB3aXRoIHByZWNvbXB1dGVkIGxheW91dFxuICBhc3luYyBmdWxsR3JhcGgoKTogUHJvbWlzZTx7IG5vZGVzOiBTdWJncmFwaE5vZGVbXTsgZWRnZXM6IFN1YmdyYXBoRWRnZVtdOyBsYXlvdXQ6IHN0cmluZyB9IHwgbnVsbD4ge1xuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0vZ3JhcGgvZnVsbGA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlW107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXTsgbGF5b3V0OiBzdHJpbmcgfTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZXJyKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1QzVEMFx1QjdFQyBcdUNDOThcdUI5QUMgLyBFcnJvciBoYW5kbGluZyB3aXRoIGZyaWVuZGx5IG1lc3NhZ2VzXG4gIHByaXZhdGUgaGFuZGxlRXJyb3IoZXJyOiB1bmtub3duKTogdm9pZCB7XG4gICAgY29uc3QgbXNnID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpO1xuICAgIGlmIChtc2cuaW5jbHVkZXMoXCJFQ09OTlJFRlVTRURcIikgfHwgbXNnLmluY2x1ZGVzKFwibmV0OjpFUlJcIikpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIGBbTW5lbW9dIFx1QzExQ1x1QkM4NFx1QzVEMCBcdUM1RjBcdUFDQjBcdUQ1NjAgXHVDMjE4IFx1QzVDNlx1QzJCNVx1QjJDOFx1QjJFNC4gTW5lbW8gXHVDMTFDXHVCQzg0XHVBQzAwIFx1QzJFNFx1RDU4OSBcdUM5MTFcdUM3NzhcdUM5QzAgXHVENjU1XHVDNzc4XHVENTU4XHVDMTM4XHVDNjk0LlxcbmAgK1xuICAgICAgICAgIGBDYW5ub3QgY29ubmVjdCB0byBNbmVtbyBzZXJ2ZXIgYXQgJHt0aGlzLmJhc2VVcmx9LiBJcyBpdCBydW5uaW5nP2BcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYFtNbmVtb10gQVBJIGVycm9yOiAke21zZ31gKTtcbiAgICB9XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIE1uZW1vUGx1Z2luIGZyb20gXCIuL21haW5cIjtcblxuLy8gXHVENTBDXHVCN0VDXHVBREY4XHVDNzc4IFx1QzEyNFx1QzgxNSBcdUM3NzhcdUQxMzBcdUQzOThcdUM3NzRcdUMyQTQgLyBQbHVnaW4gc2V0dGluZ3MgaW50ZXJmYWNlXG5leHBvcnQgaW50ZXJmYWNlIE1uZW1vU2V0dGluZ3Mge1xuICBhcGlVcmw6IHN0cmluZztcbiAgc2VhcmNoTGltaXQ6IG51bWJlcjtcbiAgc2VhcmNoTW9kZTogXCJoeWJyaWRcIiB8IFwidmVjdG9yXCIgfCBcImtleXdvcmRcIiB8IFwiZ3JhcGhcIjtcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IE1uZW1vU2V0dGluZ3MgPSB7XG4gIGFwaVVybDogXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIixcbiAgc2VhcmNoTGltaXQ6IDEwLFxuICBzZWFyY2hNb2RlOiBcImh5YnJpZFwiLFxufTtcblxuLy8gXHVDMTI0XHVDODE1IFx1RDBFRCAvIFNldHRpbmdzIHRhYlxuZXhwb3J0IGNsYXNzIE1uZW1vU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IE1uZW1vUGx1Z2luO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE1uZW1vUGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiTW5lbW8gU2Vjb25kQnJhaW4gU2V0dGluZ3NcIiB9KTtcblxuICAgIC8vIEFQSSBVUkwgXHVDMTI0XHVDODE1XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIk1uZW1vIEFQSSBVUkxcIilcbiAgICAgIC5zZXREZXNjKFwiTW5lbW8gRmFzdEFQSSBcdUMxMUNcdUJDODQgXHVDOEZDXHVDMThDIC8gTW5lbW8gc2VydmVyIGFkZHJlc3NcIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiaHR0cDovLzEyNy4wLjAuMTo4MDAwXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaVVybClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlVcmwgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmFwaUNsaWVudC5zZXRCYXNlVXJsKHZhbHVlKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1QUNCMFx1QUNGQyBcdUMyMThcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiU2VhcmNoIHJlc3VsdCBsaW1pdFwiKVxuICAgICAgLnNldERlc2MoXCJcdUFDODBcdUMwQzkgXHVBQ0IwXHVBQ0ZDIFx1Q0Q1Q1x1QjMwMCBcdUFDMUNcdUMyMTggLyBNYXhpbXVtIG51bWJlciBvZiByZXN1bHRzXCIpXG4gICAgICAuYWRkU2xpZGVyKChzbGlkZXIpID0+XG4gICAgICAgIHNsaWRlclxuICAgICAgICAgIC5zZXRMaW1pdHMoNSwgNTAsIDUpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNlYXJjaExpbWl0KVxuICAgICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTGltaXQgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1QkFBOFx1QjREQ1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJTZWFyY2ggbW9kZVwiKVxuICAgICAgLnNldERlc2MoXCJcdUFDODBcdUMwQzkgXHVCQzI5XHVDMkREIFx1QzEyMFx1RDBERCAvIFNlbGVjdCBzZWFyY2ggbWV0aG9kXCIpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxuICAgICAgICBkcm9wZG93blxuICAgICAgICAgIC5hZGRPcHRpb25zKHtcbiAgICAgICAgICAgIGh5YnJpZDogXCJIeWJyaWQgKGtleXdvcmQgKyB2ZWN0b3IpXCIsXG4gICAgICAgICAgICB2ZWN0b3I6IFwiVmVjdG9yIChzZW1hbnRpYylcIixcbiAgICAgICAgICAgIGtleXdvcmQ6IFwiS2V5d29yZCAoQk0yNSlcIixcbiAgICAgICAgICAgIGdyYXBoOiBcIkdyYXBoIChyZWxhdGlvbnNoaXApXCIsXG4gICAgICAgICAgfSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTW9kZSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zZWFyY2hNb2RlID0gdmFsdWUgYXMgTW5lbW9TZXR0aW5nc1tcInNlYXJjaE1vZGVcIl07XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgU3VnZ2VzdE1vZGFsLCBOb3RpY2UsIFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSB7IE1uZW1vQXBpQ2xpZW50LCBNbmVtb1NlYXJjaFJlc3VsdCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcbmltcG9ydCB0eXBlIHsgTW5lbW9TZXR0aW5ncyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5cbi8vIE1uZW1vIFx1QUM4MFx1QzBDOSBcdUJBQThcdUIyRUMgLyBTZWFyY2ggbW9kYWwgKEN0cmwrU2hpZnQrTSlcbmV4cG9ydCBjbGFzcyBNbmVtb1NlYXJjaE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPE1uZW1vU2VhcmNoUmVzdWx0PiB7XG4gIHByaXZhdGUgcmVzdWx0czogTW5lbW9TZWFyY2hSZXN1bHRbXSA9IFtdO1xuICBwcml2YXRlIGRlYm91bmNlVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50LFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IE1uZW1vU2V0dGluZ3NcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiTW5lbW8gXHVBQzgwXHVDMEM5Li4uIC8gU2VhcmNoIE1uZW1vLi4uXCIpO1xuICB9XG5cbiAgYXN5bmMgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFByb21pc2U8TW5lbW9TZWFyY2hSZXN1bHRbXT4ge1xuICAgIGlmICghcXVlcnkgfHwgcXVlcnkubGVuZ3RoIDwgMikgcmV0dXJuIFtdO1xuXG4gICAgLy8gXHVCNTE0XHVCQzE0XHVDNkI0XHVDMkE0IDMwMG1zIC8gRGVib3VuY2UgaW5wdXRcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIpIGNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IGF3YWl0IHRoaXMuYXBpQ2xpZW50LnNlYXJjaChcbiAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLnNlYXJjaE1vZGUsXG4gICAgICAgICAgdGhpcy5zZXR0aW5ncy5zZWFyY2hMaW1pdFxuICAgICAgICApO1xuICAgICAgICByZXNvbHZlKHRoaXMucmVzdWx0cyk7XG4gICAgICB9LCAzMDApO1xuICAgIH0pO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihyZXN1bHQ6IE1uZW1vU2VhcmNoUmVzdWx0LCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb25zdCBjb250YWluZXIgPSBlbC5jcmVhdGVEaXYoeyBjbHM6IFwibW5lbW8tc2VhcmNoLXJlc3VsdFwiIH0pO1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7XG4gICAgICB0ZXh0OiByZXN1bHQudGl0bGUsXG4gICAgICBjbHM6IFwibW5lbW8tcmVzdWx0LXRpdGxlXCIsXG4gICAgfSk7XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwic21hbGxcIiwge1xuICAgICAgdGV4dDogcmVzdWx0LnNuaXBwZXQsXG4gICAgICBjbHM6IFwibW5lbW8tcmVzdWx0LXNuaXBwZXRcIixcbiAgICB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJzcGFuXCIsIHtcbiAgICAgIHRleHQ6IGBzY29yZTogJHtyZXN1bHQuc2NvcmUudG9GaXhlZCgzKX1gLFxuICAgICAgY2xzOiBcIm1uZW1vLXJlc3VsdC1zY29yZVwiLFxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgb25DaG9vc2VTdWdnZXN0aW9uKHJlc3VsdDogTW5lbW9TZWFyY2hSZXN1bHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBcdUJDRkNcdUQyQjhcdUM1RDBcdUMxMUMgXHVENTc0XHVCMkY5IFx1QjE3OFx1RDJCOCBcdUM1RjRcdUFFMzAgLyBPcGVuIG1hdGNoaW5nIG5vdGUgaW4gdmF1bHRcbiAgICBsZXQgcGF0aCA9IHJlc3VsdC5wYXRoIHx8IGAke3Jlc3VsdC50aXRsZX0ubWRgO1xuICAgIGlmICghcGF0aC5lbmRzV2l0aChcIi5tZFwiKSkgcGF0aCArPSBcIi5tZFwiO1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG5cbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZigpLm9wZW5GaWxlKGZpbGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXcgTm90aWNlKGBcdUIxNzhcdUQyQjhcdUI5N0MgXHVDQzNFXHVDNzQ0IFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQ6ICR7cmVzdWx0LnRpdGxlfVxcbk5vdGUgbm90IGZvdW5kIGluIHZhdWx0LmApO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSB7IE1uZW1vQXBpQ2xpZW50LCBTdWJncmFwaE5vZGUsIFN1YmdyYXBoRWRnZSB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcblxuZXhwb3J0IGNvbnN0IE1ORU1PX0dSQVBIX1ZJRVdfVFlQRSA9IFwibW5lbW8tZ3JhcGgtdmlld1wiO1xuXG4vLyBcdUMwQzlcdUMwQzEgXHVCOUY1IChlbnRpdHlfdHlwZVx1QkNDNClcbmNvbnN0IFRZUEVfQ09MT1JTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBldmVudDogXCIjNEE5MEQ5XCIsXG4gIHByb2plY3Q6IFwiI0U4OTEzQVwiLFxuICBub3RlOiBcIiM1MEM4NzhcIixcbiAgc291cmNlOiBcIiM5QjU5QjZcIixcbiAgZGVjaXNpb246IFwiI0U3NEMzQ1wiLFxuICBpbnNpZ2h0OiBcIiNGMUM0MEZcIixcbn07XG5jb25zdCBERUZBVUxUX0NPTE9SID0gXCIjODg4ODg4XCI7XG5cbmludGVyZmFjZSBHcmFwaE5vZGUge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbiAgc2NvcmU/OiBudW1iZXI7XG4gIHg6IG51bWJlcjtcbiAgeTogbnVtYmVyO1xuICB2eDogbnVtYmVyO1xuICB2eTogbnVtYmVyO1xuICByYWRpdXM6IG51bWJlcjtcbiAgaXNDZW50ZXI6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBHcmFwaEVkZ2Uge1xuICBzb3VyY2U6IHN0cmluZztcbiAgdGFyZ2V0OiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1uZW1vR3JhcGhWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG5vZGVzOiBHcmFwaE5vZGVbXSA9IFtdO1xuICBwcml2YXRlIGVkZ2VzOiBHcmFwaEVkZ2VbXSA9IFtdO1xuICBwcml2YXRlIG5vZGVNYXA6IE1hcDxzdHJpbmcsIEdyYXBoTm9kZT4gPSBuZXcgTWFwKCk7XG5cbiAgLy8gXHVDRTc0XHVCQTU0XHVCNzdDXG4gIHByaXZhdGUgb2Zmc2V0WCA9IDA7XG4gIHByaXZhdGUgb2Zmc2V0WSA9IDA7XG4gIHByaXZhdGUgc2NhbGUgPSAxO1xuXG4gIC8vIFx1Qzc3OFx1RDEzMFx1Qjc5OVx1QzE1OFxuICBwcml2YXRlIGRyYWdOb2RlOiBHcmFwaE5vZGUgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBpc1Bhbm5pbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBsYXN0TW91c2UgPSB7IHg6IDAsIHk6IDAgfTtcbiAgcHJpdmF0ZSBob3ZlcmVkTm9kZTogR3JhcGhOb2RlIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgYW5pbUZyYW1lID0gMDtcbiAgcHJpdmF0ZSBzaW1SdW5uaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgc2ltSXRlcmF0aW9ucyA9IDA7XG5cbiAgcHJpdmF0ZSBjZW50ZXJQYXRoID0gXCJcIjtcbiAgcHJpdmF0ZSB2aWV3TW9kZTogXCJsb2NhbFwiIHwgXCJmdWxsXCIgfCBcImNsdXN0ZXJcIiA9IFwibG9jYWxcIjtcbiAgcHJpdmF0ZSBjbHVzdGVyRGF0YTogYW55W10gPSBbXTtcbiAgcHJpdmF0ZSBiYWNrQnRuOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGFsbEJ0bnM6IEhUTUxFbGVtZW50W10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBsZWFmOiBXb3Jrc3BhY2VMZWFmLFxuICAgIHByaXZhdGUgYXBpQ2xpZW50OiBNbmVtb0FwaUNsaWVudFxuICApIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7IHJldHVybiBNTkVNT19HUkFQSF9WSUVXX1RZUEU7IH1cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuIFwiTW5lbW8gR3JhcGhcIjsgfVxuICBnZXRJY29uKCk6IHN0cmluZyB7IHJldHVybiBcImdpdC1mb3JrXCI7IH1cblxuICBhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXSBhcyBIVE1MRWxlbWVudDtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICBjb250YWluZXIuYWRkQ2xhc3MoXCJtbmVtby1ncmFwaC1jb250YWluZXJcIik7XG5cbiAgICAvLyBcdUQyMzRcdUJDMTRcbiAgICBjb25zdCB0b29sYmFyID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJtbmVtby1ncmFwaC10b29sYmFyXCIgfSk7XG4gICAgdG9vbGJhci5jcmVhdGVFbChcInNwYW5cIiwgeyB0ZXh0OiBcIk1uZW1vIEdyYXBoXCIsIGNsczogXCJtbmVtby1ncmFwaC10aXRsZVwiIH0pO1xuXG4gICAgY29uc3QgbG9jYWxCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdUQ4M0RcdURDQ0QgTG9jYWxcIiwgY2xzOiBcIm1uZW1vLWdyYXBoLWJ0biBtbmVtby1ncmFwaC1idG4tYWN0aXZlXCIsIGF0dHI6IHsgdGl0bGU6IFwiQ3VycmVudCBub3RlIGdyYXBoXCIgfSB9KTtcbiAgICBsb2NhbEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4geyB0aGlzLnNldEFjdGl2ZUJ0bihsb2NhbEJ0bik7IHRoaXMudmlld01vZGUgPSBcImxvY2FsXCI7IHRoaXMubG9hZEdyYXBoKCk7IH0pO1xuXG4gICAgY29uc3QgY2x1c3RlckJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1RDgzRFx1REQyRSBFeHBsb3JlXCIsIGNsczogXCJtbmVtby1ncmFwaC1idG5cIiwgYXR0cjogeyB0aXRsZTogXCJFeHBsb3JlIGJ5IGNsdXN0ZXJzIChkcmlsbC1kb3duKVwiIH0gfSk7XG4gICAgY2x1c3RlckJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4geyB0aGlzLnNldEFjdGl2ZUJ0bihjbHVzdGVyQnRuKTsgdGhpcy52aWV3TW9kZSA9IFwiY2x1c3RlclwiOyB0aGlzLmxvYWRDbHVzdGVycygpOyB9KTtcblxuICAgIGNvbnN0IGZ1bGxCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdUQ4M0NcdURGMTAgRnVsbFwiLCBjbHM6IFwibW5lbW8tZ3JhcGgtYnRuXCIsIGF0dHI6IHsgdGl0bGU6IFwiRnVsbCBrbm93bGVkZ2UgZ3JhcGhcIiB9IH0pO1xuICAgIGZ1bGxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHsgdGhpcy5zZXRBY3RpdmVCdG4oZnVsbEJ0bik7IHRoaXMudmlld01vZGUgPSBcImZ1bGxcIjsgdGhpcy5sb2FkRnVsbEdyYXBoKCk7IH0pO1xuXG4gICAgdGhpcy5iYWNrQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyMTkwIEJhY2tcIiwgY2xzOiBcIm1uZW1vLWdyYXBoLWJ0blwiLCBhdHRyOiB7IHRpdGxlOiBcIkJhY2sgdG8gY2x1c3RlcnNcIiB9IH0pO1xuICAgIHRoaXMuYmFja0J0bi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgdGhpcy5iYWNrQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7IHRoaXMuYmFja0J0biEuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiOyB0aGlzLmxvYWRDbHVzdGVycygpOyB9KTtcblxuICAgIHRoaXMuYWxsQnRucyA9IFtsb2NhbEJ0biwgY2x1c3RlckJ0biwgZnVsbEJ0bl07XG5cbiAgICBjb25zdCByZWZyZXNoQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyMUJCXCIsIGNsczogXCJtbmVtby1ncmFwaC1idG5cIiwgYXR0cjogeyB0aXRsZTogXCJSZWZyZXNoXCIgfSB9KTtcbiAgICByZWZyZXNoQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB0aGlzLnZpZXdNb2RlID09PSBcImZ1bGxcIiA/IHRoaXMubG9hZEZ1bGxHcmFwaCgpIDogdGhpcy5sb2FkR3JhcGgoKSk7XG5cbiAgICBjb25zdCBmaXRCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTIyQTFcIiwgY2xzOiBcIm1uZW1vLWdyYXBoLWJ0blwiLCBhdHRyOiB7IHRpdGxlOiBcIkZpdCB0byB2aWV3XCIgfSB9KTtcbiAgICBmaXRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMuZml0VG9WaWV3KCkpO1xuXG4gICAgLy8gXHVDRTk0XHVCQzg0XHVDMkE0XG4gICAgdGhpcy5jYW52YXMgPSBjb250YWluZXIuY3JlYXRlRWwoXCJjYW52YXNcIiwgeyBjbHM6IFwibW5lbW8tZ3JhcGgtY2FudmFzXCIgfSk7XG4gICAgdGhpcy5jdHggPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XG5cbiAgICB0aGlzLnJlc2l6ZUNhbnZhcygpO1xuICAgIHRoaXMucmVnaXN0ZXJEb21FdmVudCh3aW5kb3csIFwicmVzaXplXCIsICgpID0+IHRoaXMucmVzaXplQ2FudmFzKCkpO1xuICAgIHRoaXMuc2V0dXBJbnRlcmFjdGlvbigpO1xuICAgIHRoaXMubG9hZEdyYXBoKCk7XG4gIH1cblxuICBhc3luYyBvbkNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2ltUnVubmluZyA9IGZhbHNlO1xuICAgIGlmICh0aGlzLmFuaW1GcmFtZSkgY2FuY2VsQW5pbWF0aW9uRnJhbWUodGhpcy5hbmltRnJhbWUpO1xuICB9XG5cbiAgLy8gXHVENjA0XHVDN0FDIFx1QjE3OFx1RDJCOCBcdUFFMzBcdUM5MDAgXHVCODVDXHVCNERDXG4gIGFzeW5jIGxvYWRHcmFwaChwYXRoPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFwYXRoKSB7XG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgIHBhdGggPSBmaWxlID8gZmlsZS5wYXRoIDogXCJcIjtcbiAgICB9XG4gICAgaWYgKCFwYXRoKSB7XG4gICAgICB0aGlzLmRyYXdFbXB0eShcIk9wZW4gYSBub3RlLCB0aGVuIHJlZnJlc2hcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIEFQSVx1QjI5NCAubWQgXHVDNUM2XHVCMjk0IFx1QUNCRFx1Qjg1Q1x1Qjk3QyBcdUMwQUNcdUM2QTlcdUQ1NjAgXHVDMjE4IFx1Qzc4OFx1Qzc0Q1xuICAgIHRoaXMuY2VudGVyUGF0aCA9IHBhdGg7XG4gICAgY29uc3QgYXBpUGF0aCA9IHBhdGgucmVwbGFjZSgvXFwubWQkLywgXCJcIik7XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuc3ViZ3JhcGgoYXBpUGF0aCwgMSk7XG4gICAgaWYgKCFkYXRhIHx8IGRhdGEubm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLmRyYXdFbXB0eShcIk5vIGdyYXBoIGRhdGEgZm9yIHRoaXMgbm90ZVwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBcdUIxNzhcdUI0REMgXHVDMjE4IFx1QzgxQ1x1RDU1QyAoXHVDMTMxXHVCMkE1IFx1MjAxNCBcdUNENUNcdUIzMDAgODBcdUIxNzhcdUI0REMpXG4gICAgbGV0IG5vZGVzID0gZGF0YS5ub2RlcztcbiAgICBsZXQgZWRnZXMgPSBkYXRhLmVkZ2VzO1xuICAgIGlmIChub2Rlcy5sZW5ndGggPiA4MCkge1xuICAgICAgY29uc3QgY2VudGVyTm9kZSA9IG5vZGVzLmZpbmQobiA9PiBuLmlkID09PSBwYXRoIHx8IG4uaWQgPT09IHBhdGgucmVwbGFjZSgvXFwubWQkLywgXCJcIikpO1xuICAgICAgY29uc3Qga2VlcCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgaWYgKGNlbnRlck5vZGUpIGtlZXAuYWRkKGNlbnRlck5vZGUuaWQpO1xuICAgICAgLy8gc2NvcmUgXHVCMTkyXHVDNzQwIFx1QzIxQ1x1QzczQ1x1Qjg1QyA4MFx1QUMxQ1xuICAgICAgY29uc3Qgc29ydGVkID0gWy4uLm5vZGVzXS5zb3J0KChhLCBiKSA9PiAoYi5zY29yZSA/PyAwKSAtIChhLnNjb3JlID8/IDApKTtcbiAgICAgIGZvciAoY29uc3QgbiBvZiBzb3J0ZWQpIHtcbiAgICAgICAgaWYgKGtlZXAuc2l6ZSA+PSA4MCkgYnJlYWs7XG4gICAgICAgIGtlZXAuYWRkKG4uaWQpO1xuICAgICAgfVxuICAgICAgbm9kZXMgPSBub2Rlcy5maWx0ZXIobiA9PiBrZWVwLmhhcyhuLmlkKSk7XG4gICAgICBlZGdlcyA9IGVkZ2VzLmZpbHRlcihlID0+IGtlZXAuaGFzKGUuc291cmNlKSAmJiBrZWVwLmhhcyhlLnRhcmdldCkpO1xuICAgIH1cblxuICAgIHRoaXMuYnVpbGRHcmFwaChub2RlcywgZWRnZXMsIGFwaVBhdGgpO1xuICAgIHRoaXMucnVuU2ltdWxhdGlvbigpO1xuICB9XG5cbiAgc2V0Q2VudGVyUGF0aChwYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmxvYWRHcmFwaChwYXRoKTtcbiAgfVxuXG4gIHByaXZhdGUgc2V0QWN0aXZlQnRuKGFjdGl2ZTogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGJ0biBvZiB0aGlzLmFsbEJ0bnMpIGJ0bi5yZW1vdmVDbGFzcyhcIm1uZW1vLWdyYXBoLWJ0bi1hY3RpdmVcIik7XG4gICAgYWN0aXZlLmFkZENsYXNzKFwibW5lbW8tZ3JhcGgtYnRuLWFjdGl2ZVwiKTtcbiAgICBpZiAodGhpcy5iYWNrQnRuKSB0aGlzLmJhY2tCdG4uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICB9XG5cbiAgYXN5bmMgbG9hZENsdXN0ZXJzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuZHJhd0VtcHR5KFwiTG9hZGluZyBjbHVzdGVycy4uLlwiKTtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuY2x1c3RlcnMoKTtcbiAgICBpZiAoIWRhdGEgfHwgIWRhdGEuY2x1c3RlcnMgfHwgZGF0YS5jbHVzdGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuZHJhd0VtcHR5KFwiTm8gY2x1c3RlciBkYXRhXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuY2x1c3RlckRhdGEgPSBkYXRhLmNsdXN0ZXJzO1xuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGg7XG4gICAgY29uc3QgaCA9IHRoaXMuY2FudmFzIS5oZWlnaHQ7XG5cbiAgICB0aGlzLm5vZGVzID0gZGF0YS5jbHVzdGVycy5tYXAoKGM6IGFueSkgPT4gKHtcbiAgICAgIGlkOiBjLmlkLFxuICAgICAgbmFtZTogYCR7Yy5odWJfbmFtZX0gKCR7Yy5zaXplfSlgLFxuICAgICAgdHlwZTogYy5kb21pbmFudF90eXBlLFxuICAgICAgc2NvcmU6IGMuc2l6ZSxcbiAgICAgIHg6IChjLnggLyAxMDAwKSAqIHcgKiAwLjkgKyB3ICogMC4wNSxcbiAgICAgIHk6IChjLnkgLyAxMDAwKSAqIGggKiAwLjkgKyBoICogMC4wNSxcbiAgICAgIHZ4OiAwLFxuICAgICAgdnk6IDAsXG4gICAgICByYWRpdXM6IE1hdGgubWF4KDgsIE1hdGgubWluKDQwLCA4ICsgTWF0aC5zcXJ0KGMuc2l6ZSkgKiAyKSksXG4gICAgICBpc0NlbnRlcjogZmFsc2UsXG4gICAgICBfY2x1c3RlckluZGV4OiBjLmluZGV4LFxuICAgIH0pKTtcblxuICAgIHRoaXMuZWRnZXMgPSAoZGF0YS5lZGdlcyB8fCBbXSkubWFwKChlOiBhbnkpID0+ICh7XG4gICAgICBzb3VyY2U6IGUuc291cmNlLFxuICAgICAgdGFyZ2V0OiBlLnRhcmdldCxcbiAgICAgIHR5cGU6IFwiY2x1c3Rlcl9saW5rXCIsXG4gICAgfSkpO1xuXG4gICAgdGhpcy5ub2RlTWFwID0gbmV3IE1hcCh0aGlzLm5vZGVzLm1hcCgobikgPT4gW24uaWQsIG5dKSk7XG4gICAgdGhpcy5vZmZzZXRYID0gMDtcbiAgICB0aGlzLm9mZnNldFkgPSAwO1xuICAgIHRoaXMuc2NhbGUgPSAxO1xuICAgIHRoaXMuc2ltUnVubmluZyA9IGZhbHNlO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG5cbiAgYXN5bmMgZHJpbGxJbnRvQ2x1c3RlcihjbHVzdGVySW5kZXg6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuZHJhd0VtcHR5KFwiTG9hZGluZyBjbHVzdGVyIGRldGFpbC4uLlwiKTtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuY2x1c3RlckRldGFpbChjbHVzdGVySW5kZXgpO1xuICAgIGlmICghZGF0YSB8fCBkYXRhLm5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJFbXB0eSBjbHVzdGVyXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGg7XG4gICAgY29uc3QgaCA9IHRoaXMuY2FudmFzIS5oZWlnaHQ7XG5cbiAgICB0aGlzLm5vZGVzID0gZGF0YS5ub2Rlcy5tYXAoKG46IGFueSkgPT4gKHtcbiAgICAgIGlkOiBuLmlkLFxuICAgICAgbmFtZTogbi5uYW1lLFxuICAgICAgdHlwZTogbi50eXBlLFxuICAgICAgc2NvcmU6IG4uZGVncmVlLFxuICAgICAgeDogKG4ueCAvIDEwMDApICogdyAqIDAuOSArIHcgKiAwLjA1LFxuICAgICAgeTogKG4ueSAvIDEwMDApICogaCAqIDAuOSArIGggKiAwLjA1LFxuICAgICAgdng6IDAsXG4gICAgICB2eTogMCxcbiAgICAgIHJhZGl1czogTWF0aC5tYXgoNCwgTWF0aC5taW4oMTYsIDQgKyAobi5kZWdyZWUgfHwgMCkgKiAwLjEpKSxcbiAgICAgIGlzQ2VudGVyOiBmYWxzZSxcbiAgICB9KSk7XG5cbiAgICB0aGlzLmVkZ2VzID0gZGF0YS5lZGdlcztcbiAgICB0aGlzLm5vZGVNYXAgPSBuZXcgTWFwKHRoaXMubm9kZXMubWFwKChuKSA9PiBbbi5pZCwgbl0pKTtcbiAgICB0aGlzLm9mZnNldFggPSAwO1xuICAgIHRoaXMub2Zmc2V0WSA9IDA7XG4gICAgdGhpcy5zY2FsZSA9IDE7XG4gICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuYmFja0J0bikgdGhpcy5iYWNrQnRuLnN0eWxlLmRpc3BsYXkgPSBcImlubGluZS1ibG9ja1wiO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG5cbiAgYXN5bmMgbG9hZEZ1bGxHcmFwaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmRyYXdFbXB0eShcIkxvYWRpbmcgZnVsbCBncmFwaC4uLlwiKTtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuZnVsbEdyYXBoKCk7XG4gICAgaWYgKCFkYXRhIHx8IGRhdGEubm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLmRyYXdFbXB0eShcIk5vIGdyYXBoIGRhdGFcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gXHVDMEFDXHVDODA0IFx1QUNDNFx1QzBCMFx1QjQxQyBcdUM4OENcdUQ0NUMgXHVDMEFDXHVDNkE5IFx1MjAxNCBcdUMyRENcdUJCQUNcdUI4MDhcdUM3NzRcdUMxNTggXHVCRDg4XHVENTQ0XHVDNjk0XG4gICAgY29uc3QgdyA9IHRoaXMuY2FudmFzIS53aWR0aDtcbiAgICBjb25zdCBoID0gdGhpcy5jYW52YXMhLmhlaWdodDtcblxuICAgIHRoaXMubm9kZXMgPSBkYXRhLm5vZGVzLm1hcCgobjogYW55KSA9PiAoe1xuICAgICAgaWQ6IG4uaWQsXG4gICAgICBuYW1lOiBuLm5hbWUsXG4gICAgICB0eXBlOiBuLnR5cGUsXG4gICAgICBzY29yZTogbi5kZWdyZWUsXG4gICAgICB4OiAobi54IC8gMTAwMCkgKiB3ICogMC45ICsgdyAqIDAuMDUsXG4gICAgICB5OiAobi55IC8gMTAwMCkgKiBoICogMC45ICsgaCAqIDAuMDUsXG4gICAgICB2eDogMCxcbiAgICAgIHZ5OiAwLFxuICAgICAgcmFkaXVzOiBNYXRoLm1heCgzLCBNYXRoLm1pbigxNiwgMyArIChuLmRlZ3JlZSB8fCAwKSAqIDAuMDUpKSxcbiAgICAgIGlzQ2VudGVyOiBmYWxzZSxcbiAgICB9KSk7XG5cbiAgICB0aGlzLmVkZ2VzID0gZGF0YS5lZGdlcztcbiAgICB0aGlzLm5vZGVNYXAgPSBuZXcgTWFwKHRoaXMubm9kZXMubWFwKChuKSA9PiBbbi5pZCwgbl0pKTtcbiAgICB0aGlzLm9mZnNldFggPSAwO1xuICAgIHRoaXMub2Zmc2V0WSA9IDA7XG4gICAgdGhpcy5zY2FsZSA9IDE7XG4gICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XG4gICAgdGhpcy5kcmF3KCk7XG4gIH1cblxuICAvLyA9PT09PSBcdUFERjhcdUI3OThcdUQ1MDQgXHVCRTRDXHVCNERDID09PT09XG4gIHByaXZhdGUgYnVpbGRHcmFwaChub2RlczogU3ViZ3JhcGhOb2RlW10sIGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSwgY2VudGVyUGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgdyA9IHRoaXMuY2FudmFzIS53aWR0aDtcbiAgICBjb25zdCBoID0gdGhpcy5jYW52YXMhLmhlaWdodDtcbiAgICBjb25zdCBjeCA9IHcgLyAyLCBjeSA9IGggLyAyO1xuXG4gICAgdGhpcy5ub2RlcyA9IG5vZGVzLm1hcCgobikgPT4gKHtcbiAgICAgIGlkOiBuLmlkLFxuICAgICAgbmFtZTogbi5uYW1lLFxuICAgICAgdHlwZTogbi50eXBlLFxuICAgICAgc2NvcmU6IG4uc2NvcmUsXG4gICAgICB4OiBuLmlkID09PSBjZW50ZXJQYXRoID8gY3ggOiBjeCArIChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDMwMCxcbiAgICAgIHk6IG4uaWQgPT09IGNlbnRlclBhdGggPyBjeSA6IGN5ICsgKE1hdGgucmFuZG9tKCkgLSAwLjUpICogMzAwLFxuICAgICAgdng6IDAsXG4gICAgICB2eTogMCxcbiAgICAgIHJhZGl1czogbi5pZCA9PT0gY2VudGVyUGF0aCA/IDE4IDogMTIsXG4gICAgICBpc0NlbnRlcjogbi5pZCA9PT0gY2VudGVyUGF0aCxcbiAgICB9KSk7XG5cbiAgICB0aGlzLmVkZ2VzID0gZWRnZXM7XG4gICAgdGhpcy5ub2RlTWFwID0gbmV3IE1hcCh0aGlzLm5vZGVzLm1hcCgobikgPT4gW24uaWQsIG5dKSk7XG4gICAgdGhpcy5vZmZzZXRYID0gMDtcbiAgICB0aGlzLm9mZnNldFkgPSAwO1xuICAgIHRoaXMuc2NhbGUgPSAxO1xuICB9XG5cbiAgLy8gPT09PT0gRm9yY2UtZGlyZWN0ZWQgXHVDMkRDXHVCQkFDXHVCODA4XHVDNzc0XHVDMTU4ID09PT09XG4gIHByaXZhdGUgcnVuU2ltdWxhdGlvbigpOiB2b2lkIHtcbiAgICB0aGlzLnNpbVJ1bm5pbmcgPSB0cnVlO1xuICAgIHRoaXMuc2ltSXRlcmF0aW9ucyA9IDA7XG4gICAgY29uc3QgdGljayA9ICgpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSByZXR1cm47XG4gICAgICB0aGlzLnNpbUl0ZXJhdGlvbnMrKztcbiAgICAgIHRoaXMuc2ltdWxhdGVTdGVwKCk7XG4gICAgICB0aGlzLmRyYXcoKTtcbiAgICAgIGlmICh0aGlzLnNpbUl0ZXJhdGlvbnMgPCAyMDApIHtcbiAgICAgICAgdGhpcy5hbmltRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNpbVJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5kcmF3KCk7XG4gICAgICB9XG4gICAgfTtcbiAgICB0aGlzLmFuaW1GcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgfVxuXG4gIHByaXZhdGUgc2ltdWxhdGVTdGVwKCk6IHZvaWQge1xuICAgIGNvbnN0IGFscGhhID0gTWF0aC5tYXgoMC4wMSwgMSAtIHRoaXMuc2ltSXRlcmF0aW9ucyAvIDIwMCk7XG4gICAgY29uc3Qgbm9kZXMgPSB0aGlzLm5vZGVzO1xuICAgIGNvbnN0IHJlcHVsc2lvbiA9IDMwMDA7XG4gICAgY29uc3Qgc3ByaW5nTGVuID0gMTIwO1xuICAgIGNvbnN0IHNwcmluZ0sgPSAwLjAyO1xuICAgIGNvbnN0IGNlbnRlckdyYXZpdHkgPSAwLjAxO1xuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGggLyAyO1xuICAgIGNvbnN0IGggPSB0aGlzLmNhbnZhcyEuaGVpZ2h0IC8gMjtcblxuICAgIC8vIFJlcHVsc2lvbiAoYWxsIHBhaXJzKVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IG5vZGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGNvbnN0IGEgPSBub2Rlc1tpXSwgYiA9IG5vZGVzW2pdO1xuICAgICAgICBsZXQgZHggPSBiLnggLSBhLngsIGR5ID0gYi55IC0gYS55O1xuICAgICAgICBsZXQgZGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSkgfHwgMTtcbiAgICAgICAgY29uc3QgZm9yY2UgPSByZXB1bHNpb24gLyAoZGlzdCAqIGRpc3QpO1xuICAgICAgICBjb25zdCBmeCA9IChkeCAvIGRpc3QpICogZm9yY2UgKiBhbHBoYTtcbiAgICAgICAgY29uc3QgZnkgPSAoZHkgLyBkaXN0KSAqIGZvcmNlICogYWxwaGE7XG4gICAgICAgIGEudnggLT0gZng7IGEudnkgLT0gZnk7XG4gICAgICAgIGIudnggKz0gZng7IGIudnkgKz0gZnk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gU3ByaW5nIChlZGdlcylcbiAgICBmb3IgKGNvbnN0IGUgb2YgdGhpcy5lZGdlcykge1xuICAgICAgY29uc3QgYSA9IHRoaXMubm9kZU1hcC5nZXQoZS5zb3VyY2UpO1xuICAgICAgY29uc3QgYiA9IHRoaXMubm9kZU1hcC5nZXQoZS50YXJnZXQpO1xuICAgICAgaWYgKCFhIHx8ICFiKSBjb250aW51ZTtcbiAgICAgIGxldCBkeCA9IGIueCAtIGEueCwgZHkgPSBiLnkgLSBhLnk7XG4gICAgICBsZXQgZGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSkgfHwgMTtcbiAgICAgIGNvbnN0IGZvcmNlID0gKGRpc3QgLSBzcHJpbmdMZW4pICogc3ByaW5nSyAqIGFscGhhO1xuICAgICAgY29uc3QgZnggPSAoZHggLyBkaXN0KSAqIGZvcmNlO1xuICAgICAgY29uc3QgZnkgPSAoZHkgLyBkaXN0KSAqIGZvcmNlO1xuICAgICAgYS52eCArPSBmeDsgYS52eSArPSBmeTtcbiAgICAgIGIudnggLT0gZng7IGIudnkgLT0gZnk7XG4gICAgfVxuXG4gICAgLy8gQ2VudGVyIGdyYXZpdHlcbiAgICBmb3IgKGNvbnN0IG4gb2Ygbm9kZXMpIHtcbiAgICAgIG4udnggKz0gKHcgLSBuLngpICogY2VudGVyR3Jhdml0eSAqIGFscGhhO1xuICAgICAgbi52eSArPSAoaCAtIG4ueSkgKiBjZW50ZXJHcmF2aXR5ICogYWxwaGE7XG4gICAgICAvLyBEYW1waW5nXG4gICAgICBuLnZ4ICo9IDAuODU7XG4gICAgICBuLnZ5ICo9IDAuODU7XG4gICAgICBpZiAoIW4uaXNDZW50ZXIgfHwgdGhpcy5zaW1JdGVyYXRpb25zID4gNSkge1xuICAgICAgICBuLnggKz0gbi52eDtcbiAgICAgICAgbi55ICs9IG4udnk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gPT09PT0gXHVCODBDXHVCMzU0XHVCOUMxID09PT09XG4gIHByaXZhdGUgZHJhdygpOiB2b2lkIHtcbiAgICBjb25zdCBjdHggPSB0aGlzLmN0eCE7XG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5jYW52YXMhO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICBjdHguc2F2ZSgpO1xuICAgIGN0eC50cmFuc2xhdGUodGhpcy5vZmZzZXRYLCB0aGlzLm9mZnNldFkpO1xuICAgIGN0eC5zY2FsZSh0aGlzLnNjYWxlLCB0aGlzLnNjYWxlKTtcblxuICAgIC8vIFx1QzVFM1x1QzlDMFxuICAgIGZvciAoY29uc3QgZSBvZiB0aGlzLmVkZ2VzKSB7XG4gICAgICBjb25zdCBhID0gdGhpcy5ub2RlTWFwLmdldChlLnNvdXJjZSk7XG4gICAgICBjb25zdCBiID0gdGhpcy5ub2RlTWFwLmdldChlLnRhcmdldCk7XG4gICAgICBpZiAoIWEgfHwgIWIpIGNvbnRpbnVlO1xuXG4gICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICBjdHgubW92ZVRvKGEueCwgYS55KTtcbiAgICAgIGN0eC5saW5lVG8oYi54LCBiLnkpO1xuICAgICAgY3R4LnN0cm9rZVN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDI1NSwyNTUsMjU1LDAuMilcIiA6IFwicmdiYSgwLDAsMCwwLjE1KVwiO1xuICAgICAgY3R4LmxpbmVXaWR0aCA9IDEuNTtcblxuICAgICAgaWYgKGUudHlwZSA9PT0gXCJyZWxhdGVkXCIpIHtcbiAgICAgICAgY3R4LnNldExpbmVEYXNoKFs2LCA0XSk7XG4gICAgICB9IGVsc2UgaWYgKGUudHlwZSA9PT0gXCJ0YWdfc2hhcmVkXCIpIHtcbiAgICAgICAgY3R4LnNldExpbmVEYXNoKFszLCA1XSk7XG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjEpXCIgOiBcInJnYmEoMCwwLDAsMC4wOClcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGN0eC5zZXRMaW5lRGFzaChbXSk7XG4gICAgICB9XG4gICAgICBjdHguc3Ryb2tlKCk7XG4gICAgICBjdHguc2V0TGluZURhc2goW10pO1xuICAgIH1cblxuICAgIC8vIFx1QjE3OFx1QjREQ1xuICAgIGZvciAoY29uc3QgbiBvZiB0aGlzLm5vZGVzKSB7XG4gICAgICBjb25zdCBjb2xvciA9IFRZUEVfQ09MT1JTW24udHlwZV0gfHwgREVGQVVMVF9DT0xPUjtcbiAgICAgIGNvbnN0IGlzSG92ZXJlZCA9IHRoaXMuaG92ZXJlZE5vZGUgPT09IG47XG5cbiAgICAgIC8vIEdsb3cgZm9yIGNlbnRlclxuICAgICAgaWYgKG4uaXNDZW50ZXIpIHtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIDYsIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IGNvbG9yICsgXCIzM1wiO1xuICAgICAgICBjdHguZmlsbCgpO1xuICAgICAgfVxuXG4gICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIChpc0hvdmVyZWQgPyAzIDogMCksIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgIGN0eC5maWxsU3R5bGUgPSBjb2xvcjtcbiAgICAgIGN0eC5maWxsKCk7XG4gICAgICBjdHguc3Ryb2tlU3R5bGUgPSBpc0hvdmVyZWQgPyBcIiNmZmZmZmZcIiA6ICh0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMjU1LDI1NSwyNTUsMC4zKVwiIDogXCJyZ2JhKDAsMCwwLDAuMilcIik7XG4gICAgICBjdHgubGluZVdpZHRoID0gaXNIb3ZlcmVkID8gMi41IDogMTtcbiAgICAgIGN0eC5zdHJva2UoKTtcblxuICAgICAgLy8gTGFiZWxcbiAgICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcIiNlMGUwZTBcIiA6IFwiIzMzMzMzM1wiO1xuICAgICAgY3R4LmZvbnQgPSBuLmlzQ2VudGVyID8gXCJib2xkIDExcHggc2Fucy1zZXJpZlwiIDogXCIxMHB4IHNhbnMtc2VyaWZcIjtcbiAgICAgIGN0eC50ZXh0QWxpZ24gPSBcImNlbnRlclwiO1xuICAgICAgY29uc3QgbGFiZWwgPSBuLm5hbWUubGVuZ3RoID4gMjAgPyBuLm5hbWUuc2xpY2UoMCwgMTgpICsgXCJcdTIwMjZcIiA6IG4ubmFtZTtcbiAgICAgIGN0eC5maWxsVGV4dChsYWJlbCwgbi54LCBuLnkgKyBuLnJhZGl1cyArIDE0KTtcbiAgICB9XG5cbiAgICBjdHgucmVzdG9yZSgpO1xuXG4gICAgLy8gXHVEMjM0XHVEMzAxXG4gICAgaWYgKHRoaXMuaG92ZXJlZE5vZGUpIHtcbiAgICAgIHRoaXMuZHJhd1Rvb2x0aXAodGhpcy5ob3ZlcmVkTm9kZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBkcmF3VG9vbHRpcChuOiBHcmFwaE5vZGUpOiB2b2lkIHtcbiAgICBjb25zdCBjdHggPSB0aGlzLmN0eCE7XG4gICAgY29uc3Qgc3ggPSBuLnggKiB0aGlzLnNjYWxlICsgdGhpcy5vZmZzZXRYO1xuICAgIGNvbnN0IHN5ID0gbi55ICogdGhpcy5zY2FsZSArIHRoaXMub2Zmc2V0WSAtIG4ucmFkaXVzICogdGhpcy5zY2FsZSAtIDEwO1xuXG4gICAgY29uc3QgbGluZXMgPSBbbi5uYW1lLCBgVHlwZTogJHtuLnR5cGV9YF07XG4gICAgaWYgKG4uc2NvcmUgIT0gbnVsbCkgbGluZXMucHVzaChgU2NvcmU6ICR7bi5zY29yZS50b0ZpeGVkKDMpfWApO1xuXG4gICAgY3R4LmZvbnQgPSBcIjExcHggc2Fucy1zZXJpZlwiO1xuICAgIGNvbnN0IG1heFcgPSBNYXRoLm1heCguLi5saW5lcy5tYXAoKGwpID0+IGN0eC5tZWFzdXJlVGV4dChsKS53aWR0aCkpICsgMTY7XG4gICAgY29uc3QgaCA9IGxpbmVzLmxlbmd0aCAqIDE2ICsgMTA7XG5cbiAgICBjb25zdCB0eCA9IHN4IC0gbWF4VyAvIDI7XG4gICAgY29uc3QgdHkgPSBzeSAtIGg7XG5cbiAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDMwLDMwLDMwLDAuOTUpXCIgOiBcInJnYmEoMjU1LDI1NSwyNTUsMC45NSlcIjtcbiAgICBjdHguc3Ryb2tlU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMjU1LDI1NSwyNTUsMC4yKVwiIDogXCJyZ2JhKDAsMCwwLDAuMTUpXCI7XG4gICAgY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgdGhpcy5yb3VuZFJlY3QoY3R4LCB0eCwgdHksIG1heFcsIGgsIDYpO1xuICAgIGN0eC5maWxsKCk7XG4gICAgY3R4LnN0cm9rZSgpO1xuXG4gICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwiI2UwZTBlMFwiIDogXCIjMzMzMzMzXCI7XG4gICAgY3R4LnRleHRBbGlnbiA9IFwibGVmdFwiO1xuICAgIGxpbmVzLmZvckVhY2goKGxpbmUsIGkpID0+IHtcbiAgICAgIGN0eC5maWxsVGV4dChsaW5lLCB0eCArIDgsIHR5ICsgMTYgKyBpICogMTYpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByb3VuZFJlY3QoY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQsIHg6IG51bWJlciwgeTogbnVtYmVyLCB3OiBudW1iZXIsIGg6IG51bWJlciwgcjogbnVtYmVyKTogdm9pZCB7XG4gICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgIGN0eC5tb3ZlVG8oeCArIHIsIHkpO1xuICAgIGN0eC5saW5lVG8oeCArIHcgLSByLCB5KTtcbiAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4ICsgdywgeSwgeCArIHcsIHkgKyByKTtcbiAgICBjdHgubGluZVRvKHggKyB3LCB5ICsgaCAtIHIpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHggKyB3LCB5ICsgaCwgeCArIHcgLSByLCB5ICsgaCk7XG4gICAgY3R4LmxpbmVUbyh4ICsgciwgeSArIGgpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHgsIHkgKyBoLCB4LCB5ICsgaCAtIHIpO1xuICAgIGN0eC5saW5lVG8oeCwgeSArIHIpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHgsIHksIHggKyByLCB5KTtcbiAgICBjdHguY2xvc2VQYXRoKCk7XG4gIH1cblxuICBwcml2YXRlIGRyYXdFbXB0eShtc2c6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGN0eCA9IHRoaXMuY3R4ITtcbiAgICBjb25zdCBjYW52YXMgPSB0aGlzLmNhbnZhcyE7XG4gICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcIiM5OTlcIiA6IFwiIzY2NlwiO1xuICAgIGN0eC5mb250ID0gXCIxNHB4IHNhbnMtc2VyaWZcIjtcbiAgICBjdHgudGV4dEFsaWduID0gXCJjZW50ZXJcIjtcbiAgICBjdHguZmlsbFRleHQobXNnLCBjYW52YXMud2lkdGggLyAyLCBjYW52YXMuaGVpZ2h0IC8gMik7XG4gIH1cblxuICAvLyA9PT09PSBcdUM3NzhcdUQxMzBcdUI3OTlcdUMxNTggPT09PT1cbiAgcHJpdmF0ZSBzZXR1cEludGVyYWN0aW9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGMgPSB0aGlzLmNhbnZhcyE7XG5cbiAgICBjLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgKGUpID0+IHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmhpdFRlc3QoZS5vZmZzZXRYLCBlLm9mZnNldFkpO1xuICAgICAgaWYgKG5vZGUpIHtcbiAgICAgICAgdGhpcy5kcmFnTm9kZSA9IG5vZGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmlzUGFubmluZyA9IHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLmxhc3RNb3VzZSA9IHsgeDogZS5vZmZzZXRYLCB5OiBlLm9mZnNldFkgfTtcbiAgICB9KTtcblxuICAgIGMuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCAoZSkgPT4ge1xuICAgICAgY29uc3QgZHggPSBlLm9mZnNldFggLSB0aGlzLmxhc3RNb3VzZS54O1xuICAgICAgY29uc3QgZHkgPSBlLm9mZnNldFkgLSB0aGlzLmxhc3RNb3VzZS55O1xuXG4gICAgICBpZiAodGhpcy5kcmFnTm9kZSkge1xuICAgICAgICB0aGlzLmRyYWdOb2RlLnggKz0gZHggLyB0aGlzLnNjYWxlO1xuICAgICAgICB0aGlzLmRyYWdOb2RlLnkgKz0gZHkgLyB0aGlzLnNjYWxlO1xuICAgICAgICB0aGlzLmRyYWdOb2RlLnZ4ID0gMDtcbiAgICAgICAgdGhpcy5kcmFnTm9kZS52eSA9IDA7XG4gICAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB0aGlzLmRyYXcoKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc1Bhbm5pbmcpIHtcbiAgICAgICAgdGhpcy5vZmZzZXRYICs9IGR4O1xuICAgICAgICB0aGlzLm9mZnNldFkgKz0gZHk7XG4gICAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB0aGlzLmRyYXcoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHByZXYgPSB0aGlzLmhvdmVyZWROb2RlO1xuICAgICAgICB0aGlzLmhvdmVyZWROb2RlID0gdGhpcy5oaXRUZXN0KGUub2Zmc2V0WCwgZS5vZmZzZXRZKTtcbiAgICAgICAgYy5zdHlsZS5jdXJzb3IgPSB0aGlzLmhvdmVyZWROb2RlID8gXCJwb2ludGVyXCIgOiBcImRlZmF1bHRcIjtcbiAgICAgICAgaWYgKHByZXYgIT09IHRoaXMuaG92ZXJlZE5vZGUgJiYgIXRoaXMuc2ltUnVubmluZykgdGhpcy5kcmF3KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxhc3RNb3VzZSA9IHsgeDogZS5vZmZzZXRYLCB5OiBlLm9mZnNldFkgfTtcbiAgICB9KTtcblxuICAgIGMuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgKGUpID0+IHtcbiAgICAgIGlmICh0aGlzLmRyYWdOb2RlKSB7XG4gICAgICAgIC8vIFx1RDA3NFx1QjlBRCAoXHVCNERDXHVCNzk4XHVBREY4IFx1QzU0NFx1QjJEOCkgXHUyMTkyIFx1QjE3OFx1RDJCOCBcdUM1RjRcdUFFMzBcbiAgICAgICAgY29uc3QgZHggPSBNYXRoLmFicyhlLm9mZnNldFggLSB0aGlzLmxhc3RNb3VzZS54KTtcbiAgICAgICAgY29uc3QgZHkgPSBNYXRoLmFicyhlLm9mZnNldFkgLSB0aGlzLmxhc3RNb3VzZS55KTtcbiAgICAgICAgaWYgKGR4IDwgMyAmJiBkeSA8IDMpIHtcbiAgICAgICAgICB0aGlzLm9wZW5Ob3RlKHRoaXMuZHJhZ05vZGUuaWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmRyYWdOb2RlID0gbnVsbDtcbiAgICAgIHRoaXMuaXNQYW5uaW5nID0gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBjLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuaGl0VGVzdChlLm9mZnNldFgsIGUub2Zmc2V0WSk7XG4gICAgICBpZiAobm9kZSkge1xuICAgICAgICBpZiAoKG5vZGUgYXMgYW55KS5fY2x1c3RlckluZGV4ICE9IG51bGwpIHtcbiAgICAgICAgICAvLyBcdUQwNzRcdUI3RUNcdUMyQTRcdUQxMzAgXHUyMTkyIFx1QjREQ1x1QjlCNFx1QjJFNFx1QzZCNFxuICAgICAgICAgIHRoaXMuZHJpbGxJbnRvQ2x1c3Rlcigobm9kZSBhcyBhbnkpLl9jbHVzdGVySW5kZXgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMub3Blbk5vdGUobm9kZS5pZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGMuYWRkRXZlbnRMaXN0ZW5lcihcIndoZWVsXCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBjb25zdCB6b29tID0gZS5kZWx0YVkgPCAwID8gMS4xIDogMC45O1xuICAgICAgY29uc3QgbXggPSBlLm9mZnNldFgsIG15ID0gZS5vZmZzZXRZO1xuICAgICAgdGhpcy5vZmZzZXRYID0gbXggLSB6b29tICogKG14IC0gdGhpcy5vZmZzZXRYKTtcbiAgICAgIHRoaXMub2Zmc2V0WSA9IG15IC0gem9vbSAqIChteSAtIHRoaXMub2Zmc2V0WSk7XG4gICAgICB0aGlzLnNjYWxlICo9IHpvb207XG4gICAgICB0aGlzLnNjYWxlID0gTWF0aC5tYXgoMC4yLCBNYXRoLm1pbig1LCB0aGlzLnNjYWxlKSk7XG4gICAgICBpZiAoIXRoaXMuc2ltUnVubmluZykgdGhpcy5kcmF3KCk7XG4gICAgfSwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcbiAgfVxuXG4gIHByaXZhdGUgaGl0VGVzdChteDogbnVtYmVyLCBteTogbnVtYmVyKTogR3JhcGhOb2RlIHwgbnVsbCB7XG4gICAgY29uc3QgeCA9IChteCAtIHRoaXMub2Zmc2V0WCkgLyB0aGlzLnNjYWxlO1xuICAgIGNvbnN0IHkgPSAobXkgLSB0aGlzLm9mZnNldFkpIC8gdGhpcy5zY2FsZTtcbiAgICAvLyBSZXZlcnNlIG9yZGVyIHNvIHRvcC1kcmF3biBub2RlcyBhcmUgaGl0IGZpcnN0XG4gICAgZm9yIChsZXQgaSA9IHRoaXMubm9kZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IG4gPSB0aGlzLm5vZGVzW2ldO1xuICAgICAgY29uc3QgZHggPSB4IC0gbi54LCBkeSA9IHkgLSBuLnk7XG4gICAgICBpZiAoZHggKiBkeCArIGR5ICogZHkgPD0gKG4ucmFkaXVzICsgNCkgKiAobi5yYWRpdXMgKyA0KSkgcmV0dXJuIG47XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBvcGVuTm90ZShpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gaWRcdUIyOTQgXHVEMzBDXHVDNzdDIFx1QUNCRFx1Qjg1QyAoXHVDNjA4OiBcImZvbGRlci9ub3RlLm1kXCIpXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChpZCk7XG4gICAgaWYgKGZpbGUpIHtcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoaWQsIFwiXCIsIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZml0VG9WaWV3KCk6IHZvaWQge1xuICAgIGlmICh0aGlzLm5vZGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgIGxldCBtaW5YID0gSW5maW5pdHksIG1heFggPSAtSW5maW5pdHksIG1pblkgPSBJbmZpbml0eSwgbWF4WSA9IC1JbmZpbml0eTtcbiAgICBmb3IgKGNvbnN0IG4gb2YgdGhpcy5ub2Rlcykge1xuICAgICAgbWluWCA9IE1hdGgubWluKG1pblgsIG4ueCAtIG4ucmFkaXVzKTtcbiAgICAgIG1heFggPSBNYXRoLm1heChtYXhYLCBuLnggKyBuLnJhZGl1cyk7XG4gICAgICBtaW5ZID0gTWF0aC5taW4obWluWSwgbi55IC0gbi5yYWRpdXMpO1xuICAgICAgbWF4WSA9IE1hdGgubWF4KG1heFksIG4ueSArIG4ucmFkaXVzKTtcbiAgICB9XG4gICAgY29uc3QgcGFkID0gNDA7XG4gICAgY29uc3QgdyA9IHRoaXMuY2FudmFzIS53aWR0aDtcbiAgICBjb25zdCBoID0gdGhpcy5jYW52YXMhLmhlaWdodDtcbiAgICBjb25zdCBndyA9IG1heFggLSBtaW5YICsgcGFkICogMjtcbiAgICBjb25zdCBnaCA9IG1heFkgLSBtaW5ZICsgcGFkICogMjtcbiAgICB0aGlzLnNjYWxlID0gTWF0aC5taW4odyAvIGd3LCBoIC8gZ2gsIDIpO1xuICAgIHRoaXMub2Zmc2V0WCA9IHcgLyAyIC0gKChtaW5YICsgbWF4WCkgLyAyKSAqIHRoaXMuc2NhbGU7XG4gICAgdGhpcy5vZmZzZXRZID0gaCAvIDIgLSAoKG1pblkgKyBtYXhZKSAvIDIpICogdGhpcy5zY2FsZTtcbiAgICB0aGlzLmRyYXcoKTtcbiAgfVxuXG4gIC8vID09PT09IFx1QzcyMFx1RDJGOCA9PT09PVxuICBwcml2YXRlIHJlc2l6ZUNhbnZhcygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY2FudmFzKSByZXR1cm47XG4gICAgY29uc3QgcmVjdCA9IHRoaXMuY2FudmFzLnBhcmVudEVsZW1lbnQhLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHRoaXMuY2FudmFzLndpZHRoID0gcmVjdC53aWR0aDtcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSByZWN0LmhlaWdodDtcbiAgICBpZiAoIXRoaXMuc2ltUnVubmluZykgdGhpcy5kcmF3KCk7XG4gIH1cblxuICBwcml2YXRlIGlzRGFya1RoZW1lKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5jb250YWlucyhcInRoZW1lLWRhcmtcIik7XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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QVEsT0FBTyxHQUFHLEtBQUssSUFBSSxDQUFDO0FBQUEsTUFDcEQsVUFBVSxNQUFNO0FBQ2QsWUFBSSxpQkFBaUIsS0FBSyxLQUFLLEtBQUssV0FBVyxLQUFLLFFBQVEsRUFBRSxLQUFLO0FBQUEsTUFDckU7QUFBQSxJQUNGLENBQUM7QUFHRCxTQUFLO0FBQUEsTUFDSDtBQUFBLE1BQ0EsQ0FBQyxTQUFTLElBQUksZUFBZSxNQUFNLEtBQUssU0FBUztBQUFBLElBQ25EO0FBR0EsU0FBSyxjQUFjLFlBQVksZUFBZSxNQUFNO0FBQ2xELFdBQUssY0FBYztBQUFBLElBQ3JCLENBQUM7QUFHRCxTQUFLLFdBQVc7QUFBQSxNQUNkLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFVBQVUsTUFBTSxLQUFLLGNBQWM7QUFBQSxJQUNyQyxDQUFDO0FBR0QsU0FBSyxXQUFXO0FBQUEsTUFDZCxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixVQUFVLFlBQVk7QUFDcEIsY0FBTSxRQUFRLE1BQU0sS0FBSyxVQUFVLE1BQU07QUFDekMsWUFBSSxPQUFPO0FBQ1QsY0FBSSx3QkFBTyxVQUFVLE1BQU0sV0FBVyxXQUFXLE1BQU0sV0FBVyxRQUFRO0FBQUEsUUFDNUUsT0FBTztBQUNMLGNBQUksd0JBQU8sbUdBQTRDO0FBQUEsUUFDekQ7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBRUQsWUFBUSxJQUFJLGlDQUFpQztBQUFBLEVBQy9DO0FBQUEsRUFFQSxXQUFpQjtBQUNmLFlBQVEsSUFBSSxtQ0FBbUM7QUFBQSxFQUNqRDtBQUFBLEVBRUEsTUFBTSxlQUE4QjtBQUNsQyxTQUFLLFdBQVcsT0FBTyxPQUFPLENBQUMsR0FBRyxrQkFBa0IsTUFBTSxLQUFLLFNBQVMsQ0FBQztBQUFBLEVBQzNFO0FBQUEsRUFFQSxNQUFNLGVBQThCO0FBQ2xDLFVBQU0sS0FBSyxTQUFTLEtBQUssUUFBUTtBQUFBLEVBQ25DO0FBQUEsRUFFQSxNQUFjLGdCQUErQjtBQUMzQyxVQUFNLFdBQVcsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLHFCQUFxQjtBQUN6RSxRQUFJO0FBQ0osUUFBSSxTQUFTLFNBQVMsR0FBRztBQUN2QixhQUFPLFNBQVMsQ0FBQztBQUFBLElBQ25CLE9BQU87QUFDTCxhQUFPLEtBQUssSUFBSSxVQUFVLGFBQWEsS0FBSztBQUM1QyxZQUFNLEtBQUssYUFBYSxFQUFFLE1BQU0sdUJBQXVCLFFBQVEsS0FBSyxDQUFDO0FBQUEsSUFDdkU7QUFDQSxTQUFLLElBQUksVUFBVSxXQUFXLElBQUk7QUFHbEMsVUFBTSxPQUFPLEtBQUssSUFBSSxVQUFVLGNBQWM7QUFDOUMsUUFBSSxNQUFNO0FBQ1IsWUFBTSxPQUFPLEtBQUs7QUFDbEIsV0FBSyxjQUFjLEtBQUssSUFBSTtBQUFBLElBQzlCO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iXQp9Cg==
