import { writable } from 'svelte/store';

function createToastStore() {
    const { subscribe, update } = writable([]);

    function show(message, type = 'info', duration = 3000) {
        const id = Math.random().toString(36).substring(2, 9);
        const toast = { id, message, type };

        update((all) => [...all, toast]);

        setTimeout(() => {
            dismiss(id);
        }, duration);
    }

    function dismiss(id) {
        update((all) => all.filter((t) => t.id !== id));
    }

    return {
        subscribe,
        show,
        dismiss
    };
}

export const toast = createToastStore();
