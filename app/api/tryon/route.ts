import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const personFile = formData.get('person') as File;
    const garmentFile = formData.get('garment') as File;
    const garmentType = formData.get('garmentType') as string || 'upper_body';

    if (!personFile || !garmentFile) {
      return NextResponse.json({ error: 'Missing files' }, { status: 400 });
    }

    // Insert job into Supabase
    const { data: job, error } = await supabase
      .from('tryon_jobs')
      .insert({ status: 'pending' })
      .select()
      .single();

    if (error) throw error;

    // Start async processing (fire and forget)
    processJob(job.id, personFile, garmentFile, garmentType);

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'No jobId' }, { status: 400 });

  const { data: job } = await supabase
    .from('tryon_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  return NextResponse.json(job);
}

async function processJob(jobId: string, personFile: File, garmentFile: File, garmentType: string) {
  try {
    const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188';

    const personForm = new FormData();
    personForm.append('image', personFile);
    const personUpload = await fetch(`${COMFYUI_URL}/upload/image`, { method: 'POST', body: personForm });
    const personData = await personUpload.json();

    const garmentForm = new FormData();
    garmentForm.append('image', garmentFile);
    const garmentUpload = await fetch(`${COMFYUI_URL}/upload/image`, { method: 'POST', body: garmentForm });
    const garmentData = await garmentUpload.json();

    const workflow = buildWorkflow(personData.name, garmentData.name, garmentType);
    const promptRes = await fetch(`${COMFYUI_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });
    const promptData = await promptRes.json();
    const promptId = promptData.prompt_id;

    let resultImage = null;
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const historyRes = await fetch(`${COMFYUI_URL}/history/${promptId}`);
      const history = await historyRes.json();
      if (history[promptId]?.outputs) {
        for (const nodeId in history[promptId].outputs) {
          if (history[promptId].outputs[nodeId].images?.[0]) {
            resultImage = history[promptId].outputs[nodeId].images[0];
            break;
          }
        }
      }
      if (resultImage) break;
    }

    if (!resultImage) throw new Error('Timeout');

    const imageRes = await fetch(
      `${COMFYUI_URL}/view?filename=${resultImage.filename}&subfolder=${resultImage.subfolder}&type=${resultImage.type}`
    );
    const imageBuffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');

    await supabase.from('tryon_jobs').update({
      status: 'done',
      result_image: `data:image/png;base64,${base64}`
    }).eq('id', jobId);

  } catch (err: any) {
    await supabase.from('tryon_jobs').update({
      status: 'error',
      error: err.message
    }).eq('id', jobId);
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
