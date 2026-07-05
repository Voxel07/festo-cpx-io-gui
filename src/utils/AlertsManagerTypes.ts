import type { AlertColor } from '@mui/material';

export interface AlertMessage {
    id: number;
    severity: AlertColor;
    message: any;
    remainingTime: number;
}

export interface AlertsManagerRef {
    showAlert: (severity: AlertColor, message: any) => void;
}
