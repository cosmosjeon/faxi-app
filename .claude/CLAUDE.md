# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FAXI is a Korean messaging application that combines digital messaging with analog printing experiences. The app allows users to send messages that can be printed on physical devices, creating a unique "analog-digital" communication experience.

## Development Commands

### Common Commands
- `npm run dev` or `pnpm dev` - Start development server with Turbopack
- `npm run build` or `pnpm build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Service Worker Generation
The project uses a service worker configuration that must be generated before running:
- `node scripts/generate-sw-config.cjs` - Generate service worker configuration
- This runs automatically via `predev` and `prebuild` scripts

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn UI components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (OAuth with Google/Kakao)
- **State Management**: Zustand stores + React Query
- **Real-time**: Supabase Realtime
- **Push Notifications**: Firebase Cloud Messaging
- **Mobile**: TWA (Trusted Web App) for Android

### Directory Structure

#### Core Application (`/src/app`)
- App Router structure with route groups: `(auth)` and `(main)`
- Protected routes: `/home`, `/friends`, `/messages`, `/profile`, `/printer`
- Authentication routes: `/login`, `/onboarding`

#### Components (`/src/components`)
- `ui/` - Shadcn UI components (button, card, dialog, etc.)
- `domain/` - Feature-specific components (friends, messages, navigation)
- Provider components for authentication, realtime, and push notifications

#### Features (`/src/features`)
- Domain-driven modules: `friends/`, `messages/`, `settings/`
- Each module contains: `api.ts`, `types.ts`, validators, services
- `constants.ts` - Application-wide constants and error messages

#### State Management (`/src/stores`)
- `auth.store.ts` - Zustand store for authentication state
- `printer.store.ts` - Printer connection and state
- `realtimeStore.ts` - Real-time data synchronization

#### Libraries (`/src/lib`)
- `supabase/` - Database client configuration (client.ts, server.ts, realtime.ts)
- Utility libraries for Firebase, image processing, performance optimization

### Authentication Architecture

**OAuth Flow**: Uses Supabase implicit flow with Google/Kakao providers
- Middleware-based route protection (`middleware.ts`)
- Session management with automatic token refresh
- Profile completion flow via `/onboarding`

**Key Files**:
- `middleware.ts` - Route protection and authentication checks
- `src/stores/auth.store.ts` - Authentication state management
- `src/app/auth/callback/route.ts` - OAuth callback handler

### Real-time Features

**Supabase Realtime**: Used for live message updates and friend status
**Push Notifications**: Firebase integration for background notifications
**Service Worker**: Handles background sync and offline capabilities

### Database Schema

Located in `/supabase/migrations/`:
- User management and profiles
- Friend relationships and close friend system
- Message system with status tracking
- Push notification tokens
- Privacy settings and user presence

### TWA (Trusted Web App)

Android app wrapper located in `/faxi-twa/`:
- Gradle build configuration
- Asset links for domain verification
- Android-specific resources and manifest

## Development Guidelines

### Authentication
- All protected routes require authentication via middleware
- Use `useAuthStore()` for authentication state
- OAuth redirects go through `/auth/callback`

### Database Operations
- Use React Query for data fetching and caching
- Supabase client for database operations
- Real-time subscriptions for live updates

### State Management
- Zustand for global state (auth, printer, realtime)
- React Query for server state caching
- Local component state for UI-only state

### API Constants
- Use constants from `src/features/constants.ts`
- Error messages are centralized in `ERROR_MESSAGES`
- Limits and constraints are defined as constants

### Real-time Integration
- Subscribe to database changes via Supabase Realtime
- Handle connection state in `RealtimeProvider`
- Sync data changes across components

### Code Style
- TypeScript strict mode enabled
- ESLint configuration for Next.js
- Tailwind CSS for styling with design system
- Korean comments and user-facing text