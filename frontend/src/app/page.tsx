"use client";

import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Save, Trash2, Play, Square, Eraser } from "lucide-react";

export default function StreamForge() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<"stopped" | "running" | "error">("stopped");
  const [logs, setLogs] = useState<string[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Form State
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [destination2, setDestination2] = useState("");
  const [encoder, setEncoder] = useState("libx264");
  const [resolution, setResolution] = useState("original");
  const [fps, setFps] = useState("30");
  const [vbitrate, setVbitrate] = useState("4500k");
  const [abitrate, setAbitrate] = useState("160k");
  const [audioDelay, setAudioDelay] = useState("0");
  const [watermark, setWatermark] = useState("");
  const [recordLocal, setRecordLocal] = useState(false);
  const [recordPath, setRecordPath] = useState("");

  // Profiles State
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [selectedProfile, setSelectedProfile] = useState("");

  useEffect(() => {
    // Load profiles from localStorage
    const savedProfiles = JSON.parse(localStorage.getItem("streamforge_profiles") || "{}");
    setProfiles(savedProfiles);

    // Initialize Socket
    // In a real environment, this URL should be configurable via env variables
    const newSocket = io("http://127.0.0.1:5000", {
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      setLogs((prev) => [...prev, "Connected to StreamForge Server.\n"]);
    });

    newSocket.on("disconnect", () => {
      setLogs((prev) => [...prev, "Disconnected from server.\n"]);
      setStatus("stopped");
    });

    newSocket.on("log", (data) => {
      setLogs((prev) => [...prev, data.data]);
    });

    newSocket.on("status", (data) => {
      setStatus(data.status);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const loadProfile = (name: string) => {
    setSelectedProfile(name);
    if (!name || !profiles[name]) return;
    
    const p = profiles[name];
    setSource(p.source || "");
    setDestination(p.destination || "");
    setDestination2(p.destination2 || "");
    setEncoder(p.encoder || "libx264");
    setResolution(p.resolution || "original");
    setFps(p.fps || "30");
    setVbitrate(p.vbitrate || "4500k");
    setAbitrate(p.abitrate || "160k");
    setAudioDelay(p.audioDelay || "0");
    setWatermark(p.watermark || "");
    setRecordLocal(p.recordLocal || false);
    setRecordPath(p.recordPath || "");
  };

  const saveProfile = () => {
    const name = prompt("Enter a name for this profile:");
    if (!name) return;

    const newProfiles = {
      ...profiles,
      [name]: {
        source, destination, destination2, encoder, resolution,
        fps, vbitrate, abitrate, audioDelay, watermark,
        recordLocal, recordPath
      }
    };
    
    setProfiles(newProfiles);
    localStorage.setItem("streamforge_profiles", JSON.stringify(newProfiles));
    setSelectedProfile(name);
  };

  const deleteProfile = () => {
    if (!selectedProfile) return;
    if (confirm(`Are you sure you want to delete profile "${selectedProfile}"?`)) {
      const newProfiles = { ...profiles };
      delete newProfiles[selectedProfile];
      setProfiles(newProfiles);
      localStorage.setItem("streamforge_profiles", JSON.stringify(newProfiles));
      setSelectedProfile("");
    }
  };

  const startStream = () => {
    if (!source || !destination) {
      alert("Please enter both Source and Destination 1 URLs.");
      return;
    }
    if (recordLocal && !recordPath) {
      alert("Please enter a Local Recording Path.");
      return;
    }
    
    setLogs((prev) => [...prev, "Starting stream...\n"]);
    
    socket?.emit("start_stream", {
      source, destination, destination2, encoder, resolution,
      fps, vbitrate, abitrate, audioDelay, watermark,
      recordLocal, recordPath
    });
  };

  const stopStream = () => {
    socket?.emit("stop_stream");
  };

  const isRunning = status === "running";

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl flex flex-col gap-8 min-h-screen">
      <header className="flex justify-between items-center pb-4 border-b border-white/10">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          StreamForge
        </h1>
        <div className={`px-4 py-2 rounded-full font-semibold text-sm uppercase tracking-wider border shadow-sm ${
          isRunning 
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/50" 
            : "bg-red-500/20 text-red-300 border-red-500/50"
        }`}>
          {isRunning ? "Streaming" : "Stopped"}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Config Panel */}
        <div className="bg-slate-800/70 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold text-slate-100">Stream Configuration</h2>
            <div className="flex gap-2 items-center">
              <select 
                value={selectedProfile}
                onChange={(e) => loadProfile(e.target.value)}
                className="bg-slate-900/80 border border-white/10 rounded-lg p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-48"
                disabled={isRunning}
              >
                <option value="">-- Select Profile --</option>
                {Object.keys(profiles).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button onClick={saveProfile} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors" title="Save Profile">
                <Save size={18} />
              </button>
              <button onClick={deleteProfile} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors" title="Delete Profile">
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">Source (RTSP/RTMP or Local File)</label>
            <input 
              disabled={isRunning}
              value={source} onChange={(e) => setSource(e.target.value)}
              className="bg-slate-900/80 border border-white/10 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-full transition-all disabled:opacity-50"
              placeholder="rtsp://192.168.1.100:554/stream" 
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">Destination 1 (YouTube/Twitch RTMP + Key)</label>
            <input 
              disabled={isRunning}
              value={destination} onChange={(e) => setDestination(e.target.value)}
              className="bg-slate-900/80 border border-white/10 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-full transition-all disabled:opacity-50"
              placeholder="rtmp://a.rtmp.youtube.com/live2/XXXX-XXXX-XXXX-XXXX" 
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">Destination 2 (Optional Multi-stream)</label>
            <input 
              disabled={isRunning}
              value={destination2} onChange={(e) => setDestination2(e.target.value)}
              className="bg-slate-900/80 border border-white/10 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-full transition-all disabled:opacity-50"
              placeholder="rtmp://twitch.tv/app/XXXXX..." 
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Hardware Encoder</label>
              <select disabled={isRunning} value={encoder} onChange={(e) => setEncoder(e.target.value)} className="bg-slate-900/80 border border-white/10 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:opacity-50">
                <option value="libx264">CPU (x264)</option>
                <option value="h264_nvenc">NVIDIA (NVENC)</option>
                <option value="h264_qsv">Intel (QuickSync)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Resolution</label>
              <select disabled={isRunning} value={resolution} onChange={(e) => setResolution(e.target.value)} className="bg-slate-900/80 border border-white/10 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:opacity-50">
                <option value="original">Original</option>
                <option value="1920x1080">1080p (FHD)</option>
                <option value="1280x720">720p (HD)</option>
                <option value="854x480">480p (SD)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">FPS</label>
              <select disabled={isRunning} value={fps} onChange={(e) => setFps(e.target.value)} className="bg-slate-900/80 border border-white/10 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:opacity-50">
                <option value="30">30</option>
                <option value="60">60</option>
                <option value="24">24</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Video Bitrate</label>
              <select disabled={isRunning} value={vbitrate} onChange={(e) => setVbitrate(e.target.value)} className="bg-slate-900/80 border border-white/10 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:opacity-50">
                <option value="2500k">2500 kbps (720p)</option>
                <option value="4500k">4500 kbps (1080p30)</option>
                <option value="6000k">6000 kbps (1080p60)</option>
                <option value="9000k">9000 kbps (High)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Audio Bitrate</label>
              <select disabled={isRunning} value={abitrate} onChange={(e) => setAbitrate(e.target.value)} className="bg-slate-900/80 border border-white/10 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:opacity-50">
                <option value="128k">128 kbps</option>
                <option value="160k">160 kbps</option>
                <option value="192k">192 kbps</option>
                <option value="320k">320 kbps</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Audio Delay (ms)</label>
              <input 
                type="number" disabled={isRunning}
                value={audioDelay} onChange={(e) => setAudioDelay(e.target.value)}
                className="bg-slate-900/80 border border-white/10 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 mt-2 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Watermark Image Path (Optional)</label>
              <input 
                disabled={isRunning}
                value={watermark} onChange={(e) => setWatermark(e.target.value)}
                className="bg-slate-900/80 border border-white/10 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                placeholder="/path/to/logo.png" 
              />
            </div>
            
            <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
              <input 
                type="checkbox" disabled={isRunning}
                checked={recordLocal} onChange={(e) => setRecordLocal(e.target.checked)}
                className="w-5 h-5 rounded bg-slate-900 border-white/10 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800 cursor-pointer"
              />
              Record Locally while Streaming
            </label>

            {recordLocal && (
              <div className="flex flex-col gap-1">
                <label className="text-sm text-slate-400">Local Recording Path (.mp4)</label>
                <input 
                  disabled={isRunning}
                  value={recordPath} onChange={(e) => setRecordPath(e.target.value)}
                  className="bg-slate-900/80 border border-white/10 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                  placeholder="/home/user/Videos/stream_record.mp4" 
                />
              </div>
            )}
          </div>

          <div className="flex gap-4 mt-4">
            <button 
              onClick={startStream} disabled={isRunning}
              className="flex-1 flex justify-center items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-1"
            >
              <Play size={20} />
              Start Stream
            </button>
            <button 
              onClick={stopStream} disabled={!isRunning}
              className="flex-1 flex justify-center items-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-red-500/30 transition-all hover:-translate-y-1"
            >
              <Square size={20} />
              Stop Stream
            </button>
          </div>
        </div>

        {/* Console Panel */}
        <div className="bg-slate-800/70 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl flex flex-col gap-4 h-full">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-100">FFmpeg Log Output</h2>
            <button 
              onClick={() => setLogs([])}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Eraser size={16} />
              Clear
            </button>
          </div>
          <div 
            ref={consoleRef}
            className="flex-1 bg-slate-950 border border-white/10 rounded-xl p-4 font-mono text-xs md:text-sm text-emerald-300 overflow-y-auto whitespace-pre-wrap break-all min-h-[400px] max-h-[700px]"
          >
            {logs.map((log, index) => (
              <span key={index}>{log}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
