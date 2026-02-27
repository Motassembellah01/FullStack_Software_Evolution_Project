# PolyQuiz-Social-Gaming-Platform

PolyQuiz is a real-time multiplayer quiz platform with an Electron + Angular client and a NestJS backend.

This repository is organized for local development, architecture presentation, and cloud deployment.

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Quick Start (Local)](#quick-start-local)
- [Environment Variables](#environment-variables)
- [Development Commands](#development-commands)
- [Testing and Code Quality](#testing-and-code-quality)
- [API Documentation](#api-documentation)
- [Additional Documentation](#additional-documentation)
- [Security Notes for Public Repos](#security-notes-for-public-repos)

## Project Overview

Core features include:

- Real-time quiz matches with WebSocket synchronization
- Match hosting, joining, observer mode, and score tracking
- Friend requests and social features
- Global and match-based chat
- User profile customization (avatars, themes, language)
- Auth0-based authentication and account sync

## Tech Stack

- **Client:** Angular 18, Electron 32, Angular Material, Socket.IO client
- **Server:** NestJS 10, Socket.IO, Mongoose
- **Data:** MongoDB + Redis
- **Auth:** Auth0 (JWT + sync endpoint)
- **Tooling:** ESLint, Prettier, Jest (server), Jasmine/Karma (client)

## Repository Structure

```text
.
├── client/                     # Electron + Angular desktop client
├── server/                     # NestJS backend API + WebSocket gateways
├── common/                     # Shared models/types
└── README.md
```

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- MongoDB instance
- Redis instance
- Auth0 tenant and application/API configuration

## Quick Start (Local)

### 1) Install dependencies

```bash
cd client && npm install
cd ../server && npm install
```

### 2) Create environment files

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Update both files with your own values before running the app.

### 3) Run the backend

```bash
cd server
npm run start
```

Server default URL: `http://localhost:3000`  
Swagger docs: `http://localhost:3000/api/docs`

### 4) Run the client (Electron workflow)

In one terminal:

```bash
cd client
npm run build:dev
```

In a second terminal:

```bash
cd client
npm run electron
```

## Environment Variables

Templates are provided:

- `client/.env.example`
- `server/.env.example`

Do not commit real secrets. Use local `.env` files and secure secret management in production.

## Development Commands

### Client (`client/`)

- `npm start` - Angular dev server (browser mode)
- `npm run build:dev` - Angular dev build in watch mode
- `npm run build:prod` - Angular production build
- `npm run electron` - Run Electron shell
- `npm run electron:build` - Build production desktop package
- `npm run lint` - Lint client code
- `npm run test` - Run unit tests

### Server (`server/`)

- `npm run start` - NestJS watch mode
- `npm run build` - Build to `out/`
- `npm run start:prod` - Run built server
- `npm run lint` - Lint server code
- `npm run test` - Run unit/integration tests
- `npm run coverage` - Generate coverage report

## Testing and Code Quality

Recommended before opening a PR:

- Run linters in both `client/` and `server/`
- Run tests in both `client/` and `server/`
- Keep commits focused and descriptive

## API Documentation

When the server is running locally:

- Swagger/OpenAPI UI: `http://localhost:3000/api/docs`

## Additional Documentation

- `SETUP_OWNERSHIP.md` - Environment and ownership setup

## Security Notes for Public Repos

- Never commit real `.env` files, credentials, private keys, or secrets
- Keep only safe templates such as `.env.example`
- Rotate any credential that was ever committed in history
- Validate that deployment scripts and docs do not contain account-specific secrets
