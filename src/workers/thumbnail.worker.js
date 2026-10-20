self.onmessage = async (e) => {
  const { id, blob } = e.data;
  try {
    const b = await createImageBitmap(blob);
    const k = Math.min(1, 240 / b.width);
    const w = Math.max(1, Math.round(b.width * k));
    const h = Math.max(1, Math.round(b.height * k));
    const c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(b, 0, 0, w, h);
    if (b.close) b.close();
    const out = await c.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
    self.postMessage({ id, blob: out });
  } catch (err) {
    self.postMessage({ id, error: 1 });
  }
};
