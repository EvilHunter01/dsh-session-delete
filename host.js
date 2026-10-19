/**
 * dsh-session-delete — Host half.
 *
 * Registers one exact route, `POST /api/session-delete`, used by the client
 * menu row. The route deletes a cold (not open / not running) session for real:
 *
 *   1. workspace membership and archive/pin bookkeeping are detached;
 *   2. every `<sessions-root>/<project>/<session-id>/` directory is removed;
 *   3. the projection-cache record is deleted;
 *   4. spill output for the session is removed;
 *   5. the sidebar is told the row is gone.
 *
 * Live sessions are refused instead of force-closed: this plugin is a small
 * local helper, not a replacement for the shipped Archive action.
 */

import { createHash } from 'node:crypto'
import { readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROUTE = '/api/session-delete'
const SESSION_ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/
const CACHE_DOMAIN = 'session_projcache'
const CACHE_TABLE = 'sessions'

/** Host services required before this plugin may activate. */
export const inject = ['connection', 'sessionPersistence', 'workspaceRegistry']

/**
 * Register the exact route.
 * @param ctx - the bundle row's host context.
 */
export function apply(ctx) {
  ctx.effect(
    () => ctx.connection.fetch.register({
      path: ROUTE,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: (request) => respond(ctx, request),
    }),
    'session-delete: fetch route',
  )
}

/** Turn one request into a JSON response. */
async function respond(ctx, request) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: { code: 'session-delete/bad-request', message: 'body is not JSON' } }, 400)
  }
  if (body === null || typeof body !== 'object') {
    return json({ ok: false, error: { code: 'session-delete/bad-request', message: 'body must be an object' } }, 400)
  }
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (sessionId === '' || !SESSION_ID_PATTERN.test(sessionId)) {
    return json({ ok: false, error: { code: 'session-delete/invalid-id', message: 'sessionId is missing or invalid' } })
  }

  try {
    const value = await deleteSession(ctx, sessionId)
    return json({ ok: true, value })
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'session-delete/failed'
    return json({ ok: false, error: { code, message: reason(error) } })
  }
}

/**
 * Delete one session for real.
 *
 * Exported so a local harness can exercise the file logic with a mocked ctx.
 *
 * @param ctx - host context (or a compatible stub).
 * @param sessionId - the session to remove.
 * @returns `{ sessionId, deleted, errors }`.
 */
export async function deleteSession(ctx, sessionId) {
  const headers = await sessionHeaders(ctx)
  if (!headers.has(sessionId)) {
    throw coded('session-delete/unknown', `会话 ${sessionId} 不在会话存储里（可能已经被删除）。`)
  }

  if (isRunning(ctx, sessionId)) {
    throw coded('session-delete/running', '这个会话正在运行，等它结束后再删除。')
  }

  const root = sessionsRoot(ctx)
  if (root === undefined) {
    throw coded('session-delete/no-root', '定位不到会话存储根目录，已拒绝删除。')
  }

  const directories = await locateDirectories(root, sessionId)
  if (directories.length === 0) {
    throw coded('session-delete/no-directory', '会话存储里没有对应的日志目录，已拒绝删除。')
  }

  const errors = []

  // 0. Release an opened-but-idle session: stop its activity and detach the
  //    in-memory entry so Windows lets go of the log file handle.
  const released = await releaseSession(ctx, sessionId)
  errors.push(...released.errors)

  // 1. Leave the workspace registry, archive set, and pin set.
  const registry = ctx.get('workspaceRegistry')
  if (registry !== undefined) {
    try {
      for (const workspace of registry.list()) {
        if (Array.isArray(workspace.sessionIds) && workspace.sessionIds.includes(sessionId)) {
          await workspace.detachSession(sessionId)
        }
      }
      if (Array.isArray(registry.archivedSessionIds) && registry.archivedSessionIds.includes(sessionId)) {
        await registry.unarchiveSession(sessionId)
      }
      if (Array.isArray(registry.pinnedSessionIds) && registry.pinnedSessionIds.includes(sessionId)) {
        await registry.unpinSession(sessionId)
      }
    } catch (error) {
      errors.push(`workspace registry: ${reason(error)}`)
    }
  }

  // 2. Session log directories.
  for (const directory of directories) {
    try {
      await rm(directory, { recursive: true, force: true, maxRetries: 3 })
    } catch (error) {
      errors.push(`${directory}: ${reason(error)}`)
    }
  }

  // 3. Projection cache record.
  try {
    const table = ctx.get('storageDomain')?.get?.(CACHE_DOMAIN)?.table?.(CACHE_TABLE)
    if (table !== undefined) await table.delete(sessionId)
  } catch (error) {
    errors.push(`projection cache: ${reason(error)}`)
  }

  // 4. Spill output.
  try {
    await removeSpillDirectories(sessionId)
  } catch (error) {
    errors.push(`spill: ${reason(error)}`)
  }

  // 5. Tell the page the row is gone (best effort; the client reloads anyway).
  try {
    ctx.emit('api-session/removed', sessionId)
  } catch {
    // A notification failure must not turn a completed delete into a failure.
  }

  return { sessionId, deleted: directories, errors }
}

/** Whether a session currently has an agent turn running. */
function isRunning(ctx, sessionId) {
  const agents = ctx.get('agents')
  return agents !== undefined && agents.get?.(sessionId) !== undefined
}

/**
 * Release an opened session before its files are removed: stop its activity,
 * then detach its in-memory store entry (which releases the write handle).
 */
async function releaseSession(ctx, sessionId) {
  const result = { stopped: false, evicted: false, errors: [] }
  const sessions = ctx.get('sessions')
  if (sessions === undefined || sessions.get?.(sessionId) === undefined) return result

  if (typeof ctx.parallel === 'function') {
    try {
      await ctx.parallel('workspace/session-stop', { sessionId })
      result.stopped = true
    } catch (error) {
      result.errors.push(`stop providers: ${reason(error)}`)
    }
    await new Promise((settle) => setTimeout(settle, 300))
  }

  try {
    const entry = sessions.store?.get?.(sessionId)
    if (entry !== undefined && typeof entry.detach === 'function') {
      entry.detach()
      result.evicted = true
    }
  } catch (error) {
    result.errors.push(`store detach: ${reason(error)}`)
  }

  return result
}

/** Session headers currently visible to persistence, keyed by id. */
async function sessionHeaders(ctx) {
  const headers = new Map()
  const snapshots = await ctx.sessionPersistence.list()
  for (const snapshot of snapshots) {
    const header = snapshot?.header
    if (header !== undefined && typeof header.id === 'string') headers.set(header.id, header)
  }
  return headers
}

/** The configured sessions root, or the launcher's default. */
function sessionsRoot(ctx) {
  const configured = ctx.sessionPersistence?.root
  if (typeof configured === 'string' && configured.trim() !== '') return resolve(configured)
  const home = process.env.DSH_HOME
  if (typeof home === 'string' && home.trim() !== '') return resolve(join(home, 'sessions'))
  return undefined
}

/** Every directory named after the session under the sessions root. */
async function locateDirectories(root, sessionId) {
  const found = []
  const projects = await readdir(root, { withFileTypes: true })
  for (const project of projects) {
    if (!project.isDirectory()) continue
    const candidate = resolve(join(root, project.name, sessionId))
    try {
      if ((await stat(candidate)).isDirectory()) found.push(candidate)
    } catch {
      // Not this project.
    }
  }
  return found
}

/** Remove spill directories for one session (hash-named under the OS temp). */
async function removeSpillDirectories(sessionId) {
  const suffix = createHash('sha256').update(sessionId).digest('hex').slice(0, 12)
  let roots
  try {
    roots = await readdir(tmpdir(), { withFileTypes: true })
  } catch {
    return
  }
  for (const root of roots) {
    if (!root.isDirectory() || !/^dsh-spill-[A-Za-z0-9]{6}$/.test(root.name)) continue
    const directory = join(tmpdir(), root.name, `session-${suffix}`)
    try {
      if ((await stat(directory)).isDirectory()) {
        await rm(directory, { recursive: true, force: true, maxRetries: 3 })
      }
    } catch {
      // Not this session's spill, or already swept.
    }
  }
}

/** One JSON response. */
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** An error carrying a stable code for the client. */
function coded(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

/** A readable message from anything thrown. */
function reason(error) {
  if (error instanceof Error && error.message !== '') return error.message
  return String(error)
}
