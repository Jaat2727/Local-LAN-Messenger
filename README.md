# Local-LAN-Messenger 🚀

A real-time LAN messenger with WhatsApp-style features including **voice/video calling**, file sharing, and rigorous security for local networks.

![Chatter FilePro](https://via.placeholder.com/800x400?text=Chatter+FilePro+Preview)

## 🌟 Features

- **📱 Cross-Platform**: Works on Windows, macOS, Linux, Android, and iOS.
- **💬 Real-time Messaging**: Instant text messaging via WebSockets.
- **📞 Voice & Video Calls**: High-quality WebRTC calls functionality.
- **file_sharing**: Drag & drop file sharing (Images, Videos, Docs).
- **🔒 Secure**: Automatic self-signed SSL certificate generation for HTTPS.
- **🎨 Modern UI**: WhatsApp-inspired dark theme with responsive design.
- **🔍 Search**: Built-in message search and media gallery.

---

## 🚀 Quick Start

### 🪟 Windows

1.  **Install Python**: Ensure Python 3.8+ is installed from [python.org](https://www.python.org/).
2.  **Install Dependencies**:
    Double-click `install_dependencies.bat`
3.  **Run Application**:
    - **HTTP (Local Only)**: Double-click `start_server.bat`
    - **HTTPS (Network/Mobile)**: Double-click `start_https_server.bat` (Recommended for calls)

> Windows scripts are also organized in `scripts/windows/` for easier maintenance.

### 🍎 macOS / 🐧 Linux

1.  **Open Terminal** in the project folder (or just double-click the files on macOS).
2.  **Run Setup Script**:
    - **HTTP**: Double-click `start_server_mac.command`
    - **HTTPS**: Double-click `start_https_server_mac.command`

> Unix scripts are also organized in `scripts/unix/` (`start_server.sh`, `start_https_server.sh`).

    _Note: If you can't double-click, run `chmod +x _.command` in terminal first.\*

---

## 📡 Accessing the App

Once the server is running, use the links provided in the terminal.

The launch scripts automatically detect your **current active network IP** and print a shareable LAN URL with the configured port.

| Mode                | URL Format              | Features Support                          |
| ------------------- | ----------------------- | ----------------------------------------- |
| **Local**           | `http://localhost:8000` | Chat, Files (No Camera/Mic)               |
| **Network (HTTPS)** | `https://YOUR_IP:8000`  | **Full Feature Set** (Calls, Camera, Mic) |

> **⚠️ Important**: When accessing via HTTPS on mobile or other PCs, you will see a browser security warning because the certificate is self-signed. Click **"Advanced" -> "Proceed to site"** (Chrome) or **"Accept Risk"** (Firefox) to continue. This is safe for local networks.

---

## 🛠️ Project Structure

- `main.py`: Main FastAPI backend application.
- `index.html`: Frontend markup shell.
- `static/css/app.css`: Main frontend styles.
- `static/js/app.js`: Main frontend behavior and WebRTC/call logic.
- `requirements.txt`: Python dependencies.
- `start_server.bat`: Windows HTTP launcher entrypoint.
- `start_https_server.bat`: Windows HTTPS launcher entrypoint.
- `start_server_mac.command`: macOS/Linux HTTP launcher entrypoint.
- `start_https_server_mac.command`: macOS/Linux HTTPS launcher entrypoint.
- `scripts/windows/`: Platform-specific Windows startup scripts.
- `scripts/unix/`: Platform-specific Unix startup scripts.
- `uploaded_media/`: Stores shared files.
- `chatter.db`: SQLite database for messages and users.

## 🗂️ Upload Storage Organization

The server now keeps uploads in organized folders under `data/`:

- Media root: `data/media/`
  - `images/`, `videos/`, `files/`, `voice/`
- Thumbnails root: `data/thumbnails/images/`

`main.py` automatically:

1. Creates the folder structure on startup.
2. Migrates old files from `uploaded_media/` and `uploaded_thumbnails/` if present.
3. Normalizes old DB message paths to the new organized format.

This keeps server files clean and easier to manage while preserving existing data.

## 🤝 Contributing

1.  (Optional) If you have initialized this repo yourself:
    ```bash
    git push -u origin main
    ```
2.  Fork the repository.
3.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
4.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
5.  Push to the branch (`git push origin feature/AmazingFeature`).
6.  Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
