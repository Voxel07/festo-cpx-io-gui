import { useEffect, useState } from 'react'
import {
    Autocomplete,
    Box,
    Button,
    Divider,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material'
import { AccountTree, Build } from '@mui/icons-material'
import type { Topology, TopologyModule } from '../types'
import AutomationStudio from './AutomationStudio'

interface Props {
    mockTopology: Topology | null
    setMockTopology: (topology: Topology | null) => void
    topology: Topology | null
    ip: string
    hwConnected: boolean
    onSectionChange: (section: number) => void
}

interface MappingEntry {
    OrderCode: string
    PartNumber: string
    FileName: string
}

interface RawMappingEntry {
    OrderCode?: string
    PartNumber?: string
    FileName: string
    Variants?: Array<{ OrderCode: string; PartNumber: string; ModuleCode?: string }>
}

interface ModuleMetadata {
    category: string
    mounted_valves: number[]
    valve_slots: number | null
    num_inputs?: number
    num_outputs?: number
    num_inouts?: number
}

const MOCK_SECTION_STORAGE_KEY = 'festo.mock-builder.section.v1'

function inferChannelCounts(code: string, moduleMetadata?: ModuleMetadata) {
    let inputs = moduleMetadata?.num_inputs ?? 0
    let outputs = moduleMetadata?.num_outputs ?? 0
    let inouts = moduleMetadata?.num_inouts ?? 0
    const normalized = code.toUpperCase()
    const bidirectional = normalized.match(/(\d+)(?:N?DIO|N?IDO)/)
    if (bidirectional && inouts === 0) {
        inouts = Number(bidirectional[1])
    } else {
        const inputMatch = normalized.match(/(\d+)N?DI(?!O)/)
        const analogInputMatch = normalized.match(/(\d+)AI(?!O)/)
        const outputMatch = normalized.match(/(\d+)N?H?DO(?![A-Z])/)
        if (inputMatch && inputs === 0) inputs = Number(inputMatch[1])
        if (analogInputMatch && inputs === 0) inputs = Number(analogInputMatch[1])
        if (outputMatch && outputs === 0) outputs = Number(outputMatch[1])
    }
    const isValve = moduleMetadata?.category.toLowerCase().includes('valve') || /^(VAB|VMP|VAEM|VTOM)/.test(normalized)
    if (isValve && outputs === 0 && inouts === 0) {
        outputs = (moduleMetadata?.valve_slots ?? moduleMetadata?.mounted_valves.length ?? 0) * 2
    }
    return { inputs, outputs, inouts }
}

function MockTopologyBuilder({ mockTopology, setMockTopology }: Pick<Props, 'mockTopology' | 'setMockTopology'>) {
    const [mappings, setMappings] = useState<MappingEntry[]>([])
    const [metadata, setMetadata] = useState<Record<string, ModuleMetadata>>({})
    const [selectedCode, setSelectedCode] = useState<string | null>(null)
    const [addAddress, setAddAddress] = useState('')

    useEffect(() => {
        fetch('/svg/IconFileMapping.json')
            .then(response => response.json())
            .then(data => {
                if (data.IconFileMapping) {
                    const flat: MappingEntry[] = []
                    for (const entry of data.IconFileMapping as RawMappingEntry[]) {
                        if (entry.Variants) {
                            for (const variant of entry.Variants) {
                                flat.push({ OrderCode: variant.OrderCode, PartNumber: variant.PartNumber, FileName: entry.FileName })
                            }
                        } else if (entry.OrderCode) {
                            flat.push({ OrderCode: entry.OrderCode, PartNumber: entry.PartNumber ?? '', FileName: entry.FileName })
                        }
                    }
                    setMappings(flat)
                }
            })
            .catch(error => console.error('Failed to load mappings', error))
        fetch('/metadata/modules')
            .then(response => response.json())
            .then(data => setMetadata(data))
            .catch(error => console.error('Failed to load metadata', error))
    }, [])

    const addModule = (explicitCode?: string) => {
        const code = explicitCode ?? selectedCode
        if (!code) return
        const modules = mockTopology?.Topology ?? []
        const metadataKey = Object.keys(metadata).find(key => code === key || code.startsWith(key))
        const moduleMetadata = metadataKey ? metadata[metadataKey] : undefined
        const counts = inferChannelCounts(code, moduleMetadata)
        const address = addAddress === '' ? modules.length : Number.parseInt(addAddress, 10) || 0
        const module: TopologyModule = {
            Adress: address,
            Name: code,
            Modulecode: 9999,
            ProductKey: '',
            Type: moduleMetadata?.category
                ? moduleMetadata.category.charAt(0).toUpperCase() + moduleMetadata.category.slice(1)
                : /(\d+)AI|RTD|U-I|\bUI\b/i.test(code) ? 'Analog' : 'MockType',
            NumOfInputs: counts.inputs,
            NumOfOutputs: counts.outputs,
            NumOfInOuts: counts.inouts,
            ValveSlots: moduleMetadata?.valve_slots ?? undefined,
            MountedValves: moduleMetadata?.mounted_valves ?? [],
        }
        setMockTopology({
            Name: mockTopology?.Name ?? 'Mock Topology',
            Description: mockTopology?.Description ?? '',
            Version: mockTopology?.Version ?? '1.0',
            Topology: [...modules.filter(item => item.Adress !== address), module].sort((a, b) => a.Adress - b.Adress),
        })
        if (addAddress !== '') setAddAddress(String(address + 1))
    }

    const saveFile = () => {
        if (!mockTopology) return
        const url = URL.createObjectURL(new Blob([JSON.stringify(mockTopology, null, 2)], { type: 'application/json' }))
        const link = document.createElement('a')
        link.href = url
        link.download = 'mock-topology.json'
        link.click()
        URL.revokeObjectURL(url)
    }

    const loadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = result => {
            try {
                const data = JSON.parse(result.target?.result as string)
                if (data?.Topology) setMockTopology(data)
            } catch (error) {
                console.error('Invalid mock topology JSON', error)
            }
        }
        reader.readAsText(file)
    }

    return (
        <Box sx={{ p: 2, overflow: 'auto', height: '100%' }}>
            <Typography variant="h6" gutterBottom>Hardware topology sandbox</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Assemble a virtual CPX topology for UI development. This topology is also available to the Automation Studio channel selectors.
            </Typography>
            <Stack direction="row" spacing={2} useFlexGap sx={{ mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                <Autocomplete
                    sx={{ minWidth: 360 }}
                    options={mappings}
                    getOptionLabel={option => `${option.OrderCode} (${option.FileName})`}
                    isOptionEqualToValue={(option, value) => option.OrderCode === value.OrderCode}
                    value={mappings.find(mapping => mapping.OrderCode === selectedCode) ?? null}
                    onChange={(_event, value) => setSelectedCode(value?.OrderCode ?? null)}
                    renderOption={(optionProps, option) => {
                        const { key, ...listItemProps } = optionProps
                        return (
                            <li
                                key={key}
                                {...listItemProps}
                                onMouseDown={event => {
                                    if (event.button === 1) {
                                        event.preventDefault()
                                        event.stopPropagation()
                                    }
                                }}
                                onAuxClick={event => {
                                    if (event.button !== 1) return
                                    event.preventDefault()
                                    event.stopPropagation()
                                    addModule(option.OrderCode)
                                }}
                            >
                                {option.OrderCode} ({option.FileName})
                            </li>
                        )
                    }}
                    renderInput={params => <TextField {...params} label="Search module type" size="small" />}
                />
                <TextField size="small" label="Address (optional)" type="number" sx={{ width: 160 }} value={addAddress} onChange={event => setAddAddress(event.target.value)} placeholder={String(mockTopology?.Topology.length ?? 0)} />
                <Button variant="contained" onClick={() => addModule()} disabled={!selectedCode}>Add module</Button>
                <Button variant="outlined" color="error" onClick={() => setMockTopology(null)} disabled={!mockTopology?.Topology.length}>Clear all</Button>
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <Stack direction="row" spacing={2}>
                <Button variant="outlined" onClick={saveFile} disabled={!mockTopology?.Topology.length}>Export JSON</Button>
                <Button variant="outlined" component="label">Import JSON<input type="file" hidden accept=".json" onChange={loadFile} /></Button>
            </Stack>
        </Box>
    )
}

export default function MockBuilderTab(props: Props) {
    const [section, setSection] = useState(() => Number(window.localStorage.getItem(MOCK_SECTION_STORAGE_KEY)) === 1 ? 1 : 0)
    const { onSectionChange } = props

    useEffect(() => {
        window.localStorage.setItem(MOCK_SECTION_STORAGE_KEY, String(section))
        onSectionChange(section)
    }, [onSectionChange, section])

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Tabs value={section} onChange={(_event, value) => setSection(value)} sx={{ px: 2, minHeight: 42, flexShrink: 0 }}>
                <Tab icon={<AccountTree fontSize="small" />} iconPosition="start" label="Automation Studio" sx={{ minHeight: 42 }} />
                <Tab icon={<Build fontSize="small" />} iconPosition="start" label="Mock topology" sx={{ minHeight: 42 }} />
            </Tabs>
            <Divider />
            <Box sx={{ flex: 1, minHeight: 0 }}>
                {section === 0
                    ? <AutomationStudio realTopology={props.topology} simulatedTopology={props.mockTopology} ip={props.ip} hwConnected={props.hwConnected} onOpenMockTopology={() => setSection(1)} />
                    : <MockTopologyBuilder mockTopology={props.mockTopology} setMockTopology={props.setMockTopology} />}
            </Box>
        </Box>
    )
}
