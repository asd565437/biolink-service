import fs from "fs";
import axios from "axios";
import { Midjourney } from "midjourney";

const downloadImage = async (url, filepath) => {
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

const main = async () => {
  const client = new Midjourney({
    ServerId: process.env.MID_SERVER_ID, // 替换为你的 ServerId
    ChannelId: process.env.MID_CHANNEL_ID, // 替换为你的 ChannelId
    SalaiToken: process.env.MID_SALAI_TOKEN, // 替换为你的 SalaiToken
    Debug: true,
    Ws: true,
  });

  try {
    await client.Connect();

    const Imagine = await client.Imagine("An artistic, abstract representation of the organic pattern of a cell nucleus in a petri dish. The design is characterized by soft radiating structures, concentric layers and delicate flowing textures. The style is dreamy and futuristic, with gradient shades of blue and purple. The compositions of the works emphasize elegance and harmony, with subtle luminous effects and fine-grained or dotted textures that avoid any resemblance to real bacteria or microorganisms. The result feels ethereal, minimalistic, and inspired by nature’s fluid patterns and cosmic aesthetics.", (uri, progress) => {
      console.log("Imagine progress:", progress);
    });
    
    // 选择某一张图片进行放大处理
    const selectedIndex = 1; // 选择第 1 张图片（索引从 1 开始）
    const Upscale = await client.Upscale({
      index: selectedIndex,
      msgId: Imagine.id,
      hash: Imagine.hash,
      flags: Imagine.flags,
    });

    console.log("Upscale result:", Upscale);

    if (Upscale.uri) {
      const imageUrl = Upscale.uri;
      const outputPath = `./output/test_${selectedIndex}.jpg`; // 保存单张图片

      // 确保输出目录存在
      if (!fs.existsSync("./output")) {
        fs.mkdirSync("./output");
      }

      console.log("Downloading image...");
      await downloadImage(imageUrl, outputPath);
      console.log(`Image saved to ${outputPath}`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
};

main();
