document.getElementById('startVideoTest').addEventListener('click', runVideoTest);

const videoElement = document.getElementById('testVideo');
const statusDisplay = document.getElementById('videoStatus');
const VIDEO_DURATION_SECONDS = 15; // IMPORTANT: Update this to your testVideo.mp4 length

let startLoadTime = 0;
let timeToPlay = 0;
let totalBufferingTime = 0;
let lastBufferingStart = 0;
let hasPlayed = false;

// --- Helper to reset all states ---
function resetVideoTest() {
    videoElement.src = 'testVideo.mp4';
    videoElement.load(); 
    videoElement.removeAttribute('controls');
    videoElement.style.display = 'none';
    statusDisplay.textContent = 'Loading video...';
    
    startLoadTime = 0;
    timeToPlay = 0;
    totalBufferingTime = 0;
    lastBufferingStart = 0;
    hasPlayed = false;

    document.getElementById('initialLatency').textContent = '---';
    document.getElementById('totalBufferingTime').textContent = '---';
    document.getElementById('rebufferRatio').textContent = '---';
}

// --- Event Handlers ---
videoElement.addEventListener('loadstart', () => {
    startLoadTime = performance.now();
});

videoElement.addEventListener('canplay', () => {
    if (timeToPlay === 0) {
        timeToPlay = performance.now();
        const initialLatencyMs = timeToPlay - startLoadTime;
        document.getElementById('initialLatency').textContent = 
            `${initialLatencyMs.toFixed(0)} ms`;
        statusDisplay.textContent = 'Playback starting...';
        videoElement.play().catch(e => console.error('Video play failed:', e));
        hasPlayed = true;
    }
});

videoElement.addEventListener('waiting', () => {
    if (hasPlayed && lastBufferingStart === 0) {
        lastBufferingStart = performance.now();
        statusDisplay.textContent = 'Buffering...';
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

videoElement.addEventListener('ended', () => {
    statusDisplay.textContent = 'Test Complete.';
    
    if (lastBufferingStart > 0) {
        totalBufferingTime += performance.now() - lastBufferingStart;
    }

    const totalBufferingSeconds = totalBufferingTime / 1000;
    const rebufferRatio = (totalBufferingSeconds / VIDEO_DURATION_SECONDS) * 100;
    
    document.getElementById('totalBufferingTime').textContent = 
        `${totalBufferingSeconds.toFixed(2)} s`;
    document.getElementById('rebufferRatio').textContent = 
        `${rebufferRatio.toFixed(2)} %`;
    
    videoElement.style.display = 'block';
    videoElement.setAttribute('controls', 'true');
    videoElement.pause();
    videoElement.currentTime = 0;
});

// --- Main Runner Function ---
function runVideoTest() {
    resetVideoTest(); 
    videoElement.style.display = 'block'; 
}