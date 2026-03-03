<template>
  <div class="container">
    <div class="main-content">
      <div class="player-wrapper">
        <div ref="playerContainer" class="player"></div>
      </div>
    </div>

    <!-- Toggle Button -->
    <button class="toggle-button" @click="sidebarOpen = !sidebarOpen">
      {{ sidebarOpen ? '✕' : '☰' }}
    </button>

    <!-- Name Input Modal -->
    <div v-if="showNameModal" class="modal-overlay">
      <div class="modal-dialog">
        <h3>あなたの名前を入力してください</h3>
        <input 
          v-model="userName" 
          type="text" 
          placeholder="名前を入力" 
          class="name-input"
          @keyup.enter="joinRoom"
        />
        <button @click="joinRoom" class="modal-button">参加</button>
      </div>
    </div>

    <!-- Sidebar -->
    <div class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <h3>{{ roomId }} watch party<span v-if="userId===roomState.leader">👑</span></h3>
      </div>

      <!-- Tabs -->
      <div class="sidebar-tabs">
        <button 
          @click="activeTab = 'queue'" 
          :class="{ active: activeTab === 'queue' }"
          class="tab-button"
        >
          Queue
        </button>
        <button 
          @click="activeTab = 'settings'" 
          :class="{ active: activeTab === 'settings' }"
          class="tab-button"
        >
          Settings
        </button>
        <button 
          v-if="userId === roomState.leader"
          @click="activeTab = 'leader'" 
          :class="{ active: activeTab === 'leader' }"
          class="tab-button leader-tab"
        >
          Commands
        </button>
      </div>

      <div class="sidebar-content">
        <!-- Queue Tab -->
        <div v-if="activeTab === 'queue'" class="tab-content">
          <div class="input-section">
            <input v-model="videoUrl" placeholder="YouTube URL" class="url-input" />
            <button @click="addVideo" class="add-button">Add</button>
          </div>

          <div v-if="!hideQueue" class="queue-display">
            <draggable
              v-model="roomState.queue"
              item-key="id"
              @end="onReorder"
              class="queue-container"
            >
              <template #item="{ element }">
                <div class="queue-item">
                  <img :src="element.thumbnail" width="80" />
                  <div class="queue-item-info">
                    <div class="queue-item-title">{{ element.title }}</div>
                    <div class="queue-item-user">{{ element.userName }}</div>
                  </div>
                </div>
              </template>
            </draggable>

            <div v-if="roomState.historyQueue.length > 0" class="history-section">
              <h4>再生済み</h4>
              <div class="history-queue-container">
                <div v-for="element in roomState.historyQueue" :key="`history-${element.id}`" class="queue-item">
                  <img :src="element.thumbnail" width="80" />
                  <div class="queue-item-info">
                    <div class="queue-item-title">{{ element.title }}</div>
                    <div class="queue-item-user">{{ element.userName }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="queue-hidden-message">
            <p>⚠️ Queue is hidden by the leader</p>
          </div>
        </div>

        <!-- Settings Tab -->
        <div v-if="activeTab === 'settings'" class="tab-content">
          <div class="settings-section">
            <h4>Settings</h4>
            <!-- <div class="setting-item">
              <label>
                <input type="checkbox" v-model="enableChatSync" />
                Enable chat sync
              </label>
            </div> -->
          </div>

          <div class="members-section">
            <h4>Members ({{ roomState.members.length }})</h4>
            <div class="members-list">
              <div v-for="member in roomState.members" :key="member.id" class="member-item">
                <span>{{ member.name || 'Anonymous' }}</span>
                <span v-if="member.id === roomState.leader" class="leader-badge">Leader</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Leader Commands Tab -->
        <div v-if="activeTab === 'leader' && userId === roomState.leader" class="tab-content">
          <div class="leader-commands">
            <h4>Leader Commands</h4>
            <button @click="skipToNextVideo" class="command-button danger-button">
              Skip to next video
            </button>
          </div>

          <div class="leader-settings">
            <h4>Leader Settings</h4>
            <div class="setting-item">
              <label>
                <input type="checkbox" v-model="hideQueue" @change="toggleHideQueue" />
                Hide queue
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" v-model="hideVideo" @change="toggleOpacity" />
                Hide video
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue"
import { useRoute } from "vue-router"
import { io } from "socket.io-client"
import draggable from "vuedraggable"

const route = useRoute()
const roomId = route.params.roomId
const socket = io("http://localhost:3000")

const roomState = ref({
  members: [],
  leader: null,
  currentVideoId: null,
  queue: [],
  historyQueue: [],
})
const videoUrl = ref("")
const playerContainer = ref(null)
const sidebarOpen = ref(true)
const userId = ref("")
const activeTab = ref("queue")
const hideQueue = ref(false)
const hideVideo = ref(false)
const userName = ref("")
const showNameModal = ref(false)
let player = null
let partyState = "waiting" // waiting, preparing, playing, pausing, catching-up
let currentVideoStartTime = null

function extractVideoId(url) {
  const reg = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/
  const match = url.match(reg)
  return match ? match[1] : null
}

function addVideo() {
  const id = extractVideoId(videoUrl.value)
  if (!id) return
  socket.emit("add-video", { roomId, videoId: id })
  videoUrl.value = ""
}

function onReorder() {
  socket.emit("reorder-queue", { roomId, queue: roomState.value.queue })
}

function skipToNextVideo() {
  socket.emit("video-ended", { roomId })
  partyState = "waiting"
}

function toggleOpacity() {
  socket.emit("toggle-opacity", { roomId })
}

socket.on("sync-hide-queue", (state) => {
  hideQueue.value = state.hideQueue
})

function toggleHideQueue() {
  socket.emit("toggle-hide-queue", { roomId })
}

socket.on("sync-opacity", (state) => {
  console.log("Updating opacity to:", state.opacity)
  hideVideo.value = state.opacity === "0" || state.opacity === 0
  changeOpacity(state.opacity)
})

function changeOpacity (opacity) {
  const iframe = player.getIframe()
  iframe.style.opacity = opacity
  // opacityが0の時にクリック不可にする
  iframe.style.pointerEvents = opacity === "0" || opacity === 0 ? "none" : "auto"
}

function joinRoom() {
  const name = userName.value.trim() || "Anonymous"
  socket.emit("join-room", { roomId, name })
  showNameModal.value = false
}

function startPlayback(timestamp) {
  const latency = (Date.now() - timestamp) / 1000
  player.seekTo(latency)
  player.playVideo()
  partyState = "willplay"
}

socket.on("room-init", (state) => {
  userId.value = socket.id
  hideQueue.value = state.hideQueue
  hideVideo.value = state.opacity === "0" || state.opacity === 0
  changeOpacity(state.opacity)
  if (state.currentVideoId) {
    partyState = "catching-up"
    currentVideoStartTime = state.currentVideoStartTime
    player.cueVideoById(state.currentVideoId)
  }
})

socket.on("sync-stats", (state) => {
  roomState.value = state
})

socket.on("queue-updated", (obj) => {
  console.log(obj.historyQueue)
  roomState.value.queue = obj.queue
  roomState.value.historyQueue = obj.historyQueue
})

socket.on("prepare-video", ({ videoId }) => {
  partyState = "preparing"
  player.cueVideoById(videoId)
})

socket.on("start-playback", ({ timestamp }) => {
  startPlayback(timestamp)
})

socket.on("video-sync-state", ({ states,fixedStartTime }) => {
  roomState.value.currentVideoStartTime = fixedStartTime
  if (states === "pausing") {
    partyState = "willpausing"
    player.pauseVideo()
  } else if (states === "playing") {
    startPlayback(fixedStartTime)
  }
})

onMounted(() => {
  const tag = document.createElement("script")
  tag.src = "https://www.youtube.com/iframe_api"
  document.body.appendChild(tag)

  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player(playerContainer.value, {
      videoId: "",
      playerVars: {
        rel: 0,
        modestbranding: 1
      },
      events: {
        onReady: () => {
          const iframe = player.getIframe()
          iframe.style.width = "100%"
          iframe.style.height = "100%"
          iframe.style.position = "absolute"
          iframe.style.top = "0"
          iframe.style.left = "0"
          showNameModal.value = true
        },
        onStateChange: (event) => {
          console.log("Player state changed:", event.data)
          if (event.data === YT.PlayerState.ENDED) {
            socket.emit("video-ended", { roomId })
            partyState = "waiting"
          }
          if (event.data === YT.PlayerState.CUED ) {
            if (partyState === "catching-up") {
              partyState = roomState.value.currentVideoStatus
              if (partyState === "playing") {
                startPlayback(currentVideoStartTime)
              }
            } else if (partyState === "preparing") {
              socket.emit("video-loaded", { roomId })
            }
          }
          if(event.data === YT.PlayerState.PAUSED){
            if(partyState === "playing"){
              if (userId.value===roomState.value.leader) {
                socket.emit("video-state-change", { roomId, states: "pausing" })
              }
              player.playVideo()
            }
            if(partyState === "willpausing"){
              partyState = "pausing"
            }
          }
          if(event.data === YT.PlayerState.PLAYING){
            if(partyState === "pausing"){
              if (userId.value===roomState.value.leader) {
                socket.emit("video-state-change", { roomId, states: "playing" })
              }
              player.pauseVideo()
            }
            if(partyState === "willplay"){
              partyState = "playing"
            }
          }
        }
      }
    })
  }

  window.addEventListener("resize", () => {
    if (player) {
      const iframe = player.getIframe()
      iframe.style.width = "100%"
      iframe.style.height = "100%"
    }
  })
})
</script>

<style scoped>
.container {
  display: flex;
  height: min(98vh); /* 縦幅の計算 */ 
  overflow: hidden;
  background: #fff;
}

/* -------- MAIN -------- */

.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.main-content h2 {
  margin: 0;
  padding: 0;
  font-size: 1.5rem;
  flex-shrink: 0;
}

/* Responsive Player */

.player-wrapper {
  position: relative;
  flex: 1;

  /* 横は最大100% */
  width: 100%;

  /* 16:9維持 */
  aspect-ratio: 16 / 9;

  background: black;
  overflow: hidden;

  /* 中央寄せ */
  margin: 0 auto;
}

.player {
  width: 100%;
  height: 100%;
}

/* -------- TOGGLE -------- */

.toggle-button {
  position: fixed;
  right: 0px;
  top: 10px;
  z-index: 1001;
  width: 40px;
  height: 40px;
  background: #333;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 20px;
  cursor: pointer;
}

.toggle-button:hover {
  background: #555;
}

/* -------- SIDEBAR -------- */

.sidebar {
  position: fixed;
  right: 0;
  top: 0;
  width: 350px;
  height: 100vh;
  background: #f9f9f9;
  border-left: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease-in-out;
  z-index: 1000;
  transform: translateX(100%);
}

.sidebar.open {
  transform: translateX(0);
}

.sidebar-header {
  padding: 15px 20px;
  border-bottom: 1px solid #ddd;
  text-align: center;
}

/* -------- TABS -------- */

.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid #ddd;
  background: #fff;
}

.tab-button {
  flex: 1;
  padding: 12px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  transition: all 0.2s;
}

.tab-button:hover {
  background: #f0f0f0;
  color: #333;
}

.tab-button.active {
  color: #4CAF50;
  border-bottom-color: #4CAF50;
}

.tab-button.leader-tab {
  color: #ff9800;
}

.tab-button.leader-tab.active {
  color: #ff9800;
  border-bottom-color: #ff9800;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

/* -------- TAB CONTENT -------- */

.tab-content {
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* -------- SETTINGS -------- */

.settings-section,
.members-section,
.leader-commands {
  margin-bottom: 20px;
}

.settings-section h4,
.members-section h4,
.leader-commands h4 {
  margin: 0 0 15px 0;
  font-size: 14px;
  color: #333;
}

.setting-item {
  padding: 10px;
  margin-bottom: 8px;
  background: white;
  border: 1px solid #eee;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.setting-item label {
  display: flex;
  align-items: center;
  cursor: pointer;
  gap: 8px;
  width: 100%;
}

.setting-item input[type="checkbox"] {
  cursor: pointer;
}

/* -------- MEMBERS -------- */

.members-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: white;
  border: 1px solid #eee;
  border-radius: 4px;
  font-size: 13px;
}

.leader-badge {
  background: #ff9800;
  color: white;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}

/* -------- LEADER COMMANDS -------- */

.command-button {
  width: 100%;
  padding: 12px;
  margin-bottom: 8px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.command-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.success-button {
  background: #4CAF50;
  color: white;
}

.success-button:hover {
  background: #45a049;
}

.danger-button {
  background: #f44336;
  color: white;
}

.danger-button:hover {
  background: #da190b;
}

.warning-button {
  background: #ff9800;
  color: white;
}

.warning-button:hover {
  background: #e68900;
}

/* -------- LEADER SETTINGS -------- */

.leader-settings {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #ddd;
}

.leader-settings h4 {
  margin: 0 0 15px 0;
  font-size: 14px;
  color: #333;
}

/* -------- QUEUE DISPLAY -------- */

.queue-hidden-message {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.queue-hidden-message p {
  margin: 0;
  font-size: 14px;
}

/* -------- INPUT -------- */

.input-section {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.url-input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.add-button {
  padding: 10px 15px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-button:hover {
  background: #45a049;
}

/* -------- QUEUE -------- */

.queue-container {
  padding: 0;
  margin: 0;
}

.history-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #ddd;
}

.history-section h4 {
  margin: 0 0 15px 0;
  font-size: 14px;
  color: #333;
}

.history-queue-container {
  padding: 0;
  margin: 0;
}

.queue-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  margin: 8px 0;
  background: white;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: grab;
}

.queue-item:hover {
  background: #f5f5f5;
}

.queue-item img {
  border-radius: 3px;
}

.queue-item-info {
  flex: 1;
  min-width: 0;
}

.queue-item-title {
  font-size: 13px;
  word-break: break-word;
}

.queue-item-user {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

/* -------- MOBILE -------- */

/* -------- MODAL -------- */

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-dialog {
  background: white;
  border-radius: 8px;
  padding: 30px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease-out;
}

.modal-dialog h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #333;
  text-align: center;
}

.name-input {
  width: 100%;
  padding: 12px;
  margin-bottom: 20px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.name-input:focus {
  outline: none;
  border-color: #4CAF50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
}

.modal-button {
  width: 100%;
  padding: 12px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.modal-button:hover {
  background: #45a049;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .sidebar {
    width: 100%;
  }

  .toggle-button {
    right: 15px;
    top: 15px;
  }
}
</style>