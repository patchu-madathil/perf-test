document.getElementById('startSpeedTest').addEventListener('click', runSpeedTest);

// --- Configuration ---
const DOWNLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 Megabytes
const UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;   // 10 Megabytes

// Arrays of reliable endpoints for fallback
const DOWNLOAD_URLS = [
    // Note: Use HTTPS if possible. Replace with known fast, public 50MB files.
    `http://speedtest.tele2.net/50MB.zip?r=`, 
    `https://ipv4.download.thinkbroadband.com/50MB.zip?r=`, 
    `https://2.testdebit.info/50M.box?r=`
];
const UPLOAD_URLS = [
    'https://httpbin.org/post', // Common testing endpoint
    'https://postman-echo.com/post' // Postman echo service
];

// --- UI Elements ---
const dlSpeedSpan = document.getElementById('downloadSpeed');
const ulSpeedSpan = document.getElementById('uploadSpeed');
const rttLatencySpan = document.getElementById('rttLatency');
const dlProgressDiv = document.getElementById('dlProgressBar');
const ulProgressDiv = document.getElementById('ulProgressBar');

/**
 * Converts bytes per second to Megabits per second (Mbps).
 */
function bytesToMbps(bytesPerSecond) {
    return ((bytesPerSecond * 8) / 1000000).toFixed(2);
}

// --- Download Speed Test with Fallback and Progress ---
async function downloadTest() {
    dlSpeedSpan.textContent = '0.00 Mbps';
    dlProgressDiv.style.width = '0%';
    let speedMbps = 0;

    for (const baseUrl of DOWNLOAD_URLS) {
        const url = baseUrl + Math.random();
        
        const startTime = performance.now();
        let bytesTransferred = 0;
        let lastUpdateTime = startTime;
        let lastBytes = 0;

        try {
            const response = await fetch(url, { method: 'GET', cache: 'no-store' });

            if (!response.ok) throw new Error(`HTTP Status ${response.status}`);

            const contentLength = response.headers.get('content-length') || DOWNLOAD_SIZE_BYTES;
            const reader = response.body.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                bytesTransferred += value.length;

                // Live speed calculation every 100ms
                const now = performance.now();
                if (now - lastUpdateTime > 100) {
                    const timeElapsedSeconds = (now - lastUpdateTime) / 1000;
                    const instantSpeedBps = (bytesTransferred - lastBytes) / timeElapsedSeconds;
                    dlSpeedSpan.textContent = `${bytesToMbps(instantSpeedBps)} Mbps`;
                    
                    // Update progress bar
                    dlProgressDiv.style.width = `${(bytesTransferred / contentLength) * 100}%`;
                    
                    lastUpdateTime = now;
                    lastBytes = bytesTransferred;
                }
            }

            const endTime = performance.now();
            const durationSeconds = (endTime - startTime) / 1000;
            const sizeBytes = bytesTransferred || contentLength;
            
            speedMbps = parseFloat(bytesToMbps(sizeBytes / durationSeconds));
            dlSpeedSpan.textContent = `${speedMbps.toFixed(2)} Mbps`;
            dlProgressDiv.style.width = '100%';
            
            return { success: true, speedMbps };

        } catch (error) {
            console.warn(`Download failed from ${url}: ${error.message}`);
        }
    }
    
    dlSpeedSpan.textContent = `ERROR: All DL URLs failed.`;
    dlProgressDiv.style.width = '0%';
    return { success: false, speedMbps };
}

// --- Upload Speed Test with Fallback and Progress ---
async function uploadTest() {
    ulSpeedSpan.textContent = '0.00 Mbps';
    ulProgressDiv.style.width = '0%';
    let speedMbps = 0;
    
    const uploadData = new ArrayBuffer(UPLOAD_SIZE_BYTES);
    const dataView = new DataView(uploadData);
    for (let i = 0; i < UPLOAD_SIZE_BYTES; i++) {
        dataView.setUint8(i, Math.floor(Math.random() * 256));
    }
    
    for (const url of UPLOAD_URLS) {
        const startTime = performance.now();
        let lastUpdateTime = startTime;
        let totalProgress = 0;

        try {
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);
                xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const now = performance.now();
                        const timeElapsedSeconds = (now - lastUpdateTime) / 1000;
                        const bytesSinceUpdate = event.loaded - totalProgress;
                        const instantSpeedBps = bytesSinceUpdate / timeElapsedSeconds;

                        ulSpeedSpan.textContent = `${bytesToMbps(instantSpeedBps)} Mbps`;
                        ulProgressDiv.style.width = `${(event.loaded / event.total) * 100}%`;
                        
                        lastUpdateTime = now;
                        totalProgress = event.loaded;
                    }
                };
                
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error(`HTTP Status ${xhr.status}`));
                    }
                };

                xhr.onerror = () => reject(new Error('Network error during upload.'));
                xhr.send(uploadData);
            });
            
            const endTime = performance.now();
            const durationSeconds = (endTime - startTime) / 1000;

            speedMbps = parseFloat(bytesToMbps(UPLOAD_SIZE_BYTES / durationSeconds));
            ulSpeedSpan.textContent = `${speedMbps.toFixed(2)} Mbps`;
            ulProgressDiv.style.width = '100%';

            return { success: true, speedMbps };

        } catch (error) {
            console.warn(`Upload failed to ${url}: ${error.message}`);
        }
    }
    
    ulSpeedSpan.textContent = `ERROR: All UL URLs failed.`;
    ulProgressDiv.style.width = '0%';
    return { success: false, speedMbps };
}

// --- Latency (RTT) Test ---
async function latencyTest(iterations = 10) {
    rttLatencySpan.textContent = 'TESTING...';
    let totalRtt = 0;
    let avgRtt = null;

    // Use the first reliable download URL for RTT check
    const testUrlBase = DOWNLOAD_URLS[0].split('?')[0]; 

    try {
        for (let i = 0; i < iterations; i++) {
            const testUrl = `${testUrlBase}?cachebust=${Math.random()}`;
            const startTime = performance.now();
            await fetch(testUrl, { method: 'HEAD', cache: 'no-store' }); 
            const endTime = performance.now();
            totalRtt += (endTime - startTime);
        }

        avgRtt = totalRtt / iterations;
        rttLatencySpan.textContent = `${avgRtt.toFixed(1)} ms`;
        return { success: true, avgRtt };

    } catch (error) {
        rttLatencySpan.textContent = `ERROR: Latency check failed.`;
        console.error('Latency Test Failed:', error);
        return { success: false, avgRtt };
    }
}

// --- Main Runner Function ---
async function runSpeedTest() {
    // Reset displays
    dlSpeedSpan.textContent = '---';
    ulSpeedSpan.textContent = '---';
    rttLatencySpan.textContent = 'TESTING...';
    dlProgressDiv.style.width = '0%';
    ulProgressDiv.style.width = '0%';
    document.getElementById('startSpeedTest').disabled = true;

    const rttResult = await latencyTest();
    const dlResult = await downloadTest();
    const ulResult = await uploadTest(); 

    // Update global results for the summary chart
    allResults.speed.dl = dlResult.success ? dlResult.speedMbps : 0;
    allResults.speed.ul = ulResult.success ? ulResult.speedMbps : 0;
    allResults.speed.rtt = rttResult.success ? rttResult.avgRtt : 0;
    allResults.speed.complete = true;

    updateSummary();
    document.getElementById('startSpeedTest').disabled = false;
}