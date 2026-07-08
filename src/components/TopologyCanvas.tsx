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
import { useEffect, useRef } from 'react'
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
    /** Auto-fit view on mount / node changes */
    fitView?: boolean
    fitViewPadding?: number
    /** Right-click on a module node */
    onNodeContextMenu?: NodeMouseHandler<Node>
    onNodeClick?: NodeMouseHandler<Node>
    elementsSelectable?: boolean
    nodesDraggable?: boolean
    children?: ReactNode
}

function FitViewTrigger({ nodesStr, padding }: { nodesStr: string, padding: number }) {
    const { fitView } = useReactFlow()
    const initialized = useNodesInitialized()
    const fitStrRef = useRef<string | null>(null)

    useEffect(() => {
        if (nodesStr && initialized && fitStrRef.current !== nodesStr) {
            const timer = setTimeout(() => {
                window.requestAnimationFrame(() => {
                    fitView({ padding, duration: 400 })
                    fitStrRef.current = nodesStr
                })
            }, 50)
            return () => clearTimeout(timer)
        }
    }, [nodesStr, initialized, fitView, padding])
    return null
}

export default function TopologyCanvas({
    nodes, edges, nodeTypes, edgeTypes,
    onNodesChange, onEdgesChange,
    onConnect, onReconnect, isValidConnection,
    editMode = false,
    fitView = true,
    fitViewPadding = 0.25,
    onNodeContextMenu,
    onNodeClick,
    elementsSelectable = editMode,
    nodesDraggable = editMode,
    children,
}: Props) {
    const theme = useTheme()

    return (
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
            {fitView && <FitViewTrigger nodesStr={nodes.map(n => n.id).join(',')} padding={fitViewPadding} />}
            {children}
        </ReactFlow>
    )
}
