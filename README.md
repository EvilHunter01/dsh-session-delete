# dsh-session-delete

给 DeepSeek Harness 的会话右键菜单加一个「删除会话」。官方只有「归档会话」，这个插件补的是真正删磁盘的那种删除。

## 插件市场

已发布到 GitHub，并托管了可直接添加到 DSH 的市场索引：

- 源码：<https://github.com/EvilHunter01/dsh-session-delete>
- 市场索引：<https://evilhunter01.github.io/dsh-session-delete/index.json>

在 DSH 里：**插件 → 实验性插件 → 打开「自定义插件市场」→ 发现 → 添加索引源**，粘贴索引 URL，然后安装 `dsh-session-delete`（git 源，版本 0.1.0，commit `80e616c`）。

## 当前状态

已安装进 `desktop` profile（以 `link:` 方式指向本目录）：

```text
C:\Users\zhous\.dsh\profiles\desktop\package.json
  dependencies: dsh-session-delete: "link:C:/Users/zhous/dsh-plugins/dsh-session-delete"
  dsh.profile.bundles: [..., "dsh-session-delete"]
```

如果侧栏菜单里暂时没看到「删除会话」，按 **Ctrl+R** 刷新界面；还不行就重启 DSH。

## 用法

在侧栏会话上右键 → 「删除会话」→ 确认「永久删除」。

删除内容：

- 会话日志目录 `<DSH_HOME>/sessions/<workspace>/<session-id>/`
- 投影缓存 `session_projcache` 里对应记录
- 临时目录里的 spill 输出
- 工作区归属、归档标记、置顶标记
- 浏览器里这个会话的本地页面键

不会删除：共享的附件字节（附件是内容寻址、可能被别的会话引用）、派生搜索索引（会自己重建）。

## 安全边界

- 正在跑 turn 的会话会被拒绝（返回「这个会话正在运行」）。
- 打开着但空闲的会话会先停掉活动、detach 内存条目，再删文件。
- 会话不存在 / 找不到日志目录 / 找不到存储根目录时拒绝删除。
- 删除不可恢复；只想移出列表请用官方「归档会话」。

## 安装 / 卸载

安装（已执行）：

```powershell
& "F:\dsh\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "link:C:\Users\zhous\dsh-plugins\dsh-session-delete"
```

卸载：

```powershell
& "F:\dsh\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop remove dsh-session-delete
```

## 结构

- `host.js`：Cordis 宿主插件，注册 `POST /api/session-delete`，负责真正的文件删除。
- `client.js`：`window.__ModuleLoader__` 客户端模块，往 `sidebar.workspaces.session.menu.item` 插菜单项，往 `shell.overlay` 插确认框，走宿主路由后刷新页面。
- `cordis.patch.yml`：把宿主插件行插进配置树。
- `test/delete.test.mjs`：用 mock ctx 直接测删除逻辑（冷会话、运行中拒绝、打开但空闲）。

## 测试

```powershell
cd C:\Users\zhous\dsh-plugins\dsh-session-delete
node test/delete.test.mjs
```

## 注意

插件目录必须留在 `C:\Users\zhous\dsh-plugins\dsh-session-delete`（profile 里是 junction 链接）。如果删掉这个目录，DSH 启动时插件会缺失，需要先卸载或重新放回。
