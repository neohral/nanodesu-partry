require("dotenv").config()
const axios = require("axios")
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

async function fetchVideoInfo(videoId) {
  const url = "https://www.googleapis.com/youtube/v3/videos"
  const res = await axios.get(url, {
    params: {
      part: "snippet",
      id: videoId,
      key: YOUTUBE_API_KEY
    }
  })

  const item = res.data.items[0]
  if (!item) return null

  return {
    videoId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails.medium.url
  }
}
module.exports = {
  fetchVideoInfo
}