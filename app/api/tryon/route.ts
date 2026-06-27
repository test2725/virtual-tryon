import { NextRequest, NextResponse } from 'next/server';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const personFile = formData.get('person') as File;
    const garmentFile = formData.get('garment') as File;
    const garmentType = formData.get('garment_type') as string || 'shirt';

    if (!personFile || !garmentFile) {
      return NextResponse.json({ error: '画像が必要です' }, { status: 400 });
    }

    // 人物画像をComfyUIにアップロード
    const personForm = new FormData();
    personForm.append('image', personFile);
    const personUpload = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: personForm,
    });
    const personData = await personUpload.json();
    const personName = personData.name;

    // 服画像をComfyUIにアップロード
    const garmentForm = new FormData();
    garmentForm.append('image', garmentFile);
    const garmentUpload = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: garmentForm,
    });
    const garmentData = await garmentUpload.json();
    const garmentName = garmentData.name;

    // ワークフローを実行
    const workflow = buildWorkflow(personName, garmentName, garmentType);
    const promptRes = await fetch(`${COMFYUI_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });
    const promptData = await promptRes.json();
    const promptId = promptData.prompt_id;

    // 結果を待つ
    let resultImage = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const historyRes = await fetch(`${COMFYUI_URL}/history/${promptId}`);
      const history = await historyRes.json();
      if (history[promptId]?.outputs) {
        const outputs = history[promptId].outputs;
        for (const nodeId in outputs) {
          if (outputs[nodeId].images) {
            resultImage = outputs[nodeId].images[0];
            break;
          }
        }
        if (resultImage) break;
      }
    }

    if (!resultImage) {
      return NextResponse.json({ error 'タイムアウトしました' }, { status: 500 });
    }

    // 画像を取得してBase64で返す
    const imageRes = await fetch(
      `${COMFYUI_URL}/view?filename=${resultImage.filename}&subfolder=${resultImage.subfolder}&type=${resultImage.type}`
    );
    const imageBuffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');

    return NextResponse.json({ image: `data:image/png;base64,${base64}` });
  } catch (error) {
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 });
  }
}

function buildWorkflow(personName: string, garmentName: string, garmentType: string) {
  return {
    "1": { "class_type": "LoadImage", "inputs": { "image": personName } },
    "2": { "class_type": "LoadImage", "inputs": { "image": garmentName } },
    "3": { "class_type": "Load IDM-VTON Pipeline", "inputs": { "weight_dtype": "fp16" } },
    "4": {
      "class_type": "Run IDM-VTON Inference",
      "inputs": {
        "pipeline": ["3", 0],
        "human_img": ["1", 0],
        "garment_img": ["2", 0],
        "garment_des": `a ${garmentType}`,
        "is_checked": true,
        "is_checked_crop": false,
        "denoise_steps": 15,
        "seed": 42
      }
    },
    "5": { "class_type": "SaveImage", "inputs": { "images": ["4", 0], "filename_prefix": "tryon" } }
  };
}