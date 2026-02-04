import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { FileText, Printer, Archive, Layout, Upload, Folder, ShieldCheck, X, Info, ExternalLink } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface XMLFile {
  name: string;
  path: string;
  has_xsl: boolean;
}

const App: React.FC = () => {
  const [sessionId] = useState(() => uuidv4());
  const [fileList, setFileList] = useState<XMLFile[]>([]);
  const [activeFile, setActiveFile] = useState<XMLFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState(1);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'about' | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Mouse tracking for blobs
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Body scroll lock for modal
  useEffect(() => {
    if (activeTab) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [activeTab]);

  const traverseDirectory = async (entry: any): Promise<{ file: File, path: string }[]> => {
    const results: { file: File, path: string }[] = [];
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) => entry.file(resolve));
      // entry.fullPath は "/dirname/file.xml" のような形式なので、先頭の / を削る
      const relativePath = entry.fullPath.startsWith('/') ? entry.fullPath.substring(1) : entry.fullPath;
      results.push({ file, path: relativePath });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise<any[]>((resolve) => {
        const result: any[] = [];
        const read = () => {
          reader.readEntries((batch: any[]) => {
            if (batch.length === 0) resolve(result);
            else {
              result.push(...batch);
              read();
            }
          });
        };
        read();
      });
      for (const e of entries) {
        results.push(...(await traverseDirectory(e)));
      }
    }
    return results;
  };

  const uploadFiles = async (files: (File | { file: File, path: string })[] | FileList) => {
    const fileArray = Array.from(files);

    // Normalize to an array of { file, path }
    const normalizedFiles = fileArray.map(f => {
      if ('file' in f && 'path' in f) return f;
      const file = f as File;
      const path = (file as any).webkitRelativePath || file.name;
      return { file, path };
    });

    // Check for at least one XML or ZIP file before sending
    const hasValidFile = normalizedFiles.some(f => {
      const name = f.file.name.toLowerCase();
      return name.endsWith('.xml') || name.endsWith('.zip');
    });

    if (!hasValidFile) {
      alert('XMLファイルまたはZIPファイルが含まれていません。読み込み可能なファイルを選択してください。');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    normalizedFiles.forEach(f => {
      formData.append('files', f.file, f.path);
    });

    try {
      const response = await axios.post(`${API_BASE}/upload/${sessionId}`, formData);
      setFileList(response.data.files);
      setActiveFile(null); // Reset selection
      setStep(2);
    } catch (error: any) {
      console.error('Upload failed:', error);
      const message = error.response?.data?.detail || 'アップロードに失敗しました。サーバーが起動しているか確認してください。';
      alert(message);
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Get entries synchronously to avoid DataTransfer being cleared
    const items = e.dataTransfer.items;
    if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
      const entries = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }

      const allFiles = [];
      for (const entry of entries) {
        allFiles.push(...(await traverseDirectory(entry)));
      }

      if (allFiles.length > 0) {
        uploadFiles(allFiles);
        return;
      }
    }

    // Fallback or multiple individual files without complex traversal
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      uploadFiles(files);
    } else {
      alert('読み込み可能なファイルをドロップしてください。');
    }
  };

  const onAreaClick = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  const selectXMLFile = (e: React.MouseEvent, file: XMLFile) => {
    e.stopPropagation(); // 不要なファイル選択ダイアログの起動を防止
    setActiveFile(file);
    setStep(3);
  };

  const openPreview = (mode: 'tab' | 'window') => {
    if (!activeFile) return;
    const url = `${API_BASE}/view_wrapped/${sessionId}/${activeFile.path}`;

    if (mode === 'tab') {
      window.open(url, '_blank');
    } else {
      const width = 1200;
      const height = 900;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      window.open(
        url,
        'XMLPreview',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
      );
    }
  };

  return (
    <>
      <div className="background-wrapper">
        <div className="blob"
          style={{
            left: `${mousePos.x}px`,
            top: `${mousePos.y}px`,
            transform: 'translate(-50%, -50%)'
          }}
        />
        <div className="blob blob-secondary" />
        <div className="blob blob-tertiary" />
      </div>

      <div className={`main-container ${activeTab ? 'modal-active' : ''}`}>
        <div className="header-section">
          <h1>かんたん公文書XMLブラウザ</h1>
          <p className="description">公文書のXMLとスタイルシート（XSL）を読み込み、ブラウザで読みやすい形式に自動変換して表示します</p>
        </div>

        <div className="card">
          {/* Step 1: XMLを選択（兼ドロップゾーン） */}
          <div className={`step ${step === 1 || fileList.length > 0 ? 'step-active' : ''}`} style={{ display: 'flex', flexDirection: 'column', margin: 0 }}>
            <div className="step-header">
              <span className="step-number">1</span>
              <span className="step-title">アップロード</span>
            </div>

            <div
              className={`smart-list-container ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={onAreaClick}
              style={{ cursor: 'pointer' }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileChange}
                style={{ display: 'none' }}
                multiple
                accept=".xml,.xsl,.zip"
              />
              {isUploading ? (
                <div className="upload-loader">読み込み中...</div>
              ) : fileList.length === 0 ? (
                <div className="empty-drop-area" style={{ paddingTop: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <Archive size={40} className="drop-icon" />
                    <Folder size={40} className="drop-icon" />
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>
                    ここにZIPまたはフォルダを<br />ドラッグ＆ドロップ
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#0284c7', marginTop: '4px', textDecoration: 'underline' }}>
                    またはクリックしてファイルを選択
                  </p>
                </div>
              ) : (
                <div className="list-items">
                  {fileList.map((file, idx) => (
                    <div
                      key={idx}
                      className={`list-item ${activeFile?.path === file.path ? 'selected' : ''}`}
                      onClick={(e) => selectXMLFile(e, file)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={18} />
                        <span>{file.name}</span>
                      </div>
                    </div>
                  ))}
                  <div className="drop-hint">
                    <Upload size={14} /> ファイルをドロップして入れ替え
                  </div>
                </div>
              )}
            </div>
            {fileList.length === 0 && !isUploading && (
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '12px', textAlign: 'center' }}>
                ※ XMLファイルとスタイルシート（XSL）の入った<br />ZIPまたはフォルダをアップロードしてください
              </p>
            )}
          </div>

          {/* Step 2: プレビュー表示 */}
          <div className={`step ${step === 3 || activeFile ? 'step-active' : ''} ${!activeFile ? 'step-inactive' : ''}`} style={{ margin: 0 }}>
            <div className="step-header">
              <span className="step-number">2</span>
              <span className="step-title">プレビュー表示</span>
            </div>
            <p className="step-description" style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>
              表示タイプを選択してください。印刷やPDF保存はブラウザの標準機能をご利用ください。
            </p>
            <div className="button-group">
              <button
                disabled={!activeFile}
                onClick={() => openPreview('tab')}
                className={activeFile ? 'btn-primary-cta' : ''}
              >
                <Layout size={20} /> 新しいタブで表示
              </button>
              <button
                disabled={!activeFile}
                onClick={() => openPreview('window')}
                className={activeFile ? 'btn-primary-cta' : ''}
              >
                <Printer size={20} /> 新しいウィンドウで表示
              </button>
            </div>
          </div>
        </div>

        <div style={{
          marginTop: '2rem',
          padding: '1.25rem',
          background: 'rgba(2, 132, 199, 0.05)',
          border: '1px solid rgba(2, 132, 199, 0.1)',
          borderRadius: '20px',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
          maxWidth: '800px',
          margin: '2rem auto 0 auto',
          animation: 'slideUpFade 1.1s ease-out 0.4s backwards'
        }}>
          <ShieldCheck size={24} style={{ color: '#0284c7', marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6' }}>
            <span style={{ fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: '6px', fontSize: '1rem' }}>セキュリティ・プライバシーについて</span>
            アップロードされたファイルは個別のセッションで隔離して処理され、他者から閲覧されることはありません。また、2時間後にサーバーから自動的に完全削除されます。
          </div>
        </div>

        <footer style={{
          marginTop: '4rem',
          padding: '2rem 0',
          borderTop: '1px solid rgba(0,0,0,0.05)',
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          flexWrap: 'wrap'
        }}>
          <button onClick={() => setActiveTab('about')} style={footerLinkStyle}>
            <Info size={16} /> 本サイトについて
          </button>
          <button onClick={() => setActiveTab('privacy')} style={footerLinkStyle}>
            <ShieldCheck size={16} /> プライバシーポリシー
          </button>
          <button onClick={() => setActiveTab('terms')} style={footerLinkStyle}>
            <FileText size={16} /> 免責事項
          </button>
          {/* GoogleフォームのURL（YOUR_FORM_ID部分）をご自身のものに差し替えてください */}
          <a href="https://forms.gle/xMzEXUMWRAzct21q7" target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
            <ExternalLink size={16} /> お問い合わせ
          </a>
          <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', marginTop: '1rem' }}>
            © 2026 Goya Code Lab
          </div>
        </footer>
      </div>

      {/* Modal Overlay */}
      {activeTab && (
        <div className="modal-overlay" onClick={() => setActiveTab(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setActiveTab(null)}>
              <X size={24} />
            </button>
            <div className="modal-body">
              {activeTab === 'privacy' && (
                <div className="content-page">
                  <h2>プライバシーポリシー</h2>
                  <p><strong>Goya Code Lab</strong>（以下、「当方」といいます。）は、本ウェブサイト（以下、「本サービス」といいます。）における、ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下、「本ポリシー」といいます。）を定めます。</p>
                  <h3>第1条（ファイルデータの取り扱い）</h3>
                  <ol>
                    <li>本サービスにおいてアップロードされたXMLファイルおよびXSLファイル（以下、「ユーザーデータ」といいます。）は、プレビュー表示の生成のみに使用されます。</li>
                    <li>ユーザーデータは各ユーザーのセッションごとに隔離されたディレクトリで処理され、他のユーザーが閲覧することはできません。</li>
                    <li>ユーザーデータは、アップロードから2時間経過後にサーバーより自動的に、かつ恒久的に削除されます。</li>
                  </ol>
                  <h3>第2条（広告の配信について）</h3>
                  <p>本サービスでは、今後Google AdSense等の第三者配信の広告サービスを利用する可能性があります。これに伴い、Cookie等を使用してユーザーの閲覧履歴を取得する場合がありますが、個人を特定する情報は含まれません。</p>
                </div>
              )}
              {activeTab === 'terms' && (
                <div className="content-page">
                  <h2>免責事項</h2>
                  <h3>無保証について</h3>
                  <p>本サービスは、現状のまま（As-Is）で提供されるものであり、提供される情報の正確性、完全性、妥当性、特定の目的への適合性、または本サービスの利用による結果について、<strong>Goya Code Lab</strong>はいかなる保証も行いません。</p>
                  <h3>責任の限定</h3>
                  <p>ユーザーが本サービスを利用したことにより生じた直接的、間接的、付随的、特別、または波及的な損害（データの損失、業務の中断、利益の損失等を含みますが、これらに限定されません）について、当方は一切の責任を負いません。</p>
                  <h3>サービスの変更・停止</h3>
                  <p>当方は、予告なく本サービスの内容を変更、中断、または終了することができるものとします。</p>
                </div>
              )}
              {activeTab === 'about' && (
                <div className="content-page">
                  <h2>本サイトについて</h2>
                  <h3>本サイトの目的</h3>
                  <p>「かんたん公文書XMLブラウザ」は、自治体や公的機関から発行される公文書XMLファイルを、専門的な知識なしにブラウザで美しく、読みやすく表示するために開発されました。</p>
                  <div style={{ background: 'rgba(2, 132, 199, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(2, 132, 199, 0.1)', margin: '2rem 0' }}>
                    <h3 style={{ marginTop: 0, color: '#0284c7' }}>Windows版（オフライン対応）のご案内</h3>
                    <p>より高い機密性が求められる業務や、インターネット接続が制限されている環境でのご利用のために、同一の表示機能を備えた<strong>「かんたん公文書XMLブラウザ (Windows版)」</strong>の販売を予定しております。</p>
                    <p>完全オフラインで動作し、外部へのデータ送信は一切行われません。ご興味のある方は、お問い合わせフォームよりお気軽にご連絡ください。</p>
                  </div>
                  <h3>動作環境</h3>
                  <ul>
                    <li>推奨ブラウザ: Google Chrome, Microsoft Edge, Safari (最新版)</li>
                    <li>フォルダ・ZIPアップロード対応 (Chromium系ブラウザ推奨)</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const footerLinkStyle: React.CSSProperties = {
  background: 'none',
  padding: '8px 12px',
  color: '#64748b',
  fontSize: '0.9rem',
  fontWeight: 500,
  width: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  cursor: 'pointer',
  transition: 'color 0.2s',
  border: 'none',
  textDecoration: 'none'
};

export default App;
