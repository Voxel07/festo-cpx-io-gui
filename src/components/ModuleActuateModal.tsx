import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button
} from '@mui/material'
import type { TopologyModule } from '../types'
import ModuleActuatePanel from './ModuleActuatePanel'

interface Props {
    open: boolean
    /** The module being actuated */
    module: TopologyModule | null
    /** IP address of the CPX-AP gateway */
    ip: string
    /** 0-based indices of mounted valve slots (VABX valve bodies only) */
    mountedValves?: number[]
    /** Called when the user closes the modal */
    onClose: () => void
}

export default function ModuleActuateModal({ open, module, ip, mountedValves, onClose }: Props) {
    if (!module) return null

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 700, pb: 1 }}>
                Actuate Module
            </DialogTitle>

            <DialogContent dividers>
                <ModuleActuatePanel
                    key={module.Adress}
                    module={module}
                    ip={ip}
                    mountedValves={mountedValves}
                />
            </DialogContent>

            <DialogActions>
                <Button size="small" onClick={onClose}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    )
}
