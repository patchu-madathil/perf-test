document.getElementById('startSpeedTest').addEventListener('click', runSpeedTest);

// --- Configuration ---
const DOWNLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 Megabytes
const UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;   // 10 Megabytes

// URLs must be provided without protocol (https://)
const DOWNLOAD_URL_BASES = [
    // Use URLs that have both HTTP and HTTPS versions if possible
    'speedtest.tele2.net/50MB.zip', 
    'ipv4.download.thinkbroadband.com/50MB.zip', 
    '2.testdebit.info/50M.box'
];
const UPLOAD_URLS = [
    'https://httpbin.org/post', // Common testing endpoint
    'https://postman-echo.com/post' 
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

    // Outer loop for URL bases
    for (const urlBase of DOWNLOAD_URL_BASES) {
        // Inner loop for protocol fallback (HTTPS -> HTTP)
        for (const protocol of ['https://', 'http://']) {
            const url = protocol + urlBase + `?r=${Math.random()}`;
            console.log(`Attempting download from: ${url}`);
            
            const startTime = performance.now();
            let bytesTransferred = 0;
            let lastUpdateTime = startTime;
            let lastBytes = 0;

            try {
                const response = await fetch(url, { method: 'GET', cache: 'no-store' });

                if (!response.ok) {
                    throw new Error(`HTTP Status ${response.status}`);
                }

                const contentLength = response.headers.get('content-length') || DOWNLOAD_SIZE_BYTES;
                const reader = response.body.getReader();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    bytesTransferred += value.length;

                    const now = performance.now();
                    if (now - lastUpdateTime > 100) {
                        const timeElapsedSeconds = (now - lastUpdateTime) / 1000;
                        const instantSpeedBps = (bytesTransferred - lastBytes) / timeElapsedSeconds;
                        dlSpeedSpan.textContent = `${bytesToMbps(instantSpeedBps)} Mbps`;
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
                
                console.log(`Download succeeded from ${url}`);
                return { success: true, speedMbps }; // SUCCESS: Exit both loops

            } catch (error) {
                console.warn(`Download failed from ${url}: ${error.message}`);
                // If it's HTTPS failure, the inner HTTP loop will run next.
                // If it's HTTP failure, or if HTTP failed after HTTPS, the outer loop moves to the next URL base.
            }
        }
    }
    
    // If all loops finish without success
    dlSpeedSpan.textContent = `ERROR: All DL URLs failed.`;
    dlProgressDiv.style.width = '0%';
    return { success: false, speedMbps };
}

// --- Upload Speed Test with Fallback and Progress ---
async function uploadTest() {
    ulSpeedSpan.textContent = '0.00 Mbps';
    ulProgressDiv.style.width = '0%';
    let speedMbps = 0;
    
    // Generate a dummy data array (10MB) to upload
    const uploadData = new ArrayBuffer(UPLOAD_SIZE_BYTES);
    const dataView = new DataView(uploadData);
    for (let i = 0; i < UPLOAD_SIZE_BYTES; i++) {
        dataView.setUint8(i, Math.floor(Math.random() * 256));
    }
    
    for (const url of UPLOAD_URLS) {
        console.log(`Attempting upload to: ${url}`);
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

            return { success: true, speedMbps }; // SUCCESS: Exit loop

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
    let success = false;

    // Use the first reliable download URL base for RTT check
    for (const urlBase of DOWNLOAD_URL_BASES) {
        for (const protocol of ['https://', 'http://']) {
            const testUrlBase = protocol + urlBase;
            
            try {
                // Run multiple iterations
                for (let i = 0; i < iterations; i++) {
                    const testUrl = `${testUrlBase}?cachebust=${Math.random()}`;
                    const startTime = performance.now();
                    // Use HEAD request for minimal data transfer
                    await fetch(testUrl, { method: 'HEAD', cache: 'no-store' }); 
                    const endTime = performance.now();
                    totalRtt += (endTime - startTime);
                }

                avgRtt = totalRtt / iterations;
                rttLatencySpan.textContent = `${avgRtt.toFixed(1)} ms`;
                success = true;
                return { success: true, avgRtt }; // SUCCESS: Exit loops

            } catch (error) {
                console.warn(`Latency check failed for ${testUrlBase}: ${error.message}`);
                // Try next protocol/URL
            }
        }
    }
    
    rttLatencySpan.textContent = `ERROR: Latency check failed.`;
    return { success: false, avgRtt };
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