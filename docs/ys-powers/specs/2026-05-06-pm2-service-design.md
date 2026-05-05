# PM2 Service Design — Next.js App 后台常驻服务化

## Objective

将当前 Next.js 16 + React 19 的 web app（cc-view）配置为 **pm2 管理的后台常驻服务**，满足：
- 关闭 Terminal 后进程不退出
- 支持后台启动、停止、重启、日志查看
- 崩溃时自动重启（pm2 默认行为）
- 进程数限制为单实例（本地开发场景，避免端口冲突）

## Commands

| 命令 | 作用 |
|------|------|
| `pnpm build` | 构建 Next.js 生产包 |
| `pnpm pm2:start` | 启动 pm2 服务（后台常驻） |
| `pnpm pm2:stop` | 停止 pm2 服务 |
| `pnpm pm2:restart` | 重启 pm2 服务 |
| `pnpm pm2:logs` | 查看实时日志 |
| `pnpm pm2:delete` | 从 pm2 列表中移除服务 |

等价直接使用 pm2 CLI：
```bash
pm2 start ecosystem.config.js
pm2 stop cc-view
pm2 restart cc-view
pm2 logs cc-view
pm2 delete cc-view
```

## Project Structure

```
cc-view/
├── ecosystem.config.js      # ← 新增：pm2 服务配置
├── package.json             # ← 修改：添加 pm2 相关 scripts
├── app/
├── components/
├── lib/
├── next.config.ts
└── ...
```

## Code Style

- **ecosystem.config.js** 使用 CommonJS `module.exports`（pm2 原生支持的格式）
- 配置字段明确：name, script, instances, exec_mode, env, log_file, error_file, out_file
- 不设置 `watch: true`（避免本地开发时文件变动触发频繁重启，与 `next dev` 场景区分）
- `instances: 1` + `exec_mode: 'fork'`（单实例，避免多实例端口冲突）

### ecosystem.config.js 示例

```js
module.exports = {
  apps: [
    {
      name: 'cc-view',
      script: './node_modules/.bin/next',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      log_file: './logs/pm2/combined.log',
      error_file: './logs/pm2/error.log',
      out_file: './logs/pm2/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
```

### package.json scripts 更新

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest",
    "test:run": "vitest run",
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop cc-view",
    "pm2:restart": "pm2 restart cc-view",
    "pm2:logs": "pm2 logs cc-view",
    "pm2:delete": "pm2 delete cc-view"
  }
}
```

## Testing Strategy

手动验证 checklist：

1. **构建验证**：`pnpm build` 成功，`.next/` 目录生成
2. **启动验证**：`pnpm pm2:start` 后，`pm2 list` 显示 `cc-view` 为 `online`
3. **后台常驻验证**：关闭 Terminal，新 Terminal 中 `pm2 list` 仍为 `online`
4. **端口访问验证**：`curl http://localhost:3000` 返回 200
5. **停止验证**：`pnpm pm2:stop` 后，`pm2 list` 显示 `stopped`
6. **重启验证**：`pnpm pm2:restart` 后，服务恢复 `online`
7. **日志验证**：`pnpm pm2:logs` 能看到正常访问日志
8. **崩溃恢复验证**：手动 kill 进程，`pm2 list` 自动恢复为 `online`

## Boundaries

### Always
- 先 `pnpm build` 再 `pnpm pm2:start`（pm2 运行的是 `next start`，依赖构建产物）
- 日志目录 `logs/pm2/` 需要 `.gitignore`（避免提交日志文件）

### Ask First
- 是否需要配置开机自启（`pm2 startup` + `pm2 save`）？这涉及系统级配置，需用户确认
- 是否需要多实例 cluster 模式？当前场景为本地单实例
- 是否需要环境变量注入（如 API key、数据库连接）？当前方案仅设置基础 `NODE_ENV` 和 `PORT`

### Never
- 不修改任何业务代码（app/, components/, lib/）
- 不删除现有 npm scripts
- 不引入新的运行时依赖（pm2 已全局安装，不作为项目 dependency）
- 不配置 `watch: true`（避免与 next dev 混淆）
