import { useEffect, useState } from 'react'
import { Box, Button, Typography, Stack, Autocomplete, TextField } from '@mui/material'
import type { Topology, TopologyModule } from '../types'

interface Props {
    mockTopology: Topology | null
    setMockTopology: (t: Topology | null) => void
}

interface MappingEntry {
    OrderCode: string
    PartNumber: string
    FileName: string
}

interface ModuleMetadata {
    category: string
    mounted_valves: number[]
    valve_slots: number | null
    num_inputs?: number
    num_outputs?: number
    num_inouts?: number
}

export default function MockBuilderTab({ mockTopology, setMockTopology }: Props) {
    const [mappings, setMappings] = useState<MappingEntry[]>([])
    const [metadata, setMetadata] = useState<Record<string, ModuleMetadata>>({})
    const [selectedCode, setSelectedCode] = useState<string | null>(null)
    const [addAddress, setAddAddress] = useState<string>("")

    useEffect(() => {
        fetch('/svg/IconFileMapping.json')
            .then(r => r.json())
            .then(data => {
                if (data.IconFileMapping) {
                    setMappings(data.IconFileMapping)
                }
            })
            .catch(err => console.error('Failed to load mappings', err))

        fetch('/metadata/modules')
            .then(r => r.json())
            .then(data => setMetadata(data))
            .catch(err => console.error('Failed to load metadata', err))
    }, [])

    const handleAddModule = (explicitCode?: string) => {
        const codeToUse = typeof explicitCode === 'string' ? explicitCode : selectedCode
        if (!codeToUse) return

        const mods = mockTopology?.Topology ?? []

        // Find matching metadata (it can be exact, or match without trailing characters, similar to backend logic)
        let matchedMeta = metadata[codeToUse]
        if (!matchedMeta) {
            const keys = Object.keys(metadata)
            const fallbackKey = keys.find(k => codeToUse.startsWith(k))
            if (fallbackKey) {
                matchedMeta = metadata[fallbackKey]
            }
        }

        const addressToUse = addAddress === "" ? mods.length : parseInt(addAddress) || 0

        const newMod: TopologyModule = {
            Adress: addressToUse,
            Name: codeToUse,
            Modulecode: 9999,
            ProductKey: '',
            Type: matchedMeta?.category ? matchedMeta.category.charAt(0).toUpperCase() + matchedMeta.category.slice(1) : 'MockType',
            NumOfInputs: matchedMeta?.num_inputs ?? 0,
            NumOfOutputs: matchedMeta?.num_outputs ?? 0,
            NumOfInOuts: matchedMeta?.num_inouts ?? 0,
            ValveSlots: matchedMeta?.valve_slots ?? undefined,
            MountedValves: [],
        }

        const newTopology = [...mods, newMod].sort((a, b) => a.Adress - b.Adress)
        setMockTopology({
            Name: mockTopology?.Name ?? 'Mock Topology',
            Description: mockTopology?.Description ?? '',
            Version: mockTopology?.Version ?? '1.0',
            Topology: newTopology
        })
        if (addAddress !== "") setAddAddress((addressToUse + 1).toString())
    }

    const handleClear = () => {
        setMockTopology(null)
    }

    const handleSave = () => {
        if (!mockTopology) return
        const blob = new Blob([JSON.stringify(mockTopology, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'mock-topology.json'
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target?.result as string)
                if (data && data.Topology) {
                    setMockTopology(data)
                }
            } catch (err) {
                console.error(err)
            }
        }
        reader.readAsText(file)
    }

    return (
        <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>Mock Builder</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Add modules from the library to test SVG rendering and layout logic. The resulting topology will be displayed above.<br />
                Source: <code>/public/svg/IconFileMapping.json</code>
            </Typography>

            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 4 }}>
                <Autocomplete
                    sx={{ minWidth: 350 }}
                    options={mappings}
                    getOptionLabel={(option) => `${option.OrderCode} (${option.FileName})`}
                    value={mappings.find(m => m.OrderCode === selectedCode) || null}
                    onChange={(_, newValue) => setSelectedCode(newValue ? newValue.OrderCode : null)}
                    renderOption={(props, option) => {
                        const { onAuxClick, ...restProps } = props as any;
                        return (
                            <li
                                {...restProps}
                                onAuxClick={(e) => {
                                    if (e.button === 1) { // Middle click
                                        e.preventDefault();
                                        handleAddModule(option.OrderCode);
                                    }
                                    if (onAuxClick) onAuxClick(e);
                                }}
                            >
                                {option.OrderCode} ({option.FileName})
                            </li>
                        );
                    }}
                    renderInput={(params) => <TextField {...params} label="Search Module Type" variant="outlined" />}
                />
                <TextField
                    label="Address (opt)"
                    variant="outlined"
                    type="number"
                    sx={{ width: 140 }}
                    value={addAddress}
                    onChange={e => setAddAddress(e.target.value)}
                    placeholder={mockTopology?.Topology?.length.toString() || '0'}
                />
                <Button variant="contained" onClick={() => handleAddModule()} disabled={!selectedCode}>
                    Add Module
                </Button>
                <Button variant="outlined" color="error" onClick={handleClear} disabled={!mockTopology || (mockTopology.Topology && mockTopology.Topology.length === 0)}>
                    Clear All
                </Button>
            </Stack>

            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Button variant="outlined" onClick={handleSave} disabled={!mockTopology || mockTopology.Topology.length === 0}>
                    Save Config
                </Button>
                <Button variant="outlined" component="label">
                    Load Config
                    <input type="file" hidden accept=".json" onChange={handleLoad} />
                </Button>
            </Stack>
        </Box>
    )
}
