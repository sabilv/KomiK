/** EPUB export. */
import JSZip from 'jszip';
import { exportEpubBtn } from './dom.js';
import { imgSize } from './pages.js';
import { mimeOf, newUuid } from './pure.js';
import { appState } from './state.js';
import { showLoading, showToast } from './ui.js';

export async function exportToEPUB() {
  if (!appState.pages || appState.pages.length === 0) {
    showToast('Please load a comic file or sample first before exporting.');
    return;
  }

  showLoading(true, 'Preparing EPUB structure...');

  try {
    const zip = new JSZip();
    const cleanTitle = (appState.fileName || 'Comic_Export').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const bookUuid = newUuid();

    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    zip.file(
      'META-INF/container.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
    );

    const manifestItems = [];
    const spineRefs = [];
    const navPoints = [];

    for (let i = 0; i < appState.pages.length; i++) {
      const pageNum = String(i + 1).padStart(3, '0');
      const pageUrl = appState.pages[i];

      showLoading(true, `Packing page ${i + 1} of ${appState.pages.length}...`);

      const blob = await appState.loaders[i]();
      const dim = await imgSize(blob);

      let mimeType = blob.type || mimeOf(appState.pageNames[i]) || 'image/jpeg';
      let ext = 'jpg';
      if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('webp')) ext = 'webp';
      else if (mimeType.includes('gif')) ext = 'gif';
      else if (mimeType.includes('svg')) ext = 'svg';

      const imgFileName = `page_${pageNum}.${ext}`;
      zip.file(`OEBPS/images/${imgFileName}`, blob);

      const pageXhtmlName = `page_${pageNum}.xhtml`;
      const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=${dim.w}, height=${dim.h}"/>
  <title>Page ${i + 1}</title>
  <style>html,body{margin:0;padding:0;width:${dim.w}px;height:${dim.h}px;background:#09090b}img{display:block;width:${dim.w}px;height:${dim.h}px}</style>
</head>
<body>
  <div>
    <img src="images/${imgFileName}" alt="Page ${i + 1}"/>
  </div>
</body>
</html>`;

      zip.file(`OEBPS/${pageXhtmlName}`, xhtmlContent);

      manifestItems.push(
        `<item id="img_${pageNum}" href="images/${imgFileName}" media-type="${mimeType}"${i === 0 ? ' properties="cover-image"' : ''}/>`
      );
      manifestItems.push(`<item id="page_${pageNum}" href="${pageXhtmlName}" media-type="application/xhtml+xml"/>`);
      spineRefs.push(`<itemref idref="page_${pageNum}"/>`);
      navPoints.push(`
    <navPoint id="nav_${pageNum}" playOrder="${i + 1}">
      <navLabel><text>Page ${i + 1}</text></navLabel>
      <content src="${pageXhtmlName}"/>
    </navPoint>`);
    }

    const tocXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="utf-8"/>
  <title>${cleanTitle}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
      ${appState.pages.map((_, idx) => `<li><a href="page_${String(idx + 1).padStart(3, '0')}.xhtml">Page ${idx + 1}</a></li>`).join('\n      ')}
    </ol>
  </nav>
</body>
</html>`;
    zip.file('OEBPS/toc.xhtml', tocXhtml);
    manifestItems.push(`<item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>`);

    const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" id="uid" content="urn:uuid:${bookUuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="${appState.pages.length}"/>
    <meta name="dtb:maxPageNumber" content="${appState.pages.length}"/>
  </head>
  <docTitle><text>${cleanTitle}</text></docTitle>
  <navMap>
    ${navPoints.join('\n')}
  </navMap>
</ncx>`;
    zip.file('OEBPS/toc.ncx', tocNcx);
    manifestItems.push(`<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`);

    const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${bookUuid}</dc:identifier>
    <dc:title>${cleanTitle}</dc:title>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
    <meta property="rendition:layout">pre-paginated</meta>
    <meta property="rendition:orientation">auto</meta>
    <meta property="rendition:spread">auto</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx"${appState.isRTL ? ' page-progression-direction="rtl"' : ''}>
    ${spineRefs.join('\n    ')}
  </spine>
</package>`;
    zip.file('OEBPS/content.opf', contentOpf);

    showLoading(true, 'Creating EPUB archive...');
    const epubBlob = await zip.generateAsync(
      {
        type: 'blob',
        mimeType: 'application/epub+zip'
      },
      (meta) => {
        showLoading(true, `Exporting EPUB... ${Math.round(meta.percent)}%`);
      }
    );

    const downloadUrl = URL.createObjectURL(epubBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${cleanTitle}.epub`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

    showToast('EPUB downloaded successfully!');
  } catch (err) {
    console.error('EPUB export error:', err);
    showToast('Failed to create EPUB archive: ' + err.message);
  } finally {
    showLoading(false);
  }
}

/** Wire up export button. Called by main.js during initialization. */
export function initEpub() {
  if (exportEpubBtn) exportEpubBtn.addEventListener('click', exportToEPUB);
}
