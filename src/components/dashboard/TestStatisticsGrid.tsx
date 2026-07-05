import { Paper, Typography, Box, Chip } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import type { DashboardData } from './types'

export function TestStatisticsGrid({ data }: { data: DashboardData | null }) {
    return (
        <Paper elevation={1} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Test Statistics
            </Typography>
            <Box sx={{ flex: 1, minHeight: 300, width: '100%' }}>
                <DataGrid
                    rows={Array.from(new Map(
                        [...(data?.top_modules ?? []), ...(data?.most_failing ?? [])]
                            .map(m => [m.test_id, { id: m.test_id, ...m }])
                    ).values())}
                    columns={[
                        { field: 'test_id', headerName: 'Test ID', flex: 1, minWidth: 200 },
                        { field: 'count', headerName: 'Runs', type: 'number', width: 90 },
                        {
                            field: 'failures',
                            headerName: 'Failures',
                            type: 'number',
                            width: 90,
                            renderCell: (params) => (
                                params.value > 0 ? (
                                    <Chip size="small" label={params.value} color="error" variant="outlined" sx={{ height: 20, minWidth: 24, '& .MuiChip-label': { px: 0.75, fontSize: 10 } }} />
                                ) : <Typography variant="caption" color="text.secondary">0</Typography>
                            )
                        }
                    ]}
                    density="compact"
                    disableRowSelectionOnClick
                    initialState={{
                        pagination: { paginationModel: { pageSize: 10 } },
                        sorting: { sortModel: [{ field: 'count', sort: 'desc' }] }
                    }}
                    pageSizeOptions={[5, 10, 25]}
                />
            </Box>
        </Paper>
    )
}
