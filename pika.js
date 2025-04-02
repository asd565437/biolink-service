const axios = require('axios');
require('dotenv').config();

const PIKA_API_URL = 'https://api.pikapikapika.io/web/generate';
const PIKA_API_TOKEN = '8d2da916-ef6d-4747-8f34-16664d759225'; // 確保你的 .env 文件中有這個 API Key

async function generateVideo(imageURL) {
    const requestData = {
        promptText: "move it",
        model: "1.5",
        image: imageURL,
        options: {
            frameRate: 24,
            parameters: {
                guidanceScale: 12,
                motion: 1,
                negativePrompt: "",
                seed: null
            },
            extend: false
        }
    };

    try {
        const response = await axios.post(
            PIKA_API_URL,
            requestData,
            {
                headers: {
                    'Authorization': `Bearer ${PIKA_API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('生成的影片 URL:', response.data.job.id);
    } catch (error) {
        console.error('請求失敗:', error.response ? error.response.data : error.message);
    }
}

// 測試 API 呼叫
generateVideo();
