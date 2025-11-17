document.getElementById('startSpeedTest').addEventListener('click', runSpeedTest);

// --- Configuration ---
const DOWNLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 Megabytes
const DOWNLOAD_URL = `https://speed.hetzner.de/10MB.bin?r=${Math.random()}`; 
// Note: httpbin.org is good for testing, but may throttle. Use a dedicated service for professional tests.
const UPLOAD_URL = 'https://httpbin.org/post'; 

/**
 * Converts bytes per second to Megabits per second (Mbps).
 */
function bytesToMbps(bytesPerSecond) {
    return ((bytesPerSecond * 8) / 1000000).toFixed(2);
}

// --- Download Speed Test ---
async function downloadTest() {
    const startTime = performance.now();
    
    try {
        const response = await fetch(DOWNLOAD_URL, {
            method: 'GET',
            cache: 'no-store'
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const blob = await response.blob();
        const endTime = performance.now();
        const durationSeconds = (endTime - startTime) / 1000;
        const sizeBytes = blob.size || DOWNLOAD_SIZE_BYTES; 
        
        const speedMbps = bytesToMbps(sizeBytes / durationSeconds);
        document.getElementById('downloadSpeed').textContent = `${speedMbps} Mbps`;
        return { success: true, speedMbps };

    } catch (error) {
        document.getElementById('downloadSpeed').textContent = `ERROR: ${error.message}`;
        return { success: false };
    }
}

// --- Upload Speed Test ---
async function uploadTest() {
    // Generate a dummy data array (10MB) to upload
    const uploadData = new ArrayBuffer(DOWNLOAD_SIZE_BYTES);
    const dataView = new DataView(uploadData);
    for (let i = 0; i < DOWNLOAD_SIZE_BYTES; i++) {
        dataView.setUint8(i, Math.floor(Math.random() * 256));
    }

    const startTime = performance.now();
    
    try {
        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            body: uploadData,
            headers: { 'Content-Type': 'application/octet-stream' }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        await response.text(); 
        
        const endTime = performance.now();
        const durationSeconds = (endTime - startTime) / 1000;

        const speedMbps = bytesToMbps(DOWNLOAD_SIZE_BYTES / durationSeconds);

        document.getElementById('uploadSpeed').textContent = `${speedMbps} Mbps`;
        return { success: true, speedMbps };

    } catch (error) {
        document.getElementById('uploadSpeed').textContent = `ERROR: ${error.message}`;
        return { success: false };
    }
}

// --- Latency (RTT) Test ---
async function latencyTest(iterations = 10) {
    let totalRtt = 0;
    const testUrl = `${DOWNLOAD_URL.split('?')[0]}?cachebust=${Math.random()}`; 

    try {
        for (let i = 0; i < iterations; i++) {
            const startTime = performance.now();
            await fetch(testUrl, { method: 'HEAD', cache: 'no-store' }); 
            const endTime = performance.now();
            totalRtt += (endTime - startTime);
        }

        const avgRtt = totalRtt / iterations;
        document.getElementById('rttLatency').textContent = `${avgRtt.toFixed(1)} ms`;
        return { success: true, avgRtt };

    } catch (error) {
        document.getElementById('rttLatency').textContent = `ERROR: ${error.message}`;
        return { success: false };
    }
}

// --- Main Runner Function ---
async function runSpeedTest() {
    document.getElementById('downloadSpeed').textContent = 'TESTING...';
    document.getElementById('uploadSpeed').textContent = 'TESTING...';
    document.getElementById('rttLatency').textContent = 'TESTING...';

    await latencyTest();
    await downloadTest();
    await uploadTest(); 
}