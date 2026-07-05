import {
    Paper, Typography, TableContainer, Table, TableHead,
    TableRow, TableCell, TableBody, Chip
} from '@mui/material'
import type { DashboardData } from './types'

export function DailyBreakdownTable({ data }: { data: DashboardData | null }) {
    return (
        <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Daily Breakdown
            </Typography>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell align="right">Total</TableCell>
                            <TableCell align="right">Passed</TableCell>
                            <TableCell align="right">Failed</TableCell>
                            <TableCell align="right">Rate</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(data?.daily_trend ?? []).slice(-30).reverse().map(d => (
                            <TableRow key={d.date} hover>
                                <TableCell><Typography variant="caption">{d.date}</Typography></TableCell>
                                <TableCell align="right"><Typography variant="caption">{d.total}</Typography></TableCell>
                                <TableCell align="right">
                                    <Chip size="small" label={d.passed} color="success" variant="outlined" sx={{ height: 20, '& .MuiChip-label': { fontSize: 11 } }} />
                                </TableCell>
                                <TableCell align="right">
                                    <Chip size="small" label={d.failed} color={d.failed > 0 ? 'error' : 'default'} variant="outlined" sx={{ height: 20, '& .MuiChip-label': { fontSize: 11 } }} />
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="caption"
                                        sx={{ fontWeight: 600 }}
                                        color={d.rate >= 90 ? 'success.main' : d.rate >= 70 ? 'warning.main' : 'error.main'}>
                                        {d.rate}%
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    )
}
