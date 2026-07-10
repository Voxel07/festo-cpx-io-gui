import { Fragment } from 'react'
import { Handle } from '@xyflow/react'
import type { SvgPort } from '../hooks/useSvgPorts'
import type { ConnectionEntry } from '../types'
import { PORT_COLOR, PORT_D, getPortSrcStyle, getPortTgtStyle } from './moduleNodeHelpers'

interface Props {
    ports: SvgPort[]
    connections: ConnectionEntry[]
    editMode: boolean
    moduleName: string
}

export function ModuleNodePorts({ ports, connections, editMode, moduleName }: Props) {
    const isSquare = moduleName.includes('AP-L') || moduleName.includes('-PI');
    const isSmall = moduleName.includes('-PI');
    
    // ap-in and ap-out are rendered as left/right Handles in ModuleNode
    const ioPorts = ports.filter(p => p.kind !== 'ap-in' && p.kind !== 'ap-out')

    return (
        <>
            {ioPorts.map(port => {
                const portColor = PORT_COLOR[port.kind as Exclude<typeof port.kind, 'ap-in'|'ap-out'>]
                const connectedSrc = connections.find(c => c.dir === 'src' && c.portId === port.id)
                const connectedTgt = connections.find(c => c.dir === 'tgt' && c.portId === port.id)
                
                const tgtColor = connectedTgt?.wireColor || 'transparent'

                return (
                    <Fragment key={port.id}>
                        {/* Coloured source handle – kind encoded in ID for validation */}
                        <Handle
                            id={`src-${port.kind}-${port.id}`}
                            type="source"
                            position={port.side}
                            style={getPortSrcStyle(port.cx, port.cy, editMode, isSquare, isSmall)}
                        />
                        {/* Transparent target hit-area – kind also encoded */}
                        <Handle
                            id={`tgt-${port.kind}-${port.id}`}
                            type="target"
                            position={port.side}
                            style={{
                                ...getPortTgtStyle(port.cx, port.cy, editMode, isSquare, isSmall),
                                ...(connectedTgt ? {
                                    background: tgtColor,
                                    width: isSmall ? PORT_D * 0.6 : PORT_D,
                                    height: isSmall ? PORT_D * 0.6 : PORT_D,
                                    border: '2.5px solid #fff',
                                    borderRadius: isSquare ? '2px' : '50%',
                                    opacity: 1,
                                    zIndex: 11,
                                } : {})
                            }}
                        />
                    </Fragment>
                )
            })}
        </>
    )
}
