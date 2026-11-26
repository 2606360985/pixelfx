# 合规像素背景图规范 & 角色风格提示词指南

本文档用于指导你自行制作、导出或生成**100% 原创合规**的像素背景长卷与备选主角设计，无缝接入当前《霓虹海岸 2D》沙盒原型。

---

## 一、合规像素背景图（PNG）技术要求

### 1. 画布尺寸与像素比例
- **基准内部画布高度**：**严格推荐 `270 px`**（1:1 整数像素映射，加载后最锐利）。
  - 如果你的美术工作流习惯高清倍率图，请导出为整数倍：**`540 px` 或 `1080 px` 高度**，且导出前务必使用 **邻近采样（Nearest Neighbor）**，禁止双线性模糊、抗锯齿或半透明羽化边缘。
- **推荐宽度范围**：`1920 px ~ 3600 px`（引擎支持 `960 px ~ 4800 px` 自动适配；内置街区为 **`2400 × 270 px`**）。
- **文件格式**：无损 `.png`（或无损 `.webp`），`RGB / RGBA`，不要带相机暗角滤镜或 JPEG 压缩噪点。

### 2. 2.5D 宽大道垂直像素标尺（以 `270 px` 高为准）

游戏内的碰撞、行人、汽车与三轮车按 `y` 坐标严格分层，你的背景图必须遵循以下垂直构图比例，车和人才会“踩在路上”：

| Y 坐标区间 (px) | 占比 | 区域内容 | 美术绘制要点 |
|---|---|---|---|
| `0 ~ 117` | 43% | **天空 / 远景海面 / 建筑立面** | 热带日落渐变、霓虹酒店招牌、棕榈树冠、商店橱窗（可在此区留门洞作为 `[E]` 传送点） |
| `118 ~ 146` | 11% | **上侧人行道（Upper Sidewalk）** | 浅色地砖或木栈道，底缘 `y = 144~147` 绘制明显路沿石（Curb）和阴影线 |
| `148 ~ 189` | 15.5% | **上行双车道（向左行驶）** | 深灰/靛蓝沥青路面，中间 `y ≈ 169` 可画白色虚线分道线 |
| `190 ~ 193` | 1.5% | **双黄线隔离带** | 醒目的黄色双实线，分隔双向车流 |
| `194 ~ 236` | 16% | **下行双车道（向右行驶）** | 深色沥青路面，中间 `y ≈ 214` 可画白色虚线分道线 |
| `237 ~ 270` | 13% | **下侧人行道 / 滨海步道** | 路沿石 `y = 237~239`，下方 `240~270` 为步行道与近景栏杆/树影 |

> **关键构图原则**：
> - 视角为 **2.5D 横版微斜俯视（Oblique Top-Down）**：建筑看到正面墙体与屋檐，路面呈平坦俯视带透视斜纹/斑马线，**不要**画成纯侧面地面一条线，也**不要**画成全俯视看不到楼房正立面。
> - 人行道与路面亮度保持中等克制，避免高饱和纯白或纯霓虹大面积铺底，以免遮挡主角、路人及 `pixelfx` 粒子发光。

### 3. 版权与合规检查清单
- ✅ 仅使用原创虚构店名、地标（如 `PALM MOTEL`、`COAST GARAGE`、`霓虹捷运站`）。
- ❌ 严禁包含真实商标、受版权保护的角色海报、官方游戏截图拼接、或直接截取实景照片像素化。

### 4. 如何放入项目长期使用
1. 实时测试：打开游戏按 `M`，直接将 PNG 图片拖进“自定义合规 PNG 背景图”区域即可秒换图试玩。
2. 固化为内置场景：将图片放到 `gta/assets/scenes/your-map.png`，并在 `gta/data.js` 的 `SCENE_SPECS` 中配置 `bgImage: "./assets/scenes/your-map.png"` 并在 `gta/scenes.js` 初始化加载即可。

---

## 二、备选主角视觉设计提示词（匹配当前 `rig.js` + 霓虹海岸画风）

当前原型采用 **约 24×38 px 像素比例、1px 深海蓝黑描边（`#101824`）、3~4 阶平涂明暗（类似《死亡细胞》/ 精致独立像素风）、热带粉青霓虹调色**。你可以直接用下面这组提示词来设计新的备选主角或 NPC：

### 中文提示词（角色立绘 / 像素设定）

> **通用角色设定模板（可替换服装与特征）：**
> 2D 独立像素艺术角色设定图，热带迈阿密霓虹海岸都市题材，原创角色（非任何现有游戏角色）。标准成年人体型，身高约 38 像素级精致像素风，清晰硬朗的 1px 深靛蓝描边（`#101824`），3 阶平涂赛璐璐明暗阴影，禁止渐变模糊与抗锯齿。侧身微朝向右侧（+X），动作自然站立或持械戒备，背景纯深蓝灰方便抠图。色调采用热带青绿（`#38c6b4`）、珊瑚粉（`#ff6e9c`）、暖杏肤色与阳光金高光点缀。
>
> - **参考角色 A（热带男主 · 陆川 Rico 风格）**：微卷黑发，墨镜，敞开的青绿色热带棕榈花衬衫内搭白 T 恤，细金链，卡其色休闲短裤/长裤，复古白球鞋，阳光自信街头老手气质。
> - **参考角色 B（霓虹女主 · 霓莎 Lumi 风格）**：暖棕色高马尾，头戴墨镜作发箍，珊瑚粉短款机车/飞行员夹克内搭青绿露脐背心，深蓝牛仔短裤，高帮运动鞋，干练灵动街头特技感。
> - **更多备选点子**：海滨滑板少年（连帽卫衣+鸭舌帽+无线耳机）、老城修车大叔（油污工装背带裤+护目镜）、夜市茶饮老板（唐装马甲+墨镜+扇子）。

### English Prompt (For Pixel Art Tools / AI Image Generators)

> **Master Character Prompt (2.5D Pixel Art Sandbox Protagonist):**
> `2D indie pixel art character sprite sheet, tropical neon coastal city theme, completely original character design, no copyrighted likeness. 24x38 pixel art proportions, crisp 1px dark indigo-navy ink outline (#101824), flat 3-tone cel-shaded pixel clusters, Dead Cells / modern indie pixel art crispness, zero anti-aliasing, zero blur, side-three-quarter facing right (+X), solid dark slate background for clean cutout. Vibrant Miami-inspired palette: turquoise teal (#38c6b4), coral pink (#ff6e9c), warm sunlit skin (#e3ae84), sunset gold accents.`
>
> **Variant 1 (Male Tropical Driver):** `Short tousled dark hair, dark rectangular sunglasses, open teal Hawaiian shirt with subtle pink/gold palm print over a white tee, thin gold chain, beige chinos, retro white sneakers, relaxed confident stance.`
>
> **Variant 2 (Female Neon Stunt Partner):** `High warm-brown ponytail, sunglasses pushed onto forehead, cropped coral-pink neon jacket over teal crop top, dark blue denim shorts, high-top sneakers, agile ready pose.`
>
> **Negative Prompt:** `blurry, smooth gradients, anti-aliased, photorealistic, 3D render, chibi super-deformed, copyrighted characters, logos, text, watermarks, messy mixels.`
