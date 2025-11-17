document.getElementById('startJitterTest').addEventListener('click', runJitterTest);

const JITTER_STATUS = document.getElementById('jitterStatus');
const JITTER_RESULT = document.getElementById('jitterResult');
const MOS_RESULT = document.getElementById('mosScore');

let pc1, pc2; // Peer Connections for the loopback
let localStream;
let statsInterval;

// --- WebRTC Configuration ---
const PC_CONFIG = {
    // A STUN server is still needed to determine the client's public IP/port candidates.
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } 
    ]
};

// --- E-Model MOS Calculation (Simplified) ---
function calculateMos(rttMs, packetLossPct, jitterMs) {
    // ... (Use the same MOS calculation function as before) ...
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

// --- Manual Signaling Logic for Loopback ---

// Sends the generated ICE candidate from one peer to the other
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
    // Use the receiving peer (pc2) to get statistics, as it represents the 'inbound' VoIP stream.
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
            // Jitter is reported in seconds, convert to milliseconds
            const jitterMs = inboundRtpStats.jitter * 1000; 
            const packetsLost = inboundRtpStats.packetsLost || 0;
            const packetsReceived = inboundRtpStats.packetsReceived || 1; 

            const packetLossPct = (packetsLost / (packetsLost + packetsReceived)) * 100;
            
            // RTT from the established connection pair
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
    JITTER_STATUS.textContent = 'Starting test... (Microphone required)';
    console.log('--- Starting WebRTC Loopback Jitter Test ---');

    // Clean up previous test
    if (statsInterval) clearInterval(statsInterval);
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (pc1) pc1.close();
    if (pc2) pc2.close();
    
    try {
        // 1. Get audio stream (mic access required)
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        // 2. Create two peer connections
        pc1 = new RTCPeerConnection(PC_CONFIG); // Sender
        pc2 = new RTCPeerConnection(PC_CONFIG); // Receiver

        // 3. Set up ICE Candidate exchange for loopback (manual signaling)
        pc1.onicecandidate = onIceCandidate(pc1, pc2);
        pc2.onicecandidate = onIceCandidate(pc2, pc1);
        
        // 4. Add the audio track from the local stream to the sender (pc1)
        localStream.getTracks().forEach(track => pc1.addTrack(track, localStream));

        // 5. Set up receiver to get the stream (to complete the connection)
        pc2.ontrack = (event) => {
            console.log('Receiver got track:', event.track);
        };
        
        // 6. Create Offer/Answer (manual signaling)
        const offer = await pc1.createOffer();
        await pc1.setLocalDescription(offer);
        await pc2.setRemoteDescription(pc1.localDescription);

        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);
        await pc1.setRemoteDescription(pc2.localDescription);
        
        // 7. Start collecting stats once negotiation is complete
        JITTER_STATUS.textContent = 'WebRTC Loopback Established. Collecting stats...';
        statsInterval = setInterval(collectStats, 2000); // Check every 2 seconds

        // 8. Auto-stop after 20 seconds
        setTimeout(() => {
            clearInterval(statsInterval);
            if (pc1) pc1.close();
            if (pc2) pc2.close();
            if (localStream) localStream.getTracks().forEach(track => track.stop());
            JITTER_STATUS.textContent = 'Test Complete.';
            console.log('--- Jitter Test Complete ---');
        }, 20000); 

    } catch (e) {
        JITTER_STATUS.textContent = `Error: Cannot access microphone or WebRTC failed. (Must be run on HTTPS)`;
        console.error('Jitter Test Failed:', e);
    }
}