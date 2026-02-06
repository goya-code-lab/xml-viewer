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
    a: "はい。e-Govからダウンロードした「三点セット（XML, XSL, PDF）」が含まれるZIPファイルを、解凍せずにそのままドラッグ＆ドロップ（または選択）するだけでプレビュー可能です。"
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
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState(1);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'about' | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
                <div className="empty-drop-area" style={{ paddingTop: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <Archive size={40} className="drop-icon" />
                    <Folder size={40} className="drop-icon" />
                  </div>
                  <p className="pc-only" style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>
                    ここにZIPまたはフォルダを<br />ドラッグ＆ドロップ
                  </p>
                  <p className="pc-only" style={{ fontSize: '0.8rem', color: '#0284c7', marginTop: '4px', textDecoration: 'underline' }}>
                    またはクリックしてファイルを選択
                  </p>
                  <p className="mobile-only" style={{ fontWeight: 600, fontSize: '1rem', color: '#0284c7', textDecoration: 'underline', marginTop: '8px' }}>
                    タップしてファイルを選択
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
                  <h3>開発の目的</h3>
                  <p>「公文書XMLブラウザ」は、e-Gov（電子政府の総合窓口）やe-Tax、自治体から発行される電子公文書XMLを、専用ソフトなしで美しく閲覧するために開発されました。</p>
                  <p>社労士・税理士・事務スタッフの皆様が直面する「XMLファイルの中身がタグだらけで読めない」という課題を、独自のプレビュー技術で解決します。</p>

                  <div style={{ background: 'rgba(2, 132, 199, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(2, 132, 199, 0.1)', margin: '2rem 0' }}>
                    <h3 style={{ marginTop: 0, color: '#0284c7' }}>電子公文書の「三点セット」に対応</h3>
                    <p>日本の電子公文書は通常、<strong>XMLデータ、XSLスタイルシート、PDF</strong>の三つのファイルで構成されます（三点セット）。</p>
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
                    <p>より高い機密性や大量の処理が求められる士業・法人様向けに、オフライン環境で動作するWindowsデスクトップ版の提供も予定しております。ご要望は下記フォームより承ります。</p>
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
