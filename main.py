import sqlite3
import json
import os
import shutil
import uuid
import asyncio
import aiofiles
import hashlib
import secrets
import logging
import sys
import psutil
from datetime import datetime, timedelta
from typing import Dict, List, Set, Optional
from collections import defaultdict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Response, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from contextlib import contextmanager
import io

# ===== BEGINNER-FRIENDLY TERMINAL LOGGING =====
# This makes the terminal output easy to understand for everyone!

class ChatLogger:
    """Colorful, emoji-enhanced logging for the chat server.
    
    Makes terminal output friendly and easy to understand:
    - Green = Good things (success, connections)
    - Yellow = Info/warnings  
    - Red = Errors
    - Blue = General info
    - Purple = Calls
    """
    
    # Windows console colors (ANSI codes)
    COLORS = {
        'green': '\033[92m',
        'yellow': '\033[93m',
        'red': '\033[91m',
        'blue': '\033[94m',
        'purple': '\033[95m',
        'cyan': '\033[96m',
        'white': '\033[97m',
        'bold': '\033[1m',
        'reset': '\033[0m'
    }
    
    @staticmethod
    def _time():
        return datetime.now().strftime("%H:%M:%S")
    
    @classmethod
    def _print(cls, emoji, message, color='white', explanation=''):
        """Print a colorful log message with optional explanation."""
        c = cls.COLORS.get(color, cls.COLORS['white'])
        r = cls.COLORS['reset']
        time_str = cls._time()
        
        # Main message
        print(f"{c}[{time_str}] {emoji} {message}{r}")
        
        # Explanation for noobs (in lighter color)
        if explanation:
            print(f"         └─ {cls.COLORS['cyan']}ℹ️  {explanation}{r}")
    
    # === CONNECTION EVENTS ===
    @classmethod
    def user_connected(cls, username):
        cls._print("👋", f"User '{username}' joined the chat!", 'green',
                   "Someone opened the app and logged in successfully")
    
    @classmethod
    def user_disconnected(cls, username):
        cls._print("👋", f"User '{username}' left the chat", 'yellow',
                   "They closed the browser or lost connection")
    
    @classmethod
    def new_user_registered(cls, username):
        cls._print("🆕", f"New user registered: '{username}'", 'green',
                   "First time login - account created automatically")
    
    @classmethod
    def login_failed(cls, username, reason):
        cls._print("🔒", f"Login failed for '{username}': {reason}", 'red',
                   "Wrong password or other authentication error")
    
    # === MESSAGE EVENTS ===
    @classmethod
    def message_sent(cls, username, msg_type):
        type_emoji = {'text': '💬', 'image': '🖼️', 'video': '🎬', 'file': '📎', 'voice': '🎤'}
        emoji = type_emoji.get(msg_type, '📨')
        cls._print(emoji, f"{username} sent a {msg_type} message", 'blue')
    
    @classmethod
    def message_edited(cls, username):
        cls._print("✏️", f"{username} edited their message", 'blue',
                   "Users can edit messages within 10 minutes")
    
    @classmethod
    def message_deleted(cls, username, count):
        cls._print("🗑️", f"{username} deleted {count} message(s)", 'yellow')
    
    # === FILE EVENTS ===
    @classmethod
    def file_uploaded(cls, filename, size_mb, file_type):
        cls._print("📤", f"File uploaded: {filename} ({size_mb:.2f} MB) [{file_type}]", 'green',
                   "File saved to server and ready to share")
    
    @classmethod
    def file_deleted(cls, filename):
        cls._print("🗑️", f"File deleted: {filename}", 'yellow',
                   "Media file removed from server storage")
    
    @classmethod
    def upload_failed(cls, filename, error):
        cls._print("❌", f"Upload failed: {filename} - {error}", 'red',
                   "Check file size (max 100MB) and type")
    
    @classmethod
    def thumbnail_created(cls, filename):
        cls._print("🖼️", f"Thumbnail created for: {filename}", 'cyan')
    
    # === CALL EVENTS ===
    @classmethod
    def call_started(cls, caller, callee, call_type):
        emoji = "📹" if call_type == "video" else "📞"
        cls._print(emoji, f"{caller} is calling {callee} ({call_type} call)", 'purple',
                   "WebRTC call initiated - waiting for answer")
    
    @classmethod
    def call_accepted(cls, user):
        cls._print("✅", f"{user} accepted the call", 'green',
                   "Call connected! Audio/video streaming started")
    
    @classmethod
    def call_rejected(cls, user):
        cls._print("❌", f"{user} declined the call", 'yellow')
    
    @classmethod
    def call_ended(cls, user):
        cls._print("📴", f"Call ended by {user}", 'yellow',
                   "Call cleaned up properly")
    
    @classmethod
    def webrtc_signal(cls, signal_type, from_user, to_user):
        cls._print("🔗", f"WebRTC {signal_type}: {from_user} → {to_user}", 'cyan',
                   "Connection negotiation in progress")
    
    # === SERVER EVENTS ===
    @classmethod
    def server_starting(cls):
        cls._print("🚀", "Local-LAN-Messenger Server Starting...", 'green')
    
    @classmethod
    def server_ready(cls, http_url, https_url=None):
        print("")
        print(f"{cls.COLORS['green']}{'='*50}{cls.COLORS['reset']}")
        print(f"{cls.COLORS['bold']}{cls.COLORS['green']}  ✓ SERVER IS READY!{cls.COLORS['reset']}")
        print(f"{cls.COLORS['green']}{'='*50}{cls.COLORS['reset']}")
        print("")
        print(f"  {cls.COLORS['cyan']}📍 Access your chat at:{cls.COLORS['reset']}")
        print(f"     {cls.COLORS['white']}{http_url}{cls.COLORS['reset']}")
        if https_url:
            print(f"     {cls.COLORS['white']}{https_url}{cls.COLORS['reset']}")
        print("")
        print(f"  {cls.COLORS['yellow']}💡 Share the URL with friends to chat!{cls.COLORS['reset']}")
        print(f"  {cls.COLORS['yellow']}💡 Press Ctrl+C to stop the server{cls.COLORS['reset']}")
        print("")
        print(f"{cls.COLORS['green']}{'='*50}{cls.COLORS['reset']}")
        print("")
        print(f"{cls.COLORS['cyan']}📊 Live Activity Log (what's happening):{cls.COLORS['reset']}")
        print(f"{cls.COLORS['cyan']}{'─'*50}{cls.COLORS['reset']}")
    
    @classmethod
    def error(cls, message, detail=''):
        cls._print("❌", f"Error: {message}", 'red', detail)
    
    @classmethod
    def warning(cls, message):
        cls._print("⚠️", message, 'yellow')
    
    @classmethod
    def info(cls, message):
        cls._print("ℹ️", message, 'blue')
    
    @classmethod
    def reaction_added(cls, username, emoji):
        cls._print("😊", f"{username} reacted with {emoji}", 'blue')
    
    @classmethod
    def typing_indicator(cls, username, is_typing):
        if is_typing:
            cls._print("⌨️", f"{username} is typing...", 'cyan')


# === SYSTEM MONITORING ===
class HardwareMonitor:
    def __init__(self, log_interval=60):
        self.log_interval = log_interval
        self.running = False
        self._last_net_io = psutil.net_io_counters()

    async def start(self):
        self.running = True
        asyncio.create_task(self._monitor_loop())
        log.info("System monitoring started (Stats in window title)")

    async def _monitor_loop(self):
        while self.running:
            try:
                # 1. Get Stats
                cpu_percent = psutil.cpu_percent(interval=None)
                ram = psutil.virtual_memory()
                
                # Network Speed Calculation
                current_net_io = psutil.net_io_counters()
                bytes_sent = current_net_io.bytes_sent - self._last_net_io.bytes_sent
                bytes_recv = current_net_io.bytes_recv - self._last_net_io.bytes_recv
                self._last_net_io = current_net_io
                
                # Format Network Speed
                upload_speed = self._format_bytes(bytes_sent)
                download_speed = self._format_bytes(bytes_recv)

                # 2. Update Console Title (Real-time view)
                if sys.platform == 'win32':
                    title = f"Local-LAN-Messenger | CPU: {cpu_percent}% | RAM: {ram.percent}% | Net: ↓{download_speed}/s ↑{upload_speed}/s"
                    ctypes.windll.kernel32.SetConsoleTitleW(title)
                else:
                    # macOS / Linux / Unix - Use ANSI Escape Sequence
                    title = f"Local-LAN-Messenger | CPU: {cpu_percent}% | RAM: {ram.percent}% | Net: ↓{download_speed}/s ↑{upload_speed}/s"
                    sys.stdout.write(f"\x1b]2;{title}\x07")
                    sys.stdout.flush()

                # 3. Periodic Logging (Every log_interval seconds)
                # We use a simple counter or checking timestamp usually, 
                # but here we just sleep 1s. So we log every Nth iteration.
                # To keep it simple, let's just use a separate task or check time.
                # For now, let's just log if second % 60 == 0 roughly
                now = datetime.now()
                if now.second == 0:  # Log once a minute
                   log._print("📊", f"System Load: CPU {cpu_percent}% | RAM {ram.percent}% | Net ↓{download_speed}/s ↑{upload_speed}/s", 'purple')

                await asyncio.sleep(1)
            except Exception as e:
                print(f"Monitor Error: {e}")
                await asyncio.sleep(5)

    def _format_bytes(self, size):
        power = 2**10
        n = 0
        power_labels = {0 : '', 1: 'K', 2: 'M', 3: 'G', 4: 'T'}
        while size > power:
            size /= power
            n += 1
        return f"{size:.1f}{power_labels.get(n, '')}B"

monitor = HardwareMonitor()

# Create global logger instance
log = ChatLogger()

# Enable Windows ANSI color support
if sys.platform == 'win32':
    # Enable ANSI escape sequences on Windows 10+
    import ctypes
    kernel32 = ctypes.windll.kernel32
    kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)

# Suppress noisy Windows asyncio errors (ConnectionResetError on socket shutdown)
if sys.platform == 'win32':
    # Custom exception handler to silence connection reset errors
    def windows_exception_handler(loop, context):
        exception = context.get('exception')
        if isinstance(exception, ConnectionResetError):
            # Silently ignore - this is normal when clients disconnect
            return
        if isinstance(exception, OSError) and getattr(exception, 'winerror', None) == 10054:
            # Ignore WinError 10054 (connection forcibly closed)
            return
        # For other exceptions, use default handler
        loop.default_exception_handler(context)
    
    # Apply the custom handler when event loop is available
    try:
        loop = asyncio.get_event_loop()
        loop.set_exception_handler(windows_exception_handler)
    except RuntimeError:
        pass  # No event loop yet, will be set later

# Configure logging to reduce noise from uvicorn
logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

app = FastAPI()

# Add CORS middleware for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add GZip compression for faster transfers
app.add_middleware(GZipMiddleware, minimum_size=500)

# --- RATE LIMITING ---
class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[datetime]] = defaultdict(list)
    
    def is_allowed(self, client_ip: str) -> bool:
        now = datetime.now()
        cutoff = now - timedelta(seconds=self.window_seconds)
        
        # Clean old requests
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip] 
            if req_time > cutoff
        ]
        
        if len(self.requests[client_ip]) >= self.max_requests:
            return False
        
        self.requests[client_ip].append(now)
        return True

rate_limiter = RateLimiter(max_requests=200, window_seconds=60)

# --- SECURITY HEADERS MIDDLEWARE ---
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Allow camera/microphone for WebRTC
        response.headers["Permissions-Policy"] = "camera=*, microphone=*, fullscreen=*"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# --- SETUP FOLDERS ---
DATA_DIR = "data"
MEDIA_DIR = os.path.join(DATA_DIR, "media")
THUMB_DIR = os.path.join(DATA_DIR, "thumbnails")

MEDIA_SUBDIRS = {
    "image": "images",
    "video": "videos",
    "file": "files",
    "voice": "voice",
}

os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(THUMB_DIR, exist_ok=True)
for subdir in MEDIA_SUBDIRS.values():
    os.makedirs(os.path.join(MEDIA_DIR, subdir), exist_ok=True)
os.makedirs(os.path.join(THUMB_DIR, MEDIA_SUBDIRS["image"]), exist_ok=True)


def migrate_legacy_upload_folders():
    """Move old flat upload folders into new organized data structure."""
    legacy_media_dir = "uploaded_media"
    legacy_thumb_dir = "uploaded_thumbnails"

    if os.path.isdir(legacy_media_dir):
        for item in os.listdir(legacy_media_dir):
            src = os.path.join(legacy_media_dir, item)
            if not os.path.isfile(src):
                continue

            ext = item.rsplit(".", 1)[-1].lower() if "." in item else ""
            if ext in ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"]:
                bucket = MEDIA_SUBDIRS["image"]
            elif ext in ["mp4", "webm", "mov", "avi", "mkv"]:
                bucket = MEDIA_SUBDIRS["video"]
            elif ext in ["webm", "ogg", "mp3", "wav", "m4a"]:
                bucket = MEDIA_SUBDIRS["voice"]
            else:
                bucket = MEDIA_SUBDIRS["file"]

            dst = os.path.join(MEDIA_DIR, bucket, item)
            if not os.path.exists(dst):
                shutil.move(src, dst)

    if os.path.isdir(legacy_thumb_dir):
        thumb_image_dir = os.path.join(THUMB_DIR, MEDIA_SUBDIRS["image"])
        os.makedirs(thumb_image_dir, exist_ok=True)
        for item in os.listdir(legacy_thumb_dir):
            src = os.path.join(legacy_thumb_dir, item)
            if not os.path.isfile(src):
                continue
            dst = os.path.join(thumb_image_dir, item)
            if not os.path.exists(dst):
                shutil.move(src, dst)


def media_disk_path(relative_path: str) -> str:
    return os.path.join(MEDIA_DIR, relative_path)


def thumb_disk_path(relative_path: str) -> str:
    return os.path.join(THUMB_DIR, relative_path)


def media_exists(relative_path: str) -> bool:
    if os.path.exists(media_disk_path(relative_path)):
        return True
    legacy_path = os.path.join("uploaded_media", os.path.basename(relative_path))
    return os.path.exists(legacy_path)


def thumb_exists(relative_path: str) -> bool:
    if os.path.exists(thumb_disk_path(relative_path)):
        return True
    legacy_path = os.path.join("uploaded_thumbnails", os.path.basename(relative_path))
    return os.path.exists(legacy_path)


def normalize_media_key(stored: str, msg_type: str = "file") -> str:
    """Normalize DB media keys to organized path format: <bucket>/<filename>."""
    if "/" in stored:
        return stored

    if msg_type in MEDIA_SUBDIRS:
        bucket = MEDIA_SUBDIRS[msg_type]
    elif msg_type == "image":
        bucket = MEDIA_SUBDIRS["image"]
    elif msg_type == "video":
        bucket = MEDIA_SUBDIRS["video"]
    elif msg_type == "voice":
        bucket = MEDIA_SUBDIRS["voice"]
    else:
        bucket = MEDIA_SUBDIRS["file"]

    return f"{bucket}/{stored}"


def list_files_recursive(base_dir: str) -> List[str]:
    paths: List[str] = []
    for root, _, files in os.walk(base_dir):
        for name in files:
            if name.startswith("."):
                continue
            full = os.path.join(root, name)
            paths.append(os.path.relpath(full, base_dir).replace("\\", "/"))
    return paths


migrate_legacy_upload_folders()

app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")
app.mount("/thumbs", StaticFiles(directory=THUMB_DIR), name="thumbs")
app.mount("/static", StaticFiles(directory="static"), name="static")

DB_NAME = "chatter.db"

# Optimized chunk size for faster uploads (2MB)
CHUNK_SIZE = 2 * 1024 * 1024

# --- Database Connection Pool ---
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_NAME, timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS users 
                     (username TEXT PRIMARY KEY, password TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS messages 
                     (id TEXT PRIMARY KEY, username TEXT, message TEXT, type TEXT, 
                      timestamp TEXT, reply_to TEXT, read_by TEXT DEFAULT '[]',
                      file_size INTEGER DEFAULT 0, original_name TEXT, reactions TEXT DEFAULT '{}')''')
        
        # Add new columns if they don't exist (migration)
        try:
            c.execute("ALTER TABLE messages ADD COLUMN reply_to TEXT")
        except:
            pass
        try:
            c.execute("ALTER TABLE messages ADD COLUMN read_by TEXT DEFAULT '[]'")
        except:
            pass
        try:
            c.execute("ALTER TABLE messages ADD COLUMN file_size INTEGER DEFAULT 0")
        except:
            pass
        try:
            c.execute("ALTER TABLE messages ADD COLUMN original_name TEXT")
        except:
            pass
        try:
            c.execute("ALTER TABLE messages ADD COLUMN reactions TEXT DEFAULT '{}'")
        except:
            pass
        
        conn.commit()

init_db()


def migrate_media_message_paths():
    """Normalize stored media keys in DB from flat filename to bucket/filename."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT id, message, type FROM messages WHERE type IN ('image', 'video', 'file', 'voice')")
        rows = c.fetchall()

        for row in rows:
            current_message = row["message"]
            normalized = normalize_media_key(current_message, row["type"])
            if normalized != current_message:
                c.execute("UPDATE messages SET message=? WHERE id=?", (normalized, row["id"]))

        conn.commit()


migrate_media_message_paths()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[WebSocket, str] = {}
        self.typing_users: Set[str] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, username: str):
        async with self._lock:
            self.active_connections[websocket] = username

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                del self.active_connections[websocket]

    def get_online_users(self) -> List[str]:
        return list(set(self.active_connections.values()))

    async def broadcast(self, message_data: dict, exclude: WebSocket = None):
        disconnected = []
        for connection in list(self.active_connections.keys()):
            if connection != exclude:
                try:
                    await connection.send_json(message_data)
                except Exception:
                    disconnected.append(connection)
        
        # Clean up disconnected clients
        for conn in disconnected:
            await self.disconnect(conn)

    async def broadcast_to_all(self, message_data: dict):
        disconnected = []
        for connection in list(self.active_connections.keys()):
            try:
                await connection.send_json(message_data)
            except Exception:
                disconnected.append(connection)
        
        for conn in disconnected:
            await self.disconnect(conn)

manager = ConnectionManager()

@app.get("/")
async def get():
    async with aiofiles.open("index.html", "r", encoding="utf-8") as f:
        content = await f.read()
    return HTMLResponse(content=content)

@app.get("/call")
async def get_call_page():
    """Serve the dedicated call screen for popup/separate window calls"""
    if os.path.exists("call.html"):
        async with aiofiles.open("call.html", "r", encoding="utf-8") as f:
            content = await f.read()
        return HTMLResponse(content=content)
    else:
        return HTMLResponse(content="<h1>Call page not found</h1>", status_code=404)

@app.get("/favicon.ico")
async def favicon():
    """Return empty favicon to prevent 404 errors in logs"""
    return Response(status_code=204)

@app.on_event("startup")
async def startup_event():
    """Set up Windows exception handler on startup"""
    if sys.platform == 'win32':
        loop = asyncio.get_event_loop()
        loop.set_exception_handler(windows_exception_handler)
    
    # Start hardware monitoring
    await monitor.start()

# File upload constraints for security
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {
    'image': ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'],
    'video': ['mp4', 'webm', 'mov', 'avi', 'mkv'],
    'document': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'],
    'archive': ['zip', 'rar', '7z', 'tar', 'gz']
}
ALL_ALLOWED_EXTENSIONS = set()
for exts in ALLOWED_EXTENSIONS.values():
    ALL_ALLOWED_EXTENSIONS.update(exts)

# --- OPTIMIZED MULTI-FILE UPLOAD WITH STREAMING ---
@app.post("/upload")
async def upload_files(request: Request, files: List[UploadFile] = File(...)):
    # Rate limiting check
    client_ip = request.client.host if request.client else "unknown"
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")
    
    uploaded_results = []
    thumbnail_tasks = []
    
    for file in files:
        try:
            # Validate file extension
            file_extension = file.filename.split(".")[-1].lower() if "." in file.filename else ""
            if file_extension not in ALL_ALLOWED_EXTENSIONS:
                print(f"Rejected file with extension: {file_extension}")
                continue
            
            unique_name = f"{uuid.uuid4()}.{file_extension}"
            if (file.content_type or "").startswith("audio/"):
                file_type = "voice"
            elif (file.content_type or "").startswith("image/"):
                file_type = "image"
            elif (file.content_type or "").startswith("video/"):
                file_type = "video"
            else:
                file_type = 'image' if file_extension in ['jpg', 'jpeg', 'png', 'webp', 'gif'] else ('video' if file_extension in ['mp4', 'webm', 'mov'] else 'file')
            media_key = normalize_media_key(unique_name, file_type)
            file_path = media_disk_path(media_key)
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            # Stream file to disk in chunks for better performance
            file_size = 0
            async with aiofiles.open(file_path, "wb") as buffer:
                while True:
                    chunk = await file.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    file_size += len(chunk)
                    
                    # Check file size limit
                    if file_size > MAX_FILE_SIZE:
                        await buffer.close()
                        os.remove(file_path)
                        raise HTTPException(status_code=413, detail=f"File too large. Max size is {MAX_FILE_SIZE // (1024*1024)}MB")
                    
                    await buffer.write(chunk)
            
            # Queue thumbnail generation (will be processed in parallel)
            thumb_task = None
            if file_extension in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
                loop = asyncio.get_event_loop()
                thumb_task = loop.run_in_executor(None, generate_thumbnail, file_path, media_key)
                thumbnail_tasks.append((len(uploaded_results), thumb_task))
            
            # Log successful upload
            log.file_uploaded(file.filename, file_size / (1024 * 1024), file_type)
            
            uploaded_results.append({
                "filename": media_key,
                "original_name": file.filename,
                "ext": file_extension,
                "size": file_size,
                "has_thumb": False  # Will be updated after parallel processing
            })
        except HTTPException:
            raise
        except Exception as e:
            log.upload_failed(file.filename, str(e))
            continue
    
    # Process all thumbnail generations in parallel
    if thumbnail_tasks:
        try:
            results = await asyncio.gather(*[task for _, task in thumbnail_tasks], return_exceptions=True)
            for i, (result_idx, _) in enumerate(thumbnail_tasks):
                if not isinstance(results[i], Exception) and results[i]:
                    uploaded_results[result_idx]["has_thumb"] = True
                    log.thumbnail_created(uploaded_results[result_idx]["filename"])
        except Exception as e:
            log.error("Thumbnail batch processing failed", str(e))
            
    return {"files": uploaded_results}

def generate_thumbnail(file_path: str, media_key: str) -> bool:
    """Generate thumbnail for image files"""
    try:
        img = Image.open(file_path)
        # Convert to RGB if necessary (for PNG with alpha)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        img.thumbnail((300, 300), Image.Resampling.LANCZOS)
        thumb_path = thumb_disk_path(media_key)
        os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
        img.save(thumb_path, quality=85, optimize=True)
        return True
    except Exception as e:
        print(f"Thumbnail error: {e}")
        return False

# --- MEDIA GALLERY API ---
@app.get("/api/media")
async def get_media_gallery(
    media_type: Optional[str] = None,
    sort: str = "newest"
):
    """Get all media files for gallery view, sorted by date"""
    with get_db() as conn:
        c = conn.cursor()
        
        query = """SELECT id, username, message, type, timestamp, file_size, original_name 
                   FROM messages WHERE type IN ('image', 'video', 'file')"""
        params = []
        
        if media_type and media_type != 'all':
            query += " AND type = ?"
            params.append(media_type)
        
        order = "DESC" if sort == "newest" else "ASC"
        query += f" ORDER BY timestamp {order}"
        
        c.execute(query, params)
        rows = c.fetchall()
        
        media_items = []
        for row in rows:
            media_key = normalize_media_key(row['message'], row['type'])
            if not media_exists(media_key):
                continue

            has_thumb = thumb_exists(media_key)
            media_items.append({
                "id": row['id'],
                "user": row['username'],
                "filename": media_key,
                "type": row['type'],
                "timestamp": row['timestamp'],
                "size": row['file_size'] or 0,
                "original_name": row['original_name'] or os.path.basename(media_key),
                "has_thumb": has_thumb,
                "media_url": f"/media/{media_key}",
                "thumb_url": f"/thumbs/{media_key}" if has_thumb else None
            })
        
        return {"media": media_items, "total": len(media_items)}

# --- CLEANUP ORPHAN FILES ---
@app.post("/api/cleanup-orphans")
async def cleanup_orphan_files():
    """Remove files that exist on disk but not in database"""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT message, type FROM messages WHERE type IN ('image', 'video', 'file', 'voice')")
        db_files = set(normalize_media_key(row[0], row[1]) for row in c.fetchall())
    
    cleaned_media = 0
    cleaned_thumbs = 0
    
    # Clean orphan media files
    for filename in list_files_recursive(MEDIA_DIR):
        if filename not in db_files:
            try:
                os.remove(media_disk_path(filename))
                cleaned_media += 1
            except Exception as e:
                print(f"Error removing media {filename}: {e}")
    
    # Clean orphan thumbnails
    for filename in list_files_recursive(THUMB_DIR):
        if filename not in db_files:
            try:
                os.remove(thumb_disk_path(filename))
                cleaned_thumbs += 1
            except Exception as e:
                print(f"Error removing thumbnail {filename}: {e}")
    
    return {
        "status": "success",
        "cleaned_media": cleaned_media,
        "cleaned_thumbs": cleaned_thumbs
    }

# --- GET STORAGE STATS ---
@app.get("/api/storage-stats")
async def get_storage_stats():
    """Get storage usage statistics"""
    def get_folder_size(folder):
        total = 0
        for filename in list_files_recursive(folder):
            filepath = os.path.join(folder, filename)
            if os.path.isfile(filepath):
                total += os.path.getsize(filepath)
        return total
    
    media_size = get_folder_size(MEDIA_DIR)
    thumb_size = get_folder_size(THUMB_DIR)
    media_count = len(list_files_recursive(MEDIA_DIR))
    thumb_count = len(list_files_recursive(THUMB_DIR))
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM messages WHERE type IN ('image', 'video', 'file', 'voice')")
        db_count = c.fetchone()[0]
    
    return {
        "media_size_bytes": media_size,
        "thumb_size_bytes": thumb_size,
        "media_count": media_count,
        "thumb_count": thumb_count,
        "db_media_count": db_count,
        "orphan_files": media_count - db_count if media_count > db_count else 0
    }

def delete_media_files(filename: str, msg_type: str = "file"):
    """Safely delete media and thumbnail files"""
    media_key = normalize_media_key(filename, msg_type)
    media_path = media_disk_path(media_key)
    thumb_path = thumb_disk_path(media_key)
    
    try:
        if os.path.exists(media_path):
            os.remove(media_path)
            log.file_deleted(filename)
    except Exception as e:
        log.error(f"Could not delete media {filename}", str(e))
    
    try:
        if os.path.exists(thumb_path):
            os.remove(thumb_path)
    except Exception as e:
        log.error(f"Could not delete thumbnail {filename}", str(e))

    # Backward compatibility for old flat folders
    try:
        legacy_media = os.path.join("uploaded_media", os.path.basename(filename))
        if os.path.exists(legacy_media):
            os.remove(legacy_media)
    except Exception:
        pass

    try:
        legacy_thumb = os.path.join("uploaded_thumbnails", os.path.basename(filename))
        if os.path.exists(legacy_thumb):
            os.remove(legacy_thumb)
    except Exception:
        pass

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    current_username = None
    current_password = None
    
    try:
        data = await websocket.receive_text()
        login_data = json.loads(data)
        username = login_data['username'].strip()
        password = login_data['password']
        
        if not username:
            await websocket.send_json({"type": "error", "msg": "Username cannot be empty!"})
            await websocket.close()
            return
        
        try:
            with get_db() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM users WHERE username=?", (username,))
                user_record = c.fetchone()
                
                if user_record and user_record['password'] != password:
                    log.login_failed(username, "Wrong password")
                    await websocket.send_json({"type": "error", "msg": "Wrong Password!"})
                    await websocket.close()
                    return
                elif not user_record:
                    c.execute("INSERT INTO users VALUES (?, ?)", (username, password))
                    conn.commit()
                    log.new_user_registered(username)
        except Exception as db_e:
            log.error(f"Database error for user {username}", str(db_e))
            await websocket.send_json({"type": "error", "msg": "Server Database Error. Please try again."})
            await websocket.close()
            return

        current_username = username
        current_password = password
        await manager.connect(websocket, username)
        log.user_connected(username)
        
        # Send login success with online users
        await websocket.send_json({
            "type": "login_success", 
            "username": username,
            "online_users": manager.get_online_users()
        })
        
        # Broadcast user joined to others
        await manager.broadcast({
            "type": "user_joined",
            "username": username,
            "online_users": manager.get_online_users()
        }, exclude=websocket)
        
        # Send chat history
        with get_db() as conn:
            c = conn.cursor()
            c.execute("""SELECT id, username, message, type, timestamp, reply_to, read_by, 
                        file_size, original_name, reactions FROM messages ORDER BY timestamp""")
            for msg in c.fetchall():
                read_by = json.loads(msg['read_by']) if msg['read_by'] else []
                reactions = json.loads(msg['reactions']) if msg['reactions'] else {}
                await websocket.send_json({
                    "type": msg['type'], 
                    "id": msg['id'], 
                    "user": msg['username'], 
                    "msg": msg['message'], 
                    "timestamp": msg['timestamp'],
                    "reply_to": msg['reply_to'], 
                    "read_by": read_by,
                    "file_size": msg['file_size'],
                    "original_name": msg['original_name'],
                    "reactions": reactions
                })

        while True:
            data_text = await websocket.receive_text()
            data_json = json.loads(data_text)
            action_type = data_json.get("type", "")
            
            # --- TYPING INDICATOR ---
            if action_type == "typing_start":
                manager.typing_users.add(username)
                await manager.broadcast({
                    "type": "typing_update",
                    "typing_users": list(manager.typing_users)
                }, exclude=websocket)
            
            elif action_type == "typing_stop":
                manager.typing_users.discard(username)
                await manager.broadcast({
                    "type": "typing_update",
                    "typing_users": list(manager.typing_users)
                }, exclude=websocket)
            
            # --- MARK MESSAGE AS READ ---
            elif action_type == "mark_read":
                msg_ids = data_json.get("ids", [])
                with get_db() as conn:
                    c = conn.cursor()
                    for msg_id in msg_ids:
                        c.execute("SELECT read_by, username FROM messages WHERE id=?", (msg_id,))
                        result = c.fetchone()
                        if result and result['username'] != username:
                            read_by = json.loads(result['read_by']) if result['read_by'] else []
                            if username not in read_by:
                                read_by.append(username)
                                c.execute("UPDATE messages SET read_by=? WHERE id=?", (json.dumps(read_by), msg_id))
                                await manager.broadcast_to_all({
                                    "type": "read_update",
                                    "id": msg_id,
                                    "read_by": read_by
                                })
                    conn.commit()
            
            # --- EDIT MESSAGE ---
            elif action_type == "edit":
                msg_id = data_json["id"]
                new_text = data_json["content"]
                with get_db() as conn:
                    c = conn.cursor()
                    c.execute("SELECT username, timestamp FROM messages WHERE id=?", (msg_id,))
                    result = c.fetchone()
                    if result and result['username'] == username:
                        msg_time = datetime.fromisoformat(result['timestamp'])
                        if datetime.now() - msg_time < timedelta(minutes=10):
                            c.execute("UPDATE messages SET message=? WHERE id=?", (new_text, msg_id))
                            conn.commit()
                            log.message_edited(username)
                            await manager.broadcast_to_all({"type": "edit_confirmed", "id": msg_id, "new_msg": new_text})
                        else:
                            await websocket.send_json({"type": "error", "msg": "Cannot edit messages older than 10 minutes"})

            # --- DELETE MESSAGES WITH PROPER FILE CLEANUP ---
            elif action_type == "delete":
                ids_to_delete = data_json["ids"]
                deleted_ids = []
                
                with get_db() as conn:
                    c = conn.cursor()
                    for msg_id in ids_to_delete:
                        c.execute("SELECT username, message, type FROM messages WHERE id=?", (msg_id,))
                        result = c.fetchone()
                        if result and result['username'] == username:
                            filename = result['message']
                            msg_type = result['type']
                            
                            # Delete associated files for media messages
                            if msg_type in ["image", "video", "file"]:
                                delete_media_files(filename, msg_type)
                            
                            c.execute("DELETE FROM messages WHERE id=?", (msg_id,))
                            deleted_ids.append(msg_id)
                    conn.commit()
                
                if deleted_ids:
                    log.message_deleted(username, len(deleted_ids))
                    await manager.broadcast_to_all({"type": "delete_confirmed", "ids": deleted_ids})

            # --- CALL SIGNALING ---
            elif action_type == "call_initiate":
                target_user = data_json.get("to")
                call_type = data_json.get("callType", "voice")
                log.call_started(username, target_user, call_type)
                # Find target user's websocket and send call notification
                for ws, user in manager.active_connections.items():
                    if user == target_user:
                        try:
                            await ws.send_json({
                                "type": "call_incoming",
                                "from": username,
                                "callType": call_type
                            })
                        except:
                            pass
                        break
            
            elif action_type == "call_accept":
                target_user = data_json.get("to")
                log.call_accepted(username)
                for ws, user in manager.active_connections.items():
                    if user == target_user:
                        try:
                            await ws.send_json({
                                "type": "call_accepted",
                                "from": username
                            })
                        except:
                            pass
                        break
            
            elif action_type == "call_reject":
                target_user = data_json.get("to")
                log.call_rejected(username)
                for ws, user in manager.active_connections.items():
                    if user == target_user:
                        try:
                            await ws.send_json({
                                "type": "call_rejected",
                                "from": username,
                                "reason": data_json.get("reason", "declined")
                            })
                        except:
                            pass
                        break
            
            elif action_type == "call_cancel":
                target_user = data_json.get("to")
                for ws, user in manager.active_connections.items():
                    if user == target_user:
                        try:
                            await ws.send_json({
                                "type": "call_cancelled",
                                "from": username
                            })
                        except:
                            pass
                        break
            
            elif action_type == "call_end":
                target_user = data_json.get("to")
                log.call_ended(username)
                for ws, user in manager.active_connections.items():
                    if user == target_user:
                        try:
                            await ws.send_json({
                                "type": "call_ended",
                                "from": username
                            })
                        except:
                            pass
                        break

            # --- WEBRTC SIGNALING ---
            elif action_type == "webrtc_offer":
                target_user = data_json.get("to")
                offer = data_json.get("offer")
                log.webrtc_signal("offer", username, target_user)
                for ws, user in manager.active_connections.items():
                    if user == target_user:
                        try:
                            await ws.send_json({
                                "type": "webrtc_offer",
                                "from": username,
                                "offer": offer
                            })
                        except:
                            pass
                        break
            
            elif action_type == "webrtc_answer":
                target_user = data_json.get("to")
                answer = data_json.get("answer")
                log.webrtc_signal("answer", username, target_user)
                for ws, user in manager.active_connections.items():
                    if user == target_user:
                        try:
                            await ws.send_json({
                                "type": "webrtc_answer",
                                "from": username,
                                "answer": answer
                            })
                        except:
                            pass
                        break
            
            elif action_type == "ice_candidate":
                target_user = data_json.get("to")
                candidate = data_json.get("candidate")
                for ws, user in manager.active_connections.items():
                    if user == target_user:
                        try:
                            await ws.send_json({
                                "type": "ice_candidate",
                                "from": username,
                                "candidate": candidate
                            })
                        except:
                            pass
                        break


            elif action_type == "ping":
                # Heartbeat to keep connection alive
                await websocket.send_json({"type": "pong"})

            # --- REACTION HANDLING ---
            elif action_type == "reaction_add":
                msg_id = data_json.get("id")
                emoji = data_json.get("emoji")
                
                with get_db() as conn:
                    c = conn.cursor()
                    c.execute("SELECT reactions FROM messages WHERE id=?", (msg_id,))
                    result = c.fetchone()
                    if result:
                        reactions = json.loads(result['reactions']) if result['reactions'] else {}
                        if emoji not in reactions:
                            reactions[emoji] = []
                        if username not in reactions[emoji]:
                            reactions[emoji].append(username)
                        c.execute("UPDATE messages SET reactions=? WHERE id=?", (json.dumps(reactions), msg_id))
                        conn.commit()
                        await manager.broadcast_to_all({
                            "type": "reaction_update",
                            "id": msg_id,
                            "reactions": reactions
                        })
            
            elif action_type == "reaction_remove":
                msg_id = data_json.get("id")
                emoji = data_json.get("emoji")
                
                with get_db() as conn:
                    c = conn.cursor()
                    c.execute("SELECT reactions FROM messages WHERE id=?", (msg_id,))
                    result = c.fetchone()
                    if result:
                        reactions = json.loads(result['reactions']) if result['reactions'] else {}
                        if emoji in reactions and username in reactions[emoji]:
                            reactions[emoji].remove(username)
                            if len(reactions[emoji]) == 0:
                                del reactions[emoji]
                        c.execute("UPDATE messages SET reactions=? WHERE id=?", (json.dumps(reactions), msg_id))
                        conn.commit()
                        await manager.broadcast_to_all({
                            "type": "reaction_update",
                            "id": msg_id,
                            "reactions": reactions
                        })

            # --- HANDLE FILE/IMAGE/VIDEO/TEXT/VOICE MESSAGES ---
            elif action_type in ["text", "image", "video", "file", "voice"]:
                msg_content = data_json["content"]
                reply_to = data_json.get("reply_to", None)
                file_size = data_json.get("file_size", 0)
                original_name = data_json.get("original_name", "")
                if action_type in ["image", "video", "file", "voice"]:
                    msg_content = normalize_media_key(msg_content, action_type)
                msg_id = str(uuid.uuid4())
                timestamp = datetime.now().isoformat()
                
                # Stop typing when sending message
                manager.typing_users.discard(username)
                
                with get_db() as conn:
                    c = conn.cursor()
                    c.execute("""INSERT INTO messages 
                                (id, username, message, type, timestamp, reply_to, read_by, file_size, original_name, reactions) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", 
                              (msg_id, username, msg_content, action_type, timestamp, reply_to, '[]', file_size, original_name, '{}'))
                    conn.commit()
                
                # Log the message
                log.message_sent(username, action_type)
                
                # Get reply content if replying
                reply_data = None
                if reply_to:
                    with get_db() as conn:
                        c = conn.cursor()
                        c.execute("SELECT username, message, type FROM messages WHERE id=?", (reply_to,))
                        reply_result = c.fetchone()
                        if reply_result:
                            reply_data = {
                                "id": reply_to,
                                "user": reply_result['username'],
                                "msg": reply_result['message'],
                                "type": reply_result['type']
                            }
                
                await manager.broadcast_to_all({
                    "type": action_type, 
                    "id": msg_id, 
                    "user": username, 
                    "msg": msg_content, 
                    "timestamp": timestamp,
                    "reply_to": reply_to, 
                    "reply_data": reply_data, 
                    "read_by": [],
                    "file_size": file_size,
                    "original_name": original_name,
                    "reactions": {}
                })

    except WebSocketDisconnect:
        if current_username:
            manager.typing_users.discard(current_username)
            log.user_disconnected(current_username)
        await manager.disconnect(websocket)
        if current_username:
            await manager.broadcast_to_all({
                "type": "user_left",
                "username": current_username,
                "online_users": manager.get_online_users()
            })
    except Exception as e:
        log.error(f"WebSocket error", str(e))
        await manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    # This block allows running 'python main.py' directly, which is what start_server_mac.command does
    # It defaults to HTTP on port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
