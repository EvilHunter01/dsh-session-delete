import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deleteSession } from '../host.js'

const home = await mkdtemp(join(tmpdir(), 'dsh-session-delete-test-'))
const sessionsRoot = join(home, 'sessions')
const project = join(sessionsRoot, '--E-test--')
const sessionId = 'session-test-1'
const sessionDir = join(project, sessionId)

async function materialize() {
  await mkdir(sessionDir, { recursive: true })
  await writeFile(join(sessionDir, 'session.jsonl'), '{"id":"session-test-1"}\n')
}

function makeCtx(overrides = {}) {
  return {
    sessionPersistence: {
      root: sessionsRoot,
      list: async () => [{ header: { id: sessionId } }],
    },
    get(name) {
      if (name === 'workspaceRegistry') {
        return {
          list: () => [{ id: 'ws-1', sessionIds: [sessionId], detachSession: async () => { overrides.detached = true } }],
          archivedSessionIds: [sessionId],
          pinnedSessionIds: [],
          unarchiveSession: async () => { overrides.unarchived = true },
          unpinSession: async () => {},
        }
      }
      if (name === 'sessions') return overrides.sessions
      if (name === 'agents') return overrides.agents
      return undefined
    },
    parallel: async () => { overrides.stopped = true },
    emit() {},
  }
}

// 1. cold session
await materialize()
const cold = {}
const result = await deleteSession(makeCtx(cold), sessionId)
const gone = await stat(sessionDir).then(() => false, () => true)
console.log('cold:', JSON.stringify({ result, ...cold, gone }))
if (!gone || !cold.detached || !cold.unarchived) throw new Error('cold delete did not complete')

// 2. running session is refused
await materialize()
let runningCode = ''
try {
  await deleteSession(makeCtx({ agents: { get: () => ({}) } }), sessionId)
} catch (error) {
  runningCode = error.code
}
console.log('running refusal:', runningCode)
if (runningCode !== 'session-delete/running') throw new Error('running session was not refused')

// 3. opened-but-idle session is released and deleted
await materialize()
let evicted = false
const idle = {
  sessions: {
    get: () => ({}),
    store: { get: () => ({ detach: () => { evicted = true } }) },
  },
}
const idleResult = await deleteSession(makeCtx(idle), sessionId)
const idleGone = await stat(sessionDir).then(() => false, () => true)
console.log('idle:', JSON.stringify({ idleResult, evicted, idleGone }))
if (!idleGone || !evicted) throw new Error('idle session was not released and deleted')

await rm(home, { recursive: true, force: true })
console.log('ok')
