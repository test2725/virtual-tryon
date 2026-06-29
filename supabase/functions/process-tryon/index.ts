import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { job_id, person_image_b64, garment_image_b64, garment_type } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const COMFYUI_URL = Deno.env.get("COMFYUI_URL") || "http://localhost:8188";

  try {
    // 1. 人物画像アップロード
    const personBlob = base64ToBlob(person_image_b64);
    const personForm = new FormData();
    personForm.append("image", personBlob, "person.jpg");
    const personRes = await fetch(`${COMFYUI_URL}/upload/image`, { method: "POST", body: personForm });
    const personData = await personRes.json();
    const personName = personData.name;

    // 2. 衣服画像アップロード
    const garmentBlob = base64ToBlob(garment_image_b64);
    const garmentForm = new FormData();
    garmentForm.append("image", garmentBlob, "garment.jpg");
    const garmentRes = await fetch(`${COMFYUI_URL}/upload/image`, { method: "POST", body: garmentForm });
    const garmentData = await garmentRes.json();
    const garmentName = garmentData.name;

    // 3. ワークフロー送信
    const workflow = buildWorkflow(personName, garmentName, garment_type || "upper_body");
    const promptRes = await fetch(`${COMFYUI_URL}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });
    const { prompt_id } = await promptRes.json();

    // 4. 結果ポーリング（最大5分）
    const resultImage = await pollResult(COMFYUI_URL, prompt_id);

    // 5. Supabase更新
    await supabase.from("tryon_jobs").update({
      status: "completed",
      result_image: resultImage,
    }).eq("id", job_id);

  } catch (err) {
    await supabase.from("tryon_jobs").update({
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    }).eq("id", job_id);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

function base64ToBlob(b64: string): Blob {
  const binary = atob(b64.split(",")[1] || b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "image/jpeg" });
}

async function pollResult(comfyUrl: string, promptId: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(`${comfyUrl}/history/${promptId}`);
    const history = await res.json();
    if (history[promptId]?.outputs) {
      const outputs = history[promptId].outputs;
      for (const nodeId in outputs) {
        const images = outputs[nodeId]?.images;
        if (images?.length > 0) {
          const img = images[0];
          const imgRes = await fetch(`${comfyUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`);
          const buf = await imgRes.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          return `data:image/png;base64,${b64}`;
        }
      }
    }
  }
  throw new Error("Timeout: ComfyUI processing took too long");
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
        "seed": 42,
      },
    },
    "5": { "class_type": "SaveImage", "inputs": { "images": ["4", 0], "filename_prefix": "tryon" } },
  };
}