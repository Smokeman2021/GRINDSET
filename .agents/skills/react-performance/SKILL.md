---
name: react-performance
description: Comprehensive performance optimization framework for React 18/19 and Next.js with 70+ actionable rules across 8 priority categories. Covers waterfall elimination, bundle optimization, Server Components, re-render reduction, and Lighthouse metrics. Use when optimizing React or Next.js app performance, reducing bundle size, eliminating request waterfalls, or improving Core Web Vitals.
---

# React Performance

This skill provides a comprehensive performance optimization framework for React 18/19 and Next.js, organized into 8 priority categories with 70+ actionable rules.

## Key Framework

The skill uses a **priority-based taxonomy**:

| Priority | Focus | Impact |
|----------|-------|--------|
| Critical | Waterfalls, Bundle Size | Network latency, First-load JS |
| High | Server-Side Performance | RSC efficiency, data serialization |
| Medium-High | Client Data Fetching | Request deduplication, cache strategy |
| Medium | Re-renders, Rendering | Component reconciliation, paint costs |
| Low-Medium | JavaScript micro-perf | Hot loops, memory allocation |
| Low | Advanced patterns | Effect-event stability, refs |

## Essential Patterns

**Waterfall elimination** tops the list—"sequential `await` adds full network latency." Key tactics include checking synchronous conditions first, deferring awaits until needed, and using `Promise.all()` for independent operations. Server Components naturally parallelize via component composition.

**Bundle optimization** emphasizes direct imports over barrel files (200–800ms savings documented), statically analyzable dynamic imports, and deferring third-party scripts until after hydration.

**Re-render reduction** focuses on selector granularity ("subscribe to derived booleans, not raw values"), memoization ROI (avoid memo for primitives), and deriving values during render rather than effects.

## Integration Points

The skill maps to Lighthouse metrics (LCP, INP, CLS) and cross-references related skills (react-patterns, react-testing, accessibility). Automation tools like Next.js Optimize Package Imports and the React Compiler (in development) automate many rules.
