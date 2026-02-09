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

1.  **Open Terminal** in the project folder (or just double-click the files on macOS).
2.  **Run Setup Script**:
    - **HTTP**: Double-click `start_server_mac.command`
    - **HTTPS**: Double-click `start_https_server_mac.command`

    _Note: If you can't double-click, run `chmod +x _.command` in terminal first.\*

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
- `start_server_mac.command`: macOS HTTP launcher.
- `start_https_server_mac.command`: macOS HTTPS launcher.
- `uploaded_media/`: Stores shared files.
- `chatter.db`: SQLite database for messages and users.

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
