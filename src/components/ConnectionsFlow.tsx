/**
 * ConnectionsFlow – full-page I/O wiring editor.
 *
 * Shows the topology with port handles visible on each module.
 * Drag from a port to another to create a wired I/O connection.
 * Save/load connections (including valve-mount info) via /connections.
 */
import { Profiler } from 'react'
import { Box, Typography } from '@mui/material'
import type { NodeTypes, EdgeTypes } from '@xyflow/react'
import TopologyCanvas from './TopologyCanvas'
import ModuleNode from './ModuleNode'
import BackplaneNode from './BackplaneNode'
import { WireEdge } from './WireEdge'
import { CableEdge } from './CableEdge'
import ModuleActuateModal from './ModuleActuateModal'
import type { Topology, DiffStatus, BenchConfig } from '../types'
import ConnectionsToolbar from './ConnectionsToolbar'
import WiringTestPanel from './WiringTestPanel'
import ChannelSelectionModal from './ChannelSelectionModal'
import { useConnectionsFlowState } from './useConnectionsFlowState'
import { useConnectionsFlowTest } from './useConnectionsFlowTest'
import { useConnectionsFlowLayout } from './useConnectionsFlowLayout'
import { useConnectionsFlowPersist } from './useConnectionsFlowPersist'
import { DebugPanel, onRenderCallback } from './DebugPanel'

// ─────────────────────────────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
    mod: ModuleNode as NodeTypes[string],
    backplane: BackplaneNode as NodeTypes[string],
}
const EDGE_TYPES: EdgeTypes = { wire: WireEdge as EdgeTypes[string], cable: CableEdge as EdgeTypes[string] }

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
    topology: Topology | null
    diffStatus: DiffStatus | null
    /** IP address of the CPX-AP gateway (from App toolbar) */
    ip?: string
    /** Called when a valve body's mounted valves change (indices 0-based) */
    onModuleValveChange?: (addr: number, mountedValves: number[], valveSlots?: number) => void
    /** Called when a BenchConfig is loaded — allows parent to sync topology state */
    onConfigLoad?: (config: BenchConfig) => void
    rawConfig?: BenchConfig | null
    configPath: string
    wrapThreshold: number
    onWrapThresholdChange: (val: number) => void
    cableGap: number
    onCableGapChange: (val: number) => void
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ConnectionsFlow({ 
    topology, diffStatus, ip, onModuleValveChange, onConfigLoad, rawConfig, configPath,
    wrapThreshold, onWrapThresholdChange, cableGap, onCableGapChange
}: Props) {
    const [state, dispatch] = useConnectionsFlowState()
    const {
        showCables,
        showWires,
        animateWires,
        showPsConfig,
        psComPort,
        psIpAddr,
        psPlChannel,
        psPsChannel,
        showTestPanel,
        outputStates,
        testResults,
        testBusy,
        testAllBusy,
        actuateModule,
        actuateMountedValves,
        connectionMode,
        showDebug,
    } = state

    const {
        nodes, onNodesChange,
        edges, onEdgesChange,
        ioEdgesRef, pendingConn, setPendingConn, processConnection,
        onConnect, onReconnect, isValidConnection, onNodeContextMenu, doClear
    } = useConnectionsFlowLayout(topology, diffStatus, ip, rawConfig, onModuleValveChange, connectionMode, wrapThreshold, cableGap, dispatch)

    const { doSave, doLoad } = useConnectionsFlowPersist(
        configPath, ioEdgesRef, nodes, psComPort, psIpAddr, psPlChannel, psPsChannel, onConfigLoad
    )

    const { testConns, doReadInput, toggleOutput, testAll, clearAllOutputs } = useConnectionsFlowTest(
        ip, topology, edges, outputStates, testResults, dispatch
    )

    // ── Visible edges ─────────────────────────────────────
    const visibleEdges = edges.filter(e => {
        const isCable = (e.data as Record<string, unknown>)?.kind === 'cable'
        if (isCable) return showCables
        return showWires
    })

    const ioCount = edges.filter(e => (e.data as Record<string, unknown>)?.kind === 'io').length

    // ─────────────────────────────────────────────────────
    if (!topology) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                    Generate or load a topology first to use the connection editor.
                </Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <ConnectionsToolbar
                ioCount={ioCount}
                showCables={showCables}
                onToggleCables={() => dispatch({ type: 'TOGGLE_CABLES' })}
                showWires={showWires}
                onToggleWires={() => dispatch({ type: 'TOGGLE_WIRES' })}
                animateWires={animateWires}
                onToggleAnimation={() => dispatch({ type: 'TOGGLE_ANIMATION' })}
                connectionMode={connectionMode}
                onConnectionModeChange={(mode) => dispatch({ type: 'SET_CONNECTION_MODE', mode })}
                showPsConfig={showPsConfig}
                onTogglePsConfig={() => dispatch({ type: 'TOGGLE_PS_CONFIG' })}
                onSave={doSave}
                onLoad={doLoad}
                onClear={doClear}
                showTestPanel={showTestPanel}
                onToggleTestPanel={() => dispatch({ type: 'TOGGLE_TEST_PANEL' })}
                psComPort={psComPort}
                onPsComPortChange={port => dispatch({ type: 'SET_PS_COMPORT', port })}
                psIpAddr={psIpAddr}
                onPsIpAddrChange={ip => dispatch({ type: 'SET_PS_IPADDR', ip })}
                psPlChannel={psPlChannel}
                onPsPlChannelChange={ch => dispatch({ type: 'SET_PS_PL_CHANNEL', ch })}
                psPsChannel={psPsChannel}
                onPsPsChannelChange={ch => dispatch({ type: 'SET_PS_PS_CHANNEL', ch })}
                showDebug={showDebug}
                onToggleDebug={() => dispatch({ type: 'TOGGLE_DEBUG' })}
                wrapThreshold={wrapThreshold}
                onWrapThresholdChange={onWrapThresholdChange}
                cableGap={cableGap}
                onCableGapChange={onCableGapChange}
            />

            {/* ── Content area: ReactFlow + Wire Test Panel ────────── */}
            <Box 
                sx={{ 
                    flex: 1, 
                    overflow: 'hidden', 
                    display: 'flex', 
                    flexDirection: 'row',
                    '& .react-flow__edge-path': {
                        // Force hardware acceleration to prevent SVG rasterization from blocking the main thread
                        willChange: 'stroke-dashoffset, stroke',
                        transform: 'translateZ(0)',
                        ...( !animateWires ? { animation: 'none !important' } : {} )
                    }
                }}
            >

                {/* ── ReactFlow Canvas ─────────────────────────────────── */}
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    <Profiler id="TopologyCanvas" onRender={onRenderCallback}>
                        <TopologyCanvas
                            nodes={nodes}
                            edges={visibleEdges}
                            nodeTypes={NODE_TYPES}
                            edgeTypes={EDGE_TYPES}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onReconnect={onReconnect}
                            isValidConnection={isValidConnection}
                            onNodeContextMenu={onNodeContextMenu}
                            editMode
                            fitView
                        >
                            {showDebug && <DebugPanel onClose={() => dispatch({ type: 'TOGGLE_DEBUG' })} />}
                        </TopologyCanvas>
                    </Profiler>
                </Box>

                {/* ── Wire Test Panel ────────────────────────────────────── */}
                {showTestPanel && (
                    <WiringTestPanel
                        ip={ip}
                        testAllBusy={testAllBusy}
                        testConns={testConns}
                        outputStates={outputStates}
                        testBusy={testBusy}
                        testResults={testResults}
                        onTestAll={testAll}
                        onClearAllOutputs={clearAllOutputs}
                        onToggleOutput={toggleOutput}
                        onReadInput={doReadInput}
                    />
                )}
            </Box>

            {/* ── Module Actuate Modal (right-click context) ──────── */}
            <ModuleActuateModal
                open={actuateModule !== null}
                module={actuateModule!}
                ip={ip ?? ''}
                mountedValves={actuateMountedValves}
                onClose={() => dispatch({ type: 'CLOSE_ACTUATE' })}
            />

            {/* ── Channel Selection Modal ──────── */}
            <ChannelSelectionModal
                open={pendingConn !== null}
                sourceIsM12={pendingConn?.srcIsM12 ?? false}
                targetIsM12={pendingConn?.tgtIsM12 ?? false}
                sourceKind={pendingConn?.sh.split('-')[1]}
                targetKind={pendingConn?.th.split('-')[1]}
                isPortMode={connectionMode === 'port'}
                sourceLabel={pendingConn ? `#${pendingConn.srcNode}:${pendingConn.sh.split('-')[2]}` : undefined}
                targetLabel={pendingConn ? `#${pendingConn.tgtNode}:${pendingConn.th.split('-')[2]}` : undefined}
                onConfirm={(srcSub, tgtSub, direction) => {
                    if (pendingConn) {
                        const { srcNode, tgtNode, sh, th, srcIsM12, tgtIsM12 } = pendingConn

                        if (srcSub === 'both' || tgtSub === 'both') {
                            const srcChannels = (srcSub === 'both' && srcIsM12) ? [0, 1] : [srcSub === 'both' ? 0 : srcSub]
                            const tgtChannels = (tgtSub === 'both' && tgtIsM12) ? [0, 1] : [tgtSub === 'both' ? 0 : tgtSub]

                            const maxLen = Math.max(srcChannels.length, tgtChannels.length)
                            for (let i = 0; i < maxLen; i++) {
                                const s = srcChannels[i % srcChannels.length]
                                const t = tgtChannels[i % tgtChannels.length]
                                processConnection(srcNode, tgtNode, sh, th, s as number, t as number, direction)
                            }
                        } else {
                            processConnection(srcNode, tgtNode, sh, th, srcSub as number, tgtSub as number, direction)
                        }

                        setPendingConn(null)
                    }
                }}
                onCancel={() => setPendingConn(null)}
            />
        </Box>
    )
}
