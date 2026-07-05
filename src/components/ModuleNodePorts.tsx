import { Fragment } from 'react'
import { Handle } from '@xyflow/react'
import type { SvgPort } from '../hooks/useSvgPorts'
import type { ConnectionEntry } from '../types'
import { PORT_COLOR, PORT_D, getPortSrcStyle, getPortTgtStyle } from './moduleNodeHelpers'

interface Props {
    ports: SvgPort[]
    connections: ConnectionEntry[]
    editMode: boolean
}

export function ModuleNodePorts({ ports, connections, editMode }: Props) {
    return (
        <>
            {ports.map(port => {
                const portColor = PORT_COLOR[port.kind]
                const connectedSrc = connections.find(c => c.dir === 'src' && c.portId === port.id)
                const connectedTgt = connections.find(c => c.dir === 'tgt' && c.portId === port.id)
                
                const srcColor = connectedSrc?.wireColor || portColor
                const tgtColor = connectedTgt?.wireColor || 'transparent'

                return (
                    <Fragment key={port.id}>
                        {/* Coloured source handle – kind encoded in ID for validation */}
                        <Handle
                            id={`src-${port.kind}-${port.id}`}
                            type="source"
                            position={port.side}
                            style={getPortSrcStyle(port.cx, port.cy, srcColor, editMode)}
                        />
                        {/* Transparent target hit-area – kind also encoded */}
                        <Handle
                            id={`tgt-${port.kind}-${port.id}`}
                            type="target"
                            position={port.side}
                            style={{
                                ...getPortTgtStyle(port.cx, port.cy, editMode),
                                ...(connectedTgt ? {
                                    background: tgtColor,
                                    width: PORT_D,
                                    height: PORT_D,
                                    border: '2.5px solid #fff',
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
