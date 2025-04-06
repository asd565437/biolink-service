const axios = require('axios');
require('dotenv').config();

const PIKA_API_URL = 'https://api.pikapikapika.io/web/generate';
const PIKA_API_TOKEN = 'cd93dac8-e90e-4f23-a6fe-f0dc2afb4b8d'; // 確保你的 .env 文件中有這個 API Key

async function generateVideo(imageURL) {
    const requestData = {
        promptText: "move it",
        model: "Turbo",
        image: imageURL,
        options: {
            frameRate: 24,
            parameters: {
                guidanceScale: 12,
                motion: 1,
                negativePrompt: "",
                seed: 52525
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

        console.log('生成的影片 jobID:', response.data);
    } catch (error) {
        console.error('請求失敗:', error.response ? error.response.data : error.message);
    }
}

// 測試 API 呼叫
generateVideo("https://biolink-pic.s3.us-east-1.amazonaws.com/midjourney/0003.png");
