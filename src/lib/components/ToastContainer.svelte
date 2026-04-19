<script>
    import { toast } from '$lib/toast';
    import { flip } from 'svelte/animate';
    import { fly } from 'svelte/transition';

    const typeIcons = {
        info: 'fa-info-circle',
        success: 'fa-check-circle',
        warning: 'fa-triangle-exclamation',
        error: 'fa-circle-xmark',
        lock: 'fa-lock'
    };

    const typeColors = {
        info: 'var(--blue)',
        success: 'var(--green)',
        warning: 'var(--amber)',
        error: 'var(--red)',
        lock: 'var(--cyan)'
    };
</script>

<div class="toast-container">
    {#each $toast as t (t.id)}
        <div 
            class="toast-item {t.type}" 
            style={`--toast-color: ${typeColors[t.type] || 'var(--blue)'};`}
            in:fly={{ y: 20, duration: 300 }} 
            out:fly={{ y: -10, opacity: 0, duration: 200 }}
            animate:flip={{ duration: 300 }}
        >
            <div class="toast-icon">
                <i class="fa-solid {typeIcons[t.type] || 'fa-bell'}"></i>
            </div>
            <div class="toast-message">{t.message}</div>
            <button class="toast-close" type="button" onclick={() => toast.dismiss(t.id)}>
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    {/each}
</div>

<style>
    .toast-container {
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        pointer-events: none;
        width: min(90vw, 400px);
    }

    .toast-item {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.85rem 1.15rem;
        background: rgba(10, 25, 45, 0.85);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-left: 4px solid var(--toast-color);
        border-radius: 1rem;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        color: #fff;
    }

    .toast-icon {
        color: var(--toast-color);
        font-size: 1.1rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .toast-message {
        flex-grow: 1;
        font-size: 0.92rem;
        font-weight: 600;
        line-height: 1.4;
    }

    .toast-close {
        background: transparent;
        border: 0;
        color: rgba(255, 255, 255, 0.3);
        padding: 0.4rem;
        cursor: pointer;
        transition: color 180ms ease;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
    }

    .toast-close:hover {
        color: #fff;
    }
</style>
