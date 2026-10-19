const React = {
  createElement: (...args) => ({ args }),
  useState: (value) => [value, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  useRef: () => ({ current: null }),
  Fragment: 'fragment',
}

let definition = null
globalThis.window = {
  __ModuleLoader__: {
    load(next) {
      definition = next
    },
  },
}
globalThis.document = {
  createElement: () => ({ setAttribute() {}, remove() {}, textContent: '' }),
  head: { appendChild() {} },
}

await import('../client.js')

if (definition === null || definition.id !== 'dsh-session-delete') {
  throw new Error('client module did not register')
}

const module = definition.factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require: ${name}`)
})

const registrations = []
const disposers = []
const ctx = {
  effect(fn, label) {
    disposers.push(fn())
    return () => {}
  },
  slots: {
    inject(name, register) {
      register()
    },
    register(options, component) {
      registrations.push({ options, component })
      return component
    },
  },
}

module.apply(ctx)

console.log(
  'inject:',
  JSON.stringify(module.inject),
  'slots:',
  registrations.map((entry) => `${entry.options.name}#${entry.options.id}@${entry.options.order ?? 0}`).join(', '),
)

const names = registrations.map((entry) => entry.options.name)
if (!names.includes('sidebar.workspaces.session.menu.item')) throw new Error('session menu slot missing')
if (!names.includes('shell.overlay')) throw new Error('overlay slot missing')
if (registrations.length !== 2) throw new Error('unexpected number of registrations')

console.log('ok')
