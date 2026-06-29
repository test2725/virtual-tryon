import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const personFile = formData.get('person_image') as File;
    const garmentFile = formData.get('garment_image') as File;
    const garmentType = formData.get('garment_type') as string || 'upper_body';

    if (!personFile || !garmentFile) {
      return NextResponse.json({ error: 'Images required' }, { status: 400 });
    }

    // 画像をbase64に変換
    const personB64 = Buffer.from(await personFile.arrayBuffer()).toString('base64');
    const garmentB64 = Buffer.from(await garmentFile.arrayBuffer()).toString('base64');

    // jobをDBに作成
    const { data: job, error } = await supabase
      .from('tryon_jobs')
      .insert({ status: 'pending' })
      .select()
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    // Edge Functionをfire-and-forget（awaitしない）
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-tryon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        job_id: job.id,
        person_image_b64: personB64,
        garment_image_b64: garmentB64,
        garment_type: garmentType,
      }),
    }).catch(console.error);

    return NextResponse.json({ job_id: job.id });

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