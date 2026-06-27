'use client';
import { useState, useRef } from 'react';

const GARMENT_TYPES = [
  { value: 'shirt', label: '👕 トップス・シャツ' },
  { value: 'dress', label: '👗 ワンピース・ドレス' },
  { value: 'pants', label: '👖 パンツ・スカート' },
  { value: 'jacket', label: '🧥 アウター・ジャケット' },
  { value: 'pajama', label: '🌙 パジャマ・ルームウェア' },
];

export default function Home() {
  const [personImg, setPersonImg] = useState<string | null>(null);
  const [garmentImg, setGarmentImg] = useState<string | null>(null);
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [garmentType, setGarmentType] = useState('shirt');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePerson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPersonFile(file);
    setPersonImg(URL.createObjectURL(file));
    setResult(null);
  };

  const handleGarment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGarmentFile(file);
    setGarmentImg(URL.createObjectURL(file));
    setResult(null);
  };

  const handleTryOn = async () => {
    if (!personFile || !garmentFile) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('person', personFile);
      form.append('garment', garmentFile);
      form.append('garment_type', garmentType);
      const res = await fetch('/api/tryon', { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.image);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f14', color: '#f0eef8', fontFamily: 'sans-serif', padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', background: 'linear-gradient(90deg, #e8427a, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        ✦ TryOn AI
      </h1>

      {/* 人物写真 */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>① 人物写真</p>
        <label style={{ display: 'block', background: '#1a1a24', border: '2px dashed #333', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer' }}>
          <input type="file" accept="image/*" onChange={handlePerson} style={{ display: 'none' }} />
          {personImg ? <img src={personImg} style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }} /> : <span style={{ color: '#888' }}>📷 タップして写真を選ぶ</span>}
        </label>
      </div>

      {/* 服の種類 */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>② 服の種類</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {GARMENT_TYPES.map(t => (
            <button key={t.value} onClick={() => setGarmentType(t.value)}
              style={{ padding: '8px 12px', borderRadius: '20px', border: '1px solid', borderColor: garmentType === t.value ? '#e8427a' : '#333', background: garmentType === t.value ? 'rgba(232,66,122,0.1)' : '#1a1a24', color: garmentType === t.value ? '#e8427a' : '#888', fontSize: '13px', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 服の画像 */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>③ 服の画像</p>
        <label style={{ display: 'block', background: '#1a1a24', border: '2px dashed #333', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer' }}>
          <input type="file" accept="image/*" onChange={handleGarment} style={{ display: 'none' }} />
          {garmentImg ? <img src={garmentImg} style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }} /> : <span style={{ color: '#888' }}>👗 タップして服の画像を選ぶ</span>}
        </label>
      </div>

      {/* ボタン */}
      <button onClick={handleTryOn} disabled={!personFile || !garmentFile || loading}
        style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #e8427a, #7c3aed)', border: 'none', borderRadius: '12px', color: 'white', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', opacity: (!personFile || !garmentFile || loading) ? 0.5 : 1 }}>
        {loading ? '⏳ 生成中... (数分かかります)' : '✨ 試着する'}
      </button>

      {error && <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: '8px', color: '#ff8888' }}>⚠️ {error}</div>}

      {result && (
        <div style={{ marginTop: '24px' }}>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>✨ 試着結果</p>
          <img src={result} style={{ width: '100%', borderRadius: '12px' }} />
        </div>
      )}
    </div>
  );
}