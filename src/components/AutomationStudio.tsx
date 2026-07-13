import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    ListSubheader,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    Stack,
    Switch,
    TextField,
    Tooltip,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import {
    Add,
    Air,
    CallSplit,
    Delete,
    ElectricMeter,
    Filter9Plus,
    Input,
    Memory,
    Notes,
    Output,
    PlayArrow,
    Router,
    Save,
    Science,
    SettingsInputComponent,
    Stop,
    Speed,
    Thermostat,
    Timer,
} from '@mui/icons-material'
import {
    addEdge,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    Panel,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
    useReactFlow,
    type Connection,
    type NodeMouseHandler,
} from '@xyflow/react'
import type { Topology, TopologyModule } from '../types'
import { AutomationBlockNode, automationNodeTypes } from './AutomationBlockNode'
import type {
    AutomationBlockType,
    AutomationEdge,
    AutomationNode,
    AutomationNodeData,
    AutomationProgram,
    AutomationStatus,
    AutomationTarget,
} from './automationTypes'

interface Props {
    realTopology: Topology | null
    simulatedTopology: Topology | null
    ip: string
    hwConnected: boolean
    onOpenMockTopology: () => void
}

interface PaletteItem {
    type: AutomationBlockType
    label: string
    description: string
    group: 'Events' | 'Control' | 'Actions' | 'Pneumatics' | 'Notes'
    color: string
    icon: typeof Input
}

const PALETTE: PaletteItem[] = [
    { type: 'input', label: 'Digital input', description: 'Edge or level trigger from a CPX input', group: 'Events', color: '#0288d1', icon: Input },
    { type: 'temperature', label: 'Temperature limit', description: 'True when a scaled analog temperature reaches its limit', group: 'Events', color: '#e53935', icon: Thermostat },
    { type: 'voltage', label: 'Voltage limit', description: 'True when a scaled analog voltage reaches its limit', group: 'Events', color: '#f9a825', icon: ElectricMeter },
    { type: 'pressure', label: 'Pressure event', description: 'Forward an incoming signal only while the configured pressure is reached', group: 'Events', color: '#00838f', icon: Speed },
    { type: 'timer', label: 'Timer / clock', description: 'Trigger an event once or repeatedly from elapsed time', group: 'Control', color: '#3949ab', icon: Timer },
    { type: 'delay', label: 'Delay', description: 'Emit and hold a signal after a non-blocking timer', group: 'Control', color: '#7b1fa2', icon: Timer },
    { type: 'counter', label: 'Event counter', description: 'Emit one event on every configured Nth rising event', group: 'Control', color: '#6a1b9a', icon: Filter9Plus },
    { type: 'and', label: 'AND', description: 'True when every connected signal is true', group: 'Control', color: '#5d4037', icon: CallSplit },
    { type: 'or', label: 'OR', description: 'True when any connected signal is true', group: 'Control', color: '#5d4037', icon: CallSplit },
    { type: 'not', label: 'NOT', description: 'Invert a connected signal', group: 'Control', color: '#5d4037', icon: CallSplit },
    { type: 'output', label: 'Digital output', description: 'Set, reset, toggle, or follow a CPX output', group: 'Actions', color: '#ef6c00', icon: Output },
    { type: 'valve', label: 'Valve coil', description: 'Control a valve-terminal output channel', group: 'Pneumatics', color: '#d32f2f', icon: Air },
    { type: 'cylinder', label: 'Cylinder', description: 'Virtual actuator with extended/retracted end events', group: 'Pneumatics', color: '#00897b', icon: SettingsInputComponent },
    { type: 'comment', label: 'Comment', description: 'Document the purpose or safety behavior', group: 'Notes', color: '#616161', icon: Notes },
]

const EMPTY_STATUS: AutomationStatus = {
    running: false,
    cycle_count: 0,
    node_states: {},
}

const DRAFT_STORAGE_KEY = 'festo.automation-studio.draft.v1'

interface AutomationDraft {
    nodes: AutomationNode[]
    edges: AutomationEdge[]
    selectedId: string | null
    programId: string | null
    selectedProgramId: string
    programName: string
    description: string
    scanInterval: number
    target: AutomationTarget
}

const EMPTY_DRAFT: AutomationDraft = {
    nodes: [],
    edges: [],
    selectedId: null,
    programId: null,
    selectedProgramId: '',
    programName: 'Cylinder sequence',
    description: 'Input-triggered pneumatic sequence',
    scanInterval: 50,
    target: 'simulated',
}

function readDraft(): AutomationDraft {
    try {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY)
        if (!saved) return EMPTY_DRAFT
        const parsed = JSON.parse(saved) as Partial<AutomationDraft>
        const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
        const edges = Array.isArray(parsed.edges) ? normalizeLogicGateEdges(nodes, parsed.edges) : []
        return {
            ...EMPTY_DRAFT,
            ...parsed,
            nodes,
            edges,
            target: parsed.target === 'real' ? 'real' : 'simulated',
        }
    } catch {
        return EMPTY_DRAFT
    }
}

function normalizeLogicGateEdges(nodes: AutomationNode[], edges: AutomationEdge[]): AutomationEdge[] {
    const nodeTypes = new Map(nodes.map(node => [node.id, node.type]))
    const incomingCounts = new Map<string, number>()
    return edges.map(edge => {
        if (!['and', 'or'].includes(nodeTypes.get(edge.target) ?? '')) return edge
        const normalized = nodeTypes.get(edge.source) === 'input' ? { ...edge, sourceHandle: 'state' } : { ...edge }
        if (['input-a', 'input-b'].includes(edge.targetHandle ?? '')) return normalized
        const index = incomingCounts.get(edge.target) ?? 0
        incomingCounts.set(edge.target, index + 1)
        return { ...normalized, targetHandle: index === 0 ? 'input-a' : 'input-b' }
    })
}

function isValveModule(module: TopologyModule): boolean {
    const identity = `${module.Type} ${module.Name}`.toLowerCase()
    return identity.includes('valve') || /^(vab|vmp|vaem|vtom)/i.test(module.Name)
}

function isAnalogInputModule(module: TopologyModule): boolean {
    const identity = `${module.Type} ${module.Name}`
    return module.NumOfInputs + module.NumOfInOuts > 0
        && /analog|(?:^|[-_])\d*AI(?:[-_]|$)|RTD|U-I|(?:^|[-_])UI(?:[-_]|$)/i.test(identity)
}

function isTemperatureModule(module: TopologyModule): boolean {
    return isAnalogInputModule(module) && /RTD|temp/i.test(`${module.Type} ${module.Name}`)
}

export function modulesForBlock(
    modules: TopologyModule[],
    blockType: AutomationBlockType,
): TopologyModule[] {
    if (blockType === 'input') {
        return modules.filter(module => !isValveModule(module) && !isAnalogInputModule(module) && module.NumOfInputs + module.NumOfInOuts > 0)
    }
    if (blockType === 'temperature') {
        return modules.filter(isTemperatureModule)
    }
    if (blockType === 'voltage') {
        return modules.filter(isAnalogInputModule)
    }
    if (blockType === 'pressure') {
        return modules.filter(isAnalogInputModule)
    }
    if (blockType === 'output') {
        return modules.filter(module => !isValveModule(module) && module.NumOfOutputs + module.NumOfInOuts > 0)
    }
    if (blockType === 'valve') {
        return modules.filter(module => isValveModule(module) && module.NumOfOutputs + module.NumOfInOuts > 0)
    }
    return modules
}

function defaultData(type: AutomationBlockType): AutomationNodeData {
    const item = PALETTE.find(entry => entry.type === type)!
    const common = { label: item.label }
    if (type === 'input') return { ...common, module_addr: 3, channel: 0, trigger: 'rising', debounce_ms: 20 }
    if (type === 'temperature') return { ...common, module_addr: 0, channel: 0, limit: 25, hysteresis: .5, scale: .1, offset: 0 }
    if (type === 'voltage') return { ...common, module_addr: 0, channel: 0, limit: 5, hysteresis: .1, scale: 10 / 27648, offset: 0 }
    if (type === 'pressure') return { ...common, module_addr: 0, channel: 0, limit: 6, hysteresis: .1, scale: 10 / 27648, offset: 0 }
    if (type === 'timer') return { ...common, initial_delay_ms: 1000, interval_ms: 1000, repeat: false }
    if (type === 'delay') return { ...common, delay_ms: 1000 }
    if (type === 'counter') return { ...common, events_per_toggle: 3 }
    if (type === 'output') return { ...common, module_addr: 0, channel: 0, action: 'follow' }
    if (type === 'valve') return { ...common, module_addr: 0, channel: 0, action: 'toggle' }
    if (type === 'cylinder') return { ...common, travel_time_s: 1 }
    if (type === 'comment') return { ...common, text: 'Describe this sequence or add a safety note.' }
    return common
}

function cleanProgram(
    nodes: AutomationNode[],
    edges: AutomationEdge[],
    fields: Pick<AutomationProgram, 'id' | 'name' | 'description' | 'scan_interval_ms'>,
    topology: Topology | null,
): AutomationProgram {
    return {
        ...fields,
        version: '1.0',
        nodes: nodes.map(node => {
            const data = { ...node.data }
            delete data.runtime
            return { id: node.id, type: node.type, position: node.position, data }
        }),
        edges: edges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
        })),
        topology,
    }
}

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, options)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
        const detail = typeof data.detail === 'string'
            ? data.detail
            : Array.isArray(data.detail)
                ? data.detail.map((entry: { msg?: string }) => entry.msg).filter(Boolean).join(', ')
                : `HTTP ${response.status}`
        throw new Error(detail)
    }
    return data as T
}

function EditableNumberField({
    label,
    value,
    onCommit,
    min,
    max,
    step = 1,
    helperText,
    width,
}: {
    label: string
    value: number
    onCommit: (value: number) => void
    min?: number
    max?: number
    step?: number | 'any'
    helperText?: string
    width?: number
}) {
    const [draft, setDraft] = useState(String(value))

    useEffect(() => setDraft(String(value)), [value])

    const normalize = useCallback(() => {
        const parsed = Number(draft)
        const finite = Number.isFinite(parsed) ? parsed : value
        const normalized = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, finite))
        setDraft(String(normalized))
        onCommit(normalized)
    }, [draft, max, min, onCommit, value])

    return (
        <TextField
            size="small"
            type="number"
            label={label}
            value={draft}
            helperText={helperText}
            slotProps={{ htmlInput: { min, max, step } }}
            onChange={event => {
                const next = event.target.value
                setDraft(next)
                const parsed = Number(next)
                if (next !== '' && Number.isFinite(parsed) && (min === undefined || parsed >= min) && (max === undefined || parsed <= max)) {
                    onCommit(parsed)
                }
            }}
            onBlur={normalize}
            sx={width ? { width } : undefined}
        />
    )
}

function PaletteBlock({ item, onAdd }: { item: PaletteItem, onAdd: (type: AutomationBlockType) => void }) {
    const Icon = item.icon
    return (
        <Tooltip title={item.description} placement="right">
            <Paper
                draggable
                role="button"
                tabIndex={0}
                aria-label={`Add ${item.label} block`}
                onDragStart={event => {
                    event.dataTransfer.setData('application/festo-automation-block', item.type)
                    event.dataTransfer.effectAllowed = 'copy'
                }}
                onDoubleClick={() => onAdd(item.type)}
                onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') onAdd(item.type)
                }}
                variant="outlined"
                sx={{ p: 1, cursor: 'grab', borderLeft: 5, borderLeftColor: item.color, '&:hover': { bgcolor: 'action.hover' }, '&:active': { cursor: 'grabbing' } }}
            >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Icon fontSize="small" sx={{ color: item.color }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.label}</Typography>
                </Stack>
            </Paper>
        </Tooltip>
    )
}

function NodeInspector({ node, topology, onChange, onDelete }: {
    node: AutomationNode | null
    topology: Topology | null
    onChange: (patch: Partial<AutomationNodeData>) => void
    onDelete: () => void
}) {
    const modules = topology?.Topology ?? []
    const compatibleModules = node ? modulesForBlock(modules, node.type) : []
    const selectedModule = modules.find(module => module.Adress === Number(node?.data.module_addr))
    const compatibleSelectedModule = compatibleModules.find(module => module.Adress === Number(node?.data.module_addr))
    const physical = node && ['input', 'temperature', 'voltage', 'pressure', 'output', 'valve'].includes(node.type)
    const analog = node && ['temperature', 'voltage', 'pressure'].includes(node.type)
    const analogUnit = node?.type === 'temperature' ? '°C' : node?.type === 'voltage' ? 'V' : 'bar'
    const analogLimit = node?.type === 'temperature' ? 25 : node?.type === 'voltage' ? 5 : 6
    const analogHysteresis = node?.type === 'temperature' ? .5 : .1
    const channelCount = compatibleSelectedModule
        ? node?.type === 'input' || analog
            ? compatibleSelectedModule.NumOfInputs + compatibleSelectedModule.NumOfInOuts
            : compatibleSelectedModule.NumOfOutputs + compatibleSelectedModule.NumOfInOuts
        : 0

    if (!node) {
        return (
            <Stack sx={{ p: 2, height: '100%', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }} spacing={1}>
                <Science color="disabled" sx={{ fontSize: 42 }} />
                <Typography variant="subtitle2">Block inspector</Typography>
                <Typography variant="caption" color="text.secondary">Select a block to configure its module, channel, behavior, and timing.</Typography>
            </Stack>
        )
    }

    return (
        <Stack spacing={2} sx={{ p: 2, overflow: 'auto' }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Block settings</Typography>
                <Button size="small" color="error" startIcon={<Delete />} onClick={onDelete}>Delete</Button>
            </Stack>
            <TextField size="small" label="Label" value={node.data.label} onChange={event => onChange({ label: event.target.value })} />

            {physical && (
                <FormControl size="small">
                    <InputLabel>CPX module</InputLabel>
                    <Select
                        value={compatibleSelectedModule ? node.data.module_addr ?? '' : ''}
                        label="CPX module"
                        onChange={event => {
                            const address = Number(event.target.value)
                            const module = compatibleModules.find(item => item.Adress === address)
                            onChange({ module_addr: address, module_name: module?.Name, channel: 0 })
                        }}
                    >
                        {compatibleModules.length === 0 && <MenuItem disabled value="">No compatible modules in this topology</MenuItem>}
                        {compatibleModules.map(module => (
                            <MenuItem key={module.Adress} value={module.Adress}>#{module.Adress} · {module.Name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}
            {physical && selectedModule && !compatibleSelectedModule && (
                <Alert severity="warning">{selectedModule.Name} does not provide the channels required by this block type. Select a compatible module.</Alert>
            )}
            {physical && (
                <TextField
                    select
                    size="small"
                    label={analog ? 'Analog input channel' : node.type === 'input' ? 'Input channel' : node.type === 'valve' ? 'Valve coil channel' : 'Output channel'}
                    value={compatibleSelectedModule ? node.data.channel ?? 0 : ''}
                    onChange={event => onChange({ channel: Number(event.target.value) })}
                    disabled={!compatibleSelectedModule}
                    helperText={compatibleSelectedModule ? `${channelCount} compatible channels reported by topology` : 'Select a compatible CPX module first'}
                >
                    {Array.from({ length: channelCount }, (_, index) => <MenuItem key={index} value={index}>{index}</MenuItem>)}
                </TextField>
            )}
            {node.type === 'input' && (
                <>
                    <TextField select size="small" label="Trigger" value={node.data.trigger ?? 'rising'} onChange={event => onChange({ trigger: event.target.value as AutomationNodeData['trigger'] })}>
                        <MenuItem value="rising">Rising edge (0 → 1)</MenuItem>
                        <MenuItem value="falling">Falling edge (1 → 0)</MenuItem>
                        <MenuItem value="change">Any change</MenuItem>
                        <MenuItem value="level_high">While HIGH</MenuItem>
                        <MenuItem value="level_low">While LOW</MenuItem>
                    </TextField>
                    <TextField size="small" type="number" label="Debounce (ms)" value={node.data.debounce_ms ?? 20} onChange={event => onChange({ debounce_ms: Math.max(0, Number(event.target.value)) })} />
                </>
            )}
            {analog && (
                <>
                    <TextField
                        size="small"
                        type="number"
                        label={`Limit (${analogUnit})`}
                        value={node.data.limit ?? analogLimit}
                        onChange={event => onChange({ limit: Number(event.target.value) })}
                    />
                    <TextField
                        size="small"
                        type="number"
                        label={`Hysteresis (${analogUnit})`}
                        slotProps={{ htmlInput: { min: 0, step: node.type === 'temperature' ? .1 : .01 } }}
                        value={node.data.hysteresis ?? analogHysteresis}
                        onChange={event => onChange({ hysteresis: Math.max(0, Number(event.target.value)) })}
                    />
                    <TextField
                        size="small"
                        type="number"
                        label="Scale per raw count"
                        slotProps={{ htmlInput: { step: 'any' } }}
                        value={node.data.scale ?? (node.type === 'temperature' ? .1 : 10 / 27648)}
                        onChange={event => onChange({ scale: Number(event.target.value) })}
                    />
                    <TextField
                        size="small"
                        type="number"
                        label="Offset"
                        slotProps={{ htmlInput: { step: 'any' } }}
                        value={node.data.offset ?? 0}
                        onChange={event => onChange({ offset: Number(event.target.value) })}
                    />
                    <Alert severity="info" icon={false}>
                        {node.type === 'pressure' ? 'The incoming signal is forwarded only while pressure is at or above the limit. ' : 'The block is HIGH at or above the limit. '}
                        Conversion: value = raw × scale + offset. Hysteresis prevents rapid switching near the limit.
                    </Alert>
                </>
            )}
            {node.type === 'delay' && <EditableNumberField label="Delay (ms)" min={0} step={10} value={node.data.delay_ms ?? 1000} onCommit={value => onChange({ delay_ms: value })} helperText="The output remains HIGH after the delay expires" />}
            {node.type === 'counter' && <EditableNumberField label="Events per output event" min={1} step={1} value={node.data.events_per_toggle ?? 3} onCommit={value => onChange({ events_per_toggle: Math.round(value) })} helperText="Only every Nth rising event is forwarded" />}
            {node.type === 'timer' && (
                <>
                    <EditableNumberField
                        label="Initial delay (ms)"
                        min={0}
                        step={10}
                        value={node.data.initial_delay_ms ?? 1000}
                        onCommit={value => onChange({ initial_delay_ms: value })}
                    />
                    <FormControlLabel
                        label="Repeat event"
                        control={<Switch checked={Boolean(node.data.repeat)} onChange={event => onChange({ repeat: event.target.checked })} />}
                    />
                    {node.data.repeat && (
                        <EditableNumberField
                            label="Repeat interval (ms)"
                            min={10}
                            step={10}
                            value={node.data.interval_ms ?? 1000}
                            onCommit={value => onChange({ interval_ms: value })}
                            helperText="Time between trigger events"
                        />
                    )}
                </>
            )}
            {(node.type === 'output' || node.type === 'valve') && (
                <TextField select size="small" label="Action on event" value={node.data.action ?? 'toggle'} onChange={event => onChange({ action: event.target.value as AutomationNodeData['action'] })}>
                    <MenuItem value="on">Set ON</MenuItem>
                    <MenuItem value="off">Set OFF</MenuItem>
                    <MenuItem value="toggle">Toggle</MenuItem>
                    <MenuItem value="follow">Follow signal level</MenuItem>
                </TextField>
            )}
            {node.type === 'cylinder' && <TextField size="small" type="number" label="Stroke time (seconds)" slotProps={{ htmlInput: { min: .05, step: .1 } }} value={node.data.travel_time_s ?? 1} onChange={event => onChange({ travel_time_s: Math.max(.05, Number(event.target.value)) })} />}
            {node.type === 'comment' && <TextField size="small" multiline minRows={5} label="Note" value={node.data.text ?? ''} onChange={event => onChange({ text: event.target.value })} />}
            {node.data.runtime && (
                <Box>
                    <Typography variant="overline">Live state</Typography>
                    <Stack direction="row" sx={{ gap: .5, flexWrap: 'wrap' }}>
                        {Object.entries(node.data.runtime).map(([key, value]) => <Chip key={key} size="small" label={`${key}: ${String(value)}`} />)}
                    </Stack>
                </Box>
            )}
        </Stack>
    )
}

function AutomationStudioCanvas({ realTopology, simulatedTopology, ip, hwConnected, onOpenMockTopology }: Props) {
    const [initialDraft] = useState(readDraft)
    const [nodes, setNodes, onNodesChange] = useNodesState<AutomationNode>(initialDraft.nodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState<AutomationEdge>(initialDraft.edges)
    const [selectedId, setSelectedId] = useState<string | null>(initialDraft.selectedId)
    const [programId, setProgramId] = useState<string | null>(initialDraft.programId)
    const [programName, setProgramName] = useState(initialDraft.programName)
    const [description, setDescription] = useState(initialDraft.description)
    const [scanInterval, setScanInterval] = useState(initialDraft.scanInterval)
    const [target, setTarget] = useState<AutomationTarget>(initialDraft.target)
    const [programs, setPrograms] = useState<AutomationProgram[]>([])
    const [selectedProgramId, setSelectedProgramId] = useState(initialDraft.selectedProgramId)
    const [persistence, setPersistence] = useState<'pocketbase' | 'memory' | 'unknown'>('unknown')
    const [status, setStatus] = useState<AutomationStatus>(EMPTY_STATUS)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'warning' | 'info', text: string } | null>(null)
    const { screenToFlowPosition, fitView } = useReactFlow()
    const topology = target === 'simulated' ? simulatedTopology : realTopology

    const selected = useMemo(() => nodes.find(node => node.id === selectedId) ?? null, [nodes, selectedId])
    const renderedEdges = useMemo(() => {
        const nodeById = new Map(nodes.map(node => [node.id, node]))
        return edges.map(edge => {
            const source = nodeById.get(edge.source)
            const runtime = source?.data.runtime ?? {}
            const sourceHandle = edge.sourceHandle ?? 'signal'
            const active = Boolean(runtime[sourceHandle] ?? runtime.signal)
            return {
                ...edge,
                animated: active,
                style: {
                    ...edge.style,
                    stroke: active ? '#00c853' : '#90a4ae',
                    strokeWidth: active ? 3 : 1.5,
                },
            }
        })
    }, [edges, nodes])

    useEffect(() => {
        const draft: AutomationDraft = {
            nodes: nodes.map(node => ({ ...node, data: { ...node.data, runtime: undefined } })),
            edges,
            selectedId,
            programId,
            selectedProgramId,
            programName,
            description,
            scanInterval,
            target,
        }
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
    }, [description, edges, nodes, programId, programName, scanInterval, selectedId, selectedProgramId, target])

    const refreshPrograms = useCallback(async () => {
        try {
            const data = await apiJson<{ items: AutomationProgram[], persistence: 'pocketbase' | 'memory' }>('/automation/programs')
            setPrograms(data.items)
            setPersistence(data.persistence)
        } catch (error) {
            setMessage({ severity: 'error', text: `Could not load programs: ${(error as Error).message}` })
        }
    }, [])

    useEffect(() => { void refreshPrograms() }, [refreshPrograms])

    useEffect(() => {
        let cancelled = false
        const poll = async () => {
            try {
                const next = await apiJson<AutomationStatus>('/automation/status')
                if (!cancelled) setStatus(next)
            } catch {
                if (!cancelled) setStatus(EMPTY_STATUS)
            }
        }
        void poll()
        const timer = window.setInterval(poll, 500)
        return () => { cancelled = true; window.clearInterval(timer) }
    }, [])

    useEffect(() => {
        setNodes(current => current.map(node => ({
            ...node,
            data: { ...node.data, runtime: status.node_states[node.id] },
        })))
    }, [status.node_states, setNodes])

    const onConnect = useCallback((connection: Connection) => {
        const targetNode = nodes.find(node => node.id === connection.target)
        const sourceNode = nodes.find(node => node.id === connection.source)
        const normalizedConnection = targetNode && ['and', 'or'].includes(targetNode.type) && sourceNode?.type === 'input'
            ? { ...connection, sourceHandle: 'state' }
            : connection
        if (targetNode && ['and', 'or'].includes(targetNode.type)) {
            if (!['input-a', 'input-b'].includes(normalizedConnection.targetHandle ?? '')) return
            const occupied = edges.some(edge => edge.target === normalizedConnection.target && edge.targetHandle === normalizedConnection.targetHandle)
            if (occupied) {
                setMessage({ severity: 'warning', text: 'Each AND/OR input accepts one connection. Use the other input connector.' })
                return
            }
        }
        setEdges(current => addEdge({ ...normalizedConnection, id: `edge_${crypto.randomUUID()}` }, current))
    }, [edges, nodes, setEdges])

    const addBlock = useCallback((type: AutomationBlockType, position?: { x: number, y: number }) => {
        const id = `${type}_${crypto.randomUUID()}`
        const data = defaultData(type)
        const firstCompatible = modulesForBlock(topology?.Topology ?? [], type)[0]
        if (firstCompatible && ['input', 'temperature', 'voltage', 'pressure', 'output', 'valve'].includes(type)) {
            data.module_addr = firstCompatible.Adress
            data.module_name = firstCompatible.Name
            data.channel = 0
        }
        const node: AutomationNode = {
            id,
            type,
            position: position ?? { x: 120 + nodes.length * 35, y: 100 + nodes.length * 25 },
            data,
        }
        setNodes(current => [...current, node])
        setSelectedId(id)
    }, [nodes.length, setNodes, topology])

    const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        const type = event.dataTransfer.getData('application/festo-automation-block') as AutomationBlockType
        if (!PALETTE.some(item => item.type === type)) return
        addBlock(type, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    }, [addBlock, screenToFlowPosition])

    const updateSelected = useCallback((patch: Partial<AutomationNodeData>) => {
        if (!selectedId) return
        setNodes(current => current.map(node => node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node))
    }, [selectedId, setNodes])

    const deleteSelected = useCallback(() => {
        if (!selectedId) return
        setNodes(current => current.filter(node => node.id !== selectedId))
        setEdges(current => current.filter(edge => edge.source !== selectedId && edge.target !== selectedId))
        setSelectedId(null)
    }, [selectedId, setEdges, setNodes])

    const currentProgram = useCallback(() => cleanProgram(nodes, edges, {
        id: programId,
        name: programName,
        description,
        scan_interval_ms: scanInterval,
    }, topology), [nodes, edges, programId, programName, description, scanInterval, topology])

    const saveProgram = useCallback(async () => {
        setBusy(true)
        try {
            const response = await apiJson<{ program: AutomationProgram, persistence: 'pocketbase' | 'memory' }>(
                programId ? `/automation/programs/${programId}` : '/automation/programs',
                { method: programId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentProgram()) },
            )
            setProgramId(response.program.id ?? null)
            setSelectedProgramId(response.program.id ?? '')
            setPersistence(response.persistence)
            await refreshPrograms()
            setMessage({ severity: response.persistence === 'pocketbase' ? 'success' : 'warning', text: response.persistence === 'pocketbase' ? 'Program saved to PocketBase' : 'PocketBase unavailable; program is stored only in API memory' })
        } catch (error) {
            setMessage({ severity: 'error', text: `Save failed: ${(error as Error).message}` })
        } finally {
            setBusy(false)
        }
    }, [currentProgram, programId, refreshPrograms])

    const loadProgram = useCallback((id: string) => {
        setSelectedProgramId(id)
        const program = programs.find(item => item.id === id)
        if (!program) return
        setProgramId(program.id ?? null)
        setProgramName(program.name)
        setDescription(program.description)
        setScanInterval(program.scan_interval_ms)
        setNodes(program.nodes.map(node => ({ ...node, data: { ...node.data } })))
        setEdges(normalizeLogicGateEdges(program.nodes, program.edges))
        setSelectedId(null)
        window.setTimeout(() => fitView({ padding: .2, duration: 300 }), 50)
    }, [fitView, programs, setEdges, setNodes])

    const removeProgram = useCallback(async () => {
        if (!programId) return
        setBusy(true)
        try {
            await apiJson(`/automation/programs/${programId}`, { method: 'DELETE' })
            setProgramId(null)
            setSelectedProgramId('')
            await refreshPrograms()
            setMessage({ severity: 'success', text: 'Program deleted' })
        } catch (error) {
            setMessage({ severity: 'error', text: `Delete failed: ${(error as Error).message}` })
        } finally { setBusy(false) }
    }, [programId, refreshPrograms])

    const startProgram = useCallback(async () => {
        if (target === 'real' && !hwConnected) {
            setMessage({ severity: 'warning', text: `Connect to CPX at ${ip} before starting the program` })
            return
        }
        setBusy(true)
        try {
            await apiJson('/automation/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentProgram()) })
            const next = await apiJson<AutomationStatus>('/automation/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ program: currentProgram(), target }) })
            setStatus(next)
            setMessage({ severity: 'success', text: `${target === 'real' ? 'Real' : 'Simulated'} automation started with ${scanInterval} ms scan interval` })
        } catch (error) {
            setMessage({ severity: 'error', text: `Start failed: ${(error as Error).message}` })
        } finally { setBusy(false) }
    }, [currentProgram, hwConnected, ip, scanInterval, target])

    const stopProgram = useCallback(async () => {
        setBusy(true)
        try {
            const next = await apiJson<AutomationStatus>('/automation/stop', { method: 'POST' })
            setStatus(next)
            setMessage({ severity: 'info', text: 'Automation stopped; owned outputs reset to LOW' })
        } catch (error) {
            setMessage({ severity: 'error', text: `Stop failed: ${(error as Error).message}` })
        } finally { setBusy(false) }
    }, [])

    const loadExample = useCallback(() => {
        const inputModules = modulesForBlock(topology?.Topology ?? [], 'input')
        const inputModule = inputModules.find(module => module.Adress === 3) ?? inputModules[0]
        const valveModule = modulesForBlock(topology?.Topology ?? [], 'valve')[0]
        const inputAddress = inputModule?.Adress ?? 3
        const valveAddress = valveModule?.Adress ?? 0
        const exampleNodes: AutomationNode[] = [
            { id: 'example_input', type: 'input', position: { x: 40, y: 80 }, data: { ...defaultData('input'), label: `Module ${inputAddress} · end/start sensor`, module_addr: inputAddress, module_name: inputModule?.Name, channel: 0 } },
            { id: 'example_valve_on', type: 'valve', position: { x: 330, y: 60 }, data: { ...defaultData('valve'), label: 'Extend valve', module_addr: valveAddress, module_name: valveModule?.Name, channel: 0, action: 'on' } },
            { id: 'example_cylinder', type: 'cylinder', position: { x: 640, y: 50 }, data: { ...defaultData('cylinder'), label: 'Cylinder A', travel_time_s: 1.5 } },
            { id: 'example_delay', type: 'delay', position: { x: 930, y: 70 }, data: { ...defaultData('delay'), label: 'Dwell at end', delay_ms: 500 } },
            { id: 'example_valve_off', type: 'valve', position: { x: 1210, y: 60 }, data: { ...defaultData('valve'), label: 'Retract valve', module_addr: valveAddress, module_name: valveModule?.Name, channel: 0, action: 'off' } },
        ]
        const exampleEdges: AutomationEdge[] = [
            { id: 'e_input_valve', source: 'example_input', sourceHandle: 'signal', target: 'example_valve_on', targetHandle: 'trigger' },
            { id: 'e_valve_cylinder', source: 'example_valve_on', sourceHandle: 'extend', target: 'example_cylinder', targetHandle: 'extend' },
            { id: 'e_cylinder_delay', source: 'example_cylinder', sourceHandle: 'extended-event', target: 'example_delay', targetHandle: 'trigger' },
            { id: 'e_delay_off', source: 'example_delay', sourceHandle: 'signal', target: 'example_valve_off', targetHandle: 'trigger' },
        ]
        setNodes(exampleNodes)
        setEdges(exampleEdges)
        setProgramId(null)
        setSelectedProgramId('')
        setProgramName('Cylinder extend / dwell / retract')
        setDescription(`A rising edge on module ${inputAddress} extends a virtual cylinder, waits at its end position, then switches the valve off.`)
        setSelectedId(null)
        window.setTimeout(() => fitView({ padding: .15, duration: 350 }), 50)
    }, [fitView, setEdges, setNodes, topology])

    const setSimulationInput = useCallback(async (node: AutomationNode, value: boolean) => {
        try {
            await apiJson('/automation/simulation/input', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ module_addr: node.data.module_addr, channel: node.data.channel, value }),
            })
        } catch (error) {
            setMessage({ severity: 'error', text: `Simulation input failed: ${(error as Error).message}` })
        }
    }, [])

    const setSimulationAnalog = useCallback(async (node: AutomationNode, value: number) => {
        if (!Number.isFinite(value)) return
        try {
            await apiJson('/automation/simulation/analog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ module_addr: node.data.module_addr, channel: node.data.channel, value }),
            })
        } catch (error) {
            setMessage({ severity: 'error', text: `Simulation analog value failed: ${(error as Error).message}` })
        }
    }, [])

    const onNodeClick: NodeMouseHandler<AutomationNode> = useCallback((_event, node) => setSelectedId(node.id), [])

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 620 }}>
            <Paper square variant="outlined" sx={{ p: 1.25, flexShrink: 0 }}>
                <Stack direction="row" spacing={1.25} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={target}
                        disabled={status.running}
                        onChange={(_event, value: AutomationTarget | null) => { if (value) setTarget(value) }}
                        aria-label="automation target"
                    >
                        <ToggleButton value="simulated" aria-label="simulated system"><Memory fontSize="small" sx={{ mr: .5 }} />Simulated</ToggleButton>
                        <ToggleButton value="real" aria-label="real CPX system"><Router fontSize="small" sx={{ mr: .5 }} />Real CPX</ToggleButton>
                    </ToggleButtonGroup>
                    <TextField size="small" label="Program name" value={programName} onChange={event => setProgramName(event.target.value)} sx={{ minWidth: 230 }} />
                    <EditableNumberField label="Scan (ms)" value={scanInterval} min={10} max={2000} step={10} onCommit={setScanInterval} width={110} />
                    <FormControl size="small" sx={{ minWidth: 230 }}>
                        <InputLabel>Saved program</InputLabel>
                        <Select value={selectedProgramId} label="Saved program" onChange={event => loadProgram(event.target.value)}>
                            <MenuItem value=""><em>Unsaved program</em></MenuItem>
                            {programs.map(program => <MenuItem key={program.id} value={program.id ?? ''}>{program.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button variant="outlined" startIcon={<Save />} disabled={busy || nodes.length === 0} onClick={() => void saveProgram()}>Save</Button>
                    <Button color="error" variant="text" startIcon={<Delete />} disabled={busy || !programId} onClick={() => void removeProgram()}>Delete</Button>
                    <Divider orientation="vertical" flexItem />
                    <Tooltip title={target === 'simulated' ? 'Run against the API in-memory I/O simulator' : hwConnected ? `Run through the API scan loop on ${ip}` : `Connect to ${ip} first`}>
                        <span><Button variant="contained" color="success" startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />} disabled={busy || status.running || nodes.length === 0 || (target === 'real' && !hwConnected)} onClick={() => void startProgram()}>Run</Button></span>
                    </Tooltip>
                    <Button variant="contained" color="error" startIcon={<Stop />} disabled={busy || !status.running} onClick={() => void stopProgram()}>Stop</Button>
                    <Chip size="small" color={status.running ? 'success' : status.last_error ? 'error' : 'default'} label={status.running ? `RUNNING ${status.target?.toUpperCase() ?? ''} · ${status.last_cycle_ms ?? '—'} ms` : status.last_error ? 'FAULT' : 'STOPPED'} />
                    <Chip size="small" variant="outlined" color={persistence === 'pocketbase' ? 'success' : persistence === 'memory' ? 'warning' : 'default'} label={persistence === 'pocketbase' ? 'PocketBase' : persistence === 'memory' ? 'Memory only' : 'Storage unknown'} />
                </Stack>
            </Paper>

            {target === 'simulated' && !simulatedTopology && (
                <Alert severity="warning" action={<Button color="inherit" size="small" onClick={onOpenMockTopology}>Build topology</Button>}>
                    Add a mock CPX topology so input, analog, output, and valve blocks can select compatible modules.
                </Alert>
            )}
            {target === 'simulated' && nodes.some(node => node.type === 'input') && (
                <Paper square variant="outlined" sx={{ px: 1.5, py: .5 }}>
                    <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>Virtual inputs</Typography>
                        {nodes.filter(node => node.type === 'input').map(node => {
                            const key = `${node.data.module_addr ?? 0}:${node.data.channel ?? 0}`
                            return (
                                <FormControlLabel
                                    key={node.id}
                                    label={`${node.data.label} (M${node.data.module_addr ?? 0} I${node.data.channel ?? 0})`}
                                    control={<Switch size="small" checked={Boolean(status.simulation?.inputs[key])} onChange={event => void setSimulationInput(node, event.target.checked)} />}
                                />
                            )
                        })}
                    </Stack>
                </Paper>
            )}
            {target === 'simulated' && nodes.some(node => ['temperature', 'voltage', 'pressure'].includes(node.type)) && (
                <Paper square variant="outlined" sx={{ px: 1.5, py: .75 }}>
                    <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>Virtual analog values (raw)</Typography>
                        {nodes.filter(node => ['temperature', 'voltage', 'pressure'].includes(node.type)).map(node => {
                            const key = `${node.data.module_addr ?? 0}:${node.data.channel ?? 0}`
                            return (
                                <TextField
                                    key={`${node.id}:${status.simulation?.analogs[key] ?? 0}`}
                                    size="small"
                                    type="number"
                                    label={`${node.data.label} (M${node.data.module_addr ?? 0} AI${node.data.channel ?? 0})`}
                                    defaultValue={status.simulation?.analogs[key] ?? 0}
                                    slotProps={{ htmlInput: { step: 'any' } }}
                                    onChange={event => void setSimulationAnalog(node, Number(event.target.value))}
                                    sx={{ width: 230 }}
                                />
                            )
                        })}
                    </Stack>
                </Paper>
            )}
            {status.last_error && <Alert severity="error" onClose={() => setStatus(current => ({ ...current, last_error: null }))}>{status.last_error}</Alert>}

            <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '230px minmax(420px, 1fr) 290px' }}>
                <Paper square variant="outlined" sx={{ p: 1.25, overflow: 'auto' }}>
                    <Stack direction="row" sx={{ mb: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle2">Block library</Typography>
                        <Tooltip title="Load a ready-to-edit module 3 → valve → cylinder example"><Button size="small" startIcon={<Science />} onClick={loadExample}>Example</Button></Tooltip>
                    </Stack>
                    {(['Events', 'Control', 'Actions', 'Pneumatics', 'Notes'] as const).map(group => (
                        <Box key={group} sx={{ mb: 1.5 }}>
                            <ListSubheader disableSticky sx={{ px: 0, lineHeight: '26px', bgcolor: 'transparent' }}>{group}</ListSubheader>
                            <Stack spacing={.75}>{PALETTE.filter(item => item.group === group).map(item => <PaletteBlock key={item.type} item={item} onAdd={addBlock} />)}</Stack>
                        </Box>
                    ))}
                    <Alert severity="info" icon={false} sx={{ mt: 1, py: .5 }}>
                        <Typography variant="caption">Drag blocks onto the canvas, then connect their round ports—like Scratch, but with explicit signal wires.</Typography>
                    </Alert>
                </Paper>

                <Box
                    onDrop={onDrop}
                    onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
                    sx={{
                        minWidth: 0,
                        position: 'relative',
                        '& .react-flow__node-input, & .react-flow__node-output': {
                            width: 'auto',
                            padding: 0,
                            border: 0,
                            borderRadius: 0,
                            background: 'transparent',
                            color: 'inherit',
                            textAlign: 'initial',
                        },
                        '& .react-flow__node:focus, & .react-flow__node:focus-visible': { outline: 'none' },
                    }}
                >
                    <ReactFlow<AutomationNode, AutomationEdge>
                        nodes={nodes}
                        edges={renderedEdges}
                        nodeTypes={automationNodeTypes}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={() => setSelectedId(null)}
                        deleteKeyCode={['Backspace', 'Delete']}
                        fitView
                        minZoom={.2}
                        maxZoom={2}
                        snapToGrid
                        snapGrid={[16, 16]}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                        <Controls />
                        <MiniMap nodeColor={node => PALETTE.find(item => item.type === node.type)?.color ?? '#888'} pannable zoomable />
                        {nodes.length === 0 && (
                            <Panel position="top-center">
                                <Paper sx={{ p: 2, mt: 6, textAlign: 'center', maxWidth: 420 }}>
                                    <Add color="primary" />
                                    <Typography variant="h6">Build your first automation</Typography>
                                    <Typography variant="body2" color="text.secondary">Drag an input, action, or pneumatic block from the library. Use “Example” for a complete cylinder cycle.</Typography>
                                </Paper>
                            </Panel>
                        )}
                    </ReactFlow>
                </Box>

                <Paper square variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
                    <NodeInspector node={selected} topology={topology} onChange={updateSelected} onDelete={deleteSelected} />
                </Paper>
            </Box>

            <Snackbar open={Boolean(message)} autoHideDuration={5000} onClose={() => setMessage(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                {message ? <Alert severity={message.severity} variant="filled" onClose={() => setMessage(null)}>{message.text}</Alert> : undefined}
            </Snackbar>
        </Box>
    )
}

export default function AutomationStudio(props: Props) {
    return <ReactFlowProvider><AutomationStudioCanvas {...props} /></ReactFlowProvider>
}

// Keep a named export for custom block libraries and future plugin blocks.
export { AutomationBlockNode }
