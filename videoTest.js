document.getElementById('startVideoTest').addEventListener('click', runVideoTest);

const videoElement = document.getElementById('testVideo');
const statusDisplay = document.getElementById('videoStatus');
const initialLatencySpan = document.getElementById('initialLatency');
const totalBufferingTimeSpan = document.getElementById('totalBufferingTime');
const rebufferRatioSpan = document.getElementById('rebufferRatio');
const videoTotalDurationSpan = document.getElementById('videoTotalDuration');
const videoCurrentBitrateSpan = document.getElementById('videoCurrentBitrate');

// --- Configuration ---
const LOCAL_VIDEO_FILE = 'bigbunny1.mp4'; 
let VIDEO_DURATION_SECONDS = 117; // UPDATED: 117 seconds playback duration

let startLoadTime = 0;
let timeToPlay = 0;
let totalBufferingTime = 0;
let lastBufferingStart = 0;
let hasPlayed = false;
let totalRebuffers = 0;


// --- Helper to reset and clear results ---
function resetVideoTest() {
    videoElement.src = LOCAL_VIDEO_FILE;
    videoElement.load(); 
    videoElement.removeAttribute('controls');
    videoElement.style.display = 'block';
    statusDisplay.textContent = `Loading video: ${LOCAL_VIDEO_FILE}...`;
    
    // Reset metrics
    startLoadTime = 0;
    timeToPlay = 0;
    totalBufferingTime = 0;
    lastBufferingStart = 0;
    hasPlayed = false;
    totalRebuffers = 0;

    // Clear results
    initialLatencySpan.textContent = '---';
    totalBufferingTimeSpan.textContent = '---';
    rebufferRatioSpan.textContent = '---';
    videoTotalDurationSpan.textContent = `${VIDEO_DURATION_SECONDS.toFixed(1)} s`; // Show known duration
    videoCurrentBitrateSpan.textContent = '---';
}

// --- Error Handling Function ---
function handleVideoError(message, error) {
    statusDisplay.textContent = `ERROR: ${message}`;
    console.error(message, error);
    initialLatencySpan.textContent = 'ERROR';
    totalBufferingTimeSpan.textContent = 'N/A';
    rebufferRatioSpan.textContent = 'N/A';
    videoCurrentBitrateSpan.textContent = 'N/A';
    
    allResults.video.complete = true;
    updateSummary();

    // Clean up
    videoElement.style.display = 'block';
    videoElement.setAttribute('controls', 'true');
    videoElement.pause();
    videoElement.currentTime = 0;
}

// --- Event Handlers ---

videoElement.addEventListener('error', (e) => {
    let errorMessage = `Video playback error (Code: ${videoElement.error.code}).`;
    if (videoElement.error && videoElement.error.code === 4) {
        errorMessage = `Video file not found. Ensure "${LOCAL_VIDEO_FILE}" is in the root directory.`;
    }
    handleVideoError(errorMessage, e);
});

videoElement.addEventListener('loadedmetadata', () => {
    // If the metadata provides a duration, use it, otherwise keep the defined constant
    if (videoElement.duration > 0) {
        VIDEO_DURATION_SECONDS = videoElement.duration;
    }
    videoTotalDurationSpan.textContent = `${VIDEO_DURATION_SECONDS.toFixed(1)} s`;
});

videoElement.addEventListener('loadstart', () => {
    startLoadTime = performance.now();
});

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
        totalRebuffers++; 
    }
});

videoElement.addEventListener('waiting', () => {
    if (hasPlayed && lastBufferingStart === 0) {
        lastBufferingStart = performance.now();
        // Check if this is the first buffer after the initial play
        if (totalRebuffers > 0) { 
             totalRebuffers++;
        }
        statusDisplay.textContent = `Buffering... (Rebuffers: ${totalRebuffers - 1})`;
    }
});

videoElement.addEventListener('playing', () => {
    if (lastBufferingStart > 0) {
        const bufferingDuration = performance.now() - lastBufferingStart;
        totalBufferingTime += bufferingDuration;
        lastBufferingStart = 0; 
        statusDisplay.textContent = 'Playing...';
    }
});

videoElement.addEventListener('timeupdate', () => {
    videoCurrentBitrateSpan.textContent = `~ N/A (Local File)`; 
});

videoElement.addEventListener('ended', () => {
    statusDisplay.textContent = 'Test Complete.';
    
    if (lastBufferingStart > 0) {
        totalBufferingTime += performance.now() - lastBufferingStart;
    }

    const totalBufferingSeconds = totalBufferingTime / 1000;
    
    if (VIDEO_DURATION_SECONDS <= 0 || isNaN(VIDEO_DURATION_SECONDS)) {
         handleVideoError("Video duration is unknown/zero. Cannot calculate ratio.", null);
         return;
    }

    const initialLatencyMs = timeToPlay > 0 ? timeToPlay - startLoadTime : 0;
    const rebufferRatio = (totalBufferingSeconds / VIDEO_DURATION_SECONDS) * 100;
    
    totalBufferingTimeSpan.textContent = `${totalBufferingSeconds.toFixed(2)} s`;
    rebufferRatioSpan.textContent = `${rebufferRatio.toFixed(2)} % (${totalRebuffers - 1} times)`;
    
    // Update global results for the summary chart
    allResults.video.latency = initialLatencyMs;
    allResults.video.rebufferRatio = rebufferRatio;
    allResults.video.complete = true;
    updateSummary();

    // Clean up
    videoElement.style.display = 'block'; 
    videoElement.setAttribute('controls', 'true');
    videoElement.pause();
    videoElement.currentTime = 0;
});

// --- Main Runner Function ---
function runVideoTest() {
    document.getElementById('startVideoTest').disabled = true;
    resetVideoTest(); // Clears metrics and loads video
    document.getElementById('startVideoTest').disabled = false;
}