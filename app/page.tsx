'use client';
import { useState } from 'react';

const GARMENT_TYPES = [
  { value: 'upper_body', label: 'Top' },
  { value: 'lower_body', label: 'Bottom' },
  { value: 'dresses', label: 'Dress' },
];

export default function Home() {
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [personImg, setPersonImg] = useState<string | null>(null);
  const [garmentImg, setGarmentImg] = useState<string | null>(null);
  const [garmentType, setGarmentType] = useState('upper_body');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePerson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setPersonFile(f); setPersonImg(URL.createObjectURL(f)); }
  };

  const handleGarment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setGarmentFile(f); setGarmentImg(URL.createObjectURL(f)); }
  };

  const handleTryOn = async () => {
    if (!personFile || !garmentFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('person', personFile);
      fd.append('garment', garmentFile);
      fd.append('garmentType', garmentType);
      const res = await fetch('/api/tryon', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.image);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f14', color: '#f0eef8', fontFamily: 'sans-serif', padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        Try On AI
      </h1>

      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Person photo</p>
        <label style={{ display: 'block', background: '#1a1a24', border: '2px dashed #333', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer' }}>
          <input type="file" accept="image/*" onChange={handlePerson} style={{ display: 'none' }} />
          {personImg ? <img src={personImg} style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }} /> : <span style={{ color: '#888' }}>Tap to select</span>}
        </label>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Garment type</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {GARMENT_TYPES.map(t => (
            <button key={t.value} onClick={() => setGarmentType(t.value)}
              style={{ padding: '8px 12px', borderRadius: '20px', border: '1px solid', borderColor: garmentType === t.value ? '#e8427a' : '#333', background: garmentType === t.value ? 'rgba(232,66,122,0.1)' : '#1a1a24', color: garmentType === t.value ? '#e8427a' : '#888', fontSize: '13px', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Garment photo</p>
        <label style={{ display: 'block', background: '#1a1a24', border: '2px dashed #333', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer' }}>
          <input type="file" accept="image/*" onChange={handleGarment} style={{ display: 'none' }} />
          {garmentImg ? <img src={garmentImg} style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }} /> : <span style={{ color: '#888' }}>Tap to select</span>}
        </label>
      </div>

      <button onClick={handleTryOn} disabled={!personFile || !garmentFile || loading}
        style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #e8427a, #7c3aed)', border: 'none', borderRadius: '12px', color: 'white', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', opacity: (!personFile || !garmentFile || loading) ? 0.5 : 1 }}>
        {loading ? 'Processing...' : 'Try On'}
      </button>

      {error && <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: '8px', color: '#ff8888' }}>{error}</div>}

      {result && (
        <div style={{ marginTop: '24px' }}>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Result</p>
          <img src={result} style={{ width: '100%', borderRadius: '12px' }} />
        </div>
      )}
    </div>
  );
}
