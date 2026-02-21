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
      this.setMode("local", localBtn, fullBtn);
    });
    const fullBtn = toolbar.createEl("button", { text: "\u{1F310} Full", cls: "mnemo-graph-btn", attr: { title: "Full knowledge graph" } });
    fullBtn.addEventListener("click", () => {
      this.setMode("full", fullBtn, localBtn);
    });
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
  setMode(mode, activeBtn, inactiveBtn) {
    this.viewMode = mode;
    activeBtn.addClass("mnemo-graph-btn-active");
    inactiveBtn.removeClass("mnemo-graph-btn-active");
    if (mode === "full") {
      this.loadFullGraph();
    } else {
      this.loadGraph();
    }
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
        this.openNote(node.id);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2FwaS1jbGllbnQudHMiLCAic3JjL3NldHRpbmdzLnRzIiwgInNyYy9zZWFyY2gtbW9kYWwudHMiLCAic3JjL2dyYXBoLXZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IFBsdWdpbiwgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBNbmVtb0FwaUNsaWVudCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcbmltcG9ydCB7IE1uZW1vU2V0dGluZ3MsIE1uZW1vU2V0dGluZ1RhYiwgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBNbmVtb1NlYXJjaE1vZGFsIH0gZnJvbSBcIi4vc2VhcmNoLW1vZGFsXCI7XG5pbXBvcnQgeyBNbmVtb0dyYXBoVmlldywgTU5FTU9fR1JBUEhfVklFV19UWVBFIH0gZnJvbSBcIi4vZ3JhcGgtdmlld1wiO1xuXG4vLyBNbmVtbyBTZWNvbmRCcmFpbiBPYnNpZGlhbiBQbHVnaW5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1uZW1vUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IE1uZW1vU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuICBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50ID0gbmV3IE1uZW1vQXBpQ2xpZW50KERFRkFVTFRfU0VUVElOR1MuYXBpVXJsKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFwaUNsaWVudC5zZXRCYXNlVXJsKHRoaXMuc2V0dGluZ3MuYXBpVXJsKTtcblxuICAgIC8vIFx1QzEyNFx1QzgxNSBcdUQwRUQgXHVCNEYxXHVCODVEIC8gUmVnaXN0ZXIgc2V0dGluZ3MgdGFiXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNbmVtb1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIC8vIFx1QjlBQ1x1QkNGOCBcdUM1NDRcdUM3NzRcdUNGNTggLyBSaWJib24gaWNvblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcImJyYWluXCIsIFwiTW5lbW8gU2VhcmNoXCIsICgpID0+IHtcbiAgICAgIG5ldyBNbmVtb1NlYXJjaE1vZGFsKHRoaXMuYXBwLCB0aGlzLmFwaUNsaWVudCwgdGhpcy5zZXR0aW5ncykub3BlbigpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1Q0VFNFx1QjlFOFx1QjREQyAoQ3RybCtTaGlmdCtNKSAvIFNlYXJjaCBjb21tYW5kXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLXNlYXJjaFwiLFxuICAgICAgbmFtZTogXCJTZWFyY2ggTW5lbW9cIixcbiAgICAgIGhvdGtleXM6IFt7IG1vZGlmaWVyczogW1wiQ3RybFwiLCBcIlNoaWZ0XCJdLCBrZXk6IFwibVwiIH1dLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgbmV3IE1uZW1vU2VhcmNoTW9kYWwodGhpcy5hcHAsIHRoaXMuYXBpQ2xpZW50LCB0aGlzLnNldHRpbmdzKS5vcGVuKCk7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gXHVBREY4XHVCNzk4XHVENTA0IFx1QkRGMCBcdUI0RjFcdUI4NUQgLyBSZWdpc3RlciBncmFwaCB2aWV3XG4gICAgdGhpcy5yZWdpc3RlclZpZXcoXG4gICAgICBNTkVNT19HUkFQSF9WSUVXX1RZUEUsXG4gICAgICAobGVhZikgPT4gbmV3IE1uZW1vR3JhcGhWaWV3KGxlYWYsIHRoaXMuYXBpQ2xpZW50KVxuICAgICk7XG5cbiAgICAvLyBcdUFERjhcdUI3OThcdUQ1MDQgXHVCREYwIFx1QjlBQ1x1QkNGOCBcdUM1NDRcdUM3NzRcdUNGNThcbiAgICB0aGlzLmFkZFJpYmJvbkljb24oXCJnaXQtZm9ya1wiLCBcIk1uZW1vIEdyYXBoXCIsICgpID0+IHtcbiAgICAgIHRoaXMub3BlbkdyYXBoVmlldygpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBREY4XHVCNzk4XHVENTA0IFx1QkRGMCBcdUM1RjRcdUFFMzAgXHVDRUU0XHVCOUU4XHVCNERDXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLW9wZW4tZ3JhcGhcIixcbiAgICAgIG5hbWU6IFwiTW5lbW86IE9wZW4gR3JhcGggVmlld1wiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHRoaXMub3BlbkdyYXBoVmlldygpLFxuICAgIH0pO1xuXG4gICAgLy8gXHVDMTFDXHVCQzg0IFx1QzBDMVx1RDBEQyBcdUQ2NTVcdUM3NzggLyBDaGVjayBzZXJ2ZXIgb24gbG9hZFxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJtbmVtby1jaGVjay1zdGF0dXNcIixcbiAgICAgIG5hbWU6IFwiQ2hlY2sgTW5lbW8gU2VydmVyIFN0YXR1c1wiLFxuICAgICAgY2FsbGJhY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLmFwaUNsaWVudC5zdGF0cygpO1xuICAgICAgICBpZiAoc3RhdHMpIHtcbiAgICAgICAgICBuZXcgTm90aWNlKGBNbmVtbzogJHtzdGF0cy50b3RhbF9ub3Rlc30gbm90ZXMsICR7c3RhdHMudG90YWxfZWRnZXN9IGVkZ2VzYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3IE5vdGljZShcIk1uZW1vOiBcdUMxMUNcdUJDODRcdUM1RDAgXHVDNUYwXHVBQ0IwXHVENTYwIFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQgLyBTZXJ2ZXIgdW5yZWFjaGFibGVcIik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZyhcIk1uZW1vIFNlY29uZEJyYWluIHBsdWdpbiBsb2FkZWRcIik7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZyhcIk1uZW1vIFNlY29uZEJyYWluIHBsdWdpbiB1bmxvYWRlZFwiKTtcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBvcGVuR3JhcGhWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShNTkVNT19HUkFQSF9WSUVXX1RZUEUpO1xuICAgIGxldCBsZWFmOiBpbXBvcnQoXCJvYnNpZGlhblwiKS5Xb3Jrc3BhY2VMZWFmO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICBsZWFmID0gZXhpc3RpbmdbMF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKSE7XG4gICAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IE1ORU1PX0dSQVBIX1ZJRVdfVFlQRSwgYWN0aXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcblxuICAgIC8vIFx1RDYwNFx1QzdBQyBcdUIxNzhcdUQyQjggXHVBRTMwXHVDOTAwXHVDNzNDXHVCODVDIFx1QURGOFx1Qjc5OFx1RDUwNCBcdUI4NUNcdUI0RENcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICBpZiAoZmlsZSkge1xuICAgICAgY29uc3QgdmlldyA9IGxlYWYudmlldyBhcyBNbmVtb0dyYXBoVmlldztcbiAgICAgIHZpZXcuc2V0Q2VudGVyUGF0aChmaWxlLnBhdGgpO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IHJlcXVlc3RVcmwgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuLy8gTW5lbW8gQVBJIFx1QUM4MFx1QzBDOSBcdUFDQjBcdUFDRkMgXHVEMEMwXHVDNzg1IC8gU2VhcmNoIHJlc3VsdCB0eXBlXG5leHBvcnQgaW50ZXJmYWNlIE1uZW1vU2VhcmNoUmVzdWx0IHtcbiAgbmFtZTogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBzbmlwcGV0OiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG4gIGVudGl0eV90eXBlPzogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIHBhdGg/OiBzdHJpbmc7XG59XG5cbi8vIE1uZW1vIFx1QzExQ1x1QkM4NCBcdUQxQjVcdUFDQzQgLyBTZXJ2ZXIgc3RhdHNcbmV4cG9ydCBpbnRlcmZhY2UgTW5lbW9TdGF0cyB7XG4gIHRvdGFsX25vdGVzOiBudW1iZXI7XG4gIHRvdGFsX2VkZ2VzOiBudW1iZXI7XG4gIGluZGV4X3N0YXR1czogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN1YmdyYXBoTm9kZSB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzY29yZT86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdWJncmFwaEVkZ2Uge1xuICBzb3VyY2U6IHN0cmluZztcbiAgdGFyZ2V0OiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1uZW1vQXBpQ2xpZW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmcpIHt9XG5cbiAgc2V0QmFzZVVybCh1cmw6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuYmFzZVVybCA9IHVybC5yZXBsYWNlKC9cXC8rJC8sIFwiXCIpO1xuICB9XG5cbiAgLy8gXHVBQzgwXHVDMEM5IEFQSSBcdUQ2MzhcdUNEOUMgLyBDYWxsIHNlYXJjaCBBUElcbiAgYXN5bmMgc2VhcmNoKFxuICAgIHF1ZXJ5OiBzdHJpbmcsXG4gICAgbW9kZTogc3RyaW5nID0gXCJoeWJyaWRcIixcbiAgICBsaW1pdDogbnVtYmVyID0gMTBcbiAgKTogUHJvbWlzZTxNbmVtb1NlYXJjaFJlc3VsdFtdPiB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7IHE6IHF1ZXJ5LCBtb2RlLCBsaW1pdDogU3RyaW5nKGxpbWl0KSB9KTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L3NlYXJjaD8ke3BhcmFtc31gO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgY29uc3QgZGF0YSA9IHJlc3BvbnNlLmpzb247XG4gICAgICBjb25zdCByZXN1bHRzID0gKGRhdGEucmVzdWx0cyA/PyBkYXRhKSBhcyBhbnlbXTtcbiAgICAgIHJldHVybiByZXN1bHRzLm1hcCgocjogYW55KSA9PiAoe1xuICAgICAgICAuLi5yLFxuICAgICAgICB0aXRsZTogci50aXRsZSB8fCByLm5hbWUgfHwgci5rZXkgfHwgXCJVbnRpdGxlZFwiLFxuICAgICAgfSkpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1QzExQ1x1QkM4NCBcdUMwQzFcdUQwREMgXHVENjU1XHVDNzc4IC8gQ2hlY2sgc2VydmVyIHN0YXRzXG4gIGFzeW5jIHN0YXRzKCk6IFByb21pc2U8TW5lbW9TdGF0cyB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgICAgdXJsOiBgJHt0aGlzLmJhc2VVcmx9L3N0YXRzYCxcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzcG9uc2UuanNvbiBhcyBNbmVtb1N0YXRzO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVDMTFDXHVCRTBDXHVBREY4XHVCNzk4XHVENTA0IFx1Qzg3MFx1RDY4QyAvIEdldCBzdWJncmFwaCBmb3IgdmlzdWFsaXphdGlvblxuICBhc3luYyBzdWJncmFwaChcbiAgICBjZW50ZXI6IHN0cmluZyxcbiAgICBkZXB0aDogbnVtYmVyID0gMlxuICApOiBQcm9taXNlPHsgbm9kZXM6IFN1YmdyYXBoTm9kZVtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW10gfSB8IG51bGw+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHsgY2VudGVyLCBkZXB0aDogU3RyaW5nKGRlcHRoKSB9KTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2dyYXBoL3N1YmdyYXBoPyR7cGFyYW1zfWA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlW107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSB9O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVDODA0XHVDQ0I0IFx1QURGOFx1Qjc5OFx1RDUwNCAoXHVDMEFDXHVDODA0IFx1QUNDNFx1QzBCMCBcdUI4MDhcdUM3NzRcdUM1NDRcdUM2QzMpIC8gRnVsbCBncmFwaCB3aXRoIHByZWNvbXB1dGVkIGxheW91dFxuICBhc3luYyBmdWxsR3JhcGgoKTogUHJvbWlzZTx7IG5vZGVzOiBTdWJncmFwaE5vZGVbXTsgZWRnZXM6IFN1YmdyYXBoRWRnZVtdOyBsYXlvdXQ6IHN0cmluZyB9IHwgbnVsbD4ge1xuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0vZ3JhcGgvZnVsbGA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlW107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXTsgbGF5b3V0OiBzdHJpbmcgfTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZXJyKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1QzVEMFx1QjdFQyBcdUNDOThcdUI5QUMgLyBFcnJvciBoYW5kbGluZyB3aXRoIGZyaWVuZGx5IG1lc3NhZ2VzXG4gIHByaXZhdGUgaGFuZGxlRXJyb3IoZXJyOiB1bmtub3duKTogdm9pZCB7XG4gICAgY29uc3QgbXNnID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpO1xuICAgIGlmIChtc2cuaW5jbHVkZXMoXCJFQ09OTlJFRlVTRURcIikgfHwgbXNnLmluY2x1ZGVzKFwibmV0OjpFUlJcIikpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIGBbTW5lbW9dIFx1QzExQ1x1QkM4NFx1QzVEMCBcdUM1RjBcdUFDQjBcdUQ1NjAgXHVDMjE4IFx1QzVDNlx1QzJCNVx1QjJDOFx1QjJFNC4gTW5lbW8gXHVDMTFDXHVCQzg0XHVBQzAwIFx1QzJFNFx1RDU4OSBcdUM5MTFcdUM3NzhcdUM5QzAgXHVENjU1XHVDNzc4XHVENTU4XHVDMTM4XHVDNjk0LlxcbmAgK1xuICAgICAgICAgIGBDYW5ub3QgY29ubmVjdCB0byBNbmVtbyBzZXJ2ZXIgYXQgJHt0aGlzLmJhc2VVcmx9LiBJcyBpdCBydW5uaW5nP2BcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYFtNbmVtb10gQVBJIGVycm9yOiAke21zZ31gKTtcbiAgICB9XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIE1uZW1vUGx1Z2luIGZyb20gXCIuL21haW5cIjtcblxuLy8gXHVENTBDXHVCN0VDXHVBREY4XHVDNzc4IFx1QzEyNFx1QzgxNSBcdUM3NzhcdUQxMzBcdUQzOThcdUM3NzRcdUMyQTQgLyBQbHVnaW4gc2V0dGluZ3MgaW50ZXJmYWNlXG5leHBvcnQgaW50ZXJmYWNlIE1uZW1vU2V0dGluZ3Mge1xuICBhcGlVcmw6IHN0cmluZztcbiAgc2VhcmNoTGltaXQ6IG51bWJlcjtcbiAgc2VhcmNoTW9kZTogXCJoeWJyaWRcIiB8IFwidmVjdG9yXCIgfCBcImtleXdvcmRcIiB8IFwiZ3JhcGhcIjtcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IE1uZW1vU2V0dGluZ3MgPSB7XG4gIGFwaVVybDogXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIixcbiAgc2VhcmNoTGltaXQ6IDEwLFxuICBzZWFyY2hNb2RlOiBcImh5YnJpZFwiLFxufTtcblxuLy8gXHVDMTI0XHVDODE1IFx1RDBFRCAvIFNldHRpbmdzIHRhYlxuZXhwb3J0IGNsYXNzIE1uZW1vU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IE1uZW1vUGx1Z2luO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE1uZW1vUGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiTW5lbW8gU2Vjb25kQnJhaW4gU2V0dGluZ3NcIiB9KTtcblxuICAgIC8vIEFQSSBVUkwgXHVDMTI0XHVDODE1XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIk1uZW1vIEFQSSBVUkxcIilcbiAgICAgIC5zZXREZXNjKFwiTW5lbW8gRmFzdEFQSSBcdUMxMUNcdUJDODQgXHVDOEZDXHVDMThDIC8gTW5lbW8gc2VydmVyIGFkZHJlc3NcIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiaHR0cDovLzEyNy4wLjAuMTo4MDAwXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaVVybClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlVcmwgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmFwaUNsaWVudC5zZXRCYXNlVXJsKHZhbHVlKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1QUNCMFx1QUNGQyBcdUMyMThcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiU2VhcmNoIHJlc3VsdCBsaW1pdFwiKVxuICAgICAgLnNldERlc2MoXCJcdUFDODBcdUMwQzkgXHVBQ0IwXHVBQ0ZDIFx1Q0Q1Q1x1QjMwMCBcdUFDMUNcdUMyMTggLyBNYXhpbXVtIG51bWJlciBvZiByZXN1bHRzXCIpXG4gICAgICAuYWRkU2xpZGVyKChzbGlkZXIpID0+XG4gICAgICAgIHNsaWRlclxuICAgICAgICAgIC5zZXRMaW1pdHMoNSwgNTAsIDUpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNlYXJjaExpbWl0KVxuICAgICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTGltaXQgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1QkFBOFx1QjREQ1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJTZWFyY2ggbW9kZVwiKVxuICAgICAgLnNldERlc2MoXCJcdUFDODBcdUMwQzkgXHVCQzI5XHVDMkREIFx1QzEyMFx1RDBERCAvIFNlbGVjdCBzZWFyY2ggbWV0aG9kXCIpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxuICAgICAgICBkcm9wZG93blxuICAgICAgICAgIC5hZGRPcHRpb25zKHtcbiAgICAgICAgICAgIGh5YnJpZDogXCJIeWJyaWQgKGtleXdvcmQgKyB2ZWN0b3IpXCIsXG4gICAgICAgICAgICB2ZWN0b3I6IFwiVmVjdG9yIChzZW1hbnRpYylcIixcbiAgICAgICAgICAgIGtleXdvcmQ6IFwiS2V5d29yZCAoQk0yNSlcIixcbiAgICAgICAgICAgIGdyYXBoOiBcIkdyYXBoIChyZWxhdGlvbnNoaXApXCIsXG4gICAgICAgICAgfSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTW9kZSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zZWFyY2hNb2RlID0gdmFsdWUgYXMgTW5lbW9TZXR0aW5nc1tcInNlYXJjaE1vZGVcIl07XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgU3VnZ2VzdE1vZGFsLCBOb3RpY2UsIFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSB7IE1uZW1vQXBpQ2xpZW50LCBNbmVtb1NlYXJjaFJlc3VsdCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcbmltcG9ydCB0eXBlIHsgTW5lbW9TZXR0aW5ncyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5cbi8vIE1uZW1vIFx1QUM4MFx1QzBDOSBcdUJBQThcdUIyRUMgLyBTZWFyY2ggbW9kYWwgKEN0cmwrU2hpZnQrTSlcbmV4cG9ydCBjbGFzcyBNbmVtb1NlYXJjaE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPE1uZW1vU2VhcmNoUmVzdWx0PiB7XG4gIHByaXZhdGUgcmVzdWx0czogTW5lbW9TZWFyY2hSZXN1bHRbXSA9IFtdO1xuICBwcml2YXRlIGRlYm91bmNlVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50LFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IE1uZW1vU2V0dGluZ3NcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiTW5lbW8gXHVBQzgwXHVDMEM5Li4uIC8gU2VhcmNoIE1uZW1vLi4uXCIpO1xuICB9XG5cbiAgYXN5bmMgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFByb21pc2U8TW5lbW9TZWFyY2hSZXN1bHRbXT4ge1xuICAgIGlmICghcXVlcnkgfHwgcXVlcnkubGVuZ3RoIDwgMikgcmV0dXJuIFtdO1xuXG4gICAgLy8gXHVCNTE0XHVCQzE0XHVDNkI0XHVDMkE0IDMwMG1zIC8gRGVib3VuY2UgaW5wdXRcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIpIGNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IGF3YWl0IHRoaXMuYXBpQ2xpZW50LnNlYXJjaChcbiAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLnNlYXJjaE1vZGUsXG4gICAgICAgICAgdGhpcy5zZXR0aW5ncy5zZWFyY2hMaW1pdFxuICAgICAgICApO1xuICAgICAgICByZXNvbHZlKHRoaXMucmVzdWx0cyk7XG4gICAgICB9LCAzMDApO1xuICAgIH0pO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihyZXN1bHQ6IE1uZW1vU2VhcmNoUmVzdWx0LCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb25zdCBjb250YWluZXIgPSBlbC5jcmVhdGVEaXYoeyBjbHM6IFwibW5lbW8tc2VhcmNoLXJlc3VsdFwiIH0pO1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7XG4gICAgICB0ZXh0OiByZXN1bHQudGl0bGUsXG4gICAgICBjbHM6IFwibW5lbW8tcmVzdWx0LXRpdGxlXCIsXG4gICAgfSk7XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwic21hbGxcIiwge1xuICAgICAgdGV4dDogcmVzdWx0LnNuaXBwZXQsXG4gICAgICBjbHM6IFwibW5lbW8tcmVzdWx0LXNuaXBwZXRcIixcbiAgICB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJzcGFuXCIsIHtcbiAgICAgIHRleHQ6IGBzY29yZTogJHtyZXN1bHQuc2NvcmUudG9GaXhlZCgzKX1gLFxuICAgICAgY2xzOiBcIm1uZW1vLXJlc3VsdC1zY29yZVwiLFxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgb25DaG9vc2VTdWdnZXN0aW9uKHJlc3VsdDogTW5lbW9TZWFyY2hSZXN1bHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBcdUJDRkNcdUQyQjhcdUM1RDBcdUMxMUMgXHVENTc0XHVCMkY5IFx1QjE3OFx1RDJCOCBcdUM1RjRcdUFFMzAgLyBPcGVuIG1hdGNoaW5nIG5vdGUgaW4gdmF1bHRcbiAgICBsZXQgcGF0aCA9IHJlc3VsdC5wYXRoIHx8IGAke3Jlc3VsdC50aXRsZX0ubWRgO1xuICAgIGlmICghcGF0aC5lbmRzV2l0aChcIi5tZFwiKSkgcGF0aCArPSBcIi5tZFwiO1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG5cbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZigpLm9wZW5GaWxlKGZpbGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXcgTm90aWNlKGBcdUIxNzhcdUQyQjhcdUI5N0MgXHVDQzNFXHVDNzQ0IFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQ6ICR7cmVzdWx0LnRpdGxlfVxcbk5vdGUgbm90IGZvdW5kIGluIHZhdWx0LmApO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSB7IE1uZW1vQXBpQ2xpZW50LCBTdWJncmFwaE5vZGUsIFN1YmdyYXBoRWRnZSB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcblxuZXhwb3J0IGNvbnN0IE1ORU1PX0dSQVBIX1ZJRVdfVFlQRSA9IFwibW5lbW8tZ3JhcGgtdmlld1wiO1xuXG4vLyBcdUMwQzlcdUMwQzEgXHVCOUY1IChlbnRpdHlfdHlwZVx1QkNDNClcbmNvbnN0IFRZUEVfQ09MT1JTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBldmVudDogXCIjNEE5MEQ5XCIsXG4gIHByb2plY3Q6IFwiI0U4OTEzQVwiLFxuICBub3RlOiBcIiM1MEM4NzhcIixcbiAgc291cmNlOiBcIiM5QjU5QjZcIixcbiAgZGVjaXNpb246IFwiI0U3NEMzQ1wiLFxuICBpbnNpZ2h0OiBcIiNGMUM0MEZcIixcbn07XG5jb25zdCBERUZBVUxUX0NPTE9SID0gXCIjODg4ODg4XCI7XG5cbmludGVyZmFjZSBHcmFwaE5vZGUge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbiAgc2NvcmU/OiBudW1iZXI7XG4gIHg6IG51bWJlcjtcbiAgeTogbnVtYmVyO1xuICB2eDogbnVtYmVyO1xuICB2eTogbnVtYmVyO1xuICByYWRpdXM6IG51bWJlcjtcbiAgaXNDZW50ZXI6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBHcmFwaEVkZ2Uge1xuICBzb3VyY2U6IHN0cmluZztcbiAgdGFyZ2V0OiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1uZW1vR3JhcGhWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG5vZGVzOiBHcmFwaE5vZGVbXSA9IFtdO1xuICBwcml2YXRlIGVkZ2VzOiBHcmFwaEVkZ2VbXSA9IFtdO1xuICBwcml2YXRlIG5vZGVNYXA6IE1hcDxzdHJpbmcsIEdyYXBoTm9kZT4gPSBuZXcgTWFwKCk7XG5cbiAgLy8gXHVDRTc0XHVCQTU0XHVCNzdDXG4gIHByaXZhdGUgb2Zmc2V0WCA9IDA7XG4gIHByaXZhdGUgb2Zmc2V0WSA9IDA7XG4gIHByaXZhdGUgc2NhbGUgPSAxO1xuXG4gIC8vIFx1Qzc3OFx1RDEzMFx1Qjc5OVx1QzE1OFxuICBwcml2YXRlIGRyYWdOb2RlOiBHcmFwaE5vZGUgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBpc1Bhbm5pbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBsYXN0TW91c2UgPSB7IHg6IDAsIHk6IDAgfTtcbiAgcHJpdmF0ZSBob3ZlcmVkTm9kZTogR3JhcGhOb2RlIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgYW5pbUZyYW1lID0gMDtcbiAgcHJpdmF0ZSBzaW1SdW5uaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgc2ltSXRlcmF0aW9ucyA9IDA7XG5cbiAgcHJpdmF0ZSBjZW50ZXJQYXRoID0gXCJcIjtcbiAgcHJpdmF0ZSB2aWV3TW9kZTogXCJsb2NhbFwiIHwgXCJmdWxsXCIgPSBcImxvY2FsXCI7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgbGVhZjogV29ya3NwYWNlTGVhZixcbiAgICBwcml2YXRlIGFwaUNsaWVudDogTW5lbW9BcGlDbGllbnRcbiAgKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcgeyByZXR1cm4gTU5FTU9fR1JBUEhfVklFV19UWVBFOyB9XG4gIGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7IHJldHVybiBcIk1uZW1vIEdyYXBoXCI7IH1cbiAgZ2V0SWNvbigpOiBzdHJpbmcgeyByZXR1cm4gXCJnaXQtZm9ya1wiOyB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyRWwuY2hpbGRyZW5bMV0gYXMgSFRNTEVsZW1lbnQ7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgY29udGFpbmVyLmFkZENsYXNzKFwibW5lbW8tZ3JhcGgtY29udGFpbmVyXCIpO1xuXG4gICAgLy8gXHVEMjM0XHVCQzE0XG4gICAgY29uc3QgdG9vbGJhciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwibW5lbW8tZ3JhcGgtdG9vbGJhclwiIH0pO1xuICAgIHRvb2xiYXIuY3JlYXRlRWwoXCJzcGFuXCIsIHsgdGV4dDogXCJNbmVtbyBHcmFwaFwiLCBjbHM6IFwibW5lbW8tZ3JhcGgtdGl0bGVcIiB9KTtcblxuICAgIGNvbnN0IGxvY2FsQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHVEODNEXHVEQ0NEIExvY2FsXCIsIGNsczogXCJtbmVtby1ncmFwaC1idG4gbW5lbW8tZ3JhcGgtYnRuLWFjdGl2ZVwiLCBhdHRyOiB7IHRpdGxlOiBcIkN1cnJlbnQgbm90ZSBncmFwaFwiIH0gfSk7XG4gICAgbG9jYWxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHsgdGhpcy5zZXRNb2RlKFwibG9jYWxcIiwgbG9jYWxCdG4sIGZ1bGxCdG4pOyB9KTtcblxuICAgIGNvbnN0IGZ1bGxCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdUQ4M0NcdURGMTAgRnVsbFwiLCBjbHM6IFwibW5lbW8tZ3JhcGgtYnRuXCIsIGF0dHI6IHsgdGl0bGU6IFwiRnVsbCBrbm93bGVkZ2UgZ3JhcGhcIiB9IH0pO1xuICAgIGZ1bGxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHsgdGhpcy5zZXRNb2RlKFwiZnVsbFwiLCBmdWxsQnRuLCBsb2NhbEJ0bik7IH0pO1xuXG4gICAgY29uc3QgcmVmcmVzaEJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1MjFCQlwiLCBjbHM6IFwibW5lbW8tZ3JhcGgtYnRuXCIsIGF0dHI6IHsgdGl0bGU6IFwiUmVmcmVzaFwiIH0gfSk7XG4gICAgcmVmcmVzaEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy52aWV3TW9kZSA9PT0gXCJmdWxsXCIgPyB0aGlzLmxvYWRGdWxsR3JhcGgoKSA6IHRoaXMubG9hZEdyYXBoKCkpO1xuXG4gICAgY29uc3QgZml0QnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyMkExXCIsIGNsczogXCJtbmVtby1ncmFwaC1idG5cIiwgYXR0cjogeyB0aXRsZTogXCJGaXQgdG8gdmlld1wiIH0gfSk7XG4gICAgZml0QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB0aGlzLmZpdFRvVmlldygpKTtcblxuICAgIC8vIFx1Q0U5NFx1QkM4NFx1QzJBNFxuICAgIHRoaXMuY2FudmFzID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiY2FudmFzXCIsIHsgY2xzOiBcIm1uZW1vLWdyYXBoLWNhbnZhc1wiIH0pO1xuICAgIHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xuXG4gICAgdGhpcy5yZXNpemVDYW52YXMoKTtcbiAgICB0aGlzLnJlZ2lzdGVyRG9tRXZlbnQod2luZG93LCBcInJlc2l6ZVwiLCAoKSA9PiB0aGlzLnJlc2l6ZUNhbnZhcygpKTtcbiAgICB0aGlzLnNldHVwSW50ZXJhY3Rpb24oKTtcbiAgICB0aGlzLmxvYWRHcmFwaCgpO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnNpbVJ1bm5pbmcgPSBmYWxzZTtcbiAgICBpZiAodGhpcy5hbmltRnJhbWUpIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRoaXMuYW5pbUZyYW1lKTtcbiAgfVxuXG4gIC8vIFx1RDYwNFx1QzdBQyBcdUIxNzhcdUQyQjggXHVBRTMwXHVDOTAwIFx1Qjg1Q1x1QjREQ1xuICBhc3luYyBsb2FkR3JhcGgocGF0aD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghcGF0aCkge1xuICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICBwYXRoID0gZmlsZSA/IGZpbGUucGF0aCA6IFwiXCI7XG4gICAgfVxuICAgIGlmICghcGF0aCkge1xuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJPcGVuIGEgbm90ZSwgdGhlbiByZWZyZXNoXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBBUElcdUIyOTQgLm1kIFx1QzVDNlx1QjI5NCBcdUFDQkRcdUI4NUNcdUI5N0MgXHVDMEFDXHVDNkE5XHVENTYwIFx1QzIxOCBcdUM3ODhcdUM3NENcbiAgICB0aGlzLmNlbnRlclBhdGggPSBwYXRoO1xuICAgIGNvbnN0IGFwaVBhdGggPSBwYXRoLnJlcGxhY2UoL1xcLm1kJC8sIFwiXCIpO1xuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuYXBpQ2xpZW50LnN1YmdyYXBoKGFwaVBhdGgsIDEpO1xuICAgIGlmICghZGF0YSB8fCBkYXRhLm5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5kcmF3RW1wdHkoXCJObyBncmFwaCBkYXRhIGZvciB0aGlzIG5vdGVcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gXHVCMTc4XHVCNERDIFx1QzIxOCBcdUM4MUNcdUQ1NUMgKFx1QzEzMVx1QjJBNSBcdTIwMTQgXHVDRDVDXHVCMzAwIDgwXHVCMTc4XHVCNERDKVxuICAgIGxldCBub2RlcyA9IGRhdGEubm9kZXM7XG4gICAgbGV0IGVkZ2VzID0gZGF0YS5lZGdlcztcbiAgICBpZiAobm9kZXMubGVuZ3RoID4gODApIHtcbiAgICAgIGNvbnN0IGNlbnRlck5vZGUgPSBub2Rlcy5maW5kKG4gPT4gbi5pZCA9PT0gcGF0aCB8fCBuLmlkID09PSBwYXRoLnJlcGxhY2UoL1xcLm1kJC8sIFwiXCIpKTtcbiAgICAgIGNvbnN0IGtlZXAgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgIGlmIChjZW50ZXJOb2RlKSBrZWVwLmFkZChjZW50ZXJOb2RlLmlkKTtcbiAgICAgIC8vIHNjb3JlIFx1QjE5Mlx1Qzc0MCBcdUMyMUNcdUM3M0NcdUI4NUMgODBcdUFDMUNcbiAgICAgIGNvbnN0IHNvcnRlZCA9IFsuLi5ub2Rlc10uc29ydCgoYSwgYikgPT4gKGIuc2NvcmUgPz8gMCkgLSAoYS5zY29yZSA/PyAwKSk7XG4gICAgICBmb3IgKGNvbnN0IG4gb2Ygc29ydGVkKSB7XG4gICAgICAgIGlmIChrZWVwLnNpemUgPj0gODApIGJyZWFrO1xuICAgICAgICBrZWVwLmFkZChuLmlkKTtcbiAgICAgIH1cbiAgICAgIG5vZGVzID0gbm9kZXMuZmlsdGVyKG4gPT4ga2VlcC5oYXMobi5pZCkpO1xuICAgICAgZWRnZXMgPSBlZGdlcy5maWx0ZXIoZSA9PiBrZWVwLmhhcyhlLnNvdXJjZSkgJiYga2VlcC5oYXMoZS50YXJnZXQpKTtcbiAgICB9XG5cbiAgICB0aGlzLmJ1aWxkR3JhcGgobm9kZXMsIGVkZ2VzLCBhcGlQYXRoKTtcbiAgICB0aGlzLnJ1blNpbXVsYXRpb24oKTtcbiAgfVxuXG4gIHNldENlbnRlclBhdGgocGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5sb2FkR3JhcGgocGF0aCk7XG4gIH1cblxuICBwcml2YXRlIHNldE1vZGUobW9kZTogXCJsb2NhbFwiIHwgXCJmdWxsXCIsIGFjdGl2ZUJ0bjogSFRNTEVsZW1lbnQsIGluYWN0aXZlQnRuOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMudmlld01vZGUgPSBtb2RlO1xuICAgIGFjdGl2ZUJ0bi5hZGRDbGFzcyhcIm1uZW1vLWdyYXBoLWJ0bi1hY3RpdmVcIik7XG4gICAgaW5hY3RpdmVCdG4ucmVtb3ZlQ2xhc3MoXCJtbmVtby1ncmFwaC1idG4tYWN0aXZlXCIpO1xuICAgIGlmIChtb2RlID09PSBcImZ1bGxcIikge1xuICAgICAgdGhpcy5sb2FkRnVsbEdyYXBoKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubG9hZEdyYXBoKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgbG9hZEZ1bGxHcmFwaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmRyYXdFbXB0eShcIkxvYWRpbmcgZnVsbCBncmFwaC4uLlwiKTtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuZnVsbEdyYXBoKCk7XG4gICAgaWYgKCFkYXRhIHx8IGRhdGEubm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLmRyYXdFbXB0eShcIk5vIGdyYXBoIGRhdGFcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gXHVDMEFDXHVDODA0IFx1QUNDNFx1QzBCMFx1QjQxQyBcdUM4OENcdUQ0NUMgXHVDMEFDXHVDNkE5IFx1MjAxNCBcdUMyRENcdUJCQUNcdUI4MDhcdUM3NzRcdUMxNTggXHVCRDg4XHVENTQ0XHVDNjk0XG4gICAgY29uc3QgdyA9IHRoaXMuY2FudmFzIS53aWR0aDtcbiAgICBjb25zdCBoID0gdGhpcy5jYW52YXMhLmhlaWdodDtcblxuICAgIHRoaXMubm9kZXMgPSBkYXRhLm5vZGVzLm1hcCgobjogYW55KSA9PiAoe1xuICAgICAgaWQ6IG4uaWQsXG4gICAgICBuYW1lOiBuLm5hbWUsXG4gICAgICB0eXBlOiBuLnR5cGUsXG4gICAgICBzY29yZTogbi5kZWdyZWUsXG4gICAgICB4OiAobi54IC8gMTAwMCkgKiB3ICogMC45ICsgdyAqIDAuMDUsXG4gICAgICB5OiAobi55IC8gMTAwMCkgKiBoICogMC45ICsgaCAqIDAuMDUsXG4gICAgICB2eDogMCxcbiAgICAgIHZ5OiAwLFxuICAgICAgcmFkaXVzOiBNYXRoLm1heCgzLCBNYXRoLm1pbigxNiwgMyArIChuLmRlZ3JlZSB8fCAwKSAqIDAuMDUpKSxcbiAgICAgIGlzQ2VudGVyOiBmYWxzZSxcbiAgICB9KSk7XG5cbiAgICB0aGlzLmVkZ2VzID0gZGF0YS5lZGdlcztcbiAgICB0aGlzLm5vZGVNYXAgPSBuZXcgTWFwKHRoaXMubm9kZXMubWFwKChuKSA9PiBbbi5pZCwgbl0pKTtcbiAgICB0aGlzLm9mZnNldFggPSAwO1xuICAgIHRoaXMub2Zmc2V0WSA9IDA7XG4gICAgdGhpcy5zY2FsZSA9IDE7XG4gICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XG4gICAgdGhpcy5kcmF3KCk7XG4gIH1cblxuICAvLyA9PT09PSBcdUFERjhcdUI3OThcdUQ1MDQgXHVCRTRDXHVCNERDID09PT09XG4gIHByaXZhdGUgYnVpbGRHcmFwaChub2RlczogU3ViZ3JhcGhOb2RlW10sIGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSwgY2VudGVyUGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgdyA9IHRoaXMuY2FudmFzIS53aWR0aDtcbiAgICBjb25zdCBoID0gdGhpcy5jYW52YXMhLmhlaWdodDtcbiAgICBjb25zdCBjeCA9IHcgLyAyLCBjeSA9IGggLyAyO1xuXG4gICAgdGhpcy5ub2RlcyA9IG5vZGVzLm1hcCgobikgPT4gKHtcbiAgICAgIGlkOiBuLmlkLFxuICAgICAgbmFtZTogbi5uYW1lLFxuICAgICAgdHlwZTogbi50eXBlLFxuICAgICAgc2NvcmU6IG4uc2NvcmUsXG4gICAgICB4OiBuLmlkID09PSBjZW50ZXJQYXRoID8gY3ggOiBjeCArIChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDMwMCxcbiAgICAgIHk6IG4uaWQgPT09IGNlbnRlclBhdGggPyBjeSA6IGN5ICsgKE1hdGgucmFuZG9tKCkgLSAwLjUpICogMzAwLFxuICAgICAgdng6IDAsXG4gICAgICB2eTogMCxcbiAgICAgIHJhZGl1czogbi5pZCA9PT0gY2VudGVyUGF0aCA/IDE4IDogMTIsXG4gICAgICBpc0NlbnRlcjogbi5pZCA9PT0gY2VudGVyUGF0aCxcbiAgICB9KSk7XG5cbiAgICB0aGlzLmVkZ2VzID0gZWRnZXM7XG4gICAgdGhpcy5ub2RlTWFwID0gbmV3IE1hcCh0aGlzLm5vZGVzLm1hcCgobikgPT4gW24uaWQsIG5dKSk7XG4gICAgdGhpcy5vZmZzZXRYID0gMDtcbiAgICB0aGlzLm9mZnNldFkgPSAwO1xuICAgIHRoaXMuc2NhbGUgPSAxO1xuICB9XG5cbiAgLy8gPT09PT0gRm9yY2UtZGlyZWN0ZWQgXHVDMkRDXHVCQkFDXHVCODA4XHVDNzc0XHVDMTU4ID09PT09XG4gIHByaXZhdGUgcnVuU2ltdWxhdGlvbigpOiB2b2lkIHtcbiAgICB0aGlzLnNpbVJ1bm5pbmcgPSB0cnVlO1xuICAgIHRoaXMuc2ltSXRlcmF0aW9ucyA9IDA7XG4gICAgY29uc3QgdGljayA9ICgpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSByZXR1cm47XG4gICAgICB0aGlzLnNpbUl0ZXJhdGlvbnMrKztcbiAgICAgIHRoaXMuc2ltdWxhdGVTdGVwKCk7XG4gICAgICB0aGlzLmRyYXcoKTtcbiAgICAgIGlmICh0aGlzLnNpbUl0ZXJhdGlvbnMgPCAyMDApIHtcbiAgICAgICAgdGhpcy5hbmltRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNpbVJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5kcmF3KCk7XG4gICAgICB9XG4gICAgfTtcbiAgICB0aGlzLmFuaW1GcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgfVxuXG4gIHByaXZhdGUgc2ltdWxhdGVTdGVwKCk6IHZvaWQge1xuICAgIGNvbnN0IGFscGhhID0gTWF0aC5tYXgoMC4wMSwgMSAtIHRoaXMuc2ltSXRlcmF0aW9ucyAvIDIwMCk7XG4gICAgY29uc3Qgbm9kZXMgPSB0aGlzLm5vZGVzO1xuICAgIGNvbnN0IHJlcHVsc2lvbiA9IDMwMDA7XG4gICAgY29uc3Qgc3ByaW5nTGVuID0gMTIwO1xuICAgIGNvbnN0IHNwcmluZ0sgPSAwLjAyO1xuICAgIGNvbnN0IGNlbnRlckdyYXZpdHkgPSAwLjAxO1xuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGggLyAyO1xuICAgIGNvbnN0IGggPSB0aGlzLmNhbnZhcyEuaGVpZ2h0IC8gMjtcblxuICAgIC8vIFJlcHVsc2lvbiAoYWxsIHBhaXJzKVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IG5vZGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGNvbnN0IGEgPSBub2Rlc1tpXSwgYiA9IG5vZGVzW2pdO1xuICAgICAgICBsZXQgZHggPSBiLnggLSBhLngsIGR5ID0gYi55IC0gYS55O1xuICAgICAgICBsZXQgZGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSkgfHwgMTtcbiAgICAgICAgY29uc3QgZm9yY2UgPSByZXB1bHNpb24gLyAoZGlzdCAqIGRpc3QpO1xuICAgICAgICBjb25zdCBmeCA9IChkeCAvIGRpc3QpICogZm9yY2UgKiBhbHBoYTtcbiAgICAgICAgY29uc3QgZnkgPSAoZHkgLyBkaXN0KSAqIGZvcmNlICogYWxwaGE7XG4gICAgICAgIGEudnggLT0gZng7IGEudnkgLT0gZnk7XG4gICAgICAgIGIudnggKz0gZng7IGIudnkgKz0gZnk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gU3ByaW5nIChlZGdlcylcbiAgICBmb3IgKGNvbnN0IGUgb2YgdGhpcy5lZGdlcykge1xuICAgICAgY29uc3QgYSA9IHRoaXMubm9kZU1hcC5nZXQoZS5zb3VyY2UpO1xuICAgICAgY29uc3QgYiA9IHRoaXMubm9kZU1hcC5nZXQoZS50YXJnZXQpO1xuICAgICAgaWYgKCFhIHx8ICFiKSBjb250aW51ZTtcbiAgICAgIGxldCBkeCA9IGIueCAtIGEueCwgZHkgPSBiLnkgLSBhLnk7XG4gICAgICBsZXQgZGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSkgfHwgMTtcbiAgICAgIGNvbnN0IGZvcmNlID0gKGRpc3QgLSBzcHJpbmdMZW4pICogc3ByaW5nSyAqIGFscGhhO1xuICAgICAgY29uc3QgZnggPSAoZHggLyBkaXN0KSAqIGZvcmNlO1xuICAgICAgY29uc3QgZnkgPSAoZHkgLyBkaXN0KSAqIGZvcmNlO1xuICAgICAgYS52eCArPSBmeDsgYS52eSArPSBmeTtcbiAgICAgIGIudnggLT0gZng7IGIudnkgLT0gZnk7XG4gICAgfVxuXG4gICAgLy8gQ2VudGVyIGdyYXZpdHlcbiAgICBmb3IgKGNvbnN0IG4gb2Ygbm9kZXMpIHtcbiAgICAgIG4udnggKz0gKHcgLSBuLngpICogY2VudGVyR3Jhdml0eSAqIGFscGhhO1xuICAgICAgbi52eSArPSAoaCAtIG4ueSkgKiBjZW50ZXJHcmF2aXR5ICogYWxwaGE7XG4gICAgICAvLyBEYW1waW5nXG4gICAgICBuLnZ4ICo9IDAuODU7XG4gICAgICBuLnZ5ICo9IDAuODU7XG4gICAgICBpZiAoIW4uaXNDZW50ZXIgfHwgdGhpcy5zaW1JdGVyYXRpb25zID4gNSkge1xuICAgICAgICBuLnggKz0gbi52eDtcbiAgICAgICAgbi55ICs9IG4udnk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gPT09PT0gXHVCODBDXHVCMzU0XHVCOUMxID09PT09XG4gIHByaXZhdGUgZHJhdygpOiB2b2lkIHtcbiAgICBjb25zdCBjdHggPSB0aGlzLmN0eCE7XG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5jYW52YXMhO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICBjdHguc2F2ZSgpO1xuICAgIGN0eC50cmFuc2xhdGUodGhpcy5vZmZzZXRYLCB0aGlzLm9mZnNldFkpO1xuICAgIGN0eC5zY2FsZSh0aGlzLnNjYWxlLCB0aGlzLnNjYWxlKTtcblxuICAgIC8vIFx1QzVFM1x1QzlDMFxuICAgIGZvciAoY29uc3QgZSBvZiB0aGlzLmVkZ2VzKSB7XG4gICAgICBjb25zdCBhID0gdGhpcy5ub2RlTWFwLmdldChlLnNvdXJjZSk7XG4gICAgICBjb25zdCBiID0gdGhpcy5ub2RlTWFwLmdldChlLnRhcmdldCk7XG4gICAgICBpZiAoIWEgfHwgIWIpIGNvbnRpbnVlO1xuXG4gICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICBjdHgubW92ZVRvKGEueCwgYS55KTtcbiAgICAgIGN0eC5saW5lVG8oYi54LCBiLnkpO1xuICAgICAgY3R4LnN0cm9rZVN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDI1NSwyNTUsMjU1LDAuMilcIiA6IFwicmdiYSgwLDAsMCwwLjE1KVwiO1xuICAgICAgY3R4LmxpbmVXaWR0aCA9IDEuNTtcblxuICAgICAgaWYgKGUudHlwZSA9PT0gXCJyZWxhdGVkXCIpIHtcbiAgICAgICAgY3R4LnNldExpbmVEYXNoKFs2LCA0XSk7XG4gICAgICB9IGVsc2UgaWYgKGUudHlwZSA9PT0gXCJ0YWdfc2hhcmVkXCIpIHtcbiAgICAgICAgY3R4LnNldExpbmVEYXNoKFszLCA1XSk7XG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjEpXCIgOiBcInJnYmEoMCwwLDAsMC4wOClcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGN0eC5zZXRMaW5lRGFzaChbXSk7XG4gICAgICB9XG4gICAgICBjdHguc3Ryb2tlKCk7XG4gICAgICBjdHguc2V0TGluZURhc2goW10pO1xuICAgIH1cblxuICAgIC8vIFx1QjE3OFx1QjREQ1xuICAgIGZvciAoY29uc3QgbiBvZiB0aGlzLm5vZGVzKSB7XG4gICAgICBjb25zdCBjb2xvciA9IFRZUEVfQ09MT1JTW24udHlwZV0gfHwgREVGQVVMVF9DT0xPUjtcbiAgICAgIGNvbnN0IGlzSG92ZXJlZCA9IHRoaXMuaG92ZXJlZE5vZGUgPT09IG47XG5cbiAgICAgIC8vIEdsb3cgZm9yIGNlbnRlclxuICAgICAgaWYgKG4uaXNDZW50ZXIpIHtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIDYsIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IGNvbG9yICsgXCIzM1wiO1xuICAgICAgICBjdHguZmlsbCgpO1xuICAgICAgfVxuXG4gICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIChpc0hvdmVyZWQgPyAzIDogMCksIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgIGN0eC5maWxsU3R5bGUgPSBjb2xvcjtcbiAgICAgIGN0eC5maWxsKCk7XG4gICAgICBjdHguc3Ryb2tlU3R5bGUgPSBpc0hvdmVyZWQgPyBcIiNmZmZmZmZcIiA6ICh0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMjU1LDI1NSwyNTUsMC4zKVwiIDogXCJyZ2JhKDAsMCwwLDAuMilcIik7XG4gICAgICBjdHgubGluZVdpZHRoID0gaXNIb3ZlcmVkID8gMi41IDogMTtcbiAgICAgIGN0eC5zdHJva2UoKTtcblxuICAgICAgLy8gTGFiZWxcbiAgICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcIiNlMGUwZTBcIiA6IFwiIzMzMzMzM1wiO1xuICAgICAgY3R4LmZvbnQgPSBuLmlzQ2VudGVyID8gXCJib2xkIDExcHggc2Fucy1zZXJpZlwiIDogXCIxMHB4IHNhbnMtc2VyaWZcIjtcbiAgICAgIGN0eC50ZXh0QWxpZ24gPSBcImNlbnRlclwiO1xuICAgICAgY29uc3QgbGFiZWwgPSBuLm5hbWUubGVuZ3RoID4gMjAgPyBuLm5hbWUuc2xpY2UoMCwgMTgpICsgXCJcdTIwMjZcIiA6IG4ubmFtZTtcbiAgICAgIGN0eC5maWxsVGV4dChsYWJlbCwgbi54LCBuLnkgKyBuLnJhZGl1cyArIDE0KTtcbiAgICB9XG5cbiAgICBjdHgucmVzdG9yZSgpO1xuXG4gICAgLy8gXHVEMjM0XHVEMzAxXG4gICAgaWYgKHRoaXMuaG92ZXJlZE5vZGUpIHtcbiAgICAgIHRoaXMuZHJhd1Rvb2x0aXAodGhpcy5ob3ZlcmVkTm9kZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBkcmF3VG9vbHRpcChuOiBHcmFwaE5vZGUpOiB2b2lkIHtcbiAgICBjb25zdCBjdHggPSB0aGlzLmN0eCE7XG4gICAgY29uc3Qgc3ggPSBuLnggKiB0aGlzLnNjYWxlICsgdGhpcy5vZmZzZXRYO1xuICAgIGNvbnN0IHN5ID0gbi55ICogdGhpcy5zY2FsZSArIHRoaXMub2Zmc2V0WSAtIG4ucmFkaXVzICogdGhpcy5zY2FsZSAtIDEwO1xuXG4gICAgY29uc3QgbGluZXMgPSBbbi5uYW1lLCBgVHlwZTogJHtuLnR5cGV9YF07XG4gICAgaWYgKG4uc2NvcmUgIT0gbnVsbCkgbGluZXMucHVzaChgU2NvcmU6ICR7bi5zY29yZS50b0ZpeGVkKDMpfWApO1xuXG4gICAgY3R4LmZvbnQgPSBcIjExcHggc2Fucy1zZXJpZlwiO1xuICAgIGNvbnN0IG1heFcgPSBNYXRoLm1heCguLi5saW5lcy5tYXAoKGwpID0+IGN0eC5tZWFzdXJlVGV4dChsKS53aWR0aCkpICsgMTY7XG4gICAgY29uc3QgaCA9IGxpbmVzLmxlbmd0aCAqIDE2ICsgMTA7XG5cbiAgICBjb25zdCB0eCA9IHN4IC0gbWF4VyAvIDI7XG4gICAgY29uc3QgdHkgPSBzeSAtIGg7XG5cbiAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDMwLDMwLDMwLDAuOTUpXCIgOiBcInJnYmEoMjU1LDI1NSwyNTUsMC45NSlcIjtcbiAgICBjdHguc3Ryb2tlU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMjU1LDI1NSwyNTUsMC4yKVwiIDogXCJyZ2JhKDAsMCwwLDAuMTUpXCI7XG4gICAgY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgdGhpcy5yb3VuZFJlY3QoY3R4LCB0eCwgdHksIG1heFcsIGgsIDYpO1xuICAgIGN0eC5maWxsKCk7XG4gICAgY3R4LnN0cm9rZSgpO1xuXG4gICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwiI2UwZTBlMFwiIDogXCIjMzMzMzMzXCI7XG4gICAgY3R4LnRleHRBbGlnbiA9IFwibGVmdFwiO1xuICAgIGxpbmVzLmZvckVhY2goKGxpbmUsIGkpID0+IHtcbiAgICAgIGN0eC5maWxsVGV4dChsaW5lLCB0eCArIDgsIHR5ICsgMTYgKyBpICogMTYpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByb3VuZFJlY3QoY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQsIHg6IG51bWJlciwgeTogbnVtYmVyLCB3OiBudW1iZXIsIGg6IG51bWJlciwgcjogbnVtYmVyKTogdm9pZCB7XG4gICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgIGN0eC5tb3ZlVG8oeCArIHIsIHkpO1xuICAgIGN0eC5saW5lVG8oeCArIHcgLSByLCB5KTtcbiAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4ICsgdywgeSwgeCArIHcsIHkgKyByKTtcbiAgICBjdHgubGluZVRvKHggKyB3LCB5ICsgaCAtIHIpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHggKyB3LCB5ICsgaCwgeCArIHcgLSByLCB5ICsgaCk7XG4gICAgY3R4LmxpbmVUbyh4ICsgciwgeSArIGgpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHgsIHkgKyBoLCB4LCB5ICsgaCAtIHIpO1xuICAgIGN0eC5saW5lVG8oeCwgeSArIHIpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHgsIHksIHggKyByLCB5KTtcbiAgICBjdHguY2xvc2VQYXRoKCk7XG4gIH1cblxuICBwcml2YXRlIGRyYXdFbXB0eShtc2c6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGN0eCA9IHRoaXMuY3R4ITtcbiAgICBjb25zdCBjYW52YXMgPSB0aGlzLmNhbnZhcyE7XG4gICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcIiM5OTlcIiA6IFwiIzY2NlwiO1xuICAgIGN0eC5mb250ID0gXCIxNHB4IHNhbnMtc2VyaWZcIjtcbiAgICBjdHgudGV4dEFsaWduID0gXCJjZW50ZXJcIjtcbiAgICBjdHguZmlsbFRleHQobXNnLCBjYW52YXMud2lkdGggLyAyLCBjYW52YXMuaGVpZ2h0IC8gMik7XG4gIH1cblxuICAvLyA9PT09PSBcdUM3NzhcdUQxMzBcdUI3OTlcdUMxNTggPT09PT1cbiAgcHJpdmF0ZSBzZXR1cEludGVyYWN0aW9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGMgPSB0aGlzLmNhbnZhcyE7XG5cbiAgICBjLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgKGUpID0+IHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmhpdFRlc3QoZS5vZmZzZXRYLCBlLm9mZnNldFkpO1xuICAgICAgaWYgKG5vZGUpIHtcbiAgICAgICAgdGhpcy5kcmFnTm9kZSA9IG5vZGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmlzUGFubmluZyA9IHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLmxhc3RNb3VzZSA9IHsgeDogZS5vZmZzZXRYLCB5OiBlLm9mZnNldFkgfTtcbiAgICB9KTtcblxuICAgIGMuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCAoZSkgPT4ge1xuICAgICAgY29uc3QgZHggPSBlLm9mZnNldFggLSB0aGlzLmxhc3RNb3VzZS54O1xuICAgICAgY29uc3QgZHkgPSBlLm9mZnNldFkgLSB0aGlzLmxhc3RNb3VzZS55O1xuXG4gICAgICBpZiAodGhpcy5kcmFnTm9kZSkge1xuICAgICAgICB0aGlzLmRyYWdOb2RlLnggKz0gZHggLyB0aGlzLnNjYWxlO1xuICAgICAgICB0aGlzLmRyYWdOb2RlLnkgKz0gZHkgLyB0aGlzLnNjYWxlO1xuICAgICAgICB0aGlzLmRyYWdOb2RlLnZ4ID0gMDtcbiAgICAgICAgdGhpcy5kcmFnTm9kZS52eSA9IDA7XG4gICAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB0aGlzLmRyYXcoKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc1Bhbm5pbmcpIHtcbiAgICAgICAgdGhpcy5vZmZzZXRYICs9IGR4O1xuICAgICAgICB0aGlzLm9mZnNldFkgKz0gZHk7XG4gICAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB0aGlzLmRyYXcoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHByZXYgPSB0aGlzLmhvdmVyZWROb2RlO1xuICAgICAgICB0aGlzLmhvdmVyZWROb2RlID0gdGhpcy5oaXRUZXN0KGUub2Zmc2V0WCwgZS5vZmZzZXRZKTtcbiAgICAgICAgYy5zdHlsZS5jdXJzb3IgPSB0aGlzLmhvdmVyZWROb2RlID8gXCJwb2ludGVyXCIgOiBcImRlZmF1bHRcIjtcbiAgICAgICAgaWYgKHByZXYgIT09IHRoaXMuaG92ZXJlZE5vZGUgJiYgIXRoaXMuc2ltUnVubmluZykgdGhpcy5kcmF3KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxhc3RNb3VzZSA9IHsgeDogZS5vZmZzZXRYLCB5OiBlLm9mZnNldFkgfTtcbiAgICB9KTtcblxuICAgIGMuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgKGUpID0+IHtcbiAgICAgIGlmICh0aGlzLmRyYWdOb2RlKSB7XG4gICAgICAgIC8vIFx1RDA3NFx1QjlBRCAoXHVCNERDXHVCNzk4XHVBREY4IFx1QzU0NFx1QjJEOCkgXHUyMTkyIFx1QjE3OFx1RDJCOCBcdUM1RjRcdUFFMzBcbiAgICAgICAgY29uc3QgZHggPSBNYXRoLmFicyhlLm9mZnNldFggLSB0aGlzLmxhc3RNb3VzZS54KTtcbiAgICAgICAgY29uc3QgZHkgPSBNYXRoLmFicyhlLm9mZnNldFkgLSB0aGlzLmxhc3RNb3VzZS55KTtcbiAgICAgICAgaWYgKGR4IDwgMyAmJiBkeSA8IDMpIHtcbiAgICAgICAgICB0aGlzLm9wZW5Ob3RlKHRoaXMuZHJhZ05vZGUuaWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmRyYWdOb2RlID0gbnVsbDtcbiAgICAgIHRoaXMuaXNQYW5uaW5nID0gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBjLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuaGl0VGVzdChlLm9mZnNldFgsIGUub2Zmc2V0WSk7XG4gICAgICBpZiAobm9kZSkge1xuICAgICAgICB0aGlzLm9wZW5Ob3RlKG5vZGUuaWQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgYy5hZGRFdmVudExpc3RlbmVyKFwid2hlZWxcIiwgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGNvbnN0IHpvb20gPSBlLmRlbHRhWSA8IDAgPyAxLjEgOiAwLjk7XG4gICAgICBjb25zdCBteCA9IGUub2Zmc2V0WCwgbXkgPSBlLm9mZnNldFk7XG4gICAgICB0aGlzLm9mZnNldFggPSBteCAtIHpvb20gKiAobXggLSB0aGlzLm9mZnNldFgpO1xuICAgICAgdGhpcy5vZmZzZXRZID0gbXkgLSB6b29tICogKG15IC0gdGhpcy5vZmZzZXRZKTtcbiAgICAgIHRoaXMuc2NhbGUgKj0gem9vbTtcbiAgICAgIHRoaXMuc2NhbGUgPSBNYXRoLm1heCgwLjIsIE1hdGgubWluKDUsIHRoaXMuc2NhbGUpKTtcbiAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB0aGlzLmRyYXcoKTtcbiAgICB9LCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBoaXRUZXN0KG14OiBudW1iZXIsIG15OiBudW1iZXIpOiBHcmFwaE5vZGUgfCBudWxsIHtcbiAgICBjb25zdCB4ID0gKG14IC0gdGhpcy5vZmZzZXRYKSAvIHRoaXMuc2NhbGU7XG4gICAgY29uc3QgeSA9IChteSAtIHRoaXMub2Zmc2V0WSkgLyB0aGlzLnNjYWxlO1xuICAgIC8vIFJldmVyc2Ugb3JkZXIgc28gdG9wLWRyYXduIG5vZGVzIGFyZSBoaXQgZmlyc3RcbiAgICBmb3IgKGxldCBpID0gdGhpcy5ub2Rlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgbiA9IHRoaXMubm9kZXNbaV07XG4gICAgICBjb25zdCBkeCA9IHggLSBuLngsIGR5ID0geSAtIG4ueTtcbiAgICAgIGlmIChkeCAqIGR4ICsgZHkgKiBkeSA8PSAobi5yYWRpdXMgKyA0KSAqIChuLnJhZGl1cyArIDQpKSByZXR1cm4gbjtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIG9wZW5Ob3RlKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAvLyBpZFx1QjI5NCBcdUQzMENcdUM3N0MgXHVBQ0JEXHVCODVDIChcdUM2MDg6IFwiZm9sZGVyL25vdGUubWRcIilcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGlkKTtcbiAgICBpZiAoZmlsZSkge1xuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChpZCwgXCJcIiwgdHJ1ZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBmaXRUb1ZpZXcoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubm9kZXMubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgbGV0IG1pblggPSBJbmZpbml0eSwgbWF4WCA9IC1JbmZpbml0eSwgbWluWSA9IEluZmluaXR5LCBtYXhZID0gLUluZmluaXR5O1xuICAgIGZvciAoY29uc3QgbiBvZiB0aGlzLm5vZGVzKSB7XG4gICAgICBtaW5YID0gTWF0aC5taW4obWluWCwgbi54IC0gbi5yYWRpdXMpO1xuICAgICAgbWF4WCA9IE1hdGgubWF4KG1heFgsIG4ueCArIG4ucmFkaXVzKTtcbiAgICAgIG1pblkgPSBNYXRoLm1pbihtaW5ZLCBuLnkgLSBuLnJhZGl1cyk7XG4gICAgICBtYXhZID0gTWF0aC5tYXgobWF4WSwgbi55ICsgbi5yYWRpdXMpO1xuICAgIH1cbiAgICBjb25zdCBwYWQgPSA0MDtcbiAgICBjb25zdCB3ID0gdGhpcy5jYW52YXMhLndpZHRoO1xuICAgIGNvbnN0IGggPSB0aGlzLmNhbnZhcyEuaGVpZ2h0O1xuICAgIGNvbnN0IGd3ID0gbWF4WCAtIG1pblggKyBwYWQgKiAyO1xuICAgIGNvbnN0IGdoID0gbWF4WSAtIG1pblkgKyBwYWQgKiAyO1xuICAgIHRoaXMuc2NhbGUgPSBNYXRoLm1pbih3IC8gZ3csIGggLyBnaCwgMik7XG4gICAgdGhpcy5vZmZzZXRYID0gdyAvIDIgLSAoKG1pblggKyBtYXhYKSAvIDIpICogdGhpcy5zY2FsZTtcbiAgICB0aGlzLm9mZnNldFkgPSBoIC8gMiAtICgobWluWSArIG1heFkpIC8gMikgKiB0aGlzLnNjYWxlO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG5cbiAgLy8gPT09PT0gXHVDNzIwXHVEMkY4ID09PT09XG4gIHByaXZhdGUgcmVzaXplQ2FudmFzKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jYW52YXMpIHJldHVybjtcbiAgICBjb25zdCByZWN0ID0gdGhpcy5jYW52YXMucGFyZW50RWxlbWVudCEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgdGhpcy5jYW52YXMud2lkdGggPSByZWN0LndpZHRoO1xuICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IHJlY3QuaGVpZ2h0O1xuICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB0aGlzLmRyYXcoKTtcbiAgfVxuXG4gIHByaXZhdGUgaXNEYXJrVGhlbWUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmNvbnRhaW5zKFwidGhlbWUtZGFya1wiKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBQStCOzs7QUNBL0Isc0JBQTJCO0FBaUNwQixJQUFNLGlCQUFOLE1BQXFCO0FBQUEsRUFDMUIsWUFBb0IsU0FBaUI7QUFBakI7QUFBQSxFQUFrQjtBQUFBLEVBRXRDLFdBQVcsS0FBbUI7QUFDNUIsU0FBSyxVQUFVLElBQUksUUFBUSxRQUFRLEVBQUU7QUFBQSxFQUN2QztBQUFBO0FBQUEsRUFHQSxNQUFNLE9BQ0osT0FDQSxPQUFlLFVBQ2YsUUFBZ0IsSUFDYztBQUM5QixVQUFNLFNBQVMsSUFBSSxnQkFBZ0IsRUFBRSxHQUFHLE9BQU8sTUFBTSxPQUFPLE9BQU8sS0FBSyxFQUFFLENBQUM7QUFDM0UsVUFBTSxNQUFNLEdBQUcsS0FBSyxPQUFPLFdBQVcsTUFBTTtBQUU1QyxRQUFJO0FBQ0YsWUFBTSxXQUFXLFVBQU0sNEJBQVcsRUFBRSxLQUFLLFFBQVEsTUFBTSxDQUFDO0FBQ3hELFlBQU0sT0FBTyxTQUFTO0FBQ3RCLFlBQU0sVUFBVyxLQUFLLFdBQVc7QUFDakMsYUFBTyxRQUFRLElBQUksQ0FBQyxPQUFZO0FBQUEsUUFDOUIsR0FBRztBQUFBLFFBQ0gsT0FBTyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsT0FBTztBQUFBLE1BQ3ZDLEVBQUU7QUFBQSxJQUNKLFNBQVMsS0FBSztBQUNaLFdBQUssWUFBWSxHQUFHO0FBQ3BCLGFBQU8sQ0FBQztBQUFBLElBQ1Y7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUdBLE1BQU0sUUFBb0M7QUFDeEMsUUFBSTtBQUNGLFlBQU0sV0FBVyxVQUFNLDRCQUFXO0FBQUEsUUFDaEMsS0FBSyxHQUFHLEtBQUssT0FBTztBQUFBLFFBQ3BCLFFBQVE7QUFBQSxNQUNWLENBQUM7QUFDRCxhQUFPLFNBQVM7QUFBQSxJQUNsQixTQUFTLEtBQUs7QUFDWixXQUFLLFlBQVksR0FBRztBQUNwQixhQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBR0EsTUFBTSxTQUNKLFFBQ0EsUUFBZ0IsR0FDa0Q7QUFDbEUsVUFBTSxTQUFTLElBQUksZ0JBQWdCLEVBQUUsUUFBUSxPQUFPLE9BQU8sS0FBSyxFQUFFLENBQUM7QUFDbkUsVUFBTSxNQUFNLEdBQUcsS0FBSyxPQUFPLG1CQUFtQixNQUFNO0FBQ3BELFFBQUk7QUFDRixZQUFNLFdBQVcsVUFBTSw0QkFBVyxFQUFFLEtBQUssUUFBUSxNQUFNLENBQUM7QUFDeEQsYUFBTyxTQUFTO0FBQUEsSUFDbEIsU0FBUyxLQUFLO0FBQ1osV0FBSyxZQUFZLEdBQUc7QUFDcEIsYUFBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUdBLE1BQU0sWUFBOEY7QUFDbEcsVUFBTSxNQUFNLEdBQUcsS0FBSyxPQUFPO0FBQzNCLFFBQUk7QUFDRixZQUFNLFdBQVcsVUFBTSw0QkFBVyxFQUFFLEtBQUssUUFBUSxNQUFNLENBQUM7QUFDeEQsYUFBTyxTQUFTO0FBQUEsSUFDbEIsU0FBUyxLQUFLO0FBQ1osV0FBSyxZQUFZLEdBQUc7QUFDcEIsYUFBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUdRLFlBQVksS0FBb0I7QUFDdEMsVUFBTSxNQUFNLGVBQWUsUUFBUSxJQUFJLFVBQVUsT0FBTyxHQUFHO0FBQzNELFFBQUksSUFBSSxTQUFTLGNBQWMsS0FBSyxJQUFJLFNBQVMsVUFBVSxHQUFHO0FBQzVELGNBQVE7QUFBQSxRQUNOO0FBQUEsb0NBQ3VDLEtBQUssT0FBTztBQUFBLE1BQ3JEO0FBQUEsSUFDRixPQUFPO0FBQ0wsY0FBUSxNQUFNLHNCQUFzQixHQUFHLEVBQUU7QUFBQSxJQUMzQztBQUFBLEVBQ0Y7QUFDRjs7O0FDckhBLElBQUFDLG1CQUErQztBQVV4QyxJQUFNLG1CQUFrQztBQUFBLEVBQzdDLFFBQVE7QUFBQSxFQUNSLGFBQWE7QUFBQSxFQUNiLFlBQVk7QUFDZDtBQUdPLElBQU0sa0JBQU4sY0FBOEIsa0NBQWlCO0FBQUEsRUFDcEQ7QUFBQSxFQUVBLFlBQVksS0FBVSxRQUFxQjtBQUN6QyxVQUFNLEtBQUssTUFBTTtBQUNqQixTQUFLLFNBQVM7QUFBQSxFQUNoQjtBQUFBLEVBRUEsVUFBZ0I7QUFDZCxVQUFNLEVBQUUsWUFBWSxJQUFJO0FBQ3hCLGdCQUFZLE1BQU07QUFDbEIsZ0JBQVksU0FBUyxNQUFNLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUdqRSxRQUFJLHlCQUFRLFdBQVcsRUFDcEIsUUFBUSxlQUFlLEVBQ3ZCLFFBQVEsZ0VBQTRDLEVBQ3BEO0FBQUEsTUFBUSxDQUFDLFNBQ1IsS0FDRyxlQUFlLHVCQUF1QixFQUN0QyxTQUFTLEtBQUssT0FBTyxTQUFTLE1BQU0sRUFDcEMsU0FBUyxPQUFPLFVBQVU7QUFDekIsYUFBSyxPQUFPLFNBQVMsU0FBUztBQUM5QixhQUFLLE9BQU8sVUFBVSxXQUFXLEtBQUs7QUFDdEMsY0FBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLE1BQ2pDLENBQUM7QUFBQSxJQUNMO0FBR0YsUUFBSSx5QkFBUSxXQUFXLEVBQ3BCLFFBQVEscUJBQXFCLEVBQzdCLFFBQVEsaUZBQXlDLEVBQ2pEO0FBQUEsTUFBVSxDQUFDLFdBQ1YsT0FDRyxVQUFVLEdBQUcsSUFBSSxDQUFDLEVBQ2xCLFNBQVMsS0FBSyxPQUFPLFNBQVMsV0FBVyxFQUN6QyxrQkFBa0IsRUFDbEIsU0FBUyxPQUFPLFVBQVU7QUFDekIsYUFBSyxPQUFPLFNBQVMsY0FBYztBQUNuQyxjQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsTUFDakMsQ0FBQztBQUFBLElBQ0w7QUFHRixRQUFJLHlCQUFRLFdBQVcsRUFDcEIsUUFBUSxhQUFhLEVBQ3JCLFFBQVEsK0RBQWlDLEVBQ3pDO0FBQUEsTUFBWSxDQUFDLGFBQ1osU0FDRyxXQUFXO0FBQUEsUUFDVixRQUFRO0FBQUEsUUFDUixRQUFRO0FBQUEsUUFDUixTQUFTO0FBQUEsUUFDVCxPQUFPO0FBQUEsTUFDVCxDQUFDLEVBQ0EsU0FBUyxLQUFLLE9BQU8sU0FBUyxVQUFVLEVBQ3hDLFNBQVMsT0FBTyxVQUFVO0FBQ3pCLGFBQUssT0FBTyxTQUFTLGFBQWE7QUFDbEMsY0FBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLE1BQ2pDLENBQUM7QUFBQSxJQUNMO0FBQUEsRUFDSjtBQUNGOzs7QUMvRUEsSUFBQUMsbUJBQWlEO0FBSzFDLElBQU0sbUJBQU4sY0FBK0IsOEJBQWdDO0FBQUEsRUFJcEUsWUFDRSxLQUNRLFdBQ0EsVUFDUjtBQUNBLFVBQU0sR0FBRztBQUhEO0FBQ0E7QUFHUixTQUFLLGVBQWUseUNBQStCO0FBQUEsRUFDckQ7QUFBQSxFQVZRLFVBQStCLENBQUM7QUFBQSxFQUNoQyxnQkFBc0Q7QUFBQSxFQVc5RCxNQUFNLGVBQWUsT0FBNkM7QUFDaEUsUUFBSSxDQUFDLFNBQVMsTUFBTSxTQUFTLEVBQUcsUUFBTyxDQUFDO0FBR3hDLFdBQU8sSUFBSSxRQUFRLENBQUMsWUFBWTtBQUM5QixVQUFJLEtBQUssY0FBZSxjQUFhLEtBQUssYUFBYTtBQUN2RCxXQUFLLGdCQUFnQixXQUFXLFlBQVk7QUFDMUMsYUFBSyxVQUFVLE1BQU0sS0FBSyxVQUFVO0FBQUEsVUFDbEM7QUFBQSxVQUNBLEtBQUssU0FBUztBQUFBLFVBQ2QsS0FBSyxTQUFTO0FBQUEsUUFDaEI7QUFDQSxnQkFBUSxLQUFLLE9BQU87QUFBQSxNQUN0QixHQUFHLEdBQUc7QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxpQkFBaUIsUUFBMkIsSUFBdUI7QUFDakUsVUFBTSxZQUFZLEdBQUcsVUFBVSxFQUFFLEtBQUssc0JBQXNCLENBQUM7QUFDN0QsY0FBVSxTQUFTLE9BQU87QUFBQSxNQUN4QixNQUFNLE9BQU87QUFBQSxNQUNiLEtBQUs7QUFBQSxJQUNQLENBQUM7QUFDRCxjQUFVLFNBQVMsU0FBUztBQUFBLE1BQzFCLE1BQU0sT0FBTztBQUFBLE1BQ2IsS0FBSztBQUFBLElBQ1AsQ0FBQztBQUNELGNBQVUsU0FBUyxRQUFRO0FBQUEsTUFDekIsTUFBTSxVQUFVLE9BQU8sTUFBTSxRQUFRLENBQUMsQ0FBQztBQUFBLE1BQ3ZDLEtBQUs7QUFBQSxJQUNQLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxNQUFNLG1CQUFtQixRQUEwQztBQUVqRSxRQUFJLE9BQU8sT0FBTyxRQUFRLEdBQUcsT0FBTyxLQUFLO0FBQ3pDLFFBQUksQ0FBQyxLQUFLLFNBQVMsS0FBSyxFQUFHLFNBQVE7QUFDbkMsVUFBTSxPQUFPLEtBQUssSUFBSSxNQUFNLHNCQUFzQixJQUFJO0FBRXRELFFBQUksZ0JBQWdCLHdCQUFPO0FBQ3pCLFlBQU0sS0FBSyxJQUFJLFVBQVUsUUFBUSxFQUFFLFNBQVMsSUFBSTtBQUFBLElBQ2xELE9BQU87QUFDTCxVQUFJLHdCQUFPLG9FQUFrQixPQUFPLEtBQUs7QUFBQSx5QkFBNEI7QUFBQSxJQUN2RTtBQUFBLEVBQ0Y7QUFDRjs7O0FDL0RBLElBQUFDLG1CQUF3QztBQUdqQyxJQUFNLHdCQUF3QjtBQUdyQyxJQUFNLGNBQXNDO0FBQUEsRUFDMUMsT0FBTztBQUFBLEVBQ1AsU0FBUztBQUFBLEVBQ1QsTUFBTTtBQUFBLEVBQ04sUUFBUTtBQUFBLEVBQ1IsVUFBVTtBQUFBLEVBQ1YsU0FBUztBQUNYO0FBQ0EsSUFBTSxnQkFBZ0I7QUFxQmYsSUFBTSxpQkFBTixjQUE2QiwwQkFBUztBQUFBLEVBd0IzQyxZQUNFLE1BQ1EsV0FDUjtBQUNBLFVBQU0sSUFBSTtBQUZGO0FBQUEsRUFHVjtBQUFBLEVBNUJRLFNBQW1DO0FBQUEsRUFDbkMsTUFBdUM7QUFBQSxFQUN2QyxRQUFxQixDQUFDO0FBQUEsRUFDdEIsUUFBcUIsQ0FBQztBQUFBLEVBQ3RCLFVBQWtDLG9CQUFJLElBQUk7QUFBQTtBQUFBLEVBRzFDLFVBQVU7QUFBQSxFQUNWLFVBQVU7QUFBQSxFQUNWLFFBQVE7QUFBQTtBQUFBLEVBR1IsV0FBNkI7QUFBQSxFQUM3QixZQUFZO0FBQUEsRUFDWixZQUFZLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLEVBQ3pCLGNBQWdDO0FBQUEsRUFDaEMsWUFBWTtBQUFBLEVBQ1osYUFBYTtBQUFBLEVBQ2IsZ0JBQWdCO0FBQUEsRUFFaEIsYUFBYTtBQUFBLEVBQ2IsV0FBNkI7QUFBQSxFQVNyQyxjQUFzQjtBQUFFLFdBQU87QUFBQSxFQUF1QjtBQUFBLEVBQ3RELGlCQUF5QjtBQUFFLFdBQU87QUFBQSxFQUFlO0FBQUEsRUFDakQsVUFBa0I7QUFBRSxXQUFPO0FBQUEsRUFBWTtBQUFBLEVBRXZDLE1BQU0sU0FBd0I7QUFDNUIsVUFBTSxZQUFZLEtBQUssWUFBWSxTQUFTLENBQUM7QUFDN0MsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyx1QkFBdUI7QUFHMUMsVUFBTSxVQUFVLFVBQVUsVUFBVSxFQUFFLEtBQUssc0JBQXNCLENBQUM7QUFDbEUsWUFBUSxTQUFTLFFBQVEsRUFBRSxNQUFNLGVBQWUsS0FBSyxvQkFBb0IsQ0FBQztBQUUxRSxVQUFNLFdBQVcsUUFBUSxTQUFTLFVBQVUsRUFBRSxNQUFNLG1CQUFZLEtBQUssMENBQTBDLE1BQU0sRUFBRSxPQUFPLHFCQUFxQixFQUFFLENBQUM7QUFDdEosYUFBUyxpQkFBaUIsU0FBUyxNQUFNO0FBQUUsV0FBSyxRQUFRLFNBQVMsVUFBVSxPQUFPO0FBQUEsSUFBRyxDQUFDO0FBRXRGLFVBQU0sVUFBVSxRQUFRLFNBQVMsVUFBVSxFQUFFLE1BQU0sa0JBQVcsS0FBSyxtQkFBbUIsTUFBTSxFQUFFLE9BQU8sdUJBQXVCLEVBQUUsQ0FBQztBQUMvSCxZQUFRLGlCQUFpQixTQUFTLE1BQU07QUFBRSxXQUFLLFFBQVEsUUFBUSxTQUFTLFFBQVE7QUFBQSxJQUFHLENBQUM7QUFFcEYsVUFBTSxhQUFhLFFBQVEsU0FBUyxVQUFVLEVBQUUsTUFBTSxVQUFLLEtBQUssbUJBQW1CLE1BQU0sRUFBRSxPQUFPLFVBQVUsRUFBRSxDQUFDO0FBQy9HLGVBQVcsaUJBQWlCLFNBQVMsTUFBTSxLQUFLLGFBQWEsU0FBUyxLQUFLLGNBQWMsSUFBSSxLQUFLLFVBQVUsQ0FBQztBQUU3RyxVQUFNLFNBQVMsUUFBUSxTQUFTLFVBQVUsRUFBRSxNQUFNLFVBQUssS0FBSyxtQkFBbUIsTUFBTSxFQUFFLE9BQU8sY0FBYyxFQUFFLENBQUM7QUFDL0csV0FBTyxpQkFBaUIsU0FBUyxNQUFNLEtBQUssVUFBVSxDQUFDO0FBR3ZELFNBQUssU0FBUyxVQUFVLFNBQVMsVUFBVSxFQUFFLEtBQUsscUJBQXFCLENBQUM7QUFDeEUsU0FBSyxNQUFNLEtBQUssT0FBTyxXQUFXLElBQUk7QUFFdEMsU0FBSyxhQUFhO0FBQ2xCLFNBQUssaUJBQWlCLFFBQVEsVUFBVSxNQUFNLEtBQUssYUFBYSxDQUFDO0FBQ2pFLFNBQUssaUJBQWlCO0FBQ3RCLFNBQUssVUFBVTtBQUFBLEVBQ2pCO0FBQUEsRUFFQSxNQUFNLFVBQXlCO0FBQzdCLFNBQUssYUFBYTtBQUNsQixRQUFJLEtBQUssVUFBVyxzQkFBcUIsS0FBSyxTQUFTO0FBQUEsRUFDekQ7QUFBQTtBQUFBLEVBR0EsTUFBTSxVQUFVLE1BQThCO0FBQzVDLFFBQUksQ0FBQyxNQUFNO0FBQ1QsWUFBTSxPQUFPLEtBQUssSUFBSSxVQUFVLGNBQWM7QUFDOUMsYUFBTyxPQUFPLEtBQUssT0FBTztBQUFBLElBQzVCO0FBQ0EsUUFBSSxDQUFDLE1BQU07QUFDVCxXQUFLLFVBQVUsMkJBQTJCO0FBQzFDO0FBQUEsSUFDRjtBQUVBLFNBQUssYUFBYTtBQUNsQixVQUFNLFVBQVUsS0FBSyxRQUFRLFNBQVMsRUFBRTtBQUV4QyxVQUFNLE9BQU8sTUFBTSxLQUFLLFVBQVUsU0FBUyxTQUFTLENBQUM7QUFDckQsUUFBSSxDQUFDLFFBQVEsS0FBSyxNQUFNLFdBQVcsR0FBRztBQUNwQyxXQUFLLFVBQVUsNkJBQTZCO0FBQzVDO0FBQUEsSUFDRjtBQUdBLFFBQUksUUFBUSxLQUFLO0FBQ2pCLFFBQUksUUFBUSxLQUFLO0FBQ2pCLFFBQUksTUFBTSxTQUFTLElBQUk7QUFDckIsWUFBTSxhQUFhLE1BQU0sS0FBSyxPQUFLLEVBQUUsT0FBTyxRQUFRLEVBQUUsT0FBTyxLQUFLLFFBQVEsU0FBUyxFQUFFLENBQUM7QUFDdEYsWUFBTSxPQUFPLG9CQUFJLElBQVk7QUFDN0IsVUFBSSxXQUFZLE1BQUssSUFBSSxXQUFXLEVBQUU7QUFFdEMsWUFBTSxTQUFTLENBQUMsR0FBRyxLQUFLLEVBQUUsS0FBSyxDQUFDLEdBQUcsT0FBTyxFQUFFLFNBQVMsTUFBTSxFQUFFLFNBQVMsRUFBRTtBQUN4RSxpQkFBVyxLQUFLLFFBQVE7QUFDdEIsWUFBSSxLQUFLLFFBQVEsR0FBSTtBQUNyQixhQUFLLElBQUksRUFBRSxFQUFFO0FBQUEsTUFDZjtBQUNBLGNBQVEsTUFBTSxPQUFPLE9BQUssS0FBSyxJQUFJLEVBQUUsRUFBRSxDQUFDO0FBQ3hDLGNBQVEsTUFBTSxPQUFPLE9BQUssS0FBSyxJQUFJLEVBQUUsTUFBTSxLQUFLLEtBQUssSUFBSSxFQUFFLE1BQU0sQ0FBQztBQUFBLElBQ3BFO0FBRUEsU0FBSyxXQUFXLE9BQU8sT0FBTyxPQUFPO0FBQ3JDLFNBQUssY0FBYztBQUFBLEVBQ3JCO0FBQUEsRUFFQSxjQUFjLE1BQW9CO0FBQ2hDLFNBQUssVUFBVSxJQUFJO0FBQUEsRUFDckI7QUFBQSxFQUVRLFFBQVEsTUFBd0IsV0FBd0IsYUFBZ0M7QUFDOUYsU0FBSyxXQUFXO0FBQ2hCLGNBQVUsU0FBUyx3QkFBd0I7QUFDM0MsZ0JBQVksWUFBWSx3QkFBd0I7QUFDaEQsUUFBSSxTQUFTLFFBQVE7QUFDbkIsV0FBSyxjQUFjO0FBQUEsSUFDckIsT0FBTztBQUNMLFdBQUssVUFBVTtBQUFBLElBQ2pCO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBTSxnQkFBK0I7QUFDbkMsU0FBSyxVQUFVLHVCQUF1QjtBQUN0QyxVQUFNLE9BQU8sTUFBTSxLQUFLLFVBQVUsVUFBVTtBQUM1QyxRQUFJLENBQUMsUUFBUSxLQUFLLE1BQU0sV0FBVyxHQUFHO0FBQ3BDLFdBQUssVUFBVSxlQUFlO0FBQzlCO0FBQUEsSUFDRjtBQUdBLFVBQU0sSUFBSSxLQUFLLE9BQVE7QUFDdkIsVUFBTSxJQUFJLEtBQUssT0FBUTtBQUV2QixTQUFLLFFBQVEsS0FBSyxNQUFNLElBQUksQ0FBQyxPQUFZO0FBQUEsTUFDdkMsSUFBSSxFQUFFO0FBQUEsTUFDTixNQUFNLEVBQUU7QUFBQSxNQUNSLE1BQU0sRUFBRTtBQUFBLE1BQ1IsT0FBTyxFQUFFO0FBQUEsTUFDVCxHQUFJLEVBQUUsSUFBSSxNQUFRLElBQUksTUFBTSxJQUFJO0FBQUEsTUFDaEMsR0FBSSxFQUFFLElBQUksTUFBUSxJQUFJLE1BQU0sSUFBSTtBQUFBLE1BQ2hDLElBQUk7QUFBQSxNQUNKLElBQUk7QUFBQSxNQUNKLFFBQVEsS0FBSyxJQUFJLEdBQUcsS0FBSyxJQUFJLElBQUksS0FBSyxFQUFFLFVBQVUsS0FBSyxJQUFJLENBQUM7QUFBQSxNQUM1RCxVQUFVO0FBQUEsSUFDWixFQUFFO0FBRUYsU0FBSyxRQUFRLEtBQUs7QUFDbEIsU0FBSyxVQUFVLElBQUksSUFBSSxLQUFLLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDdkQsU0FBSyxVQUFVO0FBQ2YsU0FBSyxVQUFVO0FBQ2YsU0FBSyxRQUFRO0FBQ2IsU0FBSyxhQUFhO0FBQ2xCLFNBQUssS0FBSztBQUFBLEVBQ1o7QUFBQTtBQUFBLEVBR1EsV0FBVyxPQUF1QixPQUF1QixZQUEwQjtBQUN6RixVQUFNLElBQUksS0FBSyxPQUFRO0FBQ3ZCLFVBQU0sSUFBSSxLQUFLLE9BQVE7QUFDdkIsVUFBTSxLQUFLLElBQUksR0FBRyxLQUFLLElBQUk7QUFFM0IsU0FBSyxRQUFRLE1BQU0sSUFBSSxDQUFDLE9BQU87QUFBQSxNQUM3QixJQUFJLEVBQUU7QUFBQSxNQUNOLE1BQU0sRUFBRTtBQUFBLE1BQ1IsTUFBTSxFQUFFO0FBQUEsTUFDUixPQUFPLEVBQUU7QUFBQSxNQUNULEdBQUcsRUFBRSxPQUFPLGFBQWEsS0FBSyxNQUFNLEtBQUssT0FBTyxJQUFJLE9BQU87QUFBQSxNQUMzRCxHQUFHLEVBQUUsT0FBTyxhQUFhLEtBQUssTUFBTSxLQUFLLE9BQU8sSUFBSSxPQUFPO0FBQUEsTUFDM0QsSUFBSTtBQUFBLE1BQ0osSUFBSTtBQUFBLE1BQ0osUUFBUSxFQUFFLE9BQU8sYUFBYSxLQUFLO0FBQUEsTUFDbkMsVUFBVSxFQUFFLE9BQU87QUFBQSxJQUNyQixFQUFFO0FBRUYsU0FBSyxRQUFRO0FBQ2IsU0FBSyxVQUFVLElBQUksSUFBSSxLQUFLLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDdkQsU0FBSyxVQUFVO0FBQ2YsU0FBSyxVQUFVO0FBQ2YsU0FBSyxRQUFRO0FBQUEsRUFDZjtBQUFBO0FBQUEsRUFHUSxnQkFBc0I7QUFDNUIsU0FBSyxhQUFhO0FBQ2xCLFNBQUssZ0JBQWdCO0FBQ3JCLFVBQU0sT0FBTyxNQUFNO0FBQ2pCLFVBQUksQ0FBQyxLQUFLLFdBQVk7QUFDdEIsV0FBSztBQUNMLFdBQUssYUFBYTtBQUNsQixXQUFLLEtBQUs7QUFDVixVQUFJLEtBQUssZ0JBQWdCLEtBQUs7QUFDNUIsYUFBSyxZQUFZLHNCQUFzQixJQUFJO0FBQUEsTUFDN0MsT0FBTztBQUNMLGFBQUssYUFBYTtBQUNsQixhQUFLLEtBQUs7QUFBQSxNQUNaO0FBQUEsSUFDRjtBQUNBLFNBQUssWUFBWSxzQkFBc0IsSUFBSTtBQUFBLEVBQzdDO0FBQUEsRUFFUSxlQUFxQjtBQUMzQixVQUFNLFFBQVEsS0FBSyxJQUFJLE1BQU0sSUFBSSxLQUFLLGdCQUFnQixHQUFHO0FBQ3pELFVBQU0sUUFBUSxLQUFLO0FBQ25CLFVBQU0sWUFBWTtBQUNsQixVQUFNLFlBQVk7QUFDbEIsVUFBTSxVQUFVO0FBQ2hCLFVBQU0sZ0JBQWdCO0FBQ3RCLFVBQU0sSUFBSSxLQUFLLE9BQVEsUUFBUTtBQUMvQixVQUFNLElBQUksS0FBSyxPQUFRLFNBQVM7QUFHaEMsYUFBUyxJQUFJLEdBQUcsSUFBSSxNQUFNLFFBQVEsS0FBSztBQUNyQyxlQUFTLElBQUksSUFBSSxHQUFHLElBQUksTUFBTSxRQUFRLEtBQUs7QUFDekMsY0FBTSxJQUFJLE1BQU0sQ0FBQyxHQUFHLElBQUksTUFBTSxDQUFDO0FBQy9CLFlBQUksS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLEtBQUssRUFBRSxJQUFJLEVBQUU7QUFDakMsWUFBSSxPQUFPLEtBQUssS0FBSyxLQUFLLEtBQUssS0FBSyxFQUFFLEtBQUs7QUFDM0MsY0FBTSxRQUFRLGFBQWEsT0FBTztBQUNsQyxjQUFNLEtBQU0sS0FBSyxPQUFRLFFBQVE7QUFDakMsY0FBTSxLQUFNLEtBQUssT0FBUSxRQUFRO0FBQ2pDLFVBQUUsTUFBTTtBQUFJLFVBQUUsTUFBTTtBQUNwQixVQUFFLE1BQU07QUFBSSxVQUFFLE1BQU07QUFBQSxNQUN0QjtBQUFBLElBQ0Y7QUFHQSxlQUFXLEtBQUssS0FBSyxPQUFPO0FBQzFCLFlBQU0sSUFBSSxLQUFLLFFBQVEsSUFBSSxFQUFFLE1BQU07QUFDbkMsWUFBTSxJQUFJLEtBQUssUUFBUSxJQUFJLEVBQUUsTUFBTTtBQUNuQyxVQUFJLENBQUMsS0FBSyxDQUFDLEVBQUc7QUFDZCxVQUFJLEtBQUssRUFBRSxJQUFJLEVBQUUsR0FBRyxLQUFLLEVBQUUsSUFBSSxFQUFFO0FBQ2pDLFVBQUksT0FBTyxLQUFLLEtBQUssS0FBSyxLQUFLLEtBQUssRUFBRSxLQUFLO0FBQzNDLFlBQU0sU0FBUyxPQUFPLGFBQWEsVUFBVTtBQUM3QyxZQUFNLEtBQU0sS0FBSyxPQUFRO0FBQ3pCLFlBQU0sS0FBTSxLQUFLLE9BQVE7QUFDekIsUUFBRSxNQUFNO0FBQUksUUFBRSxNQUFNO0FBQ3BCLFFBQUUsTUFBTTtBQUFJLFFBQUUsTUFBTTtBQUFBLElBQ3RCO0FBR0EsZUFBVyxLQUFLLE9BQU87QUFDckIsUUFBRSxPQUFPLElBQUksRUFBRSxLQUFLLGdCQUFnQjtBQUNwQyxRQUFFLE9BQU8sSUFBSSxFQUFFLEtBQUssZ0JBQWdCO0FBRXBDLFFBQUUsTUFBTTtBQUNSLFFBQUUsTUFBTTtBQUNSLFVBQUksQ0FBQyxFQUFFLFlBQVksS0FBSyxnQkFBZ0IsR0FBRztBQUN6QyxVQUFFLEtBQUssRUFBRTtBQUNULFVBQUUsS0FBSyxFQUFFO0FBQUEsTUFDWDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUdRLE9BQWE7QUFDbkIsVUFBTSxNQUFNLEtBQUs7QUFDakIsVUFBTSxTQUFTLEtBQUs7QUFDcEIsUUFBSSxVQUFVLEdBQUcsR0FBRyxPQUFPLE9BQU8sT0FBTyxNQUFNO0FBQy9DLFFBQUksS0FBSztBQUNULFFBQUksVUFBVSxLQUFLLFNBQVMsS0FBSyxPQUFPO0FBQ3hDLFFBQUksTUFBTSxLQUFLLE9BQU8sS0FBSyxLQUFLO0FBR2hDLGVBQVcsS0FBSyxLQUFLLE9BQU87QUFDMUIsWUFBTSxJQUFJLEtBQUssUUFBUSxJQUFJLEVBQUUsTUFBTTtBQUNuQyxZQUFNLElBQUksS0FBSyxRQUFRLElBQUksRUFBRSxNQUFNO0FBQ25DLFVBQUksQ0FBQyxLQUFLLENBQUMsRUFBRztBQUVkLFVBQUksVUFBVTtBQUNkLFVBQUksT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDO0FBQ25CLFVBQUksT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDO0FBQ25CLFVBQUksY0FBYyxLQUFLLFlBQVksSUFBSSwwQkFBMEI7QUFDakUsVUFBSSxZQUFZO0FBRWhCLFVBQUksRUFBRSxTQUFTLFdBQVc7QUFDeEIsWUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN4QixXQUFXLEVBQUUsU0FBUyxjQUFjO0FBQ2xDLFlBQUksWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3RCLFlBQUksY0FBYyxLQUFLLFlBQVksSUFBSSwwQkFBMEI7QUFBQSxNQUNuRSxPQUFPO0FBQ0wsWUFBSSxZQUFZLENBQUMsQ0FBQztBQUFBLE1BQ3BCO0FBQ0EsVUFBSSxPQUFPO0FBQ1gsVUFBSSxZQUFZLENBQUMsQ0FBQztBQUFBLElBQ3BCO0FBR0EsZUFBVyxLQUFLLEtBQUssT0FBTztBQUMxQixZQUFNLFFBQVEsWUFBWSxFQUFFLElBQUksS0FBSztBQUNyQyxZQUFNLFlBQVksS0FBSyxnQkFBZ0I7QUFHdkMsVUFBSSxFQUFFLFVBQVU7QUFDZCxZQUFJLFVBQVU7QUFDZCxZQUFJLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLFNBQVMsR0FBRyxHQUFHLEtBQUssS0FBSyxDQUFDO0FBQzlDLFlBQUksWUFBWSxRQUFRO0FBQ3hCLFlBQUksS0FBSztBQUFBLE1BQ1g7QUFFQSxVQUFJLFVBQVU7QUFDZCxVQUFJLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLFVBQVUsWUFBWSxJQUFJLElBQUksR0FBRyxLQUFLLEtBQUssQ0FBQztBQUNoRSxVQUFJLFlBQVk7QUFDaEIsVUFBSSxLQUFLO0FBQ1QsVUFBSSxjQUFjLFlBQVksWUFBYSxLQUFLLFlBQVksSUFBSSwwQkFBMEI7QUFDMUYsVUFBSSxZQUFZLFlBQVksTUFBTTtBQUNsQyxVQUFJLE9BQU87QUFHWCxVQUFJLFlBQVksS0FBSyxZQUFZLElBQUksWUFBWTtBQUNqRCxVQUFJLE9BQU8sRUFBRSxXQUFXLHlCQUF5QjtBQUNqRCxVQUFJLFlBQVk7QUFDaEIsWUFBTSxRQUFRLEVBQUUsS0FBSyxTQUFTLEtBQUssRUFBRSxLQUFLLE1BQU0sR0FBRyxFQUFFLElBQUksV0FBTSxFQUFFO0FBQ2pFLFVBQUksU0FBUyxPQUFPLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUU7QUFBQSxJQUM5QztBQUVBLFFBQUksUUFBUTtBQUdaLFFBQUksS0FBSyxhQUFhO0FBQ3BCLFdBQUssWUFBWSxLQUFLLFdBQVc7QUFBQSxJQUNuQztBQUFBLEVBQ0Y7QUFBQSxFQUVRLFlBQVksR0FBb0I7QUFDdEMsVUFBTSxNQUFNLEtBQUs7QUFDakIsVUFBTSxLQUFLLEVBQUUsSUFBSSxLQUFLLFFBQVEsS0FBSztBQUNuQyxVQUFNLEtBQUssRUFBRSxJQUFJLEtBQUssUUFBUSxLQUFLLFVBQVUsRUFBRSxTQUFTLEtBQUssUUFBUTtBQUVyRSxVQUFNLFFBQVEsQ0FBQyxFQUFFLE1BQU0sU0FBUyxFQUFFLElBQUksRUFBRTtBQUN4QyxRQUFJLEVBQUUsU0FBUyxLQUFNLE9BQU0sS0FBSyxVQUFVLEVBQUUsTUFBTSxRQUFRLENBQUMsQ0FBQyxFQUFFO0FBRTlELFFBQUksT0FBTztBQUNYLFVBQU0sT0FBTyxLQUFLLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLElBQUksWUFBWSxDQUFDLEVBQUUsS0FBSyxDQUFDLElBQUk7QUFDdkUsVUFBTSxJQUFJLE1BQU0sU0FBUyxLQUFLO0FBRTlCLFVBQU0sS0FBSyxLQUFLLE9BQU87QUFDdkIsVUFBTSxLQUFLLEtBQUs7QUFFaEIsUUFBSSxZQUFZLEtBQUssWUFBWSxJQUFJLHdCQUF3QjtBQUM3RCxRQUFJLGNBQWMsS0FBSyxZQUFZLElBQUksMEJBQTBCO0FBQ2pFLFFBQUksWUFBWTtBQUNoQixTQUFLLFVBQVUsS0FBSyxJQUFJLElBQUksTUFBTSxHQUFHLENBQUM7QUFDdEMsUUFBSSxLQUFLO0FBQ1QsUUFBSSxPQUFPO0FBRVgsUUFBSSxZQUFZLEtBQUssWUFBWSxJQUFJLFlBQVk7QUFDakQsUUFBSSxZQUFZO0FBQ2hCLFVBQU0sUUFBUSxDQUFDLE1BQU0sTUFBTTtBQUN6QixVQUFJLFNBQVMsTUFBTSxLQUFLLEdBQUcsS0FBSyxLQUFLLElBQUksRUFBRTtBQUFBLElBQzdDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSxVQUFVLEtBQStCLEdBQVcsR0FBVyxHQUFXLEdBQVcsR0FBaUI7QUFDNUcsUUFBSSxVQUFVO0FBQ2QsUUFBSSxPQUFPLElBQUksR0FBRyxDQUFDO0FBQ25CLFFBQUksT0FBTyxJQUFJLElBQUksR0FBRyxDQUFDO0FBQ3ZCLFFBQUksaUJBQWlCLElBQUksR0FBRyxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7QUFDM0MsUUFBSSxPQUFPLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQztBQUMzQixRQUFJLGlCQUFpQixJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQztBQUNuRCxRQUFJLE9BQU8sSUFBSSxHQUFHLElBQUksQ0FBQztBQUN2QixRQUFJLGlCQUFpQixHQUFHLElBQUksR0FBRyxHQUFHLElBQUksSUFBSSxDQUFDO0FBQzNDLFFBQUksT0FBTyxHQUFHLElBQUksQ0FBQztBQUNuQixRQUFJLGlCQUFpQixHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUM7QUFDbkMsUUFBSSxVQUFVO0FBQUEsRUFDaEI7QUFBQSxFQUVRLFVBQVUsS0FBbUI7QUFDbkMsVUFBTSxNQUFNLEtBQUs7QUFDakIsVUFBTSxTQUFTLEtBQUs7QUFDcEIsUUFBSSxVQUFVLEdBQUcsR0FBRyxPQUFPLE9BQU8sT0FBTyxNQUFNO0FBQy9DLFFBQUksWUFBWSxLQUFLLFlBQVksSUFBSSxTQUFTO0FBQzlDLFFBQUksT0FBTztBQUNYLFFBQUksWUFBWTtBQUNoQixRQUFJLFNBQVMsS0FBSyxPQUFPLFFBQVEsR0FBRyxPQUFPLFNBQVMsQ0FBQztBQUFBLEVBQ3ZEO0FBQUE7QUFBQSxFQUdRLG1CQUF5QjtBQUMvQixVQUFNLElBQUksS0FBSztBQUVmLE1BQUUsaUJBQWlCLGFBQWEsQ0FBQyxNQUFNO0FBQ3JDLFlBQU0sT0FBTyxLQUFLLFFBQVEsRUFBRSxTQUFTLEVBQUUsT0FBTztBQUM5QyxVQUFJLE1BQU07QUFDUixhQUFLLFdBQVc7QUFBQSxNQUNsQixPQUFPO0FBQ0wsYUFBSyxZQUFZO0FBQUEsTUFDbkI7QUFDQSxXQUFLLFlBQVksRUFBRSxHQUFHLEVBQUUsU0FBUyxHQUFHLEVBQUUsUUFBUTtBQUFBLElBQ2hELENBQUM7QUFFRCxNQUFFLGlCQUFpQixhQUFhLENBQUMsTUFBTTtBQUNyQyxZQUFNLEtBQUssRUFBRSxVQUFVLEtBQUssVUFBVTtBQUN0QyxZQUFNLEtBQUssRUFBRSxVQUFVLEtBQUssVUFBVTtBQUV0QyxVQUFJLEtBQUssVUFBVTtBQUNqQixhQUFLLFNBQVMsS0FBSyxLQUFLLEtBQUs7QUFDN0IsYUFBSyxTQUFTLEtBQUssS0FBSyxLQUFLO0FBQzdCLGFBQUssU0FBUyxLQUFLO0FBQ25CLGFBQUssU0FBUyxLQUFLO0FBQ25CLFlBQUksQ0FBQyxLQUFLLFdBQVksTUFBSyxLQUFLO0FBQUEsTUFDbEMsV0FBVyxLQUFLLFdBQVc7QUFDekIsYUFBSyxXQUFXO0FBQ2hCLGFBQUssV0FBVztBQUNoQixZQUFJLENBQUMsS0FBSyxXQUFZLE1BQUssS0FBSztBQUFBLE1BQ2xDLE9BQU87QUFDTCxjQUFNLE9BQU8sS0FBSztBQUNsQixhQUFLLGNBQWMsS0FBSyxRQUFRLEVBQUUsU0FBUyxFQUFFLE9BQU87QUFDcEQsVUFBRSxNQUFNLFNBQVMsS0FBSyxjQUFjLFlBQVk7QUFDaEQsWUFBSSxTQUFTLEtBQUssZUFBZSxDQUFDLEtBQUssV0FBWSxNQUFLLEtBQUs7QUFBQSxNQUMvRDtBQUNBLFdBQUssWUFBWSxFQUFFLEdBQUcsRUFBRSxTQUFTLEdBQUcsRUFBRSxRQUFRO0FBQUEsSUFDaEQsQ0FBQztBQUVELE1BQUUsaUJBQWlCLFdBQVcsQ0FBQyxNQUFNO0FBQ25DLFVBQUksS0FBSyxVQUFVO0FBRWpCLGNBQU0sS0FBSyxLQUFLLElBQUksRUFBRSxVQUFVLEtBQUssVUFBVSxDQUFDO0FBQ2hELGNBQU0sS0FBSyxLQUFLLElBQUksRUFBRSxVQUFVLEtBQUssVUFBVSxDQUFDO0FBQ2hELFlBQUksS0FBSyxLQUFLLEtBQUssR0FBRztBQUNwQixlQUFLLFNBQVMsS0FBSyxTQUFTLEVBQUU7QUFBQSxRQUNoQztBQUFBLE1BQ0Y7QUFDQSxXQUFLLFdBQVc7QUFDaEIsV0FBSyxZQUFZO0FBQUEsSUFDbkIsQ0FBQztBQUVELE1BQUUsaUJBQWlCLFNBQVMsQ0FBQyxNQUFNO0FBQ2pDLFlBQU0sT0FBTyxLQUFLLFFBQVEsRUFBRSxTQUFTLEVBQUUsT0FBTztBQUM5QyxVQUFJLE1BQU07QUFDUixhQUFLLFNBQVMsS0FBSyxFQUFFO0FBQUEsTUFDdkI7QUFBQSxJQUNGLENBQUM7QUFFRCxNQUFFLGlCQUFpQixTQUFTLENBQUMsTUFBTTtBQUNqQyxRQUFFLGVBQWU7QUFDakIsWUFBTSxPQUFPLEVBQUUsU0FBUyxJQUFJLE1BQU07QUFDbEMsWUFBTSxLQUFLLEVBQUUsU0FBUyxLQUFLLEVBQUU7QUFDN0IsV0FBSyxVQUFVLEtBQUssUUFBUSxLQUFLLEtBQUs7QUFDdEMsV0FBSyxVQUFVLEtBQUssUUFBUSxLQUFLLEtBQUs7QUFDdEMsV0FBSyxTQUFTO0FBQ2QsV0FBSyxRQUFRLEtBQUssSUFBSSxLQUFLLEtBQUssSUFBSSxHQUFHLEtBQUssS0FBSyxDQUFDO0FBQ2xELFVBQUksQ0FBQyxLQUFLLFdBQVksTUFBSyxLQUFLO0FBQUEsSUFDbEMsR0FBRyxFQUFFLFNBQVMsTUFBTSxDQUFDO0FBQUEsRUFDdkI7QUFBQSxFQUVRLFFBQVEsSUFBWSxJQUE4QjtBQUN4RCxVQUFNLEtBQUssS0FBSyxLQUFLLFdBQVcsS0FBSztBQUNyQyxVQUFNLEtBQUssS0FBSyxLQUFLLFdBQVcsS0FBSztBQUVyQyxhQUFTLElBQUksS0FBSyxNQUFNLFNBQVMsR0FBRyxLQUFLLEdBQUcsS0FBSztBQUMvQyxZQUFNLElBQUksS0FBSyxNQUFNLENBQUM7QUFDdEIsWUFBTSxLQUFLLElBQUksRUFBRSxHQUFHLEtBQUssSUFBSSxFQUFFO0FBQy9CLFVBQUksS0FBSyxLQUFLLEtBQUssT0FBTyxFQUFFLFNBQVMsTUFBTSxFQUFFLFNBQVMsR0FBSSxRQUFPO0FBQUEsSUFDbkU7QUFDQSxXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRVEsU0FBUyxJQUFrQjtBQUVqQyxVQUFNLE9BQU8sS0FBSyxJQUFJLE1BQU0sc0JBQXNCLEVBQUU7QUFDcEQsUUFBSSxNQUFNO0FBQ1IsV0FBSyxJQUFJLFVBQVUsYUFBYSxJQUFJLElBQUksSUFBSTtBQUFBLElBQzlDO0FBQUEsRUFDRjtBQUFBLEVBRVEsWUFBa0I7QUFDeEIsUUFBSSxLQUFLLE1BQU0sV0FBVyxFQUFHO0FBQzdCLFFBQUksT0FBTyxVQUFVLE9BQU8sV0FBVyxPQUFPLFVBQVUsT0FBTztBQUMvRCxlQUFXLEtBQUssS0FBSyxPQUFPO0FBQzFCLGFBQU8sS0FBSyxJQUFJLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTTtBQUNwQyxhQUFPLEtBQUssSUFBSSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU07QUFDcEMsYUFBTyxLQUFLLElBQUksTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNO0FBQ3BDLGFBQU8sS0FBSyxJQUFJLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTTtBQUFBLElBQ3RDO0FBQ0EsVUFBTSxNQUFNO0FBQ1osVUFBTSxJQUFJLEtBQUssT0FBUTtBQUN2QixVQUFNLElBQUksS0FBSyxPQUFRO0FBQ3ZCLFVBQU0sS0FBSyxPQUFPLE9BQU8sTUFBTTtBQUMvQixVQUFNLEtBQUssT0FBTyxPQUFPLE1BQU07QUFDL0IsU0FBSyxRQUFRLEtBQUssSUFBSSxJQUFJLElBQUksSUFBSSxJQUFJLENBQUM7QUFDdkMsU0FBSyxVQUFVLElBQUksS0FBTSxPQUFPLFFBQVEsSUFBSyxLQUFLO0FBQ2xELFNBQUssVUFBVSxJQUFJLEtBQU0sT0FBTyxRQUFRLElBQUssS0FBSztBQUNsRCxTQUFLLEtBQUs7QUFBQSxFQUNaO0FBQUE7QUFBQSxFQUdRLGVBQXFCO0FBQzNCLFFBQUksQ0FBQyxLQUFLLE9BQVE7QUFDbEIsVUFBTSxPQUFPLEtBQUssT0FBTyxjQUFlLHNCQUFzQjtBQUM5RCxTQUFLLE9BQU8sUUFBUSxLQUFLO0FBQ3pCLFNBQUssT0FBTyxTQUFTLEtBQUs7QUFDMUIsUUFBSSxDQUFDLEtBQUssV0FBWSxNQUFLLEtBQUs7QUFBQSxFQUNsQztBQUFBLEVBRVEsY0FBdUI7QUFDN0IsV0FBTyxTQUFTLEtBQUssVUFBVSxTQUFTLFlBQVk7QUFBQSxFQUN0RDtBQUNGOzs7QUpsaEJBLElBQXFCLGNBQXJCLGNBQXlDLHdCQUFPO0FBQUEsRUFDOUMsV0FBMEI7QUFBQSxFQUMxQixZQUE0QixJQUFJLGVBQWUsaUJBQWlCLE1BQU07QUFBQSxFQUV0RSxNQUFNLFNBQXdCO0FBQzVCLFVBQU0sS0FBSyxhQUFhO0FBQ3hCLFNBQUssVUFBVSxXQUFXLEtBQUssU0FBUyxNQUFNO0FBRzlDLFNBQUssY0FBYyxJQUFJLGdCQUFnQixLQUFLLEtBQUssSUFBSSxDQUFDO0FBR3RELFNBQUssY0FBYyxTQUFTLGdCQUFnQixNQUFNO0FBQ2hELFVBQUksaUJBQWlCLEtBQUssS0FBSyxLQUFLLFdBQVcsS0FBSyxRQUFRLEVBQUUsS0FBSztBQUFBLElBQ3JFLENBQUM7QUFHRCxTQUFLLFdBQVc7QUFBQSxNQUNkLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFNBQVMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxRQUFRLE9BQU8sR0FBRyxLQUFLLElBQUksQ0FBQztBQUFBLE1BQ3BELFVBQVUsTUFBTTtBQUNkLFlBQUksaUJBQWlCLEtBQUssS0FBSyxLQUFLLFdBQVcsS0FBSyxRQUFRLEVBQUUsS0FBSztBQUFBLE1BQ3JFO0FBQUEsSUFDRixDQUFDO0FBR0QsU0FBSztBQUFBLE1BQ0g7QUFBQSxNQUNBLENBQUMsU0FBUyxJQUFJLGVBQWUsTUFBTSxLQUFLLFNBQVM7QUFBQSxJQUNuRDtBQUdBLFNBQUssY0FBYyxZQUFZLGVBQWUsTUFBTTtBQUNsRCxXQUFLLGNBQWM7QUFBQSxJQUNyQixDQUFDO0FBR0QsU0FBSyxXQUFXO0FBQUEsTUFDZCxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixVQUFVLE1BQU0sS0FBSyxjQUFjO0FBQUEsSUFDckMsQ0FBQztBQUdELFNBQUssV0FBVztBQUFBLE1BQ2QsSUFBSTtBQUFBLE1BQ0osTUFBTTtBQUFBLE1BQ04sVUFBVSxZQUFZO0FBQ3BCLGNBQU0sUUFBUSxNQUFNLEtBQUssVUFBVSxNQUFNO0FBQ3pDLFlBQUksT0FBTztBQUNULGNBQUksd0JBQU8sVUFBVSxNQUFNLFdBQVcsV0FBVyxNQUFNLFdBQVcsUUFBUTtBQUFBLFFBQzVFLE9BQU87QUFDTCxjQUFJLHdCQUFPLG1HQUE0QztBQUFBLFFBQ3pEO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUVELFlBQVEsSUFBSSxpQ0FBaUM7QUFBQSxFQUMvQztBQUFBLEVBRUEsV0FBaUI7QUFDZixZQUFRLElBQUksbUNBQW1DO0FBQUEsRUFDakQ7QUFBQSxFQUVBLE1BQU0sZUFBOEI7QUFDbEMsU0FBSyxXQUFXLE9BQU8sT0FBTyxDQUFDLEdBQUcsa0JBQWtCLE1BQU0sS0FBSyxTQUFTLENBQUM7QUFBQSxFQUMzRTtBQUFBLEVBRUEsTUFBTSxlQUE4QjtBQUNsQyxVQUFNLEtBQUssU0FBUyxLQUFLLFFBQVE7QUFBQSxFQUNuQztBQUFBLEVBRUEsTUFBYyxnQkFBK0I7QUFDM0MsVUFBTSxXQUFXLEtBQUssSUFBSSxVQUFVLGdCQUFnQixxQkFBcUI7QUFDekUsUUFBSTtBQUNKLFFBQUksU0FBUyxTQUFTLEdBQUc7QUFDdkIsYUFBTyxTQUFTLENBQUM7QUFBQSxJQUNuQixPQUFPO0FBQ0wsYUFBTyxLQUFLLElBQUksVUFBVSxhQUFhLEtBQUs7QUFDNUMsWUFBTSxLQUFLLGFBQWEsRUFBRSxNQUFNLHVCQUF1QixRQUFRLEtBQUssQ0FBQztBQUFBLElBQ3ZFO0FBQ0EsU0FBSyxJQUFJLFVBQVUsV0FBVyxJQUFJO0FBR2xDLFVBQU0sT0FBTyxLQUFLLElBQUksVUFBVSxjQUFjO0FBQzlDLFFBQUksTUFBTTtBQUNSLFlBQU0sT0FBTyxLQUFLO0FBQ2xCLFdBQUssY0FBYyxLQUFLLElBQUk7QUFBQSxJQUM5QjtBQUFBLEVBQ0Y7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIl0KfQo=
