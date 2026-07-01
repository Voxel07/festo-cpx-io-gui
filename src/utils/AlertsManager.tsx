import { useState, useEffect, useImperativeHandle, createContext, forwardRef } from 'react';
import { Alert, Slide, LinearProgress, Box } from '@mui/material';
import type { AlertColor } from '@mui/material';

export const AlertsContext = createContext<any>(null);

/**
 * Format alert messages: handle strings, objects with .message, and fallback to JSON.
 */
function formatAlertMessage(msg: any): string {
    if (typeof msg === 'string') return msg;
    if (typeof msg === 'object' && msg !== null) {
        return msg.message || msg.error || msg.details || JSON.stringify(msg);
    }
    return String(msg);
}

export interface AlertMessage {
    id: number;
    severity: AlertColor;
    message: any;
    remainingTime: number;
}

export interface AlertsManagerRef {
    showAlert: (severity: AlertColor, message: any) => void;
}

const AlertsManager = forwardRef<AlertsManagerRef, {}>((props, ref) => {
    const [alerts, setAlerts] = useState<AlertMessage[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setAlerts((prevAlerts) =>
                prevAlerts.map((alert) => ({
                    ...alert,
                    remainingTime: Math.max(alert.remainingTime - 100, 0),
                }))
            );
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // Function to add an alert to the state
    const showAlert = (severity: AlertColor, message: any) => {
        const id = new Date().getTime();
        setAlerts((prevAlerts) => {
            const nextAlerts = [
                ...prevAlerts,
                { id, severity, message, remainingTime: 3000 },
            ];
            if (nextAlerts.length > 5) {
                // Keep only the 5 most recent alerts
                return nextAlerts.slice(-5);
            }
            return nextAlerts;
        });
    };

    // Function to remove an alert from the state
    const removeAlert = (id: number) => {
        setAlerts((prevAlerts) => prevAlerts.filter((alert) => alert.id !== id));
    };

    useImperativeHandle(ref, () => ({
        showAlert,
    }));

    return (
        <Box
            sx={{
                position: 'fixed',
                top: 10,
                right: 10,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
            }}
        >
            {alerts.map((alert) => (
                <Slide
                    key={alert.id}
                    direction="left"
                    in={true}
                    mountOnEnter
                    unmountOnExit
                    onEnter={() => {
                        setTimeout(() => {
                            removeAlert(alert.id);
                        }, 3000);
                    }}
                >
                    <Box sx={{ position: 'relative', width: '100%', minWidth: 300 }}>
                        <Alert
                            severity={alert.severity}
                            onClose={() => removeAlert(alert.id)}
                            sx={{ mb: 1, boxShadow: 3 }}
                        >
                            {formatAlertMessage(alert.message)}
                        </Alert>
                        <LinearProgress
                            variant="determinate"
                            color={alert.severity}
                            value={Math.max(0, Math.min(100, 100 - ((alert.remainingTime - 340) / 3000) * 100))}
                            sx={{
                                position: 'absolute',
                                bottom: 8,
                                left: 0,
                                width: '100%',
                                borderBottomRightRadius: 2,
                                borderBottomLeftRadius: 2,
                            }}
                        />
                    </Box>
                </Slide>
            ))}
        </Box>
    );
});

export { AlertsManager };
