---
name: nextjs-supabase-auth
description: Best practices for integrating Supabase authentication with Next.js App Router. Applies to login/signup flows, route protection via middleware, callback handling, and server/client boundary management. Use when implementing authentication workflows, protecting routes, managing sessions, and debugging cookie synchronization issues with Next.js and Supabase.
---

# Next.js + Supabase Auth

## Key Application Areas

The skill is appropriate when implementing authentication workflows, protecting routes, managing sessions, and debugging cookie synchronization issues. It should not be used for database optimization, broader Supabase integration tasks, or purely UI-focused changes.

## Foundational Principles

The core guidance emphasizes using `@supabase/ssr` patterns and maintaining clear separation between server clients (`@/lib/supabase/server`) and client clients (`@/lib/supabase/client`). The framework stresses that "Do not manually store or forward auth tokens in client code" and recommends using middleware for session state management on protected routes.

## Implementation Process

The workflow prioritizes identifying where code executes first, then selecting the appropriate Supabase client for that context. This includes verifying middleware covers protected routes, ensuring callback exchanges handle auth codes correctly, and validating authentication before sensitive operations.

## Critical Guardrails

The skill explicitly warns against common mistakes: using browser clients in server actions, applying server clients in client components, and manually persisting JWTs in localStorage or cookies. Service role keys must never appear in client-side code.
