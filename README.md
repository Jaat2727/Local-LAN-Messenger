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

### 🍎 macOS / 🐧 Linux

1.  **Open Terminal** in the project folder.
2.  **Run Setup Script**:
    ```bash
    chmod +x run_mac.sh  # Make script executable (first time only)
    ./run_mac.sh
    ```
    This script will automatically create a virtual environment, install dependencies, and start the server.

---

## 📡 Accessing the App

Once the server is running, use the links provided in the terminal:

| Mode                | URL Format              | Features Support                          |
| ------------------- | ----------------------- | ----------------------------------------- |
| **Local**           | `http://localhost:8000` | Chat, Files (No Camera/Mic)               |
| **Network (HTTPS)** | `https://YOUR_IP:8000`  | **Full Feature Set** (Calls, Camera, Mic) |

> **⚠️ Important**: When accessing via HTTPS on mobile or other PCs, you will see a browser security warning because the certificate is self-signed. Click **"Advanced" -> "Proceed to site"** (Chrome) or **"Accept Risk"** (Firefox) to continue. This is safe for local networks.

---

## 🛠️ Project Structure

- `main.py`: Main FastAPI backend application.
- `index.html`: Frontend application logic.
- `requirements.txt`: Python dependencies.
- `start_server.bat`: Windows HTTP launcher.
- `start_https_server.bat`: Windows HTTPS launcher (generates SSL).
- `run_mac.sh`: macOS/Linux launcher.
- `uploaded_media/`: Stores shared files.
- `chatter.db`: SQLite database for messages and users.

## 🤝 Contributing

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
