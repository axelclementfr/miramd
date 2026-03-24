import { writable } from 'svelte/store';

export interface ToastMessage {
	id: string;
	text: string;
	kind: 'error' | 'warning' | 'info' | 'success';
	duration?: number;
}

export const toasts = writable<ToastMessage[]>([]);

/** Show a toast notification. Returns the toast id. */
export function showToast(text: string, kind: ToastMessage['kind'] = 'error', duration = 5000): string {
	const id = crypto.randomUUID();
	toasts.update((t) => [...t, { id, text, kind, duration }]);
	if (duration > 0) {
		setTimeout(() => dismissToast(id), duration);
	}
	return id;
}

export function dismissToast(id: string) {
	toasts.update((t) => t.filter((toast) => toast.id !== id));
}
