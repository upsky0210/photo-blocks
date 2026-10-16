# AGENTS.md：照片轉方塊（photo-blocks）

給接手實作的 AI 程式助理（Codex 等）看的交接說明。功能介紹看 README.md。

## 這是什麼
臺北市溪口國小的課堂小工具：學生或老師拍照、上傳照片，轉成方塊風格的 2D 像素馬賽克、拼豆／積木施工圖，以及可以 360° 旋轉的 3D 方塊作品，並且可以匯出。
- 使用者：國小學生和老師。主要裝置是 **iPad（Safari、觸控）** 和電腦教室的桌機。
- 線上：https://upsky0210.github.io/photo-blocks/ （GitHub Pages，main 分支根目錄直接部署）
- 規劃者是另一個 AI（Claude）在「3D 溪口校園」專案裡做的。規格有疑問或要加大功能時，先問使用者，不要自己擴大範圍。

## 一定要遵守
1. **介面文字、註解、commit 訊息、回覆使用者一律用台灣正體中文、台灣用語**（例如「上傳」「列印」「螢幕」「檔案」，不用「上載」「打印」「屏幕」「文件」）。
2. **照片不可以離開裝置**：全部在瀏覽器處理，不加後端、不上傳、不加任何分析或追蹤程式、不呼叫 AI 服務。
3. **不依賴 CDN**：函式庫放在 `vendor/`（目前是 three.js r160）。學校網路可能擋外部網站。
4. **不用 Minecraft 官方素材或名稱**，調色盤叫「方塊遊戲風」。拼豆／積木色號（B01、K01…）是自己編的，不可以寫成某個廠牌的官方色號。
5. **不要腦補資料**：不確定的內容（顏色對照、廠牌色號、學校資料）先問使用者。
6. **不可以放學生照片**：測試用圖片用程式產生（app.js 的 sampleImage）或不含人物的圖。
7. localStorage 讀寫都要包 try/catch（iPad 私密瀏覽會丟錯）。
8. 保持純靜態網站，沒有建置步驟（不要引入 npm 打包流程）。

## 檔案結構
- `index.html`：版面、樣式（含列印 CSS）
- `js/app.js`：介面、讀照片（最長邊先縮到 768，避免 iPad 記憶體不夠）、統計、A4 施工圖（每頁 30×38 格）
- `js/mosaic.js`：切格子取平均色、對應調色盤、畫馬賽克
- `js/color.js`：sRGB／Lab 轉換、k-means 自動取色
- `js/palettes.js`：固定調色盤
- `js/view3d.js`：3D 畫面（InstancedMesh、OrbitControls），GLB／STL／USDZ 匯出；STL 必須是封閉實體（可 3D 列印）
- `fonts/`：俐方體 11 號（OFL，授權檔要跟著字型）
- `vendor/three/`：three.js r160 與用到的 addons

## 本機測試
```bash
python -m http.server 5180
```
然後打開 http://localhost:5180/ 。每次修改都要實際測：上傳或範例圖 → 2D 預覽 → 換調色盤和格數 → 3D 旋轉 → 各種匯出，還要用 iPad 尺寸（768×1024）檢查版面。

## 部署
改好、測過以後 commit 並 push 到 main，大約 1 分鐘後 GitHub Pages 會更新。小修改可以直接 push；大改版先給使用者看過。
開工前先 `git pull`：這個 repo 可能由不同的 AI 輪流修改。

## 待辦
- 還沒在真的 iPad 上測：拍照、AR Quick Look（USDZ）、iPad 列印施工圖。使用者回報問題時優先處理這些。
