import { ref } from "vue"
export function useRoom(socket, roomId, roomStateRef) {
    const videoUrl = ref("")
    function onReorder() {
        socket.emit("reorder-queue", { roomId, queue: roomStateRef.value.queue })
    }

    function addVideo() {
        console.log("add")
        const id = extractVideoId(videoUrl.value)
        if (!id) return
        socket.emit("add-video", { roomId, videoId: id })
        videoUrl.value = ""
    }

    function extractVideoId(url) {
        const reg = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/
        const match = url.match(reg)
        return match ? match[1] : null
    }

    return {
        videoUrl,
        onReorder,
        addVideo,
        extractVideoId
    }
}