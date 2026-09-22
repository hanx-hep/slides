# slides

hanx-hep 名下 Slidev 演示的汇总门户：<https://hanx-hep.github.io/slides/>

页面由 `scripts/build-index.js` 每 6 小时（或手动触发）自动生成：扫描账号下所有**公开**仓库，
保留启用 GitHub Pages 且带 `slidev` topic 的项目，探测已发布站点的标题，按最近提交时间排序生成卡片。

## 新增一个 deck 如何被自动收录

1. 仓库带 `slidev` topic
2. 仓库启用 GitHub Pages（Settings → Pages → Source: GitHub Actions）
3. 等下一次定时刷新（最多 6 小时），或在 [Actions](https://github.com/hanx-hep/slides/actions) 页手动触发 `Refresh slides index`

建议再加一个分类 topic（决定卡片标签颜色）：

| topic | 标签 |
| --- | --- |
| `ca` / `pki` / `ihepca` | CA 与系统（紫） |
| `juno` | JUNO（绿） |
| `monitoring` / `dci` / `cepc` | DCI 监控（青） |
| `training` / `belle2` | 用户培训（橙） |
| `mcp` / `ink` / `workshop` | 对应标签 |

仓库的 description 会作为卡片副标题展示，写一句中文简介效果最好。

## 本地预览

```bash
node scripts/build-index.js   # 需要 GITHUB_TOKEN（可选，仅提高 API 限额）
python3 -m http.server 8080   # 打开 http://127.0.0.1:8080
```

## 说明

- 只收录公开仓库：私有仓库不会出现在列表中
- 卡片链接直接指向各项目的 GitHub Pages，本仓库不做代理、不重新部署各 deck
- 更新延迟：定时刷新为 6 小时；需要立即生效时手动触发 workflow
