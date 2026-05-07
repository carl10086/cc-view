---
description: 更新 PM2 管理的 Next.js 服务：拉取代码、质量门、构建、重启、健康检查
---

更新 PM2 管理的 Next.js 服务到最新代码。执行以下步骤，任何一步失败立即停止并报告。

## 执行流程

### 1. 预检
```bash
git branch --show-current        # 确认是 main
git status --short               # 确认工作区干净
pm2 list | grep $(node -p "require('./ecosystem.config.js').apps[0].name")
```
- 如果工作区不干净 → 询问用户：提交 / 丢弃 / 取消
- 如果不在 main → 询问用户：切换 main / 基于当前分支部署 / 取消
- 如果 PM2 服务不存在 → 报错停止

### 2. 拉取代码
```bash
git fetch origin main
git pull origin main
```
- 检查是否有 merge conflict：`git diff --name-only --diff-filter=U`
- 如果有冲突 → 停止，报告冲突文件，让用户手动解决

### 3. 依赖检查
```bash
git diff --name-only HEAD@{1} | grep -E "package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml"
```
- 如果 lockfile 有变化 → 安装依赖（按优先级：pnpm → yarn → npm）

### 4. 质量门（顺序执行）
```bash
# 测试 — 自动检测可用命令
npm run test:run 2>/dev/null || npm test -- --run 2>/dev/null || npm test

# 类型检查
npx tsc --noEmit
```
- 任一失败 → 停止，显示错误输出，不部署

### 5. 构建
```bash
npm run build
ls -ld .next/                    # 验证构建产物
```
- 失败 → 停止，显示构建错误

### 6. 重启服务
```bash
SERVICE_NAME=$(node -p "require('./ecosystem.config.js').apps[0].name")
pm2 restart "$SERVICE_NAME"

# 等待并验证状态
sleep 2
pm2 list | grep "$SERVICE_NAME"  # 确认 online
```
- 10 秒内未 online → 查看 `pm2 logs --lines 50`，报告错误

### 7. 健康检查
```bash
PORT=$(node -p "require('./ecosystem.config.js').apps[0].env.PORT || 3000")
curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}"
```
- 非 200 → 5 秒后重试一次，仍然失败则报告服务可能不健康

## 输出格式

每完成一步，向用户报告结果：

```
1. 检查分支: main ✓
2. 检查工作区: 干净 ✓
3. 拉取代码: 已是最新 b70ebc0 / 更新 X 个文件
4. 依赖检查: 无变化 / 已安装新增依赖
5. 运行测试: X passed ✓
6. 类型检查: 无错误 ✓
7. 构建: 成功 (Xs)
8. 重启服务: cc-view 已重启 (PID XXXXX)
9. 健康检查: 200 OK (Xms)

PM2 服务更新完成。
```

## 安全红线

- 不自动提交未提交的变更（必须询问）
- 不自动切换分支（必须询问）
- 不跳过质量门（即使用户说"小改动"）
- 不自动 resolve git conflict
- 不运行 `pm2 delete`
