import { type InvokeArgs, invoke as tauriInvoke } from '@tauri-apps/api/core';

/** Default timeout (30 s) for user-blocking IPC calls. Generous on purpose:
 * the goal is to surface a hung command, not to abort slow disks. */
const DEFAULT_IPC_TIMEOUT_MS = 30_000;

/** Error raised when an IPC call exceeds its timeout. The Rust side keeps
 * running — the promise simply rejects so the UI can react. */
export class IpcTimeoutError extends Error {
	readonly command: string;
	readonly timeoutMs: number;
	constructor(command: string, timeoutMs: number) {
		super(`IPC command '${command}' timed out after ${timeoutMs}ms`);
		this.name = 'IpcTimeoutError';
		this.command = command;
		this.timeoutMs = timeoutMs;
	}
}

/** Race any promise against a timeout. Pure — exposed for testing. */
export function withTimeout<T>(promise: Promise<T>, command: string, timeoutMs: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new IpcTimeoutError(command, timeoutMs)), timeoutMs);
	});
	return Promise.race([promise, timeoutPromise]).finally(() => {
		if (timer !== undefined) clearTimeout(timer);
	});
}

/** Drop-in replacement for `invoke` that rejects after `timeoutMs`. */
export function invokeWithTimeout<T>(
	command: string,
	args?: InvokeArgs,
	timeoutMs: number = DEFAULT_IPC_TIMEOUT_MS,
): Promise<T> {
	return withTimeout(tauriInvoke<T>(command, args), command, timeoutMs);
}
