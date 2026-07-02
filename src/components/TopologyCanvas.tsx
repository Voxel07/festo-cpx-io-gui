/**
 * TopologyCanvas – shared ReactFlow canvas used by both the read-only
 * TopologyFlow (overview tab) and the interactive ConnectionsFlow (editor tab).
 */
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    useReactFlow,
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
    children?: ReactNode
}

function FitViewTrigger({ nodesStr, padding }: { nodesStr: string, padding: number }) {
    const { fitView } = useReactFlow()
    useEffect(() => {
        if (nodesStr) {
            const timer = setTimeout(() => {
                window.requestAnimationFrame(() => {
                    fitView({ padding, duration: 400 })
                })
            }, 50)
            return () => clearTimeout(timer)
        }
    }, [nodesStr, fitView, padding])
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
    children,
}: Props) {
    return (
        <ReactFlow
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
            nodesDraggable={editMode}
            nodesConnectable={editMode}
            fitView={fitView}
            fitViewOptions={{ padding: fitViewPadding }}
            minZoom={0.1}
            maxZoom={4}
        >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
            {fitView && <FitViewTrigger nodesStr={nodes.map(n => n.id).join(',')} padding={fitViewPadding} />}
            {children}
        </ReactFlow>
    )
}
