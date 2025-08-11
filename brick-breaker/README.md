# 打砖块 Brick Breaker

本项目是一个使用 HTML5 Canvas 编写的简洁打砖块小游戏。

## 运行

无需依赖，直接用任意静态服务器打开目录即可。示例：

```bash
cd /workspace/brick-breaker
python3 -m http.server 8000
```

然后在浏览器打开 `http://localhost:8000`。

## 操作

- 空格：开始/暂停
- 方向键 ← → 或 A / D：移动挡板
- 回车：在“游戏结束/胜利”界面返回菜单

## 说明

- 画布逻辑分辨率为 800x600，通过 CSS 自适应容器缩放。
- 包含多行多列砖块、生命与得分、关卡递增与速度提升、暂停与菜单。