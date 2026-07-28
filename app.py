import os
import subprocess
import threading
from flask import Flask, send_from_directory, request, jsonify
from flask_socketio import SocketIO

app = Flask(__name__, static_folder='static')
socketio = SocketIO(app, cors_allowed_origins="*")

current_process = None
process_lock = threading.Lock()

def stream_logs(process, sid):
    """Read FFmpeg output and stream to the client"""
    try:
        # FFmpeg outputs mostly to stderr
        for line in iter(process.stderr.readline, b''):
            if line:
                socketio.emit('log', {'data': line.decode('utf-8', errors='replace')}, to=sid)
    except Exception as e:
        socketio.emit('log', {'data': f'Error reading log: {str(e)}\n'}, to=sid)
    
    process.wait()
    socketio.emit('status', {'status': 'stopped'}, to=sid)
    socketio.emit('log', {'data': f'FFmpeg process exited with code {process.returncode}\n'}, to=sid)

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@socketio.on('connect')
def handle_connect():
    global current_process
    with process_lock:
        if current_process is not None and current_process.poll() is None:
            socketio.emit('status', {'status': 'running'}, to=request.sid)
        else:
            socketio.emit('status', {'status': 'stopped'}, to=request.sid)

@socketio.on('start_stream')
def handle_start_stream(data):
    global current_process
    
    with process_lock:
        if current_process is not None and current_process.poll() is None:
            socketio.emit('log', {'data': 'Error: A stream is already running.\n'}, to=request.sid)
            return

        source = data.get('source')
        destination = data.get('destination')
        destination2 = data.get('destination2')
        encoder = data.get('encoder', 'libx264')
        resolution = data.get('resolution')
        fps = data.get('fps')
        vbitrate = data.get('vbitrate')
        abitrate = data.get('abitrate')
        audio_delay = data.get('audioDelay', '0')
        watermark = data.get('watermark')
        record_local = data.get('recordLocal', False)
        record_path = data.get('recordPath')
        
        if not source or not destination:
            socketio.emit('log', {'data': 'Error: Source and Destination 1 are required.\n'}, to=request.sid)
            return

        cmd = ['ffmpeg', '-y']

        cmd = ['ffmpeg', '-y']

        # Fix RTSP transport and timestamp issues
        if source and source.startswith('rtsp://'):
            cmd.extend([
                '-rtsp_transport', 'tcp',
                '-fflags', '+genpts', 
                '-use_wallclock_as_timestamps', '1' 
            ])

        if audio_delay and audio_delay.isdigit() and int(audio_delay) > 0:
            cmd.extend(['-itsoffset', str(int(audio_delay) / 1000.0)])
            
        cmd.extend(['-i', source])
        
        has_watermark = watermark and os.path.exists(watermark)
        if has_watermark:
            cmd.extend(['-i', watermark])

        # Build filter graph for scaling and watermarking
        video_map = '0:v'
        filters = []
        
        if resolution and resolution != "original":
            w, h = resolution.split('x')
            # Scale and pad to fit exactly into the target resolution (letterboxing)
            filters.append(f"[{video_map}]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1[scaled]")
            video_map = 'scaled'
            
        if has_watermark:
            # Overlay watermark on the video
            filters.append(f"[{video_map}][1:v]overlay=W-w-10:H-h-10[with_wm]")
            video_map = 'with_wm'

        if filters:
            cmd.extend(['-filter_complex', ';'.join(filters)])
            cmd.extend(['-map', f'[{video_map}]'])
        else:
            cmd.extend(['-map', '0:v?'])
            
        cmd.extend(['-map', '0:a?']) # Always map audio
        
        # Audio filter to fix Non-monotonic DTS which breaks YouTube's player
        cmd.extend(['-af', 'aresample=async=1'])

        # Encoder Settings
        cmd.extend(['-c:v', encoder])
        
        if encoder == 'libx264':
            cmd.extend(['-preset', 'veryfast', '-profile:v', 'high'])
        elif encoder == 'h264_nvenc':
            cmd.extend(['-preset', 'p2', '-rc', 'cbr', '-profile:v', 'high'])
        elif encoder == 'h264_qsv':
            cmd.extend(['-preset', 'faster', '-profile:v', 'high'])

        cmd.extend([
            '-b:v', vbitrate,
            '-maxrate', vbitrate,
            '-bufsize', str(int(vbitrate.replace('k','')) * 2) + 'k' if 'k' in vbitrate else vbitrate,
            '-pix_fmt', 'yuv420p',
            '-g', str(int(fps) * 2),
            '-c:a', 'aac',
            '-b:a', abitrate,
            '-ar', '44100',
            '-r', fps,
            '-fps_mode', 'cfr', # Force constant framerate
            '-flvflags', 'no_duration_filesize' # YouTube prefers this for live streams
        ])

        # Outputs handling using tee muxer for multi-streaming and local recording
        outputs = []
        outputs.append(f"[f=flv]{destination}")
        
        if destination2:
            outputs.append(f"[f=flv]{destination2}")
            
        if record_local and record_path:
            os.makedirs(os.path.dirname(record_path), exist_ok=True)
            outputs.append(f"[f=mp4]{record_path}")

        cmd.extend(['-f', 'tee', '|'.join(outputs)])

        socketio.emit('log', {'data': f'Executing: {" ".join(cmd)}\n'}, to=request.sid)
        
        try:
            current_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE,
                bufsize=1,
                universal_newlines=False
            )
            
            socketio.emit('status', {'status': 'running'}, to=request.sid)
            
            thread = threading.Thread(target=stream_logs, args=(current_process, request.sid))
            thread.daemon = True
            thread.start()
            
        except Exception as e:
            socketio.emit('log', {'data': f'Failed to start FFmpeg: {str(e)}\n'}, to=request.sid)
            socketio.emit('status', {'status': 'error'}, to=request.sid)

@socketio.on('stop_stream')
def handle_stop_stream():
    global current_process
    
    with process_lock:
        if current_process is not None and current_process.poll() is None:
            socketio.emit('log', {'data': 'Stopping stream...\n'}, to=request.sid)
            # Try gentle quit via stdin
            try:
                current_process.stdin.write(b'q')
                current_process.stdin.flush()
                # Give it a couple seconds to quit gently, otherwise kill
                current_process.wait(timeout=3)
            except (Exception, subprocess.TimeoutExpired):
                current_process.kill()
            socketio.emit('status', {'status': 'stopped'}, to=request.sid)
        else:
            socketio.emit('log', {'data': 'No stream is currently running.\n'}, to=request.sid)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
