// ===== GLOBALS =====
      let ws = null;
      let myUsername = "";
      let selectionMode = false;
      let currentEditId = null;
      let replyToId = null;
      let replyToData = null;
      let onlineUsers = [];
      let typingTimeout = null;
      let isTyping = false;
      let messageCache = {};
      let reconnectAttempts = 0;
      const MAX_RECONNECT_ATTEMPTS = 10;

      // ===== USER COLOR SYSTEM =====
      const USER_COLORS = [
        "#FF6B6B",
        "#4ECDC4",
        "#FFD93D",
        "#6BCB77",
        "#9B59B6",
        "#E74C3C",
        "#3498DB",
        "#F39C12",
        "#1ABC9C",
        "#E91E63",
        "#00BCD4",
        "#8BC34A",
        "#FF5722",
        "#673AB7",
        "#2196F3",
      ];
      const userColorCache = {};

      function getUserColor(username) {
        if (!username) return USER_COLORS[0];
        if (userColorCache[username]) return userColorCache[username];
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
          hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        const color = USER_COLORS[Math.abs(hash) % USER_COLORS.length];
        userColorCache[username] = color;
        return color;
      }

      // WebRTC Config
      // WebRTC Config (Using enhanced configuration defined below)

      // Voice Recording
      let mediaRecorder = null;
      let audioChunks = [];
      let recordingStartTime = 0;
      let recordingInterval = null;
      let audioContext = null;
      let analyser = null;
      let dataArray = null;
      let visualizerFrame = null;

      // Common emojis
      const emojis = [
        "😀",
        "😂",
        "😍",
        "🥰",
        "😊",
        "😎",
        "🤔",
        "😢",
        "😡",
        "👍",
        "👎",
        "❤️",
        "🔥",
        "✨",
        "🎉",
        "👏",
        "🙏",
        "💪",
        "🤝",
        "👋",
        "✅",
        "❌",
        "⭐",
        "💯",
        "🎁",
        "📷",
        "📹",
        "📁",
        "💬",
        "🔗",
      ];

      // ===== INITIALIZATION =====
      document.addEventListener("DOMContentLoaded", () => {
        initEmojiPicker();
        initDragDrop();
        initKeyboardShortcuts();
        initTypingDetection();
      });

      function initEmojiPicker() {
        const grid = document.getElementById("emoji-grid");
        emojis.forEach((emoji) => {
          const btn = document.createElement("button");
          btn.className = "emoji-btn";
          btn.textContent = emoji;
          btn.onclick = () => insertEmoji(emoji);
          grid.appendChild(btn);
        });
      }

      function initDragDrop() {
        const container = document.getElementById("chat-container");
        const overlay = document.getElementById("drop-overlay");

        ["dragenter", "dragover"].forEach((evt) => {
          container.addEventListener(evt, (e) => {
            e.preventDefault();
            overlay.style.display = "flex";
          });
        });

        ["dragleave", "drop"].forEach((evt) => {
          overlay.addEventListener(evt, (e) => {
            e.preventDefault();
            overlay.style.display = "none";
          });
        });

        overlay.addEventListener("drop", (e) => {
          const files = e.dataTransfer.files;
          if (files.length > 0) handleFileUpload(files);
        });
      }

      function initKeyboardShortcuts() {
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            closeEditModal();
            closeLightbox();
            hideContextMenu();
            cancelReply();
            document.getElementById("emoji-picker").style.display = "none";
          }
        });

        // Paste image from clipboard
        document.addEventListener("paste", async (e) => {
          const items = e.clipboardData?.items;
          if (!items) return;

          for (let item of items) {
            if (item.type.startsWith("image/")) {
              e.preventDefault();
              const blob = item.getAsFile();
              const formData = new FormData();
              formData.append("files", blob, "pasted-image.png");
              await uploadFormData(formData);
              break;
            }
          }
        });
      }

      function initTypingDetection() {
        const input = document.getElementById("messageInput");
        input.addEventListener("input", () => {
          if (!isTyping && input.value.length > 0) {
            isTyping = true;
            ws?.send(JSON.stringify({ type: "typing_start" }));
          }
          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => {
            if (isTyping) {
              isTyping = false;
              ws?.send(JSON.stringify({ type: "typing_stop" }));
            }
          }, 2000);
        });

        // Input detection for Mic/Send button toggle
        input.addEventListener("input", toggleMicSendBtn);
        toggleMicSendBtn(); // Init
      }

      function toggleMicSendBtn() {
        const input = document.getElementById("messageInput");
        const micBtn = document.getElementById("mic-btn");
        const sendBtn = document.getElementById("send-btn");

        if (input.value.trim().length > 0) {
          micBtn.style.display = "none";
          sendBtn.style.display = "flex";
        } else {
          micBtn.style.display = "flex";
          sendBtn.style.display = "none";
        }
      }

      // ===== VOICE RECORDING =====
      async function startRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          showToast("Microphone not supported", "error");
          return;
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });

          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
          };

          mediaRecorder.start();

          // UI Updates
          document.getElementById("input-controls").style.display = "none";
          document.getElementById("recording-ui").style.display = "flex";

          // Timer
          recordingStartTime = Date.now();
          updateRecordingTimer();
          recordingInterval = setInterval(updateRecordingTimer, 1000);

          // Visualization
          initVisualizer(stream);
        } catch (err) {
          console.error("Mic error:", err);
          showToast("Could not access microphone", "error");
        }
      }

      function stopAndSendRecording() {
        if (!mediaRecorder) return;

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
          await sendVoiceMessage(audioBlob);
          cleanupRecording();
        };

        mediaRecorder.stop();
      }

      function cancelRecording() {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
        cleanupRecording();
      }

      function cleanupRecording() {
        // Stop stream tracks
        if (mediaRecorder && mediaRecorder.stream) {
          mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        }

        document.getElementById("input-controls").style.display = "flex";
        document.getElementById("recording-ui").style.display = "none";

        clearInterval(recordingInterval);
        cancelAnimationFrame(visualizerFrame);
        document.getElementById("recording-timer").textContent = "00:00";

        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }

        mediaRecorder = null;
      }

      function updateRecordingTimer() {
        const diff = Math.floor((Date.now() - recordingStartTime) / 1000);
        const m = Math.floor(diff / 60)
          .toString()
          .padStart(2, "0");
        const s = (diff % 60).toString().padStart(2, "0");
        document.getElementById("recording-timer").textContent = `${m}:${s}`;
      }

      function initVisualizer(stream) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        const canvas = document.getElementById("audio-visualizer");
        const ctx = canvas.getContext("2d");

        function draw() {
          visualizerFrame = requestAnimationFrame(draw);
          analyser.getByteFrequencyData(dataArray);

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const barWidth = (canvas.width / bufferLength) * 2.5;
          let barHeight;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;

            ctx.fillStyle = `rgba(255, 71, 87, ${barHeight / 100 + 0.5})`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
          }
        }
        draw();
      }

      async function sendVoiceMessage(blob) {
        // Upload logic
        const formData = new FormData();
        formData.append("files", blob, "voice-note.webm");

        try {
          const response = await fetch("/upload", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) throw new Error("Upload failed");

          const result = await response.json();
          const fileData = result.files[0];

          ws.send(
            JSON.stringify({
              type: "voice",
              content: fileData.filename,
              reply_to: replyToId,
            }),
          );
          playSound("sent");

          cancelReply();
        } catch (err) {
          console.error(err);
          showToast("Failed to send voice note", "error");
        }
      }

      // ===== LOGIN =====
      function login() {
        const u = document.getElementById("username").value.trim();
        const p = document.getElementById("password").value;
        const errorEl = document.getElementById("login-error");
        const btn = document.getElementById("login-btn");

        if (!u) {
          errorEl.textContent = "Please enter a username";
          errorEl.style.display = "block";
          return;
        }

        btn.disabled = true;
        btn.querySelector(".login-text").style.display = "none";
        btn.querySelector(".login-spinner").style.display = "inline";

        connectWebSocket(u, p);
      }

      function connectWebSocket(username, password) {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

        ws.onopen = () => {
          reconnectAttempts = 0;
          ws.send(JSON.stringify({ username, password }));
        };

        ws.onclose = (event) => {
          if (myUsername && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            showToast(
              `Connection lost. Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
            );
            setTimeout(
              () => connectWebSocket(myUsername, password),
              Math.min(1000 * reconnectAttempts, 5000),
            );
          } else if (!myUsername) {
            // Login failed connection drop
            const btn = document.getElementById("login-btn");
            btn.disabled = false;
            btn.querySelector(".login-text").style.display = "inline";
            btn.querySelector(".login-spinner").style.display = "none";
            if (event.code !== 1000) {
              showToast("Connection failed. Check server.", "error");
            }
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket Error:", error);
          const btn = document.getElementById("login-btn");
          // On error, we might not want to reset button immediately if retrying,
          // but if it's initial connection, we should.
          if (!myUsername) {
            btn.disabled = false;
            btn.querySelector(".login-text").style.display = "inline";
            btn.querySelector(".login-spinner").style.display = "none";
            showToast("Connection error. Is server running?", "error");
          }
        };

        ws.onmessage = handleMessage;
      }

      function handleMessage(event) {
        const data = JSON.parse(event.data);
        console.log("WS Message:", data.type, data);

        switch (data.type) {
          case "login_success":
            document.getElementById("login-screen").style.display = "none";
            document.getElementById("chat-container").style.display = "flex";
            myUsername = data.username;
            onlineUsers = data.online_users || [];
            // Store password for call window authentication
            localStorage.setItem(
              "chatPassword",
              document.getElementById("password").value,
            );
            localStorage.setItem("chatUsername", myUsername);
            updateOnlineDisplay();
            break;

          case "error":
            const errorEl = document.getElementById("login-error");
            errorEl.textContent = data.msg;
            errorEl.style.display = "block";
            const btn = document.getElementById("login-btn");
            btn.disabled = false;
            btn.querySelector(".login-text").style.display = "inline";
            btn.querySelector(".login-spinner").style.display = "none";
            showToast(data.msg, "error");
            break;

          case "user_joined":
            onlineUsers = data.online_users || [];
            updateOnlineDisplay();
            showToast(`${data.username} joined`, "success");
            break;

          case "user_left":
            onlineUsers = data.online_users || [];
            updateOnlineDisplay();
            break;

          case "typing_update":
            updateTypingIndicator(data.typing_users || []);
            break;

          // ===== CALL SIGNALING =====
          case "call_incoming":
            console.log(
              "Received call_incoming from:",
              data.from,
              "type:",
              data.callType,
            );
            // Check if already in call
            if (currentCall) {
              console.log("Already in call, rejecting with busy");
              ws.send(
                JSON.stringify({
                  type: "call_reject",
                  to: data.from,
                  reason: "busy",
                }),
              );
            } else {
              currentCall = {
                with: data.from,
                type: data.callType,
                status: "incoming",
                direction: "incoming",
              };
              console.log("Set currentCall:", currentCall);
              showIncomingCall(data.from, data.callType);
            }
            break;

          case "call_accepted":
            if (currentCall && currentCall.with === data.from) {
              showToast("Call Accepted");
              handleCallAccepted();
            }
            break;

          case "call_rejected":
            showToast("Call Rejected");
            endCall(); // Cleanup
            break;

          case "call_end":
            showToast("Call Ended");
            endCall();
            break;

          case "call_cancel":
            showToast("Call Cancelled");
            // Hide incoming modal if open
            document.getElementById("incoming-call-modal").style.display =
              "none";
            // Remove toast if any
            const toasts = document.querySelectorAll(".toast");
            toasts.forEach((t) => {
              if (
                t.innerHTML.includes("Incoming") &&
                t.innerHTML.includes(data.from)
              )
                t.remove();
            });
            stopRingtone();
            cleanupCall();
            break;

          case "webrtc_offer":
            handleWebRTCOffer(data.from, data.offer);
            break;

          case "webrtc_answer":
            handleWebRTCAnswer(data.answer);
            break;

          case "ice_candidate":
            handleICECandidate(data.candidate);
            break;

          case "delete_confirmed":
            data.ids.forEach((id) => {
              const el = document.getElementById("row-" + id);
              if (el) el.remove();
              delete messageCache[id];
            });
            exitSelectMode();
            checkEmptyState();
            break;

          case "edit_confirmed":
            const textEl = document.querySelector(
              `#row-${data.id} .text-content`,
            );
            if (textEl) textEl.textContent = data.new_msg;
            const tag = document.querySelector(`#row-${data.id} .edited-label`);
            if (tag) tag.style.display = "inline";
            if (currentEditId === data.id) closeEditModal();
            if (messageCache[data.id]) messageCache[data.id].msg = data.new_msg;
            break;

          case "read_update":
            updateReadReceipts(data.id, data.read_by);
            break;

          default:
            if (
              ["text", "image", "video", "file", "voice"].includes(data.type)
            ) {
              addMessageBubble(data);
              document.getElementById("empty-state").style.display = "none";
              // Mark as read if from others
              if (data.user !== myUsername) {
                playSound("received");
                setTimeout(
                  () =>
                    ws?.send(
                      JSON.stringify({ type: "mark_read", ids: [data.id] }),
                    ),
                  500,
                );
              }
            }
        }
      }

      // ===== ONLINE USERS =====
      function updateOnlineDisplay() {
        document.getElementById("online-count").textContent =
          `${onlineUsers.length} online`;
        const list = document.getElementById("online-list");
        list.innerHTML = onlineUsers
          .map(
            (u) => `
                <div class="online-user">
                    <span class="online-dot"></span>
                    <span>${escapeHtml(u)}${
                      u === myUsername ? " (you)" : ""
                    }</span>
                </div>
            `,
          )
          .join("");
      }

      function toggleOnlinePanel() {
        const panel = document.getElementById("online-panel");
        panel.style.display =
          panel.style.display === "block" ? "none" : "block";
      }

      // ===== TYPING INDICATOR =====
      function updateTypingIndicator(users) {
        const indicator = document.getElementById("typing-indicator");
        const filtered = users.filter((u) => u !== myUsername);
        if (filtered.length === 0) {
          indicator.style.display = "none";
        } else if (filtered.length === 1) {
          indicator.textContent = `${filtered[0]} is typing...`;
          indicator.style.display = "block";
        } else {
          indicator.textContent = `${filtered.length} people are typing...`;
          indicator.style.display = "block";
        }
      }

      // ===== FILE UPLOAD =====
      async function uploadFiles(inputElement) {
        const files = inputElement.files;
        if (files.length === 0) return;
        await handleFileUpload(files);
        inputElement.value = "";
      }

      async function handleFileUpload(files) {
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
          formData.append("files", files[i]);
        }
        await uploadFormData(formData);
      }

      async function uploadFormData(formData) {
        const progress = document.getElementById("upload-progress");
        const fill = document.getElementById("progress-fill");
        progress.style.display = "block";
        fill.style.width = "0%";

        try {
          // Simulate progress
          let p = 0;
          const interval = setInterval(() => {
            p = Math.min(p + 10, 90);
            fill.style.width = p + "%";
          }, 100);

          const response = await fetch("/upload", {
            method: "POST",
            body: formData,
          });
          clearInterval(interval);

          if (!response.ok) throw new Error("Upload failed");

          fill.style.width = "100%";
          const result = await response.json();

          result.files.forEach((fileData) => {
            let type = "file";
            const ext = fileData.ext;
            if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext))
              type = "image";
            else if (["mp4", "webm", "mov"].includes(ext)) type = "video";

            ws.send(
              JSON.stringify({
                type,
                content: fileData.filename,
                reply_to: replyToId,
              }),
            );
          });

          cancelReply();
        } catch (err) {
          showToast("Upload failed", "error");
        } finally {
          setTimeout(() => {
            progress.style.display = "none";
          }, 500);
        }
      }

      // ===== SOUND EFFECTS =====
      function playSound(type) {
        // Check if sound is enabled (implementation depends on global toggle)
        // Check for sound button state
        const btn = document.getElementById("sound-toggle-btn");
        const isMuted = btn && btn.classList.contains("muted");
        if (isMuted) return;

        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "sent") {
          // High pitch, short
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(
            1200,
            ctx.currentTime + 0.1,
          );
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
        } else if (type === "received") {
          // Pleasant ping
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        }
      }

      // ===== SEND TEXT =====
      function sendText(event) {
        event.preventDefault();
        const input = document.getElementById("messageInput");
        const text = input.value.trim();
        if (text && ws) {
          ws.send(
            JSON.stringify({
              type: "text",
              content: text,
              reply_to: replyToId,
            }),
          );
          playSound("sent");
          input.value = "";
          cancelReply();
          if (isTyping) {
            isTyping = false;
            ws.send(JSON.stringify({ type: "typing_stop" }));
          }
        }
      }

      // ===== MESSAGE BUBBLE =====
      function addMessageBubble(data) {
        messageCache[data.id] = data;
        const messages = document.getElementById("messages");
        const row = document.createElement("div");
        row.id = "row-" + data.id;
        const isMe = data.user === myUsername;
        row.className = "msg-row " + (isMe ? "right-row" : "left-row");

        const timeStr = new Date(data.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        let contentHtml = "";
        let actionBar = "";

        // Reply preview
        let replyHtml = "";
        if (data.reply_to && data.reply_data) {
          const rd = data.reply_data;
          const previewText = rd.type === "text" ? rd.msg : `[${rd.type}]`;
          replyHtml = `
                    <div class="reply-preview" onclick="scrollToMessage('${
                      rd.id
                    }')">
                        <div class="reply-user">${escapeHtml(rd.user)}</div>
                        <div class="reply-text">${escapeHtml(
                          previewText.substring(0, 50),
                        )}</div>
                    </div>`;
        }

        if (data.type === "image") {
          const thumbSrc = `/thumbs/${data.msg}`;
          const fullSrc = `/media/${data.msg}`;
          contentHtml = `<img src="${thumbSrc}" class="media-preview" 
                    onclick="openLightbox('${fullSrc}')" 
                    onerror="this.src='${fullSrc}'">`;
          actionBar = getActionBar(data.msg);
        } else if (data.type === "video") {
          contentHtml = `<video src="/media/${data.msg}" class="media-preview video" controls preload="metadata"></video>`;
          actionBar = getActionBar(data.msg);
        } else if (data.type === "file") {
          const ext = data.msg.split(".").pop().toLowerCase();
          let icon = "description";
          if (ext === "pdf") icon = "picture_as_pdf";
          else if (["zip", "rar", "7z"].includes(ext)) icon = "folder_zip";
          else if (["doc", "docx"].includes(ext)) icon = "article";
          else if (["xls", "xlsx"].includes(ext)) icon = "table_chart";

          contentHtml = `
                    <div class="file-card" onclick="window.open('/media/${
                      data.msg
                    }', '_blank')">
                        <span class="material-icons file-icon">${icon}</span>
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(data.msg)}</div>
                        </div>
                    </div>`;
          actionBar = getActionBar(data.msg);
        } else if (data.type === "voice") {
          contentHtml = `<audio src="/media/${data.msg}" controls class="voice-msg" style="height: 48px; width: 260px; margin: 4px 0; border-radius: 24px;"></audio>`;
        } else {
          contentHtml = `<div class="text-content">${escapeHtml(
            data.msg,
          )}</div>`;
        }

        // Read receipts for own messages
        let ticksHtml = "";
        if (isMe) {
          const readBy = data.read_by || [];
          const isRead = readBy.length > 0;
          ticksHtml = `<span class="read-ticks ${
            isRead ? "read" : ""
          }" data-readers="${readBy.join(",")}" 
                    onclick="showReaders(event, '${data.id}')" title="${
                      isRead ? "Read by: " + readBy.join(", ") : "Sent"
                    }">✓✓</span>`;
        }

        const nameTag = isMe
          ? ""
          : `<div class="username" style="color: ${getUserColor(
              data.user,
            )}">${escapeHtml(data.user)}</div>`;

        row.innerHTML = `
                <input type="checkbox" class="select-checkbox" value="${data.id}" onclick="event.stopPropagation(); updateCount(); this.closest('.msg-row').classList.toggle('selected', this.checked);">
                <div class="msg-container">
                    ${nameTag}
                    <div class="bubble" oncontextmenu="showContextMenu(event, '${data.id}', ${isMe}, '${data.type}')" 
                         ontouchstart="handleTouchStart(event, '${data.id}', ${isMe}, '${data.type}')"
                         ontouchend="handleTouchEnd(event)">
                        ${replyHtml}
                        ${contentHtml}
                        ${actionBar}
                        <div class="meta-info">
                            <span class="edited-label">(edited)</span>
                            <span class="timestamp">${timeStr}</span>
                            ${ticksHtml}
                        </div>
                    </div>
                </div>`;

        // Add click handler for row selection
        row.onclick = (e) => {
          if (
            selectionMode &&
            !e.target.closest(".bubble") &&
            !e.target.classList.contains("select-checkbox")
          ) {
            toggleMessageSelection(data.id);
          }
        };

        // Render existing reactions if any
        if (data.reactions) {
          messageCache[data.id].reactions = data.reactions;
          setTimeout(() => renderReactions(data.id, data.reactions), 0);
        }

        messages.appendChild(row);
        messages.scrollTop = messages.scrollHeight;
      }

      function getActionBar(filename) {
        return `
                <div class="action-bar">
                    <a href="/media/${filename}" target="_blank" class="action-btn">
                        <span class="material-icons">open_in_new</span>Open
                    </a>
                    <a href="/media/${filename}" download="${filename}" class="action-btn">
                        <span class="material-icons">download</span>Save
                    </a>
                </div>`;
      }

      function updateReadReceipts(msgId, readBy) {
        const ticks = document.querySelector(`#row-${msgId} .read-ticks`);
        if (ticks) {
          ticks.classList.toggle("read", readBy.length > 0);
          ticks.setAttribute("data-readers", readBy.join(","));
          ticks.title =
            readBy.length > 0 ? "Read by: " + readBy.join(", ") : "Sent";
        }
        if (messageCache[msgId]) messageCache[msgId].read_by = readBy;
      }

      function showReaders(event, msgId) {
        event.stopPropagation();
        const msg = messageCache[msgId];
        if (msg && msg.read_by && msg.read_by.length > 0) {
          showToast("Read by: " + msg.read_by.join(", "));
        }
      }

      function scrollToMessage(msgId) {
        const el = document.getElementById("row-" + msgId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.background = "rgba(0,168,132,0.2)";
          setTimeout(() => (el.style.background = ""), 1500);
        }
      }

      // ===== CONTEXT MENU =====
      let touchTimer = null;
      function handleTouchStart(event, id, isMe, msgType) {
        touchTimer = setTimeout(() => {
          showContextMenu(event, id, isMe, msgType);
        }, 500);
      }

      function handleTouchEnd(event) {
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
      }

      function showContextMenu(event, id, isMe, msgType) {
        event.preventDefault();
        event.stopPropagation();

        const menu = document.getElementById("context-menu");
        let items = "";

        // Reply option for all messages
        items += `<div class="context-menu-item" onclick="startReply('${id}')">
                <span class="material-icons">reply</span>Reply
            </div>`;

        if (isMe) {
          if (msgType === "text") {
            items += `<div class="context-menu-item" onclick="openEditModal('${id}')">
                        <span class="material-icons">edit</span>Edit
                    </div>`;
          }
          items += `<div class="context-menu-divider"></div>`;
          items += `<div class="context-menu-item danger" onclick="deleteSingle('${id}')">
                    <span class="material-icons">delete</span>Delete
                </div>`;
        }

        // Copy for text messages
        if (msgType === "text") {
          items += `<div class="context-menu-item" onclick="copyMessage('${id}')">
                    <span class="material-icons">content_copy</span>Copy
                </div>`;
        }

        // React option for all messages
        items += `<div class="context-menu-item" onclick="showReactionPicker('${id}', event)">
                  <span class="material-icons">add_reaction</span>React
              </div>`;

        menu.innerHTML = items;

        // Position menu
        const x = event.touches ? event.touches[0].clientX : event.clientX;
        const y = event.touches ? event.touches[0].clientY : event.clientY;

        menu.style.display = "block";

        // Adjust position to stay on screen
        const menuRect = menu.getBoundingClientRect();
        let posX = x;
        let posY = y;

        if (x + menuRect.width > window.innerWidth)
          posX = window.innerWidth - menuRect.width - 10;
        if (y + menuRect.height > window.innerHeight)
          posY = window.innerHeight - menuRect.height - 10;

        menu.style.left = posX + "px";
        menu.style.top = posY + "px";

        // Close on click outside
        setTimeout(() => {
          document.addEventListener("click", hideContextMenu, { once: true });
        }, 10);
      }

      function hideContextMenu() {
        document.getElementById("context-menu").style.display = "none";
      }

      function copyMessage(id) {
        const msg = messageCache[id];
        if (msg && msg.type === "text") {
          navigator.clipboard.writeText(msg.msg);
          showToast("Copied to clipboard");
        }
        hideContextMenu();
      }

      // ===== REPLY =====
      function startReply(id) {
        hideContextMenu();
        const msg = messageCache[id];
        if (!msg) return;

        replyToId = id;
        replyToData = msg;

        document.getElementById("reply-user").textContent = msg.user;
        document.getElementById("reply-text").textContent =
          msg.type === "text" ? msg.msg.substring(0, 50) : `[${msg.type}]`;
        document.getElementById("reply-bar").style.display = "block";
        document.getElementById("messageInput").focus();
      }

      function cancelReply() {
        replyToId = null;
        replyToData = null;
        document.getElementById("reply-bar").style.display = "none";
      }

      // ===== EDIT =====
      function openEditModal(id) {
        hideContextMenu();
        currentEditId = id;
        const msg = messageCache[id];
        if (!msg) return;

        document.getElementById("edit-modal").style.display = "flex";
        document.getElementById("edit-input").value = msg.msg;
        document.getElementById("edit-input").focus();
      }

      function closeEditModal() {
        document.getElementById("edit-modal").style.display = "none";
        currentEditId = null;
      }

      function saveEdit() {
        const val = document.getElementById("edit-input").value.trim();
        if (val && currentEditId && ws) {
          ws.send(
            JSON.stringify({ type: "edit", id: currentEditId, content: val }),
          );
        }
        closeEditModal();
      }

      // ===== DELETE =====
      function deleteSingle(id) {
        hideContextMenu();
        if (confirm("Delete this message?")) {
          ws?.send(JSON.stringify({ type: "delete", ids: [id] }));
        }
      }

      // ===== BULK SELECT =====
      function toggleSelectMode() {
        selectionMode = !selectionMode;
        document
          .querySelectorAll(".select-checkbox")
          .forEach((c) => (c.style.display = selectionMode ? "block" : "none"));
        document.getElementById("bulkHeader").style.display = selectionMode
          ? "flex"
          : "none";
        document.querySelector(".header-left").style.display = selectionMode
          ? "none"
          : "flex";
        document.querySelector(".header-actions").style.display = selectionMode
          ? "none"
          : "flex";
        if (!selectionMode) exitSelectMode();
      }

      function exitSelectMode() {
        selectionMode = false;
        document.querySelectorAll(".select-checkbox").forEach((c) => {
          c.checked = false;
          c.style.display = "none";
        });
        document.getElementById("selectedCount").textContent = "0 Selected";
        document.getElementById("bulkHeader").style.display = "none";
        document.querySelector(".header-left").style.display = "flex";
        document.querySelector(".header-actions").style.display = "flex";
      }

      function updateCount() {
        document.getElementById("selectedCount").textContent =
          document.querySelectorAll(".select-checkbox:checked").length +
          " Selected";
      }

      function deleteSelected() {
        const ids = Array.from(
          document.querySelectorAll(".select-checkbox:checked"),
        ).map((c) => c.value);
        if (ids.length > 0 && confirm(`Delete ${ids.length} message(s)?`)) {
          ws?.send(JSON.stringify({ type: "delete", ids }));
        }
      }

      // ===== EMOJI PICKER =====
      function toggleEmojiPicker() {
        const picker = document.getElementById("emoji-picker");
        picker.style.display =
          picker.style.display === "block" ? "none" : "block";
      }

      function insertEmoji(emoji) {
        const input = document.getElementById("messageInput");
        input.value += emoji;
        input.focus();
        document.getElementById("emoji-picker").style.display = "none";
      }

      // ===== ENHANCED LIGHTBOX =====
      let lightboxImages = [];
      let currentLightboxIndex = 0;

      function openLightbox(src, fromGallery = false) {
        // Build image list from gallery or messages
        if (fromGallery && galleryMedia.length > 0) {
          lightboxImages = galleryMedia
            .filter((m) => m.type === "image")
            .map((m) => m.media_url);
        } else {
          lightboxImages = Array.from(
            document.querySelectorAll(".media-preview:not(.video)"),
          ).map((img) => img.src.replace("/thumbs/", "/media/"));
        }

        currentLightboxIndex = lightboxImages.indexOf(src);
        if (currentLightboxIndex === -1) {
          lightboxImages = [src];
          currentLightboxIndex = 0;
        }

        updateLightboxImage();
        document.getElementById("lightbox").style.display = "flex";
      }

      function updateLightboxImage() {
        document.getElementById("lightbox-img").src =
          lightboxImages[currentLightboxIndex];
        document.getElementById("lightbox-counter").textContent = `${
          currentLightboxIndex + 1
        } / ${lightboxImages.length}`;
      }

      function navigateLightbox(event, direction) {
        event.stopPropagation();
        currentLightboxIndex += direction;
        if (currentLightboxIndex < 0)
          currentLightboxIndex = lightboxImages.length - 1;
        if (currentLightboxIndex >= lightboxImages.length)
          currentLightboxIndex = 0;
        updateLightboxImage();
      }

      function closeLightbox(event) {
        if (event) event.stopPropagation();
        document.getElementById("lightbox").style.display = "none";
      }

      function openCurrentImage() {
        window.open(lightboxImages[currentLightboxIndex], "_blank");
      }

      function saveCurrentImage() {
        const link = document.createElement("a");
        link.href = lightboxImages[currentLightboxIndex];
        link.download = lightboxImages[currentLightboxIndex].split("/").pop();
        link.click();
      }

      // Keyboard navigation for lightbox
      document.addEventListener("keydown", (e) => {
        if (document.getElementById("lightbox").style.display === "flex") {
          if (e.key === "ArrowLeft") navigateLightbox(e, -1);
          if (e.key === "ArrowRight") navigateLightbox(e, 1);
          if (e.key === "Escape") closeLightbox();
        }
        if (document.getElementById("media-gallery").style.display === "flex") {
          if (e.key === "Escape") closeGallery();
        }
      });

      // Close lightbox on background click
      document.getElementById("lightbox").addEventListener("click", (e) => {
        if (e.target.id === "lightbox") closeLightbox();
      });

      // ===== MEDIA GALLERY =====
      let galleryMedia = [];
      let galleryFilter = "all";
      let gallerySort = "newest";

      async function openGallery() {
        document.getElementById("media-gallery").style.display = "flex";
        await loadGalleryMedia();
        await loadStorageStats();
      }

      function closeGallery() {
        document.getElementById("media-gallery").style.display = "none";
      }

      async function loadGalleryMedia() {
        const content = document.getElementById("gallery-content");
        content.innerHTML =
          '<div class="gallery-loading"><div class="spinner"></div><div style="margin-top:16px;">Loading media...</div></div>';

        try {
          const params = new URLSearchParams();
          if (galleryFilter !== "all")
            params.append("media_type", galleryFilter);
          params.append("sort", gallerySort);

          const response = await fetch(`/api/media?${params}`);
          const data = await response.json();
          galleryMedia = data.media;

          if (galleryMedia.length === 0) {
            content.innerHTML =
              '<div class="gallery-empty"><span class="material-icons">photo_library</span><div>No media files yet</div><div style="font-size:13px;margin-top:8px;">Upload images and videos to see them here</div></div>';
            return;
          }

          renderGalleryGrid(galleryMedia);
        } catch (error) {
          console.error("Failed to load gallery:", error);
          content.innerHTML =
            '<div class="gallery-empty"><span class="material-icons">error</span><div>Failed to load media</div></div>';
        }
      }

      function renderGalleryGrid(media) {
        const content = document.getElementById("gallery-content");

        // Group by date
        const groups = {};
        media.forEach((item) => {
          const date = new Date(item.timestamp);
          const dateKey = getDateLabel(date);
          if (!groups[dateKey]) groups[dateKey] = [];
          groups[dateKey].push(item);
        });

        let html = "";
        for (const [dateLabel, items] of Object.entries(groups)) {
          html += `<div class="gallery-date-group">
            <div class="gallery-date-header">${dateLabel}</div>
            <div class="gallery-grid">`;

          items.forEach((item) => {
            const thumbSrc = item.thumb_url || item.media_url;
            const isVideo = item.type === "video";

            html += `<div class="gallery-item" onclick="openGalleryItem('${
              item.media_url
            }', '${item.type}')">
              ${
                isVideo
                  ? `<video src="${item.media_url}" muted></video>`
                  : `<img src="${thumbSrc}" alt="" loading="lazy">`
              }
              <div class="gallery-item-overlay">
                <span class="gallery-item-type">${item.type.toUpperCase()}</span>
                <div class="gallery-item-actions">
                  <button onclick="event.stopPropagation(); window.open('${
                    item.media_url
                  }', '_blank')" title="Open">
                    <span class="material-icons">open_in_new</span>
                  </button>
                  <button onclick="event.stopPropagation(); downloadFile('${
                    item.media_url
                  }', '${item.filename}')" title="Save">
                    <span class="material-icons">download</span>
                  </button>
                </div>
              </div>
            </div>`;
          });

          html += "</div></div>";
        }

        content.innerHTML = html;
      }

      function getDateLabel(date) {
        const now = new Date();
        const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (diff === 0) return "Today";
        if (diff === 1) return "Yesterday";
        if (diff < 7) return "This Week";
        if (diff < 30) return "This Month";
        return date.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
      }

      function openGalleryItem(url, type) {
        if (type === "video") {
          window.open(url, "_blank");
        } else {
          openLightbox(url, true);
        }
      }

      function downloadFile(url, filename) {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
      }

      function filterGallery(filter) {
        galleryFilter = filter;
        document.querySelectorAll(".gallery-filter").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.filter === filter);
        });
        loadGalleryMedia();
      }

      function toggleGallerySort() {
        gallerySort = gallerySort === "newest" ? "oldest" : "newest";
        const icon = document.getElementById("sort-icon");
        icon.textContent =
          gallerySort === "newest" ? "arrow_downward" : "arrow_upward";
        loadGalleryMedia();
      }

      async function loadStorageStats() {
        try {
          const response = await fetch("/api/storage-stats");
          const stats = await response.json();

          document.getElementById("stats-count").textContent =
            stats.media_count;
          document.getElementById("stats-size").textContent = formatBytes(
            stats.media_size_bytes + stats.thumb_size_bytes,
          );
          document.getElementById("stats-orphans").textContent =
            stats.orphan_files;
        } catch (error) {
          console.error("Failed to load stats:", error);
        }
      }

      async function cleanupOrphans() {
        if (
          !confirm(
            "This will permanently delete files that are not linked to any messages. Continue?",
          )
        ) {
          return;
        }

        try {
          const response = await fetch("/api/cleanup-orphans", {
            method: "POST",
          });
          const result = await response.json();
          showToast(
            `Cleaned ${result.cleaned_media} media and ${result.cleaned_thumbs} thumbnails`,
            "success",
          );
          loadStorageStats();
          loadGalleryMedia();
        } catch (error) {
          showToast("Cleanup failed", "error");
        }
      }

      function formatBytes(bytes) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
      }

      // ===== TOAST =====
      function showToast(message, type = "") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = "toast " + type;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }

      // ===== EMPTY STATE =====
      function checkEmptyState() {
        const hasMessages = document.querySelectorAll(".msg-row").length > 0;
        document.getElementById("empty-state").style.display = hasMessages
          ? "none"
          : "flex";
      }

      // ===== UTILITIES =====
      function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
      }

      // Close panels when clicking outside
      document.addEventListener("click", (e) => {
        if (
          !e.target.closest("#online-panel") &&
          !e.target.closest('[onclick*="toggleOnlinePanel"]')
        ) {
          document.getElementById("online-panel").style.display = "none";
        }
        if (
          !e.target.closest("#emoji-picker") &&
          !e.target.closest('[onclick*="toggleEmojiPicker"]')
        ) {
          document.getElementById("emoji-picker").style.display = "none";
        }
      });

      // Enter to login
      document.getElementById("password").addEventListener("keydown", (e) => {
        if (e.key === "Enter") login();
      });
      document.getElementById("username").addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("password").focus();
      });

      // Enter to save edit
      document.getElementById("edit-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveEdit();
      });

      // ===== IMPROVED SELECTION MODE =====
      function toggleMessageSelection(id) {
        if (!selectionMode) return;
        const checkbox = document.querySelector(`#row-${id} .select-checkbox`);
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          const row = document.getElementById("row-" + id);
          row.classList.toggle("selected", checkbox.checked);
          updateCount();
        }
      }

      function selectAllMessages() {
        document.querySelectorAll(".select-checkbox").forEach((c) => {
          c.checked = true;
          c.closest(".msg-row").classList.add("selected");
        });
        updateCount();
      }

      function updateSelectionClasses() {
        document.querySelectorAll(".msg-row").forEach((row) => {
          if (selectionMode) {
            row.classList.add("selectable");
          } else {
            row.classList.remove("selectable", "selected");
          }
        });
      }

      // Override toggleSelectMode to add selectable class
      const _originalToggleSelectMode = toggleSelectMode;
      toggleSelectMode = function () {
        selectionMode = !selectionMode;
        document.querySelectorAll(".select-checkbox").forEach((c) => {
          c.style.display = selectionMode ? "block" : "none";
        });
        document.getElementById("bulkHeader").style.display = selectionMode
          ? "flex"
          : "none";
        document.querySelector(".header-left").style.display = selectionMode
          ? "none"
          : "flex";
        document.querySelector(".header-actions").style.display = selectionMode
          ? "none"
          : "flex";
        updateSelectionClasses();
        if (!selectionMode) exitSelectMode();
      };

      // Override exitSelectMode to remove selection classes
      const _originalExitSelectMode = exitSelectMode;
      exitSelectMode = function () {
        selectionMode = false;
        document.querySelectorAll(".select-checkbox").forEach((c) => {
          c.checked = false;
          c.style.display = "none";
        });
        document.querySelectorAll(".msg-row").forEach((row) => {
          row.classList.remove("selectable", "selected");
        });
        document.getElementById("selectedCount").textContent = "0 Selected";
        document.getElementById("bulkHeader").style.display = "none";
        document.querySelector(".header-left").style.display = "flex";
        document.querySelector(".header-actions").style.display = "flex";
      };

      // ===== ENHANCED ONLINE PANEL WITH USER SEARCH =====
      function updateOnlineDisplay() {
        document.getElementById("online-count").textContent =
          `${onlineUsers.length} online`;
        renderOnlineList(onlineUsers);
      }

      function renderOnlineList(users) {
        const list = document.getElementById("online-list");
        list.innerHTML = users
          .map(
            (u) => `
          <div class="online-user" onclick="openUserProfile('${escapeHtml(
            u,
          )}')">
            <div class="user-avatar">
              ${u.charAt(0).toUpperCase()}
              <span class="online-indicator"></span>
            </div>
            <div class="user-info">
              <div class="user-name">${escapeHtml(u)}${
                u === myUsername ? " (you)" : ""
              }</div>
              <div class="user-status">Online</div>
            </div>
            ${
              u !== myUsername
                ? `
              <div class="user-actions" onclick="event.stopPropagation()">
                <button class="user-call-btn" onclick="initiateCall('${escapeHtml(
                  u,
                )}', 'voice')" title="Voice Call">
                  <span class="material-icons">call</span>
                </button>
                <button class="user-call-btn" onclick="initiateCall('${escapeHtml(
                  u,
                )}', 'video')" title="Video Call">
                  <span class="material-icons">videocam</span>
                </button>
              </div>
            `
                : ""
            }
          </div>
        `,
          )
          .join("");
      }

      function filterOnlineUsers(query) {
        const filtered = onlineUsers.filter((u) =>
          u.toLowerCase().includes(query.toLowerCase()),
        );
        renderOnlineList(filtered);
      }

      function openUserProfile(username) {
        if (username === myUsername) {
          showToast("This is you!");
          return;
        }
        showToast(`${username} is online`);
        document.getElementById("online-panel").style.display = "none";
      }

      // ===== WEBRTC VOICE/VIDEO CALL SYSTEM =====
      let currentCall = null;
      let callTimer = null;
      let callSeconds = 0;
      let isMuted = false;
      let isCameraOn = true;

      // WebRTC
      let peerConnection = null;
      let localStream = null;
      let remoteStream = null;

      // ICE candidate queue - holds candidates until remote description is set
      let pendingIceCandidates = [];
      // Pending offer queue - holds offer if peer connection not ready
      let pendingOffer = null;
      let pendingOfferFrom = null;

      // Enhanced ICE servers for better connectivity
      const iceServers = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      };

      // Notification sounds (using Web Audio API - audioContext declared above)
      let soundEnabled = localStorage.getItem("soundEnabled") !== "false";

      function initAudio() {
        if (!audioContext) {
          audioContext = new (
            window.AudioContext || window.webkitAudioContext
          )();
        }
      }

      function playTone(frequency, duration, type = "sine") {
        if (!soundEnabled) return;
        try {
          initAudio();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.value = frequency;
          oscillator.type = type;
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + duration,
          );
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        } catch (e) {
          console.log("Audio not available");
        }
      }

      function playNotificationSound() {
        playTone(800, 0.15);
        setTimeout(() => playTone(1000, 0.15), 150);
      }

      function playRingtone() {
        if (!soundEnabled || !currentCall) return;
        playTone(440, 0.3);
        setTimeout(() => playTone(440, 0.3), 400);
        if (currentCall && currentCall.status === "ringing") {
          setTimeout(playRingtone, 2000);
        }
      }

      function playCallEndSound() {
        playTone(400, 0.2);
        setTimeout(() => playTone(300, 0.3), 200);
      }

      // Get user media (camera/microphone)
      async function getUserMediaStream(callType) {
        // Check if we're on a secure context (HTTPS or localhost)
        if (!window.isSecureContext) {
          showMediaPermissionError("insecure", callType);
          return null;
        }

        // Check if mediaDevices is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          showMediaPermissionError("unsupported", callType);
          return null;
        }

        try {
          const constraints = {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video:
              callType === "video"
                ? {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 60 },
                    facingMode: "user",
                  }
                : false,
          };

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          return stream;
        } catch (err) {
          console.error("getUserMedia error:", err.name, err.message);

          if (
            err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError"
          ) {
            showMediaPermissionError("denied", callType);
          } else if (
            err.name === "NotFoundError" ||
            err.name === "DevicesNotFoundError"
          ) {
            showMediaPermissionError("notfound", callType);
          } else if (
            err.name === "NotReadableError" ||
            err.name === "TrackStartError"
          ) {
            showMediaPermissionError("inuse", callType);
          } else if (err.name === "OverconstrainedError") {
            // Try again with simpler constraints
            try {
              const simpleConstraints = {
                audio: true,
                video: callType === "video",
              };
              const stream =
                await navigator.mediaDevices.getUserMedia(simpleConstraints);
              return stream;
            } catch (e) {
              showMediaPermissionError("generic", callType);
            }
          } else {
            showMediaPermissionError("generic", callType);
          }
          return null;
        }
      }

      function showMediaPermissionError(errorType, callType) {
        let title = "Permission Required";
        let message = "";

        switch (errorType) {
          case "denied":
            title =
              callType === "video"
                ? "📹 Camera/Mic Blocked"
                : "🎤 Microphone Blocked";
            message = `Permission was denied.\n\nTo fix:\n1. Click the lock/camera icon in your browser's address bar\n2. Allow camera/microphone access\n3. Reload the page and try again`;
            break;
          case "notfound":
            title =
              callType === "video"
                ? "📹 No Camera Found"
                : "🎤 No Microphone Found";
            message = `No ${
              callType === "video" ? "camera or " : ""
            }microphone was detected.\n\nMake sure your device has a working ${
              callType === "video" ? "camera and " : ""
            }microphone connected.`;
            break;
          case "inuse":
            title = "🔒 Device In Use";
            message = `Your ${
              callType === "video" ? "camera/microphone is" : "microphone is"
            } being used by another app.\n\nClose other apps that might be using it and try again.`;
            break;
          case "insecure":
            title = "🔐 Secure Connection Required";
            message = `Camera/microphone access requires a secure connection (HTTPS).\n\nOn localhost it should work. For network access:\n• Use https:// instead of http://\n• Or access from the same device (localhost)`;
            break;
          case "unsupported":
            title = "❌ Not Supported";
            message =
              "Your browser does not support camera/microphone access.\n\nTry using a modern browser like Chrome, Firefox, or Safari.";
            break;
          default:
            title = "⚠️ Could Not Access Media";
            message = `Unable to access ${
              callType === "video" ? "camera/microphone" : "microphone"
            }.\n\nPlease check your browser settings and try again.`;
        }

        // Show as alert for now (could be enhanced to a modal)
        alert(`${title}\n\n${message}`);
        showToast("Call failed - check permissions", "error");
      }

      // Create peer connection
      function createPeerConnection() {
        peerConnection = new RTCPeerConnection(iceServers);
        updateRemoteVideoStatus();

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate && currentCall) {
            ws?.send(
              JSON.stringify({
                type: "ice_candidate",
                to: currentCall.with,
                candidate: event.candidate,
              }),
            );
          }
        };

        // Handle connection state
        peerConnection.onconnectionstatechange = () => {
          console.log("Connection state:", peerConnection.connectionState);
          if (peerConnection.connectionState === "connected") {
            document.getElementById("call-connecting")?.style &&
              (document.getElementById("call-connecting").style.display =
                "none");
          } else if (
            peerConnection.connectionState === "failed" ||
            peerConnection.connectionState === "disconnected"
          ) {
            showToast("Call connection lost", "error");
            endCall();
          }
        };

        // Handle incoming remote stream
        peerConnection.ontrack = (event) => {
          console.log("Received remote track:", event.track.kind);
          remoteStream = event.streams[0];

          if (event.track.kind === "video") {
            event.track.onmute = () => updateRemoteVideoStatus();
            event.track.onunmute = () => updateRemoteVideoStatus();
            event.track.onended = () => updateRemoteVideoStatus(true);
          }

          if (currentCall?.type === "video") {
            document.getElementById("remote-video").srcObject = remoteStream;
            updateRemoteVideoStatus();
          } else {
            document.getElementById("remote-audio").srcObject = remoteStream;
          }
        };

        // Add local tracks to connection
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
          });
        }

        return peerConnection;
      }

      async function initiateCall(username, callType) {
        if (currentCall) {
          showToast("Already in a call", "error");
          return;
        }

        // Use inline call logic
        localStream = await getUserMediaStream(callType);
        if (!localStream) return;

        currentCall = {
          with: username,
          type: callType,
          status: "outgoing",
          direction: "outgoing",
        };

        document.getElementById("outgoing-call-avatar").textContent = username
          .charAt(0)
          .toUpperCase();
        document.getElementById("outgoing-call-name").textContent = username;
        document.getElementById("outgoing-call-modal").style.display = "flex";

        ws?.send(
          JSON.stringify({
            type: "call_initiate",
            to: username,
            callType: callType,
          }),
        );

        document.getElementById("online-panel").style.display = "none";
        currentCall.status = "ringing";
        playRingtone();
      }

      function showIncomingCall(fromUser, callType) {
        console.log("showIncomingCall called with:", fromUser, callType);
        playRingtone();

        // Store call data in the modal for backup retrieval
        const modal = document.getElementById("incoming-call-modal");
        modal.dataset.fromUser = fromUser;
        modal.dataset.callType = callType;

        // Show Incoming Call Modal
        document.getElementById("incoming-call-avatar").textContent =
          fromUser[0].toUpperCase();
        document.getElementById("incoming-call-name").textContent = fromUser;
        document.getElementById("incoming-call-type").textContent =
          callType === "video" ? "Incoming Video Call" : "Incoming Voice Call";

        // Show/Hide Pre-accept controls for video
        const preControls = document.getElementById("pre-accept-controls");
        if (preControls) {
          preControls.style.display = callType === "video" ? "flex" : "none";
        }

        modal.style.display = "flex";
        console.log("Incoming call modal displayed");
      }

      function rejectIncomingCall(user) {
        ws?.send(JSON.stringify({ type: "call_reject", to: user }));
        document.getElementById("incoming-call-modal").style.display = "none";
        stopRingtone();
      }

      function stopRingtone() {
        // If you have a global audio element for ringtone
        // In this implementation we used playTone oscillator, so we just set state
        // currentCall = null; // handled by cleanup
      }

      // ===== PRE-ACCEPT CONTROLS =====
      let preAcceptMicOn = true;
      let preAcceptCameraOn = true;

      function togglePreAcceptMic() {
        preAcceptMicOn = !preAcceptMicOn;
        updatePreAcceptUI();
      }

      function togglePreAcceptCamera() {
        preAcceptCameraOn = !preAcceptCameraOn;
        updatePreAcceptUI();
      }

      function updatePreAcceptUI() {
        const micBtn = document.getElementById("pre-mic-btn");
        const cameraBtn = document.getElementById("pre-camera-btn");

        if (micBtn) {
          micBtn.classList.toggle("muted", !preAcceptMicOn);
          micBtn.classList.toggle("active", preAcceptMicOn);
          micBtn.querySelector(".material-icons").textContent = preAcceptMicOn
            ? "mic"
            : "mic_off";
          micBtn.querySelector(".pre-accept-text").textContent = preAcceptMicOn
            ? "Mic On"
            : "Mic Off";
        }

        if (cameraBtn) {
          cameraBtn.classList.toggle("muted", !preAcceptCameraOn);
          cameraBtn.classList.toggle("active", preAcceptCameraOn);
          cameraBtn.querySelector(".material-icons").textContent =
            preAcceptCameraOn ? "videocam" : "videocam_off";
          cameraBtn.querySelector(".pre-accept-text").textContent =
            preAcceptCameraOn ? "Camera On" : "Camera Off";
        }
      }

      async function acceptCall() {
        console.log("acceptCall called, currentCall:", currentCall);

        // Recover currentCall from modal data if it's null (handles scope/reconnection issues)
        if (!currentCall) {
          const modal = document.getElementById("incoming-call-modal");
          const fromUser = modal.dataset.fromUser;
          const callType = modal.dataset.callType;

          console.log("Recovering call data from modal:", fromUser, callType);

          if (fromUser && callType) {
            currentCall = {
              with: fromUser,
              type: callType,
              status: "incoming",
              direction: "incoming",
            };
            console.log("Recovered currentCall:", currentCall);
          } else {
            console.error("acceptCall: Could not recover call data");
            showToast("Error: No incoming call found", "error");
            modal.style.display = "none";
            return;
          }
        }

        console.log("Attempting to get media for call type:", currentCall.type);

        // Get media first
        localStream = await getUserMediaStream(currentCall.type);
        if (!localStream) {
          console.error("Failed to get local stream");
          rejectCall();
          return;
        }

        console.log("Got local stream successfully");

        // Apply pre-accept states for video calls
        if (currentCall.type === "video") {
          // Apply mic state
          if (!preAcceptMicOn) {
            localStream.getAudioTracks().forEach((track) => {
              track.enabled = false;
            });
            isMuted = true;
          }

          // Apply camera state
          if (!preAcceptCameraOn) {
            localStream.getVideoTracks().forEach((track) => {
              track.enabled = false;
            });
            isCameraOn = false;
          }
        }

        // Clear incoming modal data
        clearIncomingCallModal();

        // Create peer connection and wait for offer
        createPeerConnection();

        // Process any pending offer that arrived before peer connection was ready
        if (pendingOffer && pendingOfferFrom) {
          console.log("Processing pending offer");
          const offerToProcess = pendingOffer;
          const fromUserToProcess = pendingOfferFrom;
          pendingOffer = null;
          pendingOfferFrom = null;
          handleWebRTCOffer(fromUserToProcess, offerToProcess);
        }

        ws?.send(
          JSON.stringify({
            type: "call_accept",
            to: currentCall.with,
          }),
        );

        startActiveCall();

        // Update UI to reflect pre-accept states
        if (currentCall.type === "video") {
          updateCallControlsUI();
        }
      }

      function updateCallControlsUI() {
        // Update mute buttons
        const muteBtn = document.getElementById("mute-btn");
        const muteBtnVideo = document.getElementById("mute-btn-video");
        [muteBtn, muteBtnVideo].forEach((btn) => {
          if (btn) {
            btn.classList.toggle("active", isMuted);
            btn.querySelector(".material-icons").textContent = isMuted
              ? "mic_off"
              : "mic";
          }
        });

        // Update camera button
        const cameraBtn = document.getElementById("camera-btn");
        if (cameraBtn) {
          cameraBtn.classList.toggle("active", !isCameraOn);
          cameraBtn.querySelector(".material-icons").textContent = isCameraOn
            ? "videocam"
            : "videocam_off";
        }
      }

      function rejectCall() {
        // Recover currentCall from modal data if needed
        if (!currentCall) {
          const modal = document.getElementById("incoming-call-modal");
          const fromUser = modal.dataset.fromUser;
          if (fromUser) {
            currentCall = {
              with: fromUser,
              type: modal.dataset.callType || "voice",
            };
          }
        }

        if (!currentCall) {
          document.getElementById("incoming-call-modal").style.display = "none";
          return;
        }

        ws?.send(
          JSON.stringify({
            type: "call_reject",
            to: currentCall.with,
          }),
        );

        cleanupCall();
        clearIncomingCallModal();
        playCallEndSound();
      }

      function clearIncomingCallModal() {
        const modal = document.getElementById("incoming-call-modal");
        modal.style.display = "none";
        modal.dataset.fromUser = "";
        modal.dataset.callType = "";
      }

      function cancelCall() {
        if (!currentCall) return;

        ws?.send(
          JSON.stringify({
            type: "call_cancel",
            to: currentCall.with,
          }),
        );

        cleanupCall();
        document.getElementById("outgoing-call-modal").style.display = "none";
        playCallEndSound();
      }

      async function handleCallAccepted() {
        // The other person accepted, we are the caller - create offer
        createPeerConnection();

        try {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);

          ws?.send(
            JSON.stringify({
              type: "webrtc_offer",
              to: currentCall.with,
              offer: offer,
            }),
          );
        } catch (err) {
          console.error("Error creating offer:", err);
          endCall();
        }

        startActiveCall();
      }

      async function handleWebRTCOffer(fromUser, offer) {
        // If peer connection not ready yet, queue the offer
        if (!peerConnection || !currentCall) {
          console.log("Queueing offer - peer connection not ready");
          pendingOffer = offer;
          pendingOfferFrom = fromUser;
          return;
        }

        try {
          console.log("Setting remote description from offer");
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer),
          );

          // Process any queued ICE candidates now that remote description is set
          await processQueuedIceCandidates();

          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          console.log("Sending WebRTC answer");
          ws?.send(
            JSON.stringify({
              type: "webrtc_answer",
              to: fromUser,
              answer: answer,
            }),
          );
        } catch (err) {
          console.error("Error handling offer:", err);
        }
      }

      async function handleWebRTCAnswer(answer) {
        if (!peerConnection) return;

        try {
          console.log("Setting remote description from answer");
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer),
          );

          // Process any queued ICE candidates now that remote description is set
          await processQueuedIceCandidates();
        } catch (err) {
          console.error("Error handling answer:", err);
        }
      }

      async function handleICECandidate(candidate) {
        if (!peerConnection) {
          console.log("Queueing ICE candidate - no peer connection");
          pendingIceCandidates.push(candidate);
          return;
        }

        // Queue if remote description not set yet
        if (
          !peerConnection.remoteDescription ||
          !peerConnection.remoteDescription.type
        ) {
          console.log("Queueing ICE candidate - no remote description");
          pendingIceCandidates.push(candidate);
          return;
        }

        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      }

      // Process queued ICE candidates after remote description is set
      async function processQueuedIceCandidates() {
        if (pendingIceCandidates.length === 0) return;

        console.log(
          `Processing ${pendingIceCandidates.length} queued ICE candidates`,
        );

        for (const candidate of pendingIceCandidates) {
          try {
            await peerConnection.addIceCandidate(
              new RTCIceCandidate(candidate),
            );
          } catch (err) {
            console.error("Error adding queued ICE candidate:", err);
          }
        }

        pendingIceCandidates = [];
      }

      function startActiveCall() {
        if (!currentCall) return;

        currentCall.status = "active";
        callSeconds = 0;

        document.getElementById("outgoing-call-modal").style.display = "none";
        document.getElementById("incoming-call-modal").style.display = "none";
        document.getElementById("active-call-modal").style.display = "flex";

        // Show appropriate view (video or voice)
        if (currentCall.type === "video") {
          document.getElementById("video-call-view").style.display = "flex";
          document.getElementById("voice-call-view").style.display = "none";
          document.getElementById("video-call-name").textContent =
            currentCall.with;
          // Set local video
          document.getElementById("local-video").srcObject = localStream;

          // Configure remote video for proper orientation
          const remoteVideo = document.getElementById("remote-video");
          if (remoteVideo) {
            // Use object-fit: contain to ensure video is properly displayed
            // regardless of sender's orientation
            remoteVideo.style.objectFit = "contain";
          }

          updateRemoteVideoStatus();

          // Trigger initial orientation check
          setTimeout(handleOrientationChange, 100);
        } else {
          document.getElementById("video-call-view").style.display = "none";
          document.getElementById("voice-call-view").style.display = "flex";
          document.getElementById("active-call-avatar").textContent =
            currentCall.with.charAt(0).toUpperCase();
          document.getElementById("active-call-name").textContent =
            currentCall.with;
        }

        document.getElementById("call-connecting").style.display = "block";

        updateCallTimer();
        callTimer = setInterval(updateCallTimer, 1000);

        showToast(`Call started with ${currentCall.with}`, "success");
      }

      function updateCallTimer() {
        callSeconds++;
        const mins = Math.floor(callSeconds / 60)
          .toString()
          .padStart(2, "0");
        const secs = (callSeconds % 60).toString().padStart(2, "0");
        const timerText = `${mins}:${secs}`;

        const timer = document.getElementById("call-timer");
        const timerVideo = document.getElementById("call-timer-video");
        if (timer) timer.textContent = timerText;
        if (timerVideo) timerVideo.textContent = timerText;
      }

      function endCall() {
        if (!currentCall) return;

        ws?.send(
          JSON.stringify({
            type: "call_end",
            to: currentCall.with,
          }),
        );

        cleanupCall();
        closeAllCallModals();
        playCallEndSound();
        showToast(`Call ended - ${formatCallDuration(callSeconds)}`);
      }

      function cleanupCall() {
        // Stop all local tracks
        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
          localStream = null;
        }

        // Clear remote stream
        remoteStream = null;
        document.getElementById("remote-video").srcObject = null;
        document.getElementById("local-video").srcObject = null;
        document.getElementById("remote-audio").srcObject = null;
        updateRemoteVideoStatus(true);

        // Close peer connection
        if (peerConnection) {
          peerConnection.close();
          peerConnection = null;
        }

        // Reset all call state
        clearInterval(callTimer);
        callSeconds = 0;
        isMuted = false;
        isCameraOn = true;
        currentCall = null;

        // Clear pending signaling data
        pendingIceCandidates = [];
        pendingOffer = null;
        pendingOfferFrom = null;

        // Reset WhatsApp-style controls state
        currentFacingMode = "user";
        isSpeakerOn = true;
        isLocalVideoExpanded = false;
        isCallFullscreen = false;

        // Reset local video wrapper state
        const localVideoWrapper = document.getElementById(
          "local-video-wrapper",
        );
        if (localVideoWrapper) {
          localVideoWrapper.classList.remove("expanded");
        }

        // Reset local video transform
        const localVideo = document.getElementById("local-video");
        if (localVideo) {
          localVideo.style.transform = "scaleX(-1)";
        }

        const videoCallName = document.getElementById("video-call-name");
        if (videoCallName) {
          videoCallName.textContent = "Unknown";
        }

        // Exit fullscreen if active
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        }
      }

      function closeAllCallModals() {
        document.getElementById("incoming-call-modal").style.display = "none";
        document.getElementById("outgoing-call-modal").style.display = "none";
        document.getElementById("active-call-modal").style.display = "none";
        document.getElementById("add-person-modal").style.display = "none";
        document.getElementById("video-call-view").style.display = "none";
        document.getElementById("voice-call-view").style.display = "none";

        // Clear invited users for next call
        invitedUsers.clear();
        isVideoFitMode = false;
      }

      function formatCallDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
      }

      // ===== VIDEO FIT/FILL TOGGLE =====
      let isVideoFitMode = false; // false = cover (fill), true = contain (fit)

      function toggleVideoFit() {
        isVideoFitMode = !isVideoFitMode;
        const remoteVideo = document.getElementById("remote-video");
        const btn = document.getElementById("fit-video-btn");

        if (remoteVideo) {
          remoteVideo.style.objectFit = isVideoFitMode ? "contain" : "cover";
        }

        if (btn) {
          btn.classList.toggle("active", isVideoFitMode);
          btn.querySelector(".material-icons").textContent = isVideoFitMode
            ? "crop_free"
            : "fit_screen";
          btn.title = isVideoFitMode ? "Fill Screen" : "Fit to Screen";
        }

        showToast(isVideoFitMode ? "Fit to screen" : "Fill screen");
      }

      function updateRemoteVideoStatus(forceWaiting = false) {
        const statusEl = document.getElementById("remote-video-status");
        const statusText = document.getElementById("remote-video-status-text");
        const remoteVideo = document.getElementById("remote-video");

        if (!statusEl || !statusText || !remoteVideo || !currentCall) return;

        if (currentCall.type !== "video") {
          statusEl.classList.add("hidden");
          return;
        }

        const hasRemoteVideo = Boolean(
          remoteStream && remoteStream.getVideoTracks().length > 0,
        );

        if (forceWaiting || !hasRemoteVideo) {
          statusText.textContent = "Waiting for video...";
          statusEl.classList.remove("hidden");
          return;
        }

        const [videoTrack] = remoteStream.getVideoTracks();
        if (!videoTrack.enabled || videoTrack.muted) {
          statusText.textContent = `${currentCall.with} turned off camera`;
          statusEl.classList.remove("hidden");
        } else {
          statusEl.classList.add("hidden");
        }
      }

      // ===== ADD PERSON TO CALL =====
      let invitedUsers = new Set();

      function openAddPersonModal() {
        if (!currentCall) return;

        const modal = document.getElementById("add-person-modal");
        modal.style.display = "flex";
        document.getElementById("add-person-search").value = "";
        renderAddPersonList(onlineUsers);
      }

      function closeAddPersonModal() {
        document.getElementById("add-person-modal").style.display = "none";
      }

      function renderAddPersonList(users) {
        const list = document.getElementById("add-person-list");

        // Filter out current user and people already in call
        const availableUsers = users.filter(
          (u) => u !== myUsername && u !== currentCall?.with,
        );

        if (availableUsers.length === 0) {
          list.innerHTML = `
            <div class="add-person-empty">
              <span class="material-icons">person_off</span>
              <div>No other users online</div>
            </div>
          `;
          return;
        }

        list.innerHTML = availableUsers
          .map(
            (user) => `
          <div class="add-person-item">
            <div class="user-avatar">${user.charAt(0).toUpperCase()}</div>
            <div class="user-info">
              <div class="user-name">${escapeHtml(user)}</div>
              <div class="user-status">Online</div>
            </div>
            <button class="invite-btn ${
              invitedUsers.has(user) ? "invited" : ""
            }" 
                    onclick="inviteToCall('${escapeHtml(user)}')"
                    ${invitedUsers.has(user) ? "disabled" : ""}>
              ${invitedUsers.has(user) ? "Invited" : "Invite"}
            </button>
          </div>
        `,
          )
          .join("");
      }

      function filterAddPersonList(query) {
        const filtered = onlineUsers.filter((u) =>
          u.toLowerCase().includes(query.toLowerCase()),
        );
        renderAddPersonList(filtered);
      }

      function inviteToCall(username) {
        if (!currentCall || invitedUsers.has(username)) return;

        // Send call invitation to the user
        ws?.send(
          JSON.stringify({
            type: "call_initiate",
            to: username,
            callType: currentCall.type,
          }),
        );

        invitedUsers.add(username);
        renderAddPersonList(onlineUsers);
        showToast(`Invited ${username} to join the call`, "success");
      }

      function toggleMute() {
        if (!localStream) return;

        isMuted = !isMuted;
        localStream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
        });

        // Update all mute buttons
        const muteBtn = document.getElementById("mute-btn");
        const muteBtnVideo = document.getElementById("mute-btn-video");

        [muteBtn, muteBtnVideo].forEach((btn) => {
          if (btn) {
            btn.classList.toggle("active", isMuted);
            btn.querySelector(".material-icons").textContent = isMuted
              ? "mic_off"
              : "mic";
          }
        });

        showToast(isMuted ? "Muted" : "Unmuted");
      }

      function toggleCamera() {
        if (!localStream) return;

        isCameraOn = !isCameraOn;
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = isCameraOn;
        });

        const cameraBtn = document.getElementById("camera-btn");
        if (cameraBtn) {
          cameraBtn.classList.toggle("active", !isCameraOn);
          cameraBtn.querySelector(".material-icons").textContent = isCameraOn
            ? "videocam"
            : "videocam_off";
        }

        showToast(isCameraOn ? "Camera on" : "Camera off");
      }

      // ===== WHATSAPP-STYLE CAMERA CONTROLS =====
      let currentFacingMode = "user"; // 'user' = front camera, 'environment' = back camera
      let isSpeakerOn = true;
      let isLocalVideoExpanded = false;
      let isCallFullscreen = false;

      // Flip camera (switch between front and back)
      async function flipCamera() {
        if (!localStream || !currentCall || currentCall.type !== "video") {
          showToast("No video call active", "error");
          return;
        }

        // Toggle facing mode
        currentFacingMode =
          currentFacingMode === "user" ? "environment" : "user";

        try {
          // Stop current video track
          const videoTrack = localStream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.stop();
          }

          // Get new stream with flipped camera
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: currentFacingMode,
              width: { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 },
            },
          });

          const newVideoTrack = newStream.getVideoTracks()[0];

          // Replace the track in local stream
          localStream.removeTrack(videoTrack);
          localStream.addTrack(newVideoTrack);

          // Update the local video element
          document.getElementById("local-video").srcObject = localStream;

          // Replace track in peer connection
          if (peerConnection) {
            const sender = peerConnection
              .getSenders()
              .find((s) => s.track?.kind === "video");
            if (sender) {
              await sender.replaceTrack(newVideoTrack);
            }
          }

          // Update button highlight
          const flipBtn = document.getElementById("flip-camera-btn");
          if (flipBtn) {
            flipBtn.classList.toggle(
              "active",
              currentFacingMode === "environment",
            );
          }

          // Adjust local video mirror for back camera
          const localVideo = document.getElementById("local-video");
          if (localVideo) {
            localVideo.style.transform =
              currentFacingMode === "user" ? "scaleX(-1)" : "scaleX(1)";
          }

          showToast(
            currentFacingMode === "user" ? "Front camera" : "Back camera",
          );
        } catch (err) {
          console.error("Error flipping camera:", err);
          // Revert facing mode
          currentFacingMode =
            currentFacingMode === "user" ? "environment" : "user";
          showToast("Could not switch camera", "error");
        }
      }

      // Toggle fullscreen mode for video call
      function toggleCallFullscreen() {
        const videoContainer = document.getElementById("video-call-view");
        const fullscreenBtn = document.getElementById("fullscreen-btn");

        if (!videoContainer) return;

        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          // Enter fullscreen
          if (videoContainer.requestFullscreen) {
            videoContainer.requestFullscreen().catch((err) => {
              console.log("Fullscreen not available:", err);
              // Fallback for iOS - just toggle a class
              videoContainer.classList.add("fullscreen-mode");
              isCallFullscreen = true;
            });
          } else if (videoContainer.webkitRequestFullscreen) {
            videoContainer.webkitRequestFullscreen();
          } else {
            // Fallback - just use a class
            videoContainer.classList.add("fullscreen-mode");
            isCallFullscreen = true;
          }

          if (fullscreenBtn) {
            fullscreenBtn.querySelector(".material-icons").textContent =
              "fullscreen_exit";
            fullscreenBtn.classList.add("active");
          }
          showToast("Fullscreen mode");
        } else {
          // Exit fullscreen
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
          videoContainer.classList.remove("fullscreen-mode");
          isCallFullscreen = false;

          if (fullscreenBtn) {
            fullscreenBtn.querySelector(".material-icons").textContent =
              "fullscreen";
            fullscreenBtn.classList.remove("active");
          }
        }
      }

      // Listen for fullscreen changes
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );

      function handleFullscreenChange() {
        const fullscreenBtn = document.getElementById("fullscreen-btn");
        const videoContainer = document.getElementById("video-call-view");

        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          isCallFullscreen = false;
          if (fullscreenBtn) {
            fullscreenBtn.querySelector(".material-icons").textContent =
              "fullscreen";
            fullscreenBtn.classList.remove("active");
          }
          if (videoContainer) {
            videoContainer.classList.remove("fullscreen-mode");
          }
        }
      }

      // Toggle speaker (earpiece vs loudspeaker on mobile)
      function toggleSpeaker() {
        const remoteVideo = document.getElementById("remote-video");
        const remoteAudio = document.getElementById("remote-audio");
        const speakerBtn = document.getElementById("speaker-btn");

        isSpeakerOn = !isSpeakerOn;

        // For web audio, we try to set sink ID if supported
        // Most mobile browsers route to speaker by default with video
        if (remoteVideo && typeof remoteVideo.setSinkId === "function") {
          // This is a desktop feature mostly, but we can try
          // On mobile, audio routing is typically handled by the OS
        }

        if (speakerBtn) {
          speakerBtn.classList.toggle("active", !isSpeakerOn);
          speakerBtn.querySelector(".material-icons").textContent = isSpeakerOn
            ? "volume_up"
            : "hearing";
        }

        showToast(isSpeakerOn ? "Speaker" : "Earpiece");
      }

      // Toggle local video PiP expand
      function toggleLocalVideoExpand() {
        const localVideoWrapper = document.getElementById(
          "local-video-wrapper",
        );
        if (!localVideoWrapper) return;

        isLocalVideoExpanded = !isLocalVideoExpanded;
        localVideoWrapper.classList.toggle("expanded", isLocalVideoExpanded);
      }

      // ===== ORIENTATION HANDLING =====
      function handleOrientationChange() {
        if (!currentCall || currentCall.type !== "video") return;

        const videoContainer = document.getElementById("video-call-view");
        const localVideoWrapper = document.getElementById(
          "local-video-wrapper",
        );

        if (!videoContainer) return;

        // Determine orientation
        const isLandscape = window.innerWidth > window.innerHeight;

        // Adjust video fit based on orientation
        const remoteVideo = document.getElementById("remote-video");
        if (remoteVideo) {
          // In landscape, fill the screen; in portrait, contain
          remoteVideo.style.objectFit = isLandscape ? "cover" : "contain";
        }

        // Reset expanded state on orientation change
        if (localVideoWrapper && isLocalVideoExpanded) {
          isLocalVideoExpanded = false;
          localVideoWrapper.classList.remove("expanded");
        }
      }

      // Listen for orientation changes
      window.addEventListener("orientationchange", () => {
        setTimeout(handleOrientationChange, 100); // Delay to let browser settle
      });
      window.addEventListener("resize", debounce(handleOrientationChange, 200));

      // Debounce helper for resize events
      function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
          const later = () => {
            clearTimeout(timeout);
            func(...args);
          };
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
        };
      }

      // ===== MESSAGE SEARCH =====
      let searchPanelOpen = false;

      function toggleSearchPanel() {
        searchPanelOpen = !searchPanelOpen;
        const panel = document.getElementById("search-panel");
        panel.style.display = searchPanelOpen ? "block" : "none";
        if (searchPanelOpen) {
          document.getElementById("search-input").focus();
        }
      }

      function closeSearchPanel() {
        searchPanelOpen = false;
        document.getElementById("search-panel").style.display = "none";
        document.getElementById("search-input").value = "";
        clearSearchHighlight();
      }

      function searchMessages(query) {
        const results = document.getElementById("search-results");

        if (!query.trim()) {
          results.innerHTML =
            '<div class="search-empty">Type to search messages...</div>';
          clearSearchHighlight();
          return;
        }

        const matches = [];
        const lowerQuery = query.toLowerCase();

        for (const [id, msg] of Object.entries(messageCache)) {
          if (
            msg.type === "text" &&
            msg.msg.toLowerCase().includes(lowerQuery)
          ) {
            matches.push(msg);
          }
        }

        if (matches.length === 0) {
          results.innerHTML =
            '<div class="search-empty">No messages found</div>';
          return;
        }

        // Sort by newest first
        matches.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        results.innerHTML = matches
          .slice(0, 20)
          .map((msg) => {
            const highlighted = msg.msg.replace(
              new RegExp(`(${escapeRegex(query)})`, "gi"),
              "<mark>$1</mark>",
            );
            return `
            <div class="search-result-item" onclick="goToSearchResult('${
              msg.id
            }')">
              <div class="search-result-user">${escapeHtml(msg.user)}</div>
              <div class="search-result-text">${highlighted}</div>
            </div>
          `;
          })
          .join("");
      }

      function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }

      function goToSearchResult(id) {
        clearSearchHighlight();
        const row = document.getElementById("row-" + id);
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "center" });
          row.classList.add("search-highlight");
          setTimeout(() => row.classList.remove("search-highlight"), 3000);
        }
        closeSearchPanel();
      }

      function clearSearchHighlight() {
        document.querySelectorAll(".search-highlight").forEach((el) => {
          el.classList.remove("search-highlight");
        });
      }

      // Keyboard shortcut for search
      document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
          e.preventDefault();
          toggleSearchPanel();
        }
      });

      // ===== MESSAGE REACTIONS =====
      const reactionEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

      function showReactionPicker(msgId, event) {
        event.stopPropagation();
        hideAllReactionPickers();

        const bubble = document.querySelector(`#row-${msgId} .bubble`);
        if (!bubble) return;

        let picker = bubble.querySelector(".reaction-picker");
        if (!picker) {
          picker = document.createElement("div");
          picker.className = "reaction-picker";
          picker.innerHTML = reactionEmojis
            .map(
              (emoji) =>
                `<button onclick="addReaction('${msgId}', '${emoji}')">${emoji}</button>`,
            )
            .join("");
          bubble.style.position = "relative";
          bubble.appendChild(picker);
        }

        picker.style.display = "flex";

        setTimeout(() => {
          document.addEventListener("click", hideAllReactionPickers, {
            once: true,
          });
        }, 10);
      }

      function hideAllReactionPickers() {
        document.querySelectorAll(".reaction-picker").forEach((p) => {
          p.style.display = "none";
        });
      }

      function addReaction(msgId, emoji) {
        hideAllReactionPickers();
        ws?.send(
          JSON.stringify({
            type: "reaction_add",
            id: msgId,
            emoji: emoji,
          }),
        );
      }

      function removeReaction(msgId, emoji) {
        ws?.send(
          JSON.stringify({
            type: "reaction_remove",
            id: msgId,
            emoji: emoji,
          }),
        );
      }

      function renderReactions(msgId, reactions) {
        const bubble = document.querySelector(`#row-${msgId} .bubble`);
        if (!bubble) return;

        let container = bubble.querySelector(".reactions-container");
        if (!container) {
          container = document.createElement("div");
          container.className = "reactions-container";
          const metaInfo = bubble.querySelector(".meta-info");
          if (metaInfo) {
            metaInfo.parentNode.insertBefore(container, metaInfo);
          } else {
            bubble.appendChild(container);
          }
        }

        if (!reactions || Object.keys(reactions).length === 0) {
          container.remove();
          return;
        }

        container.innerHTML = Object.entries(reactions)
          .map(([emoji, users]) => {
            const myReaction = users.includes(myUsername);
            return `
            <div class="reaction-badge ${myReaction ? "my-reaction" : ""}" 
                 onclick="toggleReaction('${msgId}', '${emoji}')" 
                 title="${users.join(", ")}">
              <span>${emoji}</span>
              <span class="reaction-count">${users.length}</span>
            </div>
          `;
          })
          .join("");
      }

      function toggleReaction(msgId, emoji) {
        const msg = messageCache[msgId];
        if (!msg || !msg.reactions) {
          addReaction(msgId, emoji);
          return;
        }

        const users = msg.reactions[emoji] || [];
        if (users.includes(myUsername)) {
          removeReaction(msgId, emoji);
        } else {
          addReaction(msgId, emoji);
        }
      }

      // ===== SOUND TOGGLE =====
      function toggleSound() {
        soundEnabled = !soundEnabled;
        localStorage.setItem("soundEnabled", soundEnabled);
        updateSoundToggleUI();
        showToast(soundEnabled ? "Sound enabled" : "Sound muted");
      }

      function updateSoundToggleUI() {
        const btn = document.getElementById("sound-toggle-btn");
        btn.classList.toggle("muted", !soundEnabled);
        btn.querySelector(".material-icons").textContent = soundEnabled
          ? "volume_up"
          : "volume_off";
      }

      // Initialize sound toggle state
      updateSoundToggleUI();

      // ===== HANDLE NEW MESSAGE TYPES IN WEBSOCKET =====
      const _originalHandleMessage = handleMessage;
      handleMessage = function (event) {
        const data = JSON.parse(event.data);

        // Handle call signaling
        if (data.type === "call_incoming") {
          showIncomingCall(data.from, data.callType);
          return;
        }

        if (data.type === "call_accepted") {
          // We are the caller, create offer
          handleCallAccepted();
          return;
        }

        // WebRTC signaling
        if (data.type === "webrtc_offer") {
          handleWebRTCOffer(data.from, data.offer);
          return;
        }

        if (data.type === "webrtc_answer") {
          handleWebRTCAnswer(data.answer);
          return;
        }

        if (data.type === "ice_candidate") {
          handleICECandidate(data.candidate);
          return;
        }

        if (
          data.type === "call_rejected" ||
          data.type === "call_ended" ||
          data.type === "call_cancelled"
        ) {
          cleanupCall();
          closeAllCallModals();
          playCallEndSound();
          if (data.type === "call_rejected") {
            showToast(`${currentCall?.with || "User"} declined the call`);
          } else if (data.type === "call_cancelled") {
            showToast("Call cancelled");
          }
          return;
        }

        // Handle reaction updates
        if (data.type === "reaction_update") {
          if (messageCache[data.id]) {
            messageCache[data.id].reactions = data.reactions;
          }
          renderReactions(data.id, data.reactions);
          return;
        }

        // Play notification sound for new messages from others
        if (
          ["text", "image", "video", "file"].includes(data.type) &&
          data.user !== myUsername
        ) {
          playNotificationSound();
        }

        // Call original handler
        _originalHandleMessage.call(this, event);
      };

      // Close search panel when clicking outside
      document.addEventListener("click", (e) => {
        if (
          !e.target.closest("#search-panel") &&
          !e.target.closest('[onclick*="toggleSearchPanel"]')
        ) {
          if (searchPanelOpen) {
            closeSearchPanel();
          }
        }
      });
