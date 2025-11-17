# 🌐 Internet Performance Tester

This is a client-side web application designed to measure various aspects of your internet connection quality, including raw throughput (Download/Upload speed), streaming performance, and VoIP quality (Jitter/MOS Score).

The app is built using **plain HTML, CSS, and JavaScript**, making it entirely static and perfectly suited for hosting on services like **GitHub Pages**.

---

## ✨ Features

The application runs **three independent, client-side tests** that can be initiated in any order:

### 1. File Transfer Speed (DL/UL)
* **Goal:** Measure the raw transfer speed of large files.
* **Method:** Uses the JavaScript **`fetch` API** to time the transfer of a known data size (10MB).
    * **Download:** Retrieves a file from a public CDN (e.g., `https://speed.hetzner.de/`).
    * **Upload:** Sends a dummy data payload to a public testing endpoint (e.g., `https://httpbin.org/post`).
* **Metrics:** **Download Speed (Mbps)**, **Upload Speed (Mbps)**, and **Latency (RTT)**.

### 2. Video Streaming Quality
* **Goal:** Simulate real-world video playback and measure performance.
* **Method:** Utilizes the standard **HTML `<video>` element** and JavaScript events (`canplay`, `waiting`, `playing`) to track initial loading and subsequent buffering pauses.
* **Metrics:** **Initial Latency** (time to first frame), **Total Buffering Time**, and **Rebuffer Ratio** (Total Buffering Time / Video Duration).

### 3. VoIP Jitter & MOS Score
* **Goal:** Measure network packet delay variation and estimate voice call quality.
* **Method:** Implements a **WebRTC loopback connection**. Two peer connections (Sender and Receiver) are established *within the browser* using manual signaling. The app streams silent audio (requiring mic permission) to itself to generate realistic networking statistics.
* **Metrics:**
    * **Jitter (ms):** Extracted directly from the WebRTC **`RTCPeerConnection.getStats()`** report.
    * **MOS Score (Mean Opinion Score):** Calculated using a simplified E-model formula that converts Jitter, RTT, and estimated Packet Loss into a single voice quality rating (scale of **1.0 to 4.5**).

---

## 💻 Project Structure

For deployment on GitHub Pages, all files must reside in the root directory.

| File | Role |
| :--- | :--- |
| `index.html` | Main application UI and script loader. |
| `style.css` | Basic CSS styling. |
| `speedTest.js` | Logic for DL/UL speed and latency. |
| `videoTest.js` | Logic for video streaming metrics. |
| `jitterTest.js` | Logic for WebRTC loopback, Jitter measurement, and MOS score calculation. |
| `testVideo.mp4` | **Placeholder video file** (must be provided for the video test). |

---

## 🚀 Deployment Instructions (GitHub Pages)

Since the app is entirely client-side, it is easy to host.

1.  **Create Repository:** Create a new **public** GitHub repository (e.g., `internet-performance-tester`).
2.  **Upload Files:** Upload all six project files (`index.html`, `style.css`, three `.js` files, and `testVideo.mp4`) to the **root** of this repository.
3.  **Enable Pages:**
    * Go to **Settings** $\to$ **Pages**.
    * Under **Build and deployment**, select your primary branch (e.g., `main`) and the **`/root`** folder.
    * Click **Save**.
4.  **Access App:** Your application will be live in minutes at the URL provided by GitHub Pages (e.g., `https://<your-username>.github.io/<repo-name>/`).

***

> **Note on WebRTC:** The Jitter test requires the site to be served over **HTTPS** (which GitHub Pages does automatically) and requires **microphone access permission** from your browser to initiate the necessary audio stream for stat generation.
