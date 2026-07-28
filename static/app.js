const socket = io();

const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnClear = document.getElementById('btn-clear');
const consoleOutput = document.getElementById('console');
const statusBadge = document.getElementById('status-badge');

// Input fields
const inputSource = document.getElementById('source');
const inputDestination = document.getElementById('destination');
const inputDestination2 = document.getElementById('destination2');
const selectEncoder = document.getElementById('encoder');
const selectResolution = document.getElementById('resolution');
const selectFps = document.getElementById('fps');
const selectVbitrate = document.getElementById('vbitrate');
const selectAbitrate = document.getElementById('abitrate');
const inputAudioDelay = document.getElementById('audio-delay');
const inputWatermark = document.getElementById('watermark');
const checkRecordLocal = document.getElementById('record-local');
const groupRecordPath = document.getElementById('record-path-group');
const inputRecordPath = document.getElementById('record-path');

// Profile fields
const selectProfile = document.getElementById('profile-select');
const btnSaveProfile = document.getElementById('btn-save-profile');
const btnDeleteProfile = document.getElementById('btn-delete-profile');

// Toggle Record Path input
checkRecordLocal.addEventListener('change', () => {
    groupRecordPath.style.display = checkRecordLocal.checked ? 'block' : 'none';
});

// Profile Management
function loadProfiles() {
    const profiles = JSON.parse(localStorage.getItem('streamforge_profiles') || '{}');
    
    // Clear existing options except the first one
    while (selectProfile.options.length > 1) {
        selectProfile.remove(1);
    }
    
    for (const name in profiles) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        selectProfile.appendChild(option);
    }
}

function applyProfile(name) {
    if (!name) return;
    const profiles = JSON.parse(localStorage.getItem('streamforge_profiles') || '{}');
    const p = profiles[name];
    if (!p) return;
    
    inputSource.value = p.source || '';
    inputDestination.value = p.destination || '';
    inputDestination2.value = p.destination2 || '';
    if (p.encoder) selectEncoder.value = p.encoder;
    if (p.resolution) selectResolution.value = p.resolution;
    if (p.fps) selectFps.value = p.fps;
    if (p.vbitrate) selectVbitrate.value = p.vbitrate;
    if (p.abitrate) selectAbitrate.value = p.abitrate;
    inputAudioDelay.value = p.audioDelay || '0';
    inputWatermark.value = p.watermark || '';
    checkRecordLocal.checked = p.recordLocal || false;
    inputRecordPath.value = p.recordPath || '';
    
    groupRecordPath.style.display = checkRecordLocal.checked ? 'block' : 'none';
}

selectProfile.addEventListener('change', () => {
    applyProfile(selectProfile.value);
});

btnSaveProfile.addEventListener('click', () => {
    const name = prompt('Enter a name for this profile:');
    if (!name) return;
    
    const profiles = JSON.parse(localStorage.getItem('streamforge_profiles') || '{}');
    profiles[name] = {
        source: inputSource.value,
        destination: inputDestination.value,
        destination2: inputDestination2.value,
        encoder: selectEncoder.value,
        resolution: selectResolution.value,
        fps: selectFps.value,
        vbitrate: selectVbitrate.value,
        abitrate: selectAbitrate.value,
        audioDelay: inputAudioDelay.value,
        watermark: inputWatermark.value,
        recordLocal: checkRecordLocal.checked,
        recordPath: inputRecordPath.value
    };
    
    localStorage.setItem('streamforge_profiles', JSON.stringify(profiles));
    loadProfiles();
    selectProfile.value = name;
});

btnDeleteProfile.addEventListener('click', () => {
    const name = selectProfile.value;
    if (!name) return;
    
    if (confirm(`Are you sure you want to delete the profile "${name}"?`)) {
        const profiles = JSON.parse(localStorage.getItem('streamforge_profiles') || '{}');
        delete profiles[name];
        localStorage.setItem('streamforge_profiles', JSON.stringify(profiles));
        loadProfiles();
        selectProfile.value = '';
    }
});

// Initialize Profiles
loadProfiles();

// Helper to append logs
function appendLog(text) {
    const span = document.createElement('span');
    span.textContent = text;
    consoleOutput.appendChild(span);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Socket Events
socket.on('connect', () => {
    appendLog('Connected to StreamForge Server.\n');
});

socket.on('disconnect', () => {
    appendLog('Disconnected from server.\n');
    setStatus('stopped');
});

socket.on('log', (data) => {
    appendLog(data.data);
});

socket.on('status', (data) => {
    setStatus(data.status);
});

function setStatus(status) {
    if (status === 'running') {
        statusBadge.textContent = 'Streaming';
        statusBadge.className = 'badge badge-running';
        btnStart.disabled = true;
        btnStop.disabled = false;
        disableInputs(true);
    } else {
        statusBadge.textContent = 'Stopped';
        statusBadge.className = 'badge badge-stopped';
        btnStart.disabled = false;
        btnStop.disabled = true;
        disableInputs(false);
    }
}

function disableInputs(disabled) {
    inputSource.disabled = disabled;
    inputDestination.disabled = disabled;
    inputDestination2.disabled = disabled;
    selectEncoder.disabled = disabled;
    selectResolution.disabled = disabled;
    selectFps.disabled = disabled;
    selectVbitrate.disabled = disabled;
    selectAbitrate.disabled = disabled;
    inputAudioDelay.disabled = disabled;
    inputWatermark.disabled = disabled;
    checkRecordLocal.disabled = disabled;
    inputRecordPath.disabled = disabled;
}

// Button Events
btnStart.addEventListener('click', () => {
    const source = inputSource.value.trim();
    const destination = inputDestination.value.trim();
    
    if (!source || !destination) {
        alert('Please enter both Source and Destination 1 URLs.');
        return;
    }

    if (checkRecordLocal.checked && !inputRecordPath.value.trim()) {
        alert('Please enter a Local Recording Path.');
        return;
    }

    appendLog('Starting stream...\n');
    
    socket.emit('start_stream', {
        source: source,
        destination: destination,
        destination2: inputDestination2.value.trim(),
        encoder: selectEncoder.value,
        resolution: selectResolution.value,
        fps: selectFps.value,
        vbitrate: selectVbitrate.value,
        abitrate: selectAbitrate.value,
        audioDelay: inputAudioDelay.value,
        watermark: inputWatermark.value.trim(),
        recordLocal: checkRecordLocal.checked,
        recordPath: inputRecordPath.value.trim()
    });
});

btnStop.addEventListener('click', () => {
    socket.emit('stop_stream');
});

btnClear.addEventListener('click', () => {
    consoleOutput.innerHTML = '';
});
