# pi-order-processing

> Launch a browser-based chat UI for the DK Hardware Order Processing knowledge base — all skills and vendor data auto-loaded.

## What it does

1. **Clones** (or pulls) the `order-processing` GitHub repo to `~/.pi-order-processing/`
2. **Auto-loads** all 6 skills (`vendor-lookup`, `draft-claim-email`, `update-vendor-info`, etc.)
3. **Auto-loads** the CLAUDE.md as context so pi knows all ~103 vendors, their contacts, shipping rules, and SOPs
4. **Starts a web server** with a browser UI — session management, streaming responses, and conversation history

## Install

```bash
# From this directory
npm install -g .

# Or via npm (once published)
npm install -g @dkhardware/pi-order-processing
```

## Usage

```bash
pi-order-processing
```

On first run, it clones the knowledge base (~2 seconds). On subsequent runs, it pulls the latest changes. Then it starts a web server and prints the URL — open it in your browser.

Type your question like:
- "What's the minimum order value for Deltana?"
- "Can we dropship with Cal-Royal?"
- "Draft a claim email for a damaged IML shipment"
- "Update Hafele's phone number to 954-555-1234"

## How it works

The cloned repo contains `.pi/settings.json` with:
```json
{ "skills": ["plugin/skills"] }
```

This tells pi's `DefaultResourceLoader` to scan `plugin/skills/` at startup. The `CLAUDE.md` in the repo root is auto-discovered as an `AGENTS.md` context file. Sessions are saved to `~/.pi-order-processing/sessions/` and persist across restarts.

## Requirements

- Node.js ≥ 18
- Git
- pi (`npm install -g @mariozechner/pi-coding-agent`)
- An API key configured for your preferred LLM provider
