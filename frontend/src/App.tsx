import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { FileText, Printer, Archive, Layout, Folder, ShieldCheck, X, Info, ExternalLink, Plus, ChevronDown, Download, MousePointerClick, Eye } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const faqs = [
  {
    q: "アップロードしたファイルはサーバーに保存されますか？",
    a: "いいえ。本サービスは表示専用のツールであり、解析完了後はセッション終了時（ブラウザを閉じた際や一定時間経過後）に速やかかつ自動的に削除されます。当方がデータを蓄積・転記することはありません。"
  },
  {
    q: "外部からデータを見られる心配はありませんか？",
    a: "通信はすべてSSL（暗号化）されており、第三者が内容を傍受することはできません。また、各ユーザーに個別のセッションを発行しているため、他のユーザーとデータが混ざることもありません。"
  },
  {
    q: "マイナンバーを含む書類を読み込んでも大丈夫ですか？",
    a: "技術的には表示可能ですが、より高い機密性が求められる業務や、インターネット接続が制限された環境でのご利用には、完全オフラインで動作する「Windows版（デスクトップアプリ）」の利用を推奨しております。"
  },
  {
    q: "e-Gov以外で作成したXMLも表示できますか？",
    a: "はい。e-Taxや法令標準XMLなど、XSLスタイルシートが同梱または指定されている標準的なXMLファイルであれば、幅広い行政文書に対応しています。"
  },
  {
    q: "ZIPファイルをそのままアップロードできますか？",
    a: "はい。e-Govからダウンロードした「公文書ファイル（XMLとXSL）」が含まれるZIPファイルを、解凍せずにそのままドラッグ＆ドロップ（または選択）するだけでプレビュー可能です。"
  },
  {
    q: "スマートフォンでも利用できますか？",
    a: "はい、可能です。スマホの場合は「タップしてファイルを選択」からファイルを選んでいただけます。外出先での急ぎの内容確認にも最適です。"
  },
  {
    q: "プレビュー画面が真っ白、または正しく表示されません。",
    a: "読み込んだXMLにスタイルシート（XSLファイル）が不足しているか、URL指定が正しくない可能性があります。ZIPファイルの場合は、必要なファイルがすべて含まれているかご確認ください。"
  },
  {
    q: "利用料金はかかりますか？",
    a: "本Webサイト版は、1回のご利用につき最大10ファイルまでの制限がありますが、どなたでも無料でご利用いただけます。"
  },
  {
    q: "法人や士業事務所で仕事に使っても問題ありませんか？",
    a: "はい、商用・業務利用ともに制限はありません。ただし、Web版は1回10ファイルまでの制限があります。大量のファイルを一括で処理し、より高いセキュリティが求められる業務には、オフラインで動作するWindows版の利用をおすすめします。"
  },
  {
    q: "Windows版（オフライン版）はどこで購入できますか？",
    a: "現在開発・提供準備中です。詳細については「本サイトについて」のページ内にあるお問い合わせフォームよりご連絡ください。"
  }
];

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
  const [totalFileCount, setTotalFileCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState(1);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'about' | 'windows' | 'buy' | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Hash Routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['privacy', 'terms', 'about', 'windows', 'buy'].includes(hash)) {
        setActiveTab(hash as any);
      } else if (!hash) {
        setActiveTab(null);
      }
    };

    // Initial check
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update hash when activeTab changes
  useEffect(() => {
    if (activeTab) {
      window.location.hash = activeTab;
    } else {
      // Avoid adding extra history entry when clearing
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [activeTab]);

  // SEO: FAQ Schema (JSON-LD)
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.a
        }
      }))
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.innerHTML = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

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
      setTotalFileCount(response.data.total_count || response.data.files.length);
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
        <header className="header-section">
          <h1>電子公文書XMLビューア</h1>
          <p className="description pc-only">
            e-Gov、e-Tax、法令標準XMLからXBRLまで、行政手続きのXMLファイルをこれ一つで。
            <br />最適なスタイルシート（XSL）を自動適用し、読みやすくプレビューできます。
          </p>
          <p className="description mobile-only">
            e-Govや法令XML等の公文書ファイルを、ブラウザで即座に読みやすく表示します。
          </p>
        </header>

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
                <div className="empty-drop-area">
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <Archive size={40} className="drop-icon" />
                    <Folder size={40} className="drop-icon" />
                  </div>
                  <p className="pc-only" style={{ fontWeight: 600, fontSize: '1rem', margin: 0, lineHeight: 1.3 }}>
                    ここにZIPまたはフォルダを<br />ドラッグ＆ドロップ
                  </p>
                  <p className="pc-only" style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                    （Web版：1回最大10ファイルまで）
                  </p>
                  <p className="pc-only" style={{ fontSize: '0.8rem', color: '#0284c7', margin: 0, textDecoration: 'underline' }}>
                    またはクリックしてファイルを選択
                  </p>
                  <p className="mobile-only" style={{ fontWeight: 600, fontSize: '1rem', color: '#0284c7', textDecoration: 'underline', margin: 0 }}>
                    タップしてファイルを選択（最大10件）
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
                  {totalFileCount > 10 && (
                    <div style={{
                      margin: '8px 10px',
                      padding: '10px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      color: '#b45309'
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Info size={14} /> 表示制限のお知らせ
                      </div>
                      Web版の制限により、見つかった {totalFileCount} 件のうち先頭の10件のみ表示しています。全件の一括処理はWindows版をご利用ください。
                    </div>
                  )}
                  <div className="drop-hint">
                    <Plus size={14} />
                    <span className="pc-only">ZIPまたはフォルダをさらに対象に追加</span>
                    <span className="mobile-only inline">ファイルをさらに対象に追加</span>
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

        {/* Usage Guide Section */}
        <section className="guide-section">
          <h2 className="guide-title">はじめての方へ：かんたん3ステップ</h2>
          <div className="guide-steps">
            <div className="guide-step">
              <div className="guide-icon-wrapper">
                <Download size={32} />
                <span className="guide-step-number-badge">1</span>
              </div>
              <h4>用意する</h4>
              <p>e-Gov等から「公文書（ZIP形式）」をダウンロード。解凍は不要です。</p>
            </div>
            <div className="guide-arrow">
              <div className="guide-arrow-body"></div>
            </div>
            <div className="guide-step">
              <div className="guide-icon-wrapper">
                <MousePointerClick size={32} />
                <span className="guide-step-number-badge">2</span>
              </div>
              <h4>入れる</h4>
              <p>ZIPファイルをそのまま、上のエリアにドロップまたは選択してください。</p>
            </div>
            <div className="guide-arrow">
              <div className="guide-arrow-body"></div>
            </div>
            <div className="guide-step">
              <div className="guide-icon-wrapper">
                <Eye size={32} />
                <span className="guide-step-number-badge">3</span>
              </div>
              <h4>見る</h4>
              <p>読み込まれたファイル名をクリック。最適な形式で表示・印刷できます。</p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="faq-section">
          <h2 className="faq-title">よくあるご質問</h2>
          <div className="faq-list">
            {faqs.map((faq, idx) => (
              <div key={idx} className={`faq-item ${openFaqIndex === idx ? 'open' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                >
                  <span>{faq.q}</span>
                  <ChevronDown size={18} className="faq-icon" />
                </button>
                {openFaqIndex === idx && (
                  <div className="faq-answer">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

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
                  <p>本サービスは、現状のままで提供されるものであり、提供される情報の正確性、完全性、妥当性、特定の目的への適合性、または本サービスの利用による結果について、<strong>Goya Code Lab</strong>はいかなる保証も行いません。</p>
                  <h3>責任の限定</h3>
                  <p>ユーザーが本サービスを利用したことにより生じた直接的、間接的、付随的、特別、または波及的な損害（データの損失、業務の中断、利益の損失等を含みますが、これらに限定されません）について、当方は一切の責任を負いません。</p>
                  <h3>サービスの変更・停止</h3>
                  <p>当方は、予告なく本サービスの内容を変更、中断、または終了することができるものとします。</p>
                </div>
              )}
              {activeTab === 'about' && (
                <div className="content-page">
                  <h2>本サイトについて</h2>
                  <h3>開発の目的</h3>
                  <p>「公文書XMLブラウザ」は、e-Gov（電子政府の総合窓口）やe-Tax、自治体から発行される電子公文書XMLを、専用ソフトなしで美しく閲覧するために開発されました。</p>
                  <p>社労士・税理士・事務スタッフの皆様が直面する「XMLファイルの中身がタグだらけで読めない」という課題を、独自のプレビュー技術で解決します。</p>

                  <div style={{ background: 'rgba(2, 132, 199, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(2, 132, 199, 0.1)', margin: '2rem 0' }}>
                    <h3 style={{ marginTop: 0, color: '#0284c7' }}>電子公文書のXMLプレビューに対応</h3>
                    <p>日本の電子公文書は通常、<strong>XMLデータとXSLスタイルシート</strong>の組み合わせで構成されています。</p>
                    <p>本ツールは、これらが同梱されたZIPファイルをドロップするだけで、内部の構造を解析し、最適なスタイルを自動適用してプレビューします。</p>
                  </div>

                  <h3>主な対象ドキュメント</h3>
                  <ul>
                    <li><strong>e-Gov 公文書</strong>: 社会保険料額通知書、決定通知書、加入者情報等</li>
                    <li><strong>e-Tax / eLTAX</strong>: 電子申告・申請データのXMLプレビュー</li>
                    <li><strong>法令標準XML / XBRL</strong>: 構造化された法令データや財務情報の簡易閲覧</li>
                  </ul>

                  <div style={{ background: 'rgba(15, 23, 42, 0.03)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', margin: '2rem 0' }}>
                    <h3 style={{ marginTop: 0 }}>Windows版（オフライン・機密業務対応）</h3>
                    <p>より高い機密性や大量の処理が求められる士業・法人様向けに、オフライン環境で動作するWindowsデスクトップ版を提供しております。</p>
                    <button onClick={() => setActiveTab('windows')} style={{ ...footerLinkStyle, background: '#0284c7', color: 'white', padding: '10px 20px', borderRadius: '10px', marginTop: '10px' }}>
                      Windows版の詳細を見る
                    </button>
                  </div>
                  <h3>動作環境</h3>
                  <ul>
                    <li>推奨ブラウザ: Google Chrome, Microsoft Edge, Safari (最新版)</li>
                    <li>フォルダ・ZIPアップロード対応 (Chromium系ブラウザ推奨)</li>
                  </ul>
                </div>
              )}
              {activeTab === 'windows' && (
                <div className="content-page">
                  <h2>電子公文書XMLビューア Windows版</h2>
                  <p>インターネット接続なしで動作する、高セキュリティなデスクトップアプリケーションです。プロフェッショナルの現場に最適な機能を提供します。</p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', margin: '2rem 0' }}>
                    <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#0284c7' }}>100% オフライン</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>データがPCの外に出ることがないため、極めて高い機密性を保持できます。</p>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#0284c7' }}>ファイル数無制限</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>Web版のような同時表示制限がなく、数百件の公文書も一括で処理可能です。</p>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#0284c7' }}>高速ブラウジング</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>OSネイティブの動作により、大量のファイルもストレスなく切り替えられます。</p>
                    </div>
                  </div>

                  <h3>ご利用プラン</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '12px' }}>機能</th>
                        <th style={{ padding: '12px' }}>トライアル版</th>
                        <th style={{ padding: '12px', color: '#0284c7' }}>Standard版</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px' }}>利用料金</td>
                        <td style={{ padding: '12px' }}>無料</td>
                        <td style={{ padding: '12px', fontWeight: 700 }}>3,300円 (税込)</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px' }}>利用期限</td>
                        <td style={{ padding: '12px' }}>30日間</td>
                        <td style={{ padding: '12px' }}>無制限</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px' }}>商用・業務利用</td>
                        <td style={{ padding: '12px' }}>可</td>
                        <td style={{ padding: '12px' }}>可</td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ background: '#eff6ff', padding: '1.5rem', borderRadius: '20px', textAlign: 'center' }}>
                    <h4 style={{ marginTop: 0 }}>まずは無料でお試しください</h4>
                    <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>インストール不要。exeファイルをダウンロードして実行するだけです。</p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <a href="/downloads/xml_viewer.zip" style={{ ...footerLinkStyle, background: '#1e293b', color: 'white', padding: '12px 24px', borderRadius: '12px' }}>
                        Windows版をダウンロード
                      </a>
                      <button onClick={() => setActiveTab('buy')} style={{ ...footerLinkStyle, background: '#0284c7', color: 'white', padding: '12px 24px', borderRadius: '12px' }}>
                        ライセンスを購入する
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'buy' && (
                <div className="content-page">
                  <h2>Standard版ライセンスの購入</h2>
                  <p>電子公文書XMLビューア Standard版をご検討いただきありがとうございます。</p>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '24px', padding: '2rem', margin: '2rem 0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>買い切りライセンス</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>¥3,300 <span style={{ fontSize: '1rem', fontWeight: 400 }}> (税込)</span></div>

                    <ul style={{ textAlign: 'left', display: 'inline-block', marginBottom: '2rem' }}>
                      <li>✓ 試用期間（30日）の解除</li>
                      <li>✓ 永続的な利用が可能</li>
                      <li>✓ 同一ユーザーなら複数台PCでも利用可能</li>
                      <li>✓ 今後のアップデートに対応</li>
                    </ul>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <a href="https://buy.stripe.com/test_dummy" style={{ ...footerLinkStyle, background: '#0284c7', color: 'white', padding: '16px 32px', borderRadius: '16px', fontSize: '1.1rem', justifyContent: 'center' }}>
                        カード決済で進む (Stripe)
                      </a>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      ※ 決済完了後、ご入力いただいたメールアドレス宛に即座にライセンスキーが送信されます。<br />
                      ※ 特定商取引法に基づく表記は<a href="#terms" onClick={() => setActiveTab('terms')}>こちら</a>をご確認ください。
                    </p>
                  </div>

                  <h3>決済の流れ</h3>
                  <ol style={{ fontSize: '0.9rem', color: '#475569' }}>
                    <li>上のボタンからStripe（外部決済サイト）へ進みます。</li>
                    <li>メールアドレスとクレジットカード情報を入力して決済を完了させます。</li>
                    <li>決済完了後、数分以内にライセンスキーが記載された自動メールが届きます。</li>
                    <li>アプリ起動時にキーを入力すると、Standard版が有効化されます。</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation Updates */}
      <footer style={{
        marginTop: '4rem',
        padding: '2rem 0',
        borderTop: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        flexWrap: 'wrap'
      }}>
        <button onClick={() => setActiveTab('windows')} style={footerLinkStyle}>
          <Layout size={16} /> Windows版の詳細
        </button>
        <button onClick={() => setActiveTab('buy')} style={footerLinkStyle}>
          <Printer size={16} /> ライセンス購入
        </button>
        <button onClick={() => setActiveTab('about')} style={footerLinkStyle}>
          <Info size={16} /> 本サイトについて
        </button>
        <button onClick={() => setActiveTab('privacy')} style={footerLinkStyle}>
          <ShieldCheck size={16} /> プライバシー
        </button>
        <button onClick={() => setActiveTab('terms')} style={footerLinkStyle}>
          <FileText size={16} /> 免責事項
        </button>
        <a href="https://forms.gle/xMzEXUMWRAzct21q7" target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
          <ExternalLink size={16} /> お問い合わせ
        </a>
        <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', marginTop: '1rem' }}>
          © 2026 Goya Code Lab
        </div>
      </footer>
    </>
  );
};

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
