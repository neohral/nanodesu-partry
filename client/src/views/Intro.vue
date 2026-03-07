<template>
  <div class="container">
    <div class="main-content">
      <div class="player-wrapper">
        <div ref="playerContainer" class="player"></div>
        <!-- 出題者または回答ユーザー表示 -->
        <div
          v-if="answeringUser.length === 0 && currentGamemaster && gameStarted"
          class="answering-overlay"
        >
          <div class="answering-card">
            <p class="answering-label">出題者📺</p>
            <p class="answering-name">
              {{ currentGamemaster.name || "Anonymous" }}
            </p>
          </div>
        </div>
        <div v-else-if="answeringUser.length > 0" class="answering-overlay">
          <div class="answering-card">
            <p class="answering-label">回答中...⏰</p>
            <p class="answering-name">
              {{ answeringUser[0].name || "Anonymous" }}
            </p>
          </div>
        </div>
        <!-- ゲーム開始カウントダウン -->
        <div v-if="preGameCountdown > 0" class="pregame-overlay">
          <div class="pregame-card">
            <p class="pregame-label">ゲーム開始まで</p>
            <p class="pregame-countdown">{{ preGameCountdown }}</p>
            <div class="countdown-bar">
              <div
                class="countdown-progress"
                :style="{ width: (preGameCountdown / 10) * 100 + '%' }"
              ></div>
            </div>
          </div>
        </div>
        <!-- 正解者表示 -->
        <div v-if="correctAnswerUser" class="correct-answer-overlay">
          <div class="correct-answer-card">
            <p class="correct-label">🎉 正解!</p>
            <p class="correct-name">
              {{ correctAnswerUser.name || "Anonymous" }}
            </p>
            <div class="countdown">
              <p class="countdown-text">{{ countdown }}秒後に次へ</p>
              <div class="countdown-bar">
                <div
                  class="countdown-progress"
                  :style="{ width: (countdown / 5) * 100 + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>
        <!-- ゲーム終了画面 -->
        <div
          v-if="gameEnded"
          class="game-end-overlay"
          @click="gameEnded = false"
        >
          <div class="game-end-card" @click.stop>
            <button class="game-end-close" @click="gameEnded = false">✕</button>
            <h2 class="game-end-title">🏆 ゲーム終了!</h2>
            <div class="final-scores">
              <div
                v-for="(member, index) in sortedMembers"
                :key="member.id"
                class="score-item"
              >
                <span class="score-rank">{{ index + 1 }}位</span>
                <span class="score-name">{{ member.name || "Anonymous" }}</span>
                <span class="score-value">{{ member.score || 0 }}点</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toggle Button -->
    <button class="toggle-button" @click="sidebarOpen = !sidebarOpen">
      {{ sidebarOpen ? "✕" : "☰" }}
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
        <h3>
          {{ roomId }} intro party<span v-if="userId === roomState.leader"
            >👑</span
          >
        </h3>
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
            <input
              v-model="videoUrl"
              placeholder="YouTube URL"
              class="url-input"
            />
            <input
              v-model.number="videoSeekTo"
              type="number"
              placeholder="開始時間（秒）"
              class="seek-input"
              min="0"
            />
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

            <div
              v-if="roomState.historyQueue.length > 0"
              class="history-section"
            >
              <h4>再生済み</h4>
              <div class="history-queue-container">
                <div
                  v-for="element in roomState.historyQueue"
                  :key="`history-${element.id}`"
                  class="queue-item"
                >
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
          <div class="player-section">
            <h4>Youtube Player</h4>
            <div v-if="gamemaster">
              <div class="setting-item">
                <label>
                  <input
                    type="checkbox"
                    v-model="hideVideo"
                    @change="toggleOpacity"
                  />
                  Hide video
                </label>
              </div>
              <button @click="togglePlayPause" class="control-button">
                {{ partyState === "pausing" ? "▶ 再生" : "⏸ 一時停止" }}
              </button>
            </div>
            <div class="volume-control">
              <label for="volume-slider">音量:</label>
              <input
                id="volume-slider"
                v-model.number="volume"
                type="range"
                min="0"
                max="100"
                @input="setVolume"
                class="volume-slider"
              />
              <span class="volume-value">{{ volume }}</span>
            </div>
          </div>
          <div class="settings-section">
            <h4>Intro</h4>
            <div v-if="gamemaster" class="gamemaster-buttons">
              <div class="answer-buttons">
                <button
                  @click="correctAnswer"
                  :disabled="answeringUser.length === 0"
                  class="intro-button gamemaster-correct-button"
                >
                  正解
                </button>
                <button
                  @click="incorrectAnswer"
                  :disabled="answeringUser.length === 0"
                  class="intro-button gamemaster-correct-button"
                >
                  不正解
                </button>
              </div>
              <button
                @click="quizSkipToNextVideo"
                class="intro-button gamemaster-incorrect-button"
              >
                スキップ
              </button>
            </div>
            <button
              v-else
              @click="answerQuestion"
              :disabled="
                !gameStarted ||
                (answeringUser && answeringUser.find((m) => m.id === userId)) ||
                answerCooldown > 0
              "
              class="intro-button player-button"
            >
              早押し{{ answerCooldown > 0 ? ` (${answerCooldown}s)` : "" }}
            </button>
          </div>

          <div class="members-section">
            <h4>Members ({{ roomState.members.length }})</h4>
            <div class="members-list">
              <div
                v-for="member in roomState.members"
                :key="member.id"
                class="member-item"
                :class="{ 'has-video': member.video }"
              >
                <div class="member-name-wrapper">
                  <span>{{ member.name || "Anonymous" }}</span>
                  <span class="member-score">{{ member.score || 0 }}</span>
                  <!-- <span v-if="member.video" class="video-indicator"></span> -->
                </div>
                <span v-if="member.id === roomState.leader" class="leader-badge"
                  >Leader</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Leader Commands Tab -->
        <div
          v-if="activeTab === 'leader' && userId === roomState.leader"
          class="tab-content"
        >
          <div class="leader-commands">
            <h4>Leader Commands</h4>
            <button
              @click="startGame"
              :disabled="!allMembersHaveVideo"
              class="command-button success-button"
            >
              game start
            </button>
            <button
              @click="skipToNextVideo"
              class="command-button danger-button"
            >
              Skip to next video
            </button>
          </div>

          <div class="leader-settings">
            <h4>Leader Settings</h4>
            <div class="setting-item">
              <label>
                <input
                  type="checkbox"
                  v-model="hideQueue"
                  @change="toggleHideQueue"
                />
                Hide queue
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input
                  type="checkbox"
                  v-model="hideVideo"
                  @change="toggleOpacity"
                />
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
import '@/styles/nanodesu.css'
import '@/styles/intro.css'
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { io } from "socket.io-client";
import draggable from "vuedraggable";
import { useRoom } from "../composables/room";
import clickSound from '@/aseets/sounds/click.mp3'
import correctSound from '@/aseets/sounds/correct.mp3'
import incorrectSound from '@/aseets/sounds/incorrect.mp3'

const route = useRoute();
const roomId = route.params.roomId;
const socket = io(import.meta.env.VITE_SOCKET_INTRO_URL,{
  path: import.meta.env.VITE_SOCKET_INTRO_PATH
})

const roomState = ref({
  members: [],
  leader: null,
  currentVideoId: null,
  queue: [],
  historyQueue: [],
});
const playerContainer = ref(null);
const sidebarOpen = ref(true);
const activeTab = ref("queue");
const gamemaster = ref(false);
const gameStarted = ref(false);
const answeringUser = ref([]);
const correctAnswerUser = ref(null);
const countdown = ref(0);
const answerCooldown = ref(0);
const volume = ref(1);
const gameEnded = ref(false);
const preGameCountdown = ref(0);
const clickSoundAudio = new Audio(clickSound)
const correctAudio = new Audio(correctSound)
const incorrectAudio = new Audio(incorrectSound)

const playerRef = ref(null);
let player = null;

const changeOpacity = (opacity)=> {
  if (hideVideo.value && gamemaster.value) {
    opacity = 0.1;
  }
  const iframe = player.getIframe();
  iframe.style.opacity = opacity;
}

const {
  userId,
  currentVideoStartTime,
  currentVideoPauseTime,
  currentVideoSeekTo,
  videoSeekTo,
  userName,
  hideQueue,
  hideVideo,
  showNameModal,
  videoUrl,
  playerPaused,
  partyState,
  joinRoom,
  onReorder,
  addVideo,
  startPlayback,
  skipToNextVideo,
  eventRegister,
  toggleOpacity,
  toggleHideQueue,
  stateChange,
} = useRoom(socket, roomId, roomState, playerRef, changeOpacity);

const allMembersHaveVideo = computed(() => {
  return (
    roomState.value.members.length > 0 &&
    roomState.value.members.every((member) => member.video)
  );
});

const sortedMembers = computed(() => {
  return [...roomState.value.members].sort(
    (a, b) => (b.score || 0) - (a.score || 0),
  );
});

const currentGamemaster = computed(() => {
  return roomState.value.members.find(
    (m) => m.id === roomState.value.gameMaster,
  );
});

eventRegister(io, socket, roomState);

function quizSkipToNextVideo() {
  if (partyState.value === "playing") {
    socket.emit("user-answered-skip", { roomId });
    partyState.value = "waiting";
  }
}

function answerQuestion() {
  socket.emit("answer-question", { roomId, userId: userId.value });
}

function correctAnswer() {
  const score =
    Math.round(
      (100 - ((player.getCurrentTime() - currentVideoSeekTo.value) / (player.getDuration() - currentVideoSeekTo.value)) * 100) * 10,
    ) / 10;
  socket.emit("gamemaster-answer", { roomId, correct: true, score });
}

function incorrectAnswer() {
  socket.emit("gamemaster-answer", { roomId, correct: false, score: 0 });
}

function startGame() {
  socket.emit("pre-game-start", { roomId });
}

function togglePlayPause() {
  if (partyState.value === "pausing") {
    socket.emit("video-state-change", { roomId, states: "playing" });
  } else {
    socket.emit("video-state-change", { roomId, states: "pausing" });
  }
}

function setVolume() {
  if (player) {
    player.setVolume(volume.value);
  }
}

socket.on("change-game-status", (gameStatus) => {
  gameStarted.value = gameStatus === "playing" ? true : false;
});

socket.on("user-answered", ({ users, isAddAnswered }) => {
  if(isAddAnswered){
    clickSoundAudio.play()
  }
  answeringUser.value = users;
});

socket.on("prepare-video", ({ videoId, seekTo, user, opacity }) => {
  roomState.value.gameMaster = user;
  gamemaster.value = user === userId.value;
  roomState.value.opacity = opacity
  hideVideo.value = opacity === 0;
  changeOpacity(roomState.value.opacity);
  partyState.value = "preparing";
  currentVideoSeekTo.value = seekTo
  player.cueVideoById(videoId,currentVideoSeekTo.value);
});

socket.on("user-answered-skip", () => {
  correctAnswerUser.value = { name: "正解者無し" };
  countdown.value = 10;
  const countdownInterval = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearInterval(countdownInterval);
      correctAnswerUser.value = null;
      // 次の問題へ
      if (socket.id === roomState.value.leader) {
        socket.emit("video-ended", { roomId });
      }
    }
  }, 1000);
});
socket.on("user-answered-result", ({ user, correct }) => {
  if (correct) {
    correctAudio.play()
    correctAnswerUser.value = user;
    answeringUser.value = [];
    countdown.value = 10;
    const countdownInterval = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        clearInterval(countdownInterval);
        correctAnswerUser.value = null;
        // 次の問題へ
        if (socket.id === roomState.value.leader) {
          socket.emit("next-question", { roomId });
        }
      }
    }, 1000);
  } else {
    incorrectAudio.play()
    // 不正解の場合は3秒間早押しボタンを押せないようにする
    if (user.id === userId.value) {
      answerCooldown.value = 3;
      const cooldownInterval = setInterval(() => {
        answerCooldown.value--;
        if (answerCooldown.value <= 0) {
          clearInterval(cooldownInterval);
        }
      }, 1000);
    }
  }
});

socket.on("end-game", () => {
  gameEnded.value = true;
  partyState.value = "waiting";
});

socket.on("pre-game-start", () => {
  preGameCountdown.value = 5;
  const countdownInterval = setInterval(() => {
    preGameCountdown.value--;
    if (preGameCountdown.value <= 0) {
      clearInterval(countdownInterval);
      if (userId.value === roomState.value.leader) {
        socket.emit("start-game", { roomId });
      }
    }
  }, 1000);
});

onMounted(() => {
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.body.appendChild(tag);

  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player(playerContainer.value, {
      videoId: "",
      playerVars: {
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: () => {
          playerRef.value = player;
          const iframe = player.getIframe();
          iframe.style.width = "100%";
          iframe.style.height = "100%";
          iframe.style.position = "absolute";
          iframe.style.top = "0";
          iframe.style.left = "0";
          iframe.style.pointerEvents = "none";
          volume.value = player.getVolume();
          showNameModal.value = true;
        },
        onStateChange: (event) => {
          stateChange(event)
        },
      },
    });
  };

  window.addEventListener("resize", () => {
    if (player) {
      const iframe = player.getIframe();
      iframe.style.width = "100%";
      iframe.style.height = "100%";
    }
  });
});
</script>