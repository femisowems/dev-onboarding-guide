# 🧠 Codebase Onboarding Bot

A production-quality CLI tool and Web UI that analyzes any GitHub repository or local codebase, generating a structured onboarding experience using AST parsing (`ts-morph`) and AI summarization (OpenAI).

## Features

- **Repo Ingestion**: Instantly clones shallow copies of GitHub repos.
- **AST Parsing**: Parses TypeScript/JavaScript code using the TypeScript Compiler API (`ts-morph`) to detect entry points and module structures.
- **Dependency Graph Built**: Intelligently traces internal and external module dependencies.
- **AI Architecture Summaries**: Utilizes the Vercel AI SDK to generate high-level architectures, key module behaviors, and strict onboarding paths.
- **Premium Output**: Beautiful CLI (`@clack/prompts`) & Web UI (React + Tailwind).

## Quick Start

### 1. Prerequisites

You will need an OpenAI API key.

```bash
cp .env.example .env
# Edit .env and supply your OPENAI_API_KEY
```

### 2. Install Dependencies

You'll need to install dependencies for both the Backend/CLI and the Frontend.

```bash
# Install backend & CLI dependencies
npm install

# Install Web UI dependencies
npm run web:install
```

### 3. Running the Web UI (Recommended)

Start the internal Express API server, then start the Vite React frontend.

```bash
# Terminal 1: Start Backend API
npm run dev

# Terminal 2: Start Frontend UI
npm run web:dev
```

Visit `http://localhost:5173` in your browser.

### 4. Running the CLI

If you prefer exploring directly from your terminal with beautiful CLI blocks:

```bash
npm run dev -- analyze https://github.com/your/repo
```

## Tech Stack

- **Backend**: Node.js, TypeScript, Commander.js, ts-morph, Vercel AI SDK
- **Frontend**: Vite, React, Tailwind CSS, Lucide React
