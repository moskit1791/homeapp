import { buildApiUrl, createApiErrorFromResponse } from '../api';
import type { RealtimeEvent } from '../api';

export interface RealtimeSubscriptionOptions {
  accessToken?: string | null;
  onError?: (error: unknown) => void;
  onEvent: (event: RealtimeEvent) => void;
  signal?: AbortSignal;
}

export interface RealtimeSubscription {
  supported: boolean;
  unsubscribe: () => void;
}

interface StreamReadResult {
  done: boolean;
  value?: Uint8Array;
}

interface StreamReader {
  cancel?: () => Promise<void> | void;
  read: () => Promise<StreamReadResult>;
}

interface ReadableBody {
  getReader: () => StreamReader;
}

interface TextDecoderLike {
  decode: (input?: Uint8Array, options?: { stream?: boolean }) => string;
}

type TextDecoderConstructor = new () => TextDecoderLike;
type RealtimeReadResult = 'closed' | 'error';

const reconnectInitialDelayMs = 1_000;
const reconnectMaxDelayMs = 30_000;

export function subscribeToRealtimeEvents(
  options: RealtimeSubscriptionOptions
): RealtimeSubscription {
  if (!options.accessToken || !isFetchStreamSupported()) {
    return createNoopSubscription();
  }

  const controller = new AbortController();
  const removeAbortListener = attachAbortListener(options.signal, controller);

  void maintainRealtimeStream(options, controller).finally(removeAbortListener);

  return {
    supported: true,
    unsubscribe: () => {
      controller.abort();
      removeAbortListener();
    }
  };
}

function createNoopSubscription(): RealtimeSubscription {
  return {
    supported: false,
    unsubscribe: () => undefined
  };
}

async function maintainRealtimeStream(
  options: RealtimeSubscriptionOptions,
  controller: AbortController
): Promise<void> {
  let retryCount = 0;

  while (!controller.signal.aborted) {
    const result = await readRealtimeStream(options, controller);

    if (controller.signal.aborted) {
      break;
    }

    if (result === 'closed') {
      retryCount = 0;
    }

    const delay = Math.min(
      reconnectInitialDelayMs * 2 ** retryCount,
      reconnectMaxDelayMs
    );
    retryCount += 1;
    await delayUntilReconnect(delay, controller.signal);
  }
}

async function readRealtimeStream(
  options: RealtimeSubscriptionOptions,
  controller: AbortController
): Promise<RealtimeReadResult> {
  try {
    const response = await fetch(buildApiUrl('/realtime/events'), {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${options.accessToken}`
      },
      method: 'GET',
      signal: controller.signal
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response);
    }

    const reader = getStreamReader(response);

    if (!reader) {
      return 'error';
    }

    await consumeSseStream(reader, options.onEvent, controller.signal);
    return 'closed';
  } catch (error) {
    if (!controller.signal.aborted && !isAbortError(error)) {
      options.onError?.(error);
    }

    return 'error';
  }
}

function delayUntilReconnect(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timeout = setTimeout(cleanup, delayMs);

    function cleanup() {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cleanup);
      resolve();
    }

    signal.addEventListener('abort', cleanup, { once: true });
  });
}

async function consumeSseStream(
  reader: StreamReader,
  onEvent: (event: RealtimeEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const decoder = createTextDecoder();
  let buffer = '';

  while (!signal.aborted) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    if (!result.value) {
      continue;
    }

    buffer += decodeChunk(result.value, decoder);
    const frames = splitSseFrames(buffer);
    buffer = frames.remainder;

    for (const frame of frames.complete) {
      const event = parseRealtimeEventFrame(frame);

      if (event) {
        onEvent(event);
      }
    }
  }

  await reader.cancel?.();
}

function splitSseFrames(buffer: string): { complete: string[]; remainder: string } {
  const normalizedBuffer = buffer.replace(/\r\n/g, '\n');
  const parts = normalizedBuffer.split('\n\n');
  const remainder = parts.pop() ?? '';

  return {
    complete: parts,
    remainder
  };
}

function parseRealtimeEventFrame(frame: string): RealtimeEvent | null {
  const parsed = parseSseFrame(frame);

  if (!parsed.data || parsed.eventName === 'ping') {
    return null;
  }

  try {
    const value = JSON.parse(parsed.data) as unknown;

    return isRealtimeEvent(value) ? value : null;
  } catch {
    return null;
  }
}

function parseSseFrame(frame: string): { data?: string; eventName?: string } {
  const dataLines: string[] = [];
  let eventName: string | undefined;

  for (const line of frame.split('\n')) {
    if (!line || line.startsWith(':')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    const rawValue = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1);
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

    if (field === 'event') {
      eventName = value;
    }

    if (field === 'data') {
      dataLines.push(value);
    }
  }

  return {
    data: dataLines.length > 0 ? dataLines.join('\n') : undefined,
    eventName
  };
}

function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.householdId === 'string' &&
    typeof value.type === 'string' &&
    typeof value.occurredAt === 'string' &&
    (value.resourceId === undefined || typeof value.resourceId === 'string')
  );
}

function getStreamReader(response: Response): StreamReader | null {
  const body = (response as unknown as { body?: unknown }).body;

  if (!isReadableBody(body)) {
    return null;
  }

  return body.getReader();
}

function isReadableBody(value: unknown): value is ReadableBody {
  return isRecord(value) && typeof value.getReader === 'function';
}

function isFetchStreamSupported(): boolean {
  const globals = globalThis as Record<string, unknown>;

  return (
    typeof globals.fetch === 'function' &&
    typeof globals.AbortController === 'function' &&
    typeof globals.ReadableStream === 'function'
  );
}

function attachAbortListener(
  signal: AbortSignal | undefined,
  controller: AbortController
): () => void {
  if (!signal) {
    return () => undefined;
  }

  const abort = () => controller.abort();

  if (signal.aborted) {
    abort();
    return () => undefined;
  }

  signal.addEventListener('abort', abort, { once: true });

  return () => signal.removeEventListener('abort', abort);
}

function createTextDecoder(): TextDecoderLike | null {
  const decoderConstructor = (globalThis as { TextDecoder?: TextDecoderConstructor }).TextDecoder;

  return decoderConstructor ? new decoderConstructor() : null;
}

function decodeChunk(chunk: Uint8Array, decoder: TextDecoderLike | null): string {
  if (decoder) {
    return decoder.decode(chunk, { stream: true });
  }

  let output = '';

  for (const byte of chunk) {
    output += String.fromCharCode(byte);
  }

  return output;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
