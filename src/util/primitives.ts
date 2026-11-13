const DIGITS_ONLY_RE = /^\d+$/
const SIGNED_DIGITS_RE = /^-?\d+$/

/**
 * Normalizes an unknown thrown value into an `Error` – `Error` instances are
 * returned unchanged, strings/numbers are wrapped, and objects with `message`
 * or `code` fields are mapped to readable messages. Use in `catch` blocks
 * before logging.
 *
 * An `Error` with an empty `message` (Node's `AggregateError` from a failed
 * dual-stack connect, for example) keeps its identity but gets a message
 * derived from its `name`, `code`, nested `errors` and `cause`, so logs
 * never show `message: ""`.
 */
export function toError(value: unknown): Error {
    if (value instanceof Error) {
        try {
            if (value.message.length === 0) {
                value.message = describeEmptyError(value, 0)
            }
        } catch {
            // ignore errors while describing the error
        }
        return value
    }
    if (typeof value === 'string') return new Error(value)
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return new Error(String(value))
    }
    if (value && typeof value === 'object') {
        const message = (value as { readonly message?: unknown }).message
        if (typeof message === 'string' && message.length > 0) {
            return new Error(message)
        }
        const code = (value as { readonly code?: unknown }).code
        if (typeof code === 'string' || typeof code === 'number') {
            return new Error(`unknown error (${code})`)
        }
    }
    return new Error('unknown error')
}

const DESCRIBE_ERROR_MAX_DEPTH = 3

function describeEmptyError(error: Error, depth: number): string {
    const code = (error as { readonly code?: unknown }).code
    const head =
        typeof code === 'string' || typeof code === 'number'
            ? `${error.name} (${code})`
            : error.name
    if (depth >= DESCRIBE_ERROR_MAX_DEPTH) return head
    const details: string[] = []
    const nested = (error as { readonly errors?: unknown }).errors
    if (Array.isArray(nested)) {
        for (const inner of nested) {
            details.push(describeNestedError(inner, depth + 1))
        }
    }
    const cause = (error as { readonly cause?: unknown }).cause
    if (cause !== undefined) {
        details.push(`cause: ${describeNestedError(cause, depth + 1)}`)
    }
    return details.length > 0 ? `${head}: ${details.join('; ')}` : head
}

function describeNestedError(value: unknown, depth: number): string {
    if (value instanceof Error) {
        return value.message.length > 0 ? value.message : describeEmptyError(value, depth)
    }
    return toError(value).message
}

function assertSafeInteger(
    value: number,
    field: string,
    nullishBehavior: 'throw' | 'zero'
): number {
    if (Number.isFinite(value) && Number.isSafeInteger(value)) return value
    const prefix = nullishBehavior === 'throw' ? `invalid ${field}` : 'invalid long numeric value'
    throw new Error(`${prefix}: ${value}`)
}

/**
 * Coerces a `number` or `{ toNumber() }` (protobufjs `Long`) to a finite
 * safe-integer. Throws on missing/non-numeric/out-of-range inputs.
 */
export function toSafeNumber(
    value: number | { toNumber?: () => number } | null | undefined,
    field: string
): number {
    if (value === null || value === undefined) throw new Error(`missing ${field}`)
    const numeric = typeof value === 'number' ? value : value.toNumber?.()
    if (typeof numeric !== 'number') throw new Error(`invalid ${field}`)
    return assertSafeInteger(numeric, field, 'throw')
}

export function longToNumber(value: number | { toNumber(): number } | null | undefined): number {
    if (value === null || value === undefined) return 0
    return assertSafeInteger(typeof value === 'number' ? value : value.toNumber(), '', 'zero')
}

export function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
    return Math.max(0, Math.trunc(value))
}

function parseStrictUnsignedInt(value: string): number | undefined {
    if (!DIGITS_ONLY_RE.test(value)) return undefined
    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed)) return undefined
    return parsed
}

export function parseOptionalInt(value: string | undefined): number | undefined {
    if (!value) return undefined
    return parseStrictUnsignedInt(value)
}

export function parseOptionalSignedInt(value: string | undefined): number | undefined {
    if (!value) return undefined
    if (!SIGNED_DIGITS_RE.test(value)) return undefined
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : undefined
}
