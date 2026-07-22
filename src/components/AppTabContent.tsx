import { Suspense, lazy } from 'react'
import { Box } from '@mui/material'
import type { Topology, DiffStatus, TopologyModule, BenchConfig } from '../types'
import { LoadingChunk } from './LoadingChunk'

const GenerateCompareTab = lazy(() => import('./GenerateCompareTab'))
const TestRunTab = lazy(() => import('./TestRunTab'))
const HistoryTab = lazy(() => import('./HistoryTab'))
const ConnectionsFlow = lazy(() => import('./ConnectionsFlow'))
const RawModeTab = lazy(() => import('./RawModeTab'))
const MockBuilderTab = lazy(() => import('./MockBuilderTab'))
const ArchitectureFlow = lazy(() => import('./ArchitectureFlow'))

interface AppTabContentProps {
    tab: number
    ip: string
    timeout: number
    topology: Topology | null
    diffStatus: DiffStatus | null
    rawSelectedAddr: number | null
    rawConfig: BenchConfig | null
    configPath: string
    hwConnected: boolean
    mockTopology?: Topology | null
    onResult: (topo: Topology | null, status: DiffStatus | null, removed?: TopologyModule[], config?: BenchConfig) => void
    onModuleValveChange: (addr: number, mountedValves: number[], valveSlots?: number) => void
    onConfigLoad: (config: BenchConfig) => void
    onSetRawSelectedAddr: (addr: number | null) => void
    onSetMockTopology?: (topo: Topology | null) => void
    onMockBuilderSectionChange: (section: number) => void
    onTestRunActiveChange: (active: boolean) => void
    wrapThreshold: number
    onWrapThresholdChange: (val: number) => void
    cableGap: number
    onCableGapChange: (val: number) => void
}

export default function AppTabContent(props: AppTabContentProps) {
    const {
        tab, ip, timeout, topology, diffStatus,
        rawSelectedAddr, rawConfig, configPath, hwConnected, mockTopology,
        wrapThreshold, onWrapThresholdChange, cableGap, onCableGapChange,
        onResult, onModuleValveChange, onConfigLoad, onSetRawSelectedAddr, onSetMockTopology, onMockBuilderSectionChange,
        onTestRunActiveChange,
    } = props

    return (
        <Box sx={{ flex: 1, overflow: 'hidden', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
            {tab === 0 && (
                <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                    <Suspense fallback={<LoadingChunk label="Loading topology tools…" />}>
                        <GenerateCompareTab
                            ip={ip}
                            timeout={timeout}
                            onResult={onResult}
                            configPath={configPath}
                            rawConfig={rawConfig}
                        />
                    </Suspense>
                </Box>
            )}
            {tab === 1 && (
                <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <Suspense fallback={<LoadingChunk label="Loading connection editor…" />}>
                        <ConnectionsFlow
                            topology={topology}
                            diffStatus={diffStatus}
                            ip={ip}
                            onModuleValveChange={onModuleValveChange}
                            onConfigLoad={onConfigLoad}
                            rawConfig={rawConfig}
                            configPath={configPath}
                            wrapThreshold={wrapThreshold!}
                            onWrapThresholdChange={onWrapThresholdChange}
                            cableGap={cableGap!}
                            onCableGapChange={onCableGapChange}
                        />
                    </Suspense>
                </Box>
            )}
            {tab === 2 && (
                <Suspense fallback={<LoadingChunk label="Loading test runner…" />}>
                    <TestRunTab ip={ip} hwConnected={hwConnected} onActiveChange={onTestRunActiveChange} />
                </Suspense>
            )}
            {tab === 3 && (
                <Suspense fallback={<LoadingChunk label="Loading raw mode…" />}>
                    <RawModeTab
                        topology={topology}
                        ip={ip}
                        selectedModuleAddr={rawSelectedAddr}
                        onSelectModuleAddr={onSetRawSelectedAddr}
                    />
                </Suspense>
            )}
            {tab === 4 && (
                <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                    <Suspense fallback={<LoadingChunk label="Loading history…" />}>
                        <HistoryTab />
                    </Suspense>
                </Box>
            )}
            {tab === 5 && (
                <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                    <Suspense fallback={<LoadingChunk label="Loading mock builder…" />}>
                        <MockBuilderTab 
                            mockTopology={mockTopology || null} 
                            setMockTopology={onSetMockTopology || (() => {})}
                            topology={topology}
                            ip={ip}
                            hwConnected={hwConnected}
                            onSectionChange={onMockBuilderSectionChange}
                        />
                    </Suspense>
                </Box>
            )}
            {tab === 6 && (
                <Suspense fallback={<LoadingChunk label="Loading architecture mapâ€¦" />}>
                    <ArchitectureFlow />
                </Suspense>
            )}
        </Box>
    )
}
