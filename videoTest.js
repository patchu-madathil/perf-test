document.getElementById('startVideoTest').addEventListener('click', runVideoTest);

const videoElement = document.getElementById('testVideo');
const statusDisplay = document.getElementById('videoStatus');
const initialLatencySpan = document.getElementById('initialLatency');
const totalBufferingTimeSpan = document.getElementById('totalBufferingTime');
const rebufferRatioSpan = document.getElementById('rebufferRatio');

// --- Configuration ---
// A) CHANGE THE LOCAL FILE NAME HERE:
const LOCAL_VIDEO_FILE = 'bigbunny1.mp4'; 
// B) IMPORTANT: Set this to the actual duration of your LOCAL_VIDEO_FILE in seconds.
const VIDEO_DURATION_SECONDS = 117; 

let startLoadTime = 0;
let timeToPlay = 0;
let totalBufferingTime = 0;
let lastBufferingStart = 0;
let hasPlayed = false;

// --- Helper to reset and clear results ---
function resetVideoTest() {
    videoElement.src = LOCAL_VIDEO_FILE;
    videoElement.load(); 
    videoElement.removeAttribute('controls');
    videoElement.style.display = 'block'; // Keep visible during load
    statusDisplay.textContent = `Loading video: ${LOCAL_VIDEO_FILE}...`;
    
    // Reset metrics
    startLoadTime = 0;
    timeToPlay = 0;
    totalBufferingTime = 0;
    lastBufferingStart = 0;
    hasPlayed = false;

    // Clear results
    initialLatencySpan.textContent = '---';
    totalBufferingTimeSpan.textContent = '---';
    rebufferRatioSpan.textContent = '---';
}

// --- Error Handling Function ---
function handleVideoError(message, error) {
    statusDisplay.textContent = `ERROR: ${message}`;
    console.error(message, error);
    initialLatencySpan.textContent = 'ERROR';
    totalBufferingTimeSpan.textContent = 'N/A';
    rebufferRatioSpan.textContent = 'N/A';
    // Clean up
    videoElement.style.display = 'block';
    videoElement.setAttribute('controls', 'true');
    videoElement.pause();
    videoElement.currentTime = 0;
}

// --- Event Handlers ---

// Error Event: Crucial for network or file loading issues
videoElement.addEventListener('error', (e) => {
    let errorMessage = `Video playback error (Code: ${videoElement.error.code}).`;
    if (videoElement.error && videoElement.error.code === 4) {
        errorMessage = `Video file not found or failed to load. Ensure "${LOCAL_VIDEO_FILE}" is in the root directory.`;
    }
    handleVideoError(errorMessage, e);
});

// 1. Initial Load: Start the timer when we begin loading the source
videoElement.addEventListener('loadstart', () => {
    startLoadTime = performance.now();
});

// 2. Initial Latency: Fired when enough data has buffered to start playback
videoElement.addEventListener('canplay', () => {
    if (timeToPlay === 0) {
        timeToPlay = performance.now();
        const initialLatencyMs = timeToPlay - startLoadTime;
        initialLatencySpan.textContent = `${initialLatencyMs.toFixed(0)} ms`;
        statusDisplay.textContent = 'Playback starting...';
        
        videoElement.play().catch(e => {
            handleVideoError("Autoplay blocked by browser. Please manually press play.", e);
        });
        hasPlayed = true;
    }
});

// 3. Rebuffer Start: Fired when playback pauses due to lack of data
videoElement.addEventListener('waiting', () => {
    if (hasPlayed && lastBufferingStart === 0) {
        lastBufferingStart = performance.now();
        statusDisplay.textContent = 'Buffering...';
    }
});

// 4. Rebuffer End: Fired when enough data is available to resume playback
videoElement.addEventListener('playing', () => {
    if (lastBufferingStart > 0) {
        const bufferingDuration = performance.now() - lastBufferingStart;
        totalBufferingTime += bufferingDuration;
        lastBufferingStart = 0; 
        statusDisplay.textContent = 'Playing...';
    }
});

// 5. Test Completion: Fired when the media has reached the end
videoElement.addEventListener('ended', () => {
    statusDisplay.textContent = 'Test Complete.';
    
    if (lastBufferingStart > 0) {
        totalBufferingTime += performance.now() - lastBufferingStart;
    }

    const totalBufferingSeconds = totalBufferingTime / 1000;
    
    if (VIDEO_DURATION_SECONDS <= 0) {
         handleVideoError("Video duration is not set or is zero. Please update VIDEO_DURATION_SECONDS in the script.", null);
         return;
    }

    const rebufferRatio = (totalBufferingSeconds / VIDEO_DURATION_SECONDS) * 100;
    
    totalBufferingTimeSpan.textContent = `${totalBufferingSeconds.toFixed(2)} s`;
    rebufferRatioSpan.textContent = `${rebufferRatio.toFixed(2)} %`;
    
    // Clean up: show controls after test is finished
    videoElement.style.display = 'block'; 
    videoElement.setAttribute('controls', 'true');
    videoElement.pause();
    videoElement.currentTime = 0;
});

// --- Main Runner Function ---
function runVideoTest() {
    resetVideoTest(); // Clears metrics and loads video
}