document.getElementById('startJitterTest').addEventListener('click', runJitterTest);

const JITTER_STATUS = document.getElementById('jitterStatus');
const JITTER_RESULT = document.getElementById('jitterResult');
const MOS_RESULT = document.getElementById('mosScore');

let pc1, pc2; 
let localStream; // Now a silent stream
let statsInterval;

const PC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } 
    ]
};

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
    MOS = Math.min(4.5, MOS); 
    return MOS;
}

// --- Audio Generation: Create a silent stream without Mic access ---
function createSilentAudioStream() {
    // 1. Create an AudioContext
    const context = new (window.AudioContext || window.webkitAudioContext)();
    
    // 2. Create a MediaStreamAudioDestinationNode
    const destination = context.createMediaStreamDestination();
    
    // 3. Create a silent sound source (Oscillator)
    // We create an oscillator, but set the gain (volume) to 0.0001 (near silence)
    // A gain of exactly 0 sometimes causes the browser to stop generating packets.
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(destination);

    // Set gain to near-zero (silent)
    gainNode.gain.value = 0.0001; 
    
    // Start the oscillator
    oscillator.start();
    
    // The stream is taken from the destination node
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

        stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                inboundRtpStats = report;
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                candidatePairStats = report;
            }
        });

        if (inboundRtpStats) {
            const jitterMs = inboundRtpStats.jitter * 1000; 
            const packetsLost = inboundRtpStats.packetsLost || 0;
            const packetsReceived = inboundRtpStats.packetsReceived || 1; 

            const packetLossPct = (packetsLost / (packetsLost + packetsReceived)) * 100;
            const rttMs = candidatePairStats ? candidatePairStats.currentRoundTripTime * 1000 : 50; 

            const mosScore = calculateMos(rttMs, packetLossPct, jitterMs);

            JITTER_RESULT.textContent = `${jitterMs.toFixed(2)} ms`;
            MOS_RESULT.textContent = `${mosScore.toFixed(2)}`;
            JITTER_STATUS.textContent = `Testing... (PL: ${packetLossPct.toFixed(1)}%, RTT: ${rttMs.toFixed(0)} ms)`;
        } else {
            JITTER_STATUS.textContent = 'Waiting for inbound audio data...';
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

    // Cleanup
    if (statsInterval) clearInterval(statsInterval);
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (pc1) pc1.close();
    if (pc2) pc2.close();
    
    try {
        // 1. Get silent audio stream (NO MIC ACCESS REQUIRED)
        localStream = createSilentAudioStream();

        // 2. Create two peer connections (Sender/Receiver)
        pc1 = new RTCPeerConnection(PC_CONFIG); 
        pc2 = new RTCPeerConnection(PC_CONFIG); 

        // 3. Set up ICE Candidate exchange
        pc1.onicecandidate = onIceCandidate(pc1, pc2);
        pc2.onicecandidate = onIceCandidate(pc2, pc1);
        
        // 4. Add the audio track to the sender (pc1)
        localStream.getTracks().forEach(track => pc1.addTrack(track, localStream));

        // 5. Set up receiver to handle the incoming track
        pc2.ontrack = (event) => { /* Track received, connection is good */ };
        
        // 6. Create Offer/Answer
        const offer = await pc1.createOffer();
        await pc1.setLocalDescription(offer);
        await pc2.setRemoteDescription(pc1.localDescription);

        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);
        await pc1.setRemoteDescription(pc2.localDescription);
        
        // 7. Start collecting stats 
        JITTER_STATUS.textContent = 'WebRTC Loopback Established. Collecting stats...';
        statsInterval = setInterval(collectStats, 2000); 

        // 8. Auto-stop after 20 seconds
        setTimeout(() => {
            clearInterval(statsInterval);
            if (pc1) pc1.close();
            if (pc2) pc2.close();
            // Stop the stream generation
            if (localStream) localStream.getTracks().forEach(track => track.stop()); 
            JITTER_STATUS.textContent = 'Test Complete.';
        }, 20000); 

    } catch (e) {
        JITTER_STATUS.textContent = `Error: WebRTC setup failed. Console for details.`;
        console.error('Jitter Test Failed:', e);
    }
}