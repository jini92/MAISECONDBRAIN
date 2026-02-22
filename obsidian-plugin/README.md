# Mnemo SecondBrain

Personal knowledge graph with hybrid search (keyword + vector + graph) for your Obsidian vault. Powered by [Mnemo](https://github.com/jini92/MAISECONDBRAIN).

![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=8b6cef&label=downloads&query=%24%5B%22mnemo-secondbrain%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)

## Features

- **Hybrid Search** (`Ctrl+Shift+M`): Combines keyword, vector (semantic), and graph-based search for highly relevant results
- **Knowledge Graph View**: Visualize connections between your notes (in development)
- **Server Status**: Check Mnemo API server connectivity from within Obsidian

<!-- TODO: Add screenshots -->

## Prerequisites

This plugin requires a running **Mnemo API server**. Start it with a single command — no cloning or manual setup needed.

**Option 1 — uvx (recommended, requires [uv](https://docs.astral.sh/uv/))**

```bash
uvx --from mnemo-secondbrain mnemo start /path/to/your/vault
```

**Option 2 — pip**

```bash
pip install mnemo-secondbrain
mnemo start /path/to/your/vault
```

**Option 3 — Docker**

```bash
docker run -p 7890:7890 -v /path/to/your/vault:/vault jini92/mnemo /vault
```

The server starts at `http://localhost:7890`. Keep this terminal open while using the plugin.

## Installation

### From Community Plugins (Recommended)

1. Open Obsidian → Settings → Community plugins
2. Click **Browse** and search for **"Mnemo SecondBrain"**
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/jini92/MAISECONDBRAIN/releases/latest)
2. Copy them to your vault: `.obsidian/plugins/mnemo-secondbrain/`
3. Obsidian → Settings → Community plugins → Enable **Mnemo SecondBrain**

### Build from Source

```bash
cd obsidian-plugin
npm install
npm run build
```

Copy `main.js`, `manifest.json`, `styles.css` to `.obsidian/plugins/mnemo-secondbrain/`.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| API URL | `http://127.0.0.1:8000` | Mnemo FastAPI server address |
| Search limit | `10` | Maximum number of search results |
| Search mode | `hybrid` | `hybrid` / `vector` / `keyword` / `graph` |

## Usage

1. Start the Mnemo API server
2. In Obsidian, press `Ctrl+Shift+M` (or `Cmd+Shift+M` on macOS)
3. Type your search query
4. Select a result to open the corresponding note

## FAQ

**Q: Does this work on mobile?**
A: The plugin itself is mobile-compatible, but you need network access to a running Mnemo API server. If your server is accessible over the network (not just localhost), it will work on mobile.

**Q: Is my data sent to external servers?**
A: No. All data stays between Obsidian and your self-hosted Mnemo server. No telemetry or external calls.

**Q: What if the server is not running?**
A: The plugin will show a connection error. Search functionality requires the Mnemo server to be running.

## License

[MIT](../LICENSE)
