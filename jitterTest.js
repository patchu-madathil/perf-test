document.getElementById('startJitterTest').addEventListener('click', runJitterTest);

const JITTER_STATUS = document.getElementById('jitterStatus');
const JITTER_RESULT = document.getElementById('jitterResult');
const MOS_RESULT = document.getElementById('mosScore');
const jitterProgressDiv = document.getElementById('jitterProgressBar');

let pc1, pc2; 
let localStream; 
let statsInterval;
let timerInterval;

// --- Configuration ---
const PC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } 
    ]
};
const TEST_DURATION_SECONDS = 60; 
const STATS_COLLECTION_INTERVAL = 2000; 
const MOS_SCORE_MAX = 4.5; // Theoretical max MOS for VoIP

// --- E-Model MOS Calculation (Simplified) ---
function calculateMos(rttMs, packetLossPct, jitterMs) {
    const Ro = 93.2; 
    const Id = rttMs > 100 ? (rttMs / 4 - 25) : 0; 
    const Ie = packetLossPct > 1 ? 15 + packetLossPct : packetLossPct;
    const J_penalty = jitterMs > 20 ? (jitterMs / 20) : 0; 
    let R = Ro - Id - Ie - J_penalty;
    R = Math.max(0, R); 
    R = Math.min(100, R);
    let MOS = 1 + (0.035 * R) + (R * (R - 60) * (100 - R) * 0.000007);
    MOS = Math.max(1.0, MOS);
    MOS = Math.min(MOS_SCORE_MAX, MOS); 
    return MOS;
}

// --- Audio Generation: Create a silent stream without Mic access ---
function createSilentAudioStream() {
    if (!window.AudioContext && !window.webkitAudioContext) {
        throw new Error("Web Audio API not supported. Cannot generate silent stream.");
    }
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const destination = context.createMediaStreamDestination();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(destination);

    gainNode.gain.value = 0.0001; 
    oscillator.start();
    
    return destination.stream;
}

// --- Manual Signaling for Loopback ---
function onIceCandidate(peerA, peerB) {
    return (event) => {
        if (event.candidate) {
            peerB.addIceCandidate(event.candidate)
                .catch(e => console.error('Error adding ICE candidate:', e));
        }
    };
}

// --- Stats Collection ---
async function collectStats() {
    if (!pc2) return; 

    try {
        const stats = await pc2.getStats();
        let inboundRtpStats;
        let candidatePairStats;
        let mosScore = null;
        let jitterMs = null;

        stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                inboundRtpStats = report;
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                candidatePairStats = report;
            }
        });

        if (inboundRtpStats) {
            jitterMs = inboundRtpStats.jitter * 1000; 
            const packetsLost = inboundRtpStats.packetsLost || 0;
            const packetsReceived = inboundRtpStats.packetsReceived || 1; 

            const packetLossPct = (packetsLost / (packetsLost + packetsReceived)) * 100;
            const rttMs = candidatePairStats ? candidatePairStats.currentRoundTripTime * 1000 : 50; 

            mosScore = calculateMos(rttMs, packetLossPct, jitterMs);

            JITTER_RESULT.textContent = `${jitterMs.toFixed(2)} ms`;
            MOS_RESULT.textContent = `${mosScore.toFixed(2)}`;
            
            // Update global results with latest readings
            allResults.jitter.mos = mosScore;
            allResults.jitter.jitter = jitterMs;
        } 

    } catch (e) {
        console.error('getStats failed:', e);
    }
}


// --- Main Runner Function ---
async function runJitterTest() {
    JITTER_RESULT.textContent = '---';
    MOS_RESULT.textContent = '---';
    JITTER_STATUS.textContent = 'Starting test... (Generating silent audio packets)';
    jitterProgressDiv.style.width = '0%';
    document.getElementById('startJitterTest').disabled = true;

    // Cleanup
    if (statsInterval) clearInterval(statsInterval);
    if (timerInterval) clearInterval(timerInterval);
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (pc1) pc1.close();
    if (pc2) pc2.close();
    
    try {
        localStream = createSilentAudioStream();

        pc1 = new RTCPeerConnection(PC_CONFIG); 
        pc2 = new RTCPeerConnection(PC_CONFIG); 

        pc1.onicecandidate = onIceCandidate(pc1, pc2);
        pc2.onicecandidate = onIceCandidate(pc2, pc1);
        
        localStream.getTracks().forEach(track => pc1.addTrack(track, localStream));

        pc2.ontrack = (event) => { /* Track received */ };
        
        const offer = await pc1.createOffer();
        await pc1.setLocalDescription(offer);
        await pc2.setRemoteDescription(pc1.localDescription);

        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);
        await pc1.setRemoteDescription(pc2.localDescription);
        
        // 7. Start collecting stats and Timer
        JITTER_STATUS.textContent = 'WebRTC Loopback Established. Collecting stats...';
        statsInterval = setInterval(collectStats, STATS_COLLECTION_INTERVAL); 
        
        let timeLeft = TEST_DURATION_SECONDS;
        timerInterval = setInterval(() => {
            timeLeft--;
            const progressPct = ((TEST_DURATION_SECONDS - timeLeft) / TEST_DURATION_SECONDS) * 100;
            jitterProgressDiv.style.width = `${progressPct}%`;
            JITTER_STATUS.textContent = `Testing... (${timeLeft}s remaining)`;
            
            if (timeLeft <= 0) {
                // Stop the test
                clearInterval(statsInterval);
                clearInterval(timerInterval);
                if (pc1) pc1.close();
                if (pc2) pc2.close();
                if (localStream) localStream.getTracks().forEach(track => track.stop());
                
                jitterProgressDiv.style.width = '100%';
                JITTER_STATUS.textContent = 'Test Complete.';
                allResults.jitter.complete = true;
                updateSummary();
                document.getElementById('startJitterTest').disabled = false;
            }
        }, 1000);

    } catch (e) {
        JITTER_STATUS.textContent = `Error: WebRTC setup failed.`;
        console.error('Jitter Test Failed:', e);
        document.getElementById('startJitterTest').disabled = false;
    }
}