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
    const refreshBtn = toolbar.createEl("button", { text: "\u21BB", cls: "mnemo-graph-btn", attr: { title: "Refresh" } });
    refreshBtn.addEventListener("click", () => this.loadGraph());
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2FwaS1jbGllbnQudHMiLCAic3JjL3NldHRpbmdzLnRzIiwgInNyYy9zZWFyY2gtbW9kYWwudHMiLCAic3JjL2dyYXBoLXZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IFBsdWdpbiwgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBNbmVtb0FwaUNsaWVudCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcbmltcG9ydCB7IE1uZW1vU2V0dGluZ3MsIE1uZW1vU2V0dGluZ1RhYiwgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBNbmVtb1NlYXJjaE1vZGFsIH0gZnJvbSBcIi4vc2VhcmNoLW1vZGFsXCI7XG5pbXBvcnQgeyBNbmVtb0dyYXBoVmlldywgTU5FTU9fR1JBUEhfVklFV19UWVBFIH0gZnJvbSBcIi4vZ3JhcGgtdmlld1wiO1xuXG4vLyBNbmVtbyBTZWNvbmRCcmFpbiBPYnNpZGlhbiBQbHVnaW5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1uZW1vUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IE1uZW1vU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuICBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50ID0gbmV3IE1uZW1vQXBpQ2xpZW50KERFRkFVTFRfU0VUVElOR1MuYXBpVXJsKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFwaUNsaWVudC5zZXRCYXNlVXJsKHRoaXMuc2V0dGluZ3MuYXBpVXJsKTtcblxuICAgIC8vIFx1QzEyNFx1QzgxNSBcdUQwRUQgXHVCNEYxXHVCODVEIC8gUmVnaXN0ZXIgc2V0dGluZ3MgdGFiXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNbmVtb1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIC8vIFx1QjlBQ1x1QkNGOCBcdUM1NDRcdUM3NzRcdUNGNTggLyBSaWJib24gaWNvblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcImJyYWluXCIsIFwiTW5lbW8gU2VhcmNoXCIsICgpID0+IHtcbiAgICAgIG5ldyBNbmVtb1NlYXJjaE1vZGFsKHRoaXMuYXBwLCB0aGlzLmFwaUNsaWVudCwgdGhpcy5zZXR0aW5ncykub3BlbigpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1Q0VFNFx1QjlFOFx1QjREQyAoQ3RybCtTaGlmdCtNKSAvIFNlYXJjaCBjb21tYW5kXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLXNlYXJjaFwiLFxuICAgICAgbmFtZTogXCJTZWFyY2ggTW5lbW9cIixcbiAgICAgIGhvdGtleXM6IFt7IG1vZGlmaWVyczogW1wiQ3RybFwiLCBcIlNoaWZ0XCJdLCBrZXk6IFwibVwiIH1dLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgbmV3IE1uZW1vU2VhcmNoTW9kYWwodGhpcy5hcHAsIHRoaXMuYXBpQ2xpZW50LCB0aGlzLnNldHRpbmdzKS5vcGVuKCk7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gXHVBREY4XHVCNzk4XHVENTA0IFx1QkRGMCBcdUI0RjFcdUI4NUQgLyBSZWdpc3RlciBncmFwaCB2aWV3XG4gICAgdGhpcy5yZWdpc3RlclZpZXcoXG4gICAgICBNTkVNT19HUkFQSF9WSUVXX1RZUEUsXG4gICAgICAobGVhZikgPT4gbmV3IE1uZW1vR3JhcGhWaWV3KGxlYWYsIHRoaXMuYXBpQ2xpZW50KVxuICAgICk7XG5cbiAgICAvLyBcdUFERjhcdUI3OThcdUQ1MDQgXHVCREYwIFx1QjlBQ1x1QkNGOCBcdUM1NDRcdUM3NzRcdUNGNThcbiAgICB0aGlzLmFkZFJpYmJvbkljb24oXCJnaXQtZm9ya1wiLCBcIk1uZW1vIEdyYXBoXCIsICgpID0+IHtcbiAgICAgIHRoaXMub3BlbkdyYXBoVmlldygpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBREY4XHVCNzk4XHVENTA0IFx1QkRGMCBcdUM1RjRcdUFFMzAgXHVDRUU0XHVCOUU4XHVCNERDXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLW9wZW4tZ3JhcGhcIixcbiAgICAgIG5hbWU6IFwiTW5lbW86IE9wZW4gR3JhcGggVmlld1wiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHRoaXMub3BlbkdyYXBoVmlldygpLFxuICAgIH0pO1xuXG4gICAgLy8gXHVDMTFDXHVCQzg0IFx1QzBDMVx1RDBEQyBcdUQ2NTVcdUM3NzggLyBDaGVjayBzZXJ2ZXIgb24gbG9hZFxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJtbmVtby1jaGVjay1zdGF0dXNcIixcbiAgICAgIG5hbWU6IFwiQ2hlY2sgTW5lbW8gU2VydmVyIFN0YXR1c1wiLFxuICAgICAgY2FsbGJhY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLmFwaUNsaWVudC5zdGF0cygpO1xuICAgICAgICBpZiAoc3RhdHMpIHtcbiAgICAgICAgICBuZXcgTm90aWNlKGBNbmVtbzogJHtzdGF0cy50b3RhbF9ub3Rlc30gbm90ZXMsICR7c3RhdHMudG90YWxfZWRnZXN9IGVkZ2VzYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3IE5vdGljZShcIk1uZW1vOiBcdUMxMUNcdUJDODRcdUM1RDAgXHVDNUYwXHVBQ0IwXHVENTYwIFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQgLyBTZXJ2ZXIgdW5yZWFjaGFibGVcIik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZyhcIk1uZW1vIFNlY29uZEJyYWluIHBsdWdpbiBsb2FkZWRcIik7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZyhcIk1uZW1vIFNlY29uZEJyYWluIHBsdWdpbiB1bmxvYWRlZFwiKTtcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBvcGVuR3JhcGhWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShNTkVNT19HUkFQSF9WSUVXX1RZUEUpO1xuICAgIGxldCBsZWFmOiBpbXBvcnQoXCJvYnNpZGlhblwiKS5Xb3Jrc3BhY2VMZWFmO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICBsZWFmID0gZXhpc3RpbmdbMF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKSE7XG4gICAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IE1ORU1PX0dSQVBIX1ZJRVdfVFlQRSwgYWN0aXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcblxuICAgIC8vIFx1RDYwNFx1QzdBQyBcdUIxNzhcdUQyQjggXHVBRTMwXHVDOTAwXHVDNzNDXHVCODVDIFx1QURGOFx1Qjc5OFx1RDUwNCBcdUI4NUNcdUI0RENcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICBpZiAoZmlsZSkge1xuICAgICAgY29uc3QgdmlldyA9IGxlYWYudmlldyBhcyBNbmVtb0dyYXBoVmlldztcbiAgICAgIHZpZXcuc2V0Q2VudGVyUGF0aChmaWxlLnBhdGgpO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IHJlcXVlc3RVcmwgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuLy8gTW5lbW8gQVBJIFx1QUM4MFx1QzBDOSBcdUFDQjBcdUFDRkMgXHVEMEMwXHVDNzg1IC8gU2VhcmNoIHJlc3VsdCB0eXBlXG5leHBvcnQgaW50ZXJmYWNlIE1uZW1vU2VhcmNoUmVzdWx0IHtcbiAgbmFtZTogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBzbmlwcGV0OiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG4gIGVudGl0eV90eXBlPzogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIHBhdGg/OiBzdHJpbmc7XG59XG5cbi8vIE1uZW1vIFx1QzExQ1x1QkM4NCBcdUQxQjVcdUFDQzQgLyBTZXJ2ZXIgc3RhdHNcbmV4cG9ydCBpbnRlcmZhY2UgTW5lbW9TdGF0cyB7XG4gIHRvdGFsX25vdGVzOiBudW1iZXI7XG4gIHRvdGFsX2VkZ2VzOiBudW1iZXI7XG4gIGluZGV4X3N0YXR1czogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN1YmdyYXBoTm9kZSB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzY29yZT86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdWJncmFwaEVkZ2Uge1xuICBzb3VyY2U6IHN0cmluZztcbiAgdGFyZ2V0OiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1uZW1vQXBpQ2xpZW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmcpIHt9XG5cbiAgc2V0QmFzZVVybCh1cmw6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuYmFzZVVybCA9IHVybC5yZXBsYWNlKC9cXC8rJC8sIFwiXCIpO1xuICB9XG5cbiAgLy8gXHVBQzgwXHVDMEM5IEFQSSBcdUQ2MzhcdUNEOUMgLyBDYWxsIHNlYXJjaCBBUElcbiAgYXN5bmMgc2VhcmNoKFxuICAgIHF1ZXJ5OiBzdHJpbmcsXG4gICAgbW9kZTogc3RyaW5nID0gXCJoeWJyaWRcIixcbiAgICBsaW1pdDogbnVtYmVyID0gMTBcbiAgKTogUHJvbWlzZTxNbmVtb1NlYXJjaFJlc3VsdFtdPiB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7IHE6IHF1ZXJ5LCBtb2RlLCBsaW1pdDogU3RyaW5nKGxpbWl0KSB9KTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L3NlYXJjaD8ke3BhcmFtc31gO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgY29uc3QgZGF0YSA9IHJlc3BvbnNlLmpzb247XG4gICAgICBjb25zdCByZXN1bHRzID0gKGRhdGEucmVzdWx0cyA/PyBkYXRhKSBhcyBhbnlbXTtcbiAgICAgIHJldHVybiByZXN1bHRzLm1hcCgocjogYW55KSA9PiAoe1xuICAgICAgICAuLi5yLFxuICAgICAgICB0aXRsZTogci50aXRsZSB8fCByLm5hbWUgfHwgci5rZXkgfHwgXCJVbnRpdGxlZFwiLFxuICAgICAgfSkpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1QzExQ1x1QkM4NCBcdUMwQzFcdUQwREMgXHVENjU1XHVDNzc4IC8gQ2hlY2sgc2VydmVyIHN0YXRzXG4gIGFzeW5jIHN0YXRzKCk6IFByb21pc2U8TW5lbW9TdGF0cyB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgICAgdXJsOiBgJHt0aGlzLmJhc2VVcmx9L3N0YXRzYCxcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzcG9uc2UuanNvbiBhcyBNbmVtb1N0YXRzO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVDMTFDXHVCRTBDXHVBREY4XHVCNzk4XHVENTA0IFx1Qzg3MFx1RDY4QyAvIEdldCBzdWJncmFwaCBmb3IgdmlzdWFsaXphdGlvblxuICBhc3luYyBzdWJncmFwaChcbiAgICBjZW50ZXI6IHN0cmluZyxcbiAgICBkZXB0aDogbnVtYmVyID0gMlxuICApOiBQcm9taXNlPHsgbm9kZXM6IFN1YmdyYXBoTm9kZVtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW10gfSB8IG51bGw+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHsgY2VudGVyLCBkZXB0aDogU3RyaW5nKGRlcHRoKSB9KTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2dyYXBoL3N1YmdyYXBoPyR7cGFyYW1zfWA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlW107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSB9O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVDNUQwXHVCN0VDIFx1Q0M5OFx1QjlBQyAvIEVycm9yIGhhbmRsaW5nIHdpdGggZnJpZW5kbHkgbWVzc2FnZXNcbiAgcHJpdmF0ZSBoYW5kbGVFcnJvcihlcnI6IHVua25vd24pOiB2b2lkIHtcbiAgICBjb25zdCBtc2cgPSBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycik7XG4gICAgaWYgKG1zZy5pbmNsdWRlcyhcIkVDT05OUkVGVVNFRFwiKSB8fCBtc2cuaW5jbHVkZXMoXCJuZXQ6OkVSUlwiKSkge1xuICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgYFtNbmVtb10gXHVDMTFDXHVCQzg0XHVDNUQwIFx1QzVGMFx1QUNCMFx1RDU2MCBcdUMyMTggXHVDNUM2XHVDMkI1XHVCMkM4XHVCMkU0LiBNbmVtbyBcdUMxMUNcdUJDODRcdUFDMDAgXHVDMkU0XHVENTg5IFx1QzkxMVx1Qzc3OFx1QzlDMCBcdUQ2NTVcdUM3NzhcdUQ1NThcdUMxMzhcdUM2OTQuXFxuYCArXG4gICAgICAgICAgYENhbm5vdCBjb25uZWN0IHRvIE1uZW1vIHNlcnZlciBhdCAke3RoaXMuYmFzZVVybH0uIElzIGl0IHJ1bm5pbmc/YFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcihgW01uZW1vXSBBUEkgZXJyb3I6ICR7bXNnfWApO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgTW5lbW9QbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuXG4vLyBcdUQ1MENcdUI3RUNcdUFERjhcdUM3NzggXHVDMTI0XHVDODE1IFx1Qzc3OFx1RDEzMFx1RDM5OFx1Qzc3NFx1QzJBNCAvIFBsdWdpbiBzZXR0aW5ncyBpbnRlcmZhY2VcbmV4cG9ydCBpbnRlcmZhY2UgTW5lbW9TZXR0aW5ncyB7XG4gIGFwaVVybDogc3RyaW5nO1xuICBzZWFyY2hMaW1pdDogbnVtYmVyO1xuICBzZWFyY2hNb2RlOiBcImh5YnJpZFwiIHwgXCJ2ZWN0b3JcIiB8IFwia2V5d29yZFwiIHwgXCJncmFwaFwiO1xufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogTW5lbW9TZXR0aW5ncyA9IHtcbiAgYXBpVXJsOiBcImh0dHA6Ly8xMjcuMC4wLjE6ODAwMFwiLFxuICBzZWFyY2hMaW1pdDogMTAsXG4gIHNlYXJjaE1vZGU6IFwiaHlicmlkXCIsXG59O1xuXG4vLyBcdUMxMjRcdUM4MTUgXHVEMEVEIC8gU2V0dGluZ3MgdGFiXG5leHBvcnQgY2xhc3MgTW5lbW9TZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogTW5lbW9QbHVnaW47XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogTW5lbW9QbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJNbmVtbyBTZWNvbmRCcmFpbiBTZXR0aW5nc1wiIH0pO1xuXG4gICAgLy8gQVBJIFVSTCBcdUMxMjRcdUM4MTVcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiTW5lbW8gQVBJIFVSTFwiKVxuICAgICAgLnNldERlc2MoXCJNbmVtbyBGYXN0QVBJIFx1QzExQ1x1QkM4NCBcdUM4RkNcdUMxOEMgLyBNbmVtbyBzZXJ2ZXIgYWRkcmVzc1wiKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIilcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpVXJsKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaVVybCA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uYXBpQ2xpZW50LnNldEJhc2VVcmwodmFsdWUpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICAvLyBcdUFDODBcdUMwQzkgXHVBQ0IwXHVBQ0ZDIFx1QzIxOFxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJTZWFyY2ggcmVzdWx0IGxpbWl0XCIpXG4gICAgICAuc2V0RGVzYyhcIlx1QUM4MFx1QzBDOSBcdUFDQjBcdUFDRkMgXHVDRDVDXHVCMzAwIFx1QUMxQ1x1QzIxOCAvIE1heGltdW0gbnVtYmVyIG9mIHJlc3VsdHNcIilcbiAgICAgIC5hZGRTbGlkZXIoKHNsaWRlcikgPT5cbiAgICAgICAgc2xpZGVyXG4gICAgICAgICAgLnNldExpbWl0cyg1LCA1MCwgNSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTGltaXQpXG4gICAgICAgICAgLnNldER5bmFtaWNUb29sdGlwKClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zZWFyY2hMaW1pdCA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICAvLyBcdUFDODBcdUMwQzkgXHVCQUE4XHVCNERDXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlNlYXJjaCBtb2RlXCIpXG4gICAgICAuc2V0RGVzYyhcIlx1QUM4MFx1QzBDOSBcdUJDMjlcdUMyREQgXHVDMTIwXHVEMEREIC8gU2VsZWN0IHNlYXJjaCBtZXRob2RcIilcbiAgICAgIC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+XG4gICAgICAgIGRyb3Bkb3duXG4gICAgICAgICAgLmFkZE9wdGlvbnMoe1xuICAgICAgICAgICAgaHlicmlkOiBcIkh5YnJpZCAoa2V5d29yZCArIHZlY3RvcilcIixcbiAgICAgICAgICAgIHZlY3RvcjogXCJWZWN0b3IgKHNlbWFudGljKVwiLFxuICAgICAgICAgICAga2V5d29yZDogXCJLZXl3b3JkIChCTTI1KVwiLFxuICAgICAgICAgICAgZ3JhcGg6IFwiR3JhcGggKHJlbGF0aW9uc2hpcClcIixcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zZWFyY2hNb2RlKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNlYXJjaE1vZGUgPSB2YWx1ZSBhcyBNbmVtb1NldHRpbmdzW1wic2VhcmNoTW9kZVwiXTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBTdWdnZXN0TW9kYWwsIE5vdGljZSwgVEZpbGUgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIHsgTW5lbW9BcGlDbGllbnQsIE1uZW1vU2VhcmNoUmVzdWx0IH0gZnJvbSBcIi4vYXBpLWNsaWVudFwiO1xuaW1wb3J0IHR5cGUgeyBNbmVtb1NldHRpbmdzIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcblxuLy8gTW5lbW8gXHVBQzgwXHVDMEM5IFx1QkFBOFx1QjJFQyAvIFNlYXJjaCBtb2RhbCAoQ3RybCtTaGlmdCtNKVxuZXhwb3J0IGNsYXNzIE1uZW1vU2VhcmNoTW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8TW5lbW9TZWFyY2hSZXN1bHQ+IHtcbiAgcHJpdmF0ZSByZXN1bHRzOiBNbmVtb1NlYXJjaFJlc3VsdFtdID0gW107XG4gIHByaXZhdGUgZGVib3VuY2VUaW1lcjogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGFwaUNsaWVudDogTW5lbW9BcGlDbGllbnQsXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogTW5lbW9TZXR0aW5nc1xuICApIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJNbmVtbyBcdUFDODBcdUMwQzkuLi4gLyBTZWFyY2ggTW5lbW8uLi5cIik7XG4gIH1cblxuICBhc3luYyBnZXRTdWdnZXN0aW9ucyhxdWVyeTogc3RyaW5nKTogUHJvbWlzZTxNbmVtb1NlYXJjaFJlc3VsdFtdPiB7XG4gICAgaWYgKCFxdWVyeSB8fCBxdWVyeS5sZW5ndGggPCAyKSByZXR1cm4gW107XG5cbiAgICAvLyBcdUI1MTRcdUJDMTRcdUM2QjRcdUMyQTQgMzAwbXMgLyBEZWJvdW5jZSBpbnB1dFxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lcikgY2xlYXJUaW1lb3V0KHRoaXMuZGVib3VuY2VUaW1lcik7XG4gICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuc2VhcmNoKFxuICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgIHRoaXMuc2V0dGluZ3Muc2VhcmNoTW9kZSxcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLnNlYXJjaExpbWl0XG4gICAgICAgICk7XG4gICAgICAgIHJlc29sdmUodGhpcy5yZXN1bHRzKTtcbiAgICAgIH0sIDMwMCk7XG4gICAgfSk7XG4gIH1cblxuICByZW5kZXJTdWdnZXN0aW9uKHJlc3VsdDogTW5lbW9TZWFyY2hSZXN1bHQsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGVsLmNyZWF0ZURpdih7IGNsczogXCJtbmVtby1zZWFyY2gtcmVzdWx0XCIgfSk7XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHtcbiAgICAgIHRleHQ6IHJlc3VsdC50aXRsZSxcbiAgICAgIGNsczogXCJtbmVtby1yZXN1bHQtdGl0bGVcIixcbiAgICB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJzbWFsbFwiLCB7XG4gICAgICB0ZXh0OiByZXN1bHQuc25pcHBldCxcbiAgICAgIGNsczogXCJtbmVtby1yZXN1bHQtc25pcHBldFwiLFxuICAgIH0pO1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcInNwYW5cIiwge1xuICAgICAgdGV4dDogYHNjb3JlOiAke3Jlc3VsdC5zY29yZS50b0ZpeGVkKDMpfWAsXG4gICAgICBjbHM6IFwibW5lbW8tcmVzdWx0LXNjb3JlXCIsXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBvbkNob29zZVN1Z2dlc3Rpb24ocmVzdWx0OiBNbmVtb1NlYXJjaFJlc3VsdCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIFx1QkNGQ1x1RDJCOFx1QzVEMFx1QzExQyBcdUQ1NzRcdUIyRjkgXHVCMTc4XHVEMkI4IFx1QzVGNFx1QUUzMCAvIE9wZW4gbWF0Y2hpbmcgbm90ZSBpbiB2YXVsdFxuICAgIGxldCBwYXRoID0gcmVzdWx0LnBhdGggfHwgYCR7cmVzdWx0LnRpdGxlfS5tZGA7XG4gICAgaWYgKCFwYXRoLmVuZHNXaXRoKFwiLm1kXCIpKSBwYXRoICs9IFwiLm1kXCI7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcblxuICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUoZmlsZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ldyBOb3RpY2UoYFx1QjE3OFx1RDJCOFx1Qjk3QyBcdUNDM0VcdUM3NDQgXHVDMjE4IFx1QzVDNlx1QzJCNVx1QjJDOFx1QjJFNDogJHtyZXN1bHQudGl0bGV9XFxuTm90ZSBub3QgZm91bmQgaW4gdmF1bHQuYCk7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgSXRlbVZpZXcsIFdvcmtzcGFjZUxlYWYgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIHsgTW5lbW9BcGlDbGllbnQsIFN1YmdyYXBoTm9kZSwgU3ViZ3JhcGhFZGdlIH0gZnJvbSBcIi4vYXBpLWNsaWVudFwiO1xuXG5leHBvcnQgY29uc3QgTU5FTU9fR1JBUEhfVklFV19UWVBFID0gXCJtbmVtby1ncmFwaC12aWV3XCI7XG5cbi8vIFx1QzBDOVx1QzBDMSBcdUI5RjUgKGVudGl0eV90eXBlXHVCQ0M0KVxuY29uc3QgVFlQRV9DT0xPUlM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIGV2ZW50OiBcIiM0QTkwRDlcIixcbiAgcHJvamVjdDogXCIjRTg5MTNBXCIsXG4gIG5vdGU6IFwiIzUwQzg3OFwiLFxuICBzb3VyY2U6IFwiIzlCNTlCNlwiLFxuICBkZWNpc2lvbjogXCIjRTc0QzNDXCIsXG4gIGluc2lnaHQ6IFwiI0YxQzQwRlwiLFxufTtcbmNvbnN0IERFRkFVTFRfQ09MT1IgPSBcIiM4ODg4ODhcIjtcblxuaW50ZXJmYWNlIEdyYXBoTm9kZSB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzY29yZT86IG51bWJlcjtcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIHZ4OiBudW1iZXI7XG4gIHZ5OiBudW1iZXI7XG4gIHJhZGl1czogbnVtYmVyO1xuICBpc0NlbnRlcjogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIEdyYXBoRWRnZSB7XG4gIHNvdXJjZTogc3RyaW5nO1xuICB0YXJnZXQ6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgTW5lbW9HcmFwaFZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gIHByaXZhdGUgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgbm9kZXM6IEdyYXBoTm9kZVtdID0gW107XG4gIHByaXZhdGUgZWRnZXM6IEdyYXBoRWRnZVtdID0gW107XG4gIHByaXZhdGUgbm9kZU1hcDogTWFwPHN0cmluZywgR3JhcGhOb2RlPiA9IG5ldyBNYXAoKTtcblxuICAvLyBcdUNFNzRcdUJBNTRcdUI3N0NcbiAgcHJpdmF0ZSBvZmZzZXRYID0gMDtcbiAgcHJpdmF0ZSBvZmZzZXRZID0gMDtcbiAgcHJpdmF0ZSBzY2FsZSA9IDE7XG5cbiAgLy8gXHVDNzc4XHVEMTMwXHVCNzk5XHVDMTU4XG4gIHByaXZhdGUgZHJhZ05vZGU6IEdyYXBoTm9kZSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGlzUGFubmluZyA9IGZhbHNlO1xuICBwcml2YXRlIGxhc3RNb3VzZSA9IHsgeDogMCwgeTogMCB9O1xuICBwcml2YXRlIGhvdmVyZWROb2RlOiBHcmFwaE5vZGUgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBhbmltRnJhbWUgPSAwO1xuICBwcml2YXRlIHNpbVJ1bm5pbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBzaW1JdGVyYXRpb25zID0gMDtcblxuICBwcml2YXRlIGNlbnRlclBhdGggPSBcIlwiO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGxlYWY6IFdvcmtzcGFjZUxlYWYsXG4gICAgcHJpdmF0ZSBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50XG4gICkge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHsgcmV0dXJuIE1ORU1PX0dSQVBIX1ZJRVdfVFlQRTsgfVxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcgeyByZXR1cm4gXCJNbmVtbyBHcmFwaFwiOyB9XG4gIGdldEljb24oKTogc3RyaW5nIHsgcmV0dXJuIFwiZ2l0LWZvcmtcIjsgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdIGFzIEhUTUxFbGVtZW50O1xuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIGNvbnRhaW5lci5hZGRDbGFzcyhcIm1uZW1vLWdyYXBoLWNvbnRhaW5lclwiKTtcblxuICAgIC8vIFx1RDIzNFx1QkMxNFxuICAgIGNvbnN0IHRvb2xiYXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcIm1uZW1vLWdyYXBoLXRvb2xiYXJcIiB9KTtcbiAgICB0b29sYmFyLmNyZWF0ZUVsKFwic3BhblwiLCB7IHRleHQ6IFwiTW5lbW8gR3JhcGhcIiwgY2xzOiBcIm1uZW1vLWdyYXBoLXRpdGxlXCIgfSk7XG5cbiAgICBjb25zdCByZWZyZXNoQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyMUJCXCIsIGNsczogXCJtbmVtby1ncmFwaC1idG5cIiwgYXR0cjogeyB0aXRsZTogXCJSZWZyZXNoXCIgfSB9KTtcbiAgICByZWZyZXNoQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB0aGlzLmxvYWRHcmFwaCgpKTtcblxuICAgIGNvbnN0IGZpdEJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1MjJBMVwiLCBjbHM6IFwibW5lbW8tZ3JhcGgtYnRuXCIsIGF0dHI6IHsgdGl0bGU6IFwiRml0IHRvIHZpZXdcIiB9IH0pO1xuICAgIGZpdEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5maXRUb1ZpZXcoKSk7XG5cbiAgICAvLyBcdUNFOTRcdUJDODRcdUMyQTRcbiAgICB0aGlzLmNhbnZhcyA9IGNvbnRhaW5lci5jcmVhdGVFbChcImNhbnZhc1wiLCB7IGNsczogXCJtbmVtby1ncmFwaC1jYW52YXNcIiB9KTtcbiAgICB0aGlzLmN0eCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcblxuICAgIHRoaXMucmVzaXplQ2FudmFzKCk7XG4gICAgdGhpcy5yZWdpc3RlckRvbUV2ZW50KHdpbmRvdywgXCJyZXNpemVcIiwgKCkgPT4gdGhpcy5yZXNpemVDYW52YXMoKSk7XG4gICAgdGhpcy5zZXR1cEludGVyYWN0aW9uKCk7XG4gICAgdGhpcy5sb2FkR3JhcGgoKTtcbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuYW5pbUZyYW1lKSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLmFuaW1GcmFtZSk7XG4gIH1cblxuICAvLyBcdUQ2MDRcdUM3QUMgXHVCMTc4XHVEMkI4IFx1QUUzMFx1QzkwMCBcdUI4NUNcdUI0RENcbiAgYXN5bmMgbG9hZEdyYXBoKHBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIXBhdGgpIHtcbiAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgICAgcGF0aCA9IGZpbGUgPyBmaWxlLnBhdGggOiBcIlwiO1xuICAgIH1cbiAgICBpZiAoIXBhdGgpIHtcbiAgICAgIHRoaXMuZHJhd0VtcHR5KFwiT3BlbiBhIG5vdGUsIHRoZW4gcmVmcmVzaFwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gQVBJXHVCMjk0IC5tZCBcdUM1QzZcdUIyOTQgXHVBQ0JEXHVCODVDXHVCOTdDIFx1QzBBQ1x1QzZBOVx1RDU2MCBcdUMyMTggXHVDNzg4XHVDNzRDXG4gICAgdGhpcy5jZW50ZXJQYXRoID0gcGF0aDtcbiAgICBjb25zdCBhcGlQYXRoID0gcGF0aC5yZXBsYWNlKC9cXC5tZCQvLCBcIlwiKTtcblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmFwaUNsaWVudC5zdWJncmFwaChhcGlQYXRoLCAxKTtcbiAgICBpZiAoIWRhdGEgfHwgZGF0YS5ub2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuZHJhd0VtcHR5KFwiTm8gZ3JhcGggZGF0YSBmb3IgdGhpcyBub3RlXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFx1QjE3OFx1QjREQyBcdUMyMTggXHVDODFDXHVENTVDIChcdUMxMzFcdUIyQTUgXHUyMDE0IFx1Q0Q1Q1x1QjMwMCA4MFx1QjE3OFx1QjREQylcbiAgICBsZXQgbm9kZXMgPSBkYXRhLm5vZGVzO1xuICAgIGxldCBlZGdlcyA9IGRhdGEuZWRnZXM7XG4gICAgaWYgKG5vZGVzLmxlbmd0aCA+IDgwKSB7XG4gICAgICBjb25zdCBjZW50ZXJOb2RlID0gbm9kZXMuZmluZChuID0+IG4uaWQgPT09IHBhdGggfHwgbi5pZCA9PT0gcGF0aC5yZXBsYWNlKC9cXC5tZCQvLCBcIlwiKSk7XG4gICAgICBjb25zdCBrZWVwID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICBpZiAoY2VudGVyTm9kZSkga2VlcC5hZGQoY2VudGVyTm9kZS5pZCk7XG4gICAgICAvLyBzY29yZSBcdUIxOTJcdUM3NDAgXHVDMjFDXHVDNzNDXHVCODVDIDgwXHVBQzFDXG4gICAgICBjb25zdCBzb3J0ZWQgPSBbLi4ubm9kZXNdLnNvcnQoKGEsIGIpID0+IChiLnNjb3JlID8/IDApIC0gKGEuc2NvcmUgPz8gMCkpO1xuICAgICAgZm9yIChjb25zdCBuIG9mIHNvcnRlZCkge1xuICAgICAgICBpZiAoa2VlcC5zaXplID49IDgwKSBicmVhaztcbiAgICAgICAga2VlcC5hZGQobi5pZCk7XG4gICAgICB9XG4gICAgICBub2RlcyA9IG5vZGVzLmZpbHRlcihuID0+IGtlZXAuaGFzKG4uaWQpKTtcbiAgICAgIGVkZ2VzID0gZWRnZXMuZmlsdGVyKGUgPT4ga2VlcC5oYXMoZS5zb3VyY2UpICYmIGtlZXAuaGFzKGUudGFyZ2V0KSk7XG4gICAgfVxuXG4gICAgdGhpcy5idWlsZEdyYXBoKG5vZGVzLCBlZGdlcywgYXBpUGF0aCk7XG4gICAgdGhpcy5ydW5TaW11bGF0aW9uKCk7XG4gIH1cblxuICBzZXRDZW50ZXJQYXRoKHBhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubG9hZEdyYXBoKHBhdGgpO1xuICB9XG5cbiAgLy8gPT09PT0gXHVBREY4XHVCNzk4XHVENTA0IFx1QkU0Q1x1QjREQyA9PT09PVxuICBwcml2YXRlIGJ1aWxkR3JhcGgobm9kZXM6IFN1YmdyYXBoTm9kZVtdLCBlZGdlczogU3ViZ3JhcGhFZGdlW10sIGNlbnRlclBhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGg7XG4gICAgY29uc3QgaCA9IHRoaXMuY2FudmFzIS5oZWlnaHQ7XG4gICAgY29uc3QgY3ggPSB3IC8gMiwgY3kgPSBoIC8gMjtcblxuICAgIHRoaXMubm9kZXMgPSBub2Rlcy5tYXAoKG4pID0+ICh7XG4gICAgICBpZDogbi5pZCxcbiAgICAgIG5hbWU6IG4ubmFtZSxcbiAgICAgIHR5cGU6IG4udHlwZSxcbiAgICAgIHNjb3JlOiBuLnNjb3JlLFxuICAgICAgeDogbi5pZCA9PT0gY2VudGVyUGF0aCA/IGN4IDogY3ggKyAoTWF0aC5yYW5kb20oKSAtIDAuNSkgKiAzMDAsXG4gICAgICB5OiBuLmlkID09PSBjZW50ZXJQYXRoID8gY3kgOiBjeSArIChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDMwMCxcbiAgICAgIHZ4OiAwLFxuICAgICAgdnk6IDAsXG4gICAgICByYWRpdXM6IG4uaWQgPT09IGNlbnRlclBhdGggPyAxOCA6IDEyLFxuICAgICAgaXNDZW50ZXI6IG4uaWQgPT09IGNlbnRlclBhdGgsXG4gICAgfSkpO1xuXG4gICAgdGhpcy5lZGdlcyA9IGVkZ2VzO1xuICAgIHRoaXMubm9kZU1hcCA9IG5ldyBNYXAodGhpcy5ub2Rlcy5tYXAoKG4pID0+IFtuLmlkLCBuXSkpO1xuICAgIHRoaXMub2Zmc2V0WCA9IDA7XG4gICAgdGhpcy5vZmZzZXRZID0gMDtcbiAgICB0aGlzLnNjYWxlID0gMTtcbiAgfVxuXG4gIC8vID09PT09IEZvcmNlLWRpcmVjdGVkIFx1QzJEQ1x1QkJBQ1x1QjgwOFx1Qzc3NFx1QzE1OCA9PT09PVxuICBwcml2YXRlIHJ1blNpbXVsYXRpb24oKTogdm9pZCB7XG4gICAgdGhpcy5zaW1SdW5uaW5nID0gdHJ1ZTtcbiAgICB0aGlzLnNpbUl0ZXJhdGlvbnMgPSAwO1xuICAgIGNvbnN0IHRpY2sgPSAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2ltUnVubmluZykgcmV0dXJuO1xuICAgICAgdGhpcy5zaW1JdGVyYXRpb25zKys7XG4gICAgICB0aGlzLnNpbXVsYXRlU3RlcCgpO1xuICAgICAgdGhpcy5kcmF3KCk7XG4gICAgICBpZiAodGhpcy5zaW1JdGVyYXRpb25zIDwgMjAwKSB7XG4gICAgICAgIHRoaXMuYW5pbUZyYW1lID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZHJhdygpO1xuICAgICAgfVxuICAgIH07XG4gICAgdGhpcy5hbmltRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gIH1cblxuICBwcml2YXRlIHNpbXVsYXRlU3RlcCgpOiB2b2lkIHtcbiAgICBjb25zdCBhbHBoYSA9IE1hdGgubWF4KDAuMDEsIDEgLSB0aGlzLnNpbUl0ZXJhdGlvbnMgLyAyMDApO1xuICAgIGNvbnN0IG5vZGVzID0gdGhpcy5ub2RlcztcbiAgICBjb25zdCByZXB1bHNpb24gPSAzMDAwO1xuICAgIGNvbnN0IHNwcmluZ0xlbiA9IDEyMDtcbiAgICBjb25zdCBzcHJpbmdLID0gMC4wMjtcbiAgICBjb25zdCBjZW50ZXJHcmF2aXR5ID0gMC4wMTtcbiAgICBjb25zdCB3ID0gdGhpcy5jYW52YXMhLndpZHRoIC8gMjtcbiAgICBjb25zdCBoID0gdGhpcy5jYW52YXMhLmhlaWdodCAvIDI7XG5cbiAgICAvLyBSZXB1bHNpb24gKGFsbCBwYWlycylcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBub2Rlcy5sZW5ndGg7IGorKykge1xuICAgICAgICBjb25zdCBhID0gbm9kZXNbaV0sIGIgPSBub2Rlc1tqXTtcbiAgICAgICAgbGV0IGR4ID0gYi54IC0gYS54LCBkeSA9IGIueSAtIGEueTtcbiAgICAgICAgbGV0IGRpc3QgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpIHx8IDE7XG4gICAgICAgIGNvbnN0IGZvcmNlID0gcmVwdWxzaW9uIC8gKGRpc3QgKiBkaXN0KTtcbiAgICAgICAgY29uc3QgZnggPSAoZHggLyBkaXN0KSAqIGZvcmNlICogYWxwaGE7XG4gICAgICAgIGNvbnN0IGZ5ID0gKGR5IC8gZGlzdCkgKiBmb3JjZSAqIGFscGhhO1xuICAgICAgICBhLnZ4IC09IGZ4OyBhLnZ5IC09IGZ5O1xuICAgICAgICBiLnZ4ICs9IGZ4OyBiLnZ5ICs9IGZ5O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNwcmluZyAoZWRnZXMpXG4gICAgZm9yIChjb25zdCBlIG9mIHRoaXMuZWRnZXMpIHtcbiAgICAgIGNvbnN0IGEgPSB0aGlzLm5vZGVNYXAuZ2V0KGUuc291cmNlKTtcbiAgICAgIGNvbnN0IGIgPSB0aGlzLm5vZGVNYXAuZ2V0KGUudGFyZ2V0KTtcbiAgICAgIGlmICghYSB8fCAhYikgY29udGludWU7XG4gICAgICBsZXQgZHggPSBiLnggLSBhLngsIGR5ID0gYi55IC0gYS55O1xuICAgICAgbGV0IGRpc3QgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpIHx8IDE7XG4gICAgICBjb25zdCBmb3JjZSA9IChkaXN0IC0gc3ByaW5nTGVuKSAqIHNwcmluZ0sgKiBhbHBoYTtcbiAgICAgIGNvbnN0IGZ4ID0gKGR4IC8gZGlzdCkgKiBmb3JjZTtcbiAgICAgIGNvbnN0IGZ5ID0gKGR5IC8gZGlzdCkgKiBmb3JjZTtcbiAgICAgIGEudnggKz0gZng7IGEudnkgKz0gZnk7XG4gICAgICBiLnZ4IC09IGZ4OyBiLnZ5IC09IGZ5O1xuICAgIH1cblxuICAgIC8vIENlbnRlciBncmF2aXR5XG4gICAgZm9yIChjb25zdCBuIG9mIG5vZGVzKSB7XG4gICAgICBuLnZ4ICs9ICh3IC0gbi54KSAqIGNlbnRlckdyYXZpdHkgKiBhbHBoYTtcbiAgICAgIG4udnkgKz0gKGggLSBuLnkpICogY2VudGVyR3Jhdml0eSAqIGFscGhhO1xuICAgICAgLy8gRGFtcGluZ1xuICAgICAgbi52eCAqPSAwLjg1O1xuICAgICAgbi52eSAqPSAwLjg1O1xuICAgICAgaWYgKCFuLmlzQ2VudGVyIHx8IHRoaXMuc2ltSXRlcmF0aW9ucyA+IDUpIHtcbiAgICAgICAgbi54ICs9IG4udng7XG4gICAgICAgIG4ueSArPSBuLnZ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vID09PT09IFx1QjgwQ1x1QjM1NFx1QjlDMSA9PT09PVxuICBwcml2YXRlIGRyYXcoKTogdm9pZCB7XG4gICAgY29uc3QgY3R4ID0gdGhpcy5jdHghO1xuICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuY2FudmFzITtcbiAgICBjdHguY2xlYXJSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgY3R4LnNhdmUoKTtcbiAgICBjdHgudHJhbnNsYXRlKHRoaXMub2Zmc2V0WCwgdGhpcy5vZmZzZXRZKTtcbiAgICBjdHguc2NhbGUodGhpcy5zY2FsZSwgdGhpcy5zY2FsZSk7XG5cbiAgICAvLyBcdUM1RTNcdUM5QzBcbiAgICBmb3IgKGNvbnN0IGUgb2YgdGhpcy5lZGdlcykge1xuICAgICAgY29uc3QgYSA9IHRoaXMubm9kZU1hcC5nZXQoZS5zb3VyY2UpO1xuICAgICAgY29uc3QgYiA9IHRoaXMubm9kZU1hcC5nZXQoZS50YXJnZXQpO1xuICAgICAgaWYgKCFhIHx8ICFiKSBjb250aW51ZTtcblxuICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgY3R4Lm1vdmVUbyhhLngsIGEueSk7XG4gICAgICBjdHgubGluZVRvKGIueCwgYi55KTtcbiAgICAgIGN0eC5zdHJva2VTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjIpXCIgOiBcInJnYmEoMCwwLDAsMC4xNSlcIjtcbiAgICAgIGN0eC5saW5lV2lkdGggPSAxLjU7XG5cbiAgICAgIGlmIChlLnR5cGUgPT09IFwicmVsYXRlZFwiKSB7XG4gICAgICAgIGN0eC5zZXRMaW5lRGFzaChbNiwgNF0pO1xuICAgICAgfSBlbHNlIGlmIChlLnR5cGUgPT09IFwidGFnX3NoYXJlZFwiKSB7XG4gICAgICAgIGN0eC5zZXRMaW5lRGFzaChbMywgNV0pO1xuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMjU1LDI1NSwyNTUsMC4xKVwiIDogXCJyZ2JhKDAsMCwwLDAuMDgpXCI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjdHguc2V0TGluZURhc2goW10pO1xuICAgICAgfVxuICAgICAgY3R4LnN0cm9rZSgpO1xuICAgICAgY3R4LnNldExpbmVEYXNoKFtdKTtcbiAgICB9XG5cbiAgICAvLyBcdUIxNzhcdUI0RENcbiAgICBmb3IgKGNvbnN0IG4gb2YgdGhpcy5ub2Rlcykge1xuICAgICAgY29uc3QgY29sb3IgPSBUWVBFX0NPTE9SU1tuLnR5cGVdIHx8IERFRkFVTFRfQ09MT1I7XG4gICAgICBjb25zdCBpc0hvdmVyZWQgPSB0aGlzLmhvdmVyZWROb2RlID09PSBuO1xuXG4gICAgICAvLyBHbG93IGZvciBjZW50ZXJcbiAgICAgIGlmIChuLmlzQ2VudGVyKSB7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgY3R4LmFyYyhuLngsIG4ueSwgbi5yYWRpdXMgKyA2LCAwLCBNYXRoLlBJICogMik7XG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSBjb2xvciArIFwiMzNcIjtcbiAgICAgICAgY3R4LmZpbGwoKTtcbiAgICAgIH1cblxuICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgY3R4LmFyYyhuLngsIG4ueSwgbi5yYWRpdXMgKyAoaXNIb3ZlcmVkID8gMyA6IDApLCAwLCBNYXRoLlBJICogMik7XG4gICAgICBjdHguZmlsbFN0eWxlID0gY29sb3I7XG4gICAgICBjdHguZmlsbCgpO1xuICAgICAgY3R4LnN0cm9rZVN0eWxlID0gaXNIb3ZlcmVkID8gXCIjZmZmZmZmXCIgOiAodGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDI1NSwyNTUsMjU1LDAuMylcIiA6IFwicmdiYSgwLDAsMCwwLjIpXCIpO1xuICAgICAgY3R4LmxpbmVXaWR0aCA9IGlzSG92ZXJlZCA/IDIuNSA6IDE7XG4gICAgICBjdHguc3Ryb2tlKCk7XG5cbiAgICAgIC8vIExhYmVsXG4gICAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCIjZTBlMGUwXCIgOiBcIiMzMzMzMzNcIjtcbiAgICAgIGN0eC5mb250ID0gbi5pc0NlbnRlciA/IFwiYm9sZCAxMXB4IHNhbnMtc2VyaWZcIiA6IFwiMTBweCBzYW5zLXNlcmlmXCI7XG4gICAgICBjdHgudGV4dEFsaWduID0gXCJjZW50ZXJcIjtcbiAgICAgIGNvbnN0IGxhYmVsID0gbi5uYW1lLmxlbmd0aCA+IDIwID8gbi5uYW1lLnNsaWNlKDAsIDE4KSArIFwiXHUyMDI2XCIgOiBuLm5hbWU7XG4gICAgICBjdHguZmlsbFRleHQobGFiZWwsIG4ueCwgbi55ICsgbi5yYWRpdXMgKyAxNCk7XG4gICAgfVxuXG4gICAgY3R4LnJlc3RvcmUoKTtcblxuICAgIC8vIFx1RDIzNFx1RDMwMVxuICAgIGlmICh0aGlzLmhvdmVyZWROb2RlKSB7XG4gICAgICB0aGlzLmRyYXdUb29sdGlwKHRoaXMuaG92ZXJlZE5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZHJhd1Rvb2x0aXAobjogR3JhcGhOb2RlKTogdm9pZCB7XG4gICAgY29uc3QgY3R4ID0gdGhpcy5jdHghO1xuICAgIGNvbnN0IHN4ID0gbi54ICogdGhpcy5zY2FsZSArIHRoaXMub2Zmc2V0WDtcbiAgICBjb25zdCBzeSA9IG4ueSAqIHRoaXMuc2NhbGUgKyB0aGlzLm9mZnNldFkgLSBuLnJhZGl1cyAqIHRoaXMuc2NhbGUgLSAxMDtcblxuICAgIGNvbnN0IGxpbmVzID0gW24ubmFtZSwgYFR5cGU6ICR7bi50eXBlfWBdO1xuICAgIGlmIChuLnNjb3JlICE9IG51bGwpIGxpbmVzLnB1c2goYFNjb3JlOiAke24uc2NvcmUudG9GaXhlZCgzKX1gKTtcblxuICAgIGN0eC5mb250ID0gXCIxMXB4IHNhbnMtc2VyaWZcIjtcbiAgICBjb25zdCBtYXhXID0gTWF0aC5tYXgoLi4ubGluZXMubWFwKChsKSA9PiBjdHgubWVhc3VyZVRleHQobCkud2lkdGgpKSArIDE2O1xuICAgIGNvbnN0IGggPSBsaW5lcy5sZW5ndGggKiAxNiArIDEwO1xuXG4gICAgY29uc3QgdHggPSBzeCAtIG1heFcgLyAyO1xuICAgIGNvbnN0IHR5ID0gc3kgLSBoO1xuXG4gICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgzMCwzMCwzMCwwLjk1KVwiIDogXCJyZ2JhKDI1NSwyNTUsMjU1LDAuOTUpXCI7XG4gICAgY3R4LnN0cm9rZVN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDI1NSwyNTUsMjU1LDAuMilcIiA6IFwicmdiYSgwLDAsMCwwLjE1KVwiO1xuICAgIGN0eC5saW5lV2lkdGggPSAxO1xuICAgIHRoaXMucm91bmRSZWN0KGN0eCwgdHgsIHR5LCBtYXhXLCBoLCA2KTtcbiAgICBjdHguZmlsbCgpO1xuICAgIGN0eC5zdHJva2UoKTtcblxuICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcIiNlMGUwZTBcIiA6IFwiIzMzMzMzM1wiO1xuICAgIGN0eC50ZXh0QWxpZ24gPSBcImxlZnRcIjtcbiAgICBsaW5lcy5mb3JFYWNoKChsaW5lLCBpKSA9PiB7XG4gICAgICBjdHguZmlsbFRleHQobGluZSwgdHggKyA4LCB0eSArIDE2ICsgaSAqIDE2KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcm91bmRSZWN0KGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELCB4OiBudW1iZXIsIHk6IG51bWJlciwgdzogbnVtYmVyLCBoOiBudW1iZXIsIHI6IG51bWJlcik6IHZvaWQge1xuICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICBjdHgubW92ZVRvKHggKyByLCB5KTtcbiAgICBjdHgubGluZVRvKHggKyB3IC0gciwgeSk7XG4gICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCArIHcsIHksIHggKyB3LCB5ICsgcik7XG4gICAgY3R4LmxpbmVUbyh4ICsgdywgeSArIGggLSByKTtcbiAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4ICsgdywgeSArIGgsIHggKyB3IC0gciwgeSArIGgpO1xuICAgIGN0eC5saW5lVG8oeCArIHIsIHkgKyBoKTtcbiAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4LCB5ICsgaCwgeCwgeSArIGggLSByKTtcbiAgICBjdHgubGluZVRvKHgsIHkgKyByKTtcbiAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4LCB5LCB4ICsgciwgeSk7XG4gICAgY3R4LmNsb3NlUGF0aCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBkcmF3RW1wdHkobXNnOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBjdHggPSB0aGlzLmN0eCE7XG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5jYW52YXMhO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCIjOTk5XCIgOiBcIiM2NjZcIjtcbiAgICBjdHguZm9udCA9IFwiMTRweCBzYW5zLXNlcmlmXCI7XG4gICAgY3R4LnRleHRBbGlnbiA9IFwiY2VudGVyXCI7XG4gICAgY3R4LmZpbGxUZXh0KG1zZywgY2FudmFzLndpZHRoIC8gMiwgY2FudmFzLmhlaWdodCAvIDIpO1xuICB9XG5cbiAgLy8gPT09PT0gXHVDNzc4XHVEMTMwXHVCNzk5XHVDMTU4ID09PT09XG4gIHByaXZhdGUgc2V0dXBJbnRlcmFjdGlvbigpOiB2b2lkIHtcbiAgICBjb25zdCBjID0gdGhpcy5jYW52YXMhO1xuXG4gICAgYy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIChlKSA9PiB7XG4gICAgICBjb25zdCBub2RlID0gdGhpcy5oaXRUZXN0KGUub2Zmc2V0WCwgZS5vZmZzZXRZKTtcbiAgICAgIGlmIChub2RlKSB7XG4gICAgICAgIHRoaXMuZHJhZ05vZGUgPSBub2RlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5pc1Bhbm5pbmcgPSB0cnVlO1xuICAgICAgfVxuICAgICAgdGhpcy5sYXN0TW91c2UgPSB7IHg6IGUub2Zmc2V0WCwgeTogZS5vZmZzZXRZIH07XG4gICAgfSk7XG5cbiAgICBjLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgKGUpID0+IHtcbiAgICAgIGNvbnN0IGR4ID0gZS5vZmZzZXRYIC0gdGhpcy5sYXN0TW91c2UueDtcbiAgICAgIGNvbnN0IGR5ID0gZS5vZmZzZXRZIC0gdGhpcy5sYXN0TW91c2UueTtcblxuICAgICAgaWYgKHRoaXMuZHJhZ05vZGUpIHtcbiAgICAgICAgdGhpcy5kcmFnTm9kZS54ICs9IGR4IC8gdGhpcy5zY2FsZTtcbiAgICAgICAgdGhpcy5kcmFnTm9kZS55ICs9IGR5IC8gdGhpcy5zY2FsZTtcbiAgICAgICAgdGhpcy5kcmFnTm9kZS52eCA9IDA7XG4gICAgICAgIHRoaXMuZHJhZ05vZGUudnkgPSAwO1xuICAgICAgICBpZiAoIXRoaXMuc2ltUnVubmluZykgdGhpcy5kcmF3KCk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNQYW5uaW5nKSB7XG4gICAgICAgIHRoaXMub2Zmc2V0WCArPSBkeDtcbiAgICAgICAgdGhpcy5vZmZzZXRZICs9IGR5O1xuICAgICAgICBpZiAoIXRoaXMuc2ltUnVubmluZykgdGhpcy5kcmF3KCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBwcmV2ID0gdGhpcy5ob3ZlcmVkTm9kZTtcbiAgICAgICAgdGhpcy5ob3ZlcmVkTm9kZSA9IHRoaXMuaGl0VGVzdChlLm9mZnNldFgsIGUub2Zmc2V0WSk7XG4gICAgICAgIGMuc3R5bGUuY3Vyc29yID0gdGhpcy5ob3ZlcmVkTm9kZSA/IFwicG9pbnRlclwiIDogXCJkZWZhdWx0XCI7XG4gICAgICAgIGlmIChwcmV2ICE9PSB0aGlzLmhvdmVyZWROb2RlICYmICF0aGlzLnNpbVJ1bm5pbmcpIHRoaXMuZHJhdygpO1xuICAgICAgfVxuICAgICAgdGhpcy5sYXN0TW91c2UgPSB7IHg6IGUub2Zmc2V0WCwgeTogZS5vZmZzZXRZIH07XG4gICAgfSk7XG5cbiAgICBjLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsIChlKSA9PiB7XG4gICAgICBpZiAodGhpcy5kcmFnTm9kZSkge1xuICAgICAgICAvLyBcdUQwNzRcdUI5QUQgKFx1QjREQ1x1Qjc5OFx1QURGOCBcdUM1NDRcdUIyRDgpIFx1MjE5MiBcdUIxNzhcdUQyQjggXHVDNUY0XHVBRTMwXG4gICAgICAgIGNvbnN0IGR4ID0gTWF0aC5hYnMoZS5vZmZzZXRYIC0gdGhpcy5sYXN0TW91c2UueCk7XG4gICAgICAgIGNvbnN0IGR5ID0gTWF0aC5hYnMoZS5vZmZzZXRZIC0gdGhpcy5sYXN0TW91c2UueSk7XG4gICAgICAgIGlmIChkeCA8IDMgJiYgZHkgPCAzKSB7XG4gICAgICAgICAgdGhpcy5vcGVuTm90ZSh0aGlzLmRyYWdOb2RlLmlkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5kcmFnTm9kZSA9IG51bGw7XG4gICAgICB0aGlzLmlzUGFubmluZyA9IGZhbHNlO1xuICAgIH0pO1xuXG4gICAgYy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmhpdFRlc3QoZS5vZmZzZXRYLCBlLm9mZnNldFkpO1xuICAgICAgaWYgKG5vZGUpIHtcbiAgICAgICAgdGhpcy5vcGVuTm90ZShub2RlLmlkKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGMuYWRkRXZlbnRMaXN0ZW5lcihcIndoZWVsXCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBjb25zdCB6b29tID0gZS5kZWx0YVkgPCAwID8gMS4xIDogMC45O1xuICAgICAgY29uc3QgbXggPSBlLm9mZnNldFgsIG15ID0gZS5vZmZzZXRZO1xuICAgICAgdGhpcy5vZmZzZXRYID0gbXggLSB6b29tICogKG14IC0gdGhpcy5vZmZzZXRYKTtcbiAgICAgIHRoaXMub2Zmc2V0WSA9IG15IC0gem9vbSAqIChteSAtIHRoaXMub2Zmc2V0WSk7XG4gICAgICB0aGlzLnNjYWxlICo9IHpvb207XG4gICAgICB0aGlzLnNjYWxlID0gTWF0aC5tYXgoMC4yLCBNYXRoLm1pbig1LCB0aGlzLnNjYWxlKSk7XG4gICAgICBpZiAoIXRoaXMuc2ltUnVubmluZykgdGhpcy5kcmF3KCk7XG4gICAgfSwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcbiAgfVxuXG4gIHByaXZhdGUgaGl0VGVzdChteDogbnVtYmVyLCBteTogbnVtYmVyKTogR3JhcGhOb2RlIHwgbnVsbCB7XG4gICAgY29uc3QgeCA9IChteCAtIHRoaXMub2Zmc2V0WCkgLyB0aGlzLnNjYWxlO1xuICAgIGNvbnN0IHkgPSAobXkgLSB0aGlzLm9mZnNldFkpIC8gdGhpcy5zY2FsZTtcbiAgICAvLyBSZXZlcnNlIG9yZGVyIHNvIHRvcC1kcmF3biBub2RlcyBhcmUgaGl0IGZpcnN0XG4gICAgZm9yIChsZXQgaSA9IHRoaXMubm9kZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IG4gPSB0aGlzLm5vZGVzW2ldO1xuICAgICAgY29uc3QgZHggPSB4IC0gbi54LCBkeSA9IHkgLSBuLnk7XG4gICAgICBpZiAoZHggKiBkeCArIGR5ICogZHkgPD0gKG4ucmFkaXVzICsgNCkgKiAobi5yYWRpdXMgKyA0KSkgcmV0dXJuIG47XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBvcGVuTm90ZShpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gaWRcdUIyOTQgXHVEMzBDXHVDNzdDIFx1QUNCRFx1Qjg1QyAoXHVDNjA4OiBcImZvbGRlci9ub3RlLm1kXCIpXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChpZCk7XG4gICAgaWYgKGZpbGUpIHtcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoaWQsIFwiXCIsIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZml0VG9WaWV3KCk6IHZvaWQge1xuICAgIGlmICh0aGlzLm5vZGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgIGxldCBtaW5YID0gSW5maW5pdHksIG1heFggPSAtSW5maW5pdHksIG1pblkgPSBJbmZpbml0eSwgbWF4WSA9IC1JbmZpbml0eTtcbiAgICBmb3IgKGNvbnN0IG4gb2YgdGhpcy5ub2Rlcykge1xuICAgICAgbWluWCA9IE1hdGgubWluKG1pblgsIG4ueCAtIG4ucmFkaXVzKTtcbiAgICAgIG1heFggPSBNYXRoLm1heChtYXhYLCBuLnggKyBuLnJhZGl1cyk7XG4gICAgICBtaW5ZID0gTWF0aC5taW4obWluWSwgbi55IC0gbi5yYWRpdXMpO1xuICAgICAgbWF4WSA9IE1hdGgubWF4KG1heFksIG4ueSArIG4ucmFkaXVzKTtcbiAgICB9XG4gICAgY29uc3QgcGFkID0gNDA7XG4gICAgY29uc3QgdyA9IHRoaXMuY2FudmFzIS53aWR0aDtcbiAgICBjb25zdCBoID0gdGhpcy5jYW52YXMhLmhlaWdodDtcbiAgICBjb25zdCBndyA9IG1heFggLSBtaW5YICsgcGFkICogMjtcbiAgICBjb25zdCBnaCA9IG1heFkgLSBtaW5ZICsgcGFkICogMjtcbiAgICB0aGlzLnNjYWxlID0gTWF0aC5taW4odyAvIGd3LCBoIC8gZ2gsIDIpO1xuICAgIHRoaXMub2Zmc2V0WCA9IHcgLyAyIC0gKChtaW5YICsgbWF4WCkgLyAyKSAqIHRoaXMuc2NhbGU7XG4gICAgdGhpcy5vZmZzZXRZID0gaCAvIDIgLSAoKG1pblkgKyBtYXhZKSAvIDIpICogdGhpcy5zY2FsZTtcbiAgICB0aGlzLmRyYXcoKTtcbiAgfVxuXG4gIC8vID09PT09IFx1QzcyMFx1RDJGOCA9PT09PVxuICBwcml2YXRlIHJlc2l6ZUNhbnZhcygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY2FudmFzKSByZXR1cm47XG4gICAgY29uc3QgcmVjdCA9IHRoaXMuY2FudmFzLnBhcmVudEVsZW1lbnQhLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHRoaXMuY2FudmFzLndpZHRoID0gcmVjdC53aWR0aDtcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSByZWN0LmhlaWdodDtcbiAgICBpZiAoIXRoaXMuc2ltUnVubmluZykgdGhpcy5kcmF3KCk7XG4gIH1cblxuICBwcml2YXRlIGlzRGFya1RoZW1lKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5jb250YWlucyhcInRoZW1lLWRhcmtcIik7XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG1CQUErQjs7O0FDQS9CLHNCQUEyQjtBQWlDcEIsSUFBTSxpQkFBTixNQUFxQjtBQUFBLEVBQzFCLFlBQW9CLFNBQWlCO0FBQWpCO0FBQUEsRUFBa0I7QUFBQSxFQUV0QyxXQUFXLEtBQW1CO0FBQzVCLFNBQUssVUFBVSxJQUFJLFFBQVEsUUFBUSxFQUFFO0FBQUEsRUFDdkM7QUFBQTtBQUFBLEVBR0EsTUFBTSxPQUNKLE9BQ0EsT0FBZSxVQUNm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Z0JBQStCO0FBQzNDLFVBQU0sV0FBVyxLQUFLLElBQUksVUFBVSxnQkFBZ0IscUJBQXFCO0FBQ3pFLFFBQUk7QUFDSixRQUFJLFNBQVMsU0FBUyxHQUFHO0FBQ3ZCLGFBQU8sU0FBUyxDQUFDO0FBQUEsSUFDbkIsT0FBTztBQUNMLGFBQU8sS0FBSyxJQUFJLFVBQVUsYUFBYSxLQUFLO0FBQzVDLFlBQU0sS0FBSyxhQUFhLEVBQUUsTUFBTSx1QkFBdUIsUUFBUSxLQUFLLENBQUM7QUFBQSxJQUN2RTtBQUNBLFNBQUssSUFBSSxVQUFVLFdBQVcsSUFBSTtBQUdsQyxVQUFNLE9BQU8sS0FBSyxJQUFJLFVBQVUsY0FBYztBQUM5QyxRQUFJLE1BQU07QUFDUixZQUFNLE9BQU8sS0FBSztBQUNsQixXQUFLLGNBQWMsS0FBSyxJQUFJO0FBQUEsSUFDOUI7QUFBQSxFQUNGO0FBQ0Y7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiJdCn0K
