# dsh-session-delete

给 DeepSeek Harness 的会话右键菜单加一个「删除会话」。官方只有「归档会话」，这个插件补的是真正删磁盘的那种删除。

## 功能

- 侧栏会话右键菜单新增「删除会话」，红色危险项
- 二次确认后执行，删除完自动刷新会话列表
- 正在跑 turn 的会话会被拒绝；打开但空闲的会话会先停活动、detach 再删
- 中英文插件元信息：中文名「删除会话」，白底蓝色图标
- 不碰共享附件和派生搜索索引

## 安装

### 从插件市场（推荐）

- 市场索引：<https://evilhunter01.github.io/dsh-session-delete/index.json>
- 索引里的 source 指向 Gitee，当前版本 `0.1.3`

在 DSH 里：**插件 → 实验性插件 → 打开「自定义插件市场」→ 发现 → 添加索引源**，粘贴索引 URL，搜索 `dsh-session-delete` 安装。

### 直接从 Gitee 安装

```powershell
& "F:\dsh\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "git+https://gitee.com/zhoushengbo/dsh-session-delete.git#main"
```

生产环境建议用市场索引：它会固定到具体 commit，不会跟着分支漂移。

### 本地 link（只用于开发调试）

```powershell
& "F:\dsh\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "link:E:\dsh-plugins\dsh-session-delete"
```

注意：从 `link:` 切回 git 安装时，pnpm 有概率把 link 目标目录清空（我们踩过一次）。切换前先提交或备份源码，不要把 link 用在正式 profile 上。

## 当前状态

- 源码目录：`E:\dsh-plugins\dsh-session-delete`
- Gitee 主仓库：<https://gitee.com/zhoushengbo/dsh-session-delete>
- GitHub 镜像：<https://github.com/EvilHunter01/dsh-session-delete>（市场索引托管在它的 Pages 上）
- `desktop` profile 当前从 Gitee 的固定 commit 安装，而不是 link：

```text
C:\Users\zhous\.dsh\profiles\desktop\package.json
  dependencies: dsh-session-delete: "git+https://gitee.com/zhoushengbo/dsh-session-delete.git#<commit>"
  dsh.profile.bundles: [..., "dsh-session-delete"]
```

本地目录只是开发副本；装好的插件在 profile 的 `node_modules\dsh-session-delete` 里。

如果侧栏菜单没出现「删除会话」，先 **Ctrl+R** 刷新；还不行就重启 DSH。

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

```powershell
& "F:\dsh\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop remove dsh-session-delete
```

卸载只影响 profile 里的安装，不会删除 `E:\dsh-plugins` 里的源码。

## 结构

- `host.js`：Cordis 宿主插件，注册 `POST /api/session-delete`，负责真正的文件删除。
- `client.js`：`window.__ModuleLoader__` 客户端模块，往 `sidebar.workspaces.session.menu.item` 插菜单项，往 `shell.overlay` 插确认框，走宿主路由后刷新页面。
- `cordis.patch.yml`：把宿主插件行插进配置树。
- `locale/zh.json`、`locale/en.json`：插件列表里的中文名、简介和英文 fallback。
- `icon.svg`：白底蓝色垃圾桶图标。
- `docs/index.json`：GitHub Pages 上托管的插件市场索引。
- `test/delete.test.mjs`：用 mock ctx 测删除逻辑（冷会话、运行中拒绝、打开但空闲）。
- `test/client.test.mjs`：测客户端两个 slot 的注册。

## 测试

```powershell
cd E:\dsh-plugins\dsh-session-delete
node test/delete.test.mjs
node test/client.test.mjs
```

## 发布新版本

1. 改 `package.json` 的 `version`；
2. 提交并推到 Gitee，拿到新的 commit SHA；
3. 更新 `docs/index.json` 的 `version`、`source.commit`、`publishTimestamp`；
4. 推 Gitee，并把同一份 `docs/index.json` 同步到 GitHub 镜像；
5. 等 GitHub Pages 重新构建，再在 DSH 市场里刷新安装。

市场里的 git source 固定到 commit，所以不要 force-push 或删除已经发布过的 commit。

## 注意

- 本机的 `github.com:443` 经常不通，但 `github.io` 和 `gitee.com` 正常；所以安装走 Gitee，市场索引继续放 GitHub Pages。
- 不要把 Gitee token 写进仓库、README 或 remote URL。
- 删除会话是不可恢复操作，确认框里会再提示一次。
