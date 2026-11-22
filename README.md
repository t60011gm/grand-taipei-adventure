# 市民漫遊 GTA Grand Taipei Adventure

以臺北市民大道為場景的瀏覽器 3D 漫遊遊戲。可以步行、開車、沿高架與平面道路自動駕駛，也能在華山公園搭乘 669 公車，再由微風廣場搭回華山。

[開啟遊戲](https://t60011gm.github.io/grand-taipei-adventure/) · [全路網駕駛導覽](https://t60011gm.github.io/grand-taipei-adventure/?tour=all) · [實機影片](https://github.com/t60011gm/grand-taipei-adventure/releases/tag/v2026.11.22)

## 遊玩

建議使用支援 WebGL 2 的桌面瀏覽器並開啟硬體加速。首次進入需下載街區模型與貼圖。開始選單可選擇角色、路線和交通模擬。WASD 或方向鍵移動，E 互動或上下車，V 切換視角，Esc 暫停。搭乘公車時可按 B 按下車鈴。

## 本機啟動

在專案根目錄執行 `python3 serve.py` 即可開啟遊戲。街區二進位檔與大型交通模型使用 gzip 無損壓縮，遊戲載入時會自動解壓。測試可使用 Node.js 執行，例如 `node tests/dunhua-turn.mjs`。

## 素材與署名

場景圖資、拍攝年代及模型限制見[圖資來源](./assets/圖資來源.txt)。道路資料含 © OpenStreetMap contributors。角色取自 Microsoft Rocketbox，詳見[角色授權](./assets/Rocketbox-LICENSE.md)。主角車模 Ferrari 458 Italia 由 [vicent091036](https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6) 製作。渲染使用 [Three.js](./vendor/THREE-LICENSE.txt)。各第三方素材依其原始授權使用。
