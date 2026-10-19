/**
 * dsh-session-delete — Client half.
 *
 * Two contributions:
 *   - one `sidebar.workspaces.session.menu.item` row that opens a confirmation;
 *   - one `shell.overlay` dialog that calls the host route and reloads the page.
 *
 * The host half owns all deletion logic; this half never touches the filesystem.
 */

window.__ModuleLoader__.load({
  id: 'dsh-session-delete',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const ROUTE = 'api/session-delete'

    const STYLES = `
.sd-sep { height: .5px; margin: 3px 2px; background: var(--dsw-alias-border-l2, rgba(127,127,127,.3)); }
.sd-item {
  display: flex; align-items: center; gap: 6px; width: 100%; min-height: 34px; padding: 6px 8px;
  border: none; border-radius: var(--dsw-radius-md, 8px); background: transparent; cursor: pointer;
  font-family: inherit; font-size: 13px; line-height: 20px; text-align: left;
  color: var(--dsw-alias-state-error-primary, #e5484d);
}
.sd-item:hover, .sd-item:focus-visible { background: var(--dsw-alias-interactive-bg-hover-danger, rgba(229,72,77,.14)); outline: none; }
.sd-item-icon { display: inline-flex; flex: none; width: 14px; height: 14px; align-items: center; justify-content: center; }
.sd-item-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sd-modal {
  pointer-events: auto; position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.sd-mask { position: absolute; inset: 0; background: var(--dsw-alias-bg-mask-1, rgba(0,0,0,.45)); }
.sd-dialog {
  box-sizing: border-box; position: relative; z-index: 1; display: flex; flex-direction: column; gap: 14px;
  width: min(430px, 100%); padding: 22px 24px 20px;
  border-radius: var(--dsw-radius-panel, 16px);
  background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-overlay, #202024));
  box-shadow: var(--dsw-elevation-prominent, 0 16px 40px rgba(0,0,0,.36));
  color: var(--dsw-alias-label-primary, #f5f5f5);
}
.sd-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sd-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; }
.sd-close {
  flex: none; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px;
  border: none; border-radius: var(--dsw-radius-sm, 6px); background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-secondary, #a8a8ad);
}
.sd-close:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14)); }
.sd-desc { margin: 0; font-size: 14px; line-height: 22px; }
.sd-meta {
  font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px; line-height: 18px; word-break: break-all;
  color: var(--dsw-alias-label-secondary, #a8a8ad);
}
.sd-note { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary, #a8a8ad); }
.sd-error { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-state-error-primary, #e5484d); }
.sd-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }
.sd-btn {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; height: 36px;
  padding: 0 14px; border: none; border-radius: var(--dsw-radius-md, 8px); cursor: pointer;
  font-family: inherit; font-size: 14px; line-height: 22px; background: transparent;
  color: var(--dsw-alias-label-primary, #f5f5f5);
}
.sd-btn:disabled { opacity: .4; cursor: not-allowed; }
.sd-btn-outline { border: .5px solid var(--dsw-alias-border-l3, var(--dsw-alias-border-l2, rgba(127,127,127,.32))); }
.sd-btn-outline:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14)); }
.sd-btn-danger { background: var(--dsw-alias-state-error-primary, #e5484d); color: #fff; }
.sd-btn-danger:hover:not(:disabled) { filter: brightness(1.07); }
`

    function createStore(initial) {
      let value = initial
      const listeners = new Set()
      return {
        get: () => value,
        set(next) {
          value = next
          for (const listener of [...listeners]) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    }

    const requestStore = createStore(null)

    function useStoreValue(store) {
      const [value, setValue] = React.useState(store.get())
      React.useEffect(() => {
        setValue(store.get())
        return store.subscribe(() => setValue(store.get()))
      }, [store])
      return value
    }

    function insertStyles(css) {
      const element = document.createElement('style')
      element.setAttribute('data-dsh-plugin', 'session-delete')
      element.textContent = css
      document.head.appendChild(element)
      return () => element.remove()
    }

    function TrashIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'M2.6 4.4h10.8' }),
        h('path', { d: 'M6.1 4.4V3.3a.8.8 0 0 1 .8-.8h2.2a.8.8 0 0 1 .8.8v1.1' }),
        h('path', { d: 'M4.2 4.4l.6 8.2a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-8.2' }),
        h('path', { d: 'M6.7 7.1v4' }),
        h('path', { d: 'M9.3 7.1v4' }),
      )
    }

    function CloseIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true },
        h('path', { d: 'M4 4l8 8' }),
        h('path', { d: 'M12 4l-8 8' }),
      )
    }

    function DeleteMenuItem({ sessionId, displayTitle, useMenuOpenState, requestDelete }) {
      const [, setMenuOpen] = useMenuOpenState()
      return h(
        React.Fragment,
        null,
        h('div', { className: 'sd-sep', 'aria-hidden': true }),
        h(
          'button',
          {
            type: 'button',
            role: 'menuitem',
            className: 'sd-item',
            onClick: () => {
              setMenuOpen(false)
              requestDelete(sessionId, typeof displayTitle === 'string' ? displayTitle : '')
            },
          },
          h('span', { className: 'sd-item-icon', 'aria-hidden': true }, h(TrashIcon, null)),
          h('span', { className: 'sd-item-label' }, '删除会话'),
        ),
      )
    }

    const REFUSAL_TEXT = {
      'session-delete/running': '这个会话正在运行，等它结束后再删除。',
      'session-delete/unknown': '会话已经不存在了（可能已经被删除）。',
      'session-delete/no-root': '定位不到会话存储目录，已拒绝删除。',
      'session-delete/no-directory': '找不到这个会话的日志目录，已拒绝删除。',
      'session-delete/invalid-id': '会话 ID 不合法。',
    }

    function DeleteOverlay() {
      const request = useStoreValue(requestStore)
      return request === null ? null : h(DeleteDialog, { key: request.sessionId, request })
    }

    function DeleteDialog({ request }) {
      const [busy, setBusy] = React.useState(false)
      const [failure, setFailure] = React.useState(null)
      const cancelRef = React.useRef(null)

      const close = React.useCallback(() => {
        if (!busy) requestStore.set(null)
      }, [busy])

      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (event.key === 'Escape') close()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [close])

      React.useEffect(() => {
        cancelRef.current?.focus()
      }, [])

      const title = request.displayTitle === '' ? request.sessionId : request.displayTitle

      const confirm = async () => {
        setBusy(true)
        setFailure(null)
        try {
          const response = await fetch(ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId: request.sessionId }),
          })
          const result = await response.json().catch(() => null)
          if (result === null || result.ok !== true) {
            const code = result?.error?.code
            setFailure(REFUSAL_TEXT[code] ?? result?.error?.message ?? `宿主拒绝请求（HTTP ${response.status}）`)
            setBusy(false)
            return
          }
          const errors = Array.isArray(result.value?.errors) ? result.value.errors : []
          if (errors.length > 0) {
            setFailure(`部分内容没能删除：${errors.join('；')}`)
            setBusy(false)
            return
          }
          // Drop cached per-session UI keys, then refresh the list.
          try {
            const doomed = []
            for (let index = 0; index < window.localStorage.length; index += 1) {
              const key = window.localStorage.key(index)
              if (typeof key === 'string' && key.includes(request.sessionId)) doomed.push(key)
            }
            for (const key of doomed) window.localStorage.removeItem(key)
          } catch {
            // Storage may be unavailable; the session is already gone.
          }
          requestStore.set(null)
          window.location.reload()
        } catch (error) {
          setFailure(error instanceof Error ? error.message : String(error))
          setBusy(false)
        }
      }

      return h(
        'div',
        { className: 'sd-modal', role: 'presentation' },
        h('div', { className: 'sd-mask', onClick: close, 'aria-hidden': true }),
        h(
          'div',
          { className: 'sd-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': '删除会话' },
          h(
            'div',
            { className: 'sd-head' },
            h('h2', { className: 'sd-title' }, '删除会话'),
            h('button', { type: 'button', className: 'sd-close', 'aria-label': '关闭', onClick: close }, h(CloseIcon, null)),
          ),
          h('p', { className: 'sd-desc' }, `「${title}」将从磁盘上永久删除：会话日志、投影缓存和归属关系都会清掉，不能恢复。`),
          h('span', { className: 'sd-meta' }, request.sessionId),
          h('p', { className: 'sd-note' }, '如果只是想从列表里移走，用「归档会话」——归档可以随时恢复。'),
          failure === null ? null : h('p', { className: 'sd-error', role: 'alert' }, failure),
          h(
            'div',
            { className: 'sd-footer' },
            h('button', { type: 'button', ref: cancelRef, className: 'sd-btn sd-btn-outline', disabled: busy, onClick: close }, '取消'),
            h('button', { type: 'button', className: 'sd-btn sd-btn-danger', disabled: busy, onClick: confirm }, busy ? '正在删除…' : '永久删除'),
          ),
        ),
      )
    }

    /** Client services needed before activation. */
    const inject = ['slots']

    function apply(ctx) {
      ctx.effect(() => insertStyles(STYLES), 'session-delete: styles')

      const requestDelete = (sessionId, displayTitle) => {
        requestStore.set({ sessionId, displayTitle })
      }

      ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
        name: 'sidebar.workspaces.session.menu.item',
        id: 'session-delete.delete',
        order: 500,
        inject: () => ({ requestDelete }),
      }, DeleteMenuItem))

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'session-delete.dialog',
        inject: () => ({}),
      }, DeleteOverlay))
    }

    return { inject, apply }
  },
})
