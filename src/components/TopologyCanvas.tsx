/**
 * TopologyCanvas.tsx
 *
 * This component provides the shared ReactFlow canvas foundation used across the application.
 * It is utilized by both the read-only TopologyFlow (overview tab) and the interactive 
 * ConnectionsFlow (editor tab). It handles the core ReactFlow setup, including viewport 
 * controls, background rendering, and auto-fit view triggers, while delegating the specific
 * node/edge rendering logic to its parent components.
 */
import type { ReactNode } from 'react'
import { useContext, useEffect, useMemo, useRef } from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    useReactFlow,
    useNodesInitialized,
} from '@xyflow/react'
import type { Node, Edge, NodeTypes, EdgeTypes, OnNodesChange, OnEdgesChange, OnConnect, OnReconnect, IsValidConnection, NodeMouseHandler } from '@xyflow/react'
import { AlertsContext } from '../utils/AlertsContext'

interface Props {
    nodes: Node[]
    edges: Edge[]
    nodeTypes: NodeTypes
    edgeTypes: EdgeTypes
    onNodesChange?: OnNodesChange<Node>
    onEdgesChange?: OnEdgesChange
    onConnect?: OnConnect
    onReconnect?: OnReconnect
    isValidConnection?: IsValidConnection
    /** Enable port handles and drag-to-connect (editor mode) */
    editMode?: boolean
    /** Auto-fit view once when the React Flow canvas initializes */
    fitView?: boolean
    /** Re-fit after layout changes. Keep disabled for interactive editors so user zoom/pan is preserved. */
    fitViewOnLayoutChange?: boolean
    fitViewPadding?: number
    /** Right-click on a module node */
    onNodeContextMenu?: NodeMouseHandler<Node>
    onNodeClick?: NodeMouseHandler<Node>
    elementsSelectable?: boolean
    nodesDraggable?: boolean
    children?: ReactNode
}

function FitViewTrigger({ layoutKey, padding }: { layoutKey: string, padding: number }) {
    const { fitView } = useReactFlow()
    const initialized = useNodesInitialized()
    const fitStrRef = useRef<string | null>(null)

    useEffect(() => {
        if (layoutKey && initialized && fitStrRef.current !== layoutKey) {
            const timer = setTimeout(() => {
                window.requestAnimationFrame(() => {
                    fitView({ padding, duration: 400 })
                    fitStrRef.current = layoutKey
                })
            }, 50)
            return () => clearTimeout(timer)
        }
    }, [layoutKey, initialized, fitView, padding])
    return null
}

export default function TopologyCanvas({
    nodes, edges, nodeTypes, edgeTypes,
    onNodesChange, onEdgesChange,
    onConnect, onReconnect, isValidConnection,
    editMode = false,
    fitView = true,
    fitViewOnLayoutChange = false,
    fitViewPadding = 0.25,
    onNodeContextMenu,
    onNodeClick,
    elementsSelectable = editMode,
    nodesDraggable = editMode,
    children,
}: Props) {
    const theme = useTheme()
    const alerts = useContext(AlertsContext)
    const layoutKey = useMemo(() => JSON.stringify(nodes.map(n => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.measured?.width ?? n.width ?? n.style?.width,
        height: n.measured?.height ?? n.height ?? n.style?.height,
    }))), [nodes])

    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                '& .react-flow__controls': {
                    border: 1,
                    borderColor: 'divider',
                    boxShadow: 2,
                },
                '& .react-flow__controls-button': {
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderBottomColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                    '&:disabled': {
                        bgcolor: 'action.disabledBackground',
                        color: 'text.disabled',
                    },
                },
                '& .react-flow__controls-button svg': { fill: 'currentColor' },
            }}
        >
            <ReactFlow
                colorMode={theme.palette.mode}
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onReconnect={onReconnect}
                isValidConnection={isValidConnection}
                onNodeContextMenu={onNodeContextMenu}
                onNodeClick={onNodeClick}
                onError={(code, message) => alerts?.showAlert('error', `Canvas error ${code}: ${message}`)}
                edgesReconnectable={editMode}
                elementsSelectable={elementsSelectable}
                nodesDraggable={nodesDraggable}
                nodesConnectable={editMode}
                fitView={fitView}
                fitViewOptions={{ padding: fitViewPadding }}
                minZoom={0.1}
                maxZoom={4}
            >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} color={theme.palette.mode === 'dark' ? '#555' : '#81818a'} />
                <Controls />
                {fitView && fitViewOnLayoutChange && <FitViewTrigger
                    layoutKey={layoutKey}
                    padding={fitViewPadding}
                />}
                {children}
            </ReactFlow>
        </Box>
    )
}
