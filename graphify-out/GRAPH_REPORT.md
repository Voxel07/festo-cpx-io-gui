# Graph Report - festo-cpx-io-gui  (2026-07-15)

## Corpus Check
- 91 files · ~93,484 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 546 nodes · 910 edges · 28 communities (25 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `61a591a0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]

## God Nodes (most connected - your core abstractions)
1. `TopologyModule` - 23 edges
2. `Topology` - 23 edges
3. `compilerOptions` - 17 edges
4. `compilerOptions` - 15 edges
5. `BenchConfig` - 13 edges
6. `ModuleNode()` - 12 edges
7. `DiffStatus` - 12 edges
8. `DiagnosisEntry` - 10 edges
9. `AlertsContext` - 10 edges
10. `TooltipButton()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `Topology`  [EXTRACTED]
  src/components/MockBuilderTab.tsx → src/types.ts
- `Props` --references--> `Topology`  [EXTRACTED]
  src/components/RawModeTab.tsx → src/types.ts
- `ConnectionsFlowState` --references--> `TopologyModule`  [EXTRACTED]
  src/components/useConnectionsFlowState.ts → src/types.ts
- `AppState` --references--> `DiagnosisEntry`  [EXTRACTED]
  src/App.tsx → src/types.ts
- `AppState` --references--> `TopologyModule`  [EXTRACTED]
  src/App.tsx → src/types.ts

## Import Cycles
- None detected.

## Communities (28 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (43): ModuleNode(), defaultValveSlots(), DISP_H, getApInStyle(), getApOutStyle(), getGenericInStyle(), getGenericOutStyle(), getModuleDispSize() (+35 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (15): ChannelSelectionModal(), ChannelSelectionModalProps, ConnectionsFlow(), EDGE_TYPES, NODE_TYPES, DebugPanel(), useConnectionsFlowLayout(), useConnectionsFlowPersist() (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (24): ConnectionsToolbarProps, HistoryDetailDrawer(), HistoryDetailDrawerProps, LogEntry, RunRecord, formatTime(), LogEntry, parseTests() (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (30): TestLiveLogProps, TERMINAL_STATUSES, TestProgressProps, MOD_COLOR, MOD_ICON, TestResultsProps, AVAILABLE_TESTS, Checkpoint (+22 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (21): AutomationBlockNode, automationNodeTypes, COLORS, AutomationDraft, EMPTY_DRAFT, EMPTY_STATUS, isAnalogInputModule(), isTemperatureModule() (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (32): dependencies, @emotion/react, @emotion/styled, @mui/icons-material, @mui/material, @mui/x-data-grid, react, react-dom (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (40): BackplaneNodeData, BackplaneNodeType, Props, ModuleNodeDiagnosis(), Props, ModuleNodeData, ModuleNodeType, TopologyNodeWrapperProps (+32 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (14): ComponentNodeData, connections, Lane, laneColors, nodes, nodeTypes, colors, messages (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (13): Dashboard(), fmtDuration(), DailyBreakdownTable(), RunsBarChart(), TrendAreaChart(), KpiCard(), KpiCardProps, RecentRunsTable() (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (15): Props, Props, ActuateChannel, ModuleActuatePanel(), Props, Props, TopologyModule, Segment (+7 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (20): CableEdge(), LABEL_BASE_STYLE, Props, EDGE_TYPES, NO_REMOVED_MODULES, NODE_TYPES, WireEdge(), Props (+12 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (7): CompareStepProps, DeleteStepProps, initialTabState, Props, TabAction, TabState, WriteStepProps

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (3): Props, RawModeTab(), useRawMode()

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (9): AppAction, appReducer(), DiagnosticsModal, initialAppState, TopologyFlow, AlertsManager, AlertMessage, AlertsManagerRef (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.24
Nodes (8): appBarFieldSx, AppHeader(), AppHeaderProps, AppThemeProvider(), ColorMode, ThemeContext, ThemeContextType, useColorMode()

### Community 17 - "Community 17"
Cohesion: 0.26
Nodes (8): DiffPaneProps, Props, SplitDiff(), CompareResult, buildRows(), Cell, DiffRow, RowKind

### Community 18 - "Community 18"
Cohesion: 0.20
Nodes (8): ArchitectureFlow, ConnectionsFlow, GenerateCompareTab, HistoryTab, MockBuilderTab, RawModeTab, TestRunTab, LoadingChunk()

### Community 19 - "Community 19"
Cohesion: 0.33
Nodes (10): AppTabContentProps, Props, Props, LiveConfigPreviewProps, ReadLiveStepProps, Props, AppState, BenchConfig (+2 more)

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (4): MappingEntry, ModuleMetadata, Props, RawMappingEntry

### Community 21 - "Community 21"
Cohesion: 0.43
Nodes (5): AllIoStates, IoStateContext, ModuleIoState, IoStateProvider(), Props

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 25 - "Community 25"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **196 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+191 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TopologyModule` connect `Community 9` to `Community 1`, `Community 2`, `Community 4`, `Community 6`, `Community 10`, `Community 12`, `Community 15`, `Community 17`, `Community 18`, `Community 19`, `Community 20`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `Topology` connect `Community 19` to `Community 1`, `Community 4`, `Community 6`, `Community 10`, `Community 12`, `Community 13`, `Community 15`, `Community 18`, `Community 20`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `AlertsContext` connect `Community 10` to `Community 2`, `Community 4`, `Community 6`, `Community 12`, `Community 15`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _196 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.061952074810052604 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11666666666666667 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07073170731707316 - nodes in this community are weakly interconnected._