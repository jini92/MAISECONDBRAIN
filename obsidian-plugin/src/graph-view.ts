import { ItemView, WorkspaceLeaf } from "obsidian";
import type { MnemoApiClient, SubgraphNode, SubgraphEdge } from "./api-client";

export const MNEMO_GRAPH_VIEW_TYPE = "mnemo-graph-view";

// 색상 맵 (entity_type별)
const TYPE_COLORS: Record<string, string> = {
  event: "#4A90D9",
  project: "#E8913A",
  note: "#50C878",
  source: "#9B59B6",
  decision: "#E74C3C",
  insight: "#F1C40F",
};
const DEFAULT_COLOR = "#888888";

interface GraphNode {
  id: string;
  name: string;
  type: string;
  score?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isCenter: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export class MnemoGraphView extends ItemView {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private nodeMap: Map<string, GraphNode> = new Map();

  // 카메라
  private offsetX = 0;
  private offsetY = 0;
  private scale = 1;

  // 인터랙션
  private dragNode: GraphNode | null = null;
  private isPanning = false;
  private lastMouse = { x: 0, y: 0 };
  private hoveredNode: GraphNode | null = null;
  private animFrame = 0;
  private simRunning = false;
  private simIterations = 0;

  private centerPath = "";
  private viewMode: "local" | "full" | "cluster" = "local";
  private clusterData: any[] = [];
  private backBtn: HTMLElement | null = null;
  private allBtns: HTMLElement[] = [];

  constructor(
    leaf: WorkspaceLeaf,
    private apiClient: MnemoApiClient
  ) {
    super(leaf);
  }

  getViewType(): string { return MNEMO_GRAPH_VIEW_TYPE; }
  getDisplayText(): string { return "Mnemo Graph"; }
  getIcon(): string { return "git-fork"; }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("mnemo-graph-container");

    // 툴바
    const toolbar = container.createDiv({ cls: "mnemo-graph-toolbar" });
    toolbar.createEl("span", { text: "Mnemo Graph", cls: "mnemo-graph-title" });

    const localBtn = toolbar.createEl("button", { text: "📍 Local", cls: "mnemo-graph-btn mnemo-graph-btn-active", attr: { title: "Current note graph" } });
    localBtn.addEventListener("click", () => { this.setActiveBtn(localBtn); this.viewMode = "local"; this.loadGraph(); });

    const clusterBtn = toolbar.createEl("button", { text: "🔮 Explore", cls: "mnemo-graph-btn", attr: { title: "Explore by clusters (drill-down)" } });
    clusterBtn.addEventListener("click", () => { this.setActiveBtn(clusterBtn); this.viewMode = "cluster"; this.loadClusters(); });

    const fullBtn = toolbar.createEl("button", { text: "🌐 Full", cls: "mnemo-graph-btn", attr: { title: "Full knowledge graph" } });
    fullBtn.addEventListener("click", () => { this.setActiveBtn(fullBtn); this.viewMode = "full"; this.loadFullGraph(); });

    this.backBtn = toolbar.createEl("button", { text: "← Back", cls: "mnemo-graph-btn", attr: { title: "Back to clusters" } });
    this.backBtn.style.display = "none";
    this.backBtn.addEventListener("click", () => { this.backBtn!.style.display = "none"; this.loadClusters(); });

    this.allBtns = [localBtn, clusterBtn, fullBtn];

    const refreshBtn = toolbar.createEl("button", { text: "↻", cls: "mnemo-graph-btn", attr: { title: "Refresh" } });
    refreshBtn.addEventListener("click", () => this.viewMode === "full" ? this.loadFullGraph() : this.loadGraph());

    const fitBtn = toolbar.createEl("button", { text: "⊡", cls: "mnemo-graph-btn", attr: { title: "Fit to view" } });
    fitBtn.addEventListener("click", () => this.fitToView());

    // 캔버스
    this.canvas = container.createEl("canvas", { cls: "mnemo-graph-canvas" });
    this.ctx = this.canvas.getContext("2d");

    this.resizeCanvas();
    this.registerDomEvent(window, "resize", () => this.resizeCanvas());
    this.setupInteraction();
    this.loadGraph();
  }

  async onClose(): Promise<void> {
    this.simRunning = false;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  }

  // 현재 노트 기준 로드
  async loadGraph(path?: string): Promise<void> {
    if (!path) {
      const file = this.app.workspace.getActiveFile();
      path = file ? file.path : "";
    }
    if (!path) {
      this.drawEmpty("Open a note, then refresh");
      return;
    }
    // API는 .md 없는 경로를 사용할 수 있음
    this.centerPath = path;
    const apiPath = path.replace(/\.md$/, "");

    const data = await this.apiClient.subgraph(apiPath, 1);
    if (!data || data.nodes.length === 0) {
      this.drawEmpty("No graph data for this note");
      return;
    }

    // 노드 수 제한 (성능 — 최대 80노드)
    let nodes = data.nodes;
    let edges = data.edges;
    if (nodes.length > 80) {
      const centerNode = nodes.find(n => n.id === path || n.id === path.replace(/\.md$/, ""));
      const keep = new Set<string>();
      if (centerNode) keep.add(centerNode.id);
      // score 높은 순으로 80개
      const sorted = [...nodes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      for (const n of sorted) {
        if (keep.size >= 80) break;
        keep.add(n.id);
      }
      nodes = nodes.filter(n => keep.has(n.id));
      edges = edges.filter(e => keep.has(e.source) && keep.has(e.target));
    }

    this.buildGraph(nodes, edges, apiPath);
    this.runSimulation();
  }

  setCenterPath(path: string): void {
    this.loadGraph(path);
  }

  private setActiveBtn(active: HTMLElement): void {
    for (const btn of this.allBtns) btn.removeClass("mnemo-graph-btn-active");
    active.addClass("mnemo-graph-btn-active");
    if (this.backBtn) this.backBtn.style.display = "none";
  }

  async loadClusters(): Promise<void> {
    this.drawEmpty("Loading clusters...");
    const data = await this.apiClient.clusters();
    if (!data || !data.clusters || data.clusters.length === 0) {
      this.drawEmpty("No cluster data");
      return;
    }

    this.clusterData = data.clusters;
    const w = this.canvas!.width;
    const h = this.canvas!.height;

    this.nodes = data.clusters.map((c: any) => ({
      id: c.id,
      name: `${c.hub_name} (${c.size})`,
      type: c.dominant_type,
      score: c.size,
      x: (c.x / 1000) * w * 0.9 + w * 0.05,
      y: (c.y / 1000) * h * 0.9 + h * 0.05,
      vx: 0,
      vy: 0,
      radius: Math.max(8, Math.min(40, 8 + Math.sqrt(c.size) * 2)),
      isCenter: false,
      _clusterIndex: c.index,
    }));

    this.edges = (data.edges || []).map((e: any) => ({
      source: e.source,
      target: e.target,
      type: "cluster_link",
    }));

    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
    this.simRunning = false;
    this.draw();
  }

  async drillIntoCluster(clusterIndex: number): Promise<void> {
    this.drawEmpty("Loading cluster detail...");
    const data = await this.apiClient.clusterDetail(clusterIndex);
    if (!data || data.nodes.length === 0) {
      this.drawEmpty("Empty cluster");
      return;
    }

    const w = this.canvas!.width;
    const h = this.canvas!.height;

    this.nodes = data.nodes.map((n: any) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      score: n.degree,
      x: (n.x / 1000) * w * 0.9 + w * 0.05,
      y: (n.y / 1000) * h * 0.9 + h * 0.05,
      vx: 0,
      vy: 0,
      radius: Math.max(4, Math.min(16, 4 + (n.degree || 0) * 0.1)),
      isCenter: false,
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

  async loadFullGraph(): Promise<void> {
    this.drawEmpty("Loading full graph...");
    const data = await this.apiClient.fullGraph();
    if (!data || data.nodes.length === 0) {
      this.drawEmpty("No graph data");
      return;
    }

    // 사전 계산된 좌표 사용 — 시뮬레이션 불필요
    const w = this.canvas!.width;
    const h = this.canvas!.height;

    this.nodes = data.nodes.map((n: any) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      score: n.degree,
      x: (n.x / 1000) * w * 0.9 + w * 0.05,
      y: (n.y / 1000) * h * 0.9 + h * 0.05,
      vx: 0,
      vy: 0,
      radius: Math.max(3, Math.min(16, 3 + (n.degree || 0) * 0.05)),
      isCenter: false,
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
  private buildGraph(nodes: SubgraphNode[], edges: SubgraphEdge[], centerPath: string): void {
    const w = this.canvas!.width;
    const h = this.canvas!.height;
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
      isCenter: n.id === centerPath,
    }));

    this.edges = edges;
    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
  }

  // ===== Force-directed 시뮬레이션 =====
  private runSimulation(): void {
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

  private simulateStep(): void {
    const alpha = Math.max(0.01, 1 - this.simIterations / 200);
    const nodes = this.nodes;
    const repulsion = 3000;
    const springLen = 120;
    const springK = 0.02;
    const centerGravity = 0.01;
    const w = this.canvas!.width / 2;
    const h = this.canvas!.height / 2;

    // Repulsion (all pairs)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force * alpha;
        const fy = (dy / dist) * force * alpha;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    // Spring (edges)
    for (const e of this.edges) {
      const a = this.nodeMap.get(e.source);
      const b = this.nodeMap.get(e.target);
      if (!a || !b) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - springLen) * springK * alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    // Center gravity
    for (const n of nodes) {
      n.vx += (w - n.x) * centerGravity * alpha;
      n.vy += (h - n.y) * centerGravity * alpha;
      // Damping
      n.vx *= 0.85;
      n.vy *= 0.85;
      if (!n.isCenter || this.simIterations > 5) {
        n.x += n.vx;
        n.y += n.vy;
      }
    }
  }

  // ===== 렌더링 =====
  private draw(): void {
    const ctx = this.ctx!;
    const canvas = this.canvas!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // 엣지
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

    // 노드
    for (const n of this.nodes) {
      const color = TYPE_COLORS[n.type] || DEFAULT_COLOR;
      const isHovered = this.hoveredNode === n;

      // Glow for center
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
      ctx.strokeStyle = isHovered ? "#ffffff" : (this.isDarkTheme() ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)");
      ctx.lineWidth = isHovered ? 2.5 : 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = this.isDarkTheme() ? "#e0e0e0" : "#333333";
      ctx.font = n.isCenter ? "bold 11px sans-serif" : "10px sans-serif";
      ctx.textAlign = "center";
      const label = n.name.length > 20 ? n.name.slice(0, 18) + "…" : n.name;
      ctx.fillText(label, n.x, n.y + n.radius + 14);
    }

    ctx.restore();

    // 툴팁
    if (this.hoveredNode) {
      this.drawTooltip(this.hoveredNode);
    }
  }

  private drawTooltip(n: GraphNode): void {
    const ctx = this.ctx!;
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

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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

  private drawEmpty(msg: string): void {
    const ctx = this.ctx!;
    const canvas = this.canvas!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = this.isDarkTheme() ? "#999" : "#666";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
  }

  // ===== 인터랙션 =====
  private setupInteraction(): void {
    const c = this.canvas!;

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
        // 클릭 (드래그 아님) → 노트 열기
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
        if ((node as any)._clusterIndex != null) {
          // 클러스터 → 드릴다운
          this.drillIntoCluster((node as any)._clusterIndex);
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

  private hitTest(mx: number, my: number): GraphNode | null {
    const x = (mx - this.offsetX) / this.scale;
    const y = (my - this.offsetY) / this.scale;
    // Reverse order so top-drawn nodes are hit first
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const dx = x - n.x, dy = y - n.y;
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) return n;
    }
    return null;
  }

  private openNote(id: string): void {
    // id는 파일 경로 (예: "folder/note.md")
    const file = this.app.vault.getAbstractFileByPath(id);
    if (file) {
      this.app.workspace.openLinkText(id, "", true);
    }
  }

  private fitToView(): void {
    if (this.nodes.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      minX = Math.min(minX, n.x - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    }
    const pad = 40;
    const w = this.canvas!.width;
    const h = this.canvas!.height;
    const gw = maxX - minX + pad * 2;
    const gh = maxY - minY + pad * 2;
    this.scale = Math.min(w / gw, h / gh, 2);
    this.offsetX = w / 2 - ((minX + maxX) / 2) * this.scale;
    this.offsetY = h / 2 - ((minY + maxY) / 2) * this.scale;
    this.draw();
  }

  // ===== 유틸 =====
  private resizeCanvas(): void {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    if (!this.simRunning) this.draw();
  }

  private isDarkTheme(): boolean {
    return document.body.classList.contains("theme-dark");
  }
}
