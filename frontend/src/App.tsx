import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { FileText, Printer, Archive, Layout, ShieldCheck, X, Info, ExternalLink, Plus, ChevronDown, Download } from 'lucide-react';

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
    a: "技術的には表示可能ですが、より高い機密性が求められる業務や、インターネット接続が制限された環境でのご利用には、完全オフラインで動作する<a href='#windows'>Windows版（デスクトップアプリ）</a>の利用を推奨しております。"
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
    a: "はい、商用・業務利用ともに制限はありません。ただし、Web版は1回10ファイルまでの制限があります。大量のファイルを一括で処理し、より高いセキュリティが求められる業務には、オフラインで動作する<a href='#windows'>Windows版</a>の利用をおすすめします。"
  },
  {
    q: "Windows版（オフライン版）はどこで購入できますか？",
    a: "こちらの<a href='#windows'>Windows版の詳細案内ページ</a>より試用版のダウンロードおよび、Standard版ライセンスの購入が可能です。"
  }
];

interface XMLFile {
  name: string;
  path: string;
  has_xsl: boolean;
}

const App: React.FC = () => {
  const [sessionId] = useState(() => uuidv4());
  const [activeFile, setActiveFile] = useState<XMLFile | null>(null);
  const [fileList, setFileList] = useState<XMLFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [totalFileCount, setTotalFileCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState(1);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'about' | 'windows' | 'buy' | 'scta' | null>(null);
  const [showBlog, setShowBlog] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const modalBodyRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab || showBlog) {
      window.scrollTo(0, 0);
    }
  }, [activeTab, showBlog]);

  const renderBlog = () => (
    <div className="blog-post-page">
      <div className="blog-header">
        <span className="blog-category">Tips & Release</span>
        <h1 className="blog-title">EdgeのIEモード設定に疲れた人へ。<br />e-GovのXML公文書を「設定不要・1秒」で開く裏技</h1>
        <div className="blog-meta">
          <span className="blog-date">2026.02.17</span>
          <span className="blog-author">Goya Code Lab</span>
        </div>
      </div>

      <div className="blog-content">
        <p className="lead-text">
          e-Govから届く<strong>「[e-Gov]通知文書送達のお知らせ」</strong>というメール。<br />
          「また来たか」と溜息をつきながらログインし、ようやくダウンロードしたXMLファイル。しかし、それを開こうとした瞬間に本当の「苦行」が始まります。
        </p>

        <div className="quote-box">
          「EdgeのIEモードを有効にしてください」<br />
          「信頼済みサイトに登録してください」
        </div>

        <p>
          社会保険料の通知をたった1枚確認するためだけに、なぜITエンジニアのような複雑な設定を強いられるのか。そんな「IT虐待」に近い状況に、もう終止符を打ちませんか？
        </p>

        <h2>なぜe-GovのXMLは、普通に開けないのか？</h2>
        <p>
          日本の電子公文書（XML）は、それ単体ではただの記号の羅列です。人間が読める形式にするには、<strong>「XSLスタイルシート」</strong>という設計図を正しく読み込ませる必要があります。
        </p>
        <p>
          しかし、多くのブラウザはこの「外部設計図の読み込み」をセキュリティ上の理由で制限しています。そのため、古びた技術である「IEモード」を使わなければならないのが現状です。
        </p>

        <div className="highlight-section">
          <h2>設定不要・ドロップ1秒。最短の解決策がここにあります</h2>
          <p>
            当サイトの<strong>「e-Gov公文書XMLビューア」</strong>は、そんな面倒な設定をすべて過去のものにします。
          </p>
          <div className="step-box">
            <div className="step-item">
              <span className="step-label">手順</span>
              ダウンロードしたZIPファイルを、画面の枠内にドロップする。
            </div>
            <div className="step-arrow">↓</div>
            <div className="step-item result">
              <span className="step-label">結果</span>
              <strong>1秒後</strong>には、見慣れた「社会保険料額通知書」がブラウザ上に美しく表示されます。
            </div>
          </div>
          <p>
            IEモードの切り替えも、信頼済みサイトの登録も、一切不要です。ブラウザさえあれば、Macでもスマホでも中身を確認できます。
          </p>
          <div className="center-cta">
            <button onClick={() => { setShowBlog(false); setActiveTab(null); }} className="btn-primary-cta">
              今すぐ無料のWeb版を試す
            </button>
          </div>
        </div>

        <h2>社労士・プロの現場が「Windows版」を選ぶ理由</h2>
        <p>
          「便利だけど、顧客の機密データをネットに上げるのは不安……」<br />
          そんな責任感の強い社労士や士業の皆様には、<strong>完全オフラインで動作する「Windowsデスクトップ版」</strong>を用意しています。
        </p>

        <div className="feature-list">
          <div className="feature-row">
            <strong>100%オフライン：</strong> 外部との通信を一切行わないため、情報漏洩リスクはゼロ。
          </div>
          <div className="feature-row">
            <strong>ファイル数無制限：</strong> 大量の決定通知書も、リスト形式でサクサク切り替え。
          </div>
          <div className="feature-row">
            <strong>買い切り1,980円：</strong> 1度のランチ代程度の投資で、毎月の「IEモード設定のイライラ」から解放されます。
          </div>
        </div>

        <div className="support-list">
          <h3>対応書類の例（SEO対策）</h3>
          <ul>
            <li>社会保険料額通知書（健康保険・厚生年金保険）</li>
            <li>被保険者標準報酬決定通知書</li>
            <li>オンライン事業所年金情報サービスから届く各種通知</li>
            <li>その他、e-Gov / e-Tax / eLTAX 発行のXML公文書</li>
          </ul>
        </div>

        <section className="conclusion">
          <h3>まとめ</h3>
          <p>
            道具の設定に時間を溶かすのは、もう終わりにしましょう。本来の業務である「経営」や「顧客対応」に集中するために。まずは無料のWeb版で、その圧倒的な速さを体感してください。
          </p>
          <div className="blog-footer-cta">
            <button onClick={() => { setShowBlog(false); setActiveTab('windows'); }} className="btn-outline-primary">
              Windows版の詳細を見る
            </button>
            <button onClick={() => { setShowBlog(false); setActiveTab(null); }} className="btn-primary-cta">
              Web版を試してみる
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button onClick={() => setShowBlog(false)} className="btn-text-link">← トップページに戻る</button>
          </div>
        </section>
      </div>
    </div>
  );

  // Hash Routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['privacy', 'terms', 'about', 'windows', 'buy', 'scta'].includes(hash)) {
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

  // Reset modal scroll to top when activeTab changes
  useEffect(() => {
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
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

  // Prerender trigger
  useEffect(() => {
    // Short delay to ensure browser rendering is complete
    setTimeout(() => {
      document.dispatchEvent(new Event('render-event'));
    }, 500);
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

    // Normalize to an array of {file, path}
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
    // Filter allowed files (.xml, .xsl, .zip)
    const allowedExtensions = ['.xml', '.xsl', '.zip'];
    const filteredFiles = normalizedFiles.filter(item => {
      const ext = item.file.name.substring(item.file.name.lastIndexOf('.')).toLowerCase();
      return allowedExtensions.includes(ext);
    });

    if (filteredFiles.length === 0) {
      alert('読み込み可能なファイル（XML, XSL, ZIP）が含まれていません。');
      setIsDragging(false);
      return;
    }

    const formData = new FormData();
    filteredFiles.forEach((item) => {
      // Create a new File object to preserve the relative path in the name (used by backend)
      const fileWithRelativePath = new File([item.file], item.path, {
        type: item.file.type,
      });
      formData.append('files', fileWithRelativePath);
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

      <div className={`main-container ${activeTab || showBlog ? 'modal-active' : ''}`}>
        {showBlog ? (
          renderBlog()
        ) : (
          <>
            {/* Section 1: Hero Section */}
            <section className="hero-section">
              <div className="hero-badge">設定不要・1秒プレビュー</div>
              <h1 className="hero-title">
                もう、EdgeのIEモード設定で<br />消耗するのはやめませんか？
              </h1>
              <p className="hero-subtitle">
                e-Govから届く「通知文書送達のお知らせ」XMLを、<br className="pc-only" />
                解凍不要・ドロップだけで今すぐ確認。
              </p>
              <div className="hero-visual">
                <div className="visual-card">
                  <Archive size={48} className="visual-icon" />
                  <div className="visual-arrow">→</div>
                  <FileText size={48} className="visual-icon" />
                </div>
              </div>
            </section>

            {/* Section 2: Web Version Section */}
            <section className="web-version-section" id="web-version">
              <div className="section-header">
                <h2 className="section-title">Web版（無料・即時解決）</h2>
                <p className="section-tagline">自社の通知を今すぐ確認したい方へ</p>
              </div>

              <div className="card">
                {/* Step 1: Upload */}
                <div className={`step ${step === 1 || fileList.length > 0 ? 'step-active' : ''}`}>
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
                        <Archive size={40} className="drop-icon" />
                        <p className="drop-text pc-only">
                          ここにZIPファイルをドラッグ＆ドロップ
                        </p>
                        <p className="drop-subtext pc-only">
                          （Web版：1回最大10ファイルまで）
                        </p>
                        <p className="drop-link">
                          またはクリックしてファイルを選択
                        </p>
                      </div>
                    ) : (
                      <div className="list-items">
                        {fileList.map((file: XMLFile, idx: number) => (
                          <div
                            key={idx}
                            className={`list-item ${activeFile?.path === file.path ? 'selected' : ''}`}
                            onClick={(e) => selectXMLFile(e, file)}
                          >
                            <FileText size={18} />
                            <span>{file.name}</span>
                          </div>
                        ))}
                        {totalFileCount > 10 && (
                          <div className="limit-alert">
                            <Info size={14} /> 10件まで表示中。全件処理はWindows版へ
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Preview Mode selection and execution */}
                <div className={`step ${step === 3 || activeFile ? 'step-active' : ''} ${!activeFile ? 'step-inactive' : ''}`}>
                  <div className="step-header">
                    <span className="step-number">2</span>
                    <span className="step-title">プレビュー表示</span>
                  </div>
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
                      <Printer size={20} /> 新しいウインドウで表示
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Security Warning Section */}
            <section className="security-bridge-section">
              <div className="warning-card">
                <div className="warning-header">
                  <ShieldCheck size={32} className="warning-icon" />
                  <h3>その公文書、ブラウザにアップロードして大丈夫ですか？</h3>
                </div>
                <div className="warning-content">
                  <p>
                    士業・法人の皆様へ。顧客の機密データを含むXMLをインターネット上に流すことには、常に漏洩のリスクが伴います。
                    <strong>プロフェッショナルな現場には、通信を一切行わない「完全オフライン」の選択を推奨します。</strong>
                  </p>
                  <button onClick={() => setActiveTab('windows')} className="btn-outline-white">
                    安全なオフライン版のメリットを見る
                  </button>
                </div>
              </div>
            </section>

            {/* Section 4: Windows Version Section */}
            <section className="windows-version-section" id="windows-version">
              <div className="section-header">
                <h2 className="section-title">Windowsデスクトップ版</h2>
                <p className="section-tagline">100%オフライン動作。プロのための信頼仕様。</p>
              </div>

              <div className="features-grid">
                <div className="feature-item">
                  <ShieldCheck size={32} />
                  <h4>完全オフライン</h4>
                  <p>外部サーバーとの通信は一切なし。機密書類も安心して扱えます。</p>
                </div>
                <div className="feature-item">
                  <Archive size={32} />
                  <h4>ファイル数無制限</h4>
                  <p>制限なく複数のファイルをまとめて表示。リストから瞬時に切り替え可能。</p>
                </div>
                <div className="feature-item">
                  <Plus size={32} />
                  <h4>高速・快適</h4>
                  <p>PCネイティブ動作で、重いXMLもストレスなくプレビュー。</p>
                </div>
              </div>

              <div className="price-card">
                <div className="price-badge">買い切り・安心の30日間無料トライアルあり</div>
                <div className="price-amount">1,980<span>円（税込）</span></div>
                <div className="cta-group-vertical">
                  <a href="https://github.com/goya-code-lab/xml-viewer/releases/download/v1.0.0/xmlview_viewer_dist.zip" className="btn-primary-cta btn-large">
                    <Download size={20} /> 無料トライアルをダウンロード
                  </a>
                  <button onClick={() => setActiveTab('windows')} className="btn-text-link">
                    インストール・機能の詳細を確認
                  </button>
                </div>
              </div>
            </section>

            {/* Section 5: Comparison Table */}
            <section className="comparison-section">
              <h2 className="section-title">Web版とWindows版の比較</h2>
              <div className="table-wrapper">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>比較項目</th>
                      <th>Web版（無料）</th>
                      <th>Windows版（プロ）</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>対象ユーザー</td>
                      <td>一般・小規模法人</td>
                      <td className="highlight-cell">士業・中大規模法人</td>
                    </tr>
                    <tr>
                      <td>セキュリティ</td>
                      <td>サーバー処理（SSL）</td>
                      <td className="highlight-cell">
                        <strong>100%オフライン</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>通信の有無</td>
                      <td>あり</td>
                      <td className="highlight-cell">完全なし</td>
                    </tr>
                    <tr>
                      <td>処理制限</td>
                      <td>1回10件まで</td>
                      <td className="highlight-cell">無制限・複数ファイル</td>
                    </tr>
                    <tr>
                      <td>価格</td>
                      <td>完全無料</td>
                      <td className="highlight-cell">1,980円（買い切り）</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 6: FAQ Section */}
            <section className="faq-section" id="faq">
              <h2 className="faq-title">よくあるご質問</h2>
              <div className="faq-list">
                <div className="faq-item">
                  <div className="faq-question">IEモードが使えない環境でも表示できますか？</div>
                  <div className="faq-answer">はい。本ツールはe-Govの仕様に最適化された変換ロジックを使用しているため、EdgeのIEモード設定やInternet Explorerの有無に関わらず、最新のブラウザで閲覧可能です。</div>
                </div>
                <div className="faq-item">
                  <div className="faq-question">「社会保険料額通知書」などの特殊なXMLに対応していますか？</div>
                  <div className="faq-answer">はい。e-Govから発行される主要な通知文書（XSLスタイルシート同梱形式）に最適化されています。</div>
                </div>
                <div className="faq-item">
                  <div className="faq-question">マイナンバーを含む書類をアップロードしても安全ですか？</div>
                  <div className="faq-answer">技術的にはSSL暗号化されていますが、より高い安全性を求める場合は、PC内で完結するWindows版のご利用を強くお勧めします。</div>
                </div>
                {faqs.map((faq, idx) => (
                  <div key={idx} className={`faq-item ${openFaqIndex === idx ? 'open' : ''}`}>
                    <button
                      className="faq-question-btn"
                      onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                    >
                      <span>{faq.q}</span>
                      <ChevronDown size={18} className="faq-icon" />
                    </button>
                    {openFaqIndex === idx && (
                      <div
                        className="faq-answer-content"
                        dangerouslySetInnerHTML={{ __html: faq.a }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Modal Overlay */}
      <div
        className={`modal-overlay ${activeTab ? 'active' : ''}`}
        onClick={() => setActiveTab(null)}
        style={{
          display: activeTab ? 'flex' : 'none',
          opacity: activeTab ? 1 : 0,
          visibility: activeTab ? 'visible' : 'hidden',
          pointerEvents: activeTab ? 'auto' : 'none'
        }}
      >
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setActiveTab(null)}>
            <X size={24} />
          </button>
          <div className="modal-body" ref={modalBodyRef}>
            <div className="content-page" style={{ display: activeTab === 'privacy' ? 'block' : 'none' }}>
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
            <div className="content-page" style={{ display: activeTab === 'terms' ? 'block' : 'none' }}>
              <h2>免責事項</h2>
              <h3>無保証について</h3>
              <p>本サービスは、現状のままで提供されるものであり、提供される情報の正確性、完全性、妥当性、特定の目的への適合性、または本サービスの利用による結果について、<strong>Goya Code Lab</strong>はいかなる保証も行いません。</p>
              <h3>責任の限定</h3>
              <p>ユーザーが本サービスを利用したことにより生じた直接的、間接的、付随的、特別、または波及的な損害（データの損失、業務の中断、利益の損失等を含みますが、これらに限定されません）について、当方は一切の責任を負いません。</p>
              <h3>サービスの変更・停止</h3>
              <p>当方は、予告なく本サービスの内容を変更、中断、または終了することができるものとします。</p>
            </div>
            <div className="content-page" style={{ display: activeTab === 'about' ? 'block' : 'none' }}>
              <h2>本サイトについて</h2>
              <h3>開発の目的</h3>
              <p>「公文書XMLブラウザ」は、e-Gov（電子政府の総合窓口）やe-Tax、自治体から発行される電子公文書XMLを、専用ソフトなしで美しく閲覧するために開発されました。</p>
              <p>社労士・税理士・事務スタッフの皆様が直面する「XMLファイルの中身がタグだらけで読めない」という課題を、最適化されたプレビュー技術で解決します。</p>

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
                <button onClick={() => setActiveTab('windows')} className="btn-cta-link" style={{ background: '#0284c7', color: 'white', marginTop: '10px' }}>
                  Windows版の詳細を見る
                </button>
              </div>
              <h3>動作環境</h3>
              <ul>
                <li>推奨ブラウザ: Google Chrome, Microsoft Edge, Safari (最新版)</li>
                <li>フォルダ・ZIPアップロード対応 (Chromium系ブラウザ推奨)</li>
              </ul>
            </div>
            <div className="content-page" style={{ display: activeTab === 'windows' ? 'block' : 'none' }}>
              <h2>電子公文書XMLビューア Windows版</h2>
              <p>インターネット接続なしで動作する、高セキュリティなデスクトップアプリケーションです。プロフェッショナルな現場に最適な機能を提供します。</p>

              <div style={{ margin: '2rem 0', textAlign: 'center' }}>
                <img
                  src="/windows_screenshot.png"
                  alt="Windows版の画面イメージ"
                  style={{
                    maxWidth: '100%',
                    borderRadius: '16px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
                    border: '1px solid rgba(0,0,0,0.05)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', margin: '2rem 0' }}>
                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#0284c7' }}>100% オフライン</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>データがPCの外に出ることがないため、極めて高い機密性を保持できます。</p>
                </div>
                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#0284c7' }}>ファイル数無制限</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Web版のような同時表示制限がなく、大量の公文書もリストから選択してスムーズに表示可能です。</p>
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
                    <td style={{ padding: '12px', fontWeight: 700 }}>1,980円 (税込)</td>
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
                  <a href="https://github.com/goya-code-lab/xml-viewer/releases/download/v1.0.0/xmlview_viewer_dist.zip" className="btn-cta-link" style={{ background: '#1e293b', color: 'white' }}>
                    Windows版をダウンロード
                  </a>
                  <button onClick={() => setActiveTab('buy')} className="btn-cta-link" style={{ background: '#0284c7', color: 'white' }}>
                    ライセンスを購入する
                  </button>
                </div>
              </div>
            </div>
            <div className="content-page" style={{ display: activeTab === 'buy' ? 'block' : 'none' }}>
              <h2>Standard版ライセンスの購入</h2>
              <p>電子公文書XMLビューア Standard版をご検討いただきありがとうございます。</p>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '24px', padding: '2rem', margin: '2rem 0', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>買い切りライセンス</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>¥1,980 <span style={{ fontSize: '1rem', fontWeight: 400 }}> (税込)</span></div>

                <ul style={{ textAlign: 'left', display: 'inline-block', marginBottom: '2rem' }}>
                  <li>✓ 試用期間（30日）の解除</li>
                  <li>✓ 永続的な利用が可能</li>
                  <li>✓ 同一ユーザーなら複数台PCでも利用可能</li>
                  <li>✓ 今後のアップデートに対応</li>
                </ul>

                <div style={{ marginBottom: '1.5rem' }}>
                  <a href="https://buy.stripe.com/fZu4gy3ZLc6D9GF763gjC00" className="btn-cta-link" style={{ background: '#0284c7', color: 'white', fontSize: '1.1rem', padding: '16px 32px', borderRadius: '16px' }}>
                    カード決済で進む (Stripe)
                  </a>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'left', background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>領収書について</p>
                  <p style={{ margin: '0 0 0.5rem 0' }}>・決済完了後、Stripeより領収書メールが自動送信されます。</p>
                  <p style={{ margin: '0 0 1rem 0' }}>・宛名（会社名等）入りの領収書が必要な方は、決済後に「お問合せフォーム」より決済日と購入メールアドレスを添えてご連絡ください。PDF形式にて発行いたします。</p>

                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    ※ 決済完了後、ご入力いただいたメールアドレス宛に即座にライセンスキーが送信されます。<br />
                    ※ 特定商取引法に基づく表記は<a href="#scta" onClick={() => setActiveTab('scta')}>こちら</a>をご確認ください。
                  </p>
                </div>
              </div>

              <h3>決済の流れ</h3>
              <ol style={{ fontSize: '0.9rem', color: '#475569' }}>
                <li>上のボタンからStripe（外部決済サイト）へ進みます。</li>
                <li>メールアドレスとクレジットカード情報を入力して決済を完了させます。</li>
                <li>決済完了後、数分以内にライセンスキーが記載された自動メールが届きます。</li>
                <li>アプリ起動時にキーを入力すると、Standard版が有効化されます。</li>
              </ol>

              <div style={{ marginTop: '2rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#475569' }}>メールが届かない場合</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: '1.6' }}>
                  決済完了から10分以上経過してもメールが届かない場合は、まず以下の点をご確認ください：
                </p>
                <ul style={{ margin: '10px 0', fontSize: '0.85rem', color: '#64748b', paddingLeft: '20px' }}>
                  <li>迷惑メールフォルダや「プロモーション」タブに入っていないか</li>
                  <li>ご入力いただいたメールアドレスに誤りがなかったか</li>
                  <li>ドメイン指定受信設定（@goya-code-lab.jp からのメールを許可）</li>
                </ul>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: '1.6' }}>
                  解決しない場合は、こちらの<a href="https://forms.gle/xMzEXUMWRAzct21q7" target="_blank" rel="noopener noreferrer">お問い合わせフォーム</a>よりご連絡ください。<br />
                  決済状況を確認の上、対応させていただきます。
                </p>
              </div>
            </div>
            <div className="content-page" style={{ display: activeTab === 'scta' ? 'block' : 'none' }}>
              <h2>特定商取引法に基づく表記</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem', fontSize: '0.9rem' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', width: '30%', color: '#64748b' }}>販売業者</th>
                    <td style={{ padding: '12px' }}>Goya Code Lab</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>運営責任者</th>
                    <td style={{ padding: '12px' }}>田中 聡</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>所在地</th>
                    <td style={{ padding: '12px' }}>
                      特定商取引法第11条の但書きに基づき、ご請求があれば遅滞なく開示いたします。<br />
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>※開示をご希望の場合は下記メールアドレスまでご連絡ください。</span>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>電話番号</th>
                    <td style={{ padding: '12px' }}>
                      特定商取引法第11条の但書きに基づき、ご請求があれば遅滞なく開示いたします。
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>メールアドレス</th>
                    <td style={{ padding: '12px' }}>support@goya-code-lab.jp</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>販売価格</th>
                    <td style={{ padding: '12px' }}>
                      1,980円（税込）
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>商品代金以外の必要料金</th>
                    <td style={{ padding: '12px' }}>
                      なし（ダウンロード販売のため）
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>支払方法</th>
                    <td style={{ padding: '12px' }}>クレジットカード決済</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>支払時期</th>
                    <td style={{ padding: '12px' }}>商品注文確定時にお支払いが確定します。</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>商品の引渡時期</th>
                    <td style={{ padding: '12px' }}>代金決済完了後、即座にライセンスキーをメールにて送付します。</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>返品・交換・キャンセル</th>
                    <td style={{ padding: '12px' }}>
                      商品（ライセンスキー）の性質上、決済完了後の返品・キャンセルはお受けできません。<br />
                      購入前に試用版にて動作を確認の上、お申し込みください。
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>動作環境</th>
                    <td style={{ padding: '12px' }}>商品ページ、または配布ソフトウェアの説明書に記載。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Navigation Updates */}
      <footer className="footer-section">
        <div className="footer-content">
          <div className="footer-column">
            <div className="footer-group-title">
              <span className="footer-icon-wrapper"><Archive size={18} /></span>
              製品・サービス (Service)
            </div>
            <button onClick={() => setActiveTab('about')}>
              <span className="footer-icon-wrapper"><Info size={16} /></span> 本サイトについて
            </button>
            <button onClick={() => setActiveTab('windows')}>
              <span className="footer-icon-wrapper"><Layout size={16} /></span> Windows版の詳細
            </button>
            <button onClick={() => setActiveTab('buy')}>
              <span className="footer-icon-wrapper"><Printer size={16} /></span> ライセンス購入
            </button>
            <button onClick={() => { setShowBlog(true); setActiveTab(null); }}>
              <span className="footer-icon-wrapper"><FileText size={16} /></span> ブログ・お役立ち情報
            </button>
          </div>

          <div className="footer-column">
            <div className="footer-group-title">
              <span className="footer-icon-wrapper"><ShieldCheck size={18} /></span>
              法的情報 (Legal)
            </div>
            <button onClick={() => setActiveTab('privacy')}>
              <span className="footer-icon-wrapper"><ShieldCheck size={16} /></span> プライバシーポリシー
            </button>
            <button onClick={() => setActiveTab('scta')}>
              <span className="footer-icon-wrapper"><FileText size={16} /></span> 特定商取引法に基づく表記
            </button>
            <button onClick={() => setActiveTab('terms')}>
              <span className="footer-icon-wrapper"><ShieldCheck size={16} /></span> 免責事項・利用規約
            </button>
          </div>

          <div className="footer-column">
            <div className="footer-group-title">
              <span className="footer-icon-wrapper"><ExternalLink size={18} /></span>
              サポート (Support)
            </div>
            <a href="https://forms.gle/xMzEXUMWRAzct21q7" target="_blank" rel="noopener noreferrer">
              <span className="footer-icon-wrapper"><ExternalLink size={16} /></span> お問い合わせフォーム
            </a>
          </div>
        </div>

        <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(0,0,0,0.03)' }}>
          © 2026 Goya Code Lab
        </div>
      </footer>
    </>
  );
};

export default App;
