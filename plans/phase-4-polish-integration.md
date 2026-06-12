# Phase 4: Polish & Advanced Integration

**Mục tiêu**: LSP integration, advanced context features, performance optimization, và production readiness.

**Duration estimate**: 1-2 weeks
**Status**: ✅ Completed

## 1. LSP Integration

### 1.1 Language Server Client
- **File**: `src/plugins/lsp-client.ts`
- **Trách nhiệm**:
  - Connect to language servers (TypeScript, Python, etc.)
  - Provide: go-to-definition, find-references, type errors/warnings
  - Live diagnostics after file edits
  - Reduce need to read entire files
- **Configuration**: Auto-detect from project (tsconfig.json, pyproject.toml, etc.)

### 1.2 LSP Tools
- `get_diagnostics` - Get type errors/warnings for a file
- `go_to_definition` - Jump to definition of symbol
- `find_references` - Find all references to symbol
- `get_hover` - Get type info for symbol

## 2. Advanced Context Features

### 2.1 Smart Context Loading
- **File**: `src/core/smart-context.ts`
- Load files mentioned in conversation on-demand
- Track which files agent has "seen" vs not
- Suggest relevant files based on task description
- Index-based fast search for large codebases

### 2.2 Prompt Caching
- Cache system prompts and NEURO.md between turns
- Provider-specific caching headers (Anthropic prompt caching)
- Cache invalidation on file changes

### 2.3 Context Budget
- Per-turn token budget management
- Budget allocation: system (fixed), context (variable), output (variable)
- Budget-aware tool selection (skip heavy tools when low budget)

## 3. Performance Optimization

### 3.1 Streaming Improvements
- True streaming for all providers (fix Anthropic non-streaming)
- Progressive rendering in TUI
- Token-by-token display for responses

### 3.2 Startup Optimization
- Lazy-load providers (only init when used)
- Defer skill/MCP loading to background
- Parallel config loading

### 3.3 Memory Efficiency
- Stream large files instead of buffering
- Pagination for large directory listings
- Limit tool output size with truncation

## 4. Production Features

### 4.1 Telemetry & Analytics
- Optional usage tracking (opt-in)
- Error reporting
- Performance metrics
- Cost tracking improvements

### 4.2 Configuration Validation
- Schema validation for config.toml
- Migration for config changes between versions
- Config upgrade command

### 4.3 Update System
- Check for updates on launch
- Auto-update notification
- Version compatibility checks

### 4.4 Documentation
- Complete user documentation in docs/
- Architecture documentation
- Plugin development guide
- MCP server development guide

## Files to Create

```
src/plugins/lsp-client.ts
src/core/smart-context.ts
src/core/prompt-cache.ts
src/core/context-budget.ts
```

## Files to Modify
```
src/providers/anthropic.ts   - Add streaming + prompt caching
src/providers/base.ts        - Add caching interface
src/cli/tui.tsx              - Streaming improvements
src/storage/config.ts        - Schema validation, migration
src/index.ts                 - Update check
```

## Acceptance Criteria

1. **LSP**: Type errors show after edits; go-to-definition works
2. **Streaming**: All providers stream tokens in real-time
3. **Performance**: Startup < 2s; context loads < 500ms
4. **Caching**: Prompt cache reduces token usage for repeated patterns
5. **Production**: Config validates; updates checked; docs complete
6. **All existing tests pass** + new tests for all new modules
