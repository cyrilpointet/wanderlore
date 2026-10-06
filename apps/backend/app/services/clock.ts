/**
 * Port for the passing of time.
 *
 * Reading the time and waiting on it both go through here, so a test can move
 * time forward instead of waiting for it — the same seam as the dice service.
 */
export interface Clock {
  /** Milliseconds since the epoch. */
  now(): number

  /** A signal that aborts once `ms` milliseconds have passed. */
  timeout(ms: number): AbortSignal
}

/** The real clock. */
export class SystemClock implements Clock {
  now(): number {
    return Date.now()
  }

  timeout(ms: number): AbortSignal {
    return AbortSignal.timeout(ms)
  }
}

/**
 * Application-wide clock.
 *
 * ```ts
 * import clock from '#services/clock'
 * ```
 *
 * A test hands its own controllable clock to the service under test instead.
 */
const clock = new SystemClock()

export default clock
