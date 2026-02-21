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
    const data = await this.apiClient.subgraph(path, 2);
    if (!data || data.nodes.length === 0) {
      this.drawEmpty("No graph data for this note");
      return;
    }
    this.buildGraph(data.nodes, data.edges, path);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2FwaS1jbGllbnQudHMiLCAic3JjL3NldHRpbmdzLnRzIiwgInNyYy9zZWFyY2gtbW9kYWwudHMiLCAic3JjL2dyYXBoLXZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IFBsdWdpbiwgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBNbmVtb0FwaUNsaWVudCB9IGZyb20gXCIuL2FwaS1jbGllbnRcIjtcbmltcG9ydCB7IE1uZW1vU2V0dGluZ3MsIE1uZW1vU2V0dGluZ1RhYiwgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBNbmVtb1NlYXJjaE1vZGFsIH0gZnJvbSBcIi4vc2VhcmNoLW1vZGFsXCI7XG5pbXBvcnQgeyBNbmVtb0dyYXBoVmlldywgTU5FTU9fR1JBUEhfVklFV19UWVBFIH0gZnJvbSBcIi4vZ3JhcGgtdmlld1wiO1xuXG4vLyBNbmVtbyBTZWNvbmRCcmFpbiBPYnNpZGlhbiBQbHVnaW5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1uZW1vUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IE1uZW1vU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuICBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50ID0gbmV3IE1uZW1vQXBpQ2xpZW50KERFRkFVTFRfU0VUVElOR1MuYXBpVXJsKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFwaUNsaWVudC5zZXRCYXNlVXJsKHRoaXMuc2V0dGluZ3MuYXBpVXJsKTtcblxuICAgIC8vIFx1QzEyNFx1QzgxNSBcdUQwRUQgXHVCNEYxXHVCODVEIC8gUmVnaXN0ZXIgc2V0dGluZ3MgdGFiXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNbmVtb1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIC8vIFx1QjlBQ1x1QkNGOCBcdUM1NDRcdUM3NzRcdUNGNTggLyBSaWJib24gaWNvblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcImJyYWluXCIsIFwiTW5lbW8gU2VhcmNoXCIsICgpID0+IHtcbiAgICAgIG5ldyBNbmVtb1NlYXJjaE1vZGFsKHRoaXMuYXBwLCB0aGlzLmFwaUNsaWVudCwgdGhpcy5zZXR0aW5ncykub3BlbigpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBQzgwXHVDMEM5IFx1Q0VFNFx1QjlFOFx1QjREQyAoQ3RybCtTaGlmdCtNKSAvIFNlYXJjaCBjb21tYW5kXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLXNlYXJjaFwiLFxuICAgICAgbmFtZTogXCJTZWFyY2ggTW5lbW9cIixcbiAgICAgIGhvdGtleXM6IFt7IG1vZGlmaWVyczogW1wiQ3RybFwiLCBcIlNoaWZ0XCJdLCBrZXk6IFwibVwiIH1dLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgbmV3IE1uZW1vU2VhcmNoTW9kYWwodGhpcy5hcHAsIHRoaXMuYXBpQ2xpZW50LCB0aGlzLnNldHRpbmdzKS5vcGVuKCk7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gXHVBREY4XHVCNzk4XHVENTA0IFx1QkRGMCBcdUI0RjFcdUI4NUQgLyBSZWdpc3RlciBncmFwaCB2aWV3XG4gICAgdGhpcy5yZWdpc3RlclZpZXcoXG4gICAgICBNTkVNT19HUkFQSF9WSUVXX1RZUEUsXG4gICAgICAobGVhZikgPT4gbmV3IE1uZW1vR3JhcGhWaWV3KGxlYWYsIHRoaXMuYXBpQ2xpZW50KVxuICAgICk7XG5cbiAgICAvLyBcdUFERjhcdUI3OThcdUQ1MDQgXHVCREYwIFx1QjlBQ1x1QkNGOCBcdUM1NDRcdUM3NzRcdUNGNThcbiAgICB0aGlzLmFkZFJpYmJvbkljb24oXCJnaXQtZm9ya1wiLCBcIk1uZW1vIEdyYXBoXCIsICgpID0+IHtcbiAgICAgIHRoaXMub3BlbkdyYXBoVmlldygpO1xuICAgIH0pO1xuXG4gICAgLy8gXHVBREY4XHVCNzk4XHVENTA0IFx1QkRGMCBcdUM1RjRcdUFFMzAgXHVDRUU0XHVCOUU4XHVCNERDXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1uZW1vLW9wZW4tZ3JhcGhcIixcbiAgICAgIG5hbWU6IFwiTW5lbW86IE9wZW4gR3JhcGggVmlld1wiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHRoaXMub3BlbkdyYXBoVmlldygpLFxuICAgIH0pO1xuXG4gICAgLy8gXHVDMTFDXHVCQzg0IFx1QzBDMVx1RDBEQyBcdUQ2NTVcdUM3NzggLyBDaGVjayBzZXJ2ZXIgb24gbG9hZFxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJtbmVtby1jaGVjay1zdGF0dXNcIixcbiAgICAgIG5hbWU6IFwiQ2hlY2sgTW5lbW8gU2VydmVyIFN0YXR1c1wiLFxuICAgICAgY2FsbGJhY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLmFwaUNsaWVudC5zdGF0cygpO1xuICAgICAgICBpZiAoc3RhdHMpIHtcbiAgICAgICAgICBuZXcgTm90aWNlKGBNbmVtbzogJHtzdGF0cy50b3RhbF9ub3Rlc30gbm90ZXMsICR7c3RhdHMudG90YWxfZWRnZXN9IGVkZ2VzYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3IE5vdGljZShcIk1uZW1vOiBcdUMxMUNcdUJDODRcdUM1RDAgXHVDNUYwXHVBQ0IwXHVENTYwIFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQgLyBTZXJ2ZXIgdW5yZWFjaGFibGVcIik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZyhcIk1uZW1vIFNlY29uZEJyYWluIHBsdWdpbiBsb2FkZWRcIik7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZyhcIk1uZW1vIFNlY29uZEJyYWluIHBsdWdpbiB1bmxvYWRlZFwiKTtcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBvcGVuR3JhcGhWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShNTkVNT19HUkFQSF9WSUVXX1RZUEUpO1xuICAgIGxldCBsZWFmOiBpbXBvcnQoXCJvYnNpZGlhblwiKS5Xb3Jrc3BhY2VMZWFmO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICBsZWFmID0gZXhpc3RpbmdbMF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKSE7XG4gICAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IE1ORU1PX0dSQVBIX1ZJRVdfVFlQRSwgYWN0aXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcblxuICAgIC8vIFx1RDYwNFx1QzdBQyBcdUIxNzhcdUQyQjggXHVBRTMwXHVDOTAwXHVDNzNDXHVCODVDIFx1QURGOFx1Qjc5OFx1RDUwNCBcdUI4NUNcdUI0RENcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICBpZiAoZmlsZSkge1xuICAgICAgY29uc3QgdmlldyA9IGxlYWYudmlldyBhcyBNbmVtb0dyYXBoVmlldztcbiAgICAgIHZpZXcuc2V0Q2VudGVyUGF0aChmaWxlLnBhdGgpO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IHJlcXVlc3RVcmwgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuLy8gTW5lbW8gQVBJIFx1QUM4MFx1QzBDOSBcdUFDQjBcdUFDRkMgXHVEMEMwXHVDNzg1IC8gU2VhcmNoIHJlc3VsdCB0eXBlXG5leHBvcnQgaW50ZXJmYWNlIE1uZW1vU2VhcmNoUmVzdWx0IHtcbiAgbmFtZTogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBzbmlwcGV0OiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG4gIGVudGl0eV90eXBlPzogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIHBhdGg/OiBzdHJpbmc7XG59XG5cbi8vIE1uZW1vIFx1QzExQ1x1QkM4NCBcdUQxQjVcdUFDQzQgLyBTZXJ2ZXIgc3RhdHNcbmV4cG9ydCBpbnRlcmZhY2UgTW5lbW9TdGF0cyB7XG4gIHRvdGFsX25vdGVzOiBudW1iZXI7XG4gIHRvdGFsX2VkZ2VzOiBudW1iZXI7XG4gIGluZGV4X3N0YXR1czogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN1YmdyYXBoTm9kZSB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzY29yZT86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdWJncmFwaEVkZ2Uge1xuICBzb3VyY2U6IHN0cmluZztcbiAgdGFyZ2V0OiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1uZW1vQXBpQ2xpZW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmcpIHt9XG5cbiAgc2V0QmFzZVVybCh1cmw6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuYmFzZVVybCA9IHVybC5yZXBsYWNlKC9cXC8rJC8sIFwiXCIpO1xuICB9XG5cbiAgLy8gXHVBQzgwXHVDMEM5IEFQSSBcdUQ2MzhcdUNEOUMgLyBDYWxsIHNlYXJjaCBBUElcbiAgYXN5bmMgc2VhcmNoKFxuICAgIHF1ZXJ5OiBzdHJpbmcsXG4gICAgbW9kZTogc3RyaW5nID0gXCJoeWJyaWRcIixcbiAgICBsaW1pdDogbnVtYmVyID0gMTBcbiAgKTogUHJvbWlzZTxNbmVtb1NlYXJjaFJlc3VsdFtdPiB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7IHE6IHF1ZXJ5LCBtb2RlLCBsaW1pdDogU3RyaW5nKGxpbWl0KSB9KTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L3NlYXJjaD8ke3BhcmFtc31gO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgY29uc3QgZGF0YSA9IHJlc3BvbnNlLmpzb247XG4gICAgICBjb25zdCByZXN1bHRzID0gKGRhdGEucmVzdWx0cyA/PyBkYXRhKSBhcyBhbnlbXTtcbiAgICAgIHJldHVybiByZXN1bHRzLm1hcCgocjogYW55KSA9PiAoe1xuICAgICAgICAuLi5yLFxuICAgICAgICB0aXRsZTogci50aXRsZSB8fCByLm5hbWUgfHwgci5rZXkgfHwgXCJVbnRpdGxlZFwiLFxuICAgICAgfSkpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1QzExQ1x1QkM4NCBcdUMwQzFcdUQwREMgXHVENjU1XHVDNzc4IC8gQ2hlY2sgc2VydmVyIHN0YXRzXG4gIGFzeW5jIHN0YXRzKCk6IFByb21pc2U8TW5lbW9TdGF0cyB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgICAgdXJsOiBgJHt0aGlzLmJhc2VVcmx9L3N0YXRzYCxcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzcG9uc2UuanNvbiBhcyBNbmVtb1N0YXRzO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVDMTFDXHVCRTBDXHVBREY4XHVCNzk4XHVENTA0IFx1Qzg3MFx1RDY4QyAvIEdldCBzdWJncmFwaCBmb3IgdmlzdWFsaXphdGlvblxuICBhc3luYyBzdWJncmFwaChcbiAgICBjZW50ZXI6IHN0cmluZyxcbiAgICBkZXB0aDogbnVtYmVyID0gMlxuICApOiBQcm9taXNlPHsgbm9kZXM6IFN1YmdyYXBoTm9kZVtdOyBlZGdlczogU3ViZ3JhcGhFZGdlW10gfSB8IG51bGw+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHsgY2VudGVyLCBkZXB0aDogU3RyaW5nKGRlcHRoKSB9KTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2dyYXBoL3N1YmdyYXBoPyR7cGFyYW1zfWA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24gYXMgeyBub2RlczogU3ViZ3JhcGhOb2RlW107IGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSB9O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gXHVDNUQwXHVCN0VDIFx1Q0M5OFx1QjlBQyAvIEVycm9yIGhhbmRsaW5nIHdpdGggZnJpZW5kbHkgbWVzc2FnZXNcbiAgcHJpdmF0ZSBoYW5kbGVFcnJvcihlcnI6IHVua25vd24pOiB2b2lkIHtcbiAgICBjb25zdCBtc2cgPSBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycik7XG4gICAgaWYgKG1zZy5pbmNsdWRlcyhcIkVDT05OUkVGVVNFRFwiKSB8fCBtc2cuaW5jbHVkZXMoXCJuZXQ6OkVSUlwiKSkge1xuICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgYFtNbmVtb10gXHVDMTFDXHVCQzg0XHVDNUQwIFx1QzVGMFx1QUNCMFx1RDU2MCBcdUMyMTggXHVDNUM2XHVDMkI1XHVCMkM4XHVCMkU0LiBNbmVtbyBcdUMxMUNcdUJDODRcdUFDMDAgXHVDMkU0XHVENTg5IFx1QzkxMVx1Qzc3OFx1QzlDMCBcdUQ2NTVcdUM3NzhcdUQ1NThcdUMxMzhcdUM2OTQuXFxuYCArXG4gICAgICAgICAgYENhbm5vdCBjb25uZWN0IHRvIE1uZW1vIHNlcnZlciBhdCAke3RoaXMuYmFzZVVybH0uIElzIGl0IHJ1bm5pbmc/YFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcihgW01uZW1vXSBBUEkgZXJyb3I6ICR7bXNnfWApO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgTW5lbW9QbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuXG4vLyBcdUQ1MENcdUI3RUNcdUFERjhcdUM3NzggXHVDMTI0XHVDODE1IFx1Qzc3OFx1RDEzMFx1RDM5OFx1Qzc3NFx1QzJBNCAvIFBsdWdpbiBzZXR0aW5ncyBpbnRlcmZhY2VcbmV4cG9ydCBpbnRlcmZhY2UgTW5lbW9TZXR0aW5ncyB7XG4gIGFwaVVybDogc3RyaW5nO1xuICBzZWFyY2hMaW1pdDogbnVtYmVyO1xuICBzZWFyY2hNb2RlOiBcImh5YnJpZFwiIHwgXCJ2ZWN0b3JcIiB8IFwia2V5d29yZFwiIHwgXCJncmFwaFwiO1xufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogTW5lbW9TZXR0aW5ncyA9IHtcbiAgYXBpVXJsOiBcImh0dHA6Ly8xMjcuMC4wLjE6ODAwMFwiLFxuICBzZWFyY2hMaW1pdDogMTAsXG4gIHNlYXJjaE1vZGU6IFwiaHlicmlkXCIsXG59O1xuXG4vLyBcdUMxMjRcdUM4MTUgXHVEMEVEIC8gU2V0dGluZ3MgdGFiXG5leHBvcnQgY2xhc3MgTW5lbW9TZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogTW5lbW9QbHVnaW47XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogTW5lbW9QbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJNbmVtbyBTZWNvbmRCcmFpbiBTZXR0aW5nc1wiIH0pO1xuXG4gICAgLy8gQVBJIFVSTCBcdUMxMjRcdUM4MTVcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiTW5lbW8gQVBJIFVSTFwiKVxuICAgICAgLnNldERlc2MoXCJNbmVtbyBGYXN0QVBJIFx1QzExQ1x1QkM4NCBcdUM4RkNcdUMxOEMgLyBNbmVtbyBzZXJ2ZXIgYWRkcmVzc1wiKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIilcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpVXJsKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaVVybCA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uYXBpQ2xpZW50LnNldEJhc2VVcmwodmFsdWUpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICAvLyBcdUFDODBcdUMwQzkgXHVBQ0IwXHVBQ0ZDIFx1QzIxOFxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJTZWFyY2ggcmVzdWx0IGxpbWl0XCIpXG4gICAgICAuc2V0RGVzYyhcIlx1QUM4MFx1QzBDOSBcdUFDQjBcdUFDRkMgXHVDRDVDXHVCMzAwIFx1QUMxQ1x1QzIxOCAvIE1heGltdW0gbnVtYmVyIG9mIHJlc3VsdHNcIilcbiAgICAgIC5hZGRTbGlkZXIoKHNsaWRlcikgPT5cbiAgICAgICAgc2xpZGVyXG4gICAgICAgICAgLnNldExpbWl0cyg1LCA1MCwgNSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VhcmNoTGltaXQpXG4gICAgICAgICAgLnNldER5bmFtaWNUb29sdGlwKClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zZWFyY2hMaW1pdCA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICAvLyBcdUFDODBcdUMwQzkgXHVCQUE4XHVCNERDXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlNlYXJjaCBtb2RlXCIpXG4gICAgICAuc2V0RGVzYyhcIlx1QUM4MFx1QzBDOSBcdUJDMjlcdUMyREQgXHVDMTIwXHVEMEREIC8gU2VsZWN0IHNlYXJjaCBtZXRob2RcIilcbiAgICAgIC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+XG4gICAgICAgIGRyb3Bkb3duXG4gICAgICAgICAgLmFkZE9wdGlvbnMoe1xuICAgICAgICAgICAgaHlicmlkOiBcIkh5YnJpZCAoa2V5d29yZCArIHZlY3RvcilcIixcbiAgICAgICAgICAgIHZlY3RvcjogXCJWZWN0b3IgKHNlbWFudGljKVwiLFxuICAgICAgICAgICAga2V5d29yZDogXCJLZXl3b3JkIChCTTI1KVwiLFxuICAgICAgICAgICAgZ3JhcGg6IFwiR3JhcGggKHJlbGF0aW9uc2hpcClcIixcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zZWFyY2hNb2RlKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNlYXJjaE1vZGUgPSB2YWx1ZSBhcyBNbmVtb1NldHRpbmdzW1wic2VhcmNoTW9kZVwiXTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBTdWdnZXN0TW9kYWwsIE5vdGljZSwgVEZpbGUgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIHsgTW5lbW9BcGlDbGllbnQsIE1uZW1vU2VhcmNoUmVzdWx0IH0gZnJvbSBcIi4vYXBpLWNsaWVudFwiO1xuaW1wb3J0IHR5cGUgeyBNbmVtb1NldHRpbmdzIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcblxuLy8gTW5lbW8gXHVBQzgwXHVDMEM5IFx1QkFBOFx1QjJFQyAvIFNlYXJjaCBtb2RhbCAoQ3RybCtTaGlmdCtNKVxuZXhwb3J0IGNsYXNzIE1uZW1vU2VhcmNoTW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8TW5lbW9TZWFyY2hSZXN1bHQ+IHtcbiAgcHJpdmF0ZSByZXN1bHRzOiBNbmVtb1NlYXJjaFJlc3VsdFtdID0gW107XG4gIHByaXZhdGUgZGVib3VuY2VUaW1lcjogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGFwaUNsaWVudDogTW5lbW9BcGlDbGllbnQsXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogTW5lbW9TZXR0aW5nc1xuICApIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJNbmVtbyBcdUFDODBcdUMwQzkuLi4gLyBTZWFyY2ggTW5lbW8uLi5cIik7XG4gIH1cblxuICBhc3luYyBnZXRTdWdnZXN0aW9ucyhxdWVyeTogc3RyaW5nKTogUHJvbWlzZTxNbmVtb1NlYXJjaFJlc3VsdFtdPiB7XG4gICAgaWYgKCFxdWVyeSB8fCBxdWVyeS5sZW5ndGggPCAyKSByZXR1cm4gW107XG5cbiAgICAvLyBcdUI1MTRcdUJDMTRcdUM2QjRcdUMyQTQgMzAwbXMgLyBEZWJvdW5jZSBpbnB1dFxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lcikgY2xlYXJUaW1lb3V0KHRoaXMuZGVib3VuY2VUaW1lcik7XG4gICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gYXdhaXQgdGhpcy5hcGlDbGllbnQuc2VhcmNoKFxuICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgIHRoaXMuc2V0dGluZ3Muc2VhcmNoTW9kZSxcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLnNlYXJjaExpbWl0XG4gICAgICAgICk7XG4gICAgICAgIHJlc29sdmUodGhpcy5yZXN1bHRzKTtcbiAgICAgIH0sIDMwMCk7XG4gICAgfSk7XG4gIH1cblxuICByZW5kZXJTdWdnZXN0aW9uKHJlc3VsdDogTW5lbW9TZWFyY2hSZXN1bHQsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGVsLmNyZWF0ZURpdih7IGNsczogXCJtbmVtby1zZWFyY2gtcmVzdWx0XCIgfSk7XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHtcbiAgICAgIHRleHQ6IHJlc3VsdC50aXRsZSxcbiAgICAgIGNsczogXCJtbmVtby1yZXN1bHQtdGl0bGVcIixcbiAgICB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJzbWFsbFwiLCB7XG4gICAgICB0ZXh0OiByZXN1bHQuc25pcHBldCxcbiAgICAgIGNsczogXCJtbmVtby1yZXN1bHQtc25pcHBldFwiLFxuICAgIH0pO1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcInNwYW5cIiwge1xuICAgICAgdGV4dDogYHNjb3JlOiAke3Jlc3VsdC5zY29yZS50b0ZpeGVkKDMpfWAsXG4gICAgICBjbHM6IFwibW5lbW8tcmVzdWx0LXNjb3JlXCIsXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBvbkNob29zZVN1Z2dlc3Rpb24ocmVzdWx0OiBNbmVtb1NlYXJjaFJlc3VsdCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIFx1QkNGQ1x1RDJCOFx1QzVEMFx1QzExQyBcdUQ1NzRcdUIyRjkgXHVCMTc4XHVEMkI4IFx1QzVGNFx1QUUzMCAvIE9wZW4gbWF0Y2hpbmcgbm90ZSBpbiB2YXVsdFxuICAgIGxldCBwYXRoID0gcmVzdWx0LnBhdGggfHwgYCR7cmVzdWx0LnRpdGxlfS5tZGA7XG4gICAgaWYgKCFwYXRoLmVuZHNXaXRoKFwiLm1kXCIpKSBwYXRoICs9IFwiLm1kXCI7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcblxuICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUoZmlsZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ldyBOb3RpY2UoYFx1QjE3OFx1RDJCOFx1Qjk3QyBcdUNDM0VcdUM3NDQgXHVDMjE4IFx1QzVDNlx1QzJCNVx1QjJDOFx1QjJFNDogJHtyZXN1bHQudGl0bGV9XFxuTm90ZSBub3QgZm91bmQgaW4gdmF1bHQuYCk7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgSXRlbVZpZXcsIFdvcmtzcGFjZUxlYWYgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIHsgTW5lbW9BcGlDbGllbnQsIFN1YmdyYXBoTm9kZSwgU3ViZ3JhcGhFZGdlIH0gZnJvbSBcIi4vYXBpLWNsaWVudFwiO1xuXG5leHBvcnQgY29uc3QgTU5FTU9fR1JBUEhfVklFV19UWVBFID0gXCJtbmVtby1ncmFwaC12aWV3XCI7XG5cbi8vIFx1QzBDOVx1QzBDMSBcdUI5RjUgKGVudGl0eV90eXBlXHVCQ0M0KVxuY29uc3QgVFlQRV9DT0xPUlM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIGV2ZW50OiBcIiM0QTkwRDlcIixcbiAgcHJvamVjdDogXCIjRTg5MTNBXCIsXG4gIG5vdGU6IFwiIzUwQzg3OFwiLFxuICBzb3VyY2U6IFwiIzlCNTlCNlwiLFxuICBkZWNpc2lvbjogXCIjRTc0QzNDXCIsXG4gIGluc2lnaHQ6IFwiI0YxQzQwRlwiLFxufTtcbmNvbnN0IERFRkFVTFRfQ09MT1IgPSBcIiM4ODg4ODhcIjtcblxuaW50ZXJmYWNlIEdyYXBoTm9kZSB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzY29yZT86IG51bWJlcjtcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIHZ4OiBudW1iZXI7XG4gIHZ5OiBudW1iZXI7XG4gIHJhZGl1czogbnVtYmVyO1xuICBpc0NlbnRlcjogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIEdyYXBoRWRnZSB7XG4gIHNvdXJjZTogc3RyaW5nO1xuICB0YXJnZXQ6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgTW5lbW9HcmFwaFZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gIHByaXZhdGUgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgbm9kZXM6IEdyYXBoTm9kZVtdID0gW107XG4gIHByaXZhdGUgZWRnZXM6IEdyYXBoRWRnZVtdID0gW107XG4gIHByaXZhdGUgbm9kZU1hcDogTWFwPHN0cmluZywgR3JhcGhOb2RlPiA9IG5ldyBNYXAoKTtcblxuICAvLyBcdUNFNzRcdUJBNTRcdUI3N0NcbiAgcHJpdmF0ZSBvZmZzZXRYID0gMDtcbiAgcHJpdmF0ZSBvZmZzZXRZID0gMDtcbiAgcHJpdmF0ZSBzY2FsZSA9IDE7XG5cbiAgLy8gXHVDNzc4XHVEMTMwXHVCNzk5XHVDMTU4XG4gIHByaXZhdGUgZHJhZ05vZGU6IEdyYXBoTm9kZSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGlzUGFubmluZyA9IGZhbHNlO1xuICBwcml2YXRlIGxhc3RNb3VzZSA9IHsgeDogMCwgeTogMCB9O1xuICBwcml2YXRlIGhvdmVyZWROb2RlOiBHcmFwaE5vZGUgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBhbmltRnJhbWUgPSAwO1xuICBwcml2YXRlIHNpbVJ1bm5pbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBzaW1JdGVyYXRpb25zID0gMDtcblxuICBwcml2YXRlIGNlbnRlclBhdGggPSBcIlwiO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGxlYWY6IFdvcmtzcGFjZUxlYWYsXG4gICAgcHJpdmF0ZSBhcGlDbGllbnQ6IE1uZW1vQXBpQ2xpZW50XG4gICkge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHsgcmV0dXJuIE1ORU1PX0dSQVBIX1ZJRVdfVFlQRTsgfVxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcgeyByZXR1cm4gXCJNbmVtbyBHcmFwaFwiOyB9XG4gIGdldEljb24oKTogc3RyaW5nIHsgcmV0dXJuIFwiZ2l0LWZvcmtcIjsgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdIGFzIEhUTUxFbGVtZW50O1xuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIGNvbnRhaW5lci5hZGRDbGFzcyhcIm1uZW1vLWdyYXBoLWNvbnRhaW5lclwiKTtcblxuICAgIC8vIFx1RDIzNFx1QkMxNFxuICAgIGNvbnN0IHRvb2xiYXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcIm1uZW1vLWdyYXBoLXRvb2xiYXJcIiB9KTtcbiAgICB0b29sYmFyLmNyZWF0ZUVsKFwic3BhblwiLCB7IHRleHQ6IFwiTW5lbW8gR3JhcGhcIiwgY2xzOiBcIm1uZW1vLWdyYXBoLXRpdGxlXCIgfSk7XG5cbiAgICBjb25zdCByZWZyZXNoQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyMUJCXCIsIGNsczogXCJtbmVtby1ncmFwaC1idG5cIiwgYXR0cjogeyB0aXRsZTogXCJSZWZyZXNoXCIgfSB9KTtcbiAgICByZWZyZXNoQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB0aGlzLmxvYWRHcmFwaCgpKTtcblxuICAgIGNvbnN0IGZpdEJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1MjJBMVwiLCBjbHM6IFwibW5lbW8tZ3JhcGgtYnRuXCIsIGF0dHI6IHsgdGl0bGU6IFwiRml0IHRvIHZpZXdcIiB9IH0pO1xuICAgIGZpdEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5maXRUb1ZpZXcoKSk7XG5cbiAgICAvLyBcdUNFOTRcdUJDODRcdUMyQTRcbiAgICB0aGlzLmNhbnZhcyA9IGNvbnRhaW5lci5jcmVhdGVFbChcImNhbnZhc1wiLCB7IGNsczogXCJtbmVtby1ncmFwaC1jYW52YXNcIiB9KTtcbiAgICB0aGlzLmN0eCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcblxuICAgIHRoaXMucmVzaXplQ2FudmFzKCk7XG4gICAgdGhpcy5yZWdpc3RlckRvbUV2ZW50KHdpbmRvdywgXCJyZXNpemVcIiwgKCkgPT4gdGhpcy5yZXNpemVDYW52YXMoKSk7XG4gICAgdGhpcy5zZXR1cEludGVyYWN0aW9uKCk7XG4gICAgdGhpcy5sb2FkR3JhcGgoKTtcbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zaW1SdW5uaW5nID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuYW5pbUZyYW1lKSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLmFuaW1GcmFtZSk7XG4gIH1cblxuICAvLyBcdUQ2MDRcdUM3QUMgXHVCMTc4XHVEMkI4IFx1QUUzMFx1QzkwMCBcdUI4NUNcdUI0RENcbiAgYXN5bmMgbG9hZEdyYXBoKHBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIXBhdGgpIHtcbiAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgICAgcGF0aCA9IGZpbGUgPyBmaWxlLnBhdGggOiBcIlwiO1xuICAgIH1cbiAgICBpZiAoIXBhdGgpIHtcbiAgICAgIHRoaXMuZHJhd0VtcHR5KFwiT3BlbiBhIG5vdGUsIHRoZW4gcmVmcmVzaFwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5jZW50ZXJQYXRoID0gcGF0aDtcblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmFwaUNsaWVudC5zdWJncmFwaChwYXRoLCAyKTtcbiAgICBpZiAoIWRhdGEgfHwgZGF0YS5ub2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuZHJhd0VtcHR5KFwiTm8gZ3JhcGggZGF0YSBmb3IgdGhpcyBub3RlXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVpbGRHcmFwaChkYXRhLm5vZGVzLCBkYXRhLmVkZ2VzLCBwYXRoKTtcbiAgICB0aGlzLnJ1blNpbXVsYXRpb24oKTtcbiAgfVxuXG4gIHNldENlbnRlclBhdGgocGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5sb2FkR3JhcGgocGF0aCk7XG4gIH1cblxuICAvLyA9PT09PSBcdUFERjhcdUI3OThcdUQ1MDQgXHVCRTRDXHVCNERDID09PT09XG4gIHByaXZhdGUgYnVpbGRHcmFwaChub2RlczogU3ViZ3JhcGhOb2RlW10sIGVkZ2VzOiBTdWJncmFwaEVkZ2VbXSwgY2VudGVyUGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgdyA9IHRoaXMuY2FudmFzIS53aWR0aDtcbiAgICBjb25zdCBoID0gdGhpcy5jYW52YXMhLmhlaWdodDtcbiAgICBjb25zdCBjeCA9IHcgLyAyLCBjeSA9IGggLyAyO1xuXG4gICAgdGhpcy5ub2RlcyA9IG5vZGVzLm1hcCgobikgPT4gKHtcbiAgICAgIGlkOiBuLmlkLFxuICAgICAgbmFtZTogbi5uYW1lLFxuICAgICAgdHlwZTogbi50eXBlLFxuICAgICAgc2NvcmU6IG4uc2NvcmUsXG4gICAgICB4OiBuLmlkID09PSBjZW50ZXJQYXRoID8gY3ggOiBjeCArIChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDMwMCxcbiAgICAgIHk6IG4uaWQgPT09IGNlbnRlclBhdGggPyBjeSA6IGN5ICsgKE1hdGgucmFuZG9tKCkgLSAwLjUpICogMzAwLFxuICAgICAgdng6IDAsXG4gICAgICB2eTogMCxcbiAgICAgIHJhZGl1czogbi5pZCA9PT0gY2VudGVyUGF0aCA/IDE4IDogMTIsXG4gICAgICBpc0NlbnRlcjogbi5pZCA9PT0gY2VudGVyUGF0aCxcbiAgICB9KSk7XG5cbiAgICB0aGlzLmVkZ2VzID0gZWRnZXM7XG4gICAgdGhpcy5ub2RlTWFwID0gbmV3IE1hcCh0aGlzLm5vZGVzLm1hcCgobikgPT4gW24uaWQsIG5dKSk7XG4gICAgdGhpcy5vZmZzZXRYID0gMDtcbiAgICB0aGlzLm9mZnNldFkgPSAwO1xuICAgIHRoaXMuc2NhbGUgPSAxO1xuICB9XG5cbiAgLy8gPT09PT0gRm9yY2UtZGlyZWN0ZWQgXHVDMkRDXHVCQkFDXHVCODA4XHVDNzc0XHVDMTU4ID09PT09XG4gIHByaXZhdGUgcnVuU2ltdWxhdGlvbigpOiB2b2lkIHtcbiAgICB0aGlzLnNpbVJ1bm5pbmcgPSB0cnVlO1xuICAgIHRoaXMuc2ltSXRlcmF0aW9ucyA9IDA7XG4gICAgY29uc3QgdGljayA9ICgpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSByZXR1cm47XG4gICAgICB0aGlzLnNpbUl0ZXJhdGlvbnMrKztcbiAgICAgIHRoaXMuc2ltdWxhdGVTdGVwKCk7XG4gICAgICB0aGlzLmRyYXcoKTtcbiAgICAgIGlmICh0aGlzLnNpbUl0ZXJhdGlvbnMgPCAyMDApIHtcbiAgICAgICAgdGhpcy5hbmltRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNpbVJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5kcmF3KCk7XG4gICAgICB9XG4gICAgfTtcbiAgICB0aGlzLmFuaW1GcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgfVxuXG4gIHByaXZhdGUgc2ltdWxhdGVTdGVwKCk6IHZvaWQge1xuICAgIGNvbnN0IGFscGhhID0gTWF0aC5tYXgoMC4wMSwgMSAtIHRoaXMuc2ltSXRlcmF0aW9ucyAvIDIwMCk7XG4gICAgY29uc3Qgbm9kZXMgPSB0aGlzLm5vZGVzO1xuICAgIGNvbnN0IHJlcHVsc2lvbiA9IDMwMDA7XG4gICAgY29uc3Qgc3ByaW5nTGVuID0gMTIwO1xuICAgIGNvbnN0IHNwcmluZ0sgPSAwLjAyO1xuICAgIGNvbnN0IGNlbnRlckdyYXZpdHkgPSAwLjAxO1xuICAgIGNvbnN0IHcgPSB0aGlzLmNhbnZhcyEud2lkdGggLyAyO1xuICAgIGNvbnN0IGggPSB0aGlzLmNhbnZhcyEuaGVpZ2h0IC8gMjtcblxuICAgIC8vIFJlcHVsc2lvbiAoYWxsIHBhaXJzKVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IG5vZGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGNvbnN0IGEgPSBub2Rlc1tpXSwgYiA9IG5vZGVzW2pdO1xuICAgICAgICBsZXQgZHggPSBiLnggLSBhLngsIGR5ID0gYi55IC0gYS55O1xuICAgICAgICBsZXQgZGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSkgfHwgMTtcbiAgICAgICAgY29uc3QgZm9yY2UgPSByZXB1bHNpb24gLyAoZGlzdCAqIGRpc3QpO1xuICAgICAgICBjb25zdCBmeCA9IChkeCAvIGRpc3QpICogZm9yY2UgKiBhbHBoYTtcbiAgICAgICAgY29uc3QgZnkgPSAoZHkgLyBkaXN0KSAqIGZvcmNlICogYWxwaGE7XG4gICAgICAgIGEudnggLT0gZng7IGEudnkgLT0gZnk7XG4gICAgICAgIGIudnggKz0gZng7IGIudnkgKz0gZnk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gU3ByaW5nIChlZGdlcylcbiAgICBmb3IgKGNvbnN0IGUgb2YgdGhpcy5lZGdlcykge1xuICAgICAgY29uc3QgYSA9IHRoaXMubm9kZU1hcC5nZXQoZS5zb3VyY2UpO1xuICAgICAgY29uc3QgYiA9IHRoaXMubm9kZU1hcC5nZXQoZS50YXJnZXQpO1xuICAgICAgaWYgKCFhIHx8ICFiKSBjb250aW51ZTtcbiAgICAgIGxldCBkeCA9IGIueCAtIGEueCwgZHkgPSBiLnkgLSBhLnk7XG4gICAgICBsZXQgZGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSkgfHwgMTtcbiAgICAgIGNvbnN0IGZvcmNlID0gKGRpc3QgLSBzcHJpbmdMZW4pICogc3ByaW5nSyAqIGFscGhhO1xuICAgICAgY29uc3QgZnggPSAoZHggLyBkaXN0KSAqIGZvcmNlO1xuICAgICAgY29uc3QgZnkgPSAoZHkgLyBkaXN0KSAqIGZvcmNlO1xuICAgICAgYS52eCArPSBmeDsgYS52eSArPSBmeTtcbiAgICAgIGIudnggLT0gZng7IGIudnkgLT0gZnk7XG4gICAgfVxuXG4gICAgLy8gQ2VudGVyIGdyYXZpdHlcbiAgICBmb3IgKGNvbnN0IG4gb2Ygbm9kZXMpIHtcbiAgICAgIG4udnggKz0gKHcgLSBuLngpICogY2VudGVyR3Jhdml0eSAqIGFscGhhO1xuICAgICAgbi52eSArPSAoaCAtIG4ueSkgKiBjZW50ZXJHcmF2aXR5ICogYWxwaGE7XG4gICAgICAvLyBEYW1waW5nXG4gICAgICBuLnZ4ICo9IDAuODU7XG4gICAgICBuLnZ5ICo9IDAuODU7XG4gICAgICBpZiAoIW4uaXNDZW50ZXIgfHwgdGhpcy5zaW1JdGVyYXRpb25zID4gNSkge1xuICAgICAgICBuLnggKz0gbi52eDtcbiAgICAgICAgbi55ICs9IG4udnk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gPT09PT0gXHVCODBDXHVCMzU0XHVCOUMxID09PT09XG4gIHByaXZhdGUgZHJhdygpOiB2b2lkIHtcbiAgICBjb25zdCBjdHggPSB0aGlzLmN0eCE7XG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5jYW52YXMhO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICBjdHguc2F2ZSgpO1xuICAgIGN0eC50cmFuc2xhdGUodGhpcy5vZmZzZXRYLCB0aGlzLm9mZnNldFkpO1xuICAgIGN0eC5zY2FsZSh0aGlzLnNjYWxlLCB0aGlzLnNjYWxlKTtcblxuICAgIC8vIFx1QzVFM1x1QzlDMFxuICAgIGZvciAoY29uc3QgZSBvZiB0aGlzLmVkZ2VzKSB7XG4gICAgICBjb25zdCBhID0gdGhpcy5ub2RlTWFwLmdldChlLnNvdXJjZSk7XG4gICAgICBjb25zdCBiID0gdGhpcy5ub2RlTWFwLmdldChlLnRhcmdldCk7XG4gICAgICBpZiAoIWEgfHwgIWIpIGNvbnRpbnVlO1xuXG4gICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICBjdHgubW92ZVRvKGEueCwgYS55KTtcbiAgICAgIGN0eC5saW5lVG8oYi54LCBiLnkpO1xuICAgICAgY3R4LnN0cm9rZVN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDI1NSwyNTUsMjU1LDAuMilcIiA6IFwicmdiYSgwLDAsMCwwLjE1KVwiO1xuICAgICAgY3R4LmxpbmVXaWR0aCA9IDEuNTtcblxuICAgICAgaWYgKGUudHlwZSA9PT0gXCJyZWxhdGVkXCIpIHtcbiAgICAgICAgY3R4LnNldExpbmVEYXNoKFs2LCA0XSk7XG4gICAgICB9IGVsc2UgaWYgKGUudHlwZSA9PT0gXCJ0YWdfc2hhcmVkXCIpIHtcbiAgICAgICAgY3R4LnNldExpbmVEYXNoKFszLCA1XSk7XG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjEpXCIgOiBcInJnYmEoMCwwLDAsMC4wOClcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGN0eC5zZXRMaW5lRGFzaChbXSk7XG4gICAgICB9XG4gICAgICBjdHguc3Ryb2tlKCk7XG4gICAgICBjdHguc2V0TGluZURhc2goW10pO1xuICAgIH1cblxuICAgIC8vIFx1QjE3OFx1QjREQ1xuICAgIGZvciAoY29uc3QgbiBvZiB0aGlzLm5vZGVzKSB7XG4gICAgICBjb25zdCBjb2xvciA9IFRZUEVfQ09MT1JTW24udHlwZV0gfHwgREVGQVVMVF9DT0xPUjtcbiAgICAgIGNvbnN0IGlzSG92ZXJlZCA9IHRoaXMuaG92ZXJlZE5vZGUgPT09IG47XG5cbiAgICAgIC8vIEdsb3cgZm9yIGNlbnRlclxuICAgICAgaWYgKG4uaXNDZW50ZXIpIHtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIDYsIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IGNvbG9yICsgXCIzM1wiO1xuICAgICAgICBjdHguZmlsbCgpO1xuICAgICAgfVxuXG4gICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICBjdHguYXJjKG4ueCwgbi55LCBuLnJhZGl1cyArIChpc0hvdmVyZWQgPyAzIDogMCksIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgIGN0eC5maWxsU3R5bGUgPSBjb2xvcjtcbiAgICAgIGN0eC5maWxsKCk7XG4gICAgICBjdHguc3Ryb2tlU3R5bGUgPSBpc0hvdmVyZWQgPyBcIiNmZmZmZmZcIiA6ICh0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMjU1LDI1NSwyNTUsMC4zKVwiIDogXCJyZ2JhKDAsMCwwLDAuMilcIik7XG4gICAgICBjdHgubGluZVdpZHRoID0gaXNIb3ZlcmVkID8gMi41IDogMTtcbiAgICAgIGN0eC5zdHJva2UoKTtcblxuICAgICAgLy8gTGFiZWxcbiAgICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcIiNlMGUwZTBcIiA6IFwiIzMzMzMzM1wiO1xuICAgICAgY3R4LmZvbnQgPSBuLmlzQ2VudGVyID8gXCJib2xkIDExcHggc2Fucy1zZXJpZlwiIDogXCIxMHB4IHNhbnMtc2VyaWZcIjtcbiAgICAgIGN0eC50ZXh0QWxpZ24gPSBcImNlbnRlclwiO1xuICAgICAgY29uc3QgbGFiZWwgPSBuLm5hbWUubGVuZ3RoID4gMjAgPyBuLm5hbWUuc2xpY2UoMCwgMTgpICsgXCJcdTIwMjZcIiA6IG4ubmFtZTtcbiAgICAgIGN0eC5maWxsVGV4dChsYWJlbCwgbi54LCBuLnkgKyBuLnJhZGl1cyArIDE0KTtcbiAgICB9XG5cbiAgICBjdHgucmVzdG9yZSgpO1xuXG4gICAgLy8gXHVEMjM0XHVEMzAxXG4gICAgaWYgKHRoaXMuaG92ZXJlZE5vZGUpIHtcbiAgICAgIHRoaXMuZHJhd1Rvb2x0aXAodGhpcy5ob3ZlcmVkTm9kZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBkcmF3VG9vbHRpcChuOiBHcmFwaE5vZGUpOiB2b2lkIHtcbiAgICBjb25zdCBjdHggPSB0aGlzLmN0eCE7XG4gICAgY29uc3Qgc3ggPSBuLnggKiB0aGlzLnNjYWxlICsgdGhpcy5vZmZzZXRYO1xuICAgIGNvbnN0IHN5ID0gbi55ICogdGhpcy5zY2FsZSArIHRoaXMub2Zmc2V0WSAtIG4ucmFkaXVzICogdGhpcy5zY2FsZSAtIDEwO1xuXG4gICAgY29uc3QgbGluZXMgPSBbbi5uYW1lLCBgVHlwZTogJHtuLnR5cGV9YF07XG4gICAgaWYgKG4uc2NvcmUgIT0gbnVsbCkgbGluZXMucHVzaChgU2NvcmU6ICR7bi5zY29yZS50b0ZpeGVkKDMpfWApO1xuXG4gICAgY3R4LmZvbnQgPSBcIjExcHggc2Fucy1zZXJpZlwiO1xuICAgIGNvbnN0IG1heFcgPSBNYXRoLm1heCguLi5saW5lcy5tYXAoKGwpID0+IGN0eC5tZWFzdXJlVGV4dChsKS53aWR0aCkpICsgMTY7XG4gICAgY29uc3QgaCA9IGxpbmVzLmxlbmd0aCAqIDE2ICsgMTA7XG5cbiAgICBjb25zdCB0eCA9IHN4IC0gbWF4VyAvIDI7XG4gICAgY29uc3QgdHkgPSBzeSAtIGg7XG5cbiAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5pc0RhcmtUaGVtZSgpID8gXCJyZ2JhKDMwLDMwLDMwLDAuOTUpXCIgOiBcInJnYmEoMjU1LDI1NSwyNTUsMC45NSlcIjtcbiAgICBjdHguc3Ryb2tlU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcInJnYmEoMjU1LDI1NSwyNTUsMC4yKVwiIDogXCJyZ2JhKDAsMCwwLDAuMTUpXCI7XG4gICAgY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgdGhpcy5yb3VuZFJlY3QoY3R4LCB0eCwgdHksIG1heFcsIGgsIDYpO1xuICAgIGN0eC5maWxsKCk7XG4gICAgY3R4LnN0cm9rZSgpO1xuXG4gICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMuaXNEYXJrVGhlbWUoKSA/IFwiI2UwZTBlMFwiIDogXCIjMzMzMzMzXCI7XG4gICAgY3R4LnRleHRBbGlnbiA9IFwibGVmdFwiO1xuICAgIGxpbmVzLmZvckVhY2goKGxpbmUsIGkpID0+IHtcbiAgICAgIGN0eC5maWxsVGV4dChsaW5lLCB0eCArIDgsIHR5ICsgMTYgKyBpICogMTYpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByb3VuZFJlY3QoY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQsIHg6IG51bWJlciwgeTogbnVtYmVyLCB3OiBudW1iZXIsIGg6IG51bWJlciwgcjogbnVtYmVyKTogdm9pZCB7XG4gICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgIGN0eC5tb3ZlVG8oeCArIHIsIHkpO1xuICAgIGN0eC5saW5lVG8oeCArIHcgLSByLCB5KTtcbiAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4ICsgdywgeSwgeCArIHcsIHkgKyByKTtcbiAgICBjdHgubGluZVRvKHggKyB3LCB5ICsgaCAtIHIpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHggKyB3LCB5ICsgaCwgeCArIHcgLSByLCB5ICsgaCk7XG4gICAgY3R4LmxpbmVUbyh4ICsgciwgeSArIGgpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHgsIHkgKyBoLCB4LCB5ICsgaCAtIHIpO1xuICAgIGN0eC5saW5lVG8oeCwgeSArIHIpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHgsIHksIHggKyByLCB5KTtcbiAgICBjdHguY2xvc2VQYXRoKCk7XG4gIH1cblxuICBwcml2YXRlIGRyYXdFbXB0eShtc2c6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGN0eCA9IHRoaXMuY3R4ITtcbiAgICBjb25zdCBjYW52YXMgPSB0aGlzLmNhbnZhcyE7XG4gICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmlzRGFya1RoZW1lKCkgPyBcIiM5OTlcIiA6IFwiIzY2NlwiO1xuICAgIGN0eC5mb250ID0gXCIxNHB4IHNhbnMtc2VyaWZcIjtcbiAgICBjdHgudGV4dEFsaWduID0gXCJjZW50ZXJcIjtcbiAgICBjdHguZmlsbFRleHQobXNnLCBjYW52YXMud2lkdGggLyAyLCBjYW52YXMuaGVpZ2h0IC8gMik7XG4gIH1cblxuICAvLyA9PT09PSBcdUM3NzhcdUQxMzBcdUI3OTlcdUMxNTggPT09PT1cbiAgcHJpdmF0ZSBzZXR1cEludGVyYWN0aW9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGMgPSB0aGlzLmNhbnZhcyE7XG5cbiAgICBjLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgKGUpID0+IHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmhpdFRlc3QoZS5vZmZzZXRYLCBlLm9mZnNldFkpO1xuICAgICAgaWYgKG5vZGUpIHtcbiAgICAgICAgdGhpcy5kcmFnTm9kZSA9IG5vZGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmlzUGFubmluZyA9IHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLmxhc3RNb3VzZSA9IHsgeDogZS5vZmZzZXRYLCB5OiBlLm9mZnNldFkgfTtcbiAgICB9KTtcblxuICAgIGMuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCAoZSkgPT4ge1xuICAgICAgY29uc3QgZHggPSBlLm9mZnNldFggLSB0aGlzLmxhc3RNb3VzZS54O1xuICAgICAgY29uc3QgZHkgPSBlLm9mZnNldFkgLSB0aGlzLmxhc3RNb3VzZS55O1xuXG4gICAgICBpZiAodGhpcy5kcmFnTm9kZSkge1xuICAgICAgICB0aGlzLmRyYWdOb2RlLnggKz0gZHggLyB0aGlzLnNjYWxlO1xuICAgICAgICB0aGlzLmRyYWdOb2RlLnkgKz0gZHkgLyB0aGlzLnNjYWxlO1xuICAgICAgICB0aGlzLmRyYWdOb2RlLnZ4ID0gMDtcbiAgICAgICAgdGhpcy5kcmFnTm9kZS52eSA9IDA7XG4gICAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB0aGlzLmRyYXcoKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc1Bhbm5pbmcpIHtcbiAgICAgICAgdGhpcy5vZmZzZXRYICs9IGR4O1xuICAgICAgICB0aGlzLm9mZnNldFkgKz0gZHk7XG4gICAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB0aGlzLmRyYXcoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHByZXYgPSB0aGlzLmhvdmVyZWROb2RlO1xuICAgICAgICB0aGlzLmhvdmVyZWROb2RlID0gdGhpcy5oaXRUZXN0KGUub2Zmc2V0WCwgZS5vZmZzZXRZKTtcbiAgICAgICAgYy5zdHlsZS5jdXJzb3IgPSB0aGlzLmhvdmVyZWROb2RlID8gXCJwb2ludGVyXCIgOiBcImRlZmF1bHRcIjtcbiAgICAgICAgaWYgKHByZXYgIT09IHRoaXMuaG92ZXJlZE5vZGUgJiYgIXRoaXMuc2ltUnVubmluZykgdGhpcy5kcmF3KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxhc3RNb3VzZSA9IHsgeDogZS5vZmZzZXRYLCB5OiBlLm9mZnNldFkgfTtcbiAgICB9KTtcblxuICAgIGMuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgKGUpID0+IHtcbiAgICAgIGlmICh0aGlzLmRyYWdOb2RlKSB7XG4gICAgICAgIC8vIFx1RDA3NFx1QjlBRCAoXHVCNERDXHVCNzk4XHVBREY4IFx1QzU0NFx1QjJEOCkgXHUyMTkyIFx1QjE3OFx1RDJCOCBcdUM1RjRcdUFFMzBcbiAgICAgICAgY29uc3QgZHggPSBNYXRoLmFicyhlLm9mZnNldFggLSB0aGlzLmxhc3RNb3VzZS54KTtcbiAgICAgICAgY29uc3QgZHkgPSBNYXRoLmFicyhlLm9mZnNldFkgLSB0aGlzLmxhc3RNb3VzZS55KTtcbiAgICAgICAgaWYgKGR4IDwgMyAmJiBkeSA8IDMpIHtcbiAgICAgICAgICB0aGlzLm9wZW5Ob3RlKHRoaXMuZHJhZ05vZGUuaWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmRyYWdOb2RlID0gbnVsbDtcbiAgICAgIHRoaXMuaXNQYW5uaW5nID0gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBjLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuaGl0VGVzdChlLm9mZnNldFgsIGUub2Zmc2V0WSk7XG4gICAgICBpZiAobm9kZSkge1xuICAgICAgICB0aGlzLm9wZW5Ob3RlKG5vZGUuaWQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgYy5hZGRFdmVudExpc3RlbmVyKFwid2hlZWxcIiwgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGNvbnN0IHpvb20gPSBlLmRlbHRhWSA8IDAgPyAxLjEgOiAwLjk7XG4gICAgICBjb25zdCBteCA9IGUub2Zmc2V0WCwgbXkgPSBlLm9mZnNldFk7XG4gICAgICB0aGlzLm9mZnNldFggPSBteCAtIHpvb20gKiAobXggLSB0aGlzLm9mZnNldFgpO1xuICAgICAgdGhpcy5vZmZzZXRZID0gbXkgLSB6b29tICogKG15IC0gdGhpcy5vZmZzZXRZKTtcbiAgICAgIHRoaXMuc2NhbGUgKj0gem9vbTtcbiAgICAgIHRoaXMuc2NhbGUgPSBNYXRoLm1heCgwLjIsIE1hdGgubWluKDUsIHRoaXMuc2NhbGUpKTtcbiAgICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB0aGlzLmRyYXcoKTtcbiAgICB9LCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBoaXRUZXN0KG14OiBudW1iZXIsIG15OiBudW1iZXIpOiBHcmFwaE5vZGUgfCBudWxsIHtcbiAgICBjb25zdCB4ID0gKG14IC0gdGhpcy5vZmZzZXRYKSAvIHRoaXMuc2NhbGU7XG4gICAgY29uc3QgeSA9IChteSAtIHRoaXMub2Zmc2V0WSkgLyB0aGlzLnNjYWxlO1xuICAgIC8vIFJldmVyc2Ugb3JkZXIgc28gdG9wLWRyYXduIG5vZGVzIGFyZSBoaXQgZmlyc3RcbiAgICBmb3IgKGxldCBpID0gdGhpcy5ub2Rlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgbiA9IHRoaXMubm9kZXNbaV07XG4gICAgICBjb25zdCBkeCA9IHggLSBuLngsIGR5ID0geSAtIG4ueTtcbiAgICAgIGlmIChkeCAqIGR4ICsgZHkgKiBkeSA8PSAobi5yYWRpdXMgKyA0KSAqIChuLnJhZGl1cyArIDQpKSByZXR1cm4gbjtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIG9wZW5Ob3RlKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAvLyBpZFx1QjI5NCBcdUQzMENcdUM3N0MgXHVBQ0JEXHVCODVDIChcdUM2MDg6IFwiZm9sZGVyL25vdGUubWRcIilcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGlkKTtcbiAgICBpZiAoZmlsZSkge1xuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChpZCwgXCJcIiwgdHJ1ZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBmaXRUb1ZpZXcoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubm9kZXMubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgbGV0IG1pblggPSBJbmZpbml0eSwgbWF4WCA9IC1JbmZpbml0eSwgbWluWSA9IEluZmluaXR5LCBtYXhZID0gLUluZmluaXR5O1xuICAgIGZvciAoY29uc3QgbiBvZiB0aGlzLm5vZGVzKSB7XG4gICAgICBtaW5YID0gTWF0aC5taW4obWluWCwgbi54IC0gbi5yYWRpdXMpO1xuICAgICAgbWF4WCA9IE1hdGgubWF4KG1heFgsIG4ueCArIG4ucmFkaXVzKTtcbiAgICAgIG1pblkgPSBNYXRoLm1pbihtaW5ZLCBuLnkgLSBuLnJhZGl1cyk7XG4gICAgICBtYXhZID0gTWF0aC5tYXgobWF4WSwgbi55ICsgbi5yYWRpdXMpO1xuICAgIH1cbiAgICBjb25zdCBwYWQgPSA0MDtcbiAgICBjb25zdCB3ID0gdGhpcy5jYW52YXMhLndpZHRoO1xuICAgIGNvbnN0IGggPSB0aGlzLmNhbnZhcyEuaGVpZ2h0O1xuICAgIGNvbnN0IGd3ID0gbWF4WCAtIG1pblggKyBwYWQgKiAyO1xuICAgIGNvbnN0IGdoID0gbWF4WSAtIG1pblkgKyBwYWQgKiAyO1xuICAgIHRoaXMuc2NhbGUgPSBNYXRoLm1pbih3IC8gZ3csIGggLyBnaCwgMik7XG4gICAgdGhpcy5vZmZzZXRYID0gdyAvIDIgLSAoKG1pblggKyBtYXhYKSAvIDIpICogdGhpcy5zY2FsZTtcbiAgICB0aGlzLm9mZnNldFkgPSBoIC8gMiAtICgobWluWSArIG1heFkpIC8gMikgKiB0aGlzLnNjYWxlO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG5cbiAgLy8gPT09PT0gXHVDNzIwXHVEMkY4ID09PT09XG4gIHByaXZhdGUgcmVzaXplQ2FudmFzKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jYW52YXMpIHJldHVybjtcbiAgICBjb25zdCByZWN0ID0gdGhpcy5jYW52YXMucGFyZW50RWxlbWVudCEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgdGhpcy5jYW52YXMud2lkdGggPSByZWN0LndpZHRoO1xuICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IHJlY3QuaGVpZ2h0O1xuICAgIGlmICghdGhpcy5zaW1SdW5uaW5nKSB0aGlzLmRyYXcoKTtcbiAgfVxuXG4gIHByaXZhdGUgaXNEYXJrVGhlbWUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmNvbnRhaW5zKFwidGhlbWUtZGFya1wiKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBQStCOzs7QUNBL0Isc0JBQTJCO0FBaUNwQixJQUFNLGlCQUFOLE1BQXFCO0FBQUEsRUFDMUIsWUFBb0IsU0FBaUI7QUFBakI7QUFBQSxFQUFrQjtBQUFBLEVBRXRDLFdBQVcsS0FBbUI7QUFDNUIsU0FBSyxVQUFVLElBQUksUUFBUSxRQUFRLEVBQUU7QUFBQSxFQUN2QztBQUFBO0FBQUEsRUFHQSxNQUFNLE9B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SSx3QkFBTyxVQUFVLE1BQU0sV0FBVyxXQUFXLE1BQU0sV0FBVyxRQUFRO0FBQUEsUUFDNUUsT0FBTztBQUNMLGNBQUksd0JBQU8sbUdBQTRDO0FBQUEsUUFDekQ7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBRUQsWUFBUSxJQUFJLGlDQUFpQztBQUFBLEVBQy9DO0FBQUEsRUFFQSxXQUFpQjtBQUNmLFlBQVEsSUFBSSxtQ0FBbUM7QUFBQSxFQUNqRDtBQUFBLEVBRUEsTUFBTSxlQUE4QjtBQUNsQyxTQUFLLFdBQVcsT0FBTyxPQUFPLENBQUMsR0FBRyxrQkFBa0IsTUFBTSxLQUFLLFNBQVMsQ0FBQztBQUFBLEVBQzNFO0FBQUEsRUFFQSxNQUFNLGVBQThCO0FBQ2xDLFVBQU0sS0FBSyxTQUFTLEtBQUssUUFBUTtBQUFBLEVBQ25DO0FBQUEsRUFFQSxNQUFjLGdCQUErQjtBQUMzQyxVQUFNLFdBQVcsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLHFCQUFxQjtBQUN6RSxRQUFJO0FBQ0osUUFBSSxTQUFTLFNBQVMsR0FBRztBQUN2QixhQUFPLFNBQVMsQ0FBQztBQUFBLElBQ25CLE9BQU87QUFDTCxhQUFPLEtBQUssSUFBSSxVQUFVLGFBQWEsS0FBSztBQUM1QyxZQUFNLEtBQUssYUFBYSxFQUFFLE1BQU0sdUJBQXVCLFFBQVEsS0FBSyxDQUFDO0FBQUEsSUFDdkU7QUFDQSxTQUFLLElBQUksVUFBVSxXQUFXLElBQUk7QUFHbEMsVUFBTSxPQUFPLEtBQUssSUFBSSxVQUFVLGNBQWM7QUFDOUMsUUFBSSxNQUFNO0FBQ1IsWUFBTSxPQUFPLEtBQUs7QUFDbEIsV0FBSyxjQUFjLEtBQUssSUFBSTtBQUFBLElBQzlCO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iXQp9Cg==
