# 本機辨識資源

網站執行時只讀取這個目錄，**不會連到以下來源網址**。照片全程留在瀏覽器。

- 套件：`@mediapipe/tasks-vision`，固定 `0.10.22-rc.20250304`。
- 原始套件：https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-0.10.22-rc.20250304.tgz
- `vision_bundle.mjs` 與 `wasm/` 由套件原樣取出，Apache-2.0 授權見 `LICENSE`。
- 模型來源為 Google MediaPipe 官方模型目錄（版本 1）：
  - `selfie.tflite`：https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite
  - `pose.task`：https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
  - `detector.tflite`：https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite
  - `interactive.tflite`：https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite

檔案大小與 SHA-256 記於 `manifest.json`。WASM 同時保留 SIMD 與非 SIMD 版本，交由官方 FilesetResolver 選擇；GPU 無法執行時改 CPU。

API 依本目錄版本的型別宣告核對；新版線上指南可能使用不同的互動分割 API。這版 Magic Touch 的類別遮罩值為 0／255，因此程式採用單通道物體信心遮罩（至少 0.65）取色。
