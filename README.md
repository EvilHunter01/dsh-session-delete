# dsh-session-delete

给 DeepSeek Harness 的会话右键菜单加一个「删除会话」。官方只有「归档会话」，这个插件补的是真正删磁盘的那种删除。

## 安装

### 从插件市场（推荐）

- 源码：<https://github.com/EvilHunter01/dsh-session-delete>
- 市场索引：<https://evilhunter01.github.io/dsh-session-delete/index.json>

在 DSH 里：**插件 → 实验性插件 → 打开「自定义插件市场」→ 发现 → 添加索引源**，粘贴上面的索引 URL，然后搜索 `dsh-session-delete` 安装。

索引固定指向 git commit `80e616c`，版本 `0.1.0`。

### 本地 link（改代码时用）

```powershell
& "F:\dsh\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "link:E:\dsh-plugins\dsh-session-delete"
```

改完代码按 **Ctrl+R** 刷新界面；还不行就重启 DSH。

## 当前本地状态

- 源码目录：`E:\dsh-plugins\dsh-session-delete`
- `desktop` profile 以 `link:` 指向该目录：

```text
C:\Users\zhous\.dsh\profiles\desktop\package.json
  dependencies: dsh-session-delete: "link:E:/dsh-plugins/dsh-session-delete"
  dsh.profile.bundles: [..., "dsh-session-delete"]
```

GitHub 仓库是权威源，本地目录只是工作副本。

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

## 卸载

市场安装和本地 link 都用同一条命令：

```powershell
& "F:\dsh\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop remove dsh-session-delete
```

## 结构

- `host.js`：Cordis 宿主插件，注册 `POST /api/session-delete`，负责真正的文件删除。
- `client.js`：`window.__ModuleLoader__` 客户端模块，往 `sidebar.workspaces.session.menu.item` 插菜单项，往 `shell.overlay` 插确认框，走宿主路由后刷新页面。
- `cordis.patch.yml`：把宿主插件行插进配置树。
- `docs/index.json`：GitHub Pages 上托管的插件市场索引。
- `test/delete.test.mjs`：用 mock ctx 测删除逻辑（冷会话、运行中拒绝、打开但空闲）。
- `test/client.test.mjs`：测客户端两个 slot 的注册。

## 测试

```powershell
cd E:\dsh-plugins\dsh-session-delete
node test/delete.test.mjs
node test/client.test.mjs
```

## 注意

- 本地目录被删不会影响 GitHub 仓库和市场索引，重新安装即可。
- 但在删本地目录前，最好先卸载 profile 里的 `link:` 依赖，否则 DSH 启动时 bundle 会缺失。
- 市场里的 git 源固定在某个 commit；发布新版本时需要更新 `docs/index.json` 并重新发布 Pages。
