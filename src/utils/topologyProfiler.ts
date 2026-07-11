import type { ProfilerOnRenderCallback } from 'react'

export const onRenderCallback: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
    window.dispatchEvent(new CustomEvent('topology-render-profile', {
        detail: { id, phase, actualDuration },
    }))
}
