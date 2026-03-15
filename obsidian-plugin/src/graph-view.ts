import { ItemView, Notice, SuggestModal, WorkspaceLeaf } from "obsidian";
import type {
  ClusterInfo,
  LineageAmbiguousDetail,
  LineageCandidate,
  LineageResponse,
  MnemoApiClient,
  SubgraphEdge,
  SubgraphNode,
  SubgraphNodeWithLayout,
} from "./api-client";

export const MNEMO_GRAPH_VIEW_TYPE = "mnemo-graph-view";

const TYPE_COLORS: Record<string, string> = {
  event: "#4A90D9",
  project: "#E8913A",
  note: "#50C878",
  source: "#9B59B6",
  decision: "#E74C3C",
  insight: "#F1C40F",
  tool: "#16A085",
  concept: "#5C7CFA",
  person: "#EC4899",
  unknown: "#888888",
};
const DEFAULT_COLOR = "#888888";

const LINEAGE_COLORS = {
  center: "#B388FF",
  upstream: "#F5B342",
  downstream: "#4DD0E1",
  bridge: "#7C3AED",
  unknown: "#8A8F98",
} as const;

type GraphViewMode = "lineage" | "local" | "full" | "cluster";
type LineageRole = keyof typeof LINEAGE_COLORS;

interface GraphNode {
  id: string;
  name: string;
  type: string;
  score?: number;
  path?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isCenter: boolean;
  lineageRole?: LineageRole;
  lineageDepth?: number;
  _clusterIndex?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight?: number;
}

class LineageCandidateModal extends SuggestModal<LineageCandidate> {
  private resolver: ((candidate: LineageCandidate | null) => void) | null = null;
  private settled = false;

  constructor(
    app: ItemView["app"],
    private readonly detail: LineageAmbiguousDetail
  ) {
    super(app);
    this.setPlaceholder(`Choose lineage target for "${detail.query}"`);
    this.setInstructions([
      { command: "??", purpose: "move" },
      { command: "?", purpose: "select" },
      { command: "esc", purpose: "cancel" },
    ]);
  }

  pick(): Promise<LineageCandidate | null> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.open();
    });
  }

  getSuggestions(query: string): LineageCandidate[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.detail.candidates;
    }
    return this.detail.candidates.filter((candidate) => {
      const haystacks = [candidate.name, candidate.path, candidate.entity_type, candidate.match_kind]
        .map((value) => value.toLowerCase());
      return haystacks.some((value) => value.includes(normalized));
    });
  }

  renderSuggestion(candidate: LineageCandidate, el: HTMLElement): void {
    const container = el.createDiv({ cls: "mnemo-lineage-candidate" });
    container.createEl("div", { text: candidate.name, cls: "mnemo-lineage-candidate-title" });
    container.createEl("small", {
      text: `${candidate.entity_type} ? ${candidate.match_kind} ? score ${candidate.score}`,
      cls: "mnemo-lineage-candidate-meta",
    });
    container.createEl("div", { text: candidate.path, cls: "mnemo-lineage-candidate-path" });
  }

  onChooseSuggestion(candidate: LineageCandidate): void {
    this.settled = true;
    this.resolver?.(candidate);
    this.resolver = null;
  }

  override onClose(): void {
    super.onClose();
    if (!this.settled) {
      this.resolver?.(null);
      this.resolver = null;
    }
  }
}

export class MnemoGraphView extends ItemView {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private nodeMap: Map<string, GraphNode> = new Map();

  private offsetX = 0;
  private offsetY = 0;
  private scale = 1;

  private dragNode: GraphNode | null = null;
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private lastMouse = { x: 0, y: 0 };
  private hoveredNode: GraphNode | null = null;
  private animFrame = 0;
  private simRunning = false;
  private simIterations = 0;

  private centerPath = "";
  private viewMode: GraphViewMode = "lineage";
  private clusterData: ClusterInfo[] = [];
  private backBtn: HTMLElement | null = null;
  private allBtns: HTMLElement[] = [];
  private statusEl: HTMLElement | null = null;
  private legendEl: HTMLElement | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private apiClient: MnemoApiClient
  ) {
    super(leaf);
  }

  getViewType(): string {
    return MNEMO_GRAPH_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Mnemo graph";
  }

  getIcon(): string {
    return "git-fork";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("mnemo-graph-container");

    const toolbar = container.createDiv({ cls: "mnemo-graph-toolbar" });
    toolbar.createEl("span", { text: "Mnemo graph", cls: "mnemo-graph-title" });

    const lineageBtn = toolbar.createEl("button", {
      text: "🧬 lineage",
      cls: "mnemo-graph-btn mnemo-graph-btn-active",
      attr: { title: "Current note lineage" },
    });
    lineageBtn.addEventListener("click", () => {
      this.setActiveBtn(lineageBtn);
      this.viewMode = "lineage";
      void this.loadLineage();
    });

    const localBtn = toolbar.createEl("button", {
      text: "📍 local",
      cls: "mnemo-graph-btn",
      attr: { title: "Current note neighborhood" },
    });
    localBtn.addEventListener("click", () => {
      this.setActiveBtn(localBtn);
      this.viewMode = "local";
      void this.loadGraph();
    });

    const clusterBtn = toolbar.createEl("button", {
      text: "🔮 explore",
      cls: "mnemo-graph-btn",
      attr: { title: "Explore by clusters" },
    });
    clusterBtn.addEventListener("click", () => {
      this.setActiveBtn(clusterBtn);
      this.viewMode = "cluster";
      void this.loadClusters();
    });

    const fullBtn = toolbar.createEl("button", {
      text: "🌐 full",
      cls: "mnemo-graph-btn",
      attr: { title: "Full knowledge graph" },
    });
    fullBtn.addEventListener("click", () => {
      this.setActiveBtn(fullBtn);
      this.viewMode = "full";
      void this.loadFullGraph();
    });

    this.backBtn = toolbar.createEl("button", {
      text: "← back",
      cls: "mnemo-graph-btn",
      attr: { title: "Back to clusters" },
    });
    this.backBtn.hide();
    this.backBtn.addEventListener("click", () => {
      this.backBtn?.hide();
      void this.loadClusters();
    });

    this.allBtns = [lineageBtn, localBtn, clusterBtn, fullBtn];

    const refreshBtn = toolbar.createEl("button", {
      text: "↻",
      cls: "mnemo-graph-btn",
      attr: { title: "Refresh" },
    });
    refreshBtn.addEventListener("click", () => {
      void this.refreshCurrentView();
    });

    const fitBtn = toolbar.createEl("button", {
      text: "⊡",
      cls: "mnemo-graph-btn",
      attr: { title: "Fit to view" },
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

  onClose(): Promise<void> {
    this.simRunning = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
    }
    return Promise.resolve();
  }

  async loadGraph(path?: string): Promise<void> {
    const activePath = this.getRequestedPath(path);
    if (!activePath) {
      this.setStatus("Open a note to inspect its graph neighborhood");
      this.drawEmpty("Open a note, then refresh");
      return;
    }

    this.centerPath = activePath;
    this.renderLegend();
    this.setStatus("Current note neighborhood · depth 1");

    const apiPath = this.normalizePath(activePath);
    const data = await this.apiClient.subgraph(apiPath, 1);
    if (!data || data.nodes.length === 0) {
      this.drawEmpty("No graph data for this note");
      return;
    }

    let nodes = data.nodes;
    let edges = data.edges;
    if (nodes.length > 80) {
      const keep = new Set<string>();
      const centerNode = nodes.find((n) => this.matchesPath(n.id, undefined, [activePath, apiPath]));
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
    this.setStatus(`Current note neighborhood · ${this.nodes.length} nodes · ${this.edges.length} edges`);
  }

  async loadLineage(path?: string): Promise<void> {
    const activePath = this.getRequestedPath(path);
    if (!activePath) {
      this.setStatus("Open a note to inspect its lineage");
      this.drawEmpty("Open a note, then refresh");
      return;
    }

    this.centerPath = activePath;
    this.renderLegend();
    this.setStatus("Current note lineage · depth 2 · both directions");
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
    this.setStatus(`Current note lineage · ${this.nodes.length} nodes · ${this.edges.length} edges`);
  }

  private async resolveAmbiguousLineage(detail: LineageAmbiguousDetail): Promise<void> {
    this.setStatus(`Lineage reference is ambiguous ? ${detail.candidates.length} candidates`);
    const picker = new LineageCandidateModal(this.app, detail);
    const selected = await picker.pick();
    if (!selected) {
      this.drawEmpty("Lineage selection canceled");
      return;
    }

    new Notice(`Loading lineage for ${selected.name}`);
    await this.loadLineage(selected.id);
  }

  setCenterPath(path: string): void {
    this.centerPath = path;
    void this.refreshCurrentView(path);
  }

  private async refreshCurrentView(path?: string): Promise<void> {
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

  private setActiveBtn(active: HTMLElement): void {
    for (const btn of this.allBtns) {
      btn.removeClass("mnemo-graph-btn-active");
    }
    active.addClass("mnemo-graph-btn-active");
    if (this.backBtn) {
      this.backBtn.hide();
    }
    this.renderLegend();
  }

  async loadClusters(): Promise<void> {
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

    this.nodes = data.clusters.map((c: ClusterInfo) => ({
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

    this.edges = (data.edges ?? []).map((e) => ({
      source: e.source,
      target: e.target,
      type: "cluster_link",
    }));

    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.resetViewport();
    this.simRunning = false;
    this.draw();
    this.setStatus(`Cluster explorer · ${this.clusterData.length} clusters`);
  }

  async drillIntoCluster(clusterIndex: number): Promise<void> {
    this.renderLegend();
    this.setStatus(`Cluster detail · #${clusterIndex}`);
    this.drawEmpty("Loading cluster detail...");

    const data = await this.apiClient.clusterDetail(clusterIndex);
    if (!data || data.nodes.length === 0) {
      this.drawEmpty("Empty cluster");
      return;
    }

    const canvas = this.ensureCanvas();
    const w = canvas.width;
    const h = canvas.height;

    this.nodes = data.nodes.map((n: SubgraphNodeWithLayout) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      score: n.degree,
      x: ((n.x ?? 0) / 1000) * w * 0.9 + w * 0.05,
      y: ((n.y ?? 0) / 1000) * h * 0.9 + h * 0.05,
      vx: 0,
      vy: 0,
      radius: Math.max(4, Math.min(16, 4 + (n.degree || 0) * 0.1)),
      isCenter: false,
    }));

    this.edges = data.edges;
    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.resetViewport();
    this.simRunning = false;
    this.backBtn?.show();
    this.draw();
    this.setStatus(`Cluster detail · ${this.nodes.length} nodes · ${this.edges.length} edges`);
  }

  async loadFullGraph(): Promise<void> {
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

    this.nodes = data.nodes.map((n: SubgraphNodeWithLayout) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      score: n.degree,
      x: ((n.x ?? 0) / 1000) * w * 0.9 + w * 0.05,
      y: ((n.y ?? 0) / 1000) * h * 0.9 + h * 0.05,
      vx: 0,
      vy: 0,
      radius: Math.max(3, Math.min(16, 3 + (n.degree || 0) * 0.05)),
      isCenter: false,
    }));

    this.edges = data.edges;
    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.resetViewport();
    this.simRunning = false;
    this.draw();
    this.setStatus(`Full knowledge graph · ${this.nodes.length} nodes · ${this.edges.length} edges`);
  }

  private buildGraph(nodes: SubgraphNode[], edges: SubgraphEdge[], centerCandidates: string[]): void {
    const canvas = this.ensureCanvas();
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    this.nodes = nodes.map((n) => {
      const isCenter = this.matchesPath(n.id, undefined, centerCandidates);
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
        isCenter,
      };
    });

    this.edges = edges;
    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.resetViewport();
  }

  private buildLineageGraph(data: LineageResponse, centerCandidates: string[]): void {
    const canvas = this.ensureCanvas();
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    const normalizedCenter = this.normalizePath(data.center);
    const allCenterCandidates = [...centerCandidates, normalizedCenter];

    const upstream = data.nodes
      .filter((node) => this.normalizeLineageRole(node.lineage_role) === "upstream")
      .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
    const downstream = data.nodes
      .filter((node) => this.normalizeLineageRole(node.lineage_role) === "downstream")
      .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
    const bridge = data.nodes
      .filter((node) => this.normalizeLineageRole(node.lineage_role) === "bridge")
      .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
    const other = data.nodes
      .filter((node) => {
        const role = this.normalizeLineageRole(node.lineage_role);
        return role !== "center" && role !== "upstream" && role !== "downstream" && role !== "bridge";
      })
      .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));

    const positions = new Map<string, { x: number; y: number }>();

    const placeLine = (
      group: typeof data.nodes,
      direction: -1 | 0 | 1,
      verticalOffset: number = 0
    ): void => {
      const depthBuckets = new Map<number, typeof data.nodes>();
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
            y: count === 1 ? cy + verticalOffset : startY + index * step,
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
        lineageDepth: node.depth,
      };
    });

    this.edges = data.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      weight: edge.weight,
    }));

    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.resetViewport();
  }

  private runSimulation(): void {
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

  private simulateStep(): void {
    const alpha = Math.max(0.01, 1 - this.simIterations / 200);
    const nodes = this.nodes;
    const repulsion = 3000;
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
        const fx = (dx / dist) * force * alpha;
        const fy = (dy / dist) * force * alpha;
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
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
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

  private draw(): void {
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
      const roleColor = this.viewMode === "lineage"
        ? LINEAGE_COLORS[n.lineageRole ?? "unknown"]
        : typeColor;

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
        ctx.strokeStyle = isHovered
          ? "#ffffff"
          : this.isDarkTheme()
            ? "rgba(255,255,255,0.3)"
            : "rgba(0,0,0,0.2)";
        ctx.lineWidth = isHovered ? 2.5 : 1;
        ctx.stroke();
      }

      ctx.fillStyle = this.isDarkTheme() ? "#e0e0e0" : "#333333";
      ctx.font = n.isCenter ? "bold 11px sans-serif" : "10px sans-serif";
      ctx.textAlign = "center";
      if (isHovered || n.isCenter) {
        const label = n.name.length > 40 ? `${n.name.slice(0, 38)}…` : n.name;
        ctx.fillText(label, n.x, n.y + n.radius + 14);
      } else if (this.scale > 0.75 && n.radius >= 5) {
        const short = n.name.length > 12 ? `${n.name.slice(0, 10)}…` : n.name;
        ctx.fillText(short, n.x, n.y + n.radius + 14);
      }
    }

    ctx.restore();

    if (this.hoveredNode) {
      this.drawTooltip(this.hoveredNode);
    }
  }

  private getEdgeStyle(a: GraphNode, b: GraphNode, edge: GraphEdge): {
    color: string;
    width: number;
    dash: number[];
    arrow: boolean;
  } {
    if (this.viewMode === "lineage") {
      const role = this.pickLineageEdgeRole(a, b);
      return {
        color: this.withAlpha(LINEAGE_COLORS[role], this.isDarkTheme() ? 0.65 : 0.8),
        width: Math.max(1.5, Math.min(4, 1.2 + (edge.weight ?? 1) * 0.7)),
        dash: [],
        arrow: true,
      };
    }

    if (edge.type === "related") {
      return {
        color: this.isDarkTheme() ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
        width: 1.5,
        dash: [6, 4],
        arrow: false,
      };
    }
    if (edge.type === "tag_shared") {
      return {
        color: this.isDarkTheme() ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
        width: 1.2,
        dash: [3, 5],
        arrow: false,
      };
    }

    return {
      color: this.isDarkTheme() ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
      width: 1.5,
      dash: [],
      arrow: false,
    };
  }

  private drawArrowHead(ctx: CanvasRenderingContext2D, source: GraphNode, target: GraphNode, color: string): void {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) {
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

  private drawTooltip(n: GraphNode): void {
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

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
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

  private setupInteraction(): void {
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

  private hitTest(mx: number, my: number): GraphNode | null {
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

  private openNote(node: GraphNode): void {
    const file = this.resolveFileForNode(node);
    if (file) {
      void this.app.workspace.getLeaf(true).openFile(file);
    }
  }

  private resolveFileForNode(node: GraphNode) {
    const candidates = [node.path, node.id, `${node.path ?? ""}.md`, `${node.id}.md`]
      .filter((candidate): candidate is string => Boolean(candidate))
      .map((candidate) => candidate.replace(/^\/+/, ""));

    for (const candidate of candidates) {
      const file = this.app.vault.getFileByPath(candidate);
      if (file) {
        return file;
      }
    }
    return null;
  }

  private fitToView(): void {
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
    this.offsetX = w / 2 - ((minX + maxX) / 2) * this.scale;
    this.offsetY = h / 2 - ((minY + maxY) / 2) * this.scale;
    this.draw();
  }

  private resizeCanvas(): void {
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

  private setStatus(text: string): void {
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }

  private renderLegend(): void {
    if (!this.legendEl) {
      return;
    }

    this.legendEl.empty();
    if (this.viewMode !== "lineage") {
      this.legendEl.hide();
      return;
    }

    this.legendEl.show();
    const items: Array<{ key: LineageRole; label: string }> = [
      { key: "center", label: "Center" },
      { key: "upstream", label: "Upstream" },
      { key: "downstream", label: "Downstream" },
      { key: "bridge", label: "Bridge" },
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

  private normalizeLineageRole(role?: string): LineageRole {
    const normalized = (role ?? "").toLowerCase();
    if (normalized === "center" || normalized === "upstream" || normalized === "downstream" || normalized === "bridge") {
      return normalized;
    }
    return "unknown";
  }

  private pickLineageEdgeRole(a: GraphNode, b: GraphNode): LineageRole {
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

  private normalizePath(path: string): string {
    return path.replace(/\.md$/i, "").replace(/^\/+/, "");
  }

  private matchesPath(id: string, path: string | undefined, candidates: string[]): boolean {
    const normalizedCandidates = candidates.map((candidate) => this.normalizePath(candidate));
    return normalizedCandidates.includes(this.normalizePath(id))
      || (path ? normalizedCandidates.includes(this.normalizePath(path)) : false);
  }

  private getRequestedPath(path?: string): string {
    if (path) {
      return path;
    }
    if (this.centerPath) {
      return this.centerPath;
    }
    const file = this.app.workspace.getActiveFile();
    return file?.path ?? "";
  }

  private resetViewport(): void {
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
  }

  private withAlpha(hexColor: string, alpha: number): string {
    const color = hexColor.replace("#", "");
    if (color.length !== 6) {
      return hexColor;
    }
    const r = Number.parseInt(color.slice(0, 2), 16);
    const g = Number.parseInt(color.slice(2, 4), 16);
    const b = Number.parseInt(color.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private capitalize(value: string): string {
    return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
  }

  private ensureCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      throw new Error("Graph canvas is not ready");
    }
    return this.canvas;
  }

  private ensureContext(): CanvasRenderingContext2D {
    if (!this.ctx) {
      throw new Error("Graph canvas context is not ready");
    }
    return this.ctx;
  }

  private isDarkTheme(): boolean {
    return document.body.classList.contains("theme-dark");
  }
}
