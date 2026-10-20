self.onmessage = async (e) => {
  const { id, name, file } = e.data;
  let root = null;
  try {
    root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(name, { create: true });
    const h = await fh.createSyncAccessHandle();
    try {
      h.truncate(0);
      const CH = 4 * 1024 * 1024;
      let off = 0;
      while (off < file.size) {
        const buf = new Uint8Array(await file.slice(off, off + CH).arrayBuffer());
        h.write(buf, { at: off });
        off += buf.length;
      }
      h.flush();
    } finally {
      h.close();
    }
    self.postMessage({ id, ok: true });
  } catch (err) {
    try {
      if (root) await root.removeEntry(name);
    } catch (e2) {}
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
