# Development Environment

This document records the tools and versions used to develop Taf EMS, and how to check them.

## Computer

- MacBook Air, Apple M4 chip, macOS
- Editor: Visual Studio Code
- Terminal shell: zsh

## Tools and versions

| Tool | Version | Check with |
|---|---|---|
| Node.js | v24.19.0 | `node -v` |
| npm | 11.17.0 | `npm -v` |
| Git | 2.39.5 | `git --version` |
| PostgreSQL | 17.10 | `psql --version` |
| Postman | Desktop app | Open from Applications |

## PostgreSQL

- This project uses **PostgreSQL 17** on **port 5432**.
- PostgreSQL 18 is also installed on this Mac (port 5433), but it is **not used** by this project.
- Check that the server is running:

```bash
pg_isready -p 5432
```

Expected result: `/tmp:5432 - accepting connections`

- Database passwords are **never** written in this repository. They will be stored in a `.env` file, which Git ignores.

## VS Code extensions

These are listed in `.vscode/extensions.json`, so VS Code suggests them automatically when the project is opened.

| Extension | Purpose |
|---|---|
| ESLint | Finds mistakes in JavaScript while typing |
| Prettier | Formats code consistently |
| Prisma | Highlights and checks `schema.prisma` |
| DotENV | Highlights `.env` files |

## Git workflow

- `main` holds finished, working code only.
- Each phase is developed on its own branch, for example `phase-1-setup`.
- When a phase is complete, it is merged into `main` and pushed to GitHub.
- Commit messages start with a type:
  - `docs:` documentation
  - `feat:` new feature
  - `fix:` bug fix
  - `chore:` setup and maintenance